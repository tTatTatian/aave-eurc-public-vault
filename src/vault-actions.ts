import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
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
  "function getFee() view returns (uint256)",
  "function getClaimableFees() view returns (uint256)",
  "function deposit(uint256,address) returns (uint256)",
  "function redeem(uint256,address,address) returns (uint256)",
  "function withdrawFees(address,uint256)"
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
      <div class="vault-header-actions"><button id="vault-connect" class="refresh-button" type="button">Connect wallet</button><button id="vault-refresh" class="refresh-button" type="button">↻ Refresh</button></div>
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
        <h4>Withdraw / redeem</h4>
        <p class="muted">Redeem ylEurc shares for the underlying EURC. Your wallet must hold the shares.</p>
        <label for="va-redeem-amount">ylEurc shares</label>
        <input id="va-redeem-amount" inputmode="decimal" autocomplete="off" placeholder="0.00" />
        <div class="vault-preview" id="va-redeem-preview">Enter shares to preview EURC returned.</div>
        <button id="va-redeem" class="refresh-button" type="button">Preview and redeem</button>
        <p id="va-redeem-status" class="action-status" role="status" aria-live="polite">No redemption submitted.</p>
      </section>

      <section class="vault-action-card vault-fee-card">
        <p class="eyebrow">VAULT MANAGER ONLY</p>
        <h4>Claim performance fees</h4>
        <p class="muted">Claimable fees are paid in the Aave EURC aToken (aEURC), not in underlying EURC.</p>
        <div class="fee-amount"><strong id="va-claimable-fees">—</strong><span>aEURC claimable</span></div>
        <p class="muted" id="va-fee-owner">Checking on-chain owner…</p>
        <button id="va-claim-fees" class="refresh-button" type="button" disabled>Claim fees to owner wallet</button>
        <p id="va-claim-status" class="action-status" role="status" aria-live="polite">Fee claim requires the on-chain vault owner.</p>
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

function format(raw: bigint): string {
  return Number(formatUnits(raw, DECIMALS)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6
  });
}
function parseAmount(value: string, label: string): bigint {
  if (!value || !/^\\d+(\\.\\d{0,6})?$/.test(value)) {
    throw new Error(`Enter a valid ${label} amount with up to 6 decimal places.`);
  }
  const amount = parseUnits(value, DECIMALS);
  if (amount <= 0n) throw new Error(`The ${label} amount must be greater than zero.`);
  return amount;
}
function walletProvider(): BrowserProvider {
  if (!window.ethereum) throw new Error("No browser wallet was detected. Open this page in your wallet-enabled browser.");
  return new BrowserProvider(window.ethereum as never);
}
async function requireWallet(): Promise<{ account: string; signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>; browser: BrowserProvider }> {
  const browser = walletProvider();
  const accounts = await window.ethereum!.request({ method: "eth_requestAccounts" }) as string[];
  const account = accounts?.[0];
  if (!account) throw new Error("The browser wallet did not return an account.");
  const network = await browser.getNetwork();
  if (network.chainId !== 8453n) throw new Error("Switch your browser wallet to Base Mainnet (Chain ID 8453).");
  const signer = await browser.getSigner(account);
  connectedAccount = account;
  return { account, signer, browser };
}
function readContracts() {
  const browser = walletProvider();
  return {
    browser,
    vault: new Contract(VAULT, vaultAbi, browser),
    eurc: new Contract(EURC, erc20Abi, browser)
  };
}

async function refreshVault() {
  try {
    const { browser, vault, eurc } = readContracts();
    const network = await browser.getNetwork();
    if (network.chainId !== 8453n) throw new Error("Switch your browser wallet to Base Mainnet (Chain ID 8453) to read this vault.");
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
    setText("va-fee-owner", `On-chain owner: ${onchainOwner} · Fee: ${(Number(feeRaw) / 1e16).toFixed(2)}%`);
    const claimButton = byId<HTMLButtonElement>("va-claim-fees");
    const isOwner = !!connectedAccount &&
      connectedAccount.toLowerCase() === onchainOwner.toLowerCase() &&
      onchainOwner.toLowerCase() === OWNER_CONFIG.toLowerCase();
    claimButton.disabled = !isOwner || claimableRaw === 0n;
    if (claimableRaw === 0n) {
      setStatus("va-claim-status", "No performance fees are currently claimable.");
    } else if (onchainOwner.toLowerCase() !== OWNER_CONFIG.toLowerCase()) {
      setStatus("va-claim-status", "Fee claim blocked: the contract owner differs from the configured owner. This must be reconciled before claiming.");
    } else if (!isOwner) {
      setStatus("va-claim-status", "Fee claim locked: connect the exact on-chain owner wallet. The page will not attempt a claim from another address.");
    } else {
      setStatus("va-claim-status", "Owner verified. You can claim the currently accrued aEURC fees.");
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
      const maxRedeem = await vault.maxRedeem(connectedAccount) as bigint;
      byId<HTMLButtonElement>("va-deposit").disabled = maxDeposit === 0n;
      byId<HTMLButtonElement>("va-redeem").disabled = maxRedeem === 0n;
      setStatus("va-status", `Connected · ${connectedAccount.slice(0, 6)}…${connectedAccount.slice(-4)} · Base Mainnet · Max deposit ${format(maxDeposit)} EURC · Max redeem ${format(maxRedeem)} ylEurc`);
    } else {
      setText("va-eurc-balance", "Connect wallet");
      setText("va-share-balance", "Connect wallet");
      setText("va-share-value", format(await vault.convertToAssets(parseUnits("1", DECIMALS)) as bigint));
      setStatus("va-status", "Vault data loaded · connect your browser wallet to see balances and use deposit / redeem.");
      byId<HTMLButtonElement>("va-deposit").disabled = false;
      byId<HTMLButtonElement>("va-redeem").disabled = false;
    }
  } catch (error) {
    setStatus("va-status", error instanceof Error ? error.message : "Unable to read the vault.");
    byId<HTMLButtonElement>("va-deposit").disabled = true;
    byId<HTMLButtonElement>("va-redeem").disabled = true;
    byId<HTMLButtonElement>("va-claim-fees").disabled = true;
  }
}

byId<HTMLButtonElement>("vault-connect").addEventListener("click", async () => {
  const button = byId<HTMLButtonElement>("vault-connect");
  button.disabled = true;
  try {
    const { account } = await requireWallet();
    button.textContent = account.slice(0, 6) + "…" + account.slice(-4);
    setStatus("va-status", "Wallet connected. Refreshing vault position…");
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
    const shares = parseAmount(inputValue("va-redeem-amount"), "share");
    const { vault } = readContracts();
    const assets = await vault.previewRedeem(shares) as bigint;
    setText("va-redeem-preview", `Estimated return: ${format(assets)} EURC`);
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
    const shares = parseAmount(inputValue("va-redeem-amount"), "share");
    const vault = new Contract(VAULT, vaultAbi, signer);
    const [balance, maxRedeem, preview] = await Promise.all([
      vault.balanceOf(account) as Promise<bigint>,
      vault.maxRedeem(account) as Promise<bigint>,
      vault.previewRedeem(shares) as Promise<bigint>
    ]);
    if (balance < shares || shares > maxRedeem) {
      throw new Error(`Insufficient redeemable ylEurc. Current balance: ${format(balance)} shares; maxRedeem: ${format(maxRedeem)}.`);
    }
    setStatus("va-redeem-status", `Preview: ${format(shares)} ylEurc → approximately ${format(preview)} EURC. Review the wallet prompt.`);
    const tx = await vault.redeem(shares, account, account);
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
    setStatus("va-claim-status", "Verifying owner and current claimable fees…");
    const { account, signer } = await requireWallet();
    const vault = new Contract(VAULT, vaultAbi, signer);
    const [onchainOwner, amount, freshFee] = await Promise.all([
      vault.owner() as Promise<string>,
      vault.getClaimableFees() as Promise<bigint>,
      vault.getFee() as Promise<bigint>
    ]);
    if (account.toLowerCase() !== onchainOwner.toLowerCase()) {
      throw new Error(`Connected wallet is not the on-chain owner (${onchainOwner}). Fee claim blocked.`);
    }
    if (onchainOwner.toLowerCase() !== OWNER_CONFIG.toLowerCase()) {
      throw new Error("On-chain owner does not match the configured owner wallet. Fee claim blocked pending owner reconciliation.");
    }
    if (amount === 0n) throw new Error("There are no claimable fees.");
    if (freshFee > 10n ** 18n) throw new Error("Unexpected fee value; claim blocked.");
    setStatus("va-claim-status", `Claiming ${format(amount)} aEURC to the verified owner wallet. Review the transaction in your browser wallet.`);
    const tx = await vault.withdrawFees(account, amount);
    setStatus("va-claim-status", `Fee claim submitted: ${tx.hash}. Waiting for confirmation…`);
    await tx.wait();
    setStatus("va-claim-status", "Fee claim confirmed. aEURC was sent to the owner wallet.");
    await refreshVault();
  } catch (error) {
    setStatus("va-claim-status", error instanceof Error ? error.message : "Fee claim was not completed.");
  } finally {
    button.disabled = false;
    await refreshVault();
  }
});

// Initial public read: no wallet connection and no transaction request.
void refreshVault();
