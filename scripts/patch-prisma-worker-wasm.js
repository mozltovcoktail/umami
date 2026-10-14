import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/generated/prisma/internal/class.ts';
const source = await readFile(path, 'utf8');
const original = `  getQueryCompilerWasmModule: async () => {\n    const { default: module } = await import("./query_compiler_fast_bg.wasm?module")\n    return module\n  },`;
const replacement = `  getQueryCompilerWasmModule: async () => {\n    const module = (globalThis as typeof globalThis & { __UMAMI_PRISMA_QUERY_COMPILER_WASM?: WebAssembly.Module })\n      .__UMAMI_PRISMA_QUERY_COMPILER_WASM\n    if (!module) throw new Error('Prisma query compiler WASM is not loaded by the Cloudflare Worker.')\n    return module\n  },`;
if (source.includes(replacement)) process.exit(0);
if (!source.includes(original)) throw new Error('Could not find the generated Prisma WASM loader to patch.');
await writeFile(path, source.replace(original, replacement));
