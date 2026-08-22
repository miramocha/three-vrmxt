import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMXTLoaderPlugin, type MtoonxtAttachResult } from '@vrmxt/three-vrmxt';

export type ViewerStatus = {
  name: string;
  mtoonxtApplied: number;
  mtoonxtSkipped: number;
};

export type VrmxtViewer = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  loadBytes: (bytes: ArrayBuffer, name: string) => Promise<ViewerStatus>;
  dispose: () => void;
};

type VrmInstance = {
  scene: THREE.Group;
  update: (delta: number) => void;
};

export function createVrmxtViewer(canvas: HTMLCanvasElement): VrmxtViewer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    stencil: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1e);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 1.3, 2.4);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.0, 0);
  controls.update();

  const light = new THREE.DirectionalLight(0xffffff, 1.1);
  light.position.set(1, 2, 3);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  const clock = new THREE.Clock();
  let current: THREE.Object3D | null = null;
  let vrmUpdate: ((delta: number) => void) | null = null;

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  loader.register((parser) => new VRMXTLoaderPlugin(parser));

  function resize(): void {
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  window.addEventListener('resize', resize);
  resize();

  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    vrmUpdate?.(delta);
    controls.update();
    renderer.render(scene, camera);
  });

  async function loadBytes(bytes: ArrayBuffer, name: string): Promise<ViewerStatus> {
    if (current) {
      scene.remove(current);
      VRMUtils.deepDispose(current);
      current = null;
      vrmUpdate = null;
    }

    const gltf = await loader.parseAsync(bytes, '');
    const vrm = gltf.userData.vrm as VrmInstance | undefined;
    const root = vrm?.scene ?? gltf.scene;
    if (vrm) {
      VRMUtils.rotateVRM0(vrm as never);
      vrmUpdate = (d) => vrm.update(d);
    }
    scene.add(root);
    current = root;

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3()).length() || 1;
    const center = box.getCenter(new THREE.Vector3());
    controls.target.copy(center);
    camera.position.set(center.x, center.y + size * 0.15, center.z + size * 1.1);
    controls.update();

    const xt = gltf.userData.vrmxt as MtoonxtAttachResult | undefined;
    return {
      name,
      mtoonxtApplied: xt?.mtoonxtApplied ?? 0,
      mtoonxtSkipped: xt?.mtoonxtSkipped ?? 0,
    };
  }

  function dispose(): void {
    renderer.setAnimationLoop(null);
    window.removeEventListener('resize', resize);
    controls.dispose();
    renderer.dispose();
  }

  return { renderer, scene, camera, loadBytes, dispose };
}
