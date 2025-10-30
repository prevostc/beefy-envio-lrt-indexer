import { ClassicVault } from 'generated';
import type { BeefyVault_t } from 'generated/src/db/Entities.gen';
import type { HandlerContext } from 'generated/src/Types';
import type { Hex } from 'viem';
import { getClassicVaultTokens } from '../effects/classicVault.effects';
import { getBeefyVaultConfigForAddressEffect } from '../effects/vaultConfig.effects';
import { createBeefyVault, getBeefyVault } from '../entities/beefyVault.entity';
import { getOrCreateInvestor } from '../entities/investor.entity';
import { getOrCreateInvestorPosition } from '../entities/investorPosition.entity';
import { getOrCreateToken } from '../entities/token.entity';
import { type ChainId, toChainId } from '../lib/chain';
import { interpretAsDecimal } from '../lib/decimal';

ClassicVault.Initialized.handler(async ({ event, context }) => {
    const chainId = toChainId(event.chainId);
    const vaultAddress = event.srcAddress.toString().toLowerCase() as Hex;
    const blockNumber = BigInt(event.block.number);
    const blockTimestamp = BigInt(event.block.timestamp);

    const vault = await initializeClassicVault({ context, chainId, vaultAddress, blockNumber, blockTimestamp });
    if (!vault) return;

    context.log.info('ClassicVault initialized successfully', { vaultAddress });
});

ClassicVault.Transfer.handler(async ({ event, context }) => {
    const chainId = toChainId(event.chainId);
    const vaultAddress = event.srcAddress.toString().toLowerCase() as Hex;

    const vault = await initializeClassicVault({
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

    if (amount !== 0n && sender !== receiver) {
        if (sender !== ('0x0000000000000000000000000000000000000000' as Hex)) {
            const investor = await getOrCreateInvestor({ context, address: sender });
            const pos = await getOrCreateInvestorPosition({
                context,
                chainId,
                vault,
                investor,
                vaultAddress,
                investorAddress: sender,
            });
            context.InvestorPosition.set({ ...pos, sharesBalance: pos.sharesBalance.minus(value) });
        }
        if (receiver !== ('0x0000000000000000000000000000000000000000' as Hex)) {
            const investor = await getOrCreateInvestor({ context, address: receiver });
            const pos = await getOrCreateInvestorPosition({
                context,
                chainId,
                vault,
                investor,
                vaultAddress,
                investorAddress: receiver,
            });
            context.InvestorPosition.set({ ...pos, sharesBalance: pos.sharesBalance.plus(value) });
        }
    }
});

const initializeClassicVault = async ({
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

    context.log.info('Initializing ClassicVault', { vaultAddress, chainId });

    const { shareTokenAddress, underlyingTokenAddress, strategyAddress } = await context.effect(getClassicVaultTokens, {
        vaultAddress,
        chainId,
    });

    const [sharesToken, underlyingToken] = await Promise.all([
        getOrCreateToken({ context, chainId, tokenAddress: shareTokenAddress }),
        getOrCreateToken({ context, chainId, tokenAddress: underlyingTokenAddress }),
    ]);

    const cfg = await context.effect(getBeefyVaultConfigForAddressEffect, {
        chainId,
        address: vaultAddress,
        blockNumber,
    });
    const vaultId = cfg ? cfg.id : `${chainId}:${vaultAddress}`;
    const underlyingPlatform = cfg ? cfg.platformId : 'unknown';

    return await createBeefyVault({
        context,
        chainId,
        address: vaultAddress,
        sharesToken,
        underlyingToken,
        strategyAddress,
        vaultId,
        underlyingPlatform,
        initializedBlockNumber: blockNumber,
        initializedTimestamp: blockTimestamp,
    });
};
