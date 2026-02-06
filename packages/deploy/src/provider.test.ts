import { describe, it, expect, vi } from "vitest";
import { sendManifest, getLeaseStatus, generateToken } from "./provider.js";
import type { JsonResponse } from "./inputs.js";
import type { Bid } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { QueryProviderResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { JwtTokenManager } from "@akashnetwork/chain-sdk";
import { mock } from "vitest-mock-extended";

describe(sendManifest.name, () => {
  it("sends manifest to correct URL with PUT method", async () => {
    const { provider, fetch } = setup();
    const manifest = JSON.stringify({ services: { web: { image: "nginx" } } });

    await sendManifest({
      manifest,
      token: "test-jwt-token",
      provider,
      dseq: "12345",
      fetch,
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://provider.akash.test/deployment/12345/manifest",
      expect.objectContaining({
        method: "PUT",
        body: manifest,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-jwt-token",
        },
      })
    );
  });

  it("includes abort signal with timeout", async () => {
    const { provider, fetch } = setup();

    await sendManifest({
      manifest: "{}",
      token: "token",
      provider,
      dseq: "12345",
      fetch,
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("retries on 5xx server errors", async () => {
    vi.useFakeTimers();

    const { provider } = setup();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("Server Error", { status: 500 }))
      .mockResolvedValueOnce(new Response("Server Error", { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    const promise = sendManifest({
      manifest: "{}",
      token: "token",
      provider,
      dseq: "12345",
      fetch,
    });

    const [, result] = await Promise.all([vi.runAllTimersAsync(), promise]);
    vi.useRealTimers();

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.status).toBe(200);
  });

  it("does not retry on 4xx client errors", async () => {
    const { provider } = setup();
    const fetch = vi.fn().mockResolvedValue(new Response("Bad Request", { status: 400 }));

    const result = await sendManifest({
      manifest: "{}",
      token: "token",
      provider,
      dseq: "12345",
      fetch,
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(400);
  });

  it("retries on network errors", async () => {
    vi.useFakeTimers();
    const { provider } = setup();
    const networkError = new Error("Connection refused");
    (networkError as any).code = "ECONNREFUSED";

    const fetch = vi
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    const promise = sendManifest({
      manifest: "{}",
      token: "token",
      provider,
      dseq: "12345",
      fetch,
    });

    const [, result] = await Promise.all([vi.runAllTimersAsync(), promise]);
    vi.useRealTimers();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(200);
  });

  it("returns response on success", async () => {
    const { provider } = setup();
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ deployed: true }), { status: 200 })
    );

    const result = await sendManifest({
      manifest: "{}",
      token: "token",
      provider,
      dseq: "12345",
      fetch,
    });

    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(200);
  });

  function setup(input?: { hostUri?: string }) {
    const provider: JsonResponse<QueryProviderResponse> = {
      provider: {
        owner: "akash1provider123",
        hostUri: input?.hostUri ?? "https://provider.akash.test",
        attributes: [],
        info: {
          email: "test@test.com",
          website: "https://test.com",
        },
      },
    };

    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    return { provider, fetch };
  }
});

describe(getLeaseStatus.name, () => {
  it("fetches lease status from correct URL with GET method", async () => {
    const { provider, fetch } = setup({
      statusResponse: {
        services: {
          web: { name: "web", available: 1, total: 1, uris: ["http://example.com"] },
        },
      },
    });

    await getLeaseStatus({
      token: "test-jwt-token",
      provider,
      dseq: "12345",
      fetch,
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://provider.akash.test/deployment/12345/status",
      expect.objectContaining({
        method: "GET",
        headers: {
          Authorization: "Bearer test-jwt-token",
        },
      })
    );
  });

  it("returns parsed JSON response", async () => {
    const statusResponse = {
      services: {
        web: { name: "web", available: 1, total: 1, uris: ["http://app.example.com"] },
      },
      forwarded_ports: {},
    };

    const { provider, fetch } = setup({ statusResponse });

    const result = await getLeaseStatus({
      token: "token",
      provider,
      dseq: "12345",
      fetch,
    });

    expect(result).toEqual(statusResponse);
  });

  it("retries on 5xx server errors", async () => {
    vi.useFakeTimers();
    const { provider } = setup();
    const statusResponse = { services: {} };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("Server Error", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(statusResponse), { status: 200 }));

    const promise = getLeaseStatus({
      token: "token",
      provider,
      dseq: "12345",
      fetch,
    });

    const [, result] = await Promise.all([vi.runAllTimersAsync(), promise]);
    vi.useRealTimers();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual(statusResponse);
  });

  it("retries on connection reset errors", async () => {
    vi.useFakeTimers();
    const { provider } = setup();
    const networkError = new Error("Connection reset");
    (networkError as any).code = "ECONNRESET";

    const statusResponse = { services: {} };
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(new Response(JSON.stringify(statusResponse), { status: 200 }));

    vi.useFakeTimers();
    const promise = getLeaseStatus({
      token: "token",
      provider,
      dseq: "12345",
      fetch,
    });

    const [, result] = await Promise.all([vi.runAllTimersAsync(), promise]);
    vi.useRealTimers();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual(statusResponse);
  });

  function setup(input?: { statusResponse?: unknown }) {
    const provider: JsonResponse<QueryProviderResponse> = {
      provider: {
        owner: "akash1provider123",
        hostUri: "https://provider.akash.test",
        attributes: [],
        info: {
          email: "test@test.com",
          website: "https://test.com",
        },
      },
    };

    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(input?.statusResponse ?? { services: {} }), { status: 200 })
    );

    return { provider, fetch };
  }
});
