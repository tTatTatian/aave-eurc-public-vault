/**
 * Prepared Aave Simple Earn deployment parameters.
 *
 * Configuration only: no wallet connection, approvals, deployment or
 * transaction submission is performed by this module.
 *
 * Aave's documented SDK/API recipient split is applied to the manager-side
 * 50% of total fee revenue. A 100% split to this single owner recipient means
 * the owner receives 50% of total fees and Aave Labs receives 50%.
 */
export const deploymentConfig = {
  vaultName: "Y.L. Aave Eurc Vault Shares",
  shareTokenSymbol: "ylEurc",
  chainId: 8453,
  networkName: "Base Mainnet",
  owner: "0xc9afCD8eFAbee5A24f7a306bFc6108af4E337Ccb",
  feeRecipient: "0xc9afCD8eFAbee5A24f7a306bFc6108af4E337Ccb",
  asset: {
    symbol: "EURC",
    decimals: 6,
    address: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42"
  },
  aaveV3: {
    pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    aToken: "0x90DA57E0A6C0d166Bf15764E03b83745Dc90025B"
  },
  performanceFeeBps: 1_000,
  aaveLabsAutomaticAllocationBps: 5_000,
  feeRecipients: [
    {
      address: "0xc9afCD8eFAbee5A24f7a306bFc6108af4E337Ccb",
      percentOfManagerSideAllocation: 100
    }
  ],
  intendedFeeAllocationBps: {
    aaveLabs: 5_000,
    configuredRecipient: 5_000
  },
  initialLockDeposit: {
    amount: "1",
    rawAmount: 1_000_000n,
    permanentlyLocked: true
  },
  strategy: {
    description: "Aave V3 EURC supply only",
    publicDeposits: true,
    borrowingEnabled: false,
    leverageEnabled: false,
    additionalStrategiesEnabled: false
  },
  safety: {
    walletConnectionEnabled: false,
    transactionSigningEnabled: false,
    transactionSubmissionEnabled: false,
    privateKeyHandling: false,
    seedPhraseHandling: false
  }
} as const;

export function validateDeploymentConfig() {
  const errors: string[] = [];
  const addressPattern = /^0x[a-fA-F0-9]{40}$/;

  if (!addressPattern.test(deploymentConfig.owner)) errors.push("Owner must be a valid EVM address.");
  if (!addressPattern.test(deploymentConfig.feeRecipient)) errors.push("Fee recipient must be a valid EVM address.");
  if (deploymentConfig.performanceFeeBps < 0 || deploymentConfig.performanceFeeBps > 10_000) {
    errors.push("Performance fee must be between 0 and 10,000 basis points.");
  }
  const allocationTotal =
    deploymentConfig.intendedFeeAllocationBps.aaveLabs +
    deploymentConfig.intendedFeeAllocationBps.configuredRecipient;
  if (allocationTotal !== 10_000) errors.push("Intended fee allocations must total 10,000 basis points.");

  const recipientSplitTotal = deploymentConfig.feeRecipients.reduce(
    (total, recipient) => total + recipient.percentOfManagerSideAllocation,
    0
  );
  if (recipientSplitTotal !== 100) {
    errors.push("Fee recipient splits must total 100% of the manager-side allocation.");
  }
  if (deploymentConfig.feeRecipients.some((recipient) => !addressPattern.test(recipient.address))) {
    errors.push("Every fee recipient must be a valid EVM address.");
  }
  if (deploymentConfig.feeRecipients.length !== 1 ||
      deploymentConfig.feeRecipients[0].address.toLowerCase() !== deploymentConfig.owner.toLowerCase()) {
    errors.push("The owner must be the sole recipient of the manager-side fee allocation.");
  }

  if (deploymentConfig.asset.decimals !== 6 || deploymentConfig.initialLockDeposit.rawAmount !== 1_000_000n) {
    errors.push("The 1 EURC lock deposit must equal 1,000,000 raw units for a 6-decimal token.");
  }
  if (deploymentConfig.owner.toLowerCase() !== deploymentConfig.feeRecipient.toLowerCase()) {
    errors.push("The configured fee recipient must match the confirmed owner wallet.");
  }
  if (deploymentConfig.safety.transactionSigningEnabled || deploymentConfig.safety.transactionSubmissionEnabled) {
    errors.push("Signing and submission must remain disabled until separately approved.");
  }
  return errors;
}
