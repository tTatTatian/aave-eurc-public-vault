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
        <p class="muted">Checks the live EURC reserve and asks Aave's official API to prepare a deployment plan. This page never connects a wallet, signs, approves, or sends transactions.</p>
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
    <div id="sdk-plan" class="sdk-plan" hidden></div>
  </div>
`;

const resultElement = document.getElementById("sdk-result") as HTMLSpanElement;
const planElement = document.getElementById("sdk-plan") as HTMLDivElement;
const runButton = document.getElementById("run-aave-preflight") as HTMLButtonElement;

const client = AaveClient.create({ environment: production });

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}

function transactionSummary(label: string, tx: {
  to: string;
  from: string;
  data: string;
  value: string | number | bigint;
  chainId: number;
  operation?: string | null;
}): string {
  const data = String(tx.data ?? "");
  const selector = /^0x[0-9a-fA-F]{8}/.test(data) ? data.slice(0, 10) : "Unavailable";
  const byteLength = data.startsWith("0x") ? Math.max(0, (data.length - 2) / 2) : 0;
  return `
    <section class="sdk-detail-card">
      <h4>${escapeHtml(label)}</h4>
      <dl class="sdk-detail-grid">
        <div><dt>Network / chain ID</dt><dd>${escapeHtml(tx.chainId)} ${tx.chainId === 8453 ? "· Base" : ""}</dd></div>
        <div><dt>Contract called (to)</dt><dd><code>${escapeHtml(tx.to)}</code></dd></div>
        <div><dt>Expected sender (from)</dt><dd><code>${escapeHtml(tx.from)}</code></dd></div>
        <div><dt>Native value</dt><dd>${escapeHtml(String(tx.value))}</dd></div>
        <div><dt>SDK operation</dt><dd>${escapeHtml(tx.operation || "Not specified")}</dd></div>
        <div><dt>Calldata selector / size</dt><dd><code>${escapeHtml(selector)}</code> · ${escapeHtml(byteLength)} bytes (calldata hidden)</dd></div>
      </dl>
    </section>`;
}

function approvalSpender(data: string): string | null {
  // ERC-20 approve(address,uint256): selector + 32-byte address + 32-byte amount.
  const match = /^0x095ea7b3([0-9a-fA-F]{64})([0-9a-fA-F]{64})$/i.exec(data);
  if (!match) return null;
  return "0x" + match[1].slice(24);
}

function showPlanDetails(plan: any) {
  if (plan.__typename === "ApprovalRequired") {
    const approval = plan.approval;
    const spender = approvalSpender(String(approval.data ?? ""));
    const spenderHtml = spender
      ? escapeHtml(spender)
      : "Could not safely decode the spender from the approval calldata";
    planElement.innerHTML = `
      <div class="sdk-plan-intro">
        <strong>Approval required · review only</strong>
        <p>${escapeHtml(plan.reason)}</p>
        <p>No transaction has been submitted. The approval and deployment requests below are displayed for inspection only.</p>
      </div>
      <section class="sdk-detail-card">
        <h4>EURC allowance details</h4>
        <dl class="sdk-detail-grid">
          <div><dt>Token contract (approval transaction target)</dt><dd><code>${escapeHtml(approval.to)}</code></dd></div>
          <div><dt>Spender (decoded from approve calldata)</dt><dd><code>${spenderHtml}</code></dd></div>
          <div><dt>Required allowance</dt><dd>${escapeHtml(plan.requiredAmount.value)} EURC</dd></div>
          <div><dt>Current allowance</dt><dd>${escapeHtml(plan.currentAllowance.value)} EURC</dd></div>
          <div><dt>Allowance decimals</dt><dd>${escapeHtml(plan.requiredAmount.decimals)}</dd></div>
        </dl>
      </section>
      ${transactionSummary("Approval transaction (not sent)", approval)}
      ${transactionSummary("Vault deployment transaction (not sent)", plan.originalTransaction)}
      <p class="sdk-review-warning">Safety check: confirm the chain is Base (8453), the sender matches the configured deployer, the token is the EURC contract, and the decoded spender matches the intended Aave deployment flow. Do not approve if any field is unexpected.</p>
    `;
  } else if (plan.__typename === "TransactionRequest") {
    planElement.innerHTML = `
      <div class="sdk-plan-intro"><strong>Deployment transaction prepared · not sent</strong><p>The SDK returned a single transaction request. Review the destination and sender before any wallet action.</p></div>
      ${transactionSummary("Vault deployment transaction (not sent)", plan)}
    `;
  } else if (plan.__typename === "InsufficientBalanceError") {
    planElement.textContent =
      `Aave accepted the deployment request but reports insufficient EURC in the deployer wallet. Available: ${plan.available.value} EURC; required: ${plan.required.value} EURC. The initial lock deposit is permanently locked. No wallet was connected and no approval or transaction was submitted.`;
  } else {
    planElement.textContent =
      "The SDK returned an unsupported deployment-plan shape. No transaction was signed or submitted. Manual review is required.";
  }
  planElement.hidden = false;
}

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
    showPlanDetails(plan);
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
