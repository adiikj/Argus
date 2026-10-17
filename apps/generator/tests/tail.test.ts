import { appendFile, mkdtemp, rename, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RawLog } from '@argus/contracts';
import { createLogger } from '@argus/logger';
import { nginxLineTime, startLogTail, type LogTail } from '../src/tail.js';
import { RateLimiter } from '../src/rate-limit.js';

const log = createLogger({ level: 'fatal' });
const line = (ip: string, path: string) =>
  `${ip} - - [17/Oct/2026:20:00:00 +0530] "GET ${path} HTTP/1.1" 404 153 "-" "Mozilla/5.0"\n`;

let dir: string;
let file: string;
let tail: LogTail | undefined;
let shipped: RawLog[];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'argus-tail-'));
  file = join(dir, 'probes.log');
  shipped = [];
});
afterEach(async () => {
  await tail?.stop();
  tail = undefined;
  await rm(dir, { recursive: true, force: true });
});

const start = (extra: Partial<Parameters<typeof startLogTail>[0]> = {}) =>
  startLogTail({
    path: file,
    log,
    pollMs: 60_000, // tests drive polls by hand
    emit: async (raw) => {
      shipped.push(raw);
    },
    ...extra,
  });
const paths = () => shipped.map((r) => r.message.split('"')[1]?.split(' ')[1]);

describe('nginxLineTime', () => {
  it('converts nginx local time to UTC', () => {
    expect(nginxLineTime(line('1.2.3.4', '/'))).toBe('2026-10-17T14:30:00.000Z');
    expect(nginxLineTime('x [01/Jan/2026:00:10:00 -0030] y')).toBe('2026-01-01T00:40:00.000Z');
    expect(nginxLineTime('no timestamp here')).toBeUndefined();
  });
});

describe('startLogTail', () => {
  it('skips history on start, then ships new lines as nginx RawLogs', async () => {
    await writeFile(file, line('1.1.1.1', '/old'));
    tail = await start();
    await appendFile(file, line('2.2.2.2', '/.env') + line('3.3.3.3', '/wp-login.php'));
    await tail.poll();
    expect(paths()).toEqual(['/.env', '/wp-login.php']);
    expect(shipped[0]).toMatchObject({ source: 'nginx', timestamp: '2026-10-17T14:30:00.000Z' });
  });

  it('holds a partial line until its newline arrives', async () => {
    await writeFile(file, '');
    tail = await start();
    const full = line('2.2.2.2', '/.git/config');
    await appendFile(file, full.slice(0, 20));
    await tail.poll();
    expect(shipped).toHaveLength(0);
    await appendFile(file, full.slice(20));
    await tail.poll();
    expect(paths()).toEqual(['/.git/config']);
  });

  it('follows logrotate: drains the old file, then reads the new one from the start', async () => {
    await writeFile(file, '');
    tail = await start();
    await appendFile(file, line('2.2.2.2', '/before-rotate'));
    await rename(file, `${file}.1`); // logrotate renames; nginx keeps writing the old inode…
    await appendFile(`${file}.1`, line('2.2.2.2', '/late-old'));
    await writeFile(file, line('2.2.2.2', '/new-file')); // …until it reopens
    await tail.poll();
    expect(paths()).toEqual(['/before-rotate', '/late-old', '/new-file']);
  });

  it('handles truncation in place (copytruncate)', async () => {
    await writeFile(file, line('2.2.2.2', '/a'));
    tail = await start();
    await truncate(file, 0);
    await appendFile(file, line('2.2.2.2', '/after-truncate'));
    await tail.poll();
    expect(paths()).toEqual(['/after-truncate']);
  });

  it('waits for a missing file and reads it from its first line once it appears', async () => {
    tail = await start();
    await writeFile(file, line('2.2.2.2', '/first'));
    await tail.poll();
    expect(paths()).toEqual(['/first']);
  });

  it('rate-limits per source IP', async () => {
    await writeFile(file, '');
    tail = await start({ perIp: new RateLimiter(3, 0.001) });
    let burst = '';
    for (let i = 0; i < 10; i += 1) burst += line('6.6.6.6', `/scan${i}`);
    await appendFile(file, burst + line('7.7.7.7', '/other'));
    await tail.poll();
    expect(paths()).toEqual(['/scan0', '/scan1', '/scan2', '/other']);
  });
});
