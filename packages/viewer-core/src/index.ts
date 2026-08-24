import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { tryAttach, type MtoonxtAttachResult } from '@vrmxt/three-vrmxt';

export type ViewerStatus = {
  name: string;
  vrmxtEnabled: boolean;
  mtoonxtApplied: number;
  mtoonxtSkipped: number;
};

export type ViewerLights = {
  directionalEnabled: boolean;
  directionalColor: string;
  directionalIntensity: number;
  directionalAzimuth: number;
  directionalElevation: number;
  ambientColor: string;
  ambientIntensity: number;
};

export type ViewerShadows = {
  enabled: boolean;
  modelCast: boolean;
  modelReceive: boolean;
  ground: boolean;
  intensity: number;
  bias: number;
  normalBias: number;
  mapSize: 512 | 1024 | 2048;
};

export type VrmxtViewer = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  loadBytes: (bytes: ArrayBuffer, name: string) => Promise<ViewerStatus>;
  getVrmxtEnabled: () => boolean;
  setVrmxtEnabled: (enabled: boolean) => Promise<ViewerStatus | null>;
  getLights: () => ViewerLights;
  setLights: (next: Partial<ViewerLights>) => ViewerLights;
  matchLightToCamera: () => ViewerLights;
  getShadows: () => ViewerShadows;
  setShadows: (next: Partial<ViewerShadows>) => ViewerShadows;
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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1e);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 1.3, 2.4);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.0, 0);
  controls.update();

  const directional = new THREE.DirectionalLight(0xffffff, 1.1);
  directional.position.set(1.6, 2.8, 2.2);
  directional.castShadow = true;
  directional.shadow.intensity = 0.85;
  directional.shadow.bias = -0.0002;
  directional.shadow.normalBias = 0.02;
  directional.shadow.mapSize.set(1024, 1024);
  directional.shadow.camera.near = 0.2;
  directional.shadow.camera.far = 24;
  scene.add(directional);
  scene.add(directional.target);

  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambient);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.ShadowMaterial({ opacity: 0.35, color: 0x000000 }),
  );
  ground.name = 'ShadowGround';
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.position.y = 0;
  scene.add(ground);

  let shadowOpts: ViewerShadows = {
    enabled: true,
    modelCast: true,
    modelReceive: true,
    ground: true,
    intensity: 0.85,
    bias: -0.0002,
    normalBias: 0.02,
    mapSize: 1024,
  };

  let lightAim = { azimuth: 41, elevation: 46 };
  let directionalEnabled = true;

  function colorHex(color: THREE.Color): string {
    return `#${color.getHexString()}`;
  }

  const clock = new THREE.Clock();
  let current: THREE.Object3D | null = null;
  let vrmUpdate: ((delta: number) => void) | null = null;
  let vrmxtEnabled = true;
  let lastSource: { bytes: ArrayBuffer; name: string } | null = null;
  let loadGen = 0;

  function getLights(): ViewerLights {
    return {
      directionalEnabled,
      directionalColor: colorHex(directional.color),
      directionalIntensity: directional.intensity,
      directionalAzimuth: lightAim.azimuth,
      directionalElevation: lightAim.elevation,
      ambientColor: colorHex(ambient.color),
      ambientIntensity: ambient.intensity,
    };
  }

  function setLights(next: Partial<ViewerLights>): ViewerLights {
    if (next.directionalEnabled !== undefined) {
      directionalEnabled = next.directionalEnabled;
    }
    if (next.directionalColor !== undefined) {
      directional.color.set(next.directionalColor);
    }
    if (next.directionalIntensity !== undefined) {
      directional.intensity = next.directionalIntensity;
    }
    if (next.directionalAzimuth !== undefined) {
      lightAim.azimuth = next.directionalAzimuth;
    }
    if (next.directionalElevation !== undefined) {
      lightAim.elevation = next.directionalElevation;
    }
    if (next.ambientColor !== undefined) {
      ambient.color.set(next.ambientColor);
    }
    if (next.ambientIntensity !== undefined) {
      ambient.intensity = next.ambientIntensity;
    }
    directional.visible = directionalEnabled;
    if (next.directionalEnabled !== undefined) {
      applyShadowState();
    }
    if (next.directionalAzimuth !== undefined || next.directionalElevation !== undefined) {
      fitShadowCamera(current);
    }
    return getLights();
  }

  function matchLightToCamera(): ViewerLights {
    const offset = camera.position.clone().sub(controls.target);
    const len = offset.length();
    if (len < 1e-6) {
      return getLights();
    }
    let azimuth = (Math.atan2(offset.x, offset.z) * 180) / Math.PI;
    if (azimuth < 0) {
      azimuth += 360;
    }
    const elevation = THREE.MathUtils.clamp((Math.asin(offset.y / len) * 180) / Math.PI, 5, 85);
    return setLights({
      directionalAzimuth: azimuth,
      directionalElevation: elevation,
    });
  }

  function applyModelShadowFlags(root: THREE.Object3D | null): void {
    if (!root) {
      return;
    }
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      mesh.castShadow = shadowOpts.modelCast;
      mesh.receiveShadow = shadowOpts.modelReceive;
    });
  }

  function fitShadowCamera(root: THREE.Object3D | null): void {
    const box = root
      ? new THREE.Box3().setFromObject(root)
      : new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1.6, 0.5));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 0.4) * 0.7;
    const az = (lightAim.azimuth * Math.PI) / 180;
    const el = (lightAim.elevation * Math.PI) / 180;
    const dist = radius * 3;
    directional.target.position.copy(center);
    directional.position.set(
      center.x + Math.sin(az) * Math.cos(el) * dist,
      center.y + Math.sin(el) * dist,
      center.z + Math.cos(az) * Math.cos(el) * dist,
    );
    const cam = directional.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = 0.2;
    cam.far = radius * 8;
    cam.updateProjectionMatrix();
    if (Number.isFinite(box.min.y)) {
      ground.position.y = box.min.y;
    }
  }

  function applyShadowState(): void {
    renderer.shadowMap.enabled = shadowOpts.enabled;
    directional.castShadow = shadowOpts.enabled && directionalEnabled;
    directional.shadow.intensity = shadowOpts.intensity;
    directional.shadow.bias = shadowOpts.bias;
    directional.shadow.normalBias = shadowOpts.normalBias;
    const map = shadowOpts.mapSize;
    if (directional.shadow.mapSize.x !== map) {
      directional.shadow.mapSize.set(map, map);
      directional.shadow.map?.dispose();
      directional.shadow.map = null;
    }
    ground.visible = shadowOpts.enabled && shadowOpts.ground;
    ground.receiveShadow = shadowOpts.ground;
    applyModelShadowFlags(current);
  }

  function getShadows(): ViewerShadows {
    return { ...shadowOpts };
  }

  function setShadows(next: Partial<ViewerShadows>): ViewerShadows {
    shadowOpts = { ...shadowOpts, ...next };
    applyShadowState();
    return getShadows();
  }

  applyShadowState();
  fitShadowCamera(null);

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

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

  async function parseAndShow(
    bytes: ArrayBuffer,
    name: string,
    frameCamera: boolean,
  ): Promise<ViewerStatus> {
    const gen = ++loadGen;
    if (current) {
      scene.remove(current);
      VRMUtils.deepDispose(current);
      current = null;
      vrmUpdate = null;
    }

    const gltf = await loader.parseAsync(bytes, '');
    if (gen !== loadGen) {
      VRMUtils.deepDispose(gltf.scene);
      throw new Error('Load superseded');
    }
    if (vrmxtEnabled) {
      await tryAttach(gltf);
    }
    if (gen !== loadGen) {
      VRMUtils.deepDispose(gltf.scene);
      throw new Error('Load superseded');
    }

    const vrm = gltf.userData.vrm as VrmInstance | undefined;
    const root = vrm?.scene ?? gltf.scene;
    if (vrm) {
      VRMUtils.rotateVRM0(vrm as never);
      vrmUpdate = (d) => vrm.update(d);
    }
    scene.add(root);
    current = root;
    applyModelShadowFlags(root);

    if (frameCamera) {
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3()).length() || 1;
      const center = box.getCenter(new THREE.Vector3());
      controls.target.copy(center);
      camera.position.set(center.x, center.y + size * 0.15, center.z + size * 1.1);
      controls.update();
    }
    fitShadowCamera(root);

    const xt = gltf.userData.vrmxt as MtoonxtAttachResult | undefined;
    return {
      name,
      vrmxtEnabled,
      mtoonxtApplied: xt?.mtoonxtApplied ?? 0,
      mtoonxtSkipped: xt?.mtoonxtSkipped ?? 0,
    };
  }

  async function loadBytes(bytes: ArrayBuffer, name: string): Promise<ViewerStatus> {
    lastSource = { bytes: bytes.slice(0), name };
    return parseAndShow(lastSource.bytes, name, true);
  }

  function getVrmxtEnabled(): boolean {
    return vrmxtEnabled;
  }

  async function setVrmxtEnabled(enabled: boolean): Promise<ViewerStatus | null> {
    if (vrmxtEnabled === enabled) {
      return null;
    }
    vrmxtEnabled = enabled;
    if (!lastSource) {
      return null;
    }
    return parseAndShow(lastSource.bytes, lastSource.name, false);
  }

  function dispose(): void {
    renderer.setAnimationLoop(null);
    window.removeEventListener('resize', resize);
    controls.dispose();
    renderer.dispose();
  }

  return {
    renderer,
    scene,
    camera,
    loadBytes,
    getVrmxtEnabled,
    setVrmxtEnabled,
    getLights,
    setLights,
    matchLightToCamera,
    getShadows,
    setShadows,
    dispose,
  };
}
