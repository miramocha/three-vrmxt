export type StencilOpName = 'write' | 'inside' | 'insideOverlay' | 'outside' | 'same';

export type StencilExtra = {
  op: StencilOpName;
  materials?: number[];
};

export type MaterialStencilPlan = {
  body: StencilExtra | null;
  outline: StencilExtra | null;
  specOk: boolean;
};

const BODY_OPS = new Set<StencilOpName>(['write', 'inside', 'insideOverlay', 'outside']);
const OUTLINE_OPS = new Set<StencilOpName>(['write', 'inside', 'insideOverlay', 'outside', 'same']);

export function parseStencilExtra(raw: unknown): StencilExtra | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const op = (raw as { op?: unknown }).op;
  if (
    op !== 'write' &&
    op !== 'inside' &&
    op !== 'insideOverlay' &&
    op !== 'outside' &&
    op !== 'same'
  ) {
    return null;
  }
  const materials = (raw as { materials?: unknown }).materials;
  if (materials !== undefined) {
    if (!Array.isArray(materials) || materials.length === 0) {
      return null;
    }
    if (!materials.every((i) => Number.isInteger(i) && (i as number) >= 0)) {
      return null;
    }
  }
  return { op, materials: materials as number[] | undefined };
}

export function isUnresolvableBody(
  extra: StencilExtra,
  materialCount: number,
  bodyOps: Array<StencilExtra | null>,
  index: number,
): boolean {
  if (extra.op === 'same') {
    return true;
  }
  if (!BODY_OPS.has(extra.op)) {
    return true;
  }
  if (extra.op === 'write') {
    return extra.materials !== undefined;
  }
  if (!extra.materials) {
    return true;
  }
  for (const w of extra.materials) {
    if (w === index || w < 0 || w >= materialCount) {
      return true;
    }
    const writer = bodyOps[w];
    if (!writer || writer.op !== 'write') {
      return true;
    }
  }
  return false;
}

export function isUnresolvableOutline(
  extra: StencilExtra,
  body: StencilExtra | null,
  materialCount: number,
  bodyOps: Array<StencilExtra | null>,
  index: number,
): boolean {
  if (!OUTLINE_OPS.has(extra.op)) {
    return true;
  }
  if (extra.op === 'same') {
    return extra.materials !== undefined || body === null;
  }
  if (extra.op === 'write') {
    return extra.materials !== undefined;
  }
  if (!extra.materials) {
    return true;
  }
  for (const w of extra.materials) {
    if (w === index || w < 0 || w >= materialCount) {
      return true;
    }
    const writer = bodyOps[w];
    if (!writer || writer.op !== 'write') {
      return true;
    }
  }
  return false;
}

function sortedKey(indices: number[]): string {
  return [...indices].sort((a, b) => a - b).join(',');
}

/**
 * File-local GPU stencil refs per unique writer-index set (spec GPU stencil consumer).
 */
export function assignStencilRefs(
  bodyOps: Array<StencilExtra | null>,
): Map<string, number> {
  const keys = new Set<string>();
  const listed = new Set<number>();
  for (const extra of bodyOps) {
    if (!extra) {
      continue;
    }
    if (
      (extra.op === 'inside' || extra.op === 'insideOverlay' || extra.op === 'outside') &&
      extra.materials
    ) {
      keys.add(sortedKey(extra.materials));
      for (const w of extra.materials) {
        listed.add(w);
      }
    }
  }
  bodyOps.forEach((extra, i) => {
    if (extra?.op === 'write' && !listed.has(i)) {
      keys.add(sortedKey([i]));
    }
  });
  const ordered = [...keys].sort();
  const refs = new Map<string, number>();
  ordered.forEach((key, n) => {
    refs.set(key, n + 1);
  });
  return refs;
}

export function writerSetKey(extra: StencilExtra, materialIndex: number): string | null {
  if (extra.op === 'write') {
    return sortedKey([materialIndex]);
  }
  if (
    (extra.op === 'inside' || extra.op === 'insideOverlay' || extra.op === 'outside') &&
    extra.materials
  ) {
    return sortedKey(extra.materials);
  }
  return null;
}
