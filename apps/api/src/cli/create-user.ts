// Creates an account, or resets an existing one's password + role. This is
// how users exist on an instance with ALLOW_REGISTRATION=false:
//
//   docker compose run --rm --no-deps api \
//     node apps/api/dist/cli/create-user.js --email you@example.com --role admin
//
// Password comes from ARGUS_USER_PASSWORD if set (scripts), else a hidden
// prompt on a TTY, else the first line of piped stdin. Never a CLI flag —
// argv lands in shell history and `ps` output.
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { stdin, stdout } from 'node:process';
import { loadConfig } from '@argus/config';
import { Role } from '@argus/contracts';
import { createPrismaClient } from '../incident/index.js';
import { setPasswordUser } from '../auth/index.js';

const USAGE = 'usage: create-user --email <email> --role <admin|analyst|viewer>';
const MIN_PASSWORD = 8;

async function readPassword(): Promise<string> {
  const fromEnv = process.env.ARGUS_USER_PASSWORD;
  if (fromEnv) return fromEnv;

  if (stdin.isTTY) {
    // terminal mode with a muted output stream: readline still handles line
    // editing, but the typed characters are never echoed
    stdout.write('Password: ');
    const muted = new Writable({ write: (_chunk, _enc, done) => done() });
    const rl = createInterface({ input: stdin, output: muted, terminal: true });
    const answer = await rl.question('');
    rl.close();
    stdout.write('\n');
    return answer;
  }

  const rl = createInterface({ input: stdin });
  for await (const line of rl) {
    rl.close();
    return line;
  }
  return '';
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const { values } = parseArgs({
  options: { email: { type: 'string' }, role: { type: 'string' } },
});

if (!values.email?.includes('@')) fail(USAGE);
const role = Role.safeParse(values.role);
if (!role.success) fail(USAGE);

const password = await readPassword();
if (password.length < MIN_PASSWORD) fail(`password must be at least ${MIN_PASSWORD} characters`);

const prisma = createPrismaClient(loadConfig());
try {
  const { user, created } = await setPasswordUser(prisma, values.email, password, role.data);
  console.log(`${created ? 'created' : 'updated'} ${user.email} (${user.role})`);
} catch (err) {
  // Prisma errors embed a code frame of minified client source — the last
  // line is the human-readable cause ("Can't reach database server at …")
  const message = err instanceof Error ? err.message.trim().split('\n').at(-1) : String(err);
  console.error(`create-user failed: ${message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
