import { BigDecimal, type handlerContext as HandlerContext } from 'generated';
import type { BeefyVault_t, Investor_t, InvestorPosition_t } from 'generated/src/db/Entities.gen';
import * as R from 'remeda';
import type { Hex } from 'viem';
import { getVaultTvlBreakdownEffect } from '../effects/breakdown.effects';
import { getBeefyVaultConfigForAddress } from '../effects/vaultConfig.effects';
import { updateBeefyVault } from '../entities/beefyVault.entity';
import { createVaultBalanceBreakdown, upsertInvestorPositionBalanceBreakdown } from '../entities/breakdown.entity';
import {
    getAllInvestorPositionsForVault,
    getOrCreateInvestorPosition,
    updateInvestorPosition,
} from '../entities/investorPosition.entity';
import { getOrCreateToken, getToken } from '../entities/token.entity';
import { getOrCreateBeefyVaultBreakdownToken } from '../entities/vaultToken.entity';
import type { ChainId } from './chain';
import { interpretAsDecimal } from './decimal';

/**
 * Calculate time-weighted balances based on investor position's last breakdown data and new balances
 */
const calculateTimeWeightedBalances = ({
    investorPosition,
    newBalances,
    currentTimestamp,
}: {
    investorPosition: InvestorPosition_t;
    newBalances: BigDecimal[];
    currentTimestamp: bigint;
}): { timeWeightedBalances: BigDecimal[]; finalBalances: BigDecimal[] } => {
    const hasPreviousBreakdown =
        investorPosition.lastBalanceBreakdownBalances.length > 0 &&
        investorPosition.lastBalanceBreakdownTimestamp > BigInt(0);

    if (!hasPreviousBreakdown) {
        return {
            timeWeightedBalances: R.map(newBalances, () => new BigDecimal(0)),
            finalBalances: newBalances,
        };
    }

    const oldBalances = investorPosition.lastBalanceBreakdownBalances;
    const oldTimeWeightedBalances = investorPosition.lastBalanceBreakdownTimeWeightedBalances;

    // Arrays should match in length if breakdown tokens haven't changed
    // If they don't match, reset time-weighted balances (tokens changed in vault)
    if (oldBalances.length !== newBalances.length) {
        return {
            timeWeightedBalances: R.map(newBalances, () => new BigDecimal(0)),
            finalBalances: newBalances,
        };
    }

    const timeElapsed = currentTimestamp - investorPosition.lastBalanceBreakdownTimestamp;
    const timeElapsedDecimal = new BigDecimal(timeElapsed.toString());
    const timeWeightedBalances = R.map(oldTimeWeightedBalances, (twb, i) => {
        const oldBalance = oldBalances[i];
        return twb.plus(oldBalance.multipliedBy(timeElapsedDecimal));
    });

    return {
        timeWeightedBalances,
        finalBalances: newBalances,
    };
};

/**
 * Updates investor position balance and calculates breakdown
 * @param directSharesDiff - Change in direct shares balance (can be negative)
 * @param indirectSharesDiff - Change in reward pool shares balance (can be negative)
 */
export const updateInvestorPositionAndBreakdown = async ({
    context,
    chainId,
    investor,
    vault,
    directSharesDiff,
    indirectSharesDiff,
    blockNumber,
    blockTimestamp,
}: {
    context: HandlerContext;
    chainId: ChainId;
    investor: Investor_t;
    vault: BeefyVault_t;
    directSharesDiff: BigDecimal;
    indirectSharesDiff: BigDecimal;
    blockNumber: bigint;
    blockTimestamp: bigint;
}): Promise<void> => {
    // Get or create investor position
    const investorPosition = await getOrCreateInvestorPosition({
        context,
        chainId,
        vault,
        investor,
    });

    // Update investor position balances
    const updatedPosition: InvestorPosition_t = {
        ...investorPosition,
        directSharesBalance: investorPosition.directSharesBalance.plus(directSharesDiff),
        rewardPoolSharesBalance: investorPosition.rewardPoolSharesBalance.plus(indirectSharesDiff),
        totalSharesBalance: investorPosition.totalSharesBalance.plus(directSharesDiff).plus(indirectSharesDiff),
    };
    await updateInvestorPosition({ context, investorPosition: updatedPosition });

    // Only calculate breakdown if user has a positive balance
    if (updatedPosition.totalSharesBalance.lte(new BigDecimal(0))) {
        return;
    }

    // Get vault config to determine protocol type
    const vaultConfig = await getBeefyVaultConfigForAddress({
        context,
        chainId,
        vaultOrRewardPoolAddress: vault.address,
    });

    // Early exit in preload if effect depends on read data (vaultConfig used in effect)
    if (context.isPreload) return;

    // Fetch vault balance breakdown
    const breakdownData = await context.effect(getVaultTvlBreakdownEffect, {
        chainId,
        blockNumber,
        vault: {
            address: vault.address as Hex,
            protocolType: vaultConfig.protocol_type,
        },
    });

    // Get shares token to normalize amounts
    const sharesToken = await getToken({ context, id: vault.sharesToken_id });
    if (!sharesToken) {
        throw new Error(`Shares token not found for vault ${vault.id}`);
    }

    // Convert vault total supply to BigDecimal
    const vaultTotalSupply = interpretAsDecimal(breakdownData.vaultTotalSupply, sharesToken.decimals);

    // Calculate user's share percentage
    if (vaultTotalSupply.lte(new BigDecimal(0))) {
        context.log.warn('Vault total supply is zero or negative, skipping breakdown', {
            vaultId: vault.id,
            blockNumber: blockNumber.toString(),
        });
        return;
    }

    const userSharePercentage = updatedPosition.totalSharesBalance.dividedBy(vaultTotalSupply);

    // Process breakdown tokens and create/update entities
    // Ensure breakdown tokens are created and order matches vault's breakdownTokensOrder
    const tokenResults = await Promise.all(
        R.map(breakdownData.balances, async (balanceData) => {
            const tokenAddress = balanceData.tokenAddress as Hex;
            const token = await getOrCreateToken({ context, chainId, tokenAddress });
            await getOrCreateBeefyVaultBreakdownToken({ context, chainId, vault, token });

            // Convert vault balance to BigDecimal with correct decimals
            const vaultBalance = interpretAsDecimal(balanceData.tokenBalance, token.decimals);

            // Calculate user's share of this token
            const userBalance = vaultBalance.multipliedBy(userSharePercentage);

            return {
                token,
                vaultBalance,
                userBalance,
            };
        })
    );

    const vaultBreakdownBalances = R.map(tokenResults, (result) => result.vaultBalance);
    const breakdownBalances = R.map(tokenResults, (result) => result.userBalance);
    const breakdownTokenIds = R.map(tokenResults, (result) => result.token.id);

    // Update vault with new breakdown tokens order, supply, and timestamps
    const updatedVault: BeefyVault_t = {
        ...vault,
        breakdownTokensOrder: breakdownTokenIds,
        sharesTokenTotalSupply: vaultTotalSupply,
        lastBalanceBreakdownUpdateBlockNumber: blockNumber,
        lastBalanceBreakdownUpdateTimestamp: blockTimestamp,
    };

    // Create vault balance breakdown and investor position balance breakdown in parallel
    await Promise.all([
        updateBeefyVault({ context, vault: updatedVault }),
        createVaultBalanceBreakdown({
            context,
            chainId,
            vault,
            blockNumber,
            blockTimestamp,
            balances: vaultBreakdownBalances,
        }),
        (async () => {
            const { timeWeightedBalances, finalBalances } = calculateTimeWeightedBalances({
                investorPosition: updatedPosition,
                newBalances: breakdownBalances,
                currentTimestamp: blockTimestamp,
            });

            const breakdown = await upsertInvestorPositionBalanceBreakdown({
                context,
                chainId,
                investorPosition: updatedPosition,
                balances: finalBalances,
                timeWeightedBalances,
                blockTimestamp,
                blockNumber,
            });

            // Update investor position with the new breakdown data
            const updatedPositionWithBreakdown: InvestorPosition_t = {
                ...updatedPosition,
                lastBalanceBreakdownBalances: finalBalances,
                lastBalanceBreakdownTimeWeightedBalances: timeWeightedBalances,
                lastBalanceBreakdownTimestamp: blockTimestamp,
                lastBalanceBreakdownBlock: blockNumber,
            };
            await updateInvestorPosition({ context, investorPosition: updatedPositionWithBreakdown });

            return breakdown;
        })(),
    ]);
};

/**
 * Updates vault breakdown and all investor position breakdowns for a vault.
 * This is extracted from updateInvestorPositionAndBreakdown to be reusable for clock tick updates.
 */
export const updateVaultAndInvestorBreakdowns = async ({
    context,
    chainId,
    vault,
    blockNumber,
    blockTimestamp,
}: {
    context: HandlerContext;
    chainId: ChainId;
    vault: BeefyVault_t;
    blockNumber: bigint;
    blockTimestamp: bigint;
}): Promise<void> => {
    // Get vault config to determine protocol type
    const vaultConfig = await getBeefyVaultConfigForAddress({
        context,
        chainId,
        vaultOrRewardPoolAddress: vault.address,
    });

    // Early exit in preload if effect depends on read data (vaultConfig used in effect)
    if (context.isPreload) return;

    // Fetch vault balance breakdown
    const breakdownData = await context.effect(getVaultTvlBreakdownEffect, {
        chainId,
        blockNumber,
        vault: {
            address: vault.address as Hex,
            protocolType: vaultConfig.protocol_type,
        },
    });

    // Get shares token to normalize amounts
    const sharesToken = await getToken({ context, id: vault.sharesToken_id });
    if (!sharesToken) {
        throw new Error(`Shares token not found for vault ${vault.id}`);
    }

    // Convert vault total supply to BigDecimal
    const vaultTotalSupply = interpretAsDecimal(breakdownData.vaultTotalSupply, sharesToken.decimals);

    // Check if vault has valid supply
    if (vaultTotalSupply.lte(new BigDecimal(0))) {
        context.log.warn('Vault total supply is zero or negative, skipping breakdown', {
            vaultId: vault.id,
            blockNumber: blockNumber.toString(),
        });
        return;
    }

    // Process breakdown tokens and create/update entities
    // Ensure breakdown tokens are created and order matches vault's breakdownTokensOrder
    const tokenResults = await Promise.all(
        R.map(breakdownData.balances, async (balanceData) => {
            const tokenAddress = balanceData.tokenAddress as Hex;
            const token = await getOrCreateToken({ context, chainId, tokenAddress });
            await getOrCreateBeefyVaultBreakdownToken({ context, chainId, vault, token });

            // Convert vault balance to BigDecimal with correct decimals
            const vaultBalance = interpretAsDecimal(balanceData.tokenBalance, token.decimals);

            return {
                token,
                vaultBalance,
            };
        })
    );

    const vaultBreakdownBalances = R.map(tokenResults, (result) => result.vaultBalance);
    const breakdownTokenIds = R.map(tokenResults, (result) => result.token.id);

    // Update vault with new breakdown tokens order, supply, and timestamps
    const updatedVault: BeefyVault_t = {
        ...vault,
        breakdownTokensOrder: breakdownTokenIds,
        sharesTokenTotalSupply: vaultTotalSupply,
        lastBalanceBreakdownUpdateBlockNumber: blockNumber,
        lastBalanceBreakdownUpdateTimestamp: blockTimestamp,
    };
    await updateBeefyVault({ context, vault: updatedVault });

    // Create vault balance breakdown
    await createVaultBalanceBreakdown({
        context,
        chainId,
        vault,
        blockNumber,
        blockTimestamp,
        balances: vaultBreakdownBalances,
    });

    // Fetch all investor positions for this vault
    const investorPositions = await getAllInvestorPositionsForVault({ context, vault });

    // Update breakdown for each investor position with a positive balance
    const breakdownPromises = R.pipe(
        investorPositions,
        R.filter((investorPosition) => investorPosition.totalSharesBalance.gt(new BigDecimal(0))),
        R.map(async (investorPosition) => {
            // Calculate user's share percentage
            const userSharePercentage = investorPosition.totalSharesBalance.dividedBy(vaultTotalSupply);

            // Calculate user's balance for each breakdown token
            const breakdownBalances = R.map(vaultBreakdownBalances, (vaultBalance) =>
                vaultBalance.multipliedBy(userSharePercentage)
            );

            // Calculate time-weighted balances
            const { timeWeightedBalances, finalBalances } = calculateTimeWeightedBalances({
                investorPosition,
                newBalances: breakdownBalances,
                currentTimestamp: blockTimestamp,
            });

            const breakdown = await upsertInvestorPositionBalanceBreakdown({
                context,
                chainId,
                investorPosition,
                balances: finalBalances,
                timeWeightedBalances,
                blockTimestamp,
                blockNumber,
            });

            // Update investor position with the new breakdown data
            const updatedPositionWithBreakdown: InvestorPosition_t = {
                ...investorPosition,
                lastBalanceBreakdownBalances: finalBalances,
                lastBalanceBreakdownTimeWeightedBalances: timeWeightedBalances,
                lastBalanceBreakdownTimestamp: blockTimestamp,
                lastBalanceBreakdownBlock: blockNumber,
            };
            await updateInvestorPosition({ context, investorPosition: updatedPositionWithBreakdown });

            return breakdown;
        })
    );

    await Promise.all(breakdownPromises);
};
