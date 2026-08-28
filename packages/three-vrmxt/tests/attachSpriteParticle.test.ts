import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { attachSpriteParticle } from '../src/vfx/attachSpriteParticle.js';

function particleGltf(json: unknown, nodes: THREE.Object3D[], scene: THREE.Group): GLTF {
  return {
    scene,
    parser: {
      json,
      getDependencies: async (type: string) => (type === 'node' ? nodes : []),
      getDependency: async () => null,
    },
    userData: {},
  } as unknown as GLTF;
}

describe('attachSpriteParticle', () => {
  it('no-ops without VRMXT_sprite_particle', async () => {
    const scene = new THREE.Group();
    const gltf = particleGltf({ extensionsUsed: ['VRMC_vrm'] }, [], scene);
    const result = await attachSpriteParticle(gltf);
    expect(result.spriteParticleApplied).toBe(0);
    expect(result.spriteParticles).toBeNull();
    expect(scene.children).toHaveLength(0);
  });

  it('attaches an instanced mesh under the glTF scene', async () => {
    const scene = new THREE.Group();
    const node = new THREE.Object3D();
    scene.add(node);
    const gltf = particleGltf(
      {
        extensionsUsed: ['VRMC_vrm', 'VRMXT_sprite_particle'],
        nodes: [{}],
        extensions: {
          VRMXT_sprite_particle: {
            specVersion: '1.0',
            emitters: [{ node: 0, name: 'HandSpark', maxParticles: 4 }],
          },
        },
      },
      [node],
      scene,
    );
    const result = await attachSpriteParticle(gltf);
    expect(result.spriteParticleApplied).toBe(1);
    expect(result.spriteParticleSkipped).toBe(0);
    expect(result.spriteParticles?.emitters).toHaveLength(1);
    const mesh = result.spriteParticles!.emitters[0]!.mesh;
    expect(mesh.isInstancedMesh).toBe(true);
    expect(mesh.parent).toBe(scene);

    const camera = new THREE.PerspectiveCamera();
    result.spriteParticles?.update(0.2, camera);
    result.spriteParticles?.dispose();
    expect(mesh.parent).toBeNull();
  });

  it('writes instance positions in parent local space', async () => {
    const scene = new THREE.Group();
    scene.position.set(4, 0, 0);
    const node = new THREE.Object3D();
    node.position.set(0, 1, 0);
    scene.add(node);
    scene.updateWorldMatrix(true, true);
    const gltf = particleGltf(
      {
        extensionsUsed: ['VRMC_vrm', 'VRMXT_sprite_particle'],
        nodes: [{}],
        extensions: {
          VRMXT_sprite_particle: {
            specVersion: '1.0',
            emitters: [{ node: 0, maxParticles: 4, emissionRate: 20, lifetime: 1, startSpeed: 0 }],
          },
        },
      },
      [node],
      scene,
    );
    const result = await attachSpriteParticle(gltf);
    const mesh = result.spriteParticles!.emitters[0]!.mesh;
    result.spriteParticles?.update(0.2, new THREE.PerspectiveCamera());
    const local = new THREE.Matrix4();
    mesh.getMatrixAt(0, local);
    const pos = new THREE.Vector3().setFromMatrixPosition(local);
    expect(pos.x).toBeCloseTo(0, 4);
    expect(pos.y).toBeCloseTo(1, 4);
    result.spriteParticles?.dispose();
  });

  it('skips a bad node and keeps a valid emitter', async () => {
    const scene = new THREE.Group();
    const node = new THREE.Object3D();
    scene.add(node);
    const gltf = particleGltf(
      {
        extensionsUsed: ['VRMC_vrm', 'VRMXT_sprite_particle'],
        nodes: [{}, {}],
        extensions: {
          VRMXT_sprite_particle: {
            specVersion: '1.0',
            emitters: [{ node: 1 }, { node: 0 }],
          },
        },
      },
      [node],
      scene,
    );
    const result = await attachSpriteParticle(gltf);
    expect(result.spriteParticleApplied).toBe(1);
    expect(result.spriteParticleSkipped).toBe(1);
  });
});
