import { BigDecimal, type handlerContext as HandlerContext } from 'generated';
import type { BeefyVault_t, Investor_t, InvestorPosition_t } from 'generated/src/db/Entities.gen';
import type { Hex } from 'viem';
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
    vaultAddress: Hex;
    investorAddress: Hex;
}): Promise<InvestorPosition_t> => {
    const id = investorPositionId({ chainId, vault, investor });
    context.log.debug('Getting or creating investor position', { id });
    const existing = await context.InvestorPosition.get(id);
    if (existing) return existing;
    return await context.InvestorPosition.getOrCreate({
        id,
        chainId,
        investor_id: investor.id,
        vault_id: vault.id,
        sharesBalance: new BigDecimal(0),
    });
};
