import { RewardPoolFactory } from 'generated';
import { isVaultBlacklisted } from '../lib/blacklist';

RewardPoolFactory.RewardPoolCreated.contractRegister(async ({ event, context }) => {
    const contractAddress = event.params.proxy.toString().toLowerCase();
    if (isVaultBlacklisted(event.chainId, contractAddress)) return;

    context.addRewardPool(contractAddress);

    context.log.info('RewardPoolCreated', { contractAddress });
});

RewardPoolFactory.RewardPoolCreatedWithName.contractRegister(async ({ event, context }) => {
    const contractAddress = event.params.proxy.toString().toLowerCase();
    if (isVaultBlacklisted(event.chainId, contractAddress)) return;

    context.addRewardPool(contractAddress);

    context.log.info('RewardPoolCreatedWithName', { contractAddress });
});
