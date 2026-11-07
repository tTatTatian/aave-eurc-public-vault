Aave EURC Public Vault

A public, non-custodial EURC yield vault on Base Mainnet, using Aave V3 as its initial and only yield strategy.

Project configuration

Setting| Value
Network| Base Mainnet
Chain ID| 8453
Protocol| Aave V3
Asset| EURC
Deposits| Public
Performance fee| 10% of yield
Leverage| Disabled
Borrowing| Disabled
Strategy| Aave V3 EURC supply only

Contract addresses

- EURC: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42"
- Aave V3 Pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5"
- Aave EURC aToken: "0x90DA57E0A6C0d166Bf15764E03b83745Dc90025B"

Fee policy

The initial performance fee is 10% of generated yield, not deposited principal.

The final fee-recipient configuration and any applicable protocol-level fee allocations must be verified before deployment.

Security principles

- No private keys or seed phrases are collected or stored.
- Wallet interaction is through MetaMask.
- No leverage or borrowing.
- No undisclosed fees.
- No transaction is signed or submitted without explicit user approval.
- Depositors must be able to review the vault's terms and risks.

Development status

Status: In development — not deployed.

Remaining work:

1. Integrate the official Aave Simple Earn deployment flow.
2. Verify the fee and recipient configuration.
3. Confirm vault name and share-token symbol.
4. Configure the owner/curator wallet.
5. Confirm the initial locked deposit.
6. Test deposits, withdrawals, and fee accounting.
7. Review and approve deployment.

Risks

Aave supply rates are variable and not guaranteed. Depositing involves smart-contract, protocol, liquidity, and market risks. The vault is not risk-free and does not guarantee returns.

---

No deployment or transactions are authorized by this documentation.