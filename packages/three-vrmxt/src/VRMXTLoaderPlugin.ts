import type { GLTF, GLTFLoaderPlugin, GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { tryAttach } from './tryAttach.js';

/**
 * Peer plugin next to `@pixiv/three-vrm` `VRMLoaderPlugin`.
 * Does not patch or subclass the pixiv plugin.
 */
export class VRMXTLoaderPlugin implements GLTFLoaderPlugin {
  public readonly name = 'VRMXTLoaderPlugin';
  public readonly parser: GLTFParser;

  public constructor(parser: GLTFParser) {
    this.parser = parser;
  }

  public async afterRoot(gltf: GLTF): Promise<void> {
    await tryAttach(gltf);
  }
}

export { tryAttach };
export { applyMtoonxtStencil } from './mtoonxt/applyMtoonxtStencil.js';
export type { MtoonxtAttachResult, VrmxtAttachResult } from './tryAttach.js';
