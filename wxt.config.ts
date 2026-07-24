import { defineConfig } from 'wxt';
import packageJson from './package.json';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  publicDir: 'src/public',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: "Merlin's Cloak v2",
    description: packageJson.description,
    version: packageJson.version,
  },
  vite: (env) => ({
    build: {
      sourcemap: env.mode === 'development',
      minify: env.mode !== 'development',
    },
  }),
});
