import { createClient } from './setupDashClient.mjs';
import { Identifier } from '@dashevo/evo-sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '.env') });

const network = process.env.NETWORK || 'testnet';
const contractId = process.env.EVOGUARD_CONTRACT_ID;

/**
 * Test script to query documents from the EvoGuard contract.
 */
async function testQuery() {
  if (!contractId) {
    console.error('❌ Error: EVOGUARD_CONTRACT_ID is not set in .env');
    process.exit(1);
  }

  console.log(`--- EvoGuard Document Query Test ---`);
  console.log(`Network:     ${network}`);
  console.log(`Contract ID: ${contractId}`);
  console.log(`------------------------------------`);

  console.log('Connecting to Dash Platform...');
  const sdk = await createClient(network);

  try {
    console.log('Querying "auditReport" documents...');
    
    /**
     * Fetching documents from the contract.
     * In JS-SDK 3.1.0-dev, we use an options object.
     * Some versions require 'where' to be an array even if empty.
     */
    const result = await sdk.documents.get({
      dataContractId: Identifier.fromBase58(contractId),
      documentTypeName: 'auditReport',
      where: [],
    });

    // Handle different possible return shapes (array or object with documents array)
    const documents = Array.isArray(result) ? result : (result?.documents || []);

    if (!result || documents.length === 0) {
      console.log('ℹ️ No documents found for this contract.');
    } else {
      console.log(`✅ Found ${documents.length} document(s).`);

      documents.forEach((doc, index) => {
        // Newer SDKs might use toObject() or properties getter
        const props = typeof doc.toObject === 'function' ? doc.toObject().properties : doc.properties;
        console.log(`\n[${index + 1}] Document ID: ${doc.id.toString()}`);
        console.log(`    Owner ID:    ${doc.ownerId.toString()}`);
        console.log(`    Package:     ${props.pkgName} (v${props.version})`);
        console.log(`    Risk Score:  ${props.riskScore}/100`);
        console.log(`    Malware:     ${props.malwareDetected ? '🚨 YES' : '✅ No'}`);
        console.log(`    Summary:     ${props.summary.substring(0, 100)}${props.summary.length > 100 ? '...' : ''}`);
      });
    }

  } catch (error) {
    console.error('❌ Query failed:', error.message || error);
    // If you see "Cannot read properties of undefined (reading 'length')", 
    // it may be an SDK-specific issue with the query parameters or the contract state.
  } finally {
    process.exit(0);
  }
}

testQuery().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
