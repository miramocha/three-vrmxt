import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLOR,
  DEFAULT_EMISSION_RATE,
  DEFAULT_LIFETIME,
  DEFAULT_MAX_PARTICLES,
  DEFAULT_SIZE,
  DEFAULT_START_SPEED,
  parseSpriteParticle,
} from '../src/vfx/parseSpriteParticle.js';

const used = ['VRMC_vrm', 'VRMXT_sprite_particle'];

function root(emitters: unknown[], extra?: Record<string, unknown>) {
  return {
    extensionsUsed: used,
    nodes: [{}, {}],
    textures: [{}],
    extensions: {
      VRMXT_sprite_particle: {
        specVersion: '1.0',
        emitters,
        ...extra,
      },
    },
  };
}

describe('parseSpriteParticle', () => {
  it('applies defaults and keeps a valid emitter', () => {
    const parsed = parseSpriteParticle(root([{ node: 0, name: 'HandSpark' }]), {
      nodeCount: 2,
      textureCount: 1,
    });
    expect(parsed).toEqual({
      specVersion: '1.0',
      emitters: [
        {
          node: 0,
          name: 'HandSpark',
          size: DEFAULT_SIZE,
          color: DEFAULT_COLOR,
          emissionRate: DEFAULT_EMISSION_RATE,
          maxParticles: DEFAULT_MAX_PARTICLES,
          lifetime: DEFAULT_LIFETIME,
          startSpeed: DEFAULT_START_SPEED,
        },
      ],
    });
  });

  it('skips invalid emitters and keeps valid ones', () => {
    const parsed = parseSpriteParticle(
      root([
        { node: 99, emissionRate: 1 },
        { node: 0, emissionRate: -1 },
        { node: 1, emissionRate: 5, texture: 0, size: [0.04, 0.04] },
      ]),
      { nodeCount: 2, textureCount: 1 },
    );
    expect(parsed?.emitters).toHaveLength(1);
    expect(parsed?.emitters[0]).toMatchObject({ node: 1, emissionRate: 5, texture: 0 });
  });

  it('rejects unknown specVersion', () => {
    const json = root([]);
    (json.extensions.VRMXT_sprite_particle as { specVersion: string }).specVersion = '0.9';
    expect(parseSpriteParticle(json)).toBeNull();
  });

  it('rejects bad size / color / maxParticles', () => {
    expect(parseSpriteParticle(root([{ node: 0, size: [0, 0.1] }]))?.emitters).toEqual([]);
    expect(parseSpriteParticle(root([{ node: 0, color: [1, 1, 1, 2] }]))?.emitters).toEqual([]);
    expect(parseSpriteParticle(root([{ node: 0, maxParticles: 0 }]))?.emitters).toEqual([]);
  });

  it('returns empty emitters for an empty list', () => {
    expect(parseSpriteParticle(root([]))).toEqual({ specVersion: '1.0', emitters: [] });
  });
});
