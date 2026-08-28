import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

vi.mock('../src/mtoonxt/applyMtoonxtStencil.js', () => ({
  applyMtoonxtStencil: vi.fn(async () => ({ applied: 3, skipped: 1 })),
}));

import { applyMtoonxtStencil } from '../src/mtoonxt/applyMtoonxtStencil.js';
import { tryAttach } from '../src/tryAttach.js';

function fakeGltf(json: unknown): GLTF {
  return {
    parser: { json },
    userData: {},
  } as unknown as GLTF;
}

describe('tryAttach', () => {
  beforeEach(() => {
    vi.mocked(applyMtoonxtStencil).mockClear();
  });

  it('no-ops when VRMXT_materials_mtoonxt is unused', async () => {
    const gltf = fakeGltf({ extensionsUsed: ['VRMC_materials_mtoon'], materials: [{}] });
    const result = await tryAttach(gltf);
    expect(result).toEqual({
      mtoonxtApplied: 0,
      mtoonxtSkipped: 0,
      spriteParticleApplied: 0,
      spriteParticleSkipped: 0,
      spriteParticles: null,
    });
    expect(applyMtoonxtStencil).not.toHaveBeenCalled();
    expect(gltf.userData.vrmxt).toEqual({
      mtoonxtApplied: 0,
      mtoonxtSkipped: 0,
      spriteParticleApplied: 0,
      spriteParticleSkipped: 0,
      spriteParticles: null,
    });
  });

  it('no-ops when extensionsUsed is missing', async () => {
    const gltf = fakeGltf({ materials: [{}] });
    await tryAttach(gltf);
    expect(applyMtoonxtStencil).not.toHaveBeenCalled();
  });

  it('calls applyMtoonxtStencil when the extra is listed', async () => {
    const gltf = fakeGltf({
      extensionsUsed: ['VRMXT_materials_mtoonxt'],
      materials: [{}],
    });
    const result = await tryAttach(gltf);
    expect(applyMtoonxtStencil).toHaveBeenCalledOnce();
    expect(result).toEqual({
      mtoonxtApplied: 3,
      mtoonxtSkipped: 1,
      spriteParticleApplied: 0,
      spriteParticleSkipped: 0,
      spriteParticles: null,
    });
  });
});
