import crypto from "node:crypto"
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const SERVER_ID = process.env.SERVER_ID ?? crypto.randomBytes(16).toString("hex")
export const TMP_DIR = path.join(os.tmpdir(), `server-${SERVER_ID}`);

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}