import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const mappings = [
  ['v1/backend/.env.example', 'v1/backend/.env'],
  ['v1/frontend/.env.example', 'v1/frontend/.env'],
  ['v2/backend/.env.example', 'v2/backend/.env'],
  ['v2/frontend/.env.example', 'v2/frontend/.env'],
];

for (const [exampleRel, targetRel] of mappings) {
  const examplePath = path.join(root, exampleRel);
  const targetPath = path.join(root, targetRel);

  if (!fs.existsSync(examplePath)) {
    console.log(`[setup:env] skip (missing example): ${exampleRel}`);
    continue;
  }

  if (fs.existsSync(targetPath)) {
    console.log(`[setup:env] keep existing: ${targetRel}`);
    continue;
  }

  fs.copyFileSync(examplePath, targetPath);
  console.log(`[setup:env] created: ${targetRel}`);
}
