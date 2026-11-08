# Aave EURC Public Vault

A proposed public, non-custodial EURC yield vault on Base Mainnet, using Aave V3 as its only intended yield strategy.

## Confirmed project configuration

| Setting | Value |
|---|---|
| Vault/share token name | Y.L. Aave Eurc Vault Shares |
| Share token symbol | ylEurc |
| Network | Base Mainnet |
| Chain ID | 8453 |
| Protocol | Aave V3 |
| Underlying asset | EURC |
| EURC decimals | 6 |
| Deposits | Intended to be public |
| Performance fee | 10% of generated yield, not principal |
| Owner | `0xc9afCD8eFAbee5A24f7a306bFc6108af4E337Ccb` |
| Fee recipient | Same as owner |
| Recipient split | 100% of the manager-side allocation |
| Aave Labs allocation | 50% of total performance-fee revenue |
| Owner allocation | 50% of total performance-fee revenue |
| Initial locked deposit | 1 EURC (1,000,000 raw units) |
| Leverage | Disabled |
| Borrowing | Disabled |
| Strategy | Aave V3 EURC supply only |

The 1 EURC initial lock is permanently locked and cannot be withdrawn. It is not a refundable deposit.

## Contract addresses

- EURC: `0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42`
- Aave V3 Pool: `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`
- Aave EURC aToken: `0x90DA57E0A6C0d166Bf15764E03b83745Dc90025B`

## Fee allocation

The official Aave Simple Earn deployment guide documents that Aave Labs receives 50% of total performance-fee revenue. The remaining 50% is split among the configured recipients.

This project configures the owner wallet as the sole recipient with a 100% split of that manager-side allocation. Therefore, for every 100 EURC of total collected fee revenue:
- Aave Labs receives 50 EURC.
- The configured owner wallet receives 50 EURC.

The 10% performance fee applies to yield, not depositor principal. Example: 100 EURC of realized yield produces 10 EURC total fee revenue; 5 EURC goes to Aave Labs and 5 EURC to the owner.

Official references:
- [Aave Simple Earn deployment guide](https://aave.com/docs/vaults/simple-earn/deploy)
- [Aave Simple Earn overview](https://aave.com/docs/vaults/simple-earn/overview)

## Architecture and safety constraints

- One underlying asset: EURC.
- One strategy: supply EURC to Aave V3 on Base.
- No borrowing, leverage, looping, swaps, or additional strategies.
- Public deposits are intended, subject to the official vault implementation's actual deposit controls.
- No private keys or seed phrases are collected, stored, or handled.
- Wallet interaction is intended to be through MetaMask.
- No approval, deposit, withdrawal, deployment, or other transaction may be signed or submitted without explicit user approval.
- The current application remains read-only. It does not connect a wallet or execute transactions.
- Deployment must use the official Aave Simple Earn SDK/API; a hand-written clone is not the intended route.

## Development status

Status: configuration and read-only dashboard in development. **Not deployed.**

Implemented:
1. Base/EURC/Aave V3 configuration.
2. Read-only live Aave EURC reserve dashboard.
3. Confirmed vault identity, owner, fee rate, recipient split and initial lock recorded in `src/deployment-config.ts`.
4. Configuration safety tests added in `tests/deployment-config.test.ts`.

Still required:
1. Integrate the official Aave Simple Earn deployment SDK/API and pin the exact SDK version.
2. Verify the connected deployer, owner, reserve and recipient configuration in a preflight screen.
3. Implement deployment preview and transaction review, with explicit approval required before wallet submission.
4. Add integration tests for the official SDK deployment plan and edge cases.
5. Add contract-level tests for deposits, withdrawals, yield accounting, fee collection, fee recipient allocation, and permanently locked initial shares.
6. Run unit tests, production build and independent contract/security review.
7. Review the final deployment transaction and obtain explicit approval before any wallet action.

## Local development

```bash
npm install
npm run dev
```

Run configuration tests:

```bash
npm test
```

Run the production build:

```bash
npm run build
```

## Risks

Aave supply rates are variable and not guaranteed. The vault would introduce smart-contract, protocol, liquidity, oracle, and operational risks. The vault is not risk-free and does not guarantee returns.

---

No deployment, wallet approval, or transaction is authorized by this repository documentation.
