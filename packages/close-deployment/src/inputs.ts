import * as core from "@actions/core";
import { load as parseYaml } from "js-yaml";
import { guard } from "@ucast/mongo2js";
import type { LeaseStatus } from "@akashnetwork/actions-utils";

export interface DeploymentContext {
  dseq: string;
  state: 'invalid' | "active" | "insufficient_funds" | "closed";
  status: LeaseStatus;
  provider: string;
  createdAt: string;
  closedOn?: string;
  closedReason?: 'lease_closed_invalid' | "lease_closed_owner" | "lease_closed_unstable" | "lease_closed_decommission" | "lease_closed_unspecified" | "lease_closed_manifest_timeout" | "lease_closed_insufficient_funds";
}

export interface ActionInputs {
  mnemonic: string;
  deploymentFilter: {
    dseq?: string;
    state?: string;
  };
  leaseFilter?: (lease: DeploymentContext) => boolean;
  gas: string;
  gasMultiplier: string;
  fee: string;
  denom: string;
  queryRestUrl: string;
  txRpcUrl: string;
}

export function getInputs(): ActionInputs {
  const mnemonic = core.getInput("mnemonic", { required: true });
  const gas = core.getInput("gas") || "auto";
  const gasMultiplier = core.getInput("gas-multiplier") || "1.5";
  const fee = core.getInput("fee") || "";
  const denom = core.getInput("denom") || "uakt";
  const queryRestUrl = core.getInput("rest-url") || "https://rpc.akt.dev/rest";
  const txRpcUrl = core.getInput("tx-rpc-url") || "https://rpc.akt.dev/rpc";
  const { deploymentFilter, leaseFilter } = parseFilter(core.getInput("filter", { required: true }));

  return {
    mnemonic,
    gas,
    gasMultiplier,
    fee,
    denom,
    queryRestUrl,
    txRpcUrl,
    deploymentFilter,
    leaseFilter
  };
}

function parseFilter(filter: string) {
  if (filter === 'all') return { deploymentFilter: {} };

  try {
    const { lease: leaseFilter, dseq } = varlidateFilter(parseYaml(filter));

    if (!leaseFilter && !dseq) {
      throw new Error("At least one of dseq, state, or lease filter must be provided");
    }

    return {
      deploymentFilter: { dseq, state: "active" },
      leaseFilter: leaseFilter ? guard<DeploymentContext>(leaseFilter) : undefined
    };
  } catch (error) {
    core.setFailed(`Failed to parse filter input: ${error}`);
    throw error;
  }
}

function varlidateFilter(rawFilter: unknown): { lease?: Record<string, unknown>; dseq?: string } {
  if (!rawFilter || typeof rawFilter !== "object") {
    throw new Error(`"filter" input must be an object`);
  }

  const filter = rawFilter as Record<string, unknown>;
  if (filter.dseq !== undefined && typeof filter.dseq !== "string" && typeof filter.dseq !== "number") {
    throw new Error(`"dseq" filter must be a string or number if provided`);
  }

  if (filter.lease && typeof filter.lease !== "object") {
    throw new Error(`"lease" filter must be an object if provided`);
  }

  return filter;
}
