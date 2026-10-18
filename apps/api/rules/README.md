# Detection rules

Each `.yml` file here is one detection rule in a subset of the
[Sigma](https://sigmahq.io/) format. The api compiles every file at boot and
refuses to start if one is invalid, so a broken rule can never fail open.

Rules that need more than a Sigma condition can express (fire-once distinct
counting, correlating failures with a later success, per-source baselines,
tool extraction) are TypeScript in `src/detection/rules/`.

## Format

```yaml
title: SQL injection attempt        # must match the name in @argus/contracts/rules
id: sqli-attempt                    # the ruleId on every alert
tags: [attack.initial-access, attack.t1190]
logsource:
  product: argus
  service: [nginx, api-gateway]     # optional: limits the rule to these sources
detection:
  sql_syntax:
    path|urldecode|re|i:
      - '\bunion\s+select\b'
      - '--'
  condition: sql_syntax
level: high                         # informational, low, medium, high, critical
argus:
  message: 'Possible SQL injection from {sourceIp}: {path}'
  entity: sourceIp                  # optional, what the alert is keyed on
tests:
  match:
    - path: /search?q=%27%20UNION%20SELECT%20password%20FROM%20users--
  nomatch:
    - path: /index.html
```

Fields are the normalized event's: `source`, `sourceIp`, `outcome`,
`username`, `method`, `path`, `statusCode`, `userAgent`, `raw`.

### Selections

A selection is a map of `field|modifiers: value`. Every field in the map must
match. A list of values matches if any value does, a list of maps matches if
any map does. `null` means the field is absent.

| Modifier | Meaning |
| --- | --- |
| (none) | equals, case-insensitive, `*` and `?` wildcards (`\*` for a literal star) |
| `contains`, `startswith`, `endswith` | substring matches, same wildcard rules |
| `re` | regular expression, case-sensitive; add `i` (`re\|i`) to ignore case |
| `exists` | `true` or `false`: the field is present |
| `all` | every value in the list must match, not just one |
| `cased` | make an equals/contains match case-sensitive |
| `urldecode` | Argus extension: URL-decode until the value stops changing first |

### Conditions

`and`, `or`, `not`, parentheses, `1 of sel_*`, `all of sel_*`, `1 of them`,
`all of them`. A threshold rule adds an aggregation and a `timeframe`:

```yaml
  condition: failed_login | count() by sourceIp, username >= 5
timeframe: 60s
```

`count()` counts matching events per group within the timeframe;
`count(field)` counts distinct values of that field. The rule fires each time
the threshold holds, and the engine's per-source throttle collapses repeats.

### Tests

Every rule needs at least one `match` and one `nomatch` fixture. A fixture is
an event (unset fields get defaults), or a sequence:

```yaml
    - events: [{ username: root }]
      repeat: 5          # the last event must fire (match) / none may (nomatch)
```

Run them with `pnpm test:rules`. The same suite also checks each rule's title,
level and ATT&CK tag against the shared rule catalog.
