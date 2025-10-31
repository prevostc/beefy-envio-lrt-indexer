import { erc20Abi, getContract, type Hex } from 'viem';
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
    const vaultContract = getContract({
        client,
        address: vault.vault_address,
        abi: BeefyVaultV7Abi,
    });

    const balancerPoolContract = getContract({
        client,
        address: vault.undelying_lp_address,
        abi: BalancerPoolAbi,
    });

    const [vaultWantBalance, vaultTotalSupply, balancerVaultAddress, balancerPoolId, balancerTotalSupply] =
        await Promise.all([
            vaultContract.read.balance({ blockNumber }),
            vaultContract.read.totalSupply({ blockNumber }),
            balancerPoolContract.read.getVault({ blockNumber }),
            balancerPoolContract.read.getPoolId({ blockNumber }),
            balancerPoolContract.read.getActualSupply({ blockNumber }),
        ]);

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
    const vaultContract = getContract({
        client,
        address: vault.vault_address,
        abi: BeefyVaultV7Abi,
    });

    const strategyContract = getContract({
        client,
        address: vault.strategy_address,
        abi: ClassiBalancerStrategyAbi,
    });

    const poolContract = getContract({
        client,
        address: vault.undelying_lp_address,
        abi: erc20Abi,
    });

    const [vaultWantBalance, vaultTotalSupply, balancerVaultAddress, poolTotalSupply] = await Promise.all([
        vaultContract.read.balance({ blockNumber }),
        vaultContract.read.totalSupply({ blockNumber }),
        strategyContract.read.balancerVault({ blockNumber }),
        poolContract.read.totalSupply({ blockNumber }),
    ]);

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
