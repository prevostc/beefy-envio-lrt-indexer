import { BigDecimal, type handlerContext as HandlerContext } from 'generated';
import type { BeefyVault_t, Investor_t, InvestorPosition_t } from 'generated/src/db/Entities.gen';
import type { ChainId } from '../lib/chain';

export const investorPositionId = ({
    chainId,
    vault,
    investor,
}: {
    chainId: ChainId;
    vault: BeefyVault_t;
    investor: Investor_t;
}) => `${chainId}-${vault.address.toLowerCase()}-${investor.address.toLowerCase()}`;

export const getOrCreateInvestorPosition = async ({
    context,
    chainId,
    vault,
    investor,
}: {
    context: HandlerContext;
    chainId: ChainId;
    vault: BeefyVault_t;
    investor: Investor_t;
}): Promise<InvestorPosition_t> => {
    const id = investorPositionId({ chainId, vault, investor });
    const existing = await context.InvestorPosition.get(id);
    if (existing) return existing;
    return await context.InvestorPosition.getOrCreate({
        id,
        chainId,
        investor_id: investor.id,
        vault_id: vault.id,
        directSharesBalance: new BigDecimal(0),
        rewardPoolSharesBalance: new BigDecimal(0),
        totalSharesBalance: new BigDecimal(0),
        lastBalanceBreakdownBalances: [],
        lastBalanceBreakdownTimeWeightedBalances: [],
        lastBalanceBreakdownTimestamp: BigInt(0),
        lastBalanceBreakdownBlock: BigInt(0),
    });
};

/**
 * Get all investor positions for a vault
 */
export const getAllInvestorPositionsForVault = async ({
    context,
    vault,
}: {
    context: HandlerContext;
    vault: BeefyVault_t;
}): Promise<InvestorPosition_t[]> => {
    return await context.InvestorPosition.getWhere.vault_id.eq(vault.id);
};

/**
 * Update investor position entity
 */
export const updateInvestorPosition = async ({
    context,
    investorPosition,
}: {
    context: HandlerContext;
    investorPosition: InvestorPosition_t;
}): Promise<void> => {
    context.InvestorPosition.set(investorPosition);
};
