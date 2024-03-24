import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import unocss from 'unocss/vite'
import electron from 'vite-plugin-electron/simple'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    unocss(),
    electron({
      main: {
        entry: 'electron/main.ts'
        // vite: {
        //   build: {
        //     lib: {
        //       entry: 'electron/main.ts',
        //       formats: ['cjs'],
        //       fileName: () => '[name].cjs'
        //     }
        //   }
        // }
      },
      preload: {
        input: 'electron/preload.ts'
      },
      renderer: { }
    })
  ]
})
