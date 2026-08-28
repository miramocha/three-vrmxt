const MIME_PNG = 'image/png';
const MIME_JPEG = 'image/jpeg';

export type GlbJsonForPack = {
  buffers?: { byteLength: number; uri?: string }[];
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number }[];
  images?: Record<string, unknown>[];
  textures?: Record<string, unknown>[];
  samplers?: Record<string, unknown>[];
};

function pad4(n: number): number {
  return (4 - (n % 4)) % 4;
}

export function sniffImageMime(bytes: Uint8Array): typeof MIME_PNG | typeof MIME_JPEG | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return MIME_PNG;
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return MIME_JPEG;
  }
  return null;
}

/**
 * Append a PNG/JPEG into GLB buffer 0 and add image + texture defs.
 * Returns the new `textures[]` index.
 */
export function appendImageToGlbBin(
  json: GlbJsonForPack,
  bin: Uint8Array | null,
  imageBytes: Uint8Array,
  mimeType: string,
  name?: string,
): { bin: Uint8Array; textureIndex: number } {
  if (mimeType !== MIME_PNG && mimeType !== MIME_JPEG) {
    throw new Error(`Unsupported image type: ${mimeType}`);
  }
  const base = bin ?? new Uint8Array(0);
  const pad = pad4(base.byteLength);
  const offset = base.byteLength + pad;
  const next = new Uint8Array(offset + imageBytes.byteLength);
  next.set(base, 0);
  next.set(imageBytes, offset);

  if (!json.buffers || json.buffers.length === 0) {
    json.buffers = [{ byteLength: next.byteLength }];
  } else {
    const buf0 = { ...json.buffers[0]!, byteLength: next.byteLength };
    delete buf0.uri;
    json.buffers[0] = buf0;
  }

  const views = json.bufferViews ?? [];
  json.bufferViews = views;
  const viewIndex = views.length;
  views.push({ buffer: 0, byteOffset: offset, byteLength: imageBytes.byteLength });

  const images = json.images ?? [];
  json.images = images;
  const imageIndex = images.length;
  const image: Record<string, unknown> = {
    mimeType,
    bufferView: viewIndex,
  };
  if (name) {
    image.name = name;
  }
  images.push(image);

  const samplers = json.samplers ?? [];
  json.samplers = samplers;
  if (samplers.length === 0) {
    samplers.push({
      magFilter: 9729,
      minFilter: 9729,
      wrapS: 33071,
      wrapT: 33071,
    });
  }

  const textures = json.textures ?? [];
  json.textures = textures;
  const textureIndex = textures.length;
  const texture: Record<string, unknown> = {
    source: imageIndex,
    sampler: 0,
  };
  if (name) {
    texture.name = name;
  }
  textures.push(texture);
  return { bin: next, textureIndex };
}
