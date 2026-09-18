import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Vitest is left on its defaults on purpose: it already picks up *.test.ts and
// nothing else, and importing `vitest/config` here drags in a second copy of
// vite whose plugin types disagree with this one's.
//
// There is no dev proxy here, unlike the arcade games on the site. They post
// scores to a shared service; this one has nothing to post.
export default defineConfig({
  // Asset URLs are baked in at build time, so this has to match the path the
  // game is served from. Local development stays at the root.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
})
