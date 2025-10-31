import type { Hex } from 'viem';
import type { BeefyViemClient } from '../../../viem';
import { BeefyVaultV7Abi } from '../../abi/BeefyVaultV7Abi';
import type { BeefyVault } from '../../vault/getBeefyVaultConfig';
import type { BeefyVaultBreakdown } from '../types';

/**
 * @dev assumes no lend/borrow looping
 */
export const getAaveVaultBreakdown = async (
    client: BeefyViemClient,
    blockNumber: bigint,
    vault: BeefyVault
): Promise<BeefyVaultBreakdown> => {
    const [balance, vaultTotalSupply] = await client.multicall({
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
                tokenAddress: vault.undelying_lp_address.toLocaleLowerCase() as Hex,
                vaultBalance: balance,
            },
        ],
    };
};
