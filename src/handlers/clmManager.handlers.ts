import { ClmManager } from 'generated';
import { toChainId } from '../lib/chain';

ClmManager.Initialized.handler(async ({ event, context }) => {
    const chainId = toChainId(event.chainId);
    context.log.info('ClmManager initialized (no-op in current schema)', {
        address: event.srcAddress.toString().toLowerCase(),
        chainId,
    });
});

ClmManager.Transfer.handler(async () => {
    // No-op for current schema
});
