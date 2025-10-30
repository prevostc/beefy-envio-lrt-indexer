import { RewardPool } from 'generated';
import type { BeefyRewardPool_t } from 'generated/src/db/Entities.gen';
import type { HandlerContext } from 'generated/src/Types';
import type { Hex } from 'viem';
import { getRewardPoolTokens } from '../effects/rewardPool.effects';
import { getBeefyVaultConfigForAddress } from '../effects/vaultConfig.effects';
import { createBeefyRewardPool, getBeefyRewardPool } from '../entities/beefyRewardPool.entity';
import { getBeefyVault } from '../entities/beefyVault.entity';
import { getOrCreateToken } from '../entities/token.entity';
import { type ChainId, toChainId } from '../lib/chain';

RewardPool.Initialized.handler(async ({ event, context }) => {
    const chainId = toChainId(event.chainId);
    const rewardPoolAddress = event.srcAddress.toString().toLowerCase() as Hex;

    const rewardPool = await initializeRewardPool({ context, chainId, rewardPoolAddress });
    if (!rewardPool) return;

    context.log.info('ClassicRewardPool initialized successfully', { rewardPoolAddress });
});

RewardPool.Transfer.handler(async () => {
    // No-op for new schema
});

RewardPool.NotifyReward.handler(async () => {
    // No-op for new schema
});

const initializeRewardPool = async ({
    context,
    chainId,
    rewardPoolAddress,
}: {
    context: HandlerContext;
    chainId: ChainId;
    rewardPoolAddress: Hex;
}): Promise<BeefyRewardPool_t | null> => {
    const existing = await getBeefyRewardPool(context, chainId, rewardPoolAddress);
    if (existing) return existing;

    context.log.info('Initializing BeefyRewardPool', { rewardPoolAddress, chainId });

    // Find the parent vault from config
    const vaultConfig = await getBeefyVaultConfigForAddress({
        context,
        chainId,
        address: rewardPoolAddress,
    });

    const vault = await getBeefyVault(context, chainId, vaultConfig.vault_address);
    if (!vault) {
        throw new Error('RewardPool vault not found');
    }

    // Fetch rcow token (staked token)
    const { underlyingTokenAddress } = await context.effect(getRewardPoolTokens, {
        rewardPoolAddress,
        chainId,
    });
    const rcowToken = await getOrCreateToken({ context, chainId, tokenAddress: underlyingTokenAddress });

    return await createBeefyRewardPool({ context, chainId, address: rewardPoolAddress, vault, rcowToken });
};
