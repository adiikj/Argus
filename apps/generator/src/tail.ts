import { randomUUID } from 'node:crypto';
import { open, stat, type FileHandle } from 'node:fs/promises';
import type { Logger } from '@argus/logger';
import { RawLog } from '@argus/contracts';
import { RateLimiter } from './rate-limit.js';

// Ships a *real* nginx access log into the pipeline next to the synthetic
// traffic — on the deploy VM, the "probe" log nginx writes for api.argus.buzz
// (requests to paths the api doesn't have: /.env, /wp-login.php, …, i.e.
// internet scanners — deploy/nginx/argus.conf). Same wire format the
// generator's synthetic nginx lines use, so the api's nginx parser and every
// detection rule apply unchanged.
//
// Polls instead of fs.watch: watch events are unreliable through Docker bind
// mounts and across logrotate's rename. Starts at the end of the file (no
// history replay on restart), follows rotation (finishes the old file first)
// and truncation, and waits quietly for a file that doesn't exist yet.

const MAX_LINE_BYTES = 8 * 1024;
const FINGERPRINT_BYTES = 16;
const NGINX_TIME = /\[(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{2})(\d{2})\]/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LEADING_IP = /^(\S+) /;

export interface TailOptions {
  path: string;
  emit: (raw: RawLog) => Promise<void>;
  log: Logger;
  pollMs?: number;
  // a scanner can send thousands of requests a minute; keep any one source
  // (and the total) from flooding the pipeline. Excess lines are dropped and
  // counted — the throttled alerts already say "this source is scanning".
  perIp?: RateLimiter;
  overall?: RateLimiter;
  now?: () => Date;
}

export interface LogTail {
  stop: () => Promise<void>;
  // resolves after one poll cycle — for tests
  poll: () => Promise<void>;
}

// [17/Oct/2026:20:00:00 +0530] -> ISO; undefined if absent/unparseable
export function nginxLineTime(line: string): string | undefined {
  const m = NGINX_TIME.exec(line);
  if (!m) return undefined;
  const [, dd, mon, yyyy, hh, mi, ss, tzh, tzm] = m;
  const month = MONTHS.indexOf(mon!);
  if (month < 0) return undefined;
  // sign from the character, not the number: "-0030" has hours "-00", i.e. 0
  const sign = tzh!.startsWith('-') ? -1 : 1;
  const offsetMin = sign * (Math.abs(Number(tzh)) * 60 + Number(tzm));
  const utc =
    Date.UTC(Number(yyyy), month, Number(dd), Number(hh), Number(mi), Number(ss)) -
    offsetMin * 60_000;
  return Number.isFinite(utc) ? new Date(utc).toISOString() : undefined;
}

export async function startLogTail(opts: TailOptions): Promise<LogTail> {
  const pollMs = opts.pollMs ?? 1000;
  const perIp = opts.perIp ?? new RateLimiter(120, 2); // burst 120, ~2 lines/s sustained
  const overall = opts.overall ?? new RateLimiter(500, 50);
  const now = opts.now ?? (() => new Date());

  let handle: FileHandle | undefined;
  let inode: number | undefined;
  let offset = 0;
  let partial = '';
  // the last bytes read before `offset` — if they change, the file was
  // rewritten under us (truncated, then refilled past our offset before the
  // next poll, which a size check alone can't see)
  let fingerprint: Buffer = Buffer.alloc(0);
  let waitingLogged = false;
  // skip existing content only if the file was there when we started (a
  // restart); a file that appears later is read from its first line
  let startAtEnd = true;
  let stopped = false;
  const stats = { shipped: 0, droppedRate: 0, droppedLong: 0 };

  async function ship(line: string): Promise<void> {
    if (!line.trim()) return;
    if (Buffer.byteLength(line) > MAX_LINE_BYTES) {
      stats.droppedLong += 1;
      return;
    }
    const ip = LEADING_IP.exec(line)?.[1] ?? 'unknown';
    if (!overall.tryConsume('all') || !perIp.tryConsume(ip)) {
      stats.droppedRate += 1;
      return;
    }
    const raw = RawLog.safeParse({
      eventId: randomUUID(),
      timestamp: nginxLineTime(line) ?? now().toISOString(),
      source: 'nginx',
      message: line,
    });
    if (!raw.success) return;
    await opts.emit(raw.data);
    stats.shipped += 1;
  }

  async function bytesBefore(h: FileHandle, end: number): Promise<Buffer> {
    const start = Math.max(0, end - FINGERPRINT_BYTES);
    const buf = Buffer.alloc(end - start);
    await h.read(buf, 0, buf.length, start);
    return buf;
  }

  async function readNew(h: FileHandle): Promise<void> {
    const { size } = await h.stat();
    const rewritten =
      size < offset || (offset > 0 && !(await bytesBefore(h, offset)).equals(fingerprint));
    if (rewritten) {
      offset = 0; // truncated in place (copytruncate) — start over
      partial = '';
    }
    while (offset < size) {
      const chunk = Buffer.alloc(Math.min(64 * 1024, size - offset));
      const { bytesRead } = await h.read(chunk, 0, chunk.length, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
      const lines = (partial + chunk.subarray(0, bytesRead).toString('utf8')).split('\n');
      partial = lines.pop() ?? '';
      for (const line of lines) await ship(line);
    }
    fingerprint = await bytesBefore(h, offset);
  }

  async function poll(): Promise<void> {
    let current;
    try {
      current = await stat(opts.path);
    } catch {
      if (!waitingLogged) opts.log.info({ path: opts.path }, 'waiting for nginx log to appear');
      waitingLogged = true;
      startAtEnd = false;
      return;
    }

    if (handle && current.ino !== inode) {
      await readNew(handle); // rotated: drain what was written before the rename
      await handle.close();
      handle = undefined;
    }
    if (!handle) {
      const isFirstOpen = inode === undefined;
      handle = await open(opts.path, 'r');
      inode = current.ino;
      // first open of a pre-existing file: start at the end (no history replay
      // on restart); a rotated-in or newly appeared file: from its start
      offset = isFirstOpen && startAtEnd ? current.size : 0;
      partial = '';
      fingerprint = await bytesBefore(handle, offset);
      waitingLogged = false;
      opts.log.info({ path: opts.path, fromByte: offset }, 'tailing nginx log');
    }
    await readNew(handle);
  }

  let running = Promise.resolve();
  const tick = (): Promise<void> => {
    running = running
      .then(poll)
      .catch((err: unknown) => opts.log.error({ err }, 'log tail failed'));
    return running;
  };
  const timer = setInterval(() => {
    if (!stopped) void tick();
  }, pollMs);
  const report = setInterval(() => {
    if (stats.shipped + stats.droppedRate + stats.droppedLong === 0) return;
    opts.log.info({ ...stats }, 'shipped nginx probe lines (last minute)');
    stats.shipped = stats.droppedRate = stats.droppedLong = 0;
  }, 60_000);
  report.unref();
  await tick();

  return {
    poll: tick,
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      clearInterval(report);
      await running;
      await handle?.close();
    },
  };
}
