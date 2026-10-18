// Sigma condition expressions, the subset Argus rules use:
//
//   selection                      a named selection
//   a and b / a or b / not a       boolean logic, "not" binds tightest, then "and"
//   ( ... )                        grouping
//   1 of sel_*  /  all of sel_*    any / every selection matching a wildcard
//   1 of them   /  all of them     any / every selection in the rule
//   ... | count() by f1, f2 > N    aggregation (see parseAggregation)
//
// Parsed once at load into a tree, then evaluated per event against the
// selections that matched.

export type Condition =
  | { kind: 'ref'; name: string }
  | { kind: 'not'; operand: Condition }
  | { kind: 'and' | 'or'; left: Condition; right: Condition }
  | { kind: 'of'; quantifier: 'any' | 'all'; names: string[] };

export interface Aggregation {
  // count() counts events; count(field) counts distinct values of field
  distinctField: string | undefined;
  groupBy: string[];
  op: '>' | '>=' | '=';
  threshold: number;
}

const TOKEN = /\s*(\(|\)|[A-Za-z_][\w*]*|\d+|\*)\s*/y;

function tokenize(source: string): string[] {
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < source.length) {
    const start = TOKEN.lastIndex;
    const m = TOKEN.exec(source);
    if (!m) throw new Error(`unexpected input at "${source.slice(start)}"`);
    tokens.push(m[1]!);
  }
  return tokens;
}

function globToRegExp(glob: string): RegExp {
  return new RegExp(`^${glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
}

// recursive descent over: or -> and ('or' and)*, and -> not ('and' not)*,
// not -> 'not' not | atom, atom -> '(' or ')' | quantifier 'of' target | name
export function parseCondition(source: string, selections: string[]): Condition {
  const tokens = tokenize(source);
  let pos = 0;
  const peek = () => tokens[pos]?.toLowerCase();
  const next = () => {
    const token = tokens[pos++];
    if (token === undefined) throw new Error(`condition "${source}" ends unexpectedly`);
    return token;
  };

  const parseOr = (): Condition => {
    let left = parseAnd();
    while (peek() === 'or') {
      pos++;
      left = { kind: 'or', left, right: parseAnd() };
    }
    return left;
  };
  const parseAnd = (): Condition => {
    let left = parseNot();
    while (peek() === 'and') {
      pos++;
      left = { kind: 'and', left, right: parseNot() };
    }
    return left;
  };
  const parseNot = (): Condition => {
    if (peek() === 'not') {
      pos++;
      return { kind: 'not', operand: parseNot() };
    }
    return parseAtom();
  };
  const parseAtom = (): Condition => {
    const token = next();
    if (token === '(') {
      const inner = parseOr();
      if (next() !== ')') throw new Error(`missing ")" in condition "${source}"`);
      return inner;
    }
    const lower = token.toLowerCase();
    if ((lower === '1' || lower === 'all') && peek() === 'of') {
      pos++;
      const target = next();
      const names =
        target.toLowerCase() === 'them'
          ? selections
          : selections.filter((s) => globToRegExp(target).test(s));
      if (names.length === 0) throw new Error(`"${target}" matches no selection`);
      return { kind: 'of', quantifier: lower === '1' ? 'any' : 'all', names };
    }
    if (!selections.includes(token)) throw new Error(`unknown selection "${token}"`);
    return { kind: 'ref', name: token };
  };

  const tree = parseOr();
  if (pos !== tokens.length) {
    throw new Error(`unexpected "${tokens[pos]}" in condition "${source}"`);
  }
  return tree;
}

export function evaluateCondition(cond: Condition, matched: (name: string) => boolean): boolean {
  switch (cond.kind) {
    case 'ref':
      return matched(cond.name);
    case 'not':
      return !evaluateCondition(cond.operand, matched);
    case 'and':
      return evaluateCondition(cond.left, matched) && evaluateCondition(cond.right, matched);
    case 'or':
      return evaluateCondition(cond.left, matched) || evaluateCondition(cond.right, matched);
    case 'of':
      return cond.quantifier === 'any' ? cond.names.some(matched) : cond.names.every(matched);
  }
}

const AGGREGATION =
  /^count\(\s*(\w*)\s*\)(?:\s+by\s+(\w+(?:\s*,\s*\w+)*))?\s*(>=|>|==|=)\s*(\d+)$/i;

// the part after "|". Only thresholds that can be crossed by one more event
// (>, >=, =) make sense here: the window is checked as each event lands.
export function parseAggregation(source: string): Aggregation {
  const m = AGGREGATION.exec(source.trim());
  if (!m) {
    throw new Error(
      `unsupported aggregation "${source.trim()}" (expected count() [by f1, f2] >|>=|= N)`,
    );
  }
  return {
    distinctField: m[1] || undefined,
    groupBy: m[2] ? m[2].split(',').map((f) => f.trim()) : [],
    op: m[3] === '==' ? '=' : (m[3] as Aggregation['op']),
    threshold: Number(m[4]),
  };
}
