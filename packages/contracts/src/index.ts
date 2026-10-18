import { z } from 'zod';

// ordered low -> high
export const Severity = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export type Severity = z.infer<typeof Severity>;

export const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// 'argus' is the platform watching itself: its own login, session and ingest
// auth events, emitted by the api onto the same pipeline (never accepted
// from outside through POST /ingest)
export const Source = z.enum(['auth', 'api-gateway', 'nginx', 'argus']);
export type Source = z.infer<typeof Source>;

export const Outcome = z.enum(['success', 'failure']);
export type Outcome = z.infer<typeof Outcome>;

// raw line as emitted by the generator, before parsing
export const RawLog = z.object({
  eventId: z.string().uuid(),
  timestamp: z.string().datetime(),
  source: Source,
  message: z.string(),
});
export type RawLog = z.infer<typeof RawLog>;

// parser output: the one internal shape every downstream module reads.
// common core is required; source-specific fields are optional.
export const NormalizedEvent = z.object({
  eventId: z.string().uuid(),
  timestamp: z.string().datetime(),
  source: Source,
  sourceIp: z.string().ip(),
  outcome: Outcome,
  username: z.string().optional(),
  method: z.string().optional(),
  path: z.string().optional(),
  statusCode: z.number().int().optional(),
  userAgent: z.string().optional(),
  raw: z.string(), // original line, kept for the log explorer
});
export type NormalizedEvent = z.infer<typeof NormalizedEvent>;

// a rule fired. references events by id, does not copy them.
export const Alert = z.object({
  alertId: z.string().uuid(),
  ruleId: z.string(),
  severity: Severity,
  timestamp: z.string().datetime(),
  entity: z.string(), // what the rule keyed on, usually the offending ip
  eventIds: z.array(z.string().uuid()).min(1),
  message: z.string(),
  count: z.number().int().positive().optional(), // for windowed rules
  // earliest evidence the alert cites: the triggering event's timestamp, or
  // when a windowed rule's window started filling. MTTD reads it.
  firstSeenAt: z.string().datetime().optional(),
});
export type Alert = z.infer<typeof Alert>;

export const IncidentStatus = z.enum(['open', 'acknowledged', 'resolved', 'false_positive']);
export type IncidentStatus = z.infer<typeof IncidentStatus>;

// a correlated group of alerts
export const Incident = z.object({
  incidentId: z.string().uuid(),
  correlationKey: z.string(),
  severity: Severity, // max of member alerts
  status: IncidentStatus,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  alertIds: z.array(z.string().uuid()).min(1),
  eventIds: z.array(z.string().uuid()).min(1),
  assigneeId: z.string().uuid().nullable(),
  resolutionNote: z.string().nullable(),
  // first move out of open, and the latest close (null again after a reopen)
  acknowledgedAt: z.string().datetime().nullable().optional(),
  closedAt: z.string().datetime().nullable().optional(),
});
export type Incident = z.infer<typeof Incident>;

// PATCH /incidents/:id body
export const IncidentPatch = z.object({
  status: IncidentStatus.optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  resolutionNote: z.string().optional(),
});
export type IncidentPatch = z.infer<typeof IncidentPatch>;

// admin = everything incl. user management, analyst = triage incidents,
// viewer = read-only (the public demo account). Carried in the session token.
export const Role = z.enum(['admin', 'analyst', 'viewer']);
export type Role = z.infer<typeof Role>;

// GET /users — just enough to populate an assignee picker
export const PublicUser = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
});
export type PublicUser = z.infer<typeof PublicUser>;

// POST /incidents/query body -> a structured filter, translated from a plain-
// English question (LLM, or a keyword/regex fallback — apps/api/src/ai).
// ruleId stays a loose string rather than an enum: an unrecognized value from
// either path just yields zero matches, simpler than keeping an enum in sync
// across three provider implementations.
export const IncidentQuery = z.object({
  ruleId: z.string().optional(),
  severity: Severity.optional(),
  status: IncidentStatus.optional(),
  sinceMinutes: z.number().int().positive().optional(),
});
export type IncidentQuery = z.infer<typeof IncidentQuery>;

export const IncidentQueryResult = z.object({
  filter: IncidentQuery,
  incidents: z.array(Incident),
});
export type IncidentQueryResult = z.infer<typeof IncidentQueryResult>;

// where an incident's source IP is. 'dbip' = a real GeoIP lookup (country
// level, pinned at the country's centroid); 'simulated' = a synthetic demo
// address from a documentation range (TEST-NET, 2001:db8::/32), which has no
// real location — placed deterministically and labeled as simulated in the UI
export const GeoPoint = z.object({
  country: z.string().length(2),
  countryName: z.string(),
  city: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  source: z.enum(['dbip', 'simulated']),
});
export type GeoPoint = z.infer<typeof GeoPoint>;

// GET /incidents — recent-incidents backfill so a freshly opened dashboard
// tab isn't empty until new events happen to arrive live over the socket.
// geo: the source IP's location (null for a private/unlocatable address).
export const IncidentRow = z.object({
  incident: Incident,
  latestAlert: Alert,
  geo: GeoPoint.nullable().optional(),
});
export type IncidentRow = z.infer<typeof IncidentRow>;

export const RecentActivity = z.object({
  incidents: z.array(IncidentRow),
  ruleCounts: z.record(z.string(), z.number().int().nonnegative()),
  hourlyActivity: z.array(z.number().int().nonnegative()).length(24),
});
export type RecentActivity = z.infer<typeof RecentActivity>;

// threat-intel reputation of a source IP (AbuseIPDB), cached server-side
export const IpReputation = z.object({
  ip: z.string(),
  provider: z.literal('abuseipdb'),
  abuseScore: z.number().int().min(0).max(100), // AbuseIPDB "abuse confidence", %
  totalReports: z.number().int().nonnegative(),
  distinctReporters: z.number().int().nonnegative(),
  isTor: z.boolean(),
  usageType: z.string().nullable(), // "Data Center/Web Hosting/Transit", …
  isp: z.string().nullable(),
  domain: z.string().nullable(),
  countryCode: z.string().nullable(),
  lastReportedAt: z.string().datetime().nullable(),
  checkedAt: z.string().datetime(),
});
export type IpReputation = z.infer<typeof IpReputation>;

export const Summarizer = z.enum(['llm', 'template']);
export type Summarizer = z.infer<typeof Summarizer>;

// ai output for an incident
export const IncidentSummary = z.object({
  incidentId: z.string().uuid(),
  summary: z.string(),
  iocs: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  generatedBy: Summarizer,
  generatedAt: z.string().datetime(),
});
export type IncidentSummary = z.infer<typeof IncidentSummary>;

// GET /soc-metrics?days=N — how fast incidents are detected and handled, and
// which rules cry wolf. Durations are in seconds, null when nothing in the
// window qualifies yet.
export const DurationStat = z.object({
  mean: z.number().nonnegative().nullable(),
  median: z.number().nonnegative().nullable(),
  samples: z.number().int().nonnegative(),
});
export type DurationStat = z.infer<typeof DurationStat>;

export const RuleMetrics = z.object({
  ruleId: z.string(),
  alerts: z.number().int().nonnegative(),
  incidents: z.number().int().nonnegative(),
  closed: z.number().int().nonnegative(),
  falsePositives: z.number().int().nonnegative(),
  falsePositiveRate: z.number().min(0).max(1).nullable(), // of closed incidents
  mttdSeconds: z.number().nonnegative().nullable(),
});
export type RuleMetrics = z.infer<typeof RuleMetrics>;

export const SocMetrics = z.object({
  days: z.number().int().positive(),
  since: z.string().datetime(),
  incidents: z.number().int().nonnegative(),
  backlog: z.number().int().nonnegative(), // open + acknowledged
  closed: z.number().int().nonnegative(),
  falsePositives: z.number().int().nonnegative(),
  falsePositiveRate: z.number().min(0).max(1).nullable(),
  mttd: DurationStat, // first evidence -> incident opened
  mtta: DurationStat, // incident opened -> first triage
  mttr: DurationStat, // incident opened -> closed
  rules: z.array(RuleMetrics),
  daily: z.array(
    z.object({
      date: z.string(), // YYYY-MM-DD, UTC
      opened: z.number().int().nonnegative(),
      closed: z.number().int().nonnegative(),
    }),
  ),
});
export type SocMetrics = z.infer<typeof SocMetrics>;

// one row of the audit trail. from/to hold the old and new value: a status,
// an assignee's userId, a resolution note, a role.
export const AuditAction = z.enum([
  'incident.status',
  'incident.assignee',
  'incident.note',
  'user.role',
]);
export type AuditAction = z.infer<typeof AuditAction>;

export const AuditEntry = z.object({
  id: z.string().uuid(),
  at: z.string().datetime(),
  // null = a change made while the login gate was still open (fresh dev
  // install). email is null when the reader may not see other accounts' emails.
  actor: z
    .object({ userId: z.string(), email: z.string().nullable(), role: Role.nullable() })
    .nullable(),
  action: AuditAction,
  targetType: z.enum(['incident', 'user']),
  targetId: z.string(),
  from: z.string().nullable(),
  to: z.string().nullable(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

// GET /admin/users — the full account list, admins only
export const AdminUser = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: Role,
  createdAt: z.string().datetime(),
  signIn: z.array(z.enum(['password', 'google'])),
});
export type AdminUser = z.infer<typeof AdminUser>;

// PATCH /admin/users/:id body
export const RolePatch = z.object({ role: Role });
export type RolePatch = z.infer<typeof RolePatch>;
