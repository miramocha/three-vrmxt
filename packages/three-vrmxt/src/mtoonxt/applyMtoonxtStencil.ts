import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  assignStencilRefs,
  isUnresolvableBody,
  isUnresolvableOutline,
  parseStencilExtra,
  writerSetKey,
  type StencilExtra,
} from './stencilRefs.js';

export type ApplyStats = { applied: number; skipped: number };

type MtoonxtObject = {
  specVersion?: string;
  stencil?: unknown;
  outlineStencil?: unknown;
};

function readMtoonxt(matDef: unknown): MtoonxtObject | null {
  if (matDef === null || typeof matDef !== 'object') {
    return null;
  }
  const ext = (matDef as { extensions?: { VRMXT_materials_mtoonxt?: unknown } }).extensions
    ?.VRMXT_materials_mtoonxt;
  if (ext === null || typeof ext !== 'object') {
    return null;
  }
  return ext as MtoonxtObject;
}

function applyGpuOp(
  material: THREE.Material,
  extra: StencilExtra,
  ref: number,
): void {
  material.stencilWrite = true;
  material.stencilFuncMask = 0xff;
  material.stencilWriteMask = 0xff;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.KeepStencilOp;
  material.stencilRef = ref;
  material.needsUpdate = true;

  if (extra.op === 'write') {
    material.stencilFunc = THREE.AlwaysStencilFunc;
    material.stencilZPass = THREE.ReplaceStencilOp;
    return;
  }

  material.stencilZPass = THREE.KeepStencilOp;
  if (extra.op === 'outside') {
    material.stencilFunc = THREE.NotEqualStencilFunc;
  } else {
    material.stencilFunc = THREE.EqualStencilFunc;
  }

  if (extra.op === 'insideOverlay') {
    material.depthFunc = THREE.AlwaysDepth;
    material.depthWrite = false;
  }
}

function resolveOutlineExtra(
  outline: StencilExtra | null,
  body: StencilExtra | null,
): StencilExtra | null {
  if (!outline) {
    return null;
  }
  if (outline.op === 'same') {
    return body;
  }
  return outline;
}

export async function applyMtoonxtStencil(gltf: GLTF): Promise<ApplyStats> {
  const json = gltf.parser.json as {
    materials?: unknown[];
  };
  const defs = json.materials ?? [];
  const threeMaterials = (await gltf.parser.getDependencies('material')) as THREE.Material[];
  const stats: ApplyStats = { applied: 0, skipped: 0 };

  const bodyOps: Array<StencilExtra | null> = defs.map((def) => {
    const xt = readMtoonxt(def);
    if (!xt || xt.specVersion !== '1.0') {
      return null;
    }
    const sibling = (def as { extensions?: { VRMC_materials_mtoon?: unknown } }).extensions
      ?.VRMC_materials_mtoon;
    if (!sibling) {
      return null;
    }
    return parseStencilExtra(xt.stencil);
  });

  const outlineParsed: Array<StencilExtra | null> = defs.map((def, i) => {
    const xt = readMtoonxt(def);
    if (!xt || xt.specVersion !== '1.0') {
      return null;
    }
    const extra = parseStencilExtra(xt.outlineStencil);
    if (!extra) {
      return null;
    }
    if (isUnresolvableOutline(extra, bodyOps[i] ?? null, defs.length, bodyOps, i)) {
      return null;
    }
    return extra;
  });

  const bodyResolved: Array<StencilExtra | null> = bodyOps.map((extra, i) => {
    if (!extra) {
      return null;
    }
    if (isUnresolvableBody(extra, defs.length, bodyOps, i)) {
      stats.skipped += 1;
      return null;
    }
    return extra;
  });

  const refs = assignStencilRefs(bodyResolved);

  for (let i = 0; i < defs.length; i++) {
    const body = bodyResolved[i];
    const mat = threeMaterials[i];
    if (!mat) {
      continue;
    }
    if (body) {
      const key = writerSetKey(body, i);
      const ref = key ? refs.get(key) : undefined;
      if (ref !== undefined) {
        applyGpuOp(mat, body, ref);
        stats.applied += 1;
      } else {
        stats.skipped += 1;
      }
    }
  }

  applyStencilOnSceneGraph(gltf, defs, threeMaterials, bodyResolved, outlineParsed, refs);

  return stats;
}

/** Lower draws first. Matches UniVRMXT write-before-inside/outside, overlay last. */
function renderOrderFor(extra: StencilExtra): number {
  if (extra.op === 'write') {
    return 10;
  }
  if (extra.op === 'inside') {
    return 11;
  }
  if (extra.op === 'outside') {
    return 12;
  }
  return 13;
}

function isOutlineMaterial(material: THREE.Material): boolean {
  return (material as THREE.Material & { isOutline?: boolean }).isOutline === true;
}

type MaterialAssoc = { type?: string; index?: number };

function resolveMaterialIndex(
  parser: GLTF['parser'],
  material: THREE.Material,
  threeMaterials: THREE.Material[],
  defs: unknown[],
): number | null {
  const assoc = parser.associations?.get(material) as MaterialAssoc | number | undefined;
  if (typeof assoc === 'number' && assoc >= 0) {
    return assoc;
  }
  if (assoc && typeof assoc === 'object' && typeof assoc.index === 'number') {
    return assoc.index;
  }
  const direct = threeMaterials.indexOf(material);
  if (direct >= 0) {
    return direct;
  }
  let name = material.name;
  const suffix = ' (Outline)';
  if (name.endsWith(suffix)) {
    name = name.slice(0, -suffix.length);
  }
  const byParser = threeMaterials.findIndex((m) => m.name === name);
  if (byParser >= 0) {
    return byParser;
  }
  const byDef = defs.findIndex((d) => (d as { name?: string }).name === name);
  return byDef >= 0 ? byDef : null;
}

function applySlot(
  slot: THREE.Material,
  mesh: THREE.Mesh | null,
  idx: number,
  bodyResolved: Array<StencilExtra | null>,
  outlineParsed: Array<StencilExtra | null>,
  refs: Map<string, number>,
): boolean {
  const body = bodyResolved[idx] ?? null;
  const outlineExtra = resolveOutlineExtra(outlineParsed[idx] ?? null, body);
  const extra = isOutlineMaterial(slot) ? outlineExtra : body;
  if (!extra) {
    return false;
  }
  const key = writerSetKey(extra, idx);
  const ref = key ? refs.get(key) : undefined;
  if (ref === undefined) {
    return false;
  }
  applyGpuOp(slot, extra, ref);
  if (mesh && body && !isOutlineMaterial(slot)) {
    mesh.renderOrder = renderOrderFor(body);
  }
  return true;
}

function applyStencilOnSceneGraph(
  gltf: GLTF,
  defs: unknown[],
  threeMaterials: THREE.Material[],
  bodyResolved: Array<StencilExtra | null>,
  outlineParsed: Array<StencilExtra | null>,
  refs: Map<string, number>,
): void {
  const seen = new Set<THREE.Material>();

  const consider = (slot: THREE.Material, mesh: THREE.Mesh | null) => {
    if (seen.has(slot)) {
      return;
    }
    const idx = resolveMaterialIndex(gltf.parser, slot, threeMaterials, defs);
    if (idx === null) {
      return;
    }
    if (applySlot(slot, mesh, idx, bodyResolved, outlineParsed, refs)) {
      seen.add(slot);
    }
  };

  gltf.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const slot of materials) {
      consider(slot, mesh);
    }
  });

  const mtoon = gltf.userData.vrmMToonMaterials as THREE.Material[] | undefined;
  if (mtoon) {
    for (const slot of mtoon) {
      consider(slot, null);
    }
  }
}
