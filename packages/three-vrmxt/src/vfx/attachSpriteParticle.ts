import type { Object3D, Texture } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  EXT_SPRITE_PARTICLE,
  parseSpriteParticle,
  spriteParticleRawCount,
} from './parseSpriteParticle.js';
import {
  SpriteParticleEmitterRuntime,
  VrmxtSpriteParticleManager,
} from './spriteParticleRuntime.js';

export type SpriteParticleAttachResult = {
  spriteParticleApplied: number;
  spriteParticleSkipped: number;
  spriteParticles: VrmxtSpriteParticleManager | null;
};

type GltfJson = {
  extensionsUsed?: string[];
  nodes?: unknown[];
  textures?: unknown[];
  extensions?: Record<string, unknown>;
};

function emptyResult(manager: VrmxtSpriteParticleManager | null = null): SpriteParticleAttachResult {
  return {
    spriteParticleApplied: 0,
    spriteParticleSkipped: 0,
    spriteParticles: manager,
  };
}

export function disposeSpriteParticles(gltf: GLTF): void {
  const prev = gltf.userData.vrmxt as { spriteParticles?: VrmxtSpriteParticleManager | null } | undefined;
  prev?.spriteParticles?.dispose();
  if (prev && typeof prev === 'object') {
    prev.spriteParticles = null;
  }
}

async function resolveTexture(
  gltf: GLTF,
  index: number | undefined,
): Promise<Texture | null> {
  if (index === undefined) {
    return null;
  }
  try {
    const texture = (await gltf.parser.getDependency('texture', index)) as Texture | undefined;
    return texture ?? null;
  } catch {
    return null;
  }
}

/**
 * Attach `VRMXT_sprite_particle` drawables. VRM 1.0 only. Missing extra: no-op.
 */
export async function attachSpriteParticle(gltf: GLTF): Promise<SpriteParticleAttachResult> {
  disposeSpriteParticles(gltf);

  const json = gltf.parser.json as GltfJson;
  const used = json.extensionsUsed ?? [];
  if (!used.includes(EXT_SPRITE_PARTICLE) || !used.includes('VRMC_vrm')) {
    return emptyResult();
  }

  const parsed = parseSpriteParticle(json, {
    nodeCount: json.nodes?.length,
    textureCount: json.textures?.length,
  });
  const rawCount = spriteParticleRawCount(json);
  if (!parsed) {
    return emptyResult();
  }

  const nodes = (await gltf.parser.getDependencies('node')) as Object3D[];
  const manager = new VrmxtSpriteParticleManager();
  let applied = 0;
  let skipped = rawCount - parsed.emitters.length;
  const parent = gltf.scene;

  for (let i = 0; i < parsed.emitters.length; i++) {
    const emitter = parsed.emitters[i]!;
    const node = nodes[emitter.node];
    if (!node || node.isObject3D !== true) {
      skipped += 1;
      continue;
    }
    const texture = await resolveTexture(gltf, emitter.texture);
    manager.emitters.push(
      new SpriteParticleEmitterRuntime(emitter, node, parent, texture, i),
    );
    applied += 1;
  }

  if (manager.emitters.length === 0) {
    manager.dispose();
    const empty = {
      spriteParticleApplied: 0,
      spriteParticleSkipped: skipped,
      spriteParticles: null,
    };
    stashParticles(gltf, empty);
    return empty;
  }

  const attached = {
    spriteParticleApplied: applied,
    spriteParticleSkipped: skipped,
    spriteParticles: manager,
  };
  stashParticles(gltf, attached);
  return attached;
}

function stashParticles(gltf: GLTF, result: SpriteParticleAttachResult): void {
  gltf.userData.vrmxt = {
    ...(typeof gltf.userData.vrmxt === 'object' && gltf.userData.vrmxt !== null
      ? gltf.userData.vrmxt
      : {}),
    ...result,
  };
}
