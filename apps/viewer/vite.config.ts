import { defineConfig } from 'vite';

const githubPages = process.env.GITHUB_PAGES === '1';

export default defineConfig({
  base: githubPages ? '/three-vrmxt/' : '/',
  server: { port: 5173 },
});
