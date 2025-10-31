import { BigDecimal, type handlerContext as HandlerContext } from 'generated';
import type { BeefyVault_t, Investor_t, InvestorPosition_t } from 'generated/src/db/Entities.gen';
import type { Hex } from 'viem';
import { getVaultTvlBreakdownEffect } from '../effects/breakdown.effects';
import { getBeefyVaultConfigForAddress } from '../effects/vaultConfig.effects';
import { updateBeefyVault } from '../entities/beefyVault.entity';
import { createVaultBalanceBreakdown } from '../entities/breakdown.entity';
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
    const breakdownBalances: BigDecimal[] = [];
    const vaultBreakdownBalances: BigDecimal[] = [];
    const breakdownTokenIds: string[] = [];

    // Ensure breakdown tokens are created and order matches vault's breakdownTokensOrder
    for (const balanceData of breakdownData.balances) {
        const tokenAddress = balanceData.tokenAddress as Hex;
        const token = await getOrCreateToken({ context, chainId, tokenAddress });
        await getOrCreateBeefyVaultBreakdownToken({ context, chainId, vault, token });

        // Convert vault balance to BigDecimal with correct decimals
        const vaultBalance = interpretAsDecimal(balanceData.tokenBalance, token.decimals);
        vaultBreakdownBalances.push(vaultBalance);

        // Calculate user's share of this token
        const userBalance = vaultBalance.multipliedBy(userSharePercentage);
        breakdownBalances.push(userBalance);

        // Track token ID for order
        breakdownTokenIds.push(token.id);
    }

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

    // Create investor position balance breakdown
    const { upsertInvestorPositionBalanceBreakdown } = await import('../entities/breakdown.entity');
    await upsertInvestorPositionBalanceBreakdown({
        context,
        chainId,
        investorPosition: updatedPosition,
        balances: breakdownBalances,
        blockTimestamp,
        blockNumber,
    });
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
    const vaultBreakdownBalances: BigDecimal[] = [];
    const breakdownTokenIds: string[] = [];

    // Ensure breakdown tokens are created and order matches vault's breakdownTokensOrder
    for (const balanceData of breakdownData.balances) {
        const tokenAddress = balanceData.tokenAddress as Hex;
        const token = await getOrCreateToken({ context, chainId, tokenAddress });
        await getOrCreateBeefyVaultBreakdownToken({ context, chainId, vault, token });

        // Convert vault balance to BigDecimal with correct decimals
        const vaultBalance = interpretAsDecimal(balanceData.tokenBalance, token.decimals);
        vaultBreakdownBalances.push(vaultBalance);

        // Track token ID for order
        breakdownTokenIds.push(token.id);
    }

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
    const { upsertInvestorPositionBalanceBreakdown } = await import('../entities/breakdown.entity');

    for (const investorPosition of investorPositions) {
        // Only calculate breakdown if user has a positive balance
        if (investorPosition.totalSharesBalance.lte(new BigDecimal(0))) {
            continue;
        }

        // Calculate user's share percentage
        const userSharePercentage = investorPosition.totalSharesBalance.dividedBy(vaultTotalSupply);

        // Calculate user's balance for each breakdown token
        const breakdownBalances: BigDecimal[] = vaultBreakdownBalances.map((vaultBalance) =>
            vaultBalance.multipliedBy(userSharePercentage)
        );

        // Create or update investor position balance breakdown
        await upsertInvestorPositionBalanceBreakdown({
            context,
            chainId,
            investorPosition,
            balances: breakdownBalances,
            blockTimestamp,
            blockNumber,
        });
    }
};
