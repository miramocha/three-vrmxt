import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyMtoonxtStencil } from './mtoonxt/applyMtoonxtStencil.js';

export type MtoonxtAttachResult = {
  mtoonxtApplied: number;
  mtoonxtSkipped: number;
};

/**
 * Attach VRMXT / MToonXT extras after a stock three-vrm (or GLTF) load.
 * Missing extensions: no-op.
 */
export async function tryAttach(gltf: GLTF): Promise<MtoonxtAttachResult> {
  const json = gltf.parser.json as {
    extensionsUsed?: string[];
    materials?: unknown[];
  };
  const used = json.extensionsUsed ?? [];
  const result: MtoonxtAttachResult = { mtoonxtApplied: 0, mtoonxtSkipped: 0 };

  if (used.includes('VRMXT_materials_mtoonxt') && json.materials) {
    const stats = await applyMtoonxtStencil(gltf);
    result.mtoonxtApplied = stats.applied;
    result.mtoonxtSkipped = stats.skipped;
  }

  gltf.userData.vrmxt = {
    ...(typeof gltf.userData.vrmxt === 'object' && gltf.userData.vrmxt !== null
      ? gltf.userData.vrmxt
      : {}),
    ...result,
  };

  return result;
}
