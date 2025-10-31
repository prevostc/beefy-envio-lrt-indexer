import type { handlerContext as HandlerContext } from 'generated';
import type { ClockTick_t } from 'generated/src/db/Entities.gen';
import type { ChainId } from '../lib/chain';

/**
 * Generate ClockTick ID: chainId + roundedTimestamp + period
 */
export const clockTickId = ({
    chainId,
    roundedTimestamp,
    period,
}: {
    chainId: ChainId;
    roundedTimestamp: bigint;
    period: bigint;
}): string => {
    return `${chainId}-${roundedTimestamp.toString()}-${period.toString()}`;
};

/**
 * Get ClockTick by ID
 */
export const getClockTick = async ({
    context,
    chainId,
    roundedTimestamp,
    period,
}: {
    context: HandlerContext;
    chainId: ChainId;
    roundedTimestamp: bigint;
    period: bigint;
}): Promise<ClockTick_t | null> => {
    const id = clockTickId({ chainId, roundedTimestamp, period });
    const clockTick = await context.ClockTick.get(id);
    return clockTick ?? null;
};

/**
 * Create or get existing ClockTick
 */
export const createClockTick = async ({
    context,
    chainId,
    roundedTimestamp,
    period,
    timestamp,
    blockNumber,
}: {
    context: HandlerContext;
    chainId: ChainId;
    roundedTimestamp: bigint;
    period: bigint;
    timestamp: bigint;
    blockNumber: bigint;
}): Promise<ClockTick_t> => {
    const id = clockTickId({ chainId, roundedTimestamp, period });
    const existing = await context.ClockTick.get(id);

    if (existing) {
        return existing;
    }

    const clockTick: ClockTick_t = {
        id,
        period,
        roundedTimestamp,
        timestamp,
        blockNumber,
    } as unknown as ClockTick_t;

    context.ClockTick.set(clockTick);
    return clockTick;
};
