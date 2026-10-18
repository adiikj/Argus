import { isIP } from 'node:net';
import type { RawLog, NormalizedEvent } from '@argus/contracts';

// OpenSSH's login lines, as the generator emits them:
//   Failed password for root from 198.51.100.7 port 51000 ssh2
// and as real hosts log them, shipped in through POST /ingest: behind a
// syslog prefix (/var/log/auth.log), for accounts that don't exist, and for
// key or PAM logins:
//   Oct 18 09:00:01 vm sshd[811]: Failed password for invalid user admin from 203.0.113.9 port 40022 ssh2
//   Accepted publickey for deploy from 203.0.113.5 port 52144 ssh2: ED25519 SHA256:...
const SSH_AUTH_PATTERN =
  /^(?:.*?\bsshd(?:-session)?\[\d+\]:\s+)?(Accepted|Failed) (?:password|publickey|keyboard-interactive\/pam) for (?:invalid user )?(\S+) from (\S+) port \d+(?: ssh2)?(?::.*)?$/;

export function parseAuthLog(rawLog: RawLog): NormalizedEvent | undefined {
  const match = SSH_AUTH_PATTERN.exec(rawLog.message);
  if (!match) return undefined;

  const [, result, username, sourceIp] = match;
  if (!sourceIp || !isIP(sourceIp)) return undefined;

  return {
    eventId: rawLog.eventId,
    timestamp: rawLog.timestamp,
    source: rawLog.source,
    sourceIp,
    outcome: result === 'Accepted' ? 'success' : 'failure',
    username,
    raw: rawLog.message,
  };
}
