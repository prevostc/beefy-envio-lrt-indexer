import type { BeefyViemClient } from '../../viem';
import type { BeefyProtocolType, BeefyVault } from '../vault/getBeefyVaultConfig';
import { getAaveVaultBreakdown } from './protocol_type/aave';
import { getBalancerAuraVaultBreakdown, getBalancerVaultBreakdown } from './protocol_type/balancer';
import { getBeefyClmManagerBreakdown, getBeefyClmVaultBreakdown } from './protocol_type/beefy_clm';
import { getCurveVaultBreakdown } from './protocol_type/curve';
import { getEulerVaultBreakdown } from './protocol_type/euler';
import { getGammaVaultBreakdown } from './protocol_type/gamma';
import { getInfraredVaultBreakdown } from './protocol_type/infrared';
import { getPendleVaultBreakdown } from './protocol_type/pendle';
import { getSolidlyVaultBreakdown } from './protocol_type/solidly';
import type { BeefyVaultBreakdown } from './types';

type BreakdownMethod = (
    client: BeefyViemClient,
    blockNumber: bigint,
    vault: BeefyVault
) => Promise<BeefyVaultBreakdown>;

const breakdownMethods: Record<BeefyProtocolType, BreakdownMethod> = {
    aave: getAaveVaultBreakdown,
    balancer_aura: getBalancerAuraVaultBreakdown,
    balancer: getBalancerVaultBreakdown,
    beefy_clm_vault: getBeefyClmVaultBreakdown,
    beefy_clm: getBeefyClmManagerBreakdown,
    curve: getCurveVaultBreakdown,
    gamma: getGammaVaultBreakdown,
    ichi: getGammaVaultBreakdown,
    infrared: getInfraredVaultBreakdown,
    euler: getEulerVaultBreakdown,
    pendle_equilibria: getPendleVaultBreakdown,
    solidly: getSolidlyVaultBreakdown,
};

export const getVaultBreakdowns = async (
    viemClient: BeefyViemClient,
    blockNumber: bigint,
    vault: BeefyVault
): Promise<BeefyVaultBreakdown> => {
    return await breakdownMethods[vault.protocol_type](viemClient, blockNumber, vault);
};
