import { createEffect, S } from 'envio';
import { chainIdSchema } from '../lib/chain';
import { getViemClient } from '../lib/viem';

/**
 * Effect to get block timestamp from RPC
 */
export const getBlockTimestamp = createEffect(
    {
        name: 'getBlockTimestamp',
        input: {
            chainId: chainIdSchema,
            blockNumber: S.bigint,
        },
        output: S.bigint,
        rateLimit: false,
        cache: true,
    },
    async ({ input, context }) => {
        try {
            const client = getViemClient(input.chainId, context.log);
            const block = await client.getBlock({ blockNumber: input.blockNumber });
            return BigInt(block.timestamp);
        } catch (error) {
            context.cache = false;
            throw error;
        }
    }
);
