import { uniq } from 'lodash';
import type { Hex } from 'viem';
import type { BeefyVault } from './getBeefyVaultConfig';

export const extractAllAddresses = (vaults: BeefyVault[]) => {
  return uniq(
    vaults
      .map(v => v.vault_address)
      .concat(vaults.flatMap(v => v.strategy_address))
      .concat(vaults.flatMap(v => v.undelying_lp_address))
      .concat(vaults.flatMap(v => v.vault_address))
      .concat(vaults.flatMap(v => v.reward_pools.map(p => p.clm_address)))
      .concat(vaults.flatMap(v => v.reward_pools.map(p => p.reward_pool_address)))
      .concat(vaults.flatMap(v => v.boosts.map(b => b.boost_address)))
      .flat()
      .filter(Boolean)
      .map(a => a.toLocaleLowerCase() as Hex)
  );
};
