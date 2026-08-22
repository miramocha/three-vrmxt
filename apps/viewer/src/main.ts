import { createVrmxtViewer } from '@vrmxt/viewer-core';

const canvas = document.querySelector('#view') as HTMLCanvasElement;
const statusEl = document.querySelector('#status') as HTMLElement;
const fileEl = document.querySelector('#file') as HTMLInputElement;
const viewer = createVrmxtViewer(canvas);

async function loadFile(file: File): Promise<void> {
  statusEl.textContent = `Loading ${file.name}…`;
  try {
    const bytes = await file.arrayBuffer();
    const info = await viewer.loadBytes(bytes, file.name);
    statusEl.textContent = `${info.name}  MToonXT applied=${info.mtoonxtApplied} skipped=${info.mtoonxtSkipped}`;
  } catch (err) {
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
