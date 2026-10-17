// a run of consecutive %XX escapes — decoded together so multi-byte UTF-8
// sequences come out as one character
const ESCAPE_RUN = /(?:%[0-9a-f]{2})+/gi;

// one lenient URL-decoding pass: each valid escape run is decoded, anything
// malformed is left exactly as it was. decodeURIComponent on the whole string
// would throw on a single bad escape and decode *nothing* — so an attacker
// could append "%zz" to an encoded payload and walk it past every signature,
// while a lenient server on the other end decodes the valid parts just fine.
function decodeOnce(value: string): string {
  return value.replace(/\+/g, ' ').replace(ESCAPE_RUN, (run) => {
    try {
      return decodeURIComponent(run);
    } catch {
      // not valid UTF-8 (e.g. overlong %c0%ae): fall back to byte-per-char
      return run.replace(/%([0-9a-f]{2})/gi, (_, hex: string) =>
        String.fromCharCode(parseInt(hex, 16)),
      );
    }
  });
}

// decodes until the string stops changing (max `rounds`), so a payload
// double-encoded to slip past a single-decode filter — %252e%252e%252f ->
// %2e%2e%2f -> ../ — still reaches the signature check in its final form
export function decodeRepeatedly(value: string, rounds = 4): string {
  let current = value;
  for (let i = 0; i < rounds; i += 1) {
    const next = decodeOnce(current);
    if (next === current) return current;
    current = next;
  }
  return current;
}
