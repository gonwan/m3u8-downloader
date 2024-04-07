import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import unocss from 'unocss/vite'
import electron from 'vite-plugin-electron/simple'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vitejs.dev/config/
export default defineConfig({
  /* applies to only *.js, *.ts and *.vue file in render process */
  build: {
    sourcemap: true,
    minify: true,
  },
  plugins: [
    vue(),
    unocss(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          publicDir: 'electron/public',
          build: {
            /*
             * Enable sourcemap for debugging
             * Main process:
             * - Create a 'Node.js' run/debug configuration
             * - node interpreter: select electron/electron.cmd in current project.
             * - node parameter: '--remote-debugging-port=9229 .'
             * Render process:
             * - Create a 'Attach to Node.js' run/debug configuration
             * - port: 9229
             * Also see: https://blog.jetbrains.com/webstorm/2016/05/getting-started-with-electron-in-webstorm/
             */
            sourcemap: true,
            minify: true,
            // lib: {
            //   entry: 'electron/main.ts',
            //   formats: ['cjs'],
            //   fileName: () => '[name].cjs'
            // }
          }
        }
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            sourcemap: true,
            minify: true,
          }
        }
      }
    }),
    /* on-demand import, this lead to faster vue-tsc run and a much smaller bundle. */
    AutoImport({
      resolvers: [ElementPlusResolver()]
    }),
    Components({
      resolvers: [ElementPlusResolver()]
    })
  ]
})
