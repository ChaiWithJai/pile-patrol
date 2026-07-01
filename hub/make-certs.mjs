// `npm run certs` — generate a LAN HTTPS cert so a real iPhone will grant camera
// access (iOS Safari only exposes getUserMedia in a secure context; http://<lan-ip>
// gets you nothing). Prefers mkcert (a locally-trusted CA — the clean path);
// falls back to a self-signed cert (you'll tap through a warning on the phone).

import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CERT_DIR = path.join(ROOT, "certs");
mkdirSync(CERT_DIR, { recursive: true });
const cert = path.join(CERT_DIR, "cert.pem");
const key = path.join(CERT_DIR, "key.pem");

function lanIPs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const ni of list || []) if (ni.family === "IPv4" && !ni.internal) out.push(ni.address);
  return out;
}
const hosts = ["localhost", "127.0.0.1", ...lanIPs()];

function has(bin) {
  return spawnSync(process.platform === "win32" ? "where" : "which", [bin]).status === 0;
}

if (has("mkcert")) {
  console.log("Using mkcert (locally-trusted CA)…");
  try { execSync("mkcert -install", { stdio: "inherit" }); } catch {}
  execSync(`mkcert -cert-file "${cert}" -key-file "${key}" ${hosts.join(" ")}`, { stdio: "inherit" });
  console.log(`\n✓ certs written to certs/. On the iPhone: install mkcert's root CA once`);
  console.log(`  (mkcert -CAROOT → AirDrop rootCA.pem → Settings ▸ Profile ▸ install ▸ trust).`);
} else if (has("openssl")) {
  console.log("mkcert not found — using a self-signed openssl cert (expect a tap-through warning on the phone).");
  const san = hosts.map((h, i) => `${/^\d/.test(h) ? "IP" : "DNS"}.${i + 1}:${h}`).join(",");
  execSync(
    `openssl req -x509 -newkey rsa:2048 -nodes -keyout "${key}" -out "${cert}" -days 365 ` +
    `-subj "/CN=pile-patrol" -addext "subjectAltName=${san}"`,
    { stdio: "inherit" },
  );
  console.log(`\n✓ self-signed certs written to certs/. Tip: brew install mkcert for a warning-free phone.`);
} else {
  console.error("Neither mkcert nor openssl found. Install one:  brew install mkcert");
  process.exit(1);
}

console.log(`\nNow: npm run serve  →  serves HTTPS on the LAN for these hosts:\n  ${hosts.join("\n  ")}`);
if (!existsSync(cert)) process.exit(1);
