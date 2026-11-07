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
        <span>This preview is informational only. It does not connect a wallet or submit transactions.</span>
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

    <section class="panel details">
      <div>
        <p class="eyebrow">DEVELOPMENT CHECKLIST</p>
        <h3>Read-only scaffold</h3>
      </div>
      <ul>
        <li class="done">Base and EURC configuration recorded</li>
        <li class="done">Aave V3 Pool and aToken addresses recorded</li>
        <li>Official Simple Earn deployment integration — pending verification</li>
        <li>Fee recipient and protocol fee allocation — pending verification</li>
        <li>Vault name, share symbol, owner and initial locked deposit — pending</li>
        <li>Contract and integration tests — pending</li>
        <li>Deployment review and explicit approval — pending</li>
      </ul>
      <p class="footnote">Build status: ${developmentStatus.phase}. Live reserve data is not connected; no APY is advertised.</p>
    </section>

    <footer>
      <p>EURC supply rates vary and are not guaranteed. Smart-contract, protocol and liquidity risks apply.</p>
      <p>Wallet connection and transaction execution are intentionally disabled in this version.</p>
    </footer>
  </main>
`;
