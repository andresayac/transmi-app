import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, 'src'),
            'server-only': path.resolve(import.meta.dirname, 'src/test/serverOnly.ts'),
        },
    },
    test: {
        include: ['src/**/*.test.ts'],
        environment: 'node',
    },
});
