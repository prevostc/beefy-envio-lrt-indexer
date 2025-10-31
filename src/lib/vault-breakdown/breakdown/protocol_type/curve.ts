import { getAddress, type Hex } from 'viem';
import type { BeefyViemClient } from '../../../viem';
import { BeefyVaultV7Abi } from '../../abi/BeefyVaultV7Abi';
import { CurvePoolAbi } from '../../abi/CurvePool';
import { CurveTokenAbi } from '../../abi/CurveToken';
import type { BeefyVault } from '../../vault/getBeefyVaultConfig';
import type { BeefyVaultBreakdown } from '../types';

/**
 * @dev This breaks when the lp token and lp pool are different
 * @dev Does not break down meta pools
 * TODO try to find an on-chain way to get the lp pool (as vault only provides the lp token)
 * TODO try to break down meta pools (where one token of the pool is another pool)
 */
export const getCurveVaultBreakdown = async (
    client: BeefyViemClient,
    blockNumber: bigint,
    vault: BeefyVault
): Promise<BeefyVaultBreakdown> => {
    const curvePoolAddress = getAddress(vault.undelying_lp_address);
    const results = await client.multicall({
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
                address: curvePoolAddress,
                abi: CurveTokenAbi,
                functionName: 'totalSupply',
            },
            {
                address: curvePoolAddress,
                abi: CurvePoolAbi,
                functionName: 'coins',
                args: [0n],
            },
            {
                address: curvePoolAddress,
                abi: CurvePoolAbi,
                functionName: 'coins',
                args: [1n],
            },
            {
                address: curvePoolAddress,
                abi: CurvePoolAbi,
                functionName: 'coins',
                args: [2n],
            },
            {
                address: curvePoolAddress,
                abi: CurvePoolAbi,
                functionName: 'coins',
                args: [3n],
            },
            {
                address: curvePoolAddress,
                abi: CurvePoolAbi,
                functionName: 'coins',
                args: [4n],
            },
            {
                address: curvePoolAddress,
                abi: CurvePoolAbi,
                functionName: 'coins',
                args: [5n],
            },
            {
                address: curvePoolAddress,
                abi: CurvePoolAbi,
                functionName: 'balances',
                args: [0n],
            },
            {
                address: curvePoolAddress,
                abi: CurvePoolAbi,
                functionName: 'balances',
                args: [1n],
            },
            {
                address: curvePoolAddress,
                abi: CurvePoolAbi,
                functionName: 'balances',
                args: [2n],
            },
            {
                address: curvePoolAddress,
                abi: CurvePoolAbi,
                functionName: 'balances',
                args: [3n],
            },
            {
                address: curvePoolAddress,
                abi: CurvePoolAbi,
                functionName: 'balances',
                args: [4n],
            },
            {
                address: curvePoolAddress,
                abi: CurvePoolAbi,
                functionName: 'balances',
                args: [5n],
            },
        ],
        allowFailure: true,
        blockNumber,
    });

    const vaultWantBalance = results[0].status === 'success' ? results[0].result : null;
    const vaultTotalSupply = results[1].status === 'success' ? results[1].result : null;
    const curveTotalSupply = results[2].status === 'success' ? results[2].result : null;
    const coin0 = results[3].status === 'success' ? results[3].result : null;
    const coin1 = results[4].status === 'success' ? results[4].result : null;
    const coin2 = results[5].status === 'success' ? results[5].result : null;
    const coin3 = results[6].status === 'success' ? results[6].result : null;
    const coin4 = results[7].status === 'success' ? results[7].result : null;
    const coin5 = results[8].status === 'success' ? results[8].result : null;
    const balance0 = results[9].status === 'success' ? results[9].result : null;
    const balance1 = results[10].status === 'success' ? results[10].result : null;
    const balance2 = results[11].status === 'success' ? results[11].result : null;
    const balance3 = results[12].status === 'success' ? results[12].result : null;
    const balance4 = results[13].status === 'success' ? results[13].result : null;
    const balance5 = results[14].status === 'success' ? results[14].result : null;

    if (vaultWantBalance === null || vaultTotalSupply === null || curveTotalSupply === null) {
        throw new Error('Required contract calls failed');
    }

    const coins = [coin0, coin1, coin2, coin3, coin4, coin5].filter((coin) => coin !== null) as Hex[];
    const balances = [balance0, balance1, balance2, balance3, balance4, balance5].filter(
        (balance) => balance !== null
    ) as bigint[];

    return {
        vault,
        blockNumber,
        vaultTotalSupply,
        isLiquidityEligible: true,
        balances: coins.map((coin, i) => ({
            tokenAddress: coin,
            vaultBalance: (vaultWantBalance * balances[i]) / curveTotalSupply,
        })),
    };
};
