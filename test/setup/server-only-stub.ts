// Vitest stub for the `server-only` package. That package throws by design when imported
// outside a React Server Component build, which makes any server module that imports it
// untestable under Vitest. Aliasing it to this empty module (see vitest.config.ts) lets us
// unit-test server-layer logic (e.g. the SSRF guard) without pulling in the RSC runtime.
export {};
