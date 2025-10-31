import * as R from 'remeda';
import type { Hex } from 'viem';
import { getChainSlugFromChainId, getWNativeToken, isNativeTokenSymbol } from '../../addressbook';
import type { ChainId } from '../../chain';

const BEEFY_MOO_VAULT_API = 'https://api.beefy.finance/vaults';
const BEEFY_COW_VAULT_API = 'https://api.beefy.finance/cow-vaults';
const BEEFY_GOV_API = 'https://api.beefy.finance/gov-vaults';
const BEEFY_BOOST_API = 'https://api.beefy.finance/boosts';

export type BeefyVault = {
    id: string;
    is_active: boolean;
    vault_address: Hex;
    undelying_lp_address: Hex;
    strategy_address: Hex;
    vault_token_symbol: string;
    chain: string;
    reward_pools: BeefyRewardPool[];
    boosts: BeefyBoost[];
    pointStructureIds: string[];
    platformId: ApiPlatformId;
} & (
    | {
          protocol_type: 'beefy_clm_vault';
          beefy_clm_manager: BeefyVault;
      }
    | {
          protocol_type: Exclude<BeefyProtocolType, 'beefy_clm_vault'>;
      }
);

export type BeefyRewardPool = {
    id: string;
    clm_address: Hex;
    reward_pool_address: Hex;
};

export type BeefyBoost = {
    id: string;
    boost_address: Hex;
    underlying_address: Hex;
};

export type BeefyProtocolType =
    | 'aave'
    | 'balancer_aura'
    | 'balancer'
    | 'beefy_clm_vault'
    | 'beefy_clm'
    | 'curve'
    | 'gamma'
    | 'ichi'
    | 'infrared'
    | 'euler'
    | 'pendle_equilibria'
    | 'solidly';

type ApiPlatformId =
    | 'aerodrome'
    | 'aura'
    | 'balancer'
    | 'beefy'
    | 'beethovenx'
    | 'curve'
    | 'convex'
    | 'equilibria'
    | 'equalizer'
    | 'gamma'
    | 'ichi'
    | 'infrared'
    | 'lendle'
    | 'lynex'
    | 'magpie'
    | 'mendi'
    | 'silo'
    | 'nile'
    | 'euler'
    | 'swapx'
    | 'velodrome';

export type ApiStrategyTypeId = 'lp' | 'multi-lp' | 'multi-lp-locked' | 'cowcentrated';

export type ApiVault = {
    id: string;
    name: string;
    status: 'active' | 'eol';
    earnedTokenAddress: string;
    depositTokenAddresses?: string[];
    chain: string;
    platformId: ApiPlatformId;
    token: string;
    tokenAddress?: string;
    earnedToken: string;
    isGovVault?: boolean;
    strategyTypeId?: ApiStrategyTypeId;
    bridged?: object;
    assets?: string[];
    strategy: Hex;
    pointStructureIds?: string[];
};

export type ApiClmManager = {
    id: string;
    name: string;
    status: 'active' | 'eol';
    version: number;
    platformId: ApiPlatformId;
    strategyTypeId?: ApiStrategyTypeId;
    earnedToken: string;
    strategy: string;
    chain: string;
    type: 'cowcentrated' | 'others';
    tokenAddress: string; // underlying pool address
    depositTokenAddresses: string[]; // token0 and token1
    earnContractAddress: string; // reward pool address
    earnedTokenAddress: string; // clm manager address
    pointStructureIds?: string[];
};

export type ApiClmRewardPool = {
    id: string;
    status: 'active' | 'eol';
    version: number;
    platformId: ApiPlatformId;
    strategyTypeId?: ApiStrategyTypeId;
    chain: string;
    tokenAddress: string; // clm address (want)
    earnContractAddress: string; // reward pool address
    earnedTokenAddresses: string[]; // reward tokens
};

export type ApiGovVault = {
    id: string;
    status: 'active' | 'eol';
    version: number;
    chain: string;
    tokenAddress: string; // clm address
    earnContractAddress: string; // reward pool address
    earnedTokenAddresses: string[];
};

export type ApiBoost = {
    id: string;
    poolId: string;

    version: number;
    chain: string;
    status: 'active' | 'eol';

    tokenAddress: string; // underlying
    earnedTokenAddress: string; // reward token address
    earnContractAddress: string; // reward pool address
};

const protocol_map: Record<ApiPlatformId, BeefyProtocolType> = {
    aerodrome: 'solidly',
    aura: 'balancer_aura',
    balancer: 'balancer',
    beefy: 'beefy_clm',
    curve: 'curve',
    convex: 'curve',
    equilibria: 'pendle_equilibria',
    equalizer: 'solidly',
    gamma: 'gamma',
    ichi: 'ichi',
    infrared: 'infrared',
    lendle: 'aave',
    lynex: 'solidly',
    magpie: 'pendle_equilibria',
    mendi: 'aave',
    nile: 'solidly',
    velodrome: 'solidly',
    swapx: 'ichi',
    beethovenx: 'balancer',
    silo: 'aave',
    euler: 'euler',
};

export const getBeefyVaultConfigs = async (chain: ChainId): Promise<BeefyVault[]> => {
    const allConfigs = await getAllConfigs(chain);
    return allConfigs.filter((v) => !!v.protocol_type);
};

const getAllConfigs = async (chainId: ChainId): Promise<BeefyVault[]> => {
    const chain = getChainSlugFromChainId(chainId);
    const [cowVaultsData, mooVaultsData, clmRewardPoolData, [boostData, vaultRewardPoolData]] = await Promise.all([
        fetch(`${BEEFY_COW_VAULT_API}/${chain}`)
            .then((res) => res.json())
            .then((res) => (res as ApiClmManager[]).filter((vault) => vault.chain === String(chain))),
        fetch(`${BEEFY_MOO_VAULT_API}/${chain}`)
            .then((res) => res.json())
            .then((res) =>
                (res as ApiVault[])
                    .filter((vault) => vault.chain === String(chain))
                    .filter((vault) => vault.isGovVault !== true)
            ),
        fetch(`${BEEFY_GOV_API}/${chain}`)
            .then((res) => res.json())
            .then((res) =>
                (res as ApiClmRewardPool[]).filter((g) => g.chain === String(chain)).filter((g) => g.version === 2)
            ),
        fetch(`${BEEFY_BOOST_API}/${chain}`)
            .then((res) => res.json())
            .then((res) => [
                (res as ApiBoost[]).filter((g) => g.chain === String(chain)).filter((g) => g.version !== 2),
                (res as ApiBoost[]).filter((g) => g.chain === String(chain)).filter((g) => g.version === 2),
            ]),
    ]);

    const clmManagerAddresses = new Set(cowVaultsData.map((v) => v.earnedTokenAddress.toLocaleLowerCase()));
    const boostPerUnderlyingAddress = R.pipe(
        boostData,
        R.groupBy((b) => b.tokenAddress?.toLocaleLowerCase())
    );
    const vaultRewardPoolDataPerVaultAddress = R.pipe(
        vaultRewardPoolData,
        R.groupBy((v) => v.tokenAddress.toLocaleLowerCase())
    );
    const clmRewardPoolDataPerClmAddress = R.pipe(
        clmRewardPoolData,
        R.groupBy((c) => c.tokenAddress.toLocaleLowerCase())
    );

    const clmVaultConfigs = cowVaultsData.map((vault): BeefyVault => {
        const undelying_lp_address = vault.tokenAddress.toLocaleLowerCase() as Hex;
        const vault_address = vault.earnedTokenAddress.toLocaleLowerCase() as Hex;

        const protocol_type: BeefyProtocolType | undefined =
            vault.type === 'cowcentrated' ? 'beefy_clm' : protocol_map[vault.platformId];
        if (protocol_type === 'beefy_clm_vault') {
            throw new Error('Invalid protocol');
        }
        const reward_pools = clmRewardPoolDataPerClmAddress[vault_address] ?? [];

        const boosts = boostPerUnderlyingAddress[vault_address] ?? [];

        return {
            id: vault.id,
            is_active: vault.status === 'active',
            vault_address,
            chain: vault.chain,
            vault_token_symbol: vault.earnedToken,
            protocol_type,
            platformId: vault.platformId,
            strategy_address: vault.strategy.toLocaleLowerCase() as Hex,
            undelying_lp_address,
            reward_pools: reward_pools.map((pool) => ({
                id: pool.id,
                clm_address: pool.tokenAddress.toLocaleLowerCase() as Hex,
                reward_pool_address: pool.earnContractAddress.toLocaleLowerCase() as Hex,
            })),
            boosts: boosts.map((boost) => ({
                id: boost.id,
                boost_address: boost.earnedTokenAddress.toLocaleLowerCase() as Hex,
                underlying_address: boost.tokenAddress.toLocaleLowerCase() as Hex,
            })),
            pointStructureIds: vault.pointStructureIds ?? [],
        };
    });

    const mooVaultCofigs = R.pipe(
        mooVaultsData,
        R.map((vault): BeefyVault | null => {
            let underlying_lp_address = vault.tokenAddress?.toLocaleLowerCase() as Hex | undefined;
            const vault_address = vault.earnedTokenAddress.toLocaleLowerCase() as Hex;

            if (
                !underlying_lp_address &&
                (isNativeTokenSymbol(chainId, vault.token) || isNativeTokenSymbol(chainId, vault.name))
            ) {
                const wnative = getWNativeToken(chainId);
                underlying_lp_address = wnative.address as Hex;
            }

            if (!underlying_lp_address) {
                return null;
            }

            const protocol_type: BeefyProtocolType | undefined = clmManagerAddresses.has(underlying_lp_address)
                ? 'beefy_clm_vault'
                : protocol_map[vault.platformId];

            const additionalConfig =
                protocol_type === 'beefy_clm_vault'
                    ? {
                          protocol_type,
                          platformId: vault.platformId,
                          beefy_clm_manager: clmVaultConfigs.find(
                              (v) => v.vault_address === underlying_lp_address
                          ) as BeefyVault,
                      }
                    : { protocol_type, platformId: vault.platformId };
            const reward_pools = vaultRewardPoolDataPerVaultAddress[vault_address] ?? [];
            const boosts = boostPerUnderlyingAddress[vault_address] ?? [];
            return {
                id: vault.id,
                is_active: vault.status === 'active',
                vault_address,
                chain: vault.chain,
                vault_token_symbol: vault.earnedToken,
                ...additionalConfig,
                strategy_address: vault.strategy.toLocaleLowerCase() as Hex,
                undelying_lp_address: underlying_lp_address,
                reward_pools: reward_pools.map((pool) => ({
                    id: pool.id,
                    clm_address: pool.tokenAddress.toLocaleLowerCase() as Hex,
                    reward_pool_address: pool.earnContractAddress.toLocaleLowerCase() as Hex,
                })),
                boosts: boosts.map((boost) => ({
                    id: boost.id,
                    boost_address: boost.earnedTokenAddress.toLocaleLowerCase() as Hex,
                    underlying_address: boost.tokenAddress.toLocaleLowerCase() as Hex,
                })),
                pointStructureIds: vault.pointStructureIds ?? [],
            };
        }),
        R.filter((v) => v !== null)
    );

    const allConfigs = clmVaultConfigs.concat(mooVaultCofigs);
    return allConfigs;
};
