import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const transcriptPath = 'C:/Users/Jeet/.gemini/antigravity/brain/6beb669a-b7d6-44f9-8123-1c6aca3e7a57/.system_generated/logs/transcript_full.jsonl';

const targetSteps = {
  202: 'client/src/components/Navbar.tsx',
  204: 'client/src/components/HomeScreen.tsx',
  206: 'client/src/components/BrowseScreen.tsx',
  208: 'client/src/components/ReportFormScreen.tsx',
  210: 'client/src/components/ItemDetailScreen.tsx',
  212: 'client/src/components/MyReportsScreen.tsx',
  214: 'client/src/components/AuthScreen.tsx'
};

const extracted = {};

const rl = readline.createInterface({
  input: fs.createReadStream(transcriptPath),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  const item = JSON.parse(line);
  if (targetSteps[item.step_index]) {
    const relFile = targetSteps[item.step_index];
    const tc = item.tool_calls.find(c => c.name === 'write_file');
    if (tc && tc.args?.Content) {
      extracted[relFile] = tc.args.Content;
    }
  }
});

rl.on('close', () => {
  console.log(`Writing restored files... (Found ${Object.keys(extracted).length} of 7)`);
  for (const [relPath, content] of Object.entries(extracted)) {
    const absPath = path.resolve(projectRoot, relPath);
    fs.writeFileSync(absPath, content, 'utf-8');
    console.log(`✓ Restored ${relPath} (${content.length} bytes, ${content.split('\n').length} lines)`);
  }
});
