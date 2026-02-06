import * as core from "@actions/core";
import type { createChainNodeWebSDK, TxInput } from "@akashnetwork/chain-sdk/web";
import type { MsgCloseDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { ActionInputs } from "./inputs.js";

type ChainSDK = ReturnType<typeof createChainNodeWebSDK>;

export type Logger = Pick<typeof core, "info" | "warning" | "error">;

export interface CloseDeploymentResult {
  deploymentId: {
    owner: string;
    dseq: string;
  };
  txHash?: string;
}

export async function closeDeployment(
  sdk: ChainSDK,
  wallet: DirectSecp256k1HdWallet,
  inputs: ActionInputs,
  options?: {
    logger?: Logger;
  }
): Promise<CloseDeploymentResult> {
  const logger = options?.logger || core;

  const [account] = await wallet.getAccounts();
  logger.info(`Using account: ${account.address}`);

  const deploymentId = {
    owner: account.address,
    dseq: inputs.dseq,
  };

  logger.info(`Closing deployment: ${deploymentId.owner}/${deploymentId.dseq}`);

  const closeMessage: TxInput<MsgCloseDeployment> = {
    id: deploymentId,
  };

  const txOptions = buildTxOptions(inputs, "Deployment closed via GitHub Action");

  let txHash: string | undefined;
  await sdk.akash.deployment.v1beta4.closeDeployment(closeMessage, {
    ...txOptions,
    afterBroadcast(tx) {
      txHash = tx.transactionHash;
    },
  });

  logger.info(`Deployment closed successfully!`);

  return {
    deploymentId,
    txHash,
  };
}

function buildTxOptions(inputs: ActionInputs, memo: string) {
  const txOptions: {
    memo: string;
    fee?: { amount: { denom: string; amount: string }[]; gas: string };
    gasAdjustment?: number;
  } = {
    memo,
  };

  if (inputs.gas !== "auto") {
    txOptions.fee = {
      amount: [{ denom: inputs.denom, amount: inputs.fee || "0" }],
      gas: inputs.gas,
    };
  } else {
    txOptions.gasAdjustment = parseFloat(inputs.gasMultiplier);
  }

  return txOptions;
}
