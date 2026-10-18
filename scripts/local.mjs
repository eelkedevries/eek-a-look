#!/usr/bin/env node
// `npm run local`: starts the DeepGaze GPU helper (tools/deepgaze-local),
// waits until its models are loaded, then serves the built site with Vite's
// preview server, which forwards /eek-a-look/local-api/ to the helper.
import { spawn } from 'node:child_process';

const HELPER = 'http://127.0.0.1:8765/health';
const children = [];

function start(command, args, options) {
  const child = spawn(command, args, { stdio: 'inherit', ...options });
  children.push(child);
  child.on('exit', (code) => {
    if (code) console.error(`${command} exited with code ${code}.`);
    stop();
  });
  return child;
}

function stop() {
  for (const child of children) if (child.exitCode === null) child.kill('SIGINT');
  process.exitCode = 1;
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

console.log('Starting the DeepGaze helper. The first run downloads about 2 GB of weights.');
start('uv', ['run', 'serve.py'], { cwd: 'tools/deepgaze-local' });

const deadline = Date.now() + 20 * 60 * 1000;
for (;;) {
  try {
    const health = await (await fetch(HELPER)).json();
    console.log(`Helper ready on ${health.device}: ${health.models.join(', ')}.`);
    break;
  } catch {
    if (Date.now() > deadline) {
      console.error('The helper did not start within 20 minutes.');
      stop();
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

start('npx', ['vite', 'preview', '--port', '4173', '--strictPort']);
console.log('\nOpen http://localhost:4173/eek-a-look/ (Ctrl+C stops everything).\n');
