# Deployment readiness — Aave EURC Public Vault

This repository is preparing to use Aave's official Simple Earn vault deployment flow. It is not a custom Solidity implementation.

## Confirmed configuration

- Network: Base Mainnet (chain ID 8453)
- Aave V3 market: `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`
- EURC: `0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42` (6 decimals)
- Owner: `0xc9afCD8eFAbee5A24f7a306bFc6108af4E337Ccb`
- Share name: `Y.L. Aave Eurc Vault Shares`
- Share symbol: `ylEurc`
- Initial performance fee: 10% of yield
- Initial lock deposit: 1 EURC (1,000,000 raw units), permanently locked
- Strategy: supply EURC to the selected Aave V3 reserve only; no borrowing or leverage
- Fee recipients: owner wallet receives 100% of the recipient pool

## Fee split

Aave's documented Simple Earn deployment flow allocates 50% of total fee revenue to Aave Labs. The remaining 50% is allocated according to the configured recipient percentages. With the owner as the sole recipient at 100%, the illustrative result is:

- Depositor yield: 90% of generated yield after a 10% performance fee
- Aave Labs: 5% of generated yield
- Owner: 5% of generated yield

For example, on 100 EURC of generated yield, the total fee is 10 EURC: 5 EURC to Aave Labs and 5 EURC to the owner. The deposit principal is not the fee basis.

The helper in `scripts/fee-model.mjs` is arithmetic for tests and documentation only. It does not calculate on-chain accrued fees or replace Aave's implementation.

## Deployment request fields

The official Aave request needs a deployer address supplied by the connected wallet at deployment time. The owner is separately configured and may be different from the deployer. This repository deliberately leaves `deployerAddress` null until the user chooses and verifies the deployment wallet.

The deployment config is a specification, not a transaction. No wallet connection, allowance, signature, transaction request, or broadcast is enabled.

## Required gates before deployment

1. Re-read the Base EURC reserve immediately before deployment and confirm it is active, not frozen or paused, and still supports supply.
2. Verify the official `@aave/react` / AaveKit SDK version and the exact `VaultDeployRequest` fields against the current official deployment guide.
3. Confirm the connected deployer address and chain ID; verify whether the deployer is also the configured owner.
4. Confirm the SDK encodes 10% as the intended percentage and that the recipient array is interpreted as percentages of the non-Aave recipient pool.
5. Verify that 1 EURC is available for the permanently locked initial deposit, plus gas.
6. Review the complete unsigned deployment plan and any required approval transaction separately.
7. Obtain explicit approval for each transaction before any wallet signing or broadcast.

## Tests

- `npm test`: runs local Node.js tests for the recorded configuration and illustrative fee arithmetic.
- `npm run validate:deployment`: validates required fields and confirms deployment remains disabled.

These are configuration tests, not a Solidity audit, Aave SDK integration test, fork test, or on-chain simulation.
