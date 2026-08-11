import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.ts'),
        convert: resolve(__dirname, 'src/convert.ts'),
      },
      external: (id) => id.startsWith('node:') || id === 'piconvert',
      preserveEntrySignatures: 'strict',
      output: [
        {
          format: 'es',
          entryFileNames: '[name].mjs',
          chunkFileNames: 'chunks/[name]-[hash].mjs',
          preserveModules: true,
          preserveModulesRoot: 'src',
        },
        {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: 'chunks/[name]-[hash].cjs',
          preserveModules: true,
          preserveModulesRoot: 'src',
        },
      ],
    },
    emptyOutDir: true,
  },
  plugins: [
    dts({
      outDir: 'dist',
      rollupTypes: false,
      insertTypesEntry: true,
      staticImport: true,
      tsconfigPath: './tsconfig.json',
      exclude: ['tests', 'node_modules', '**/*.test.ts'],
    }),
  ],
});
