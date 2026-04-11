
## **Phase 2: The EvoGuard Registry (Data Contract)**
**Goal:** Define the structure of your security audits on the Dash network.

1.  **Schema Definition:** Create the `evoguardContract.json`.
    * *Document Type:* `auditReport`
    * *Properties:* `pkgName` (string), `version` (string), `riskScore` (integer 0-100), `summary` (string), `malwareDetected` (boolean), `auditorSignature` (string).
2.  **Contract Deployment:** Use your pre-funded identity to broadcast the Data Contract to the testnet. **Note:** This is a one-time credit expense.
3.  **Local Indexing:** Store the `contractId` in a `.env` file for the rest of the team to use.

> **Phase 2 Testing:**
> * **Action:** Attempt to fetch the contract by its ID using the SDK.
> * **Success Criteria:** DAPI returns the contract definition, confirming it is live in **GroveDB**.

---

## **Phase 3: The Brain (AI Security Scanner)**
**Goal:** Build the analysis engine that feeds the registry.

1.  **Scanner Logic:** A Node.js script that takes an NPM package name, fetches the metadata/source, and sends it to your LLM of choice (GPT-4o/Claude).
2.  **Prompt Engineering:** Fine-tune the AI to look for "Red Flags" (e.g., postinstall scripts, network calls to suspicious IPs, credential scraping).
3.  **Report Generation:** The AI outputs a JSON object matching your Phase 2 schema.
4.  **Auto-Publishing:** The script uses the **Pre-funded Identity** to sign and submit the `auditReport` document to the Dash Platform.

> **Phase 3 Testing:**
> * **Action:** Manually trigger a scan for a test package.
> * **Success Criteria:** A new document appears on-chain under your `contractId`.

---

## **Phase 4: The `evoguard` CLI Tool**
**Goal:** The user-facing tool that developers run before installing.

1.  **Lookup Tool:** Build the CLI (using `oclif` or `commander`) where a user runs `evoguard check <package>@<version>`.
2.  **DAPI Query:** The tool asks the Dash Platform for any `auditReport` documents matching that package and version.
3.  **Visual Indicators:**
    * **Green:** "Safe - Verified by EvoGuard."
    * **Red:** "DANGER - Malicious Code Detected!"
4.  **Verification:** The CLI checks that the report was signed by your `evoguard.dash` identity to ensure integrity.

> **Phase 4 Testing:**
> * **Action:** Run `evoguard check lodash`.
> * **Success Criteria:** The CLI pulls and displays the data you published in Phase 3.

---

## **Phase 5: The Payment & Trigger (InstantSend)**
**Goal:** Automate priority audits with Dash's speed.

1.  **The "Priority" Flow:** If a package isn't audited, the CLI shows: *"No audit found. Pay 0.05 DASH for an Instant Audit."*
2.  **QR/Wallet Integration:** Generate a payment address.
3.  **ZMQ Listener:** Build a background service that watches the Dash Core node via **ZeroMQ**.
4.  **Auto-Scan:** The moment an **InstantSend** transaction hits the address, ZMQ triggers the Phase 3 Scanner. Once done, the report is published, and the CLI updates in real-time.

> **Phase 5 Testing:**
> * **Action:** Send a testnet payment to the CLI's QR code.
> * **Success Criteria:** Within seconds, the scanner starts, and the CLI shows the result.

---

### **Team Battle Plan (The 3-Way Split)**

| Member | Focus | Priority Task |
| :--- | :--- | :--- |
| **Member A** | **Logic/AI** | Building the AI prompting engine and the automated scanning script. |
| **Member B** | **Dash Architecture** | Managing the **Pre-funded ID**, deploying the Data Contract, and ZMQ setup. |
| **Member C** | **UX/CLI** | Building the Node.js CLI tool and the "Proof of Concept" frontend dashboard. |

**Since you have the ID already, what’s the very first package you want to audit as your "Genesis Record"?** Pick something popular like `express` or `lodash` to show off the data on your dashboard!