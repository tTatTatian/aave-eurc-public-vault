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
        <p class="muted">Checks the live EURC reserve and asks Aave's official API to prepare a deployment plan. This panel is read-only: it displays transaction requirements for review but does not connect a wallet, request token approval, sign, or submit transactions.</p>
      </div>
      <span class="sdk-status">Read-only · no wallet connection</span>
    </div>
    <div class="sdk-config-grid">
      <div><span>SDK</span><strong>@aave/client 0.12.0</strong></div>
      <div><span>Initial lock</span><strong id="initial-lock-status">1 EURC · allowance check pending</strong></div>
      <div><span>Owner / deployer</span><code>${deploymentConfig.deployer}</code></div>
      <div><span>Fee</span><strong>10% · 100% manager-side recipient allocation</strong></div>
    </div>
    <div class="sdk-action-row">
      <button id="run-aave-preflight" class="refresh-button" type="button">Run official Aave preflight</button>
      <span id="sdk-result" class="sdk-result" role="status" aria-live="polite">Ready · read-only preflight</span>
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

function decodeApproval(data: string): { spender: string; amount: bigint } | null {
  const match = /^0x095ea7b3([0-9a-fA-F]{64})([0-9a-fA-F]{64})$/i.exec(data);
  if (!match) return null;
  return {
    spender: "0x" + match[1].slice(24),
    amount: BigInt("0x" + match[2])
  };
}

function encodeExactApproval(spender: string, amount: bigint): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(spender) || amount < 0n || amount >= 2n ** 256n) {
    throw new Error("Cannot encode the proposed exact EURC approval.");
  }
  return "0x095ea7b3" + spender.slice(2).toLowerCase().padStart(64, "0") +
    amount.toString(16).padStart(64, "0");
}

function approvalSafetyChecks(approval: any, deployment: any): [string, boolean][] {
  const decoded = decodeApproval(String(approval.data ?? ""));
  const factory = "0xa35995bb2ffc5f2b33379c2e95d00c20fbf71e70";
  const expectedAmount = deploymentConfig.initialLockDeposit.rawAmount;
  const deployData = String(deployment?.data ?? "");
  const deploySelector = /^0x[0-9a-fA-F]{8}/.test(deployData) ? deployData.slice(0, 10).toLowerCase() : "";
  return [
    ["Approval targets configured Base EURC token", String(approval.to).toLowerCase() === deploymentConfig.asset.address.toLowerCase()],
    ["Approval sender matches configured deployer", String(approval.from).toLowerCase() === deploymentConfig.deployer.toLowerCase()],
    ["Approval chain is Base Mainnet (8453)", Number(approval.chainId) === 8453],
    ["Approval sends zero native ETH", BigInt(String(approval.value ?? 0)) === 0n],
    ["Approval calldata is exact ERC-20 approve(address,uint256)", decoded !== null],
    ["Approval spender is the Aave vault factory", decoded?.spender.toLowerCase() === factory],
    ["Approval amount is exactly 1 EURC (1,000,000 raw units)", decoded?.amount === expectedAmount],
    ["Deployment targets the Aave vault factory", String(deployment?.to).toLowerCase() === factory],
    ["Deployment sender matches configured deployer", String(deployment?.from).toLowerCase() === deploymentConfig.deployer.toLowerCase()],
    ["Deployment chain is Base Mainnet (8453)", Number(deployment?.chainId) === 8453],
    ["Deployment sends zero native ETH", BigInt(String(deployment?.value ?? 0)) === 0n],
    ["Deployment selector is VAULT_DEPLOYED", deploySelector === DEPLOY_VAULT_SELECTOR]
  ];
}


const BASE_POOL_ADDRESSES_PROVIDER = "0xe20fcBdbfFC4Dd138cE8b2E6FBb6CB49777ad64D".toLowerCase();
const DEPLOY_VAULT_SELECTOR = "0x81d42dea";

const BASE_RPC_URL = "https://mainnet.base.org";
const EURC_ALLOWANCE_SELECTOR = "0xdd62ed3e";

async function readEurcFactoryAllowance(owner: string): Promise<bigint> {
  const addressWord = (address: string) => address.slice(2).toLowerCase().padStart(64, "0");
  const data = EURC_ALLOWANCE_SELECTOR +
    addressWord(owner) +
    addressWord("0xa35995bb2ffc5f2b33379c2e95d00c20fbf71e70");
  const response = await fetch(BASE_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: deploymentConfig.asset.address, data }, "latest"]
    })
  });
  if (!response.ok) throw new Error(`Base RPC returned HTTP ${response.status} while checking EURC allowance.`);
  const payload = await response.json() as { result?: string; error?: { message?: string } };
  if (payload.error) throw new Error(payload.error.message || "Base RPC allowance call failed.");
  if (!payload.result || !/^0x[0-9a-fA-F]{64}$/.test(payload.result)) {
    throw new Error("Base RPC returned an invalid EURC allowance value.");
  }
  return BigInt(payload.result);
}

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
  // The Aave API encodes the owner and Aave Labs' verified fee-recipient Safe
  // directly in this deployment calldata, at 50% each. Treat these as the
  // complete intended split for this deployment; do not add another automatic
  // 50% on top of this encoded two-recipient allocation.
  const aaveLabsRecipient = "0xba3fa06e181d4a64b07d0ed0e8369811f0ad44ba";
  const expectedRecipients = [
    { address: deploymentConfig.owner.toLowerCase(), shareInBps: 5_000 },
    { address: aaveLabsRecipient, shareInBps: 5_000 }
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
    ["Fee recipient list (owner 50% + Aave Labs 50%)",
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
    '<p class="sdk-review-warning">The Aave API encodes the configured owner wallet and Aave Labs fee-recipient Safe as the two recipients, 50% each. The second address is treated as Aave Labs' fee recipient, not as an additional partner. Both addresses and their exact 50/50 split are checked against the reviewed deployment configuration.</p></section>';
}

function showPlanDetails(plan: any) {
  if (plan.__typename === "ApprovalRequired") {
    const approval = plan.approval;
    const spender = approvalSpender(String(approval.data ?? ""));
    const spenderHtml = spender
      ? escapeHtml(spender)
      : "Could not safely decode the spender from the approval calldata";
    const decodedApproval = decodeApproval(String(approval.data ?? ""));
    const expectedApprovalRaw = deploymentConfig.initialLockDeposit.rawAmount;
    const actualApprovalRaw = decodedApproval?.amount ?? null;
    const actualApprovalFormatted = actualApprovalRaw === null
      ? "Unable to decode approval amount"
      : formatUnits(actualApprovalRaw, deploymentConfig.asset.decimals);
    const expectedApprovalFormatted = formatUnits(expectedApprovalRaw, deploymentConfig.asset.decimals);
    const approvalDifference = actualApprovalRaw === null
      ? "Unavailable"
      : formatUnits(actualApprovalRaw - expectedApprovalRaw, deploymentConfig.asset.decimals);
    const safetyChecks = approvalSafetyChecks(approval, plan.originalTransaction);
    const safetyPassed = safetyChecks.every(([, passed]) => passed);
    const factoryAddress = "0xa35995bb2ffc5f2b33379c2e95d00c20fbf71e70";
    const exactApprovalData = encodeExactApproval(factoryAddress, expectedApprovalRaw);
    const exactApprovalDecoded = decodeApproval(exactApprovalData);
    const exactApprovalChecks: [string, boolean][] = [
      ["Target is configured Base EURC", deploymentConfig.asset.address.toLowerCase() === String(approval.to).toLowerCase()],
      ["Spender is the Aave vault factory", exactApprovalDecoded?.spender.toLowerCase() === factoryAddress],
      ["Amount is exactly 1 EURC", exactApprovalDecoded?.amount === expectedApprovalRaw],
      ["Sender is configured deployer", String(approval.from).toLowerCase() === deploymentConfig.deployer.toLowerCase()],
      ["Chain is Base Mainnet (8453)", Number(approval.chainId) === 8453],
      ["Native ETH value is zero", BigInt(String(approval.value ?? 0)) === 0n]
    ];
    const exactApprovalPassed = exactApprovalChecks.every(([, passed]) => passed);
    const exactApprovalRows = exactApprovalChecks.map(([label, passed]) =>
      '<div class="sdk-config-check"><span class="' + (passed ? "pass" : "fail") + '">' +
      (passed ? "PASS" : "MISMATCH") + '</span><span>' + escapeHtml(label) + '</span></div>'
    ).join("");
    const exactApprovalTx = {
      ...approval,
      data: exactApprovalData,
      operation: "Exact approval · 1 EURC · constructed locally, not sent"
    };
    const safetyRows = safetyChecks.map(([label, passed]) =>
      '<div class="sdk-config-check"><span class="' + (passed ? "pass" : "fail") + '">' +
      (passed ? "PASS" : "MISMATCH") + '</span><span>' + escapeHtml(label) + '</span></div>'
    ).join("");
    planElement.innerHTML = `
      <div class="sdk-plan-intro">
        <strong>Approval required · review only</strong>
        <p>${escapeHtml(plan.reason)}</p>
        <p>The Aave SDK indicates that an EURC allowance is required. Wallet connection and approval submission are disabled in this version. No transaction has been sent.</p>
      </div>
      <section class="sdk-detail-card">
        <h4>Final transaction safety checks</h4>
        <p class="sdk-decode-status ${safetyPassed ? "pass" : "fail"}">${safetyPassed ? "All approval and deployment transaction checks passed" : "A transaction check failed — do not proceed"}</p>
        <div class="sdk-config-checks">${safetyRows}</div>
      </section>
      <section class="sdk-detail-card">
        <h4>Decoded approval amount diagnostic</h4>
        <dl class="sdk-detail-grid">
          <div><dt>Actual amount in calldata (raw units)</dt><dd><code>${actualApprovalRaw === null ? "Undecodable" : actualApprovalRaw.toString()}</code></dd></div>
          <div><dt>Actual approval amount</dt><dd>${escapeHtml(actualApprovalFormatted)} EURC</dd></div>
          <div><dt>Expected amount in configuration (raw units)</dt><dd><code>${expectedApprovalRaw.toString()}</code></dd></div>
          <div><dt>Expected approval amount</dt><dd>${escapeHtml(expectedApprovalFormatted)} EURC</dd></div>
          <div><dt>Difference (actual − expected)</dt><dd>${escapeHtml(approvalDifference)} EURC</dd></div>
          <div><dt>SDK required allowance</dt><dd>${escapeHtml(plan.requiredAmount.value)} EURC</dd></div>
          <div><dt>SDK allowance decimals</dt><dd>${escapeHtml(plan.requiredAmount.decimals)}</dd></div>
        </dl>
        <p class="sdk-review-warning">Diagnostic only. The approval amount safety check remains fail-closed; do not approve if the amount differs from the configured 1 EURC.</p>
      </section>
      <section class="sdk-detail-card">
        <h4>Proposed exact EURC approval (not sent)</h4>
        <p class="sdk-decode-status ${exactApprovalPassed ? "pass" : "fail"}">${exactApprovalPassed ? "Exact approval transaction checks passed" : "Exact approval checks failed — do not proceed"}</p>
        <div class="sdk-config-checks">${exactApprovalRows}</div>
        <p>Locally constructed ERC-20 approve(factory, 1,000,000). This is a separate exact-allowance proposal; the Aave SDK's unlimited-approval calldata above is not modified or submitted.</p>
      </section>
      ${transactionSummary("Proposed exact approval transaction (not sent)", exactApprovalTx)}
      <section class="sdk-detail-card">
        <h4>Submit exact 1 EURC approval</h4>
        <p>This sends only the locally constructed approve(factory, 1 EURC) transaction. It never sends the Aave SDK's unlimited-allowance calldata and does not deploy the vault.</p>
        <button id="submit-exact-eurc-approval" class="refresh-button" type="button" ${exactApprovalPassed ? "" : "disabled"}>Approve exactly 1 EURC</button>
        <p id="exact-approval-status" class="sdk-result" role="status" aria-live="polite">No approval transaction submitted.</p>
      </section>
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
      <p class="sdk-review-warning">Read-only safety mode: neither the approval nor the vault deployment can be submitted from this application.</p>
    `;


  const exactApprovalButton = document.getElementById("submit-exact-eurc-approval") as HTMLButtonElement | null;
  const exactApprovalStatus = document.getElementById("exact-approval-status") as HTMLParagraphElement | null;
  exactApprovalButton?.addEventListener("click", async () => {
    if (!exactApprovalButton || !exactApprovalStatus) return;
    exactApprovalButton.disabled = true;
    exactApprovalStatus.textContent = "Checking connected wallet and exact approval parameters…";
    try {
      const ethereum = (window as Window & { ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> } }).ethereum;
      if (!ethereum) throw new Error("No injected browser wallet found. Open the dashboard in Brave with your wallet enabled.");

      const accounts = await ethereum.request({ method: "eth_accounts" }) as string[];
      const account = accounts?.[0];
      if (!account) throw new Error("No wallet account is connected. Connect your wallet first.");
      if (account.toLowerCase() !== deploymentConfig.deployer.toLowerCase()) {
        throw new Error("Connected account does not match the configured vault deployer.");
      }

      const chainHex = String(await ethereum.request({ method: "eth_chainId" }));
      if (chainHex.toLowerCase() !== "0x2105" && Number(chainHex) !== 8453) {
        throw new Error("Wallet is not on Base Mainnet (8453). Reconnect and switch networks first.");
      }
      if (!exactApprovalPassed || !exactApprovalDecoded ||
          exactApprovalDecoded.spender.toLowerCase() !== factoryAddress ||
          exactApprovalDecoded.amount !== expectedApprovalRaw ||
          String(approval.to).toLowerCase() !== deploymentConfig.asset.address.toLowerCase()) {
        throw new Error("Exact approval safety checks failed. Transaction blocked.");
      }

      exactApprovalStatus.textContent = "Review the exact 1 EURC approval in your wallet…";
      const txHash = await ethereum.request({
        method: "eth_sendTransaction",
        params: [{
          from: account,
          to: deploymentConfig.asset.address,
          data: exactApprovalData,
          value: "0x0"
        }]
      }) as string;
      exactApprovalStatus.textContent = "Wallet submitted the exact 1 EURC approval. Transaction: " + txHash;
    } catch (error) {
      exactApprovalStatus.textContent = error instanceof Error ? error.message : "Approval was not submitted.";
      exactApprovalButton.disabled = false;
    }
  });

  } else if (plan.__typename === "TransactionRequest") {
    const factoryAddress = "0xa35995bb2ffc5f2b33379c2e95d00c20fbf71e70";
    const deploymentData = String(plan.data ?? "");
    const deploymentSelector = /^0x[0-9a-fA-F]{8}/.test(deploymentData)
      ? deploymentData.slice(0, 10).toLowerCase()
      : "";
    const deploymentChecks: [string, boolean][] = [
      ["Destination is the configured Aave vault factory", String(plan.to).toLowerCase() === factoryAddress],
      ["Sender is the configured deployer", String(plan.from).toLowerCase() === deploymentConfig.deployer.toLowerCase()],
      ["Network is Base Mainnet (8453)", Number(plan.chainId) === 8453],
      ["Native ETH value is zero", BigInt(String(plan.value ?? 0)) === 0n],
      ["Function selector is ATokenVaultFactory.deployVault", deploymentSelector === DEPLOY_VAULT_SELECTOR]
    ];
    const deploymentChecksPassed = deploymentChecks.every(([, passed]) => passed);
    const deploymentCheckRows = deploymentChecks.map(([label, passed]) =>
      '<div class="sdk-config-check"><span class="' + (passed ? "pass" : "fail") + '">' +
      (passed ? "PASS" : "MISMATCH") + '</span><span>' + escapeHtml(label) + '</span></div>'
    ).join("");
    let decodedDeploymentHtml = "";
    try {
      decodedDeploymentHtml = showDecodedDeployment(deploymentData);
    } catch (error) {
      decodedDeploymentHtml =
        '<section class="sdk-detail-card"><h4>Decoded vault deployment configuration</h4>' +
        '<p class="sdk-decode-status fail">Calldata could not be decoded safely — do not proceed.</p>' +
        '<p>' + escapeHtml(error instanceof Error ? error.message : "Unknown calldata decoding error.") + '</p></section>';
    }
    planElement.innerHTML = `
      <div class="sdk-plan-intro"><strong>Deployment transaction prepared · not sent</strong><p>The SDK returned a single transaction request. The complete calldata is decoded below for inspection. This remains read-only: no deployment transaction is submitted.</p></div>
      <section class="sdk-detail-card">
        <h4>Deployment transaction safety checks</h4>
        <p class="sdk-decode-status ${deploymentChecksPassed ? "pass" : "fail"}">${deploymentChecksPassed ? "Transaction envelope checks passed" : "Transaction envelope mismatch — do not proceed"}</p>
        <div class="sdk-config-checks">${deploymentCheckRows}</div>
      </section>
      ${transactionSummary("Vault deployment transaction (not sent)", plan)}
      ${decodedDeploymentHtml}
      <section class="sdk-detail-card">
        <h4>Deploy vault through your browser wallet</h4>
        <p>Expected fee split: 50% to your owner wallet and 50% to Aave Labs' fee-recipient Safe. No separate partner recipient is configured.</p>
        <p>Pressing this button requests the exact Aave SDK deployment transaction in browser wallet. Nothing is sent unless you review and confirm it in your wallet.</p>
        <button id="submit-vault-deployment" class="refresh-button" type="button" ${deploymentChecksPassed ? "" : "disabled"}>Deploy vault · review in your browser wallet</button>
        <p id="deployment-submit-status" class="sdk-result" role="status" aria-live="polite">Deployment not submitted.</p>
      </section>
    

`;
      const deployButton = document.getElementById("submit-vault-deployment") as HTMLButtonElement | null;
      const deployStatus = document.getElementById("deployment-submit-status") as HTMLParagraphElement | null;
      deployButton?.addEventListener("click", async () => {
        if (!deployButton || !deployStatus) return;
        deployButton.disabled = true;
        deployStatus.textContent = "Rechecking wallet, allowance and deployment calldata…";
        try {
          const ethereum = (window as Window & { ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> } }).ethereum;
          if (!ethereum) throw new Error("No injected wallet found. Open this page in your wallet-enabled browser.");
          const accounts = await ethereum.request({ method: "eth_accounts" }) as string[];
          const account = accounts?.[0];
          if (!account || account.toLowerCase() !== deploymentConfig.deployer.toLowerCase()) {
            throw new Error("Connected wallet does not match the configured vault owner/deployer.");
          }
          const activeChain = String(await ethereum.request({ method: "eth_chainId" }));
          if (activeChain.toLowerCase() !== "0x2105" && Number(activeChain) !== 8453) {
            throw new Error("Wallet is not connected to Base Mainnet (8453).");
          }
          if (!deploymentChecksPassed) throw new Error("Deployment transaction envelope checks failed.");
          const decoded = decodeVaultDeployment(deploymentData);
          const expectedFee = BigInt(deploymentConfig.performanceFeeBps) * 10n ** 18n / 10_000n;
          const recipients = decoded.recipients.map(x => ({ address: x.address.toLowerCase(), shareInBps: x.shareInBps })).sort((a,b) => a.address.localeCompare(b.address));
          const expectedRecipients = [
            { address: deploymentConfig.owner.toLowerCase(), shareInBps: 5_000 },
            { address: "0xba3fa06e181d4a64b07d0ed0e8369811f0ad44ba", shareInBps: 5_000 }
          ].sort((a,b) => a.address.localeCompare(b.address));
          const configMatches =
            decoded.underlying.toLowerCase() === deploymentConfig.asset.address.toLowerCase() &&
            decoded.poolAddressesProvider.toLowerCase() === BASE_POOL_ADDRESSES_PROVIDER &&
            decoded.owner.toLowerCase() === deploymentConfig.owner.toLowerCase() &&
            decoded.initialFee === expectedFee &&
            decoded.shareName === deploymentConfig.vaultName &&
            decoded.shareSymbol === deploymentConfig.shareTokenSymbol &&
            decoded.initialLockDeposit === deploymentConfig.initialLockDeposit.rawAmount &&
            recipients.length === expectedRecipients.length &&
            recipients.every((x,i) => x.address === expectedRecipients[i].address && x.shareInBps === expectedRecipients[i].shareInBps);
          if (!configMatches) throw new Error("Decoded deployment configuration changed or no longer matches the reviewed settings.");
          const latestAllowance = await readEurcFactoryAllowance(account);
          if (latestAllowance < deploymentConfig.initialLockDeposit.rawAmount) {
            throw new Error("Factory allowance is now below 1 EURC. Deployment blocked.");
          }
          deployStatus.textContent = "Your browser wallet will now show the deployment transaction. Check every detail before confirming.";
          const txValue = BigInt(String(plan.value ?? 0));
          const txHash = await ethereum.request({
            method: "eth_sendTransaction",
            params: [{
              from: account,
              to: String(plan.to),
              data: deploymentData,
              value: "0x" + txValue.toString(16)
            }]
          }) as string;
          deployStatus.textContent = "Wallet submitted the deployment transaction: " + txHash + ". Wait for confirmation before treating the vault as deployed.";
        } catch (error) {
          deployStatus.textContent = error instanceof Error ? error.message : "Deployment was not submitted.";
          deployButton.disabled = false;
        }
      });

  } else if (plan.__typename === "InsufficientBalanceError") {
    planElement.textContent =
      `Aave accepted the deployment request but reports insufficient EURC in the deployer wallet. Available: ${plan.available.value} EURC; required: ${plan.required.value} EURC. The initial lock deposit is permanently locked. No approval or transaction was submitted.`;
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
      deploymentConfig.safety.transactionSigningEnabled ||
      deploymentConfig.safety.transactionSubmissionEnabled
    ) {
      throw new Error("Signing/submission safety guard failed. No deployment plan was requested.");
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

    });

    if (deployResult.isErr()) {
      throw new Error(`Aave SDK rejected the deployment request: ${deployResult.error.message}`);
    }

    const plan = deployResult.value;
    const allowance = await readEurcFactoryAllowance(deploymentConfig.deployer);
    const requiredAllowance = deploymentConfig.initialLockDeposit.rawAmount;
    const allowanceStatus = document.getElementById("initial-lock-status");
    if (allowanceStatus) {
      allowanceStatus.textContent = allowance >= requiredAllowance
        ? "1 EURC · factory allowance verified on Base"
        : `1 EURC · allowance insufficient (${formatUnits(allowance, deploymentConfig.asset.decimals)} EURC)`;
    }
    if (allowance < requiredAllowance) {
      throw new Error(`EURC allowance is below the required 1 EURC. Current factory allowance: ${formatUnits(allowance, deploymentConfig.asset.decimals)} EURC. No deployment transaction was sent.`);
    }
    resultElement.textContent = "Base EURC allowance verified · deployment plan ready · nothing was sent";
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
