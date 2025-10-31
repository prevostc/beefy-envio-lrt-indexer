import { BigDecimal, ClmManager } from 'generated';
import type { BeefyVault_t } from 'generated/src/db/Entities.gen';
import type { HandlerContext } from 'generated/src/Types';
import type { Hex } from 'viem';
import { getClmManagerTokens } from '../effects/clmManager.effects';
import { getBeefyVaultConfigForAddress } from '../effects/vaultConfig.effects';
import { createBeefyVault, getBeefyVault } from '../entities/beefyVault.entity';
import { getOrCreateInvestor } from '../entities/investor.entity';
import { getOrCreateToken } from '../entities/token.entity';
import { type ChainId, toChainId } from '../lib/chain';
import { interpretAsDecimal } from '../lib/decimal';
import { updateInvestorPositionAndBreakdown } from '../lib/investorPositionBreakdown';

ClmManager.Initialized.handler(async ({ event, context }) => {
    const chainId = toChainId(event.chainId);
    const vaultAddress = event.srcAddress.toString().toLowerCase() as Hex;
    const blockNumber = BigInt(event.block.number);
    const blockTimestamp = BigInt(event.block.timestamp);

    const vault = await initializeClmManager({ context, chainId, vaultAddress, blockNumber, blockTimestamp });
    if (!vault) return;

    context.log.info('ClmManager initialized successfully', { vaultAddress });
});

ClmManager.Transfer.handler(async ({ event, context }) => {
    const chainId = toChainId(event.chainId);
    const vaultAddress = event.srcAddress.toString().toLowerCase() as Hex;

    const vault = await initializeClmManager({
        context,
        chainId,
        vaultAddress,
        blockNumber: BigInt(event.block.number),
        blockTimestamp: BigInt(event.block.timestamp),
    });
    if (!vault) return;

    const sender = event.params.from.toString().toLowerCase() as Hex;
    const receiver = event.params.to.toString().toLowerCase() as Hex;
    const amount = event.params.value;

    const sharesToken = await context.Token.get(vault.sharesToken_id);
    if (!sharesToken) return;

    const value = interpretAsDecimal(amount, sharesToken.decimals);
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
                directSharesDiff: value.negated(),
                indirectSharesDiff: new BigDecimal(0),
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
                directSharesDiff: value,
                indirectSharesDiff: new BigDecimal(0),
                blockNumber,
                blockTimestamp,
            });
        }
    }
});

const initializeClmManager = async ({
    context,
    chainId,
    vaultAddress,
    blockNumber,
    blockTimestamp,
}: {
    context: HandlerContext;
    chainId: ChainId;
    vaultAddress: Hex;
    blockNumber: bigint;
    blockTimestamp: bigint;
}): Promise<BeefyVault_t | null> => {
    const existing = await getBeefyVault(context, chainId, vaultAddress);
    if (existing) return existing;

    context.log.info('Initializing ClmManager', { vaultAddress, chainId });

    const { shareTokenAddress, underlyingToken0Address, underlyingToken1Address, strategyAddress } =
        await context.effect(getClmManagerTokens, {
            vaultAddress,
            chainId,
        });

    const [sharesToken, underlyingToken0, underlyingToken1] = await Promise.all([
        getOrCreateToken({ context, chainId, tokenAddress: shareTokenAddress }),
        getOrCreateToken({ context, chainId, tokenAddress: underlyingToken0Address }),
        getOrCreateToken({ context, chainId, tokenAddress: underlyingToken1Address }),
    ]);

    const vaultConfig = await getBeefyVaultConfigForAddress({
        context,
        chainId,
        vaultOrRewardPoolAddress: vaultAddress,
    });
    const vaultId = vaultConfig ? vaultConfig.id : `${chainId}:${vaultAddress}`;
    const underlyingPlatform = vaultConfig ? vaultConfig.platformId : 'unknown';

    return await createBeefyVault({
        context,
        chainId,
        address: vaultAddress,
        sharesToken,
        underlyingTokens: [underlyingToken0, underlyingToken1],
        strategyAddress,
        vaultId,
        underlyingPlatform,
        initializedBlockNumber: blockNumber,
        initializedTimestamp: blockTimestamp,
    });
};
