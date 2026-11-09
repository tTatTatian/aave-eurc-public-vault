import { vaultConfig, developmentStatus } from "./config";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Application root element #app was not found.");
}

const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div class="brand-mark">A</div>
      <div>
        <p class="eyebrow">BASE MAINNET · CHAIN 8453</p>
        <h1>${vaultConfig.name}</h1>
      </div>
      <span class="status-pill">Live vault interface</span>
    </header>

    <section class="hero">
      <p class="eyebrow">EURC YIELD STRATEGY</p>
      <h2>One asset. One protocol.<br />Transparent by design.</h2>
      <p class="intro">A public EURC vault supplying liquidity to Aave V3 on Base. Deposit, redeem shares and manage owner fees from one dashboard.</p>
      <div class="notice">
        <strong>Deployed on Base Mainnet.</strong>
        <span>Vault contract: 0x56E70807df5e23eB628327c788De38C8f8dF95Bc. Deposits and redemptions require explicit browser-wallet confirmation. Fee claims are restricted to the on-chain vault owner.</span>
      </div>
      <div class="wallet-connect panel" aria-label="Browser wallet connection">
        <div>
          <p class="eyebrow">BROWSER WALLET</p>
          <strong id="wallet-status">Not connected</strong>
          <p id="wallet-detail" class="muted">Connect your browser wallet to view your position and interact with the vault.</p>
        </div>
        <div class="wallet-actions">
          <button id="connect-wallet" class="refresh-button" type="button">Connect browser wallet</button>
          <button id="disconnect-wallet" class="disconnect-button" type="button" hidden>Disconnect wallet</button>
        </div>
      </div>
    </section>

    <section class="panel" id="vault-actions" aria-label="Vault deposits, withdrawals and fee claims"></section>

    <section class="grid" aria-label="Vault configuration">
      <article class="panel">
        <p class="eyebrow">UNDERLYING ASSET</p>
        <h3>EURC</h3>
        <p class="muted">6 decimal places</p>
        <code>${shortAddress(vaultConfig.asset.address)}</code>
      </article>
      <article class="panel">
        <p class="eyebrow">YIELD PROTOCOL</p>
        <h3>Aave V3</h3>
        <p class="muted">Base Mainnet</p>
        <code>${shortAddress(vaultConfig.aaveV3.pool)}</code>
      </article>
      <article class="panel">
        <p class="eyebrow">PERFORMANCE FEE</p>
        <h3>10%</h3>
        <p class="muted">Of generated yield, not principal</p>
      </article>
      <article class="panel">
        <p class="eyebrow">RISK SETTINGS</p>
        <h3>No leverage</h3>
        <p class="muted">No borrowing · Aave EURC supply only</p>
      </article>
    </section>

    <section class="panel live-panel" aria-labelledby="live-title">
      <div class="live-heading">
        <div>
          <p class="eyebrow">AAVE V3 · BASE · EURC</p>
          <h3 id="live-title">Live reserve data</h3>
          <p class="muted">Read-only data from Aave's official API. Refreshes every 60 seconds.</p>
        </div>
        <button id="refresh-data" class="refresh-button" type="button">↻ Refresh</button>
      </div>
      <div id="live-status" class="live-status" role="status" aria-live="polite">Connecting to Aave…</div>
      <div class="live-grid">
        <article class="metric">
          <p class="eyebrow">SUPPLY APY</p>
          <strong id="supply-apy">—</strong>
          <span class="muted">Variable rate</span>
        </article>
        <article class="metric">
          <p class="eyebrow">TOTAL SUPPLIED</p>
          <strong id="total-supplied">—</strong>
          <span class="muted">EURC</span>
        </article>
        <article class="metric">
          <p class="eyebrow">TOTAL BORROWED</p>
          <strong id="total-borrowed">—</strong>
          <span class="muted">EURC</span>
        </article>
        <article class="metric">
          <p class="eyebrow">AVAILABLE LIQUIDITY</p>
          <strong id="available-liquidity">—</strong>
          <span class="muted">EURC</span>
        </article>
        <article class="metric">
          <p class="eyebrow">UTILIZATION</p>
          <strong id="utilization">—</strong>
          <span class="muted">Reserve utilization</span>
        </article>
        <article class="metric">
          <p class="eyebrow">BORROW APY</p>
          <strong id="borrow-apy">—</strong>
          <span class="muted">Variable rate</span>
        </article>
      </div>
      <div class="live-foot">
        <span id="reserve-state">Reserve status: checking…</span>
        <span id="last-updated">Last updated: —</span>
      </div>
      <p class="data-disclaimer">APY is variable and is not a forecast or guaranteed vault return. Figures describe the Aave reserve, not a deployed vault or user position.</p>
      <p id="live-error" class="live-error" hidden></p>
    </section>

    <section class="panel details">
      <div>
        <p class="eyebrow">VAULT OPERATIONS</p>
        <h3>Live contract checks</h3>
      </div>
      <ul>
        <li class="done">Vault deployed on Base Mainnet</li>
        <li class="done">EURC asset and Aave V3 market verified</li>
        <li class="done">10% performance fee verified on-chain</li>
        <li class="done">Initial 1 ylEurc share confirmed at the vault address</li>
        <li class="done">Deposit and redeem interface added</li>
        <li class="done">Manager fee claim interface added with on-chain owner checks</li>
        <li>Owner address discrepancy must be resolved before fee claims can be enabled</li>
      </ul>      <p class="footnote">Deposits and redemptions require explicit wallet approval. Manager fee claims are blocked unless the connected wallet matches the on-chain owner and the configured owner.</p>
    </section>

    <footer>
      <p>EURC supply rates vary and are not guaranteed. Smart-contract, protocol and liquidity risks apply.</p>
      <p>Vault actions require separate wallet confirmations. Never approve or sign unless the token, amount, recipient and network match the action you intend.</p>
    </footer>
  </main>
`;

const API_URL = "https://api.v3.aave.com/graphql";
const MARKET = vaultConfig.aaveV3.pool;
const TOKEN = vaultConfig.asset.address;

const marketQuery = `
  query BaseEurcReserve {
    market(request: { address: "${MARKET}", chainId: ${vaultConfig.chainId} }) {
      name
      reserves {
        underlyingToken { address symbol decimals }
        isFrozen
        isPaused
        supplyInfo {
          apy { formatted }
          total { value }
        }
        borrowInfo {
          apy { formatted }
          total { amount { value } }
          availableLiquidity { amount { value } }
          utilizationRate { formatted }
        }
      }
    }
  }
`;

const getElement = (id: string) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing dashboard element: ${id}`);
  return element;
};

const setText = (id: string, value: string) => {
  getElement(id).textContent = value;
};

const numberFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const formatAmount = (value: string | number | null | undefined) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? numberFormat.format(amount) : "—";
};

let requestInFlight = false;

async function loadLiveReserve() {
  if (requestInFlight) return;
  requestInFlight = true;

  const refreshButton = getElement("refresh-data") as HTMLButtonElement;
  const errorElement = getElement("live-error") as HTMLParagraphElement;
  refreshButton.disabled = true;
  errorElement.hidden = true;
  setText("live-status", "Fetching the latest Aave reserve data…");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: marketQuery })
    });

    if (!response.ok) {
      throw new Error(`Aave API returned HTTP ${response.status}`);
    }

    const payload = await response.json() as {
      data?: {
        market?: {
          reserves?: Array<{
            underlyingToken?: { address?: string; symbol?: string };
            isFrozen?: boolean;
            isPaused?: boolean;
            supplyInfo?: {
              apy?: { formatted?: string };
              total?: { value?: string };
            };
            borrowInfo?: {
              apy?: { formatted?: string };
              total?: { amount?: { value?: string } };
              availableLiquidity?: { amount?: { value?: string } };
              utilizationRate?: { formatted?: string };
            };
          }>;
        } | null;
      };
      errors?: Array<{ message?: string }>;
    };

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((item) => item.message || "Unknown GraphQL error").join("; "));
    }

    const reserves = payload.data?.market?.reserves ?? [];
    const reserve = reserves.find(
      (item) => item.underlyingToken?.address?.toLowerCase() === TOKEN.toLowerCase()
    );

    if (!reserve) {
      throw new Error("EURC reserve was not found in the Aave Base market response.");
    }

    setText("supply-apy", reserve.supplyInfo?.apy?.formatted
      ? `${reserve.supplyInfo.apy.formatted}%` : "—");
    setText("total-supplied", formatAmount(reserve.supplyInfo?.total?.value));
    setText("total-borrowed", formatAmount(reserve.borrowInfo?.total?.amount?.value));
    setText("available-liquidity", formatAmount(reserve.borrowInfo?.availableLiquidity?.amount?.value));
    setText("utilization", reserve.borrowInfo?.utilizationRate?.formatted
      ? `${reserve.borrowInfo.utilizationRate.formatted}%` : "—");
    setText("borrow-apy", reserve.borrowInfo?.apy?.formatted
      ? `${reserve.borrowInfo.apy.formatted}%` : "—");

    const state = reserve.isPaused ? "Paused" : reserve.isFrozen ? "Frozen" : "Active";
    setText("reserve-state", `Reserve status: ${state}`);
    setText("live-status", "Connected · automatically refreshes every 60 seconds");
    setText("last-updated", `Last updated: ${new Date().toLocaleString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load live Aave data.";
    setText("live-status", "Live data unavailable · retry using Refresh");
    errorElement.textContent = message;
    errorElement.hidden = false;
  } finally {
    requestInFlight = false;
    refreshButton.disabled = false;
  }
}

getElement("refresh-data").addEventListener("click", () => {
  void loadLiveReserve();
});

void loadLiveReserve();
window.setInterval(() => {
  void loadLiveReserve();
}, 60_000);


// Mount the official Aave SDK preflight only after the dashboard DOM exists.
void import("./vault-actions");


type InjectedWallet = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

const connectButton = getElement("connect-wallet") as HTMLButtonElement;
const disconnectButton = getElement("disconnect-wallet") as HTMLButtonElement;
const walletStatus = getElement("wallet-status");
const walletDetail = getElement("wallet-detail");

function showWalletState(address: string | null, chainId: string | null) {
  if (!address) {
    walletStatus.textContent = "Not connected";
    walletDetail.textContent = "Connect your browser wallet to view your position and interact with the vault.";
    connectButton.textContent = "Connect browser wallet";
    disconnectButton.hidden = true;
    return;
  }

  const isBase = chainId?.toLowerCase() === "0x2105" || Number(chainId) === 8453;
  walletStatus.textContent = isBase ? `Connected · ${shortAddress(address)}` : `Connected · ${shortAddress(address)} · wrong network`;
  walletDetail.textContent = isBase
    ? "Base Mainnet detected (Chain ID 8453). No transaction permissions requested."
    : `Detected chain ID ${chainId ?? "unknown"}. Switch to Base Mainnet (8453) in your wallet. No transaction permissions requested.`;
  connectButton.textContent = "Wallet connected";
  disconnectButton.hidden = false;
}

connectButton.addEventListener("click", async () => {
  const wallet = (window as Window & { ethereum?: InjectedWallet }).ethereum;
  if (!wallet) {
    walletStatus.textContent = "No browser wallet detected";
    walletDetail.textContent = "Open this dashboard in a browser with your EVM wallet enabled.";
    return;
  }

  connectButton.disabled = true;
  walletStatus.textContent = "Waiting for wallet connection…";
  try {
    const accounts = await wallet.request({ method: "eth_requestAccounts" }) as string[];
    const address = accounts?.[0] ?? null;
    if (!address) throw new Error("The wallet did not return an account.");

    let chainId = await wallet.request({ method: "eth_chainId" }) as string;

    if (chainId?.toLowerCase() !== "0x2105" && Number(chainId) !== vaultConfig.chainId) {
      walletStatus.textContent = "Switching wallet to Base Mainnet…";
      walletDetail.textContent = "Please approve the network-switch request in your browser wallet.";

      try {
        await wallet.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }]
        });
      } catch (switchError) {
        const errorCode = (switchError as { code?: number })?.code;
        if (errorCode !== 4902) throw switchError;

        await wallet.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x2105",
            chainName: "Base Mainnet",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://mainnet.base.org"],
            blockExplorerUrls: ["https://basescan.org"]
          }]
        });

        await wallet.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }]
        });
      }

      chainId = await wallet.request({ method: "eth_chainId" }) as string;
    }

    if (chainId?.toLowerCase() !== "0x2105" && Number(chainId) !== vaultConfig.chainId) {
      throw new Error(`Wallet is still on chain ${chainId ?? "unknown"}. Please select Base Mainnet and reconnect.`);
    }

    showWalletState(address, chainId);
    walletDetail.textContent = "Connected to Base Mainnet (Chain ID 8453). No transaction or spending permissions requested.";
    // Intentionally avoid provider event subscriptions because some embedded
    // browser previews proxy the injected provider and violate Proxy invariants.
  } catch (error) {
    walletStatus.textContent = "Wallet connection failed";
    walletDetail.textContent = error instanceof Error ? error.message : "The wallet did not complete the connection request.";
    connectButton.textContent = "Connect browser wallet";
  } finally {
    connectButton.disabled = false;
  }
});


disconnectButton.addEventListener("click", () => {
  // Clears this dashboard's local connection display only. Injected EVM
  // wallets do not provide a standard programmatic permission-revocation API.
  showWalletState(null, null);
  walletDetail.textContent = "Disconnected from this dashboard. To revoke this site's wallet permission, manage connected sites in your wallet settings.";
});
