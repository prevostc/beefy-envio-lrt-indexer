import type { handlerContext as HandlerContext } from 'generated';
import type {
    BeefyVault_t,
    BeefyVaultBreakdownToken_t,
    BeefyVaultUnderlyingToken_t,
    Token_t,
} from 'generated/src/db/Entities.gen';
import type { ChainId } from '../lib/chain';

export const beefyVaultUnderlyingTokenId = ({
    chainId,
    vault,
    token,
}: {
    chainId: ChainId;
    vault: BeefyVault_t;
    token: Token_t;
}): string => `${chainId}-${vault.address.toLowerCase()}-${token.address.toLowerCase()}`;

export const getOrCreateBeefyVaultUnderlyingToken = async ({
    context,
    chainId,
    vault,
    token,
}: {
    context: HandlerContext;
    chainId: ChainId;
    vault: BeefyVault_t;
    token: Token_t;
}): Promise<BeefyVaultUnderlyingToken_t> => {
    const id = beefyVaultUnderlyingTokenId({ chainId, vault, token });
    const existing = await context.BeefyVaultUnderlyingToken.get(id);
    if (existing) return existing;
    const entity: BeefyVaultUnderlyingToken_t = {
        id,
        chainId,
        vault_id: vault.id,
        token_id: token.id,
    } as unknown as BeefyVaultUnderlyingToken_t;
    context.BeefyVaultUnderlyingToken.set(entity);
    return entity;
};

export const beefyVaultBreakdownTokenId = ({
    chainId,
    vault,
    token,
}: {
    chainId: ChainId;
    vault: BeefyVault_t;
    token: Token_t;
}): string => `${chainId}-${vault.address.toLowerCase()}-${token.address.toLowerCase()}`;

export const getOrCreateBeefyVaultBreakdownToken = async ({
    context,
    chainId,
    vault,
    token,
}: {
    context: HandlerContext;
    chainId: ChainId;
    vault: BeefyVault_t;
    token: Token_t;
}): Promise<BeefyVaultBreakdownToken_t> => {
    const id = beefyVaultBreakdownTokenId({ chainId, vault, token });
    const existing = await context.BeefyVaultBreakdownToken.get(id);
    if (existing) return existing;
    const entity: BeefyVaultBreakdownToken_t = {
        id,
        chainId,
        vault_id: vault.id,
        token_id: token.id,
    } as unknown as BeefyVaultBreakdownToken_t;
    context.BeefyVaultBreakdownToken.set(entity);
    return entity;
};
