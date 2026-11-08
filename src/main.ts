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
      <span class="status-pill">Development preview</span>
    </header>

    <section class="hero">
      <p class="eyebrow">EURC YIELD STRATEGY</p>
      <h2>One asset. One protocol.<br />Transparent by design.</h2>
      <p class="intro">A proposed public, non-custodial vault designed to supply EURC to Aave V3 on Base.</p>
      <div class="notice">
        <strong>Not deployed — no deposits accepted.</strong>
        <span>Read-only development preview. Browser wallet connection is available for address and network detection only; token approvals, signing and vault deployment remain disabled.</span>
      </div>
      <div class="wallet-connect panel" aria-label="Browser wallet connection">
        <div>
          <p class="eyebrow">BROWSER WALLET</p>
          <strong id="wallet-status">Not connected</strong>
          <p id="wallet-detail" class="muted">Connect MetaMask or another injected browser wallet. Read-only connection only.</p>
        </div>
        <button id="connect-wallet" class="refresh-button" type="button">Connect browser wallet</button>
      </div>
    </section>

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

    <section class="panel sdk-panel" id="aave-sdk-preflight"></section>

    <section class="panel details">
      <div>
        <p class="eyebrow">DEVELOPMENT CHECKLIST</p>
        <h3>Deployment safety</h3>
      </div>
      <ul>
        <li class="done">Base and EURC configuration recorded</li>
        <li class="done">Aave V3 Pool and aToken addresses recorded</li>
        <li class="done">Live Aave reserve data connected (read-only)</li>
        <li class="done">Vault name, share symbol, owner, fee rate and initial lock recorded</li>
        <li class="done">Official Aave SDK reserve verification and deployment-plan preflight integrated</li>
        <li class="done">Fee recipient calldata validation integrated</li>
        <li class="done">Configuration safety tests added — run in Codespaces</li>
        <li class="done">Browser wallet connection enabled for address and network detection only</li>
        <li>Deployment review and explicit approval — pending</li>
      </ul>
      <p class="footnote">Build status: ${developmentStatus.phase}. Browser wallet connection is read-only; transaction signing, submission and vault deployment remain disabled.</p>
    </section>

    <footer>
      <p>EURC supply rates vary and are not guaranteed. Smart-contract, protocol and liquidity risks apply.</p>
      <p>Wallet connection is read-only. Token approvals, transaction signing and vault deployment are disabled in this preview.</p>
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
void import("./aave-sdk-preflight");


type InjectedWallet = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

const connectButton = getElement("connect-wallet") as HTMLButtonElement;
const walletStatus = getElement("wallet-status");
const walletDetail = getElement("wallet-detail");

function showWalletState(address: string | null, chainId: string | null) {
  if (!address) {
    walletStatus.textContent = "Not connected";
    walletDetail.textContent = "Connect MetaMask or another injected browser wallet. Read-only connection only.";
    connectButton.textContent = "Connect browser wallet";
    return;
  }

  const isBase = chainId?.toLowerCase() === "0x2105" || Number(chainId) === 8453;
  walletStatus.textContent = isBase ? `Connected · ${shortAddress(address)}` : `Connected · ${shortAddress(address)} · wrong network`;
  walletDetail.textContent = isBase
    ? "Base Mainnet detected (Chain ID 8453). No transaction permissions requested."
    : `Detected chain ID ${chainId ?? "unknown"}. Switch to Base Mainnet (8453) in your wallet. No transaction permissions requested.`;
  connectButton.textContent = "Wallet connected";
}

connectButton.addEventListener("click", async () => {
  const wallet = (window as Window & { ethereum?: InjectedWallet }).ethereum;
  if (!wallet) {
    walletStatus.textContent = "No browser wallet detected";
    walletDetail.textContent = "Open this dashboard in MetaMask's browser or a browser with an injected EVM wallet.";
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
