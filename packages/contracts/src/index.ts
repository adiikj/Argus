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

export const Source = z.enum(['auth', 'api-gateway', 'nginx']);
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
});
export type Incident = z.infer<typeof Incident>;

// PATCH /incidents/:id body
export const IncidentPatch = z.object({
  status: IncidentStatus.optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  resolutionNote: z.string().optional(),
});
export type IncidentPatch = z.infer<typeof IncidentPatch>;

// GET /users — just enough to populate an assignee picker
export const PublicUser = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
});
export type PublicUser = z.infer<typeof PublicUser>;

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
