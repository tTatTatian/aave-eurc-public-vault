import { describe, expect, it } from "vitest";
import { deploymentConfig, validateDeploymentConfig } from "../src/deployment-config";

describe("Aave EURC Public Vault deployment configuration", () => {
  it("matches the confirmed Base EURC vault identity", () => {
    expect(deploymentConfig.chainId).toBe(8453);
    expect(deploymentConfig.asset.symbol).toBe("EURC");
    expect(deploymentConfig.vaultName).toBe("Y.L. Aave Eurc Vault Shares");
    expect(deploymentConfig.shareTokenSymbol).toBe("ylEurc");
  });

  it("uses the confirmed owner as the sole fee recipient", () => {
    expect(deploymentConfig.owner).toBe("0xc9afCD8eFAbee5A24f7a306bFc6108af4E337Ccb");
    expect(deploymentConfig.feeRecipient).toBe(deploymentConfig.owner);
    expect(deploymentConfig.feeRecipients).toEqual([
      { address: deploymentConfig.owner, percentOfManagerSideAllocation: 100 }
    ]);
  });

  it("sets a 10% performance fee with Aave's 50/50 total-fee split", () => {
    expect(deploymentConfig.performanceFeeBps).toBe(1_000);
    expect(deploymentConfig.aaveLabsAutomaticAllocationBps).toBe(5_000);
    expect(deploymentConfig.intendedFeeAllocationBps).toEqual({
      aaveLabs: 5_000,
      configuredRecipient: 5_000
    });
    expect(deploymentConfig.feeRecipients[0].percentOfManagerSideAllocation).toBe(100);
  });

  it("sets a 1 EURC permanent lock", () => {
    expect(deploymentConfig.initialLockDeposit.amount).toBe("1");
    expect(deploymentConfig.initialLockDeposit.rawAmount).toBe(1_000_000n);
    expect(deploymentConfig.initialLockDeposit.permanentlyLocked).toBe(true);
  });

  it("keeps borrowing, leverage, signing and submission disabled", () => {
    expect(deploymentConfig.strategy.borrowingEnabled).toBe(false);
    expect(deploymentConfig.strategy.leverageEnabled).toBe(false);
    expect(deploymentConfig.safety.transactionSigningEnabled).toBe(false);
    expect(deploymentConfig.safety.transactionSubmissionEnabled).toBe(false);
    expect(deploymentConfig.safety.privateKeyHandling).toBe(false);
    expect(deploymentConfig.safety.seedPhraseHandling).toBe(false);
  });

  it("passes internal configuration checks", () => {
    expect(validateDeploymentConfig()).toEqual([]);
  });
});
