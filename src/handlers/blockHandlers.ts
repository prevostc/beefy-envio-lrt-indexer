import { experimental_createEffect, S } from 'envio';
import { onBlock } from 'generated';
import { getAllBeefyVaultsForChain } from '../entities/beefyVault.entity';
import { createClockTick, getClockTick } from '../entities/clockTick.entity';
import { chainIdSchema, toChainId } from '../lib/chain';
import { updateVaultAndInvestorBreakdowns } from '../lib/investorPositionBreakdown';
import { getViemClient } from '../lib/viem';

/**
 * Round timestamp to the nearest 15-minute interval (900 seconds)
 */
const roundToNearest15Minutes = (timestamp: bigint): bigint => {
    const period = 900n; // 15 minutes in seconds
    return (timestamp / period) * period;
};

/**
 * Block handler configuration per chain
 * Interval is calculated to run approximately every 5 minutes
 * Based on average block times:
 * - Ethereum: ~12s per block → 5min = 300s / 12s = 25 blocks
 * - Arbitrum: ~0.25s per block → 5min = 300s / 0.25s = 1200 blocks
 * - Base: ~2s per block → 5min = 300s / 2s = 150 blocks
 * - BSC: ~3s per block → 5min = 300s / 3s = 100 blocks
 * - Optimism: ~2s per block → 5min = 300s / 2s = 150 blocks
 * - Linea: ~2s per block → 5min = 300s / 2s = 150 blocks
 * - Mode: ~2s per block → 5min = 300s / 2s = 150 blocks
 * - Sonic: ~1s per block → 5min = 300s / 1s = 300 blocks
 * - HyperEVM: variable, using 2s as approximation → 150 blocks
 */
const BLOCK_HANDLER_CONFIG = [
    { chain: 1 as const, interval: 25 }, // Ethereum
    { chain: 42161 as const, interval: 1200 }, // Arbitrum
    { chain: 8453 as const, interval: 150 }, // Base
    { chain: 56 as const, interval: 100 }, // BSC
    { chain: 10 as const, interval: 150 }, // Optimism
    { chain: 59144 as const, interval: 150 }, // Linea
    { chain: 34443 as const, interval: 150 }, // Mode
    { chain: 146 as const, interval: 300 }, // Sonic
    { chain: 999 as const, interval: 150 }, // HyperEVM
] as const;

const PERIOD_15_MINUTES = 900n; // 15 minutes in seconds

/**
 * Effect to get block timestamp from RPC
 */
const getBlockTimestamp = experimental_createEffect(
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

BLOCK_HANDLER_CONFIG.forEach(({ chain, interval }) => {
    onBlock(
        {
            name: `ClockTickHandler-${chain}`,
            chain,
            interval,
        },
        async ({ block, context }) => {
            if (context.isPreload) return;

            const chainId = toChainId(chain);
            const blockNumber = BigInt(block.number);

            // Get block timestamp from RPC (not available in block object yet)
            const blockTimestamp = await context.effect(getBlockTimestamp, {
                chainId,
                blockNumber,
            });

            // Round timestamp to nearest 15-minute interval
            const roundedTimestamp = roundToNearest15Minutes(blockTimestamp);

            // Check if ClockTick already exists for this period
            const existingClockTick = await getClockTick({
                context,
                chainId,
                roundedTimestamp,
                period: PERIOD_15_MINUTES,
            });

            if (existingClockTick) {
                context.log.debug('ClockTick already exists for this period', {
                    chainId: chain,
                    roundedTimestamp: roundedTimestamp.toString(),
                });
                return;
            }

            context.log.info('Creating new ClockTick and updating vault breakdowns', {
                chainId: chain,
                roundedTimestamp: roundedTimestamp.toString(),
                blockNumber: blockNumber.toString(),
                blockTimestamp: blockTimestamp.toString(),
            });

            // Create ClockTick entity
            await createClockTick({
                context,
                chainId,
                roundedTimestamp,
                period: PERIOD_15_MINUTES,
                timestamp: blockTimestamp,
                blockNumber,
            });

            // Fetch all vaults for this chain
            const vaults = await getAllBeefyVaultsForChain({ context, chainId });

            context.log.info(`Found ${vaults.length} vaults to update`, {
                chainId: chain,
            });

            // Update breakdown for each vault and all its investor positions
            for (const vault of vaults) {
                try {
                    await updateVaultAndInvestorBreakdowns({
                        context,
                        chainId,
                        vault,
                        blockNumber,
                        blockTimestamp,
                    });
                } catch (error) {
                    context.log.error('Failed to update vault breakdown', {
                        chainId: chain,
                        vaultId: vault.id,
                        error: error instanceof Error ? error.message : String(error),
                    });
                    // Continue with other vaults even if one fails
                }
            }

            context.log.info('Completed vault breakdown updates for ClockTick', {
                chainId: chain,
                roundedTimestamp: roundedTimestamp.toString(),
                vaultCount: vaults.length,
            });
        }
    );
});
