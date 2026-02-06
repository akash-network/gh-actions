import * as core from "@actions/core";
import * as fs from "node:fs";
import * as path from "node:path";
import { guard as createFilter } from "@ucast/mongo2js";
import type { Bid } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";

export interface ActionInputs {
  mnemonic: string;
  selectBid: (bids: JsonResponse<Bid>[]) => JsonResponse<Bid> | undefined;
  sdl: string;
  gas: string;
  gasMultiplier: string;
  fee: string;
  denom: string;
  deposit: string;
  queryRestUrl: string;
  txRpcUrl: string;
  leaseTimeout: number;
}

type SelectBidStrategy = "cheapest" | "first";

export function getInputs(): ActionInputs {
  const sdlInput = core.getInput("sdl", { required: true });
  const sdl = resolveSdl(sdlInput);
  const bidConditions = core.getInput("bid-filter");
  const pickBidStrategy = core.getInput("pick-bid-strategy") as SelectBidStrategy || "cheapest";

  return {
    mnemonic: core.getInput("mnemonic", { required: true }),
    selectBid: createBidsFilter(bidConditions, pickBidStrategy),
    sdl,
    gas: core.getInput("gas") || "auto",
    gasMultiplier: core.getInput("gas-multiplier") || "1.5",
    fee: core.getInput("fee") || "",
    denom: core.getInput("denom") || "uakt",
    deposit: core.getInput("deposit") || "500000",
    queryRestUrl: core.getInput("rest-url") || "https://rpc.akt.dev/rest",
    txRpcUrl: core.getInput("tx-rpc-url") || "https://rpc.akt.dev/rpc",
    leaseTimeout: parseInt(core.getInput("lease-timeout") || "180", 10),
  };
}

function resolveSdl(sdlInput: string): string {
  const trimmed = sdlInput.trim();

  if (
    trimmed.startsWith("./") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("../") ||
    (trimmed.endsWith(".yaml") || trimmed.endsWith(".yml")) && !trimmed.includes("\n")
  ) {
    const resolvedPath = path.resolve(process.cwd(), trimmed);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`SDL file not found: ${resolvedPath}`);
    }

    core.info(`Loading SDL from file: ${resolvedPath}`);
    return fs.readFileSync(resolvedPath, "utf-8");
  }

  core.info("Using inline SDL string");
  return trimmed;
}

function createBidsFilter(bidConditions: string, pickBidStrategy: SelectBidStrategy): ActionInputs['selectBid'] {
  const filter = bidConditions ? createFilter<JsonResponse<Bid>>(JSON.parse(bidConditions)) : undefined;
  return (bids: JsonResponse<Bid>[]) => {
    const filteredBids = filter ? bids.filter(bid => filter(bid)) : bids;
    switch (pickBidStrategy) {
      case "first":
        return filteredBids[0];

      case "cheapest":
      default:
        return filteredBids.sort((a, b) => {
          const diff = parseFloat(a.price!.amount!) - parseFloat(b.price!.amount!);
          if (diff === 0) return 0;
          return diff > 0 ? 1 : -1;
        })[0];
    }
  };
}

export type JsonResponse<T> = {
  [K in keyof T]: T[K] extends import('long') | Uint8Array | Buffer | ArrayBuffer
    ? string
    : Exclude<T[K], undefined> extends any[]
      ? JsonResponse<Exclude<T[K], undefined>[number]>[]
      : Exclude<T[K], undefined> extends Record<string, any>
        ? JsonResponse<Exclude<T[K], undefined>>
        : T[K];
};
