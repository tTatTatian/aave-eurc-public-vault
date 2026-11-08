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
        <p class="muted">Checks the live EURC reserve and asks Aave's official API to prepare a deployment plan. This page connects MetaMask only when you explicitly tap Connect MetaMask. It can request the exact 1 EURC approval after a separate tap and MetaMask confirmation; vault deployment is never submitted here.</p>
      </div>
      <span class="sdk-status">Wallet connection optional</span>
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
let connectedWallet: string | null = null;
const EURC_TOKEN = deploymentConfig.asset.address.toLowerCase();
const FACTORY_SPENDER = "0xa35995bb2ffc5f2b33379c2e95d00c20fbf71e70";
const EXACT_ALLOWANCE = 1_000_000n;

async function connectMetaMask(): Promise<string> {
  const ethereum = (window as any).ethereum;
  if (!ethereum?.request) throw new Error("MetaMask provider not found. Open this project in MetaMask's browser.");
  const accounts = await ethereum.request({ method: "eth_requestAccounts" }) as string[];
  const chain = String(await ethereum.request({ method: "eth_chainId" })).toLowerCase();
  if (chain !== "0x2105") throw new Error("Switch MetaMask to Base Mainnet (chain ID 8453).");
  const account = accounts?.[0];
  if (!account || account.toLowerCase() !== deploymentConfig.deployer.toLowerCase()) {
    throw new Error("Connected account does not match the configured deployer.");
  }
  connectedWallet = account;
  return account;
}

async function submitExactApproval(approval: any): Promise<string> {
  const ethereum = (window as any).ethereum;
  if (!ethereum?.request || !connectedWallet) throw new Error("Connect the configured MetaMask wallet first.");
  const chain = String(await ethereum.request({ method: "eth_chainId" })).toLowerCase();
  const accounts = await ethereum.request({ method: "eth_accounts" }) as string[];
  const data = String(approval.data ?? "");
  const match = /^0x095ea7b3([0-9a-fA-F]{64})([0-9a-fA-F]{64})$/i.exec(data);
  if (chain !== "0x2105" ||
      accounts?.[0]?.toLowerCase() !== deploymentConfig.deployer.toLowerCase() ||
      String(approval.from).toLowerCase() !== deploymentConfig.deployer.toLowerCase() ||
      String(approval.to).toLowerCase() !== EURC_TOKEN ||
      approvalSpender(data)?.toLowerCase() !== FACTORY_SPENDER ||
      !match || BigInt("0x" + match[2]) !== EXACT_ALLOWANCE ||
      Number(approval.chainId) !== 8453 ||
      BigInt(String(approval.value ?? 0)) !== 0n) {
    throw new Error("Approval did not match the exact reviewed Base EURC, factory, sender and 1-EURC parameters. Nothing was sent.");
  }
  return await ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from: connectedWallet, to: approval.to, data, value: "0x0" }]
  }) as string;
}


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


const BASE_POOL_ADDRESSES_PROVIDER = "0xe20fcBdbfFC4Dd138cE8b2E6FBb6CB49777ad64D".toLowerCase();
const DEPLOY_VAULT_SELECTOR = "0x81d42dea";

function readAbiWord(body: string, byteOffset: number): bigint {
  const start = byteOffset * 2;
  const word = body.slice(start, start + 64);
  if (word.length !== 64) throw new Error("Deployment calldata is truncated.");
  return BigInt("0x" + word);
}

function readAbiAddress(body: string, byteOffset: number): string {
  return "0x" + readAbiWord(body, byteOffset).toString(16).padStart(64, "0").slice(-40);
}

function readAbiString(body: string, tupleStart: number, relativeOffset: bigint): string {
  const position = tupleStart + Number(relativeOffset);
  const length = Number(readAbiWord(body, position));
  if (!Number.isSafeInteger(length) || length < 0 || length > 1024) {
    throw new Error("Unexpected string length in deployment calldata.");
  }
  const start = (position + 32) * 2;
  const hex = body.slice(start, start + length * 2);
  if (hex.length !== length * 2) throw new Error("Deployment string is truncated.");
  const bytes = Uint8Array.from(hex.match(/.{2}/g) ?? [], (pair) => parseInt(pair, 16));
  return new TextDecoder().decode(bytes);
}

function formatUnits(raw: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = (raw % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? whole.toString() + "." + fraction : whole.toString();
}

function formatWadPercent(raw: bigint): string {
  const scaled = raw * 100n;
  const whole = scaled / 10n ** 18n;
  const fraction = (scaled % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? whole.toString() + "." + fraction + "%" : whole.toString() + "%";
}

function decodeVaultDeployment(data: string) {
  if (!data.toLowerCase().startsWith(DEPLOY_VAULT_SELECTOR)) {
    throw new Error("Deployment calldata selector is not ATokenVaultFactory.deployVault(tuple).");
  }
  const body = data.slice(10);
  const tupleStart = Number(readAbiWord(body, 0));
  if (!Number.isSafeInteger(tupleStart) || tupleStart < 32) throw new Error("Invalid tuple offset.");
  const at = (index: number) => tupleStart + index * 32;
  const underlying = readAbiAddress(body, at(0));
  const referralCode = readAbiWord(body, at(1));
  const poolAddressesProvider = readAbiAddress(body, at(2));
  const owner = readAbiAddress(body, at(3));
  const initialFee = readAbiWord(body, at(4));
  const shareName = readAbiString(body, tupleStart, readAbiWord(body, at(5)));
  const shareSymbol = readAbiString(body, tupleStart, readAbiWord(body, at(6)));
  const initialLockDeposit = readAbiWord(body, at(7));
  const recipientsOffset = readAbiWord(body, at(8));
  const recipientsStart = tupleStart + Number(recipientsOffset);
  const recipientCount = Number(readAbiWord(body, recipientsStart));
  if (!Number.isSafeInteger(recipientCount) || recipientCount < 0 || recipientCount > 32) {
    throw new Error("Unexpected fee-recipient count in deployment calldata.");
  }
  const recipients = Array.from({ length: recipientCount }, (_, index) => {
    const entry = recipientsStart + 32 + index * 64;
    return {
      address: readAbiAddress(body, entry),
      shareInBps: Number(readAbiWord(body, entry + 32))
    };
  });
  return { underlying, referralCode: referralCode.toString(), poolAddressesProvider, owner,
    initialFee, shareName, shareSymbol, initialLockDeposit, recipients };
}

function showDecodedDeployment(data: string): string {
  const decoded = decodeVaultDeployment(data);
  const expectedFee = BigInt(deploymentConfig.performanceFeeBps) * 10n ** 18n / 10_000n;
  // Aave's API added this Base Safe to the final calldata in the prior
  // preflight. Its exact isAaveLabs identity is not independently verified.
  // Fail closed if the observed API recipient or split changes.
  const apiAddedRecipient = "0xba3fa06e181d4a64b07d0ed0e8369811f0ad44ba";
  const expectedRecipients = [
    { address: deploymentConfig.owner.toLowerCase(), shareInBps: 5_000 },
    { address: apiAddedRecipient, shareInBps: 5_000 }
  ];
  const actualRecipients = decoded.recipients
    .map(({ address, shareInBps }) => ({ address: address.toLowerCase(), shareInBps }))
    .sort((x, y) => x.address.localeCompare(y.address));
  const sortedExpectedRecipients = [...expectedRecipients]
    .sort((x, y) => x.address.localeCompare(y.address));
  const checks: [string, boolean][] = [
    ["EURC underlying", decoded.underlying.toLowerCase() === deploymentConfig.asset.address.toLowerCase()],
    ["Aave Base Pool Addresses Provider", decoded.poolAddressesProvider.toLowerCase() === BASE_POOL_ADDRESSES_PROVIDER],
    ["Vault owner", decoded.owner.toLowerCase() === deploymentConfig.owner.toLowerCase()],
    ["Initial performance fee", decoded.initialFee === expectedFee],
    ["Share token name", decoded.shareName === deploymentConfig.vaultName],
    ["Share token symbol", decoded.shareSymbol === deploymentConfig.shareTokenSymbol],
    ["Initial lock deposit", decoded.initialLockDeposit === deploymentConfig.initialLockDeposit.rawAmount],
    ["Fee recipient list (owner 50% + API-added Safe 50%)",
      actualRecipients.length === sortedExpectedRecipients.length &&
      actualRecipients.every((recipient, i) =>
        recipient.address === sortedExpectedRecipients[i].address &&
        recipient.shareInBps === sortedExpectedRecipients[i].shareInBps)]
  ];
  const allPass = checks.every(([, pass]) => pass);
  const checkRows = checks.map(([label, pass]) =>
    '<div class="sdk-config-check"><span class="' + (pass ? "pass" : "fail") + '">' +
    (pass ? "PASS" : "MISMATCH") + '</span><span>' + escapeHtml(label) + '</span></div>'
  ).join("");
  const recipientRows = decoded.recipients.map((recipient) =>
    '<li><code>' + escapeHtml(recipient.address) + '</code> — ' +
    escapeHtml((recipient.shareInBps / 100).toFixed(2)) + '% of manager-side allocation</li>'
  ).join("");
  return '<section class="sdk-detail-card"><h4>Decoded vault deployment configuration</h4>' +
    '<p class="sdk-decode-status ' + (allPass ? "pass" : "fail") + '">' +
    (allPass ? "All configured deployment parameters match" : "One or more deployment parameters do not match — do not proceed") +
    '</p><div class="sdk-config-checks">' + checkRows + '</div>' +
    '<dl class="sdk-detail-grid sdk-decoded-grid">' +
    '<div><dt>Underlying asset</dt><dd><code>' + escapeHtml(decoded.underlying) + '</code></dd></div>' +
    '<div><dt>Pool Addresses Provider</dt><dd><code>' + escapeHtml(decoded.poolAddressesProvider) + '</code></dd></div>' +
    '<div><dt>Owner</dt><dd><code>' + escapeHtml(decoded.owner) + '</code></dd></div>' +
    '<div><dt>Referral code</dt><dd>' + escapeHtml(decoded.referralCode) + '</dd></div>' +
    '<div><dt>Initial performance fee</dt><dd>' + escapeHtml(formatWadPercent(decoded.initialFee)) + '</dd></div>' +
    '<div><dt>Initial locked deposit</dt><dd>' + escapeHtml(formatUnits(decoded.initialLockDeposit, deploymentConfig.asset.decimals)) + ' EURC</dd></div>' +
    '<div><dt>Share token name</dt><dd>' + escapeHtml(decoded.shareName) + '</dd></div>' +
    '<div><dt>Share token symbol</dt><dd>' + escapeHtml(decoded.shareSymbol) + '</dd></div></dl>' +
    '<h4 class="sdk-recipient-heading">Fee recipients encoded by Aave API</h4>' +
    '<ul class="sdk-recipient-list">' + (recipientRows || "<li>No recipients encoded</li>") + '</ul>' +
    '<p class="sdk-review-warning">The API-added Safe address is checked against the address observed in the prior Base preflight. Official Aave SDK tests demonstrate an automatically added Aave recipient, but this exact address has not been independently verified here as isAaveLabs. If the address or 50/50 split changes, this check fails closed. Do not treat the address identity as independently proven.</p></section>';
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
        <strong>Approval required · MetaMask connection available</strong>
        <p>${escapeHtml(plan.reason)}</p>
        <p>Connect the configured wallet, then request only the exact 1 EURC approval. This control never submits the vault deployment.</p>
        <div class="sdk-action-row">
          <button id="connect-metamask" class="refresh-button" type="button">Connect MetaMask</button>
          <button id="approve-exact-eurc" class="refresh-button" type="button" disabled>Approve exactly 1 EURC</button>
          <span id="wallet-approval-status" class="sdk-result" role="status" aria-live="polite">Wallet not connected</span>
        </div>
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
      ${showDecodedDeployment(String(plan.originalTransaction.data ?? ""))}
      <p class="sdk-review-warning">Safety check: only the exact 1 EURC approval is enabled here. The deployment transaction remains review-only and cannot be submitted by this button.</p>
    `;
    const connectButton = document.getElementById("connect-metamask") as HTMLButtonElement;
    const approveButton = document.getElementById("approve-exact-eurc") as HTMLButtonElement;
    const walletStatus = document.getElementById("wallet-approval-status") as HTMLSpanElement;
    connectButton.addEventListener("click", async () => {
      connectButton.disabled = true;
      try {
        const account = await connectMetaMask();
        walletStatus.textContent = "Connected: " + account;
        approveButton.disabled = false;
      } catch (error) {
        walletStatus.textContent = error instanceof Error ? error.message : "Connection failed.";
      } finally {
        connectButton.disabled = false;
      }
    });
    approveButton.addEventListener("click", async () => {
      approveButton.disabled = true;
      walletStatus.textContent = "Check the transaction details in MetaMask…";
      try {
        const hash = await submitExactApproval(approval);
        walletStatus.textContent = "Approval submitted: " + hash + ". Wait for confirmation, then rerun preflight.";
      } catch (error) {
        walletStatus.textContent = error instanceof Error ? error.message : "Approval not submitted.";
        approveButton.disabled = false;
      }
    });
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
