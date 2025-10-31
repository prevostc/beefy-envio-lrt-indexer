import { onBlock } from 'generated';
import * as R from 'remeda';
import { getBlockTimestamp } from '../effects/blockTimestamp.effect';
import { getAllBeefyVaultsForChain } from '../entities/beefyVault.entity';
import { createClockTick, getClockTick } from '../entities/clockTick.entity';
import { allChainIds, MS_BETWEEN_BLOCKS } from '../lib/chain';
import { updateVaultAndInvestorBreakdowns } from '../lib/investorPositionBreakdown';

/**
 * Round timestamp to the nearest 15-minute interval (900 seconds)
 */
const roundToClockPeriod = (timestamp: bigint): bigint => {
    const period = CLOCK_PERIOD_SEC;
    return (timestamp / period) * period;
};

const CLOCK_PERIOD_SEC = 60n * 60n; // 1 hour in seconds

R.pipe(
    allChainIds,
    R.map((chainId) => [chainId, MS_BETWEEN_BLOCKS[chainId]] as const),
    R.map(
        ([chainId, msBetweenBlocks]) => [chainId, Number(CLOCK_PERIOD_SEC / (BigInt(msBetweenBlocks) / 1000n))] as const
    ),
    R.forEach(([chainId, interval]) => {
        onBlock({ name: `ClockTickHandler-${chainId}`, chain: chainId, interval }, async ({ block, context }) => {
            // Get block timestamp from RPC (not available in block object yet)
            const blockNumber = BigInt(block.number);
            const blockTimestamp = await context.effect(getBlockTimestamp, {
                chainId,
                blockNumber,
            });

            if (context.isPreload) return;

            // Round timestamp to nearest 15-minute interval
            const roundedTimestamp = roundToClockPeriod(blockTimestamp);

            // Check if ClockTick already exists for this period
            const existingClockTick = await getClockTick({
                context,
                chainId,
                roundedTimestamp,
                period: CLOCK_PERIOD_SEC,
            });

            if (existingClockTick) {
                context.log.debug('ClockTick already exists for this period', {
                    chainId,
                    roundedTimestamp: roundedTimestamp.toString(),
                });
                return;
            }

            context.log.info('Creating new ClockTick and updating vault breakdowns', {
                chainId,
                roundedTimestamp: roundedTimestamp.toString(),
                blockNumber: blockNumber.toString(),
                blockTimestamp: blockTimestamp.toString(),
            });

            // Create ClockTick entity
            await createClockTick({
                context,
                chainId,
                roundedTimestamp,
                period: CLOCK_PERIOD_SEC,
                timestamp: blockTimestamp,
                blockNumber,
            });

            // Fetch all vaults for this chain
            const vaults = await getAllBeefyVaultsForChain({ context, chainId });

            context.log.info(`Found ${vaults.length} vaults to update`, {
                chainId,
            });

            // Update breakdown for each vault and all its investor positions
            await Promise.all(
                vaults.map(async (vault) => {
                    await updateVaultAndInvestorBreakdowns({
                        context,
                        chainId,
                        vault,
                        blockNumber,
                        blockTimestamp,
                    });
                })
            );

            context.log.info('Completed vault breakdown updates for ClockTick', {
                chainId,
                roundedTimestamp: roundedTimestamp.toString(),
                vaultCount: vaults.length,
            });
        });
    })
);
