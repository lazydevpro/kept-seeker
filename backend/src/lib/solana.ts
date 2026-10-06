import type { AppEnv } from "../types";

/**
 * The RPC endpoint to talk to.
 *
 * `PRIVATE_RPC_URL` is a secret because a paid provider's URL carries its API key
 * (Helius, Triton and QuickNode all put it in the path or query). When it is not
 * set, the public cluster URL from `wrangler.jsonc` is used — fine on devnet, and
 * not fine on mainnet at any volume: the public endpoint rate-limits
 * `getTransaction`, which is the call every purchase's verification rests on.
 */
export function rpcUrl(env: AppEnv): string {
  return env.PRIVATE_RPC_URL || env.SOLANA_RPC_URL;
}

/**
 * Wrapped SOL's mint, which is also how Jupiter and the shelf name native SOL.
 *
 * A swap into SOL wraps it in a temporary token account and closes that account
 * into the wallet inside the same transaction, so the wallet ends up holding plain
 * SOL and neither token-balance list shows it. Anything counting what a wallet
 * received has to read this mint from lamports instead.
 */
export const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";

/** SOL's decimals: one SOL is 10^9 lamports. */
export const SOL_DECIMALS = 9;
