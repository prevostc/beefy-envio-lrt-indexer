import { LstVault } from 'generated';
import type { LstVault_t } from 'generated/src/db/Entities.gen';
import type { HandlerContext } from 'generated/src/Types';
import type { Hex } from 'viem';
import { getLstVaultTokens } from '../effects/lstVault.effects';
import { createLstVault, getLstVault } from '../entities/lstVault.entity';
import { getOrCreateToken, getTokenOrThrow } from '../entities/token.entity';
import { logBlacklistStatus } from '../lib/blacklist';
import { type ChainId, toChainId } from '../lib/chain';
import { handleTokenTransfer } from '../lib/token';

LstVault.Initialized.handler(async ({ event, context }) => {
    const chainId = toChainId(event.chainId);
    const lstAddress = event.srcAddress.toString().toLowerCase() as Hex;
    const initializedBlock = BigInt(event.block.number);

    const lst = await initializeLstVault({ context, chainId, lstAddress, initializedBlock });
    if (!lst) return;

    context.log.info('LstVault initialized successfully', { lstAddress });
});

LstVault.Transfer.handler(async ({ event, context }) => {
    const chainId = toChainId(event.chainId);
    const lstAddress = event.srcAddress.toString().toLowerCase() as Hex;

    // Ensure that the LST vault is initialized first
    const lst = await initializeLstVault({
        context,
        chainId,
        lstAddress,
        initializedBlock: BigInt(event.block.number),
    });
    if (!lst) return;

    const shareToken = await getTokenOrThrow({ context, id: lst.shareToken_id });

    await handleTokenTransfer({
        context,
        chainId,
        token: shareToken,
        senderAddress: event.params.from.toString().toLowerCase() as Hex,
        receiverAddress: event.params.to.toString().toLowerCase() as Hex,
        rawTransferAmount: event.params.value,
        block: event.block,
        transaction: event.transaction,
    });
});

const initializeLstVault = async ({
    context,
    chainId,
    lstAddress,
    initializedBlock,
}: {
    context: HandlerContext;
    chainId: ChainId;
    lstAddress: Hex;
    initializedBlock: bigint;
}): Promise<LstVault_t | null> => {
    // Check if the LST vault already exists
    const existingLst = await getLstVault(context, chainId, lstAddress);
    if (existingLst) {
        return existingLst;
    }

    context.log.info('Initializing LstVault', { lstAddress, chainId });

    // Fetch underlying tokens using effect
    const { shareTokenAddress, underlyingTokenAddress, blacklistStatus } = await context.effect(getLstVaultTokens, {
        lstAddress,
        chainId,
    });

    if (blacklistStatus !== 'ok') {
        logBlacklistStatus(context.log, blacklistStatus, 'LstVault', {
            contractAddress: lstAddress,
            shareTokenAddress,
            underlyingTokenAddress,
        });
        return null;
    }

    // Create tokens
    const [shareToken, underlyingToken] = await Promise.all([
        getOrCreateToken({
            context,
            chainId,
            tokenAddress: shareTokenAddress,
            virtual: false,
        }),
        getOrCreateToken({
            context,
            chainId,
            tokenAddress: underlyingTokenAddress,
            virtual: false,
        }),
    ]);

    // Create LST vault entity
    return await createLstVault({
        context,
        chainId,
        lstAddress,
        shareToken,
        underlyingToken,
        initializedBlock,
    });
};
