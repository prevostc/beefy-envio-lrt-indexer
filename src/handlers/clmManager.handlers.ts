import { ClmManager } from 'generated';
import type { Hex } from 'viem';
import { getBeefyVault } from '../entities/beefyVault.entity';
import { getOrCreateInvestor } from '../entities/investor.entity';
import { getOrCreateInvestorPosition } from '../entities/investorPosition.entity';
import { toChainId } from '../lib/chain';
import { interpretAsDecimal } from '../lib/decimal';

ClmManager.Initialized.handler(async ({ event, context }) => {
    const chainId = toChainId(event.chainId);
    context.log.info('ClmManager initialized (no-op in current schema)', {
        address: event.srcAddress.toString().toLowerCase(),
        chainId,
    });
});

ClmManager.Transfer.handler(async ({ event, context }) => {
    const chainId = toChainId(event.chainId);
    const vaultAddress = event.srcAddress.toString().toLowerCase() as Hex;

    // ClmManager is also a BeefyVault, so get the vault directly
    const vault = await getBeefyVault(context, chainId, vaultAddress);
    if (!vault) {
        // Vault might not be initialized yet, log and skip
        context.log.warn('ClmManager vault not found, skipping transfer', { vaultAddress, chainId });
        return;
    }

    const sender = event.params.from.toString().toLowerCase() as Hex;
    const receiver = event.params.to.toString().toLowerCase() as Hex;
    const amount = event.params.value;

    const sharesToken = await context.Token.get(vault.sharesToken_id);
    if (!sharesToken) return;

    const value = interpretAsDecimal(amount, sharesToken.decimals);

    if (amount !== 0n && sender !== receiver) {
        if (sender !== ('0x0000000000000000000000000000000000000000' as Hex)) {
            const investor = await getOrCreateInvestor({ context, address: sender });
            const pos = await getOrCreateInvestorPosition({
                context,
                chainId,
                vault,
                investor,
            });
            context.InvestorPosition.set({
                ...pos,
                directSharesBalance: pos.directSharesBalance.minus(value),
                totalSharesBalance: pos.totalSharesBalance.minus(value),
            });
        }
        if (receiver !== ('0x0000000000000000000000000000000000000000' as Hex)) {
            const investor = await getOrCreateInvestor({ context, address: receiver });
            const pos = await getOrCreateInvestorPosition({
                context,
                chainId,
                vault,
                investor,
            });
            context.InvestorPosition.set({
                ...pos,
                directSharesBalance: pos.directSharesBalance.plus(value),
                totalSharesBalance: pos.totalSharesBalance.plus(value),
            });
        }
    }
});
