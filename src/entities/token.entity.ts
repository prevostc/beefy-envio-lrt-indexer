import type { handlerContext as HandlerContext } from 'generated';
import type { Token_t } from 'generated/src/db/Entities.gen';
import type { Hex } from 'viem';
import { getTokenMetadataEffect } from '../effects/token.effects';
import type { ChainId } from '../lib/chain';

export const tokenId = ({ chainId, tokenAddress }: { chainId: ChainId; tokenAddress: Hex }) =>
    `${chainId}-${tokenAddress.toLowerCase()}`;

export const getOrCreateToken = async ({
    context,
    chainId,
    tokenAddress,
}: {
    context: HandlerContext;
    chainId: ChainId;
    tokenAddress: Hex;
}): Promise<Token_t> => {
    const id = tokenId({ chainId, tokenAddress });
    const maybeExistingToken = await context.Token.get(id);
    if (maybeExistingToken) {
        return maybeExistingToken;
    }

    const tokenMetadata = await context.effect(getTokenMetadataEffect, {
        tokenAddress: tokenAddress,
        chainId: chainId,
    });

    return await context.Token.getOrCreate({
        id,
        chainId,
        address: tokenAddress,
        name: tokenMetadata.name,
        symbol: tokenMetadata.symbol,
        decimals: tokenMetadata.decimals,
    });
};

/**
 * Get token by ID, returns null if not found
 */
export const getToken = async ({ context, id }: { context: HandlerContext; id: string }): Promise<Token_t | null> => {
    const token = await context.Token.get(id);
    return token ?? null;
};

export const getTokenOrThrow = async ({ context, id }: { context: HandlerContext; id: string }): Promise<Token_t> => {
    const token = await context.Token.get(id);
    if (!token) {
        throw new Error(`Token ${id} not found`);
    }
    return token;
};
