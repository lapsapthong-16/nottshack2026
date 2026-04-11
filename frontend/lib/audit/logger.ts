import fs from "fs";
import path from "path";
import type { NextApiResponse } from "next";

export class AuditLogger {
  private logFile: string;
  private logLines: string[] = [];
  private res: NextApiResponse;

  private startTime: number;

  constructor(name: string, version: string, res: NextApiResponse) {
    this.res = res;
    const now = new Date();
    this.startTime = now.getTime();
    const timestamp = now.toISOString().replace(/:/g, "-").replace(/\..+/, "");
    const safePackageName = name.replace(/[^a-zA-Z0-9@._-]/g, "_");
    const logDir = path.join(process.cwd(), "logs", "audit");
    
    fs.mkdirSync(logDir, { recursive: true });
    this.logFile = path.join(logDir, `${timestamp}_${safePackageName}@${version}.log`);

    this.log(`═══════════════════════════════════════════════════`);
    this.log(`AUDIT STARTED: ${name}@${version}`);
    this.log(`Timestamp: ${now.toISOString()}`);
    this.log(`Log file: ${this.logFile}`);
    this.log(`═══════════════════════════════════════════════════`);
  }

  public getStartTime(): number {
    return this.startTime;
  }

  public log(message: string) {
    const line = `[${new Date().toISOString()}] ${message}`;
    this.logLines.push(line);
  }

  public logEvent(type: string, data: any) {
    this.log(`[${type.toUpperCase()}] ${JSON.stringify(data)}`);
  }

  public sendEvent(type: string, data: any) {
    this.logEvent(type, data);
    this.res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  }

  public flushLog() {
    try {
      fs.writeFileSync(this.logFile, this.logLines.join("\n") + "\n", "utf-8");
      console.log(`[audit-log] Saved to ${this.logFile}`);
    } catch (e: any) {
      console.error("Failed to write audit log:", e.message);
    }
  }

  public getLogLinesCount() {
    return this.logLines.length;
  }
}
