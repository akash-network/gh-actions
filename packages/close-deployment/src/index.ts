import * as core from "@actions/core";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { createChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import { createStargateClient } from "@akashnetwork/chain-sdk";
import { closeDeployment } from "./close-deployment.js";
import { getInputs } from "./inputs.js";

async function run(): Promise<void> {
  try {
    const inputs = getInputs();

    core.info("Initializing wallet...");
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(inputs.mnemonic, {
      prefix: "akash",
    });

    core.info("Connecting to Akash network...");
    const sdk = createChainNodeWebSDK({
      query: {
        baseUrl: inputs.queryRestUrl,
      },
      tx: {
        signer: createStargateClient({
          baseUrl: inputs.txRpcUrl,
          signer: wallet,
        }),
      },
    });

    const result = await closeDeployment(sdk, wallet, inputs);

    core.setOutput("deployment-id", `${result.deploymentId.owner}/${result.deploymentId.dseq}`);
    if (result.txHash) {
      core.setOutput("tx-hash", result.txHash);
    }

    core.info(`Successfully closed deployment: ${result.deploymentId.owner}/${result.deploymentId.dseq}`);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unknown error occurred");
    }
  }
}

run();
