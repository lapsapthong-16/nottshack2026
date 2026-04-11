import { EvoSDK } from '@dashevo/evo-sdk';
import { createClient } from './setupDashClient.mjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '.env') });

const network = process.env.NETWORK || 'testnet';
const contractId = process.env.EVOGUARD_CONTRACT_ID;

async function testQuery() {
  if (!contractId) {
    console.error('❌ Error: EVOGUARD_CONTRACT_ID is not set in .env');
    process.exit(1);
  }

  console.log(`--- EvoGuard Document Query Test ---`);
  console.log(`Network:     ${network}`);
  console.log(`Contract ID: ${contractId}`);
  console.log(`------------------------------------`);

  console.log('Connecting to Dash Platform (Trusted Node)...');
  const sdk = await createClient(network);

  try {
    console.log('Fetching contract metadata...');
    const contract = await sdk.contracts.fetch(contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found on-chain.`);
    }
    const contractJson = contract.toJSON(1);
    
    // Check document types
    const docsObj = contractJson.documentSchemas || contractJson.documents || contractJson.documentTypes || {};
    const docTypes = Object.keys(docsObj);
    console.log('Document types defined in contract:', docTypes);

    let documents = [];
    const ownerId = process.env.DASH_IDENTITY_ID || contractJson.ownerId;

    console.log(`\n--- Test 1: Document Query by Owner Index ---`);
    try {
      const result = await sdk.documents.query({
        dataContractId: contractId,
        documentTypeName: 'auditReport',
        where: [['$ownerId', '==', ownerId]],
        orderBy: [['$ownerId', 'asc']],
        limit: 50,
      });

      documents = [...result.values()].filter(Boolean);
      console.log(`Query (by owner) returned ${documents.length} document(s).`);
    } catch (queryError) {
      console.error('❌ Query (by owner) failed:', queryError.message);
    }

    if (documents.length > 0) {
      console.log(`\n--- Test 2: Fetch First Document by ID ---`);
      try {
        const firstDocId = documents[0].id.toString();
        const doc = await sdk.documents.get(contractId, 'auditReport', firstDocId);

        if (doc) {
          console.log(`✅ get(ID) succeeded for ${firstDocId}`);
        } else {
          console.log(`❌ get(ID) returned nothing for ${firstDocId}`);
        }
      } catch (e) {
        console.error('❌ get(ID) failed:', e.message);
      }
    }

    if (documents.length === 0) {
      console.log('\nℹ️ No documents found even after multiple attempts.');
    } else {
      console.log(`\n✅ SUCCESS! Found ${documents.length} document(s).`);

      documents.forEach((doc, index) => {
        const props = typeof doc.toJSON === 'function' ? doc.toJSON() : {};
        console.log(`\n[${index + 1}] Document ID: ${doc.id.toString()}`);
        console.log(`    Owner ID:    ${doc.ownerId.toString()}`);
        console.log(`    Package:     ${props.pkgName} (v${props.version})`);
        console.log(`    Risk Score:  ${props.riskScore}/100`);
        console.log(`    Malware:     ${props.malwareDetected ? '🚨 YES' : '✅ No'}`);
        console.log(`    Summary:     ${props.summary.substring(0, 100)}${props.summary.length > 100 ? '...' : ''}`);
      });
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message || error);
  } finally {
    process.exit(0);
  }
}

testQuery().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
