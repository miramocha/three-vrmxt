export { VRMXTLoaderPlugin, tryAttach, applyMtoonxtStencil } from './VRMXTLoaderPlugin.js';
export type { MtoonxtAttachResult } from './tryAttach.js';
export { resetMtoonxtStencil } from './mtoonxt/resetMtoonxtStencil.js';
export {
  assignStencilRefs,
  type StencilExtra,
  type StencilOpName,
} from './mtoonxt/stencilRefs.js';
export {
  EXT_MTOONXT,
  cloneJson,
  ensureMtoonxtUsed,
  listStencilMaterials,
  sanitizeMtoonxtStencils,
  setMaterialStencilExtras,
  type GltfJson,
  type StencilMaterialRow,
} from './mtoonxt/editStencil.js';
export { buildGlb, isGlb, parseGlb, type GlbParts } from './gltf/glbCodec.js';
