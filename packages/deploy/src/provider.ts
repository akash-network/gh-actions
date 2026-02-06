import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { Secp256k1HdWallet } from '@cosmjs/amino';
import { ExponentialBackoff, handleWhen, handleWhenResult, retry } from 'cockatiel';
import { JsonResponse } from './inputs';
import { Bid } from '@akashnetwork/chain-sdk/private-types/akash.v1beta5';
import { JwtTokenManager } from '@akashnetwork/chain-sdk';
import { QueryProviderResponse } from '@akashnetwork/chain-sdk/private-types/akash.v1beta4';

const HANDLE_WHEN = handleWhenResult((response) => {
  if (!response || !(response instanceof Response)) return false;
  return response.status >= 500;
}).orWhen(error => isNetworkError(error) || !!error.cause && isNetworkError(error.cause as ErrorWithCode));
const RETRY_POLICY = retry(HANDLE_WHEN, {
  backoff: new ExponentialBackoff({
    initialDelay: 1000,
    maxDelay: 10_000,
  }),
  maxAttempts: 5,
})

export async function sendManifest(input:{
  manifest: string,
  token: string,
  provider: JsonResponse<QueryProviderResponse>,
  dseq: string,
  fetch?: typeof globalThis.fetch,
}): Promise<Response> {
  const fetch = input.fetch || globalThis.fetch;
  return RETRY_POLICY.execute(async () => {
    return await fetch(`${input.provider.provider.hostUri}/deployment/${input.dseq}/manifest`, {
      method: "PUT",
      body: input.manifest,
      signal: AbortSignal.timeout(60_000),
      headers: {
        'Content-Type': 'application/json',
        "Authorization": `Bearer ${input.token}`,
      },
    });
  })
}

type ErrorWithCode = Error & { code: unknown };
function isNetworkError(error: Error): boolean {
  const code = (error as ErrorWithCode).code;
  return code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT" || code === "UND_ERR_SOCKET" || error.name === "AbortError";
}

export async function generateToken(wallet: DirectSecp256k1HdWallet, bid: JsonResponse<Bid>, services: string[]): Promise<string> {
  const aminoWallet = await Secp256k1HdWallet.fromMnemonic(wallet.mnemonic, { prefix: "akash" });
  const providerTokenManager = new JwtTokenManager(aminoWallet);
  console.dir({
    version: "v1",
    iss: bid?.id.owner!,
    exp: 5 * 60,
    leases: {
      access: "granular",
      permissions: [
        {
          access: "granular",
          provider: bid?.id?.provider!,
          deployments: [
            { dseq: Number(bid?.id?.dseq!), scope: ["send-manifest", "status"] }
          ]
        }
      ]
    }
  }, { depth: null });
  const token = await providerTokenManager.generateToken({
    version: "v1",
    iss: bid?.id.owner!,
    exp: 5 * 60,
    leases: {
      access: "granular",
      permissions: [
        {
          access: "granular",
          provider: bid?.id?.provider!,
          deployments: [
            { dseq: Number(bid?.id?.dseq!), services, scope: ["send-manifest", "status"] }
          ]
        }
      ]
    }
  });
  return token;
}

export async function getLeaseStatus(input:{
  token: string,
  provider: JsonResponse<QueryProviderResponse>,
  dseq: string,
  fetch?: typeof globalThis.fetch,
}): Promise<unknown> {
  const fetch = input.fetch || globalThis.fetch;
  const response = await RETRY_POLICY.execute(async () => {
    return await fetch(`${input.provider.provider.hostUri}/deployment/${input.dseq}/status`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${input.token}`,
      },
    });
  });

  return await response.json();
}
