import { experimental_createEffect, S } from 'envio';
import type { Hex } from 'viem';
import { chainIdSchema } from '../lib/chain';
import { hexSchema } from '../lib/hex';
import { type BeefyVault, getBeefyVaultConfigs } from '../lib/vault-breakdown/vault/getBeefyVaultConfig';

const getBeefyVaultConfigsEffect = experimental_createEffect(
    {
        name: 'getBeefyVaultConfigs',
        input: {
            chainId: chainIdSchema,
            cacheBuster: S.bigint,
        },
        output: S.array(S.unknown as unknown as S.Schema<BeefyVault>),
        cache: true,
    },
    async ({ input }) => {
        const { chainId } = input;
        const configs = await getBeefyVaultConfigs(chainId);
        return configs;
    }
);

export const getBeefyVaultConfigForAddressEffect = experimental_createEffect(
    {
        name: 'getBeefyVaultConfigForAddress',
        input: {
            chainId: chainIdSchema,
            blockNumber: S.bigint, // used to control cache
            address: hexSchema,
        },
        output: S.unknown as unknown as S.Schema<BeefyVault>,
        cache: false,
    },
    async ({ input, context }) => {
        const { chainId, address, blockNumber } = input;

        const configs = await context.effect(getBeefyVaultConfigsEffect, {
            chainId,
            cacheBuster: blockNumber / 100_000n,
        });
        const found = configs.find((v) => v.vault_address.toLowerCase() === (address as Hex).toLowerCase());
        if (!found) {
            throw new Error(`Vault config not found for address ${address}`);
        }
        return found;
    }
);
