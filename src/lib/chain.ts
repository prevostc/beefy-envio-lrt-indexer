import { S } from 'envio';
import * as R from 'remeda';

export const allChainIds = [
    // 1313161554, // aurora
    42161, // arbitrum
    // 43114, // avax
    8453, // base
    // 80094, // berachain
    56, // bsc
    // 7700, // canto
    // 42220, // celo
    // 25, // cronos
    // 42262, // emerald
    1, // ethereum
    // 250, // fantom
    // 252, // fraxtal
    // 100, // gnosis
    // 128, // heco
    // 122, // fuse
    999, // hyperevm
    // 2222, // kava
    59144, // linea
    // 1135, // lisk
    // 169, // manta
    // 5000, // mantle
    // 1088, // metis
    34443, // mode
    // 1284, // moonbeam
    // 1285, // moonriver
    // 1666600000, // one
    10, // optimism
    // 9745, // plasma
    // 137, // polygon
    // 111188, // real
    // 30, // rootstock
    // 5464, // saga
    // 534352, // scroll
    // 1329, // sei
    146, // sonic
    // 130, // unichain
    // 1101, // zkevm
    // 324, // zksync
] as const;

export const chainIdSchema = S.union(
    R.pipe(
        allChainIds,
        R.map((chainId) => S.schema(chainId))
    )
);

export type ChainId = S.Infer<typeof chainIdSchema>;

export const toChainId = (chainId: number | ChainId | string): ChainId => {
    return S.parseOrThrow(chainId, chainIdSchema);
};

// Map containing at least all ChainId keys and optionally other number keys
export type MapByChainId<T> = { [key in ChainId]: T } & { [key: number]: T };

export const MS_BETWEEN_BLOCKS: MapByChainId<number> = {
    1313161554: 1000, // aurora
    42161: 25000, // arbitrum
    43114: 2000, // avax
    8453: 15000, // base
    80094: 3000, // berachain
    56: 10000, // bsc
    7700: 6000, // canto
    42220: 5000, // celo
    25: 6000, // cronos
    42262: 2000, // emerald
    1: 12000, // ethereum
    250: 1000, // fantom
    252: 2000, // fraxtal
    100: 5000, // gnosis
    128: 3000, // heco
    122: 5000, // fuse
    999: 15000, // hyperevm
    2222: 7000, // kava
    59144: 15000, // linea
    1135: 10000, // lisk
    169: 2000, // manta
    5000: 2000, // mantle
    1088: 4000, // metis
    34443: 15000, // mode
    1284: 12000, // moonbeam
    1285: 12000, // moonriver
    1666600000: 2000, // one
    10: 15000, // optimism
    9745: 2000, // plasma
    137: 2000, // polygon
    111188: 2000, // real
    30: 6000, // rootstock
    5464: 15000, // saga
    534352: 15000, // scroll
    1329: 6000, // sei
    146: 30000, // sonic
    130: 2000, // unichain
    1101: 2000, // zkevm
    324: 2000, // zksync
};
