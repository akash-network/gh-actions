import * as core from "@actions/core";

export interface ActionInputs {
  mnemonic: string;
  dseq: string;
  gas: string;
  gasMultiplier: string;
  fee: string;
  denom: string;
  queryRestUrl: string;
  txRpcUrl: string;
}

export function getInputs(): ActionInputs {
  const mnemonic = core.getInput("mnemonic", { required: true });
  const dseq = core.getInput("dseq", { required: true });
  const gas = core.getInput("gas") || "auto";
  const gasMultiplier = core.getInput("gas-multiplier") || "1.5";
  const fee = core.getInput("fee") || "";
  const denom = core.getInput("denom") || "uakt";
  const queryRestUrl = core.getInput("rest-url") || "https://rpc.akt.dev/rest";
  const txRpcUrl = core.getInput("tx-rpc-url") || "https://rpc.akt.dev/rpc";

  if (!dseq || !/^\d+$/.test(dseq)) {
    throw new Error("dseq must be a valid positive integer");
  }

  return {
    mnemonic,
    dseq,
    gas,
    gasMultiplier,
    fee,
    denom,
    queryRestUrl,
    txRpcUrl,
  };
}
