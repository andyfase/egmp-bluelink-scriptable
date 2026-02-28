import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      config: path.resolve(__dirname, './src/config.ts'),
      lib: path.resolve(__dirname, './src/lib'),
      resources: path.resolve(__dirname, './src/resources'),
      widget: path.resolve(__dirname, './src/widget.ts'),
      app: path.resolve(__dirname, './src/app.ts'),
      siri: path.resolve(__dirname, './src/siri.ts'),
    },
  },
})
