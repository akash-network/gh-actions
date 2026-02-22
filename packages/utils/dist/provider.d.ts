import { CreateJWTOptions } from '@akashnetwork/chain-sdk';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import type Long from 'long';
export declare function sendManifest(input: {
    manifest: string;
    token: string;
    providerHostUri: string;
    dseq: string;
    fetch?: typeof globalThis.fetch;
}): Promise<Response>;
export declare function generateToken(wallet: DirectSecp256k1HdWallet, genPermissions: () => CreateJWTOptions['leases']): Promise<string>;
export declare function getLeaseStatus(input: {
    token: string;
    providerHostUri: string;
    dseq: string;
    fetch?: typeof globalThis.fetch;
}): Promise<LeaseStatus>;
export interface LeaseStatus {
    services: Record<string, {
        name: string;
        available: number;
        total: number;
        uris: string[];
    }>;
}
export type JsonResponse<T> = {
    [K in keyof T]: T[K] extends Long | Uint8Array | Buffer | ArrayBuffer ? string : Exclude<T[K], undefined> extends any[] ? JsonResponse<Exclude<T[K], undefined>[number]>[] : Exclude<T[K], undefined> extends Record<string, any> ? JsonResponse<Exclude<T[K], undefined>> : T[K];
};
//# sourceMappingURL=provider.d.ts.map