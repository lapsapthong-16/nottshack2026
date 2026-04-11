import { EvoSDK, IdentitySigner } from '@dashevo/evo-sdk';
import { config } from 'dotenv';
config();

// ─── Configuration ───────────────────────────────────────────────
const identityId = process.env.DASH_IDENTITY_ID;
const privateKeyWif = process.env.DASH_PRIVATE_CRITICAL_TRANS;
const recipientId = process.env.RECIPIENT_IDENTITY_ID;

// ─── Amount Calculation ──────────────────────────────────────────
// In Dash Platform, 1 DASH = 100,000,000,000 credits (100 Billion)
// We specify the withdrawal amount in credits.
// Let's send 0.1 DASH as a test.
const dashToWithdraw = 0.1;
const amount = BigInt(dashToWithdraw * 100_000_000_000); 

// ─── Main ────────────────────────────────────────────────────────
async function sendFunds() {
  console.log('Connecting to Dash Platform...');
  const sdk = EvoSDK.testnetTrusted();
  await sdk.connect();

  try {
    // 1. Fetch the identity
    console.log(`Fetching identity: ${identityId}...`);
    const identity = await sdk.identities.fetch(identityId);
    if (!identity) {
      console.error(`Identity not found on testnet!`);
      process.exit(1);
    }
    
    // 2. Set up the signer using your private key
    const signer = new IdentitySigner();
    signer.addKeyFromWif(privateKeyWif);

    console.log(`\n=========================================`);
    console.log(`Identity balance: ${identity.balance} credits`);
    console.log(`Transferring:     ${amount} credits (${dashToWithdraw} DASH)`);
    console.log(`To Identity ID:   ${recipientId}`);
    console.log(`=========================================\n`);

    // 3. Broadcast the transfer
    console.log('Broadcasting transfer transactions...');
    await sdk.identities.creditTransfer({
      identity,
      amount,
      recipientId,
      signer,
    });

    console.log(`\n✅ Transfer successful!`);
    
    // Check recipient's new balance
    const recipient = await sdk.identities.fetch(recipientId);
    console.log(`   Recipient (${recipientId}) new balance: ${recipient.balance} credits`);
  } catch (e) {
    console.error('\n❌ Something went wrong:\n', e.message);
  }

  if (typeof sdk.disconnect === 'function') {
    await sdk.disconnect();
  }
}

sendFunds();
