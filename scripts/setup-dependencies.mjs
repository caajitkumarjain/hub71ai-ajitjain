import { writeFile } from 'node:fs/promises';

// Resolve only the §2 stack and the build/type helpers required by that stack.
const runtime = ['next', 'react', 'react-dom', 'zod', 'lucide-react', 'motion', 'recharts', 'sonner', 'date-fns', '@openai/agents', 'openai', '@radix-ui/react-slot', 'class-variance-authority', 'clsx', 'tailwind-merge'];
const development = ['typescript', '@types/node', '@types/react', '@types/react-dom', 'tailwindcss', '@tailwindcss/postcss', 'postcss', 'vitest'];
const versions = Object.fromEntries(await Promise.all([...runtime, ...development, 'pnpm'].map(async (name) => {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`);
  if (!response.ok) throw new Error(`Registry lookup failed: ${name} (${response.status})`);
  const metadata = await response.json();
  if (metadata.name !== name) throw new Error(`Unexpected package: ${metadata.name}`);
  return [name, metadata.version];
})));
const pick = (names) => Object.fromEntries(names.map((name) => [name, versions[name]]));
await writeFile('package.json', JSON.stringify({
  name: 'manzil-hub71', version: '0.1.0', private: true, type: 'module',
  packageManager: `pnpm@${versions.pnpm}`,
  engines: { node: '>=22.15.0' },
  scripts: { dev: 'next dev', build: 'next build', start: 'next start', test: 'vitest run', typecheck: 'tsc --noEmit' },
  dependencies: pick(runtime), devDependencies: pick(development),
}, null, 2) + '\n', { encoding: 'utf-8' });
console.log(JSON.stringify(versions, null, 2));
