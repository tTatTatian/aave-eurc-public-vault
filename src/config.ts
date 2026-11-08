export const vaultConfig = {
  name: "Aave EURC Public Vault",
  shareName: "Y.L. Aave Eurc Vault Shares",
  shareSymbol: "ylEurc",
  owner: "0xc9afCD8eFAbee5A24f7a306bFc6108af4E337Ccb",
  chainId: 8453,
  networkName: "Base Mainnet",
  asset: {
    symbol: "EURC",
    decimals: 6,
    address: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42"
  },
  aaveV3: {
    pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    aToken: "0x90DA57E0A6C0d166Bf15764E03b83745Dc90025B"
  },
  performanceFeePercent: 10,
  performanceFeeBps: 1_000,
  feeRecipients: [
    {
      address: "0xc9afCD8eFAbee5A24f7a306bFc6108af4E337Ccb",
      percentOfManagerShare: 100
    }
  ],
  initialLockDeposit: "1",
  initialLockDepositRaw: "1000000",
  strategy: "Aave V3 EURC supply only",
  depositsPublic: true,
  leverageEnabled: false,
  borrowingEnabled: false,
  transactionsEnabled: false
} as const;

export const developmentStatus = {
  phase: "Deployment configuration prepared; SDK deployment integration pending",
  deployed: false,
  liveDataConnected: true,
  walletConnected: false,
  transactionSigningEnabled: false
} as const;
