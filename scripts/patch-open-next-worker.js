import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const workerPath = '.open-next/worker.js';
const worker = await readFile(workerPath, 'utf8');
const wasmTarget = '.open-next/server-functions/default/src/generated/prisma/internal/query_compiler_fast_bg.wasm';
await mkdir('.open-next/server-functions/default/src/generated/prisma/internal', { recursive: true });
await copyFile('src/generated/prisma/internal/query_compiler_fast_bg.wasm', wasmTarget);

const workerImports = `import { CloudflareSocket } from "pg-cloudflare";\nglobalThis.__UMAMI_PG_CLOUDFLARE_SOCKET = CloudflareSocket;\nimport prismaQueryCompilerWasm from "./server-functions/default/src/generated/prisma/internal/query_compiler_fast_bg.wasm";\nglobalThis.__UMAMI_PRISMA_QUERY_COMPILER_WASM = prismaQueryCompilerWasm;\n`;
if (worker.includes(workerImports)) process.exit(0);

const marker = '//@ts-expect-error: Will be resolved by wrangler build\nimport { handleCdnCgiImageRequest';
if (!worker.includes(marker)) throw new Error('Could not find OpenNext Worker import marker.');
await writeFile(workerPath, worker.replace(marker, `${workerImports}${marker}`));
