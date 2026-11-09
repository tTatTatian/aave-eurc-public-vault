import {
  AaveClient,
  chainId,
  evmAddress,
  production
} from "@aave/client";
import { vault } from "@aave/client/actions";

const VAULT_ADDRESS = evmAddress(
  "0x56E70807df5e23eB628327c788De38C8f8dF95Bc"
);
const USER_ADDRESS = evmAddress(
  "0xc9afCD8eFAbee5A24f7a306bFc6108af4E337Ccb"
);

async function main() {
  // Use the same explicit production environment as the project's
  // existing Aave SDK preflight script. This is a read-only API request.
  const client = AaveClient.create({ environment: production });

  console.log("Reading Aave Simple Earn vault data (Base, chain 8453)...");
  console.log("Vault:", VAULT_ADDRESS);

  const request = vault(client, {
    by: { address: VAULT_ADDRESS },
    chainId: chainId(8453),
    user: USER_ADDRESS
  });

  // Fail with a useful message rather than appearing to hang indefinitely.
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(
      "Aave API request timed out after 30 seconds. Check the StackBlitz connection and retry."
    )), 30_000);
  });

  const result = await Promise.race([request, timeout]);

  if (result.isErr()) {
    throw new Error(`Aave API request failed: ${result.error.message}`);
  }

  if (!result.value) {
    console.log("Aave's data service returned no indexed vault for this address.");
    console.log("This does not mean the on-chain vault is missing.");
    process.exitCode = 2;
    return;
  }

  const json = JSON.stringify(result.value, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value, 2
  );

  console.log("\nAave Simple Earn vault response:\n");
  console.log(json);
}

main().catch((error) => {
  console.error("\nCould not retrieve vault data:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
