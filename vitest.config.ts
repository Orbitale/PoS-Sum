import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(
	viteConfig,
	defineConfig({
		plugins: [svelteTesting()],
		test: {
			projects: [
				{
					extends: true,
					test: {
						name: 'unit',
						environment: 'node',
						include: ['src/**/*.{test,spec}.{js,ts}'],
						exclude: [
							'src/**/*.svelte.{test,spec}.{js,ts}',
							'src/lib/stores/**/*.{test,spec}.{js,ts}',
							'src/lib/export-csv.{test,spec}.{js,ts}'
						]
					}
				},
				{
					extends: true,
					test: {
						name: 'component',
						environment: 'jsdom',
						include: [
							'src/**/*.svelte.{test,spec}.{js,ts}',
							'src/lib/stores/**/*.{test,spec}.{js,ts}',
							'src/lib/export-csv.{test,spec}.{js,ts}'
						],
						setupFiles: ['./src/vitest-setup.ts']
					}
				}
			]
		}
	})
);
