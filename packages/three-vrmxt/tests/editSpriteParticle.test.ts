import { describe, expect, it } from 'vitest';
import { EXT_SPRITE_PARTICLE } from '../src/vfx/parseSpriteParticle.js';
import {
  EDIT_EMISSION_RATE,
  EDIT_LIFETIME,
  addSpriteParticleEmitter,
  listSpriteParticleEmitters,
  removeSpriteParticleEmitter,
  sanitizeSpriteParticles,
  setSpriteParticleEmitter,
  type ParticleGltfJson,
} from '../src/vfx/editSpriteParticle.js';

function jsonWithEmitter(): ParticleGltfJson {
  return {
    extensionsUsed: ['VRMC_vrm', EXT_SPRITE_PARTICLE],
    nodes: [{ name: 'hips' }, { name: 'head' }],
    textures: [{}],
    extensions: {
      VRMXT_sprite_particle: {
        specVersion: '1.0',
        emitters: [{ node: 0, name: 'BodySpark', emissionRate: 16, lifetime: 1 }],
      },
    },
  };
}

describe('editSpriteParticle', () => {
  it('lists parsed emitters with defaults filled', () => {
    const rows = listSpriteParticleEmitters(jsonWithEmitter());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      index: 0,
      node: 0,
      name: 'BodySpark',
      emissionRate: 16,
      lifetime: 1,
    });
  });

  it('patches lifetime and rate, never writes extensionsRequired', () => {
    const json = jsonWithEmitter();
    expect(setSpriteParticleEmitter(json, 0, { lifetime: 3, emissionRate: 4 })).toBe(true);
    const row = listSpriteParticleEmitters(json)[0];
    expect(row?.lifetime).toBe(3);
    expect(row?.emissionRate).toBe(4);
    expect(json.extensionsRequired).toBeUndefined();
  });

  it('rejects invalid rate', () => {
    const json = jsonWithEmitter();
    expect(setSpriteParticleEmitter(json, 0, { emissionRate: -1 })).toBe(false);
    expect(listSpriteParticleEmitters(json)[0]?.emissionRate).toBe(16);
  });

  it('adds with authoring rate/lifetime and removes', () => {
    const json: ParticleGltfJson = { nodes: [{ name: 'root' }] };
    const index = addSpriteParticleEmitter(json, 0);
    expect(index).toBe(0);
    expect(json.extensionsUsed).toEqual([EXT_SPRITE_PARTICLE]);
    const row = listSpriteParticleEmitters(json)[0];
    expect(row).toMatchObject({
      emissionRate: EDIT_EMISSION_RATE,
      lifetime: EDIT_LIFETIME,
      node: 0,
    });
    expect(removeSpriteParticleEmitter(json, 0)).toBe(true);
    expect(listSpriteParticleEmitters(json)).toEqual([]);
  });

  it('sanitize drops a bad emitter', () => {
    const json = jsonWithEmitter();
    const ext = json.extensions!.VRMXT_sprite_particle as { emitters: unknown[] };
    ext.emitters.push({ node: 99 });
    sanitizeSpriteParticles(json);
    expect(listSpriteParticleEmitters(json)).toHaveLength(1);
  });
});
