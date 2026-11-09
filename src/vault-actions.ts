import { BrowserProvider, Contract, JsonRpcProvider, formatUnits, parseUnits } from "ethers";
import { vaultConfig } from "./config";

type InjectedProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: InjectedProvider;
  }
}

const VAULT = "0x56E70807df5e23eB628327c788De38C8f8dF95Bc";
const EURC = vaultConfig.asset.address;
const OWNER_CONFIG = vaultConfig.owner;
const SPLITTER = "0xe8A7b07B64AE3911d717D9b60ACD84560fFc60C9";
const A_TOKEN = vaultConfig.aaveV3.aToken;
const AAVE_LABS_SAFE = "0xba3fa06e181d4a64b07d0ed0e8369811f0ad44ba";
const DECIMALS = vaultConfig.asset.decimals;

const vaultAbi = [
  "function asset() view returns (address)",
  "function ATOKEN() view returns (address)",
  "function owner() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
  "function previewDeposit(uint256) view returns (uint256)",
  "function previewRedeem(uint256) view returns (uint256)",
  "function maxDeposit(address) view returns (uint256)",
  "function maxRedeem(address) view returns (uint256)",
  "function maxWithdraw(address) view returns (uint256)",
  "function previewWithdraw(uint256) view returns (uint256)",
  "function getFee() view returns (uint256)",
  "function getClaimableFees() view returns (uint256)",
  "function deposit(uint256,address) returns (uint256)",
  "function redeem(uint256,address,address) returns (uint256)",
  "function withdraw(uint256,address,address) returns (uint256)",
  "function withdrawFees(address,uint256)"
] as const;

const splitterAbi = [
  "function owner() view returns (address)",
  "function VAULT() view returns (address)",
  "function withdrawFees()",
  "function splitRevenue(address[] assets)",
  "function getRecipients() view returns (tuple(address addr,uint16 shareInBps)[])"
] as const;

const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)"
] as const;

const panel = document.getElementById("vault-actions");
if (!panel) throw new Error("Vault actions panel is missing.");

panel.innerHTML = `
  <div class="vault-actions">
    <div class="vault-actions-heading">
      <div>
        <p class="eyebrow">LIVE VAULT · BASE MAINNET</p>
        <h3>Manage your EURC position</h3>
        <p class="muted">Deposit EURC, redeem ylEurc shares, or claim manager fees. Every transaction is reviewed and confirmed in your browser wallet.</p>
      </div>
      <div class="vault-header-actions"><button id="vault-connect" class="refresh-button" type="button">Connect wallet</button><button id="vault-disconnect" class="disconnect-button" type="button" disabled>Disconnect wallet</button><button id="vault-switch-base" class="refresh-button" type="button">Switch to Base</button><button id="vault-refresh" class="refresh-button" type="button">↻ Refresh</button></div>
    </div>

    <div class="vault-position-grid">
      <article class="metric"><p class="eyebrow">YOUR EURC BALANCE</p><strong id="va-eurc-balance">—</strong><span class="muted">EURC</span></article>
      <article class="metric"><p class="eyebrow">YOUR VAULT SHARES</p><strong id="va-share-balance">—</strong><span class="muted">ylEurc</span></article>
      <article class="metric"><p class="eyebrow">SHARE VALUE</p><strong id="va-share-value">—</strong><span class="muted">EURC per ylEurc</span></article>
      <article class="metric"><p class="eyebrow">VAULT ASSETS</p><strong id="va-total-assets">—</strong><span class="muted">EURC</span></article>
    </div>
    <p id="va-status" class="live-status" role="status" aria-live="polite">Connect your browser wallet to load your position. Public vault data can be read without connecting.</p>

    <div class="vault-action-grid">
      <section class="vault-action-card">
        <p class="eyebrow">ADD EURC</p>
        <h4>Deposit</h4>
        <p class="muted">Deposit EURC and receive ylEurc shares at the current vault exchange rate.</p>
        <label for="va-deposit-amount">EURC amount</label>
        <input id="va-deposit-amount" inputmode="decimal" autocomplete="off" placeholder="0.00" />
        <div class="vault-preview" id="va-deposit-preview">Enter an amount to preview shares.</div>
        <button id="va-deposit" class="refresh-button" type="button">Preview and deposit</button>
        <p id="va-deposit-status" class="action-status" role="status" aria-live="polite">No deposit submitted.</p>
      </section>

      <section class="vault-action-card">
        <p class="eyebrow">REMOVE EURC</p>
        <h4>Withdraw EURC</h4>
        <p class="muted">Enter the EURC amount you want to receive. The dashboard calculates the ylEurc shares required.</p>
        <label for="va-redeem-amount">EURC amount to withdraw</label>
        <input id="va-redeem-amount" inputmode="decimal" autocomplete="off" placeholder="0.00" />
        <div class="vault-preview" id="va-redeem-preview">Enter the EURC amount you want to receive.</div>
        <button id="va-redeem" class="refresh-button" type="button">Preview and withdraw EURC</button>
        <p id="va-redeem-status" class="action-status" role="status" aria-live="polite">No redemption submitted.</p>
      </section>

      <section class="vault-action-card vault-fee-card">
        <p class="eyebrow">VAULT MANAGER ONLY</p>
        <h4>Claim and distribute fees</h4>
        <p class="muted">Collect accrued fees into the revenue splitter, then distribute its aEURC balance according to the on-chain recipient configuration.</p>
        <div class="fee-amount"><strong id="va-claimable-fees">—</strong><span>aEURC currently claimable in vault</span></div>
        <p class="muted" id="va-fee-owner">Checking splitter owner and recipients…</p>
        <p class="muted" id="va-splitter-balance">Splitter balance: checking…</p>
        <button id="va-claim-fees" class="refresh-button" type="button" disabled>Collect and distribute fees</button>
        <p id="va-claim-status" class="action-status" role="status" aria-live="polite">Requires the revenue-splitter owner. Two separate wallet confirmations.</p>
      </section>
    </div>
    <p class="vault-disclaimer">Contract: <code>${VAULT}</code>. Network: Base Mainnet (8453). Check the amount, recipient and network in your wallet before confirming. The initial locked share belongs to the vault and is not part of your personal balance.</p>
  </div>
`;

const byId = <T extends HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing vault interface element: ${id}`);
  return el as T;
};
const setText = (id: string, value: string) => { byId<HTMLElement>(id).textContent = value; };
const setStatus = (id: string, value: string) => setText(id, value);
const inputValue = (id: string) => byId<HTMLInputElement>(id).value.trim();

let connectedAccount: string | null = null;
let locallyDisconnected = false;
let refreshInProgress = false;

function format(raw: bigint): string {
  return Number(formatUnits(raw, DECIMALS)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6
  });
}
function parseAmount(value: string, label: string): bigint {
  if (!value || !/^\d+(\.\d{0,6})?$/.test(value)) {
    throw new Error(`Enter a valid ${label} amount with up to 6 decimal places.`);
  }
  const amount = parseUnits(value, DECIMALS);
  if (amount <= 0n) throw new Error(`The ${label} amount must be greater than zero.`);
  return amount;
}
const BASE_CHAIN_ID = "0x2105";
const publicProvider = new JsonRpcProvider("https://mainnet.base.org");

function walletProvider(): BrowserProvider {
  if (!window.ethereum) throw new Error("No browser wallet was detected. Open this page in a wallet-enabled browser.");
  return new BrowserProvider(window.ethereum as never);
}

async function switchWalletToBase(): Promise<void> {
  if (!window.ethereum) throw new Error("No browser wallet was detected. Open this page in a wallet-enabled browser.");
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_CHAIN_ID }]
    });
  } catch (switchError) {
    const errorCode = (switchError as { code?: number })?.code;
    if (errorCode !== 4902) throw switchError;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: BASE_CHAIN_ID,
        chainName: "Base Mainnet",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://mainnet.base.org"],
        blockExplorerUrls: ["https://basescan.org"]
      }]
    });
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_CHAIN_ID }]
    });
  }
  const activeChain = await window.ethereum.request({ method: "eth_chainId" }) as string;
  if (activeChain?.toLowerCase() !== BASE_CHAIN_ID) {
    throw new Error(`Wallet did not switch to Base Mainnet. Active chain: ${activeChain ?? "unknown"}.`);
  }
}

async function requireWallet(): Promise<{ account: string; signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>; browser: BrowserProvider }> {
  const browser = walletProvider();
  const accounts = await window.ethereum!.request({ method: "eth_requestAccounts" }) as string[];
  const account = accounts?.[0];
  if (!account) throw new Error("The browser wallet did not return an account.");
  const network = await browser.getNetwork();
  if (network.chainId !== 8453n) {
    setStatus("va-status", "Requesting switch to Base Mainnet (8453) in your wallet…");
    await switchWalletToBase();
  }
  const verifiedNetwork = await browser.getNetwork();
  if (verifiedNetwork.chainId !== 8453n) throw new Error("Wallet must be on Base Mainnet (Chain ID 8453) before any transaction.");
  const signer = await browser.getSigner(account);
  connectedAccount = account;
  locallyDisconnected = false;
  return { account, signer, browser };
}

function readContracts() {
  return {
    browser: publicProvider,
    vault: new Contract(VAULT, vaultAbi, publicProvider),
    eurc: new Contract(EURC, erc20Abi, publicProvider)
  };
}

async function refreshVault() {
  if (refreshInProgress) return;
  refreshInProgress = true;
  const refreshButton = byId<HTMLButtonElement>("vault-refresh");
  const originalRefreshLabel = refreshButton.textContent || "↻ Refresh";
  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing…";
  try {
    if (!locallyDisconnected && window.ethereum) {
      const accounts = await window.ethereum.request({ method: "eth_accounts" }) as string[];
      connectedAccount = accounts?.[0] ?? null;
      if (connectedAccount) {
        const activeChain = await window.ethereum.request({ method: "eth_chainId" }) as string;
        if (activeChain?.toLowerCase() !== BASE_CHAIN_ID) connectedAccount = null;
      }
    }
    const { browser, vault, eurc } = readContracts();
    const [totalAssets, feeRaw, claimableRaw, onchainOwner, assetAddress, aTokenAddress] = await Promise.all([
      vault.totalAssets() as Promise<bigint>,
      vault.getFee() as Promise<bigint>,
      vault.getClaimableFees() as Promise<bigint>,
      vault.owner() as Promise<string>,
      vault.asset() as Promise<string>,
      vault.ATOKEN() as Promise<string>
    ]);
    if (assetAddress.toLowerCase() !== EURC.toLowerCase()) {
      throw new Error("The deployed vault asset does not match the configured EURC contract. Actions are blocked.");
    }
    if (aTokenAddress.toLowerCase() !== vaultConfig.aaveV3.aToken.toLowerCase()) {
      throw new Error("The deployed vault aToken does not match the configured Base EURC aToken. Actions are blocked.");
    }
    setText("va-total-assets", format(totalAssets));
    setText("va-claimable-fees", format(claimableRaw));
    const splitter = new Contract(SPLITTER, splitterAbi, browser);
    const token = new Contract(A_TOKEN, erc20Abi, browser);
    const [splitterOwner, splitterVault, recipients, splitterBalance] = await Promise.all([
      splitter.owner() as Promise<string>,
      splitter.VAULT() as Promise<string>,
      splitter.getRecipients() as Promise<Array<{ addr: string; shareInBps: bigint }>>,
      token.balanceOf(SPLITTER) as Promise<bigint>
    ]);
    if (onchainOwner.toLowerCase() !== SPLITTER.toLowerCase() || splitterVault.toLowerCase() !== VAULT.toLowerCase()) {
      throw new Error("Vault/splitter linkage does not match the configured deployed contracts. Fee actions blocked.");
    }
    const recipientSummary = recipients.map((r) => `${r.addr} (${Number(r.shareInBps) / 100}%)`).join(" · ");
    setText("va-fee-owner", `Splitter owner: ${splitterOwner} · Fee: ${(Number(feeRaw) / 1e16).toFixed(2)}% · Recipients: ${recipientSummary}`);
    setText("va-splitter-balance", `Splitter aEURC balance: ${format(splitterBalance)}`);
    const claimButton = byId<HTMLButtonElement>("va-claim-fees");
    const isOwner = !!connectedAccount && connectedAccount.toLowerCase() === splitterOwner.toLowerCase() && splitterOwner.toLowerCase() === OWNER_CONFIG.toLowerCase();
    claimButton.disabled = !isOwner || (claimableRaw === 0n && splitterBalance === 0n);
    if (claimableRaw === 0n) {
      setStatus("va-claim-status", "No performance fees are currently claimable.");
    } else if (splitterOwner.toLowerCase() !== OWNER_CONFIG.toLowerCase()) {
      setStatus("va-claim-status", "Fee claim blocked: the contract owner differs from the configured owner. This must be reconciled before claiming.");
    } else if (!isOwner) {
      setStatus("va-claim-status", "Fee claim locked: connect the exact on-chain owner wallet. The page will not attempt a claim from another address.");
    } else {
      setStatus("va-claim-status", "Splitter owner verified. Collection and distribution require two separate wallet confirmations.");
    }

    if (connectedAccount) {
      const [eurcBalance, shareBalance] = await Promise.all([
        eurc.balanceOf(connectedAccount) as Promise<bigint>,
        vault.balanceOf(connectedAccount) as Promise<bigint>
      ]);
      setText("va-eurc-balance", format(eurcBalance));
      setText("va-share-balance", format(shareBalance));
      const oneShareAssets = await vault.convertToAssets(parseUnits("1", DECIMALS)) as bigint;
      setText("va-share-value", format(oneShareAssets));
      const maxDeposit = await vault.maxDeposit(connectedAccount) as bigint;
      const maxWithdraw = await vault.maxWithdraw(connectedAccount) as bigint;
      byId<HTMLButtonElement>("va-deposit").disabled = maxDeposit === 0n;
      byId<HTMLButtonElement>("va-redeem").disabled = maxWithdraw === 0n;
      setStatus("va-status", `Connected · ${connectedAccount.slice(0, 6)}…${connectedAccount.slice(-4)} · Base Mainnet · Max deposit ${format(maxDeposit)} EURC · Max withdraw ${format(maxWithdraw)} EURC`);
      byId<HTMLButtonElement>("vault-connect").textContent = `${connectedAccount.slice(0, 6)}…${connectedAccount.slice(-4)}`;
      byId<HTMLButtonElement>("vault-disconnect").disabled = false;
    } else {
      setText("va-eurc-balance", "Connect wallet");
      setText("va-share-balance", "Connect wallet");
      setText("va-share-value", format(await vault.convertToAssets(parseUnits("1", DECIMALS)) as bigint));
      setStatus("va-status", "Vault data refreshed · connect your browser wallet to see balances and use deposit / withdraw.");
      byId<HTMLButtonElement>("vault-connect").textContent = "Connect wallet";
      byId<HTMLButtonElement>("vault-disconnect").disabled = true;
      byId<HTMLButtonElement>("va-deposit").disabled = false;
      byId<HTMLButtonElement>("va-redeem").disabled = false;
    }
  } catch (error) {
    setStatus("va-status", `Refresh failed: ${error instanceof Error ? error.message : "Unable to read the vault."}`);
    byId<HTMLButtonElement>("va-deposit").disabled = true;
    byId<HTMLButtonElement>("va-redeem").disabled = true;
    byId<HTMLButtonElement>("va-claim-fees").disabled = true;
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = originalRefreshLabel;
    refreshInProgress = false;
  }
}

byId<HTMLButtonElement>("vault-disconnect").addEventListener("click", async () => {
  locallyDisconnected = true;
  connectedAccount = null;
  byId<HTMLButtonElement>("vault-connect").textContent = "Connect wallet";
  byId<HTMLButtonElement>("vault-disconnect").disabled = true;
  setStatus("va-status", "Disconnected from this dashboard. Wallet permissions in MetaMask are unchanged.");
  await refreshVault();
});

byId<HTMLButtonElement>("vault-switch-base").addEventListener("click", async () => {
  const button = byId<HTMLButtonElement>("vault-switch-base");
  button.disabled = true;
  try {
    await switchWalletToBase();
    setStatus("va-status", "Wallet is now on Base Mainnet (8453). Refreshing vault data…");
    await refreshVault();
  } catch (error) {
    setStatus("va-status", error instanceof Error ? error.message : "Unable to switch wallet to Base Mainnet.");
  } finally {
    button.disabled = false;
  }
});

byId<HTMLButtonElement>("vault-connect").addEventListener("click", async () => {
  const button = byId<HTMLButtonElement>("vault-connect");
  button.disabled = true;
  try {
    const { account } = await requireWallet();
    button.textContent = account.slice(0, 6) + "…" + account.slice(-4);
    byId<HTMLButtonElement>("vault-disconnect").disabled = false;
    setStatus("va-status", "Wallet connected on Base Mainnet. Refreshing vault position…");
    await refreshVault();
  } catch (error) {
    setStatus("va-status", error instanceof Error ? error.message : "Wallet connection failed.");
  } finally {
    button.disabled = false;
  }
});

byId<HTMLButtonElement>("vault-refresh").addEventListener("click", () => { void refreshVault(); });

byId<HTMLInputElement>("va-deposit-amount").addEventListener("input", async () => {
  try {
    const amount = parseAmount(inputValue("va-deposit-amount"), "EURC");
    const { vault } = readContracts();
    const shares = await vault.previewDeposit(amount) as bigint;
    setText("va-deposit-preview", `Estimated shares: ${format(shares)} ylEurc`);
  } catch (error) {
    setText("va-deposit-preview", error instanceof Error ? error.message : "Preview unavailable.");
  }
});

byId<HTMLInputElement>("va-redeem-amount").addEventListener("input", async () => {
  try {
    const assets = parseAmount(inputValue("va-redeem-amount"), "EURC withdrawal");
    const { vault } = readContracts();
    const shares = await vault.previewWithdraw(assets) as bigint;
    setText("va-redeem-preview", `You receive ${format(assets)} EURC · estimated shares burned: ${format(shares)} ylEurc`);
  } catch (error) {
    setText("va-redeem-preview", error instanceof Error ? error.message : "Preview unavailable.");
  }
});

byId<HTMLButtonElement>("va-deposit").addEventListener("click", async () => {
  const button = byId<HTMLButtonElement>("va-deposit");
  button.disabled = true;
  try {
    setStatus("va-deposit-status", "Checking wallet, balance, limit and preview…");
    const { account, signer } = await requireWallet();
    const amount = parseAmount(inputValue("va-deposit-amount"), "EURC");
    const vault = new Contract(VAULT, vaultAbi, signer);
    const eurc = new Contract(EURC, erc20Abi, signer);
    const [balance, allowance, maxDeposit, preview] = await Promise.all([
      eurc.balanceOf(account) as Promise<bigint>,
      eurc.allowance(account, VAULT) as Promise<bigint>,
      vault.maxDeposit(account) as Promise<bigint>,
      vault.previewDeposit(amount) as Promise<bigint>
    ]);
    if (balance < amount) throw new Error(`Insufficient EURC balance. Available: ${format(balance)} EURC.`);
    if (amount > maxDeposit) throw new Error(`Amount exceeds current maxDeposit of ${format(maxDeposit)} EURC.`);
    setStatus("va-deposit-status", `Preview: ${format(amount)} EURC → approximately ${format(preview)} ylEurc. Review the wallet prompt.`);
    if (allowance < amount) {
      const approval = await eurc.approve(VAULT, amount);
      setStatus("va-deposit-status", `EURC approval submitted: ${approval.hash}. Waiting for confirmation…`);
      await approval.wait();
    }
    const tx = await vault.deposit(amount, account);
    setStatus("va-deposit-status", `Deposit submitted: ${tx.hash}. Waiting for confirmation…`);
    await tx.wait();
    setStatus("va-deposit-status", "Deposit confirmed. Your ylEurc balance is being refreshed.");
    await refreshVault();
  } catch (error) {
    setStatus("va-deposit-status", error instanceof Error ? error.message : "Deposit was not completed.");
  } finally {
    button.disabled = false;
  }
});

byId<HTMLButtonElement>("va-redeem").addEventListener("click", async () => {
  const button = byId<HTMLButtonElement>("va-redeem");
  button.disabled = true;
  try {
    setStatus("va-redeem-status", "Checking wallet, share balance and preview…");
    const { account, signer } = await requireWallet();
    const assets = parseAmount(inputValue("va-redeem-amount"), "EURC withdrawal");
    const vault = new Contract(VAULT, vaultAbi, signer);
    const [balance, maxWithdraw, sharesRequired] = await Promise.all([
      vault.balanceOf(account) as Promise<bigint>,
      vault.maxWithdraw(account) as Promise<bigint>,
      vault.previewWithdraw(assets) as Promise<bigint>
    ]);
    if (assets > maxWithdraw) {
      throw new Error(`Insufficient withdrawable EURC. Maximum currently withdrawable: ${format(maxWithdraw)} EURC. Your share balance is ${format(balance)} ylEurc.`);
    }
    if (balance < sharesRequired) throw new Error("Your ylEurc balance is insufficient for this EURC withdrawal.");
    setStatus("va-redeem-status", `Preview: receive ${format(assets)} EURC · burn approximately ${format(sharesRequired)} ylEurc. Review the wallet prompt.`);
    const tx = await vault.withdraw(assets, account, account);
    setStatus("va-redeem-status", `Redemption submitted: ${tx.hash}. Waiting for confirmation…`);
    await tx.wait();
    setStatus("va-redeem-status", "Redemption confirmed. Your balances are being refreshed.");
    await refreshVault();
  } catch (error) {
    setStatus("va-redeem-status", error instanceof Error ? error.message : "Redemption was not completed.");
  } finally {
    button.disabled = false;
  }
});

byId<HTMLButtonElement>("va-claim-fees").addEventListener("click", async () => {
  const button = byId<HTMLButtonElement>("va-claim-fees");
  button.disabled = true;
  try {
    setStatus("va-claim-status", "Checking Base network, splitter ownership, vault linkage and recipients…");
    const { account, signer, browser } = await requireWallet();
    const vault = new Contract(VAULT, vaultAbi, browser);
    const splitter = new Contract(SPLITTER, splitterAbi, signer);
    const token = new Contract(A_TOKEN, erc20Abi, browser);
    const [vaultOwner, splitterOwner, splitterVault, claimable, recipients, beforeSplitterBalance, beforeWalletBalance] = await Promise.all([
      vault.owner() as Promise<string>, splitter.owner() as Promise<string>, splitter.VAULT() as Promise<string>,
      vault.getClaimableFees() as Promise<bigint>,
      splitter.getRecipients() as Promise<Array<{ addr: string; shareInBps: bigint }>>,
      token.balanceOf(SPLITTER) as Promise<bigint>, token.balanceOf(account) as Promise<bigint>
    ]);
    if (vaultOwner.toLowerCase() !== SPLITTER.toLowerCase() || splitterVault.toLowerCase() !== VAULT.toLowerCase()) throw new Error("Vault/splitter linkage mismatch. No transaction sent.");
    if (splitterOwner.toLowerCase() !== OWNER_CONFIG.toLowerCase() || account.toLowerCase() !== splitterOwner.toLowerCase()) throw new Error(`Connected wallet must be configured splitter owner ${splitterOwner}. No transaction sent.`);
    if (!recipients.length || recipients.reduce((sum, item) => sum + Number(item.shareInBps), 0) !== 10_000) throw new Error("Recipient shares do not total 10,000 basis points. No transaction sent.");
    const ownerRecipient = recipients.find((r) => r.addr.toLowerCase() === OWNER_CONFIG.toLowerCase());
    const safeRecipient = recipients.find((r) => r.addr.toLowerCase() === AAVE_LABS_SAFE.toLowerCase());
    if (!ownerRecipient || !safeRecipient || Number(ownerRecipient.shareInBps) !== 5_000 || Number(safeRecipient.shareInBps) !== 5_000) throw new Error("Expected 50/50 owner and Aave Labs Safe recipients not verified. No transaction sent.");
    if (claimable === 0n && beforeSplitterBalance === 0n) throw new Error("No claimable fees or previously collected aEURC are available.");

    let collectHash = "not needed";
    if (claimable > 0n) {
      setStatus("va-claim-status", `Ready to collect ${format(claimable)} aEURC. Confirm transaction 1 of 2 in your wallet.`);
      const collectTx = await splitter.withdrawFees();
      collectHash = collectTx.hash;
      setStatus("va-claim-status", `Collection submitted: ${collectHash}. Waiting for confirmation…`);
      const receipt = await collectTx.wait();
      if (!receipt || receipt.status !== 1) throw new Error("Fee collection did not confirm successfully.");
    }
    const distributable = await token.balanceOf(SPLITTER) as bigint;
    if (distributable <= 0n) throw new Error("Splitter has no aEURC to distribute. No distribution transaction sent.");
    setStatus("va-claim-status", `Splitter holds ${format(distributable)} aEURC. Simulating distribution…`);
    await splitter.splitRevenue.staticCall([A_TOKEN]);
    setStatus("va-claim-status", "Distribution simulation succeeded. Confirm transaction 2 of 2 in your wallet.");
    const splitTx = await splitter.splitRevenue([A_TOKEN]);
    setStatus("va-claim-status", `Distribution submitted: ${splitTx.hash}. Waiting for confirmation…`);
    const splitReceipt = await splitTx.wait();
    if (!splitReceipt || splitReceipt.status !== 1) throw new Error("Distribution did not confirm successfully.");
    const [afterWalletBalance, afterSplitterBalance] = await Promise.all([token.balanceOf(account), token.balanceOf(SPLITTER)]);
    setStatus("va-claim-status", `Complete. Your wallet received ${format(afterWalletBalance - beforeWalletBalance)} aEURC. Splitter remainder: ${format(afterSplitterBalance)}. Collection: ${collectHash}. Distribution: ${splitTx.hash}`);
  } catch (error) {
    setStatus("va-claim-status", error instanceof Error ? error.message : "Fee collection/distribution was not completed.");
  } finally {
    button.disabled = false;
    await refreshVault();
  }
});

// Initial public read: no wallet connection and no transaction request.
void refreshVault();
