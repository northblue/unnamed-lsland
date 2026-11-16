import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../../deploy/island/.env.access.local', import.meta.url));
const password = randomBytes(18).toString('base64url');
const secret = randomBytes(32).toString('hex');
writeFileSync(path, `# Private NAS access settings. Do not commit, screenshot or post these values.\n# Copy values into the EXISTING Web Compose environment; keep DATABASE_URL unchanged.\nPUBLIC_ORIGIN=https://unnamed-island.northblue.cc\nAPP_ORIGIN=http://192.168.4.82:3080\nISLAND_SHARED_PASSWORD=${password}\nISLAND_SESSION_SECRET=${secret}\n`, { flag: 'wx', mode: 0o600 });
console.log(`Private access settings created at ${path}. Password and secret were not printed.`);
