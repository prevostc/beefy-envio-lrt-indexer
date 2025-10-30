import type { handlerContext as HandlerContext } from 'generated';
import type { Investor_t } from 'generated/src/db/Entities.gen';
import type { Hex } from 'viem';

export const investorId = ({ address }: { address: Hex }) => `${address.toLowerCase()}`;

export const getOrCreateInvestor = async ({
    context,
    address,
}: {
    context: HandlerContext;
    address: Hex;
}): Promise<Investor_t> => {
    const id = investorId({ address });
    const existing = await context.Investor.get(id);
    if (existing) {
        return existing;
    }
    const entity: Investor_t = {
        id,
        address,
    } as unknown as Investor_t;
    context.Investor.set(entity);
    return entity;
};
