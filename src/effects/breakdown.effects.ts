import { createEffect, S } from 'envio';
import type { Hex } from 'viem';
import { chainIdSchema } from '../lib/chain';
import { getVaultBreakdowns } from '../lib/vault-breakdown/breakdown/getVaultBreakdown';
import type { BeefyProtocolType } from '../lib/vault-breakdown/vault/getBeefyVaultConfig';
import { getViemClient } from '../lib/viem';
import { getBeefyVaultConfigForAddress } from './vaultConfig.effects';

export const getVaultTvlBreakdownEffect = createEffect(
    {
        name: 'getVaultTvlBreakdown',
        input: {
            chainId: chainIdSchema,
            blockNumber: S.bigint,
            vault: S.schema({
                address: S.string as unknown as S.Schema<Hex>,
                protocolType: S.string as unknown as S.Schema<BeefyProtocolType>,
            }),
        },
        output: S.schema({
            vaultTotalSupply: S.bigint,
            balances: S.array(
                S.schema({
                    tokenAddress: S.string as unknown as S.Schema<Hex>,
                    tokenBalance: S.bigint,
                })
            ),
        }),
        rateLimit: false,
        cache: true,
    },
    async ({ input, context }) => {
        try {
            const { chainId, blockNumber, vault } = input;
            const client = getViemClient(chainId, context.log);
            const vaultConfig = await getBeefyVaultConfigForAddress({
                context,
                chainId,
                vaultOrRewardPoolAddress: vault.address,
            });
            const breakdown = await getVaultBreakdowns(client, blockNumber, vaultConfig);
            return {
                vaultTotalSupply: breakdown.vaultTotalSupply,
                balances: breakdown.balances.map((balance) => ({
                    tokenAddress: balance.tokenAddress,
                    tokenBalance: BigInt(balance.vaultBalance),
                })),
            };
        } catch (error) {
            context.cache = false;
            throw error;
        }
    }
);
