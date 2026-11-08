import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AaveClient,
  AaveProvider,
  bigDecimal,
  evmAddress,
  useVaultDeploy,
  type VaultDeployRequest
} from "@aave/react";
import { deploymentConfig } from "./deployment-config";

const client = AaveClient.create();
const API_URL = "https://api.v3.aave.com/graphql";

const request: VaultDeployRequest = {
  market: evmAddress(deploymentConfig.aaveV3.pool),
  chainId: deploymentConfig.chainId,
  underlyingToken: evmAddress(deploymentConfig.asset.address),
  deployer: evmAddress(deploymentConfig.deployer),
  owner: evmAddress(deploymentConfig.owner),
  initialFee: bigDecimal(deploymentConfig.performanceFeeBps / 100),
  shareName: deploymentConfig.vaultName,
  shareSymbol: deploymentConfig.shareTokenSymbol,
  initialLockDeposit: bigDecimal(Number(deploymentConfig.initialLockDeposit.amount)),
  recipients: deploymentConfig.feeRecipients.map((recipient) => ({
    address: evmAddress(recipient.address),
    percent: bigDecimal(Number(recipient.percentOfManagerSideAllocation))
  }))
};

type ReserveResponse = {
  data?: {
    market?: {
      reserves?: Array<{
        underlyingToken?: { address?: string; symbol?: string; decimals?: number };
        isFrozen?: boolean;
        isPaused?: boolean;
      }>;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

async function verifyReserve() {
  const query = `
    query VerifyBaseEurcVaultReserve {
      market(request: { address: "${deploymentConfig.aaveV3.pool}", chainId: ${deploymentConfig.chainId} }) {
        reserves {
          underlyingToken { address symbol decimals }
          isFrozen
          isPaused
        }
      }
    }
  `;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query })
  });

  if (!response.ok) throw new Error(`Aave API returned HTTP ${response.status}`);
  const payload = await response.json() as ReserveResponse;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((item) => item.message || "GraphQL error").join("; "));
  }

  const reserve = payload.data?.market?.reserves?.find(
    (item) => item.underlyingToken?.address?.toLowerCase() === deploymentConfig.asset.address.toLowerCase()
  );

  if (!reserve) throw new Error("EURC reserve was not found for the configured Base Aave V3 market.");
  if (reserve.underlyingToken?.symbol !== "EURC" || reserve.underlyingToken.decimals !== 6) {
    throw new Error("Reserve token metadata does not match EURC with 6 decimals.");
  }
  if (reserve.isFrozen || reserve.isPaused) {
    throw new Error("The EURC reserve is frozen or paused. Deployment preflight stopped.");
  }
  return reserve;
}

function PreflightPanel() {
  const [prepareDeploy, preparing] = useVaultDeploy();
  const [status, setStatus] = useState("Not checked");
  const [planType, setPlanType] = useState("");
  const [error, setError] = useState("");

  const preparePlan = async () => {
    setError("");
    setPlanType("");
    setStatus("Checking the live EURC reserve…");

    try {
      await verifyReserve();
      setStatus("Reserve active. Preparing the official Aave deployment plan…");

      const result = await prepareDeploy(request);
      if (result.isErr()) {
        throw result.error;
      }

      setPlanType(result.value.__typename);
      setStatus("Official Aave deployment plan prepared. No transaction was sent.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to prepare the Aave deployment plan.";
      setError(message);
      setStatus("Preflight did not complete.");
    }
  };

  return (
    <section className="sdk-preflight">
      <div className="sdk-heading">
        <div>
          <p className="eyebrow">OFFICIAL AAVE SIMPLE EARN SDK</p>
          <h3>Deployment preflight</h3>
          <p className="muted">Checks the live Base EURC reserve and asks Aave's SDK to prepare a deployment plan. It does not connect a wallet or send a transaction.</p>
        </div>
        <span className="sdk-status">Read-only</span>
      </div>

      <div className="sdk-config-grid">
        <div><span>Deployer</span><code>{deploymentConfig.deployer}</code></div>
        <div><span>Owner</span><code>{deploymentConfig.owner}</code></div>
        <div><span>Performance fee</span><strong>10% of yield</strong></div>
        <div><span>Initial locked deposit</span><strong>1 EURC</strong></div>
        <div><span>Fee recipients</span><strong>Owner · 100% of manager-side pool</strong></div>
        <div><span>Network / asset</span><strong>Base · EURC · Aave V3</strong></div>
      </div>

      <div className="sdk-action-row">
        <button className="refresh-button" type="button" onClick={preparePlan} disabled={preparing.loading}>
          {preparing.loading ? "Preparing…" : "Run SDK preflight"}
        </button>
        <span className="sdk-result" role="status" aria-live="polite">{status}</span>
      </div>

      {planType && (
        <p className="sdk-plan"><strong>SDK plan type:</strong> {planType}. This is a prepared plan only; no approval, signing, or broadcast has occurred.</p>
      )}
      {error && <p className="live-error" role="alert">{error}</p>}
      <p className="data-disclaimer">The deployer address is recorded from your confirmation, but has not been checked against a connected wallet. The initial 1 EURC lock is permanently locked if deployment proceeds. Review the SDK-generated transaction separately before any future authorization.</p>
    </section>
  );
}

const mount = document.getElementById("aave-sdk-preflight");
if (mount) {
  createRoot(mount).render(
    <AaveProvider client={client}>
      <PreflightPanel />
    </AaveProvider>
  );
}
