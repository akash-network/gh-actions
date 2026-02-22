import { CreateJWTOptions, JwtTokenManager } from '@akashnetwork/chain-sdk';
import type { QueryProviderResponse } from '@akashnetwork/chain-sdk/private-types/akash.v1beta4';
import type { Bid } from '@akashnetwork/chain-sdk/private-types/akash.v1beta5';
import { Secp256k1HdWallet } from '@cosmjs/amino';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { ExponentialBackoff, handleWhenResult, retry } from 'cockatiel';
import type Long from 'long';

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
  providerHostUri: string,
  dseq: string,
  fetch?: typeof globalThis.fetch,
}): Promise<Response> {
  const fetch = input.fetch || globalThis.fetch;
  const response = await RETRY_POLICY.execute(async () => {
    return await fetch(`${input.providerHostUri}/deployment/${input.dseq}/manifest`, {
      method: "PUT",
      body: input.manifest,
      signal: AbortSignal.timeout(60_000),
      headers: {
        'Content-Type': 'application/json',
        "Authorization": `Bearer ${input.token}`,
      },
    });
  });

  if (response.status > 300) {
    throw new Error(`Failed to send manifest: ${response.status} ${await response.text()}`);
  }

  return response;
}

type ErrorWithCode = Error & { code: unknown };
function isNetworkError(error: Error): boolean {
  const code = (error as ErrorWithCode).code;
  return code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT" || code === "UND_ERR_SOCKET" || error.name === "AbortError";
}

export async function generateToken(wallet: DirectSecp256k1HdWallet, genPermissions: () => CreateJWTOptions['leases']): Promise<string> {
  const aminoWallet = await Secp256k1HdWallet.fromMnemonic(wallet.mnemonic, { prefix: "akash" });
  const [account] = await wallet.getAccounts();
  const providerTokenManager = new JwtTokenManager(aminoWallet);
  const token = await providerTokenManager.generateToken({
    version: "v1",
    iss: account.address,
    exp: Math.floor((Date.now() / 1000) + 5 * 60),
    leases: genPermissions()
  });
  return token;
}

export async function getLeaseStatus(input:{
  token: string,
  providerHostUri: string ,
  dseq: string,
  fetch?: typeof globalThis.fetch,
}): Promise<LeaseStatus> {
  const fetch = input.fetch || globalThis.fetch;
  const response = await RETRY_POLICY.execute(async () => {
    return await fetch(`${input.providerHostUri}/lease/${input.dseq}/1/1/status`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${input.token}`,
      },
    });
  });

  if (response.status > 300) {
    throw new Error(`Failed to get lease status: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as LeaseStatus;
}

export interface LeaseStatus {
  services: Record<string, {
    name: string;
    available: number;
    total: number;
    uris: string[];
  }>;
}

export type JsonResponse<T> = {
  [K in keyof T]: T[K] extends Long | Uint8Array | Buffer | ArrayBuffer
    ? string
    : Exclude<T[K], undefined> extends any[]
      ? JsonResponse<Exclude<T[K], undefined>[number]>[]
      : Exclude<T[K], undefined> extends Record<string, any>
        ? JsonResponse<Exclude<T[K], undefined>>
        : T[K];
};
