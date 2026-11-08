import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const configUrl = new URL("../deployment/deployment-config.json", import.meta.url);
const config = JSON.parse(await readFile(configUrl, "utf8"));

const addressPattern = /^0x[0-9a-fA-F]{40}$/;
assert.equal(config.network.chainId, 8453, "must target Base mainnet");
assert.match(config.reserve.market, addressPattern, "Aave market must be an EVM address");
assert.match(config.reserve.underlyingToken, addressPattern, "EURC token must be an EVM address");
assert.equal(config.reserve.symbol, "EURC");
assert.equal(config.reserve.decimals, 6);
assert.equal(config.vault.owner, "0xc9afCD8eFAbee5A24f7a306bFc6108af4E337Ccb");
assert.match(config.vault.owner, addressPattern);
assert.equal(config.vault.shareName, "Y.L. Aave Eurc Vault Shares");
assert.equal(config.vault.shareSymbol, "ylEurc");
assert.equal(config.vault.initialFeePercent, 10);
assert.equal(config.vault.initialLockDeposit, "1.0");
assert.equal(config.vault.feeRecipients.length, 1);
assert.equal(config.vault.feeRecipients[0].address, config.vault.owner);
assert.equal(config.vault.feeRecipients[0].percent, 100);
assert.equal(config.feeModel.aaveLabsSharePercentOfTotalFee, 50);
assert.equal(config.feeModel.recipientPoolPercentOfTotalFee, 50);
assert.equal(config.feeModel.ownerSharePercentOfRecipientPool, 100);
assert.equal(config.deployment.deployerAddress, null, "deployer must be supplied at deployment time");
assert.equal(config.deployment.walletConnectionEnabled, false);
assert.equal(config.deployment.signingEnabled, false);
assert.equal(config.deployment.broadcastEnabled, false);
assert.equal(config.deployment.readyToDeploy, false);

console.log("Deployment configuration valid. No wallet, signing, or broadcast is enabled.");
