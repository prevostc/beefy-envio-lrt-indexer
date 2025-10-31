import { BigDecimal, type handlerContext as HandlerContext } from 'generated';
import type { BeefyStrategy_t, BeefyVault_t, Token_t } from 'generated/src/db/Entities.gen';
import type { Hex } from 'viem';
import type { ChainId } from '../lib/chain';
import { InitializableStatus } from '../lib/initializableStatus';
import { getOrCreateBeefyVaultUnderlyingToken } from './vaultToken.entity';

export const beefyVaultId = ({ chainId, address }: { chainId: ChainId; address: Hex }) =>
    `${chainId}-${address.toLowerCase()}`;

export const getBeefyVault = async (context: HandlerContext, chainId: ChainId, address: Hex) => {
    const id = beefyVaultId({ chainId, address });
    return await context.BeefyVault.get(id);
};

/**
 * Get vault by ID, returns null if not found
 */
export const getBeefyVaultById = async ({
    context,
    id,
}: {
    context: HandlerContext;
    id: string;
}): Promise<BeefyVault_t | null> => {
    const vault = await context.BeefyVault.get(id);
    return vault ?? null;
};

/**
 * Update vault entity
 */
export const updateBeefyVault = async ({
    context,
    vault,
}: {
    context: HandlerContext;
    vault: BeefyVault_t;
}): Promise<void> => {
    context.BeefyVault.set(vault);
};

export const createBeefyVault = async ({
    context,
    chainId,
    address,
    sharesToken,
    underlyingTokens,
    strategyAddress,
    vaultId,
    underlyingPlatform,
    initializedBlockNumber,
    initializedTimestamp,
}: {
    context: HandlerContext;
    chainId: ChainId;
    address: Hex;
    sharesToken: Token_t;
    underlyingTokens: Token_t[];
    strategyAddress: Hex;
    vaultId: string;
    underlyingPlatform: string;
    initializedBlockNumber: bigint;
    initializedTimestamp: bigint;
}): Promise<BeefyVault_t> => {
    const id = beefyVaultId({ chainId, address });
    context.log.debug('Getting or creating beefy vault', { id });
    const vault: BeefyVault_t = {
        id,
        chainId,
        address,
        sharesToken_id: sharesToken.id,
        strategy_id: `${chainId}-${strategyAddress.toLowerCase()}`,
        initializableStatus: InitializableStatus.INITIALIZED,
        underlyingPlatform,
        vaultId,
        lastBalanceBreakdownUpdateBlockNumber: initializedBlockNumber,
        lastBalanceBreakdownUpdateTimestamp: initializedTimestamp,
        sharesTokenTotalSupply: new BigDecimal(0),
        breakdownTokensOrder: underlyingTokens.map((token) => token.id),
    } as unknown as BeefyVault_t;

    context.BeefyVault.set(vault);

    // Create underlying token entities for all tokens
    await Promise.all(
        underlyingTokens.map((token) => getOrCreateBeefyVaultUnderlyingToken({ context, chainId, vault, token }))
    );

    await createBeefyStrategy({ context, chainId, strategyAddress, vault });

    return vault;
};

/**
 * Get all vaults for a chain
 */
export const getAllBeefyVaultsForChain = async ({
    context,
    chainId,
}: {
    context: HandlerContext;
    chainId: ChainId;
}): Promise<BeefyVault_t[]> => {
    return await context.BeefyVault.getWhere.chainId.eq(chainId);
};

export const getBeefyStrategyId = ({ chainId, address }: { chainId: ChainId; address: Hex }) =>
    `${chainId}-${address.toLowerCase()}`;

export const createBeefyStrategy = async ({
    context,
    chainId,
    strategyAddress,
    vault,
}: {
    context: HandlerContext;
    chainId: ChainId;
    strategyAddress: Hex;
    vault: BeefyVault_t;
}): Promise<BeefyStrategy_t> => {
    const id = getBeefyStrategyId({ chainId, address: strategyAddress });
    context.log.debug('Getting or creating beefy strategy', { id });
    const strategy: BeefyStrategy_t = {
        id,
        chainId,
        address: strategyAddress,
        vault_id: vault.id,
        initializableStatus: InitializableStatus.INITIALIZED,
    } as unknown as BeefyStrategy_t;
    context.BeefyStrategy.set(strategy);
    return strategy;
};
