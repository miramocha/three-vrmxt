import {
  isUnresolvableBody,
  isUnresolvableOutline,
  parseStencilExtra,
  type StencilExtra,
} from './stencilRefs.js';

export const EXT_MTOON = 'VRMC_materials_mtoon';
export const EXT_MTOONXT = 'VRMXT_materials_mtoonxt';

export type GltfJson = {
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  materials?: unknown[];
};

export type StencilMaterialRow = {
  index: number;
  name: string;
  hasMtoon: boolean;
  body: StencilExtra | null;
  outline: StencilExtra | null;
  bodyUnresolvable: boolean;
  outlineUnresolvable: boolean;
};

type ExtMap = { [name: string]: unknown };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function materialExts(def: unknown): ExtMap | null {
  const rec = asRecord(def);
  if (!rec) {
    return null;
  }
  const ext = rec.extensions;
  if (ext === null || ext === undefined) {
    return null;
  }
  return asRecord(ext);
}

export function materialHasSiblingMtoon(def: unknown): boolean {
  const ext = materialExts(def);
  return ext !== null && asRecord(ext[EXT_MTOON]) !== null;
}

function readMtoonxt(def: unknown): Record<string, unknown> | null {
  const ext = materialExts(def);
  if (!ext) {
    return null;
  }
  return asRecord(ext[EXT_MTOONXT]);
}

function parseStencilForEdit(raw: unknown): StencilExtra | null {
  const parsed = parseStencilExtra(raw);
  if (parsed) {
    return parsed;
  }
  const rec = asRecord(raw);
  if (!rec) {
    return null;
  }
  const op = rec.op;
  if (op !== 'inside' && op !== 'insideOverlay' && op !== 'outside') {
    return null;
  }
  return { op, materials: [] };
}

function serializeExtra(extra: StencilExtra): Record<string, unknown> {
  const out: Record<string, unknown> = { op: extra.op };
  if (
    extra.op === 'inside' ||
    extra.op === 'insideOverlay' ||
    extra.op === 'outside'
  ) {
    out.materials = extra.materials ? [...extra.materials] : [];
  }
  return out;
}

function keepOtherMtoonxtFields(xt: Record<string, unknown>): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(xt)) {
    if (key === 'specVersion' || key === 'stencil' || key === 'outlineStencil') {
      continue;
    }
    kept[key] = value;
  }
  return kept;
}

function ensureExtMap(def: Record<string, unknown>): ExtMap {
  const existing = asRecord(def.extensions);
  if (existing) {
    return existing;
  }
  const created: ExtMap = {};
  def.extensions = created;
  return created;
}

function anyMtoonxt(json: GltfJson): boolean {
  for (const def of json.materials ?? []) {
    if (readMtoonxt(def)) {
      return true;
    }
  }
  return false;
}

export function ensureMtoonxtUsed(json: GltfJson): void {
  if (!anyMtoonxt(json)) {
    if (json.extensionsUsed) {
      json.extensionsUsed = json.extensionsUsed.filter((n) => n !== EXT_MTOONXT);
      if (json.extensionsUsed.length === 0) {
        delete json.extensionsUsed;
      }
    }
    return;
  }
  const used = json.extensionsUsed ? [...json.extensionsUsed] : [];
  if (!used.includes(EXT_MTOONXT)) {
    used.push(EXT_MTOONXT);
  }
  json.extensionsUsed = used;
  if (json.extensionsRequired) {
    json.extensionsRequired = json.extensionsRequired.filter((n) => n !== EXT_MTOONXT);
    if (json.extensionsRequired.length === 0) {
      delete json.extensionsRequired;
    }
  }
}

export function setMaterialStencilExtras(
  json: GltfJson,
  index: number,
  body: StencilExtra | null,
  outline: StencilExtra | null,
): boolean {
  const defs = json.materials;
  if (!defs || index < 0 || index >= defs.length) {
    return false;
  }
  const def = asRecord(defs[index]);
  if (!def || !materialHasSiblingMtoon(def)) {
    return false;
  }
  const prev = readMtoonxt(def) ?? {};
  const other = keepOtherMtoonxtFields(prev);
  const next: Record<string, unknown> = { specVersion: '1.0', ...other };
  if (body) {
    next.stencil = serializeExtra(body);
  }
  if (outline) {
    next.outlineStencil = serializeExtra(outline);
  }
  const ext = ensureExtMap(def);
  if (!body && !outline && Object.keys(other).length === 0) {
    delete ext[EXT_MTOONXT];
    if (Object.keys(ext).length === 0) {
      delete def.extensions;
    }
  } else {
    ext[EXT_MTOONXT] = next;
  }
  ensureMtoonxtUsed(json);
  return true;
}

function bodyOpsFromDefs(defs: unknown[]): Array<StencilExtra | null> {
  return defs.map((def) => {
    const xt = readMtoonxt(def);
    if (!xt || xt.specVersion !== '1.0') {
      return null;
    }
    return parseStencilExtra(xt.stencil);
  });
}

export function listStencilMaterials(json: GltfJson): StencilMaterialRow[] {
  const defs = json.materials ?? [];
  const bodyOps = bodyOpsFromDefs(defs);
  return defs.map((def, index) => {
    const rec = asRecord(def);
    const xt = readMtoonxt(def);
    const body = xt ? parseStencilForEdit(xt.stencil) : null;
    const outline = xt ? parseStencilForEdit(xt.outlineStencil) : null;
    const hasMtoon = materialHasSiblingMtoon(def);
    return {
      index,
      name: typeof rec?.name === 'string' ? rec.name : `Material ${index}`,
      hasMtoon,
      body,
      outline,
      bodyUnresolvable: body
        ? isUnresolvableBody(body, defs.length, bodyOps, index)
        : false,
      outlineUnresolvable: outline
        ? isUnresolvableOutline(outline, body, defs.length, bodyOps, index)
        : false,
    };
  });
}

function stripMtoonxtIfEmpty(def: Record<string, unknown>, xt: Record<string, unknown>): void {
  const other = keepOtherMtoonxtFields(xt);
  if (xt.stencil === undefined && xt.outlineStencil === undefined && Object.keys(other).length === 0) {
    const ext = materialExts(def);
    if (!ext) {
      return;
    }
    delete ext[EXT_MTOONXT];
    if (Object.keys(ext).length === 0) {
      delete def.extensions;
    }
  }
}

export function sanitizeMtoonxtStencils(json: GltfJson): void {
  const defs = json.materials ?? [];
  const bodyOps = bodyOpsFromDefs(defs);
  defs.forEach((raw, index) => {
    const def = asRecord(raw);
    const xt = readMtoonxt(raw);
    if (!def || !xt) {
      return;
    }
    const body = parseStencilExtra(xt.stencil);
    const outline = parseStencilExtra(xt.outlineStencil);
    if (body && isUnresolvableBody(body, defs.length, bodyOps, index)) {
      delete xt.stencil;
    }
    const bodyAfter = parseStencilExtra(xt.stencil);
    if (outline && isUnresolvableOutline(outline, bodyAfter, defs.length, bodyOps, index)) {
      delete xt.outlineStencil;
    }
    stripMtoonxtIfEmpty(def, xt);
  });
  ensureMtoonxtUsed(json);
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
