import type { Hex } from 'viem';
import { toChainId } from '../src/lib/chain';
import { getBeefyVaultConfigs } from '../src/lib/vault-breakdown/vault/getBeefyVaultConfig';

const args = process.argv.slice(2);

if (args.length < 2) {
    console.error('Usage: bun scripts/show-config.ts <chainId> <address>');
    console.error('Example: bun scripts/show-config.ts 1 0x1234567890123456789012345678901234567890');
    process.exit(1);
}

const chainId = toChainId(Number.parseInt(args[0], 10));
const address = args[1].toLowerCase() as Hex;

async function main() {
    try {
        const configs = await getBeefyVaultConfigs(chainId);
        const matchingConfig = configs.find((config) => config.vault_address.toLowerCase() === address);

        if (!matchingConfig) {
            console.error(`No vault config found for address ${address} on chain ${chainId}`);
            process.exit(1);
        }

        console.log(JSON.stringify(matchingConfig, null, 2));
    } catch (error) {
        console.error('Error fetching vault config:', error);
        process.exit(1);
    }
}

main();
