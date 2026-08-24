import { createVrmxtViewer, type ViewerShadows, type ViewerStatus } from '@vrmxt/viewer-core';

const canvas = document.querySelector('#view') as HTMLCanvasElement;
const statusEl = document.querySelector('#status') as HTMLElement;
const fileEl = document.querySelector('#file') as HTMLInputElement;
const vrmxtEnabledEl = document.querySelector('#vrmxt-enabled') as HTMLInputElement;
const dirColorEl = document.querySelector('#dir-color') as HTMLInputElement;
const dirEnabledEl = document.querySelector('#dir-enabled') as HTMLInputElement;
const dirFieldsEl = document.querySelector('#dir-fields') as HTMLFieldSetElement;
const dirIntEl = document.querySelector('#dir-int') as HTMLInputElement;
const dirIntValEl = document.querySelector('#dir-int-val') as HTMLElement;
const dirAzEl = document.querySelector('#dir-az') as HTMLInputElement;
const dirAzValEl = document.querySelector('#dir-az-val') as HTMLElement;
const dirElEl = document.querySelector('#dir-el') as HTMLInputElement;
const dirElValEl = document.querySelector('#dir-el-val') as HTMLElement;
const dirMatchEl = document.querySelector('#dir-match') as HTMLButtonElement;
const ambColorEl = document.querySelector('#amb-color') as HTMLInputElement;
const ambIntEl = document.querySelector('#amb-int') as HTMLInputElement;
const ambIntValEl = document.querySelector('#amb-int-val') as HTMLElement;
const shEnabledEl = document.querySelector('#sh-enabled') as HTMLInputElement;
const shFieldsEl = document.querySelector('#sh-fields') as HTMLFieldSetElement;
const shCastEl = document.querySelector('#sh-cast') as HTMLInputElement;
const shReceiveEl = document.querySelector('#sh-receive') as HTMLInputElement;
const shGroundEl = document.querySelector('#sh-ground') as HTMLInputElement;
const shIntEl = document.querySelector('#sh-int') as HTMLInputElement;
const shIntValEl = document.querySelector('#sh-int-val') as HTMLElement;
const shBiasEl = document.querySelector('#sh-bias') as HTMLInputElement;
const shBiasValEl = document.querySelector('#sh-bias-val') as HTMLElement;
const shNbiasEl = document.querySelector('#sh-nbias') as HTMLInputElement;
const shNbiasValEl = document.querySelector('#sh-nbias-val') as HTMLElement;
const shMapEl = document.querySelector('#sh-map') as HTMLSelectElement;
const viewer = createVrmxtViewer(canvas);

function isSuperseded(err: unknown): boolean {
  return err instanceof Error && err.message === 'Load superseded';
}

function formatStatus(info: ViewerStatus): string {
  if (!info.vrmxtEnabled) {
    return `${info.name}  VRMXT off`;
  }
  return `${info.name}  MToonXT applied=${info.mtoonxtApplied} skipped=${info.mtoonxtSkipped}`;
}

function formatIntensity(value: number): string {
  return value.toFixed(2);
}

function formatDegrees(value: number): string {
  return `${Math.round(value)}°`;
}

function formatBias(value: number): string {
  return value.toFixed(4);
}

function syncLightUi(): void {
  const lights = viewer.getLights();
  dirEnabledEl.checked = lights.directionalEnabled;
  dirFieldsEl.disabled = !lights.directionalEnabled;
  dirColorEl.value = lights.directionalColor;
  dirIntEl.value = String(lights.directionalIntensity);
  dirIntValEl.textContent = formatIntensity(lights.directionalIntensity);
  dirAzEl.value = String(lights.directionalAzimuth);
  dirAzValEl.textContent = formatDegrees(lights.directionalAzimuth);
  dirElEl.value = String(lights.directionalElevation);
  dirElValEl.textContent = formatDegrees(lights.directionalElevation);
  ambColorEl.value = lights.ambientColor;
  ambIntEl.value = String(lights.ambientIntensity);
  ambIntValEl.textContent = formatIntensity(lights.ambientIntensity);

  const shadows = viewer.getShadows();
  shEnabledEl.checked = shadows.enabled;
  shFieldsEl.disabled = !shadows.enabled;
  shCastEl.checked = shadows.modelCast;
  shReceiveEl.checked = shadows.modelReceive;
  shGroundEl.checked = shadows.ground;
  shIntEl.value = String(shadows.intensity);
  shIntValEl.textContent = formatIntensity(shadows.intensity);
  shBiasEl.value = String(shadows.bias);
  shBiasValEl.textContent = formatBias(shadows.bias);
  shNbiasEl.value = String(shadows.normalBias);
  shNbiasValEl.textContent = formatIntensity(shadows.normalBias);
  shMapEl.value = String(shadows.mapSize);
}

dirEnabledEl.addEventListener('change', () => {
  viewer.setLights({ directionalEnabled: dirEnabledEl.checked });
  dirFieldsEl.disabled = !dirEnabledEl.checked;
});
dirColorEl.addEventListener('input', () => {
  viewer.setLights({ directionalColor: dirColorEl.value });
});
dirIntEl.addEventListener('input', () => {
  const directionalIntensity = Number(dirIntEl.value);
  viewer.setLights({ directionalIntensity });
  dirIntValEl.textContent = formatIntensity(directionalIntensity);
});
dirAzEl.addEventListener('input', () => {
  const directionalAzimuth = Number(dirAzEl.value);
  viewer.setLights({ directionalAzimuth });
  dirAzValEl.textContent = formatDegrees(directionalAzimuth);
});
dirElEl.addEventListener('input', () => {
  const directionalElevation = Number(dirElEl.value);
  viewer.setLights({ directionalElevation });
  dirElValEl.textContent = formatDegrees(directionalElevation);
});
dirMatchEl.addEventListener('click', () => {
  viewer.matchLightToCamera();
  syncLightUi();
});
ambColorEl.addEventListener('input', () => {
  viewer.setLights({ ambientColor: ambColorEl.value });
});
ambIntEl.addEventListener('input', () => {
  const ambientIntensity = Number(ambIntEl.value);
  viewer.setLights({ ambientIntensity });
  ambIntValEl.textContent = formatIntensity(ambientIntensity);
});

shEnabledEl.addEventListener('change', () => {
  viewer.setShadows({ enabled: shEnabledEl.checked });
  shFieldsEl.disabled = !shEnabledEl.checked;
});
shCastEl.addEventListener('change', () => {
  viewer.setShadows({ modelCast: shCastEl.checked });
});
shReceiveEl.addEventListener('change', () => {
  viewer.setShadows({ modelReceive: shReceiveEl.checked });
});
shGroundEl.addEventListener('change', () => {
  viewer.setShadows({ ground: shGroundEl.checked });
});
shIntEl.addEventListener('input', () => {
  const intensity = Number(shIntEl.value);
  viewer.setShadows({ intensity });
  shIntValEl.textContent = formatIntensity(intensity);
});
shBiasEl.addEventListener('input', () => {
  const bias = Number(shBiasEl.value);
  viewer.setShadows({ bias });
  shBiasValEl.textContent = formatBias(bias);
});
shNbiasEl.addEventListener('input', () => {
  const normalBias = Number(shNbiasEl.value);
  viewer.setShadows({ normalBias });
  shNbiasValEl.textContent = formatIntensity(normalBias);
});
shMapEl.addEventListener('change', () => {
  const mapSize = Number(shMapEl.value) as ViewerShadows['mapSize'];
  viewer.setShadows({ mapSize });
});
syncLightUi();
vrmxtEnabledEl.checked = viewer.getVrmxtEnabled();

vrmxtEnabledEl.addEventListener('change', () => {
  void (async () => {
    const enabled = vrmxtEnabledEl.checked;
    statusEl.textContent = enabled ? 'Applying VRMXT…' : 'Reloading without VRMXT…';
    try {
      const info = await viewer.setVrmxtEnabled(enabled);
      if (info) {
        statusEl.textContent = formatStatus(info);
      } else {
        statusEl.textContent = enabled
          ? 'Drop a .vrm here or open a file. View only.'
          : 'VRMXT off. Drop a .vrm here or open a file.';
      }
    } catch (err) {
      if (isSuperseded(err)) {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      statusEl.textContent = `Load failed: ${message}`;
    }
  })();
});

async function loadFile(file: File): Promise<void> {
  statusEl.textContent = `Loading ${file.name}…`;
  try {
    const bytes = await file.arrayBuffer();
    const info = await viewer.loadBytes(bytes, file.name);
    statusEl.textContent = formatStatus(info);
  } catch (err) {
    if (isSuperseded(err)) {
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    statusEl.textContent = `Load failed: ${message}`;
  }
}

fileEl.addEventListener('change', () => {
  const file = fileEl.files?.[0];
  if (file) {
    void loadFile(file);
  }
});

document.body.addEventListener('dragover', (e) => {
  e.preventDefault();
});
document.body.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files[0];
  if (file) {
    void loadFile(file);
  }
});
