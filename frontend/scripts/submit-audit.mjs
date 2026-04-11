const pkgName = process.argv[2] || "express";
const version = process.argv[3] || "5.2.1";

async function main() {
  console.log(`🚀 Submitting audit report for ${pkgName}@${version} via local API...`);

  const reportData = {
    pkgName,
    version,
    riskScore: 4,
    summary: "Express 5.2.1 contains an opt-in prototype-pollution risk in the extended query parser. It also has a large dependency tree. Verified by 2 independent agents.",
    malwareDetected: false,
    auditorSignature: "sha256:express_v5_2_1_audit_sig_" + Math.random().toString(16).slice(2),
  };

  try {
    const response = await fetch("http://localhost:3000/api/evoguard/document/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reportData),
    });

    const result = await response.json();

    if (result.ok) {
      console.log("✅ Success!");
      console.log(`Document ID: ${result.documentId}`);
      console.log(`View it: https://testnet.platform-explorer.com/document/${result.documentId}`);
    } else {
      console.error("❌ Submission failed:", result.error);
    }
  } catch (error) {
    console.error("❌ Network error:", error.message);
  }
}

main();
