import { defineConfig } from 'vite';

export default defineConfig({
  base: '/eek-a-look/',
  build: {
    sourcemap: false,
  },
  // onnxruntime-web loads its WebAssembly at run time; pre-bundling breaks those paths.
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  worker: {
    format: 'es',
  },
});
