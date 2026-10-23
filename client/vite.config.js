import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';
export default defineConfig({
    plugins: [preact()],
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, '../shared'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
    build: {
        target: 'es2020',
        sourcemap: true,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                admin: path.resolve(__dirname, 'admin.html'),
                beta: path.resolve(__dirname, 'beta.html'),
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    if (chunkInfo.name === 'admin') {
                        return 'assets/admin-[hash].js';
                    }
                    if (chunkInfo.name === 'beta') {
                        return 'assets/beta-[hash].js';
                    }
                    return 'assets/[name]-[hash].js';
                },
                chunkFileNames: (chunkInfo) => {
                    if (chunkInfo.name.includes('admin')) {
                        return 'assets/admin-[name]-[hash].js';
                    }
                    if (chunkInfo.name.includes('beta')) {
                        return 'assets/beta-[name]-[hash].js';
                    }
                    return 'assets/[name]-[hash].js';
                },
            },
        },
    },
});
