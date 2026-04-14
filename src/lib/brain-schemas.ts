/**
 * Brain doc schemas — write-time shape validation (Task #346, HB#168).
 *
 * Retro #1 change #5: currently applyBrainChange() accepts any doc shape
 * and the projection layer (brain-projections.ts) tolerates bad shapes at
 * read time via formatTimestamp() and schema-tolerant renderers. That
 * approach means bad data enters the doc and stays forever (Automerge
 * field renames are merge hazards per HB#248). This module validates
 * shape at WRITE time so canonically-broken entries never enter the doc.
 *
 * DESIGN:
 * - Per-doc-id validators. pop.brain.shared, pop.brain.projects,
 *   pop.brain.retros each have their own shape. Unknown doc ids return
 *   `{ ok: true, warnings: [...] }` — permissionless schema evolution.
 * - Validators check ITEMS of known arrays for required fields. Extra
 *   fields are allowed (extensibility); missing required fields are errors.
 * - applyBrainChange diffs pre-vs-post validity: if the pre-change doc
 *   was already invalid, the bad state was inherited, not introduced, and
 *   the new write is NOT rejected. Only regressions (valid → invalid) are
 *   rejected. This preserves the constraint "existing bad entries stay
 *   readable" while still preventing new bad writes.
 * - Per-command --allow-invalid-shape bypass lives at the CLI layer and is
 *   plumbed through applyBrainChange's options bag.
 *
 * SCHEMAS ARE DEFINED ONCE HERE and NOT duplicated in the CLI commands.
 */

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Lesson schema used by pop.brain.shared and (historically) pop.brain.lessons.
 * Canonical shape: { id, author, title, body, timestamp, removed? }.
 * Legacy tolerance: `text` is accepted as a synonym for `body`, `ts` for
 * `timestamp` — the projection layer reads both (HB#297 formatTimestamp).
 * A lesson must have at least one of {body, text} AND at least one of
 * {title, id}. That's the minimum renderable shape.
 */
function validateLesson(lesson: any, index: number, errors: string[]): void {
  if (lesson == null || typeof lesson !== 'object') {
    errors.push(`lessons[${index}]: not an object`);
    return;
  }
  const hasBody =
    (typeof lesson.body === 'string' && lesson.body.length > 0) ||
    (typeof lesson.text === 'string' && lesson.text.length > 0);
  if (!hasBody) {
    errors.push(`lessons[${index}]: missing required body/text (one must be a non-empty string)`);
  }
  const hasTitle =
    (typeof lesson.title === 'string' && lesson.title.length > 0) ||
    (typeof lesson.id === 'string' && lesson.id.length > 0);
  if (!hasTitle) {
    errors.push(`lessons[${index}]: missing required title/id (one must be a non-empty string)`);
  }
  if (lesson.timestamp != null && lesson.ts != null) {
    // Not an error; just unusual. Don't warn noisily.
  }
  if (
    lesson.timestamp != null &&
    typeof lesson.timestamp !== 'number' &&
    typeof lesson.timestamp !== 'string'
  ) {
    errors.push(`lessons[${index}]: timestamp must be number or ISO string`);
  }
  // Task #347: optional tags field. Must be an array of strings when present.
  // Backwards compatible: existing lessons without tags still validate.
  // Tag vocabulary is free-form — no enforcement of category:/topic:/etc.
  if (lesson.tags != null) {
    if (!Array.isArray(lesson.tags)) {
      errors.push(`lessons[${index}]: tags must be an array of strings`);
    } else {
      for (let i = 0; i < lesson.tags.length; i++) {
        if (typeof lesson.tags[i] !== 'string') {
          errors.push(`lessons[${index}]: tags[${i}] must be a string`);
        }
      }
    }
  }
}

function validateRule(rule: any, index: number, errors: string[]): void {
  if (rule == null || typeof rule !== 'object') {
    errors.push(`rules[${index}]: not an object`);
    return;
  }
  if (typeof rule.text !== 'string' || rule.text.length === 0) {
    errors.push(`rules[${index}]: missing required text (non-empty string)`);
  }
}

/**
 * pop.brain.shared — lessons + rules + operatingConstraints + orgState.
 * Arrays are optional (first-write bootstrap) but when present their items
 * must validate.
 */
function validateSharedDoc(doc: any, errors: string[], warnings: string[]): void {
  if (doc == null || typeof doc !== 'object') {
    errors.push('pop.brain.shared: doc is not an object');
    return;
  }
  if (doc.lessons != null) {
    if (!Array.isArray(doc.lessons)) {
      errors.push('pop.brain.shared: lessons must be an array');
    } else {
      doc.lessons.forEach((l: any, i: number) => validateLesson(l, i, errors));
    }
  }
  if (doc.rules != null) {
    if (!Array.isArray(doc.rules)) {
      errors.push('pop.brain.shared: rules must be an array');
    } else {
      doc.rules.forEach((r: any, i: number) => validateRule(r, i, errors));
    }
  }
  if (doc.operatingConstraints != null && !Array.isArray(doc.operatingConstraints)) {
    errors.push('pop.brain.shared: operatingConstraints must be an array');
  }
  if (doc.orgState != null && typeof doc.orgState !== 'object') {
    errors.push('pop.brain.shared: orgState must be an object');
  }
  void warnings;
}

const VALID_PROJECT_STAGES = new Set([
  'proposed',
  'discuss',
  'plan',
  'building',
  'shipped',
  'retrospective',
  'archived',
]);

function validateProject(p: any, index: number, errors: string[]): void {
  if (p == null || typeof p !== 'object') {
    errors.push(`projects[${index}]: not an object`);
    return;
  }
  if (typeof p.id !== 'string' || p.id.length === 0) {
    errors.push(`projects[${index}]: missing required id (non-empty string)`);
  }
  if (typeof p.name !== 'string' || p.name.length === 0) {
    errors.push(`projects[${index}]: missing required name (non-empty string)`);
  }
  if (typeof p.stage !== 'string' || !VALID_PROJECT_STAGES.has(p.stage)) {
    errors.push(
      `projects[${index}]: stage must be one of ${[...VALID_PROJECT_STAGES].join('|')}, got ${JSON.stringify(p.stage)}`,
    );
  }
}

function validateProjectsDoc(doc: any, errors: string[]): void {
  if (doc == null || typeof doc !== 'object') {
    errors.push('pop.brain.projects: doc is not an object');
    return;
  }
  if (doc.projects != null) {
    if (!Array.isArray(doc.projects)) {
      errors.push('pop.brain.projects: projects must be an array');
    } else {
      doc.projects.forEach((p: any, i: number) => validateProject(p, i, errors));
    }
  }
}

function validateRetro(r: any, index: number, errors: string[]): void {
  if (r == null || typeof r !== 'object') {
    errors.push(`retros[${index}]: not an object`);
    return;
  }
  if (typeof r.id !== 'string' || r.id.length === 0) {
    errors.push(`retros[${index}]: missing required id`);
  }
  if (r.proposedChanges != null && !Array.isArray(r.proposedChanges)) {
    errors.push(`retros[${index}]: proposedChanges must be an array`);
  }
  if (r.discussion != null && !Array.isArray(r.discussion)) {
    errors.push(`retros[${index}]: discussion must be an array`);
  }
}

function validateRetrosDoc(doc: any, errors: string[]): void {
  if (doc == null || typeof doc !== 'object') {
    errors.push('pop.brain.retros: doc is not an object');
    return;
  }
  if (doc.retros != null) {
    if (!Array.isArray(doc.retros)) {
      errors.push('pop.brain.retros: retros must be an array');
    } else {
      doc.retros.forEach((r: any, i: number) => validateRetro(r, i, errors));
    }
  }
}

/**
 * Dispatch entry point. Returns { ok, errors, warnings }. Unknown doc ids
 * are permitted (schema evolution) with a warning, not an error.
 */
export function validateBrainDocShape(docId: string, doc: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (docId) {
    case 'pop.brain.shared':
    case 'pop.brain.lessons':
      validateSharedDoc(doc, errors, warnings);
      break;
    case 'pop.brain.projects':
      validateProjectsDoc(doc, errors);
      break;
    case 'pop.brain.retros':
      validateRetrosDoc(doc, errors);
      break;
    default:
      warnings.push(
        `unknown doc id "${docId}" — no schema registered, accepting any shape. ` +
          `Add a validator to src/lib/brain-schemas.ts to enforce one.`,
      );
  }

  return { ok: errors.length === 0, errors, warnings };
}
