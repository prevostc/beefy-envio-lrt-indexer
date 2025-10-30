import { type EffectContext, experimental_createEffect, S } from 'envio';
import type { HandlerContext } from 'generated/src/Types';
import type { Hex } from 'viem';
import { type ChainId, chainIdSchema } from '../lib/chain';
import { type BeefyVault, getBeefyVaultConfigs } from '../lib/vault-breakdown/vault/getBeefyVaultConfig';

const getBeefyVaultConfigsEffect = experimental_createEffect(
    {
        name: 'getBeefyVaultConfigs',
        input: {
            chainId: chainIdSchema,
            cacheBuster: S.bigint,
        },
        output: S.string,
        cache: true,
    },
    async ({ input }) => {
        const { chainId } = input;
        const configs = await getBeefyVaultConfigs(chainId);

        // stringify to avoid defining a proper S schema for the BeefyVault type
        return JSON.stringify(configs);
    }
);

export const getBeefyVaultConfigForAddress = async ({
    context,
    chainId,
    address,
}: {
    context: HandlerContext | EffectContext;
    chainId: ChainId;
    address: Hex;
}) => {
    const rawConfigs = await context.effect(getBeefyVaultConfigsEffect, {
        chainId,
        cacheBuster: BigInt(Math.floor(Date.now() / (1000 * 60 * 60))),
    });

    const configs = JSON.parse(rawConfigs) as BeefyVault[];
    const found = configs.find((v) => v.vault_address.toLowerCase() === (address as Hex).toLowerCase());

    if (!found) {
        context.log.error('Vault config not found', { chainId, address });
        throw new Error(`Vault config not found for vault ${chainId}:${address}`);
    }
    return found;
};
