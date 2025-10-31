import type { BeefyViemClient } from '../../../viem';
import { BeefyVaultV7Abi } from '../../abi/BeefyVaultV7Abi';
import type { BeefyVault } from '../../vault/getBeefyVaultConfig';
import type { BeefyVaultBreakdown } from '../types';

export const getEulerVaultBreakdown = async (
    client: BeefyViemClient,
    blockNumber: bigint,
    vault: BeefyVault
): Promise<BeefyVaultBreakdown> => {
    // euler vaults are single tokens, a simple balance() call is enough
    // https://plasmascan.to/address/0x5aF45b3A8cB44B444dDf9cCEB90F5998EAc0FC97/contract/9745/readProxyContract
    // https://app.beefy.finance/vault/euler-plasma-k3capital-usdt0

    const [vaultWantBalance, vaultTotalSupply] = await client.multicall({
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
        vaultTotalSupply: vaultTotalSupply,
        isLiquidityEligible: true,
        balances: [
            {
                tokenAddress: vault.undelying_lp_address,
                vaultBalance: vaultWantBalance,
            },
        ],
    };
};
