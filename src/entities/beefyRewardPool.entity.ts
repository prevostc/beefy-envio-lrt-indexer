import type { handlerContext as HandlerContext } from 'generated';
import type { BeefyRewardPool_t, BeefyVault_t, Token_t } from 'generated/src/db/Entities.gen';
import type { Hex } from 'viem';
import type { ChainId } from '../lib/chain';
import { InitializableStatus } from '../lib/initializableStatus';

export const beefyRewardPoolId = ({ chainId, address }: { chainId: ChainId; address: Hex }) =>
    `${chainId}-${address.toLowerCase()}`;

export const getBeefyRewardPool = async (context: HandlerContext, chainId: ChainId, address: Hex) => {
    const id = beefyRewardPoolId({ chainId, address });
    return await context.BeefyRewardPool.get(id);
};

export const createBeefyRewardPool = async ({
    context,
    chainId,
    address,
    vault,
    rcowToken,
}: {
    context: HandlerContext;
    chainId: ChainId;
    address: Hex;
    vault: BeefyVault_t;
    rcowToken: Token_t;
}): Promise<BeefyRewardPool_t> => {
    const id = beefyRewardPoolId({ chainId, address });
    const entity: BeefyRewardPool_t = {
        id,
        chainId,
        address,
        vault_id: vault.id,
        rcowToken_id: rcowToken.id,
        initializableStatus: InitializableStatus.INITIALIZED,
    } as unknown as BeefyRewardPool_t;
    context.BeefyRewardPool.set(entity);
    return entity;
};
