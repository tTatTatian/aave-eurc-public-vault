export const vaultConfig = {
  name: "Aave EURC Public Vault",
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
  performanceFeeBps: 1_000,
  strategy: "Aave V3 EURC supply only",
  depositsPublic: true,
  leverageEnabled: false,
  borrowingEnabled: false,
  transactionsEnabled: false
} as const;

export const developmentStatus = {
  phase: "Scaffold",
  deployed: false,
  liveDataConnected: false,
  walletConnected: false,
  transactionSigningEnabled: false
} as const;
