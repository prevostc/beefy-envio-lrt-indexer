import { createEffect } from 'envio';
import { chainIdSchema } from '../lib/chain';
import { ADDRESS_ZERO } from '../lib/decimal';
import { hexSchema } from '../lib/hex';
import { getViemClient } from '../lib/viem';

export const getClmManagerTokens = createEffect(
    {
        name: 'getClmManagerTokens',
        input: {
            vaultAddress: hexSchema,
            chainId: chainIdSchema,
        },
        output: {
            shareTokenAddress: hexSchema,
            underlyingToken0Address: hexSchema,
            underlyingToken1Address: hexSchema,
            strategyAddress: hexSchema,
        },
        rateLimit: false,
        cache: true,
    },
    async ({ input, context }) => {
        try {
            const { vaultAddress, chainId } = input;
            const client = getViemClient(chainId, context.log);

            context.log.debug('Fetching ClmManager tokens', { vaultAddress, chainId });

            const [wantsResult, strategyResult] = await client.multicall({
                allowFailure: true,
                contracts: [
                    {
                        address: vaultAddress as `0x${string}`,
                        abi: [
                            {
                                inputs: [],
                                name: 'wants',
                                outputs: [
                                    { name: 'token0', type: 'address' },
                                    { name: 'token1', type: 'address' },
                                ],
                                stateMutability: 'view',
                                type: 'function',
                            },
                        ],
                        functionName: 'wants',
                        args: [],
                    },
                    {
                        address: vaultAddress as `0x${string}`,
                        abi: [
                            {
                                inputs: [],
                                name: 'strategy',
                                outputs: [{ name: '', type: 'address' }],
                                stateMutability: 'view',
                                type: 'function',
                            },
                        ],
                        functionName: 'strategy',
                        args: [],
                    },
                ],
            });

            // The vault contract itself is the share token
            const shareTokenAddress = vaultAddress;

            if (wantsResult.status === 'failure') {
                context.log.error('ClmManager wants call failed', { vaultAddress, chainId, wantsResult });
                throw new Error('ClmManager wants call failed');
            }

            const [underlyingToken0Address, underlyingToken1Address] = wantsResult.result;

            if (strategyResult.status === 'failure') {
                context.log.error('ClmManager strategy call failed', { vaultAddress, chainId, strategyResult });
                throw new Error('ClmManager strategy call failed');
            }

            const strategyAddress = strategyResult.result;

            context.log.info('ClmManager data fetched', {
                vaultAddress,
                shareTokenAddress,
                underlyingToken0Address,
                underlyingToken1Address,
                strategyAddress,
            });

            if (underlyingToken0Address === ADDRESS_ZERO || underlyingToken1Address === ADDRESS_ZERO) {
                throw new Error('ClmManager underlying token is zero address');
            }

            return {
                shareTokenAddress,
                underlyingToken0Address,
                underlyingToken1Address,
                strategyAddress,
            };
        } catch (error) {
            context.cache = false;
            throw error;
        }
    }
);
