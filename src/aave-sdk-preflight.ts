import {
  AaveClient,
  bigDecimal,
  chainId,
  evmAddress,
  production
} from "@aave/client";
import { reserve, vaultDeploy } from "@aave/client/actions";
import { deploymentConfig } from "./deployment-config";

const panel = document.getElementById("aave-sdk-preflight");

if (!panel) {
  throw new Error("Aave SDK preflight panel was not found.");
}

panel.innerHTML = `
  <div class="sdk-preflight">
    <div class="sdk-heading">
      <div>
        <p class="eyebrow">OFFICIAL AAVE SDK · READ-ONLY PREFLIGHT</p>
        <h3>Simple Earn deployment check</h3>
        <p class="muted">Checks the live EURC reserve and asks Aave's official API to prepare a deployment plan. The plan is never sent, signed or approved here.</p>
      </div>
      <span class="sdk-status">No wallet connected</span>
    </div>
    <div class="sdk-config-grid">
      <div><span>SDK</span><strong>@aave/client 0.12.0</strong></div>
      <div><span>Initial lock</span><strong>1 EURC · API validation pending</strong></div>
      <div><span>Owner / deployer</span><code>${deploymentConfig.deployer}</code></div>
      <div><span>Fee</span><strong>10% · 100% manager-side recipient allocation</strong></div>
    </div>
    <div class="sdk-action-row">
      <button id="run-aave-preflight" class="refresh-button" type="button">Run official Aave preflight</button>
      <span id="sdk-result" class="sdk-result" role="status" aria-live="polite">Ready · no wallet or transaction functionality loaded</span>
    </div>
    <p id="sdk-plan" class="sdk-plan" hidden></p>
  </div>
`;

const resultElement = document.getElementById("sdk-result") as HTMLSpanElement;
const planElement = document.getElementById("sdk-plan") as HTMLParagraphElement;
const runButton = document.getElementById("run-aave-preflight") as HTMLButtonElement;

const client = AaveClient.create({ environment: production });

function showError(message: string) {
  resultElement.textContent = "Preflight failed";
  planElement.hidden = false;
  planElement.textContent = message;
}

async function runPreflight() {
  runButton.disabled = true;
  resultElement.textContent = "Checking Base EURC reserve through Aave…";
  planElement.hidden = true;
  planElement.textContent = "";

  try {
    const marketAddress = evmAddress(deploymentConfig.aaveV3.pool);
    const tokenAddress = evmAddress(deploymentConfig.asset.address);
    const networkChainId = chainId(deploymentConfig.chainId);

    if (
      deploymentConfig.owner.toLowerCase() !== deploymentConfig.deployer.toLowerCase() ||
      deploymentConfig.safety.walletConnectionEnabled ||
      deploymentConfig.safety.transactionSigningEnabled ||
      deploymentConfig.safety.transactionSubmissionEnabled
    ) {
      throw new Error("Safety/configuration guard failed. No deployment plan was requested.");
    }

    const reserveResult = await reserve(client, {
      market: marketAddress,
      underlyingToken: tokenAddress,
      chainId: networkChainId
    });

    if (reserveResult.isErr()) {
      throw new Error(`Aave reserve query failed: ${reserveResult.error.message}`);
    }

    const liveReserve = reserveResult.value;
    if (!liveReserve) {
      throw new Error("Aave API did not return the configured Base EURC reserve.");
    }

    if (
      liveReserve.underlyingToken.address.toLowerCase() !== tokenAddress.toLowerCase() ||
      liveReserve.underlyingToken.decimals !== deploymentConfig.asset.decimals ||
      liveReserve.market.address.toLowerCase() !== marketAddress.toLowerCase()
    ) {
      throw new Error("Live reserve identity does not match the configured Base EURC market.");
    }

    if (liveReserve.isPaused || liveReserve.isFrozen) {
      throw new Error("The EURC reserve is paused or frozen. Deployment preflight stopped.");
    }

    if (!liveReserve.supplyInfo || liveReserve.supplyInfo.supplyCapReached) {
      throw new Error("EURC supply is unavailable or its supply cap has been reached.");
    }

    resultElement.textContent = "Reserve verified · requesting an SDK deployment plan…";

    const deployResult = await vaultDeploy(client, {
      underlyingToken: tokenAddress,
      market: marketAddress,
      chainId: networkChainId,
      deployer: evmAddress(deploymentConfig.deployer),
      owner: evmAddress(deploymentConfig.owner),
      initialFee: bigDecimal(String(deploymentConfig.performanceFeeBps / 100)),
      shareName: deploymentConfig.vaultName,
      shareSymbol: deploymentConfig.shareTokenSymbol,
      initialLockDeposit: bigDecimal(deploymentConfig.initialLockDeposit.amount),
      recipients: deploymentConfig.feeRecipients.map((recipient) => ({
        address: evmAddress(recipient.address),
        percent: bigDecimal(String(recipient.percentOfManagerSideAllocation))
      }))
    });

    if (deployResult.isErr()) {
      throw new Error(`Aave SDK rejected the deployment request: ${deployResult.error.message}`);
    }

    const plan = deployResult.value;
    resultElement.textContent = "Aave SDK returned a deployment plan · nothing was sent";
    planElement.hidden = false;

    if (plan.__typename === "ApprovalRequired") {
      planElement.textContent =
        "The SDK indicates an approval step is required before deployment. This app has not requested approval, connected a wallet, signed, or sent either transaction. The 1 EURC initial lock was accepted by the API for plan generation.";
    } else if (plan.__typename === "TransactionRequest") {
      planElement.textContent =
        "The SDK prepared a deployment transaction request without a separate approval step. The 1 EURC initial lock was accepted by the API for plan generation. Transaction data is intentionally not exposed or submitted by this preflight.";
    } else if (plan.__typename === "InsufficientBalanceError") {
      planElement.textContent =
        `Aave accepted the deployment request but reports insufficient EURC in the deployer wallet. Available: ${plan.available.value} EURC; required: ${plan.required.value} EURC. The initial lock deposit is permanently locked. No wallet was connected and no approval or transaction was submitted.`;
    } else {
      planElement.textContent =
        `The SDK returned plan type: ${plan.__typename}. No transaction was signed or submitted. Review the returned plan type before any future wallet integration.`;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Aave SDK preflight error.";
    showError(message);
  } finally {
    runButton.disabled = false;
  }
}

runButton.addEventListener("click", () => {
  void runPreflight();
});
