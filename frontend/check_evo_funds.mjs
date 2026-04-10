import { EvoSDK, Identifier } from '@dashevo/evo-sdk';

async function checkFunds(target) {
  const sdk = EvoSDK.testnetTrusted();
  try {
    await sdk.connect();
    console.log(`Checking Dash Platform funds for: ${target}`);

    // If it's a 32-byte Identity ID (Base58 encoded)
    try {
      const identityId = Identifier.fromBase58(target); // Note: target must be 32 bytes decoded
      const identity = await sdk.identities.fetch(identityId);
      if (identity) {
        console.log(`✅ Identity Found! Balance: ${identity.balance} credits`);
        return;
      }
    } catch (e) {
      // Not a valid Identity ID format (y... addresses are L1)
    }

    // If it's a Platform Address (starts with 'tdash1' on testnet)
    if (target.startsWith('tdash1')) {
      const info = await sdk.addresses.get(target);
      if (info) {
        console.log(`✅ Platform Address Found! Balance: ${info.balance} credits`);
        return;
      }
    }

    console.log("❌ No Platform balance found for this target on Evo.");
    console.log("Note: L1 addresses (starting with 'y') must be used in a 'Topping Up' process to become Platform credits.");

  } catch (error) {
    console.error('Error connecting to Dash Platform:', error.message);
  } finally {
      process.exit(0);
  }
}

checkFunds('DkFeADqFup7kxWPZAW9ZMrY4MvxCq2u9Tm4dz8vM8cWv');
