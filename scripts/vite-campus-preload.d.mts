import type { Plugin } from 'vite';

export function campusCorePreloadScript(base: string, file: unknown): string | undefined;
export function campusArtworkPreloadScript(base: string, files: string[]): string | undefined;
export function campusCorePreload(): Plugin;
