import { describe, expect, it } from 'vitest';
import { appendImageToGlbBin, sniffImageMime } from '../src/gltf/packImage.js';

const pngMagic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const jpegMagic = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

describe('packImage', () => {
  it('sniffs png and jpeg', () => {
    expect(sniffImageMime(pngMagic)).toBe('image/png');
    expect(sniffImageMime(jpegMagic)).toBe('image/jpeg');
    expect(sniffImageMime(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('appends into buffer 0 with 4-byte aligned offset', () => {
    const json = {
      buffers: [{ byteLength: 3 }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 3 }],
    };
    const bin = new Uint8Array([1, 2, 3]);
    const image = new Uint8Array([9, 8, 7, 6, 5]);
    const result = appendImageToGlbBin(json, bin, image, 'image/png', 'spark');
    expect(result.textureIndex).toBe(0);
    expect(result.bin.byteLength).toBe(4 + 5);
    expect([...result.bin.subarray(0, 3)]).toEqual([1, 2, 3]);
    expect([...result.bin.subarray(4)]).toEqual([9, 8, 7, 6, 5]);
    expect(json.buffers?.[0]?.byteLength).toBe(9);
    expect(json.bufferViews?.[1]).toEqual({ buffer: 0, byteOffset: 4, byteLength: 5 });
    expect(json.images?.[0]).toMatchObject({ mimeType: 'image/png', bufferView: 1, name: 'spark' });
    expect(json.textures?.[0]).toMatchObject({ source: 0, sampler: 0, name: 'spark' });
  });
});
