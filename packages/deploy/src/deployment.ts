import * as core from "@actions/core";
import { type DeploymentID, Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { MsgCreateDeployment, QueryProviderResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { Bid, MsgCreateLease, QueryBidsResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import {
  createChainNodeWebSDK,
  type QueryInput,
  SDL,
  type TxInput,
  v3Group,
} from "@akashnetwork/chain-sdk/web";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { ActionInputs, JsonResponse } from "./inputs.js";
import { generateToken, getLeaseStatus, sendManifest } from "./provider.js";

type ChainSDK = ReturnType<typeof createChainNodeWebSDK>;

/**
 * using globalThis.setTimeout to have possibility to mock it in tests
 */
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export type Logger = Pick<typeof core, "info" | "warning" | "error">;

export interface DeploymentResult {
  deploymentId: {
    owner: string;
    dseq: string;
  };
  lease?: {
    id: {
      owner: string;
      dseq: string;
      gseq: number;
      oseq: number;
      provider: string;
    };
    state: string;
    price: {
      amount: string;
      denom: string;
    };
  };
}

export async function createDeployment(sdk: ChainSDK, wallet: DirectSecp256k1HdWallet, inputs: ActionInputs, options?: {
  fetch?: typeof globalThis.fetch,
  logger?: Logger,
  generateToken?: typeof generateToken,
}): Promise<DeploymentResult> {
  const logger = options?.logger || core;
  const tokenGenerator = options?.generateToken || generateToken;
  logger.info("Parsing SDL...");
  const sdl = SDL.fromString(inputs.sdl, "beta3");

  const latestBlockResponse = await sdk.cosmos.base.tendermint.v1beta1.getLatestBlock();
  const dseq = latestBlockResponse.block?.header?.height!;

  logger.info(`Creating deployment with dseq: ${dseq}`);

  const [account] = await wallet.getAccounts();
  logger.info(`Using account: ${account.address}`);

  const deploymentMessage: TxInput<MsgCreateDeployment> = {
    id: {
      owner: account.address,
      dseq,
    },
    groups: sdl.groups(),
    hash: await sdl.manifestVersion(),
    deposit: {
      amount: {
        denom: inputs.denom,
        amount: inputs.deposit,
      },
      sources: [Source.balance],
    },
  };

  const txOptions = buildTxOptions(inputs, "Deployment created via GitHub Action");

  await sdk.akash.deployment.v1beta4.createDeployment(deploymentMessage, txOptions);
  logger.info("✅ Deployment created successfully!");

  const deploymentId: TxInput<DeploymentID> = {
    owner: account.address,
    dseq: deploymentMessage.id!.dseq,
  };

  const result: DeploymentResult = {
    deploymentId: {
      owner: deploymentId.owner,
      dseq: dseq.toString(),
    },
  };

  try {
    logger.info("Waiting for providers to create bids...");
    const selectedBid = await waitForBid(sdk, deploymentId, inputs.leaseTimeout, inputs.bidsFilter, logger);

    logger.info(
      `✅ Selected bid: Provider ${selectedBid?.id?.provider}, Price: ${selectedBid?.price?.amount}${selectedBid?.price?.denom}`
    );

    logger.info("Creating lease from selected bid...");
    const leaseMessage = MsgCreateLease.fromPartial({
      bidId: selectedBid?.id,
    });

    const leaseTxOptions = buildTxOptions(inputs, "Lease created via GitHub Action");
    await sdk.akash.market.v1beta5.createLease(leaseMessage, leaseTxOptions);
    logger.info("✅ Lease created successfully!");

    logger.info("Verifying lease creation...");
    const leaseQuery = await sdk.akash.market.v1beta5.getLeases({
      filters: {
        owner: deploymentId.owner,
        dseq: deploymentId.dseq,
        gseq: 1,
        oseq: 1,
        provider: selectedBid?.id.provider!,
        state: "active",
        bseq: 0,
      },
    });

    const createdLease = leaseQuery!.leases![0]!.lease!;
    result.lease = createdLease as unknown as DeploymentResult['lease'];
    logger.info(`✅ Lease verified: ${createdLease.id?.owner}/${createdLease.id?.dseq}/${createdLease.id?.gseq}/${createdLease.id?.oseq}/${createdLease.id?.provider}`);

    logger.info(`Prepare manifest submission (provider: ${createdLease.id?.provider})...`);
    const token = await tokenGenerator(wallet, selectedBid!, sdl.serviceNames());
    const provider = await sdk.akash.provider.v1beta4.getProvider({ owner: createdLease.id?.provider }) as unknown as JsonResponse<QueryProviderResponse>;
    logger.info(`Submitting manifest to provider: ${provider.provider.hostUri}`);
    await sendManifest({
      manifest: sdl.manifestSortedJSON(),
      token,
      provider,
      dseq: selectedBid?.id?.dseq!.toString(),
      fetch: options?.fetch,
    });
    logger.info("✅ Manifest submitted successfully!");

    logger.info(`Getting lease status...`);
    const leaseStatus = await getLeaseStatus({
      token,
      provider,
      dseq: selectedBid?.id?.dseq!.toString(),
      fetch: options?.fetch,
    });

    const services = Object.keys(leaseStatus.services).map(name => `${name}: ${leaseStatus.services[name].uris.join("\n")}`);

    logger.info(`🚀 Deployment is ready`);
    logger.info(services.join("\n"));
  } catch (error) {
    logger.error(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack: ${error.stack}`);
    }

    try {
      logger.info("Attempting to close deployment due to error...");
      await sdk.akash.deployment.v1beta4.closeDeployment({ id: deploymentId }, buildTxOptions(inputs, "Deployment close by GitHub Action because of error"));
      logger.info("Deployment closed successfully");
    } catch (closeError) {
      logger.warning(`Failed to close deployment: ${closeError instanceof Error ? closeError.message : String(closeError)}`);
    }

    throw error;
  }

  return result;
}

export async function waitForBid(
  sdk: ChainSDK,
  deploymentId: QueryInput<DeploymentID>,
  timeoutSeconds: number,
  findMatchingBid: ActionInputs['bidsFilter'],
  logger: Logger
): Promise<JsonResponse<Bid>> {
  const maxAttempts = Math.ceil(timeoutSeconds / 10);
  let attempts = 0;

  logger.info(`Deployment ID: ${deploymentId.owner}/${deploymentId.dseq}`);
  logger.info(`Will wait up to ${timeoutSeconds} seconds for bids...`);

  while (attempts < maxAttempts) {
    await wait(10_000);
    attempts++;

    logger.info(`Checking for bids (attempt ${attempts}/${maxAttempts})...`);

    const bidsResponse = await sdk.akash.market.v1beta5.getBids({
      filters: {
        owner: deploymentId.owner,
        dseq: deploymentId.dseq,
        gseq: 1,
        oseq: 1,
      },
      pagination: {
        limit: 1000,
      }
    }) as unknown as JsonResponse<QueryBidsResponse>

    const bidCount = bidsResponse?.bids?.length || 0;
    logger.info(`Found ${bidCount} bids`);
    if (bidCount === 0) {
      logger.info("No bids found, waiting for next attempt...");
      continue;
    }

    bidsResponse?.bids?.forEach((bidResponse, index) => {
      const bid = bidResponse.bid;
      logger.info(
        `  - Provider ${bid?.id?.provider}, Price: ${bid?.price?.amount}${bid?.price?.denom}`
      );
    });

    logger.info("Filtering bids by filter criteria...");
    const foundBid = findMatchingBid(bidsResponse?.bids!.map(bid => bid.bid!));

    if (!foundBid) {
      throw new Error("No bid found that matches the filter criteria.");
    }

    return foundBid;
  }

  throw new Error(`No bid found that matches the filter criteria after ${attempts} attempts.`);
}

function buildTxOptions(
  inputs: ActionInputs,
  memo: string
): { memo: string; fee?: { amount: { denom: string; amount: string }[]; gas: string }; gasAdjustment?: number } {
  const options: {
    memo: string;
    fee?: { amount: { denom: string; amount: string }[]; gas: string };
    gasAdjustment?: number;
  } = {
    memo,
  };

  if (inputs.gas !== "auto" && inputs.fee) {
    options.fee = {
      amount: [
        {
          denom: inputs.denom,
          amount: inputs.fee,
        },
      ],
      gas: inputs.gas,
    };
  } else {
    // When using auto gas, apply the multiplier
    options.gasAdjustment = parseFloat(inputs.gasMultiplier);
  }

  return options;
}
