import { addressBookByChainId, ChainId as chainEnum } from 'blockchain-addressbook';
import * as R from 'remeda';
import type { ChainId } from './chain';

export const getWNativeToken = (chainId: ChainId) =>
    addressBookByChainId[chainId].tokens[addressBookByChainId[chainId].native.symbol];

export const isNativeTokenSymbol = (chainId: ChainId, token: string) => getWNativeToken(chainId).symbol === token;

export const getChainSlugFromChainId = (chainId: ChainId): keyof typeof chainEnum =>
    // biome-ignore lint/style/noNonNullAssertion: we know the chain is valid
    R.pipe(
        chainEnum,
        R.entries(),
        R.filter(([_k, v]) => v === chainId),
        R.map(([k, _v]) => k),
        R.first()
    )!;
