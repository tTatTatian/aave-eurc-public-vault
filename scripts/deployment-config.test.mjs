import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculateIllustrativeFeeSplit } from "./fee-model.mjs";

const config = JSON.parse(
  await readFile(new URL("../deployment/deployment-config.json", import.meta.url), "utf8")
);

test("vault is configured for Base EURC on Aave V3", () => {
  assert.equal(config.network.chainId, 8453);
  assert.equal(config.reserve.symbol, "EURC");
  assert.equal(config.reserve.decimals, 6);
  assert.equal(config.reserve.underlyingToken, "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42");
});

test("confirmed vault identity and owner are recorded exactly", () => {
  assert.equal(config.vault.owner, "0xc9afCD8eFAbee5A24f7a306bFc6108af4E337Ccb");
  assert.equal(config.vault.shareName, "Y.L. Aave Eurc Vault Shares");
  assert.equal(config.vault.shareSymbol, "ylEurc");
});

test("10% fee is based on yield and the sole owner recipient gets the recipient pool", () => {
  const split = calculateIllustrativeFeeSplit(100_000_000n);
  assert.equal(split.yieldAmount, 100_000_000n); // 100 EURC yield
  assert.equal(split.totalFee, 10_000_000n); // 10 EURC total fee
  assert.equal(split.aaveLabs, 5_000_000n); // 5 EURC
  assert.equal(split.owner, 5_000_000n); // 5 EURC
  assert.equal(split.depositorYieldAfterFee, 90_000_000n); // 90 EURC remains as depositor yield
});

test("initial lock deposit is exactly 1 EURC", () => {
  assert.equal(config.vault.initialLockDeposit, "1.0");
});

test("recipient allocation totals 100% and names only the owner", () => {
  assert.equal(config.vault.feeRecipients.length, 1);
  assert.equal(config.vault.feeRecipients[0].address, config.vault.owner);
  assert.equal(config.vault.feeRecipients[0].percent, 100);
});

test("deployment stays blocked until a deployer is supplied and separately approved", () => {
  assert.equal(config.deployment.deployerAddress, null);
  assert.equal(config.deployment.walletConnectionEnabled, false);
  assert.equal(config.deployment.signingEnabled, false);
  assert.equal(config.deployment.broadcastEnabled, false);
  assert.equal(config.deployment.readyToDeploy, false);
});

test("fee arithmetic rejects invalid amounts and fee rates", () => {
  assert.throws(() => calculateIllustrativeFeeSplit(-1n), RangeError);
  assert.throws(() => calculateIllustrativeFeeSplit(100n, 10_001n), RangeError);
});
