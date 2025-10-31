import { BigDecimal, RewardPool } from 'generated';
import type { BeefyRewardPool_t } from 'generated/src/db/Entities.gen';
import type { HandlerContext } from 'generated/src/Types';
import type { Hex } from 'viem';
import { getRewardPoolTokens } from '../effects/rewardPool.effects';
import { getBeefyVaultConfigForAddress } from '../effects/vaultConfig.effects';
import { createBeefyRewardPool, getBeefyRewardPool } from '../entities/beefyRewardPool.entity';
import { getBeefyVault } from '../entities/beefyVault.entity';
import { getOrCreateInvestor } from '../entities/investor.entity';
import { getOrCreateToken } from '../entities/token.entity';
import { type ChainId, toChainId } from '../lib/chain';
import { interpretAsDecimal } from '../lib/decimal';
import { updateInvestorPositionAndBreakdown } from '../lib/investorPositionBreakdown';

RewardPool.Initialized.handler(async ({ event, context }) => {
    const chainId = toChainId(event.chainId);
    const rewardPoolAddress = event.srcAddress.toString().toLowerCase() as Hex;

    const rewardPool = await initializeRewardPool({ context, chainId, rewardPoolAddress });
    if (!rewardPool) return;

    context.log.info('ClassicRewardPool initialized successfully', { rewardPoolAddress });
});

RewardPool.Transfer.handler(async ({ event, context }) => {
    const chainId = toChainId(event.chainId);
    const rewardPoolAddress = event.srcAddress.toString().toLowerCase() as Hex;

    const rewardPool = await initializeRewardPool({ context, chainId, rewardPoolAddress });
    if (!rewardPool) return;

    const vault = await context.BeefyVault.get(rewardPool.vault_id);
    if (!vault) {
        throw new Error('RewardPool vault not found');
    }

    const sender = event.params.from.toString().toLowerCase() as Hex;
    const receiver = event.params.to.toString().toLowerCase() as Hex;
    const amount = event.params.value;

    const rcowToken = await context.Token.get(rewardPool.rcowToken_id);
    if (!rcowToken) return;

    const value = interpretAsDecimal(amount, rcowToken.decimals);
    const blockNumber = BigInt(event.block.number);
    const blockTimestamp = BigInt(event.block.timestamp);

    if (amount !== 0n && sender !== receiver) {
        if (sender !== ('0x0000000000000000000000000000000000000000' as Hex)) {
            const investor = await getOrCreateInvestor({ context, address: sender });
            await updateInvestorPositionAndBreakdown({
                context,
                chainId,
                investor,
                vault,
                directSharesDiff: new BigDecimal(0),
                indirectSharesDiff: value.negated(),
                blockNumber,
                blockTimestamp,
            });
        }
        if (receiver !== ('0x0000000000000000000000000000000000000000' as Hex)) {
            const investor = await getOrCreateInvestor({ context, address: receiver });
            await updateInvestorPositionAndBreakdown({
                context,
                chainId,
                investor,
                vault,
                directSharesDiff: new BigDecimal(0),
                indirectSharesDiff: value,
                blockNumber,
                blockTimestamp,
            });
        }
    }
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
