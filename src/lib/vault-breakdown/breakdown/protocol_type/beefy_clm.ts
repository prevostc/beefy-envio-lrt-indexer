import type { Hex } from 'viem';
import type { BeefyViemClient } from '../../../viem';
import { BeefyClmStrategyAbi } from '../../abi/BeefyClmStrategy';
import { BeefyVaultConcLiqAbi } from '../../abi/BeefyVaultConcLiq';
import { BeefyVaultV7Abi } from '../../abi/BeefyVaultV7Abi';
import type { BeefyVault } from '../../vault/getBeefyVaultConfig';
import type { BeefyVaultBreakdown } from '../types';

export const getBeefyClmManagerBreakdown = async (
    client: BeefyViemClient,
    blockNumber: bigint,
    vault: BeefyVault
): Promise<BeefyVaultBreakdown> => {
    const [balances, vaultTotalSupply, wants, range, price] = await client.multicall({
        contracts: [
            {
                address: vault.vault_address,
                abi: BeefyVaultConcLiqAbi,
                functionName: 'balances',
            },
            {
                address: vault.vault_address,
                abi: BeefyVaultConcLiqAbi,
                functionName: 'totalSupply',
            },
            {
                address: vault.vault_address,
                abi: BeefyVaultConcLiqAbi,
                functionName: 'wants',
            },
            {
                address: vault.strategy_address,
                abi: BeefyClmStrategyAbi,
                functionName: 'range',
            },
            {
                address: vault.strategy_address,
                abi: BeefyClmStrategyAbi,
                functionName: 'price',
            },
        ],
        allowFailure: false,
        blockNumber,
    });

    // special rule to exclude out of range liquidity for concentrated liquidity vaults
    const isLiquidityEligible = price >= range[0] && price <= range[1];

    return {
        vault,
        blockNumber,
        vaultTotalSupply,
        isLiquidityEligible,
        balances: [
            {
                tokenAddress: wants[0].toLocaleLowerCase() as Hex,
                vaultBalance: balances[0],
            },
            {
                tokenAddress: wants[1].toLocaleLowerCase() as Hex,
                vaultBalance: balances[1],
            },
        ],
    };
};

export const getBeefyClmVaultBreakdown = async (
    client: BeefyViemClient,
    blockNumber: bigint,
    vault: BeefyVault
): Promise<BeefyVaultBreakdown> => {
    if (vault.protocol_type !== 'beefy_clm_vault') {
        throw new Error(`Invalid protocol type ${vault.protocol_type}`);
    }

    const underlyingClmBreakdown = await getBeefyClmManagerBreakdown(client, blockNumber, vault.beefy_clm_manager);

    const [underlyingBalance, vaultTotalSupply, underlyingTotalSypply] = await client.multicall({
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
                address: vault.undelying_lp_address,
                abi: BeefyVaultConcLiqAbi,
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
        isLiquidityEligible: underlyingClmBreakdown.isLiquidityEligible,
        balances: underlyingClmBreakdown.balances.map((tokenBalance) => ({
            tokenAddress: tokenBalance.tokenAddress,
            vaultBalance:
                (underlyingBalance *
                    (typeof tokenBalance.vaultBalance === 'bigint'
                        ? tokenBalance.vaultBalance
                        : BigInt(Math.trunc(tokenBalance.vaultBalance)))) /
                underlyingTotalSypply,
        })),
    };
};
