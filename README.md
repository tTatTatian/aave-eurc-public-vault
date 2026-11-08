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
| Initial locked deposit | 1 EURC (1,000,000 raw units) |
| Leverage | Disabled |
| Borrowing | Disabled |
| Strategy | Aave V3 EURC supply only |

The 1 EURC initial lock is intended to remain permanently locked. It is not a refundable deposit.

## Contract addresses

- EURC: `0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42`
- Aave V3 Pool: `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`
- Aave EURC aToken: `0x90DA57E0A6C0d166Bf15764E03b83745Dc90025B`

## Fee allocation — pending SDK/API verification

The intended fee is 10% of realized yield. The intended allocation currently recorded in `src/deployment-config.ts` is 50% of fee revenue to Aave Labs and 50% to the configured owner/fee recipient.

**This allocation is a proposed configuration, not a verified on-chain setting.** Before deployment, it must be checked against the exact version of Aave's official Simple Earn deployment SDK/API and its fee-recipient parameters. Do not assume the owner automatically receives a particular share until that check is complete.

## Architecture and safety constraints

- One underlying asset: EURC.
- One strategy: supply EURC to Aave V3 on Base.
- No borrowing, leverage, looping, swaps, or additional strategies.
- Public deposits are intended, subject to the official vault implementation's actual deposit controls.
- No private keys or seed phrases are collected, stored, or handled.
- Wallet interaction is intended to be through MetaMask.
- No approval, deposit, withdrawal, deployment, or other transaction may be signed or submitted without explicit user approval.
- The current application remains read-only. It does not connect a wallet or execute transactions.

## Development status

Status: configuration and read-only dashboard in development. **Not deployed.**

Implemented:
1. Base/EURC/Aave V3 configuration.
2. Read-only live Aave EURC reserve dashboard.
3. Confirmed vault identity, owner, fee rate, and initial lock recorded in `src/deployment-config.ts`.
4. Configuration safety tests added in `tests/deployment-config.test.ts`.

Still required:
1. Verify the official Aave Simple Earn deployment SDK/API, supported Base configuration, and exact version.
2. Verify fee calculation, collection timing, protocol allocation, and recipient semantics from the actual SDK/contracts.
3. Implement the deployment adapter only after that verification.
4. Add contract-level tests for deposits, withdrawals, yield accounting, fee collection, fee recipient allocation, and permanently locked initial shares.
5. Run unit tests, build, and independent contract/security review.
6. Review the final deployment transaction and obtain explicit approval before any wallet action.

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
