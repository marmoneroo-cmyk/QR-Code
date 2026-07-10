import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Minimal Vitest config. The only customization is aliasing the `server-only` package to
 * an empty stub so server-layer modules (which import it as a build-time guard) can be
 * unit-tested. Test discovery and everything else keep Vitest's defaults.
 */
export default defineConfig({
  test: {
    alias: {
      'server-only': fileURLToPath(new URL('./test/setup/server-only-stub.ts', import.meta.url)),
    },
  },
});
