import * as core from "@actions/core";
import { createDeployment } from "./deployment.ts";
import { getInputs } from "./inputs.ts";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { createChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import { createStargateClient } from "@akashnetwork/chain-sdk";

async function run(): Promise<void> {
  try {
    core.info("Starting Akash deployment action...");

    const inputs = getInputs();

    core.info("Creating deployment on Akash Network...");
    core.info("Initializing wallet...");
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(inputs.mnemonic, {
      prefix: "akash",
    });

    core.info("Initializing Akash Chain SDK...");
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

    const result = await createDeployment(sdk, wallet, inputs);

    core.setOutput("deployment-id", `${result.deploymentId.owner}/${result.deploymentId.dseq}`);
    core.setOutput("dseq", result.deploymentId.dseq.toString());

    if (result.lease) {
      core.setOutput(
        "lease-id",
        `${result.lease.id.owner}/${result.lease.id.dseq}/${result.lease.id.gseq}/${result.lease.id.oseq}/${result.lease.id.provider}`
      );
      core.setOutput("provider", result.lease.id.provider);
      core.setOutput("lease-status", result.lease.state);
    }

    core.info("Deployment completed successfully!");
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unexpected error occurred");
    }
  }
}

run();
