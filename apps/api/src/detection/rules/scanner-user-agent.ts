import type { StatefulRule } from '../rule.js';

const QUIET_MS = 10 * 60_000; // one alert per tool per source per 10 min

export const RULE_ID = 'scanner-user-agent';

// off-the-shelf offensive tooling that announces itself in the User-Agent.
// Generic HTTP clients (curl, python-requests, Go-http-client) are left out on
// purpose — far too much legitimate automation uses them.
const SCANNER =
  /\b(sqlmap|nikto|nmap|masscan|zgrab|gobuster|dirbuster|dirb|feroxbuster|ffuf|wfuzz|nuclei|wpscan|whatweb|acunetix|nessus|openvas|hydra|medusa|zmeu|jaeles|arachni|skipfish|w3af|commix|xsstrike)\b/i;

// stateful only for de-duplication: a scanner sends hundreds of requests, and
// the *tool* is the finding, not each request. The window holds the tool name
// per source; an alert fires only when it wasn't already there.
export const scannerUserAgentRule: StatefulRule = {
  kind: 'stateful',
  id: RULE_ID,
  evaluate: async (event, ctx) => {
    const tool = event.userAgent?.match(SCANNER)?.[1]?.toLowerCase();
    if (!tool) return undefined;

    const seen = await ctx.window.peek(`${event.sourceIp}|${tool}`, QUIET_MS);
    await ctx.window.record(`${event.sourceIp}|${tool}`, tool, QUIET_MS);
    if (seen.length > 0) return undefined;

    return {
      ruleId: RULE_ID,
      severity: 'low',
      entity: event.sourceIp,
      eventIds: [event.eventId],
      message: `Known attack tool fingerprint from ${event.sourceIp}: ${tool} (${event.userAgent})`,
    };
  },
};
