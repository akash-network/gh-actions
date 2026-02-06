import type { createChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";
import { closeDeployment, type Logger } from "./close-deployment.js";
import type { ActionInputs } from "./inputs.js";

type ChainSDK = ReturnType<typeof createChainNodeWebSDK>;

describe(closeDeployment.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("closes deployment and returns deployment ID", async () => {
    const { sdk, wallet, inputs, ownerAddress } = await setup();

    const result = await closeDeployment(sdk, wallet, inputs, { logger: mock<Logger>() });

    expect(result.deploymentId.owner).toBe(ownerAddress);
    expect(result.deploymentId.dseq).toBe("12345");
  });

  it("calls closeDeployment with correct parameters", async () => {
    const { sdk, wallet, inputs, ownerAddress } = await setup();

    await closeDeployment(sdk, wallet, inputs, { logger: mock<Logger>() });

    expect(sdk.akash.deployment.v1beta4.closeDeployment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: {
          owner: ownerAddress,
          dseq: "12345",
        },
      }),
      expect.objectContaining({
        memo: "Deployment closed via GitHub Action",
      })
    );
  });

  it("uses auto gas with multiplier by default", async () => {
    const { sdk, wallet, inputs } = await setup();

    await closeDeployment(sdk, wallet, inputs, { logger: mock<Logger>() });

    expect(sdk.akash.deployment.v1beta4.closeDeployment).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        gasAdjustment: 1.5,
      })
    );
  });

  it("includes custom fee when gas is not auto", async () => {
    const { sdk, wallet, inputs } = await setup({
      inputOverrides: { gas: "200000", fee: "5000" },
    });

    await closeDeployment(sdk, wallet, inputs, { logger: mock<Logger>() });

    expect(sdk.akash.deployment.v1beta4.closeDeployment).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        fee: {
          amount: [{ denom: "uakt", amount: "5000" }],
          gas: "200000",
        },
      })
    );
  });

  it("uses custom denom from inputs", async () => {
    const { sdk, wallet, inputs } = await setup({
      inputOverrides: { gas: "200000", fee: "1000", denom: "uusd" },
    });

    await closeDeployment(sdk, wallet, inputs, { logger: mock<Logger>() });

    expect(sdk.akash.deployment.v1beta4.closeDeployment).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        fee: {
          amount: [{ denom: "uusd", amount: "1000" }],
          gas: "200000",
        },
      })
    );
  });

  it("returns transaction hash when available", async () => {
    const { sdk, wallet, inputs } = await setup({
      txHash: "ABC123TXHASH",
    });

    const result = await closeDeployment(sdk, wallet, inputs, { logger: mock<Logger>() });

    expect(result.txHash).toBe("ABC123TXHASH");
  });

  it("handles different dseq values", async () => {
    const { sdk, wallet, inputs, ownerAddress } = await setup({
      inputOverrides: { dseq: "99999" },
    });

    const result = await closeDeployment(sdk, wallet, inputs, { logger: mock<Logger>() });

    expect(result.deploymentId.dseq).toBe("99999");
    expect(sdk.akash.deployment.v1beta4.closeDeployment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: {
          owner: ownerAddress,
          dseq: "99999",
        },
      }),
      expect.any(Object)
    );
  });

  async function setup(input?: {
    inputOverrides?: Partial<ActionInputs>;
    txHash?: string;
  }) {
    const sdk = mockDeep<ChainSDK>();
    const wallet = await DirectSecp256k1HdWallet.generate(12, { prefix: "akash" });
    const [account] = await wallet.getAccounts();
    const ownerAddress = account.address;

    sdk.akash.deployment.v1beta4.closeDeployment.mockImplementation(async (_, options) => {
      if (input?.txHash && options?.afterBroadcast) {
        options.afterBroadcast({ transactionHash: input.txHash } as any);
      }
      return {};
    });

    const inputs: ActionInputs = {
      mnemonic: wallet.mnemonic,
      dseq: "12345",
      gas: "auto",
      gasMultiplier: "1.5",
      fee: "",
      denom: "uakt",
      queryRestUrl: "https://rpc.test/rest",
      txRpcUrl: "https://rpc.test/rpc",
      ...input?.inputOverrides,
    };

    return { sdk, wallet, inputs, ownerAddress };
  }
});
