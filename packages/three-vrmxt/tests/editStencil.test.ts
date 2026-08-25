import { describe, expect, it } from 'vitest';
import { buildGlb, isGlb, parseGlb } from '../src/gltf/glbCodec.js';
import {
  EXT_MTOONXT,
  cloneJson,
  listStencilMaterials,
  sanitizeMtoonxtStencils,
  setMaterialStencilExtras,
  type GltfJson,
} from '../src/mtoonxt/editStencil.js';

function mtoonMat(name: string, extra?: unknown): unknown {
  const extensions: Record<string, unknown> = {
    VRMC_materials_mtoon: { specVersion: '1.0' },
  };
  if (extra) {
    extensions.VRMXT_materials_mtoonxt = extra;
  }
  return { name, extensions };
}

describe('glbCodec', () => {
  it('round-trips JSON and BIN with 4-byte padding', () => {
    const json = { asset: { version: '2.0' }, extras: { n: 1 } };
    const bin = new Uint8Array([1, 2, 3]);
    const bytes = buildGlb(json, bin);
    expect(isGlb(bytes)).toBe(true);
    expect(bytes.byteLength % 4).toBe(0);
    const parsed = parseGlb(bytes);
    expect(parsed?.json).toEqual(json);
    expect([...parsed!.bin!.subarray(0, 3)]).toEqual([1, 2, 3]);
    expect(parsed!.bin!.byteLength % 4).toBe(0);
  });

  it('parses JSON-only GLB', () => {
    const json = { asset: { version: '2.0' } };
    const parsed = parseGlb(buildGlb(json, null));
    expect(parsed?.json).toEqual(json);
    expect(parsed?.bin).toBeNull();
  });

  it('returns null for non-GLB', () => {
    const text = new TextEncoder().encode('{"asset":{"version":"2.0"}}');
    expect(parseGlb(text.buffer)).toBeNull();
  });
});

describe('setMaterialStencilExtras', () => {
  it('writes write + outside extras and extensionsUsed, never required', () => {
    const json: GltfJson = {
      materials: [mtoonMat('Face'), mtoonMat('Hair')],
    };
    expect(setMaterialStencilExtras(json, 0, { op: 'write' }, null)).toBe(true);
    expect(
      setMaterialStencilExtras(json, 1, { op: 'outside', materials: [0] }, { op: 'same' }),
    ).toBe(true);
    expect(json.extensionsUsed).toEqual([EXT_MTOONXT]);
    expect(json.extensionsRequired).toBeUndefined();
    const face = json.materials![0] as {
      extensions: { VRMXT_materials_mtoonxt: Record<string, unknown> };
    };
    expect(face.extensions.VRMXT_materials_mtoonxt).toEqual({
      specVersion: '1.0',
      stencil: { op: 'write' },
    });
    const hair = json.materials![1] as {
      extensions: { VRMXT_materials_mtoonxt: Record<string, unknown> };
    };
    expect(hair.extensions.VRMXT_materials_mtoonxt.stencil).toEqual({
      op: 'outside',
      materials: [0],
    });
    expect(hair.extensions.VRMXT_materials_mtoonxt.outlineStencil).toEqual({ op: 'same' });
  });

  it('rejects materials without sibling MToon', () => {
    const json: GltfJson = { materials: [{ name: 'PBR' }] };
    expect(setMaterialStencilExtras(json, 0, { op: 'write' }, null)).toBe(false);
  });

  it('omits the extension when both extras are cleared', () => {
    const json: GltfJson = { materials: [mtoonMat('Face')] };
    setMaterialStencilExtras(json, 0, { op: 'write' }, null);
    setMaterialStencilExtras(json, 0, null, null);
    const def = json.materials![0] as { extensions: Record<string, unknown> };
    expect(def.extensions.VRMXT_materials_mtoonxt).toBeUndefined();
    expect(json.extensionsUsed).toBeUndefined();
  });
});

describe('sanitizeMtoonxtStencils', () => {
  it('drops clip listing a non-write writer', () => {
    const json: GltfJson = {
      extensionsUsed: [EXT_MTOONXT],
      materials: [
        mtoonMat('A', { specVersion: '1.0', stencil: { op: 'inside', materials: [1] } }),
        mtoonMat('B', { specVersion: '1.0', stencil: { op: 'write' } }),
      ],
    };
    const clone = cloneJson(json);
    clone.materials![1] = mtoonMat('B');
    sanitizeMtoonxtStencils(clone);
    const a = clone.materials![0] as { extensions: Record<string, unknown> };
    expect(a.extensions.VRMXT_materials_mtoonxt).toBeUndefined();
    expect(clone.extensionsUsed).toBeUndefined();
  });
});

describe('listStencilMaterials', () => {
  it('flags unresolvable clip while keeping the extra', () => {
    const json: GltfJson = {
      materials: [
        mtoonMat('Face', { specVersion: '1.0', stencil: { op: 'write' } }),
        mtoonMat('Hair', { specVersion: '1.0', stencil: { op: 'outside', materials: [1] } }),
      ],
    };
    const rows = listStencilMaterials(json);
    expect(rows[0].bodyUnresolvable).toBe(false);
    expect(rows[1].bodyUnresolvable).toBe(true);
    expect(rows[1].body).toEqual({ op: 'outside', materials: [1] });
  });
});
