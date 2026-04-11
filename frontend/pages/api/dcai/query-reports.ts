import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";

const DCAI_RPC = "http://139.180.188.61:8545";
const REPORT_CONTRACT = "0x7fD01C2d75E271e34eF7ABec9BB9Da2C4E78f8Da";

const REPORT_ABI = [
  "function getReport(uint256 reportId) view returns (address auditor, string dataHash, string metadata, uint256 timestamp)",
  "function getReportCount() view returns (uint256)",
  "function getReportsByAuditor(address auditor) view returns (uint256[])",
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const provider = new ethers.JsonRpcProvider(DCAI_RPC);
    const contract = new ethers.Contract(REPORT_CONTRACT, REPORT_ABI, provider);

    const { auditor, id } = req.query;

    // Query single report by ID
    if (id !== undefined) {
      const [aud, dataHash, metadata, timestamp] = await contract.getReport(Number(id));
      return res.status(200).json({
        id: Number(id),
        auditor: aud,
        dataHash,
        metadata,
        timestamp: Number(timestamp),
        date: new Date(Number(timestamp) * 1000).toISOString(),
      });
    }

    // Query reports by auditor address
    if (auditor) {
      const ids: bigint[] = await contract.getReportsByAuditor(auditor as string);
      const reports = [];
      for (const rid of ids) {
        const [aud, dataHash, metadata, timestamp] = await contract.getReport(rid);
        reports.push({
          id: Number(rid),
          auditor: aud,
          dataHash,
          metadata,
          timestamp: Number(timestamp),
          date: new Date(Number(timestamp) * 1000).toISOString(),
        });
      }
      return res.status(200).json({ auditor, reports });
    }

    // Query all reports
    const count = await contract.getReportCount();
    const total = Number(count);
    const reports = [];
    for (let i = 0; i < total; i++) {
      const [aud, dataHash, metadata, timestamp] = await contract.getReport(i);
      reports.push({
        id: i,
        auditor: aud,
        dataHash,
        metadata,
        timestamp: Number(timestamp),
        date: new Date(Number(timestamp) * 1000).toISOString(),
      });
    }
    return res.status(200).json({ total, reports });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
