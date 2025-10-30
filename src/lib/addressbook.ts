import { addressBookByChainId } from 'blockchain-addressbook';
import type { ChainId } from './chain';

export const getWNativeToken = (chain: ChainId) =>
    addressBookByChainId[chain].tokens[addressBookByChainId[chain].native.symbol];

export const isNativeTokenSymbol = (chain: ChainId, token: string) => getWNativeToken(chain).symbol === token;
