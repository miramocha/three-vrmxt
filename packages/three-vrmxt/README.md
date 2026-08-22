# `@vrmxt/three-vrmxt`

Optional Extended VRM attach for apps that already use `@pixiv/three-vrm`.

This package is **not** a pixiv/three-vrm fork and does not add hooks inside
`VRMLoaderPlugin`. Register a second `GLTFLoader` plugin (Three.js loader API).

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMXTLoaderPlugin } from '@vrmxt/three-vrmxt';

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));
loader.register((parser) => new VRMXTLoaderPlugin(parser));
```

After load you can also call `tryAttach(gltf)` if the plugin was omitted.

Construct `WebGLRenderer` with `stencil: true` for `VRMC_materials_mtoonxt` coverage
clip. Setting `renderer.stencil` after construct does not allocate the buffer
(Three.js r163+).

v1 applies body/outline stencil extras. Face SDF and `VRMXT_sprite_particle` are
planned. Export/write is planned and not implemented.

Peers: `three`, `@pixiv/three-vrm`.
