import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/medal/',
  appType: 'mpa',
  build: {
    copyPublicDir: false,
  }
})
