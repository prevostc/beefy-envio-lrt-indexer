import { erc20Abi, getAddress, getContract, type Hex } from 'viem';
import type { BeefyViemClient } from '../../../viem';
import { BalancerPoolAbi } from '../../abi/BalancerPool';
import { BalancerVaultAbi } from '../../abi/BalancerVault';
import { BeefyVaultV7Abi } from '../../abi/BeefyVaultV7Abi';
import { ClassiBalancerStrategyAbi } from '../../abi/ClassicBalancerStrategy';
import type { BeefyVault } from '../../vault/getBeefyVaultConfig';
import type { BeefyVaultBreakdown } from '../types';

export const getBalancerAuraVaultBreakdown = async (
    client: BeefyViemClient,
    blockNumber: bigint,
    vault: BeefyVault
): Promise<BeefyVaultBreakdown> => {
    const balancerPoolAddress = getAddress(vault.undelying_lp_address);

    const [vaultWantBalance, vaultTotalSupply, balancerVaultAddress, balancerPoolId, balancerTotalSupply] =
        await client.multicall({
            contracts: [
                {
                    address: vault.vault_address,
                    abi: BeefyVaultV7Abi,
                    functionName: 'balance',
                },
                {
                    address: vault.vault_address,
                    abi: BeefyVaultV7Abi,
                    functionName: 'totalSupply',
                },
                {
                    address: balancerPoolAddress,
                    abi: BalancerPoolAbi,
                    functionName: 'getVault',
                },
                {
                    address: balancerPoolAddress,
                    abi: BalancerPoolAbi,
                    functionName: 'getPoolId',
                },
                {
                    address: balancerPoolAddress,
                    abi: BalancerPoolAbi,
                    functionName: 'getActualSupply',
                },
            ],
            allowFailure: false,
            blockNumber,
        });

    const balancerVaultContract = getContract({
        client,
        address: balancerVaultAddress,
        abi: BalancerVaultAbi,
    });
    const poolTokenRes = await balancerVaultContract.read.getPoolTokens([balancerPoolId], {
        blockNumber,
    });
    const poolTokens = poolTokenRes[0];
    const poolBalances = poolTokenRes[1];

    return {
        vault,
        blockNumber,
        vaultTotalSupply,
        isLiquidityEligible: true,
        balances: poolTokens.map((poolToken, i) => ({
            tokenAddress: poolToken.toLocaleLowerCase() as Hex,
            vaultBalance: (poolBalances[i] * vaultWantBalance) / balancerTotalSupply,
        })),
    };
};

export const getBalancerVaultBreakdown = async (
    client: BeefyViemClient,
    blockNumber: bigint,
    vault: BeefyVault
): Promise<BeefyVaultBreakdown> => {
    const balancerPoolAddress = getAddress(vault.undelying_lp_address);

    const [vaultWantBalance, vaultTotalSupply, balancerVaultAddress, poolTotalSupply] = await client.multicall({
        contracts: [
            {
                address: vault.vault_address,
                abi: BeefyVaultV7Abi,
                functionName: 'balance',
            },
            {
                address: vault.vault_address,
                abi: BeefyVaultV7Abi,
                functionName: 'totalSupply',
            },
            {
                address: vault.strategy_address,
                abi: ClassiBalancerStrategyAbi,
                functionName: 'balancerVault',
            },
            {
                address: balancerPoolAddress,
                abi: erc20Abi,
                functionName: 'totalSupply',
            },
        ],
        allowFailure: false,
        blockNumber,
    });

    const balancerVaultContract = getContract({
        client,
        address: balancerVaultAddress,
        abi: BalancerVaultAbi,
    });
    const [poolTokens, _, poolBalances] = await balancerVaultContract.read.getPoolTokenInfo(
        [vault.undelying_lp_address],
        {
            blockNumber,
        }
    );
    return {
        vault,
        blockNumber,
        vaultTotalSupply,
        isLiquidityEligible: true,
        balances: poolTokens.map((poolToken, i) => ({
            tokenAddress: poolToken.toLocaleLowerCase() as Hex,
            vaultBalance: (poolBalances[i] * vaultWantBalance) / poolTotalSupply,
        })),
    };
};
