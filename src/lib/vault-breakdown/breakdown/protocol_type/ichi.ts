import { getAddress, type Hex } from 'viem';
import type { BeefyViemClient } from '../../../viem';
import { BeefyVaultV7Abi } from '../../abi/BeefyVaultV7Abi';
import { IchiAlmAbi } from '../../abi/IchiAlmAbi';
import type { BeefyVault } from '../../vault/getBeefyVaultConfig';
import type { BeefyVaultBreakdown } from '../types';

export const getGammaVaultBreakdown = async (
    client: BeefyViemClient,
    blockNumber: bigint,
    vault: BeefyVault
): Promise<BeefyVaultBreakdown> => {
    const almAddress = getAddress(vault.undelying_lp_address);
    const [balance, vaultTotalSupply, totalSupply, basePosition, limitPosition, token0, token1] =
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
                    address: almAddress,
                    abi: IchiAlmAbi,
                    functionName: 'totalSupply',
                },
                {
                    address: almAddress,
                    abi: IchiAlmAbi,
                    functionName: 'getBasePosition',
                },
                {
                    address: almAddress,
                    abi: IchiAlmAbi,
                    functionName: 'getLimitPosition',
                },
                {
                    address: almAddress,
                    abi: IchiAlmAbi,
                    functionName: 'token0',
                },
                {
                    address: almAddress,
                    abi: IchiAlmAbi,
                    functionName: 'token1',
                },
            ],
            allowFailure: false,
            blockNumber,
        });

    const position0 = basePosition[0] + limitPosition[0];
    const position1 = basePosition[1] + limitPosition[1];

    return {
        vault,
        blockNumber,
        vaultTotalSupply,
        isLiquidityEligible: true,
        balances: [
            {
                tokenAddress: token0.toLocaleLowerCase() as Hex,
                vaultBalance: (position0 * balance) / totalSupply,
            },
            {
                tokenAddress: token1.toLocaleLowerCase() as Hex,
                vaultBalance: (position1 * balance) / totalSupply,
            },
        ],
    };
};
