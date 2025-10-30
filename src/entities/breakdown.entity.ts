import { BigDecimal, type handlerContext as HandlerContext } from 'generated';
import type {
    BeefyVault_t,
    InvestorPosition_t,
    InvestorPositionBalanceBreakdown_t,
    Token_t,
    VaultBalanceBreakdown_t,
} from 'generated/src/db/Entities.gen';
import type { ChainId } from '../lib/chain';

export const getVaultBalanceBreakdownId = ({
    chainId,
    vault,
    token,
    blockNumber,
}: {
    chainId: ChainId;
    vault: BeefyVault_t;
    token: Token_t;
    blockNumber: bigint;
}): string => `${chainId}-${vault.address.toLowerCase()}-${token.address.toLowerCase()}-${blockNumber.toString()}`;

export const createVaultBalanceBreakdown = async ({
    context,
    chainId,
    vault,
    token,
    blockNumber,
    blockTimestamp,
    balance,
}: {
    context: HandlerContext;
    chainId: ChainId;
    vault: BeefyVault_t;
    token: Token_t;
    blockNumber: bigint;
    blockTimestamp: bigint;
    balance: BigDecimal;
}): Promise<VaultBalanceBreakdown_t> => {
    const id = getVaultBalanceBreakdownId({ chainId, vault, token, blockNumber });
    context.log.debug('Getting or creating vault balance breakdown', { id });
    const entity: VaultBalanceBreakdown_t = {
        id,
        chainId,
        vault_id: vault.id,
        token_id: token.id,
        blockNumber,
        blockTimestamp,
        balance,
    } as unknown as VaultBalanceBreakdown_t;
    context.VaultBalanceBreakdown.set(entity);
    return entity;
};

export const getInvestorPositionBalanceBreakdownId = ({
    investorPosition,
    token,
    blockNumber,
}: {
    investorPosition: InvestorPosition_t;
    token: Token_t;
    blockNumber: bigint;
}): string => `${investorPosition.id}-${token.address.toLowerCase()}-${blockNumber}`;

export const upsertInvestorPositionBalanceBreakdown = async ({
    context,
    chainId,
    investorPosition,
    token,
    balance,
    blockTimestamp,
    blockNumber,
}: {
    context: HandlerContext;
    chainId: ChainId;
    investorPosition: InvestorPosition_t;
    token: Token_t;
    balance: BigDecimal;
    blockTimestamp: bigint;
    blockNumber: bigint;
}): Promise<InvestorPositionBalanceBreakdown_t> => {
    const id = getInvestorPositionBalanceBreakdownId({ investorPosition, token, blockNumber });
    const existing = await context.InvestorPositionBalanceBreakdown.get(id);
    const entity: InvestorPositionBalanceBreakdown_t = existing
        ? {
              ...existing,
              balance,
              lastUpdateTimestamp: blockTimestamp,
              lastUpdateBlock: blockNumber,
          }
        : ({
              id,
              chainId,
              investorPosition_id: investorPosition.id,
              token_id: token.id,
              balance,
              timeWeightedBalance: new BigDecimal(0),
              lastUpdateTimestamp: blockTimestamp,
              lastUpdateBlock: blockNumber,
          } as unknown as InvestorPositionBalanceBreakdown_t);

    context.InvestorPositionBalanceBreakdown.set(entity);
    return entity;
};
