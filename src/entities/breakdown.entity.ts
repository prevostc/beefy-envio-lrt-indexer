import type { BigDecimal, handlerContext as HandlerContext } from 'generated';
import type {
    BeefyVault_t,
    InvestorPosition_t,
    InvestorPositionBalanceBreakdown_t,
    VaultBalanceBreakdown_t,
} from 'generated/src/db/Entities.gen';
import type { ChainId } from '../lib/chain';

export const getVaultBalanceBreakdownId = ({
    chainId,
    vault,
    blockNumber,
}: {
    chainId: ChainId;
    vault: BeefyVault_t;
    blockNumber: bigint;
}): string => `${chainId}-${vault.address.toLowerCase()}-${blockNumber.toString()}`;

export const createVaultBalanceBreakdown = async ({
    context,
    chainId,
    vault,
    blockNumber,
    blockTimestamp,
    balances,
}: {
    context: HandlerContext;
    chainId: ChainId;
    vault: BeefyVault_t;
    blockNumber: bigint;
    blockTimestamp: bigint;
    balances: BigDecimal[];
}): Promise<VaultBalanceBreakdown_t> => {
    const id = getVaultBalanceBreakdownId({ chainId, vault, blockNumber });
    context.log.debug('Getting or creating vault balance breakdown', { id });
    const entity: VaultBalanceBreakdown_t = {
        id,
        chainId,
        vault_id: vault.id,
        blockNumber,
        blockTimestamp,
        balances,
    } as unknown as VaultBalanceBreakdown_t;
    context.VaultBalanceBreakdown.set(entity);
    return entity;
};

export const getInvestorPositionBalanceBreakdownId = ({
    investorPosition,
    blockNumber,
}: {
    investorPosition: InvestorPosition_t;
    blockNumber: bigint;
}): string => `${investorPosition.id}-${blockNumber.toString()}`;

export const upsertInvestorPositionBalanceBreakdown = async ({
    context,
    chainId,
    investorPosition,
    balances,
    timeWeightedBalances,
    blockTimestamp,
    blockNumber,
}: {
    context: HandlerContext;
    chainId: ChainId;
    investorPosition: InvestorPosition_t;
    balances: BigDecimal[];
    timeWeightedBalances: BigDecimal[];
    blockTimestamp: bigint;
    blockNumber: bigint;
}): Promise<InvestorPositionBalanceBreakdown_t> => {
    const id = getInvestorPositionBalanceBreakdownId({ investorPosition, blockNumber });

    const entity: InvestorPositionBalanceBreakdown_t = {
        id,
        chainId,
        investorPosition_id: investorPosition.id,
        balances,
        timeWeightedBalances,
        lastUpdateTimestamp: blockTimestamp,
        lastUpdateBlock: blockNumber,
    } as unknown as InvestorPositionBalanceBreakdown_t;

    context.InvestorPositionBalanceBreakdown.set(entity);
    return entity;
};
