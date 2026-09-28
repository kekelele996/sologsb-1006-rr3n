import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [svelte({ compilerOptions: { css: 'injected' } })],
  resolve: {
    alias: { '$lib': '/workspace/src/lib' }
  },
  build: {
    lib: { entry: '/workspace/.uitest/entry.js', formats: ['iife'], name: '__uitest', fileName: () => 'bundle.js' },
    outDir: '/workspace/.uitest/dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        footer: 'window.__uitest = __uitest;'
      }
    }
  }
})
