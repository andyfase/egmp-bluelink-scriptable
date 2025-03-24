import typescript from '@rollup/plugin-typescript'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import terser from '@rollup/plugin-terser'
import json from '@rollup/plugin-json'

import addFileIconSettings from './rollup-plugin-add-file-icon-settings'

// https://github.com/rollup/rollup/issues/703#issuecomment-224984436 <-- passing args into config file
const ENTRY_FILE_PATH = process.env.file_path
const FILE = process.env.file

const config = {
  input: ENTRY_FILE_PATH,

  output: {
    file: `build/${FILE}.js`,
    format: 'es',
    plugins: [
      terser({
        output: {
          comments: false,
        },
      }),
      addFileIconSettings(),
    ],
  },
  plugins: [typescript(), json(), nodeResolve(), nodePolyfills(/* options */)],
  watch: {
    include: 'src/**',
  },
}

// ts-unused-exports:disable-next-line
export default [config]
