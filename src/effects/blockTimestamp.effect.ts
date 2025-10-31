import { experimental_createEffect, S } from 'envio';
import { chainIdSchema } from '../lib/chain';
import { getViemClient } from '../lib/viem';

/**
 * Effect to get block timestamp from RPC
 */
export const getBlockTimestamp = experimental_createEffect(
    {
        name: 'getBlockTimestamp',
        input: {
            chainId: chainIdSchema,
            blockNumber: S.bigint,
        },
        output: S.bigint,
        cache: true,
    },
    async ({ input, context }) => {
        const client = getViemClient(input.chainId, context.log);
        const block = await client.getBlock({ blockNumber: input.blockNumber });
        return BigInt(block.timestamp);
    }
);
