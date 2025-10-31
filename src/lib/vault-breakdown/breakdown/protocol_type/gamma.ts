import { getAddress, type Hex } from 'viem';
import type { BeefyViemClient } from '../../../viem';
import { BeefyVaultV7Abi } from '../../abi/BeefyVaultV7Abi';
import { GammaHypervisorAbi } from '../../abi/GammaHypervisorAbi';
import type { BeefyVault } from '../../vault/getBeefyVaultConfig';
import type { BeefyVaultBreakdown } from '../types';

export const getGammaVaultBreakdown = async (
    client: BeefyViemClient,
    blockNumber: bigint,
    vault: BeefyVault
): Promise<BeefyVaultBreakdown> => {
    const hypervisorAddress = getAddress(vault.undelying_lp_address);
    const [balance, vaultTotalSupply, totalSupply, totalAmounts, token0, token1] = await client.multicall({
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
                address: hypervisorAddress,
                abi: GammaHypervisorAbi,
                functionName: 'totalSupply',
            },
            {
                address: hypervisorAddress,
                abi: GammaHypervisorAbi,
                functionName: 'getTotalAmounts',
            },
            {
                address: hypervisorAddress,
                abi: GammaHypervisorAbi,
                functionName: 'token0',
            },
            {
                address: hypervisorAddress,
                abi: GammaHypervisorAbi,
                functionName: 'token1',
            },
        ],
        allowFailure: false,
        blockNumber,
    });

    return {
        vault,
        blockNumber,
        vaultTotalSupply,
        isLiquidityEligible: true,
        balances: [
            {
                tokenAddress: token0.toLocaleLowerCase() as Hex,
                vaultBalance: (totalAmounts[0] * balance) / totalSupply,
            },
            {
                tokenAddress: token1.toLocaleLowerCase() as Hex,
                vaultBalance: (totalAmounts[1] * balance) / totalSupply,
            },
        ],
    };
};
