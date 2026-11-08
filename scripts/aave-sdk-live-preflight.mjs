import {
  AaveClient,
  bigDecimal,
  chainId,
  evmAddress,
  production
} from "@aave/client";
import { reserve, vaultDeploy } from "@aave/client/actions";

const config = {
  market: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
  token: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42",
  chainId: 8453,
  owner: "0xc9afCD8eFAbee5A24f7a306bFc6108af4E337Ccb",
  deployer: "0xc9afCD8eFAbee5A24f7a306bFc6108af4E337Ccb",
  shareName: "Y.L. Aave Eurc Vault Shares",
  shareSymbol: "ylEurc",
  feePercent: "10",
  initialLockDeposit: "1",
  recipientPercent: "100"
};

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

async function main() {
  if (config.owner.toLowerCase() !== config.deployer.toLowerCase()) {
    throw new Error("Owner/deployer mismatch.");
  }

  const client = AaveClient.create({ environment: production });
  const market = evmAddress(config.market);
  const token = evmAddress(config.token);
  const network = chainId(config.chainId);

  console.log("Checking live Base EURC reserve with official Aave SDK…");
  const reserveResult = await reserve(client, {
    market,
    underlyingToken: token,
    chainId: network
  });

  if (reserveResult.isErr()) {
    throw new Error(`Reserve query failed: ${reserveResult.error.message}`);
  }

  const liveReserve = reserveResult.value;
  if (!liveReserve) throw new Error("Aave returned no matching reserve.");
  if (
    liveReserve.underlyingToken.address.toLowerCase() !== config.token.toLowerCase() ||
    liveReserve.underlyingToken.decimals !== 6 ||
    liveReserve.market.address.toLowerCase() !== config.market.toLowerCase()
  ) {
    throw new Error("Live reserve identity/decimals mismatch.");
  }
  if (liveReserve.isPaused || liveReserve.isFrozen) {
    throw new Error("Reserve is paused or frozen.");
  }
  if (!liveReserve.supplyInfo || liveReserve.supplyInfo.supplyCapReached) {
    throw new Error("Reserve supply unavailable or supply cap reached.");
  }
  console.log("PASS: live reserve identity, decimals, and supply status verified.");

  console.log("Requesting unsigned deployment plan from Aave SDK…");
  const deployResult = await vaultDeploy(client, {
    underlyingToken: token,
    market,
    chainId: network,
    deployer: evmAddress(config.deployer),
    owner: evmAddress(config.owner),
    initialFee: bigDecimal(config.feePercent),
    shareName: config.shareName,
    shareSymbol: config.shareSymbol,
    initialLockDeposit: bigDecimal(config.initialLockDeposit),
    recipients: [{
      address: evmAddress(config.owner),
      percent: bigDecimal(config.recipientPercent)
    }]
  });

  if (deployResult.isErr()) {
    throw new Error(`Aave SDK rejected the deployment request: ${deployResult.error.message}`);
  }

  const plan = deployResult.value;
  console.log(`SDK_PLAN_TYPE=${plan.__typename}`);
  if (plan.__typename === "ApprovalRequired") {
    console.log("RESULT: API accepted configuration; an approval would be required.");
  } else if (plan.__typename === "TransactionRequest") {
    console.log("RESULT: API accepted configuration; a deployment transaction request was prepared.");
  } else if (plan.__typename === "InsufficientBalanceError") {
    console.log("RESULT: deployment configuration reached the API, but the deployer balance is insufficient for the required amount.");
    fail("Insufficient deployer balance for deployment plan.");
  } else {
    console.log("RESULT: SDK returned an unrecognized plan type; manual review required.");
    fail("Unrecognized SDK plan type.");
  }

  console.log("SAFETY: No wallet connected. No approval, signing, or transaction submission performed.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Unknown preflight failure.");
});
