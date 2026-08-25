import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const DEPTH_SNAP = 'vrmxtDepthSnap';
const STENCIL_MARK = 'vrmxtStencilApplied';
const ORDER_SNAP = 'vrmxtRenderOrderSnap';

type DepthSnap = { depthFunc: THREE.DepthModes; depthWrite: boolean };

function asMesh(obj: THREE.Object3D): THREE.Mesh | null {
  const mesh = obj as THREE.Mesh;
  return mesh.isMesh ? mesh : null;
}

function slotList(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

export function snapshotStencilMaterial(material: THREE.Material): void {
  const data = material.userData as Record<string, unknown>;
  if (!data[DEPTH_SNAP]) {
    data[DEPTH_SNAP] = {
      depthFunc: material.depthFunc,
      depthWrite: material.depthWrite,
    } satisfies DepthSnap;
  }
  data[STENCIL_MARK] = true;
}

export function snapshotMeshRenderOrder(mesh: THREE.Mesh): void {
  const data = mesh.userData as Record<string, unknown>;
  if (data[ORDER_SNAP] === undefined) {
    data[ORDER_SNAP] = mesh.renderOrder;
  }
}

function clearStencilFlags(material: THREE.Material): void {
  const data = material.userData as Record<string, unknown>;
  if (!data[STENCIL_MARK]) {
    return;
  }
  const snap = data[DEPTH_SNAP] as DepthSnap | undefined;
  if (snap) {
    material.depthFunc = snap.depthFunc;
    material.depthWrite = snap.depthWrite;
  }
  material.stencilWrite = false;
  material.stencilFunc = THREE.AlwaysStencilFunc;
  material.stencilRef = 0;
  material.stencilFuncMask = 0xff;
  material.stencilWriteMask = 0xff;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.KeepStencilOp;
  material.stencilZPass = THREE.KeepStencilOp;
  material.needsUpdate = true;
  delete data[DEPTH_SNAP];
  delete data[STENCIL_MARK];
}

function restoreMeshOrder(mesh: THREE.Mesh): void {
  const data = mesh.userData as Record<string, unknown>;
  if (data[ORDER_SNAP] === undefined) {
    return;
  }
  mesh.renderOrder = data[ORDER_SNAP] as number;
  delete data[ORDER_SNAP];
}

export function resetMtoonxtStencil(gltf: GLTF): void {
  gltf.scene.traverse((obj) => {
    const mesh = asMesh(obj);
    if (!mesh) {
      return;
    }
    restoreMeshOrder(mesh);
    for (const slot of slotList(mesh)) {
      clearStencilFlags(slot);
    }
  });
  const mtoon = gltf.userData.vrmMToonMaterials as THREE.Material[] | undefined;
  if (mtoon) {
    for (const slot of mtoon) {
      clearStencilFlags(slot);
    }
  }
}
