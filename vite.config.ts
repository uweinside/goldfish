/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'happy-dom',
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/core/**/*.ts'],
            exclude: ['src/**/*.test.ts'],
        },
    },
    // Serve wwwroot at / so existing CSS and data paths are unchanged
    publicDir: 'wwwroot',
    server: {
        port: 1420,
        strictPort: true,
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                timer: resolve(__dirname, 'timer.html'),
                editor: resolve(__dirname, 'editor.html'),
            },
        },
    },
});

