import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the PNG app icons from public/icon.svg: `npm run icons`
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#09090b' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#09090b' } },
  },
  images: ['public/icon.svg'],
})
