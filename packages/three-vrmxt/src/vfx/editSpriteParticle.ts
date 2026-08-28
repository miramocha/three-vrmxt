import {
  DEFAULT_COLOR,
  DEFAULT_MAX_PARTICLES,
  DEFAULT_SIZE,
  DEFAULT_START_SPEED,
  EXT_SPRITE_PARTICLE,
  SPRITE_PARTICLE_SPEC_VERSION,
  parseSpriteParticle,
  type SpriteParticleEmitter,
} from './parseSpriteParticle.js';

/** Authoring defaults for a new viewer emitter (not omitted-field spec defaults). */
export const EDIT_EMISSION_RATE = 2;
export const EDIT_LIFETIME = 6;

export type ParticleGltfJson = {
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  nodes?: unknown[];
  textures?: unknown[];
  images?: unknown[];
  extensions?: Record<string, unknown>;
};

export type SpriteParticleRow = SpriteParticleEmitter & { index: number };

export type GltfNodeOption = { index: number; name: string };

export type SpriteParticlePatch = Partial<{
  name: string;
  node: number;
  texture: number | null;
  size: [number, number];
  color: [number, number, number, number];
  emissionRate: number;
  maxParticles: number;
  lifetime: number;
  startSpeed: number;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nodeName(def: unknown, index: number): string {
  if (isRecord(def) && typeof def.name === 'string' && def.name.length > 0) {
    return def.name;
  }
  return `Node ${index}`;
}

export function listGltfNodes(json: ParticleGltfJson): GltfNodeOption[] {
  return (json.nodes ?? []).map((def, index) => ({ index, name: nodeName(def, index) }));
}

export type GltfTextureOption = { index: number; name: string };

export function listGltfTextures(json: ParticleGltfJson): GltfTextureOption[] {
  const textures = json.textures ?? [];
  const images = json.images ?? [];
  return textures.map((tex, index) => {
    const rec = isRecord(tex) ? tex : null;
    const source = typeof rec?.source === 'number' ? rec.source : undefined;
    const img = source !== undefined ? images[source] : undefined;
    const texName = rec && typeof rec.name === 'string' && rec.name.length > 0 ? rec.name : '';
    const imgName = isRecord(img) && typeof img.name === 'string' && img.name.length > 0 ? img.name : '';
    return { index, name: texName || imgName || `Texture ${index}` };
  });
}

function rootExt(json: ParticleGltfJson): Record<string, unknown> | null {
  if (!isRecord(json.extensions)) {
    return null;
  }
  const ext = json.extensions[EXT_SPRITE_PARTICLE];
  return isRecord(ext) ? ext : null;
}

function ensureRootExt(json: ParticleGltfJson): Record<string, unknown> {
  const extensions = isRecord(json.extensions) ? json.extensions : {};
  json.extensions = extensions;
  const existing = extensions[EXT_SPRITE_PARTICLE];
  if (isRecord(existing)) {
    return existing;
  }
  const created: Record<string, unknown> = {
    specVersion: SPRITE_PARTICLE_SPEC_VERSION,
    emitters: [],
  };
  extensions[EXT_SPRITE_PARTICLE] = created;
  return created;
}

function serializeEmitter(emitter: SpriteParticleEmitter): Record<string, unknown> {
  const out: Record<string, unknown> = {
    node: emitter.node,
    size: [emitter.size[0], emitter.size[1]],
    color: [emitter.color[0], emitter.color[1], emitter.color[2], emitter.color[3]],
    emissionRate: emitter.emissionRate,
    maxParticles: emitter.maxParticles,
    lifetime: emitter.lifetime,
    startSpeed: emitter.startSpeed,
  };
  if (emitter.name !== undefined && emitter.name.length > 0) {
    out.name = emitter.name;
  }
  if (emitter.texture !== undefined) {
    out.texture = emitter.texture;
  }
  return out;
}

function parseOne(
  raw: unknown,
  json: ParticleGltfJson,
): SpriteParticleEmitter | null {
  const parsed = parseSpriteParticle(
    {
      specVersion: SPRITE_PARTICLE_SPEC_VERSION,
      emitters: [raw],
    },
    { nodeCount: json.nodes?.length, textureCount: json.textures?.length },
  );
  return parsed?.emitters[0] ?? null;
}

export function listSpriteParticleEmitters(json: ParticleGltfJson): SpriteParticleRow[] {
  const ext = rootExt(json);
  if (!ext || !Array.isArray(ext.emitters)) {
    return [];
  }
  const rows: SpriteParticleRow[] = [];
  ext.emitters.forEach((raw, index) => {
    const emitter = parseOne(raw, json);
    if (!emitter) {
      return;
    }
    rows.push({ ...emitter, index });
  });
  return rows;
}

export function ensureSpriteParticleUsed(json: ParticleGltfJson): void {
  const ext = rootExt(json);
  const has = ext !== null && Array.isArray(ext.emitters);
  const used = json.extensionsUsed ? [...json.extensionsUsed] : [];
  const i = used.indexOf(EXT_SPRITE_PARTICLE);
  if (!has) {
    if (i >= 0) {
      used.splice(i, 1);
      if (used.length === 0) {
        delete json.extensionsUsed;
      } else {
        json.extensionsUsed = used;
      }
    }
    return;
  }
  if (i < 0) {
    used.push(EXT_SPRITE_PARTICLE);
    json.extensionsUsed = used;
  }
  if (json.extensionsRequired) {
    json.extensionsRequired = json.extensionsRequired.filter((n) => n !== EXT_SPRITE_PARTICLE);
    if (json.extensionsRequired.length === 0) {
      delete json.extensionsRequired;
    }
  }
}

export function sanitizeSpriteParticles(json: ParticleGltfJson): void {
  const ext = rootExt(json);
  if (!ext || !Array.isArray(ext.emitters)) {
    ensureSpriteParticleUsed(json);
    return;
  }
  const kept: Record<string, unknown>[] = [];
  for (const raw of ext.emitters) {
    const emitter = parseOne(raw, json);
    if (emitter) {
      kept.push(serializeEmitter(emitter));
    }
  }
  ext.specVersion = SPRITE_PARTICLE_SPEC_VERSION;
  ext.emitters = kept;
  ensureSpriteParticleUsed(json);
}

export function setSpriteParticleEmitter(
  json: ParticleGltfJson,
  index: number,
  patch: SpriteParticlePatch,
): boolean {
  const ext = rootExt(json);
  if (!ext || !Array.isArray(ext.emitters) || index < 0 || index >= ext.emitters.length) {
    return false;
  }
  const current = parseOne(ext.emitters[index], json);
  if (!current) {
    return false;
  }
  const { texture: texturePatch, name: namePatch, size, color, ...rest } = patch;
  const next: SpriteParticleEmitter = {
    ...current,
    ...rest,
    size: size ?? current.size,
    color: color ?? current.color,
  };
  if (texturePatch === null) {
    delete next.texture;
  } else if (texturePatch !== undefined) {
    next.texture = texturePatch;
  }
  if (namePatch !== undefined) {
    if (namePatch.trim() === '') {
      delete next.name;
    } else {
      next.name = namePatch;
    }
  }
  const checked = parseOne(serializeEmitter(next), json);
  if (!checked) {
    return false;
  }
  ext.emitters[index] = serializeEmitter(checked);
  ensureSpriteParticleUsed(json);
  return true;
}

export function addSpriteParticleEmitter(json: ParticleGltfJson, node = 0): number | null {
  if (!json.nodes || node < 0 || node >= json.nodes.length) {
    return null;
  }
  const ext = ensureRootExt(json);
  const emitters = Array.isArray(ext.emitters) ? ext.emitters : [];
  ext.emitters = emitters;
  const n = emitters.length + 1;
  const emitter: SpriteParticleEmitter = {
    node,
    name: `Emitter.${String(n).padStart(3, '0')}`,
    size: [DEFAULT_SIZE[0], DEFAULT_SIZE[1]],
    color: [DEFAULT_COLOR[0], DEFAULT_COLOR[1], DEFAULT_COLOR[2], DEFAULT_COLOR[3]],
    emissionRate: EDIT_EMISSION_RATE,
    maxParticles: DEFAULT_MAX_PARTICLES,
    lifetime: EDIT_LIFETIME,
    startSpeed: DEFAULT_START_SPEED,
  };
  emitters.push(serializeEmitter(emitter));
  ensureSpriteParticleUsed(json);
  return emitters.length - 1;
}

export function removeSpriteParticleEmitter(json: ParticleGltfJson, index: number): boolean {
  const ext = rootExt(json);
  if (!ext || !Array.isArray(ext.emitters) || index < 0 || index >= ext.emitters.length) {
    return false;
  }
  ext.emitters.splice(index, 1);
  ensureSpriteParticleUsed(json);
  return true;
}
