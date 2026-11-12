// Convert a captured native session JSON into §10 JSONL. Run from the capture package so
// @blockblast/engine resolves. Usage: node ingest-native.mjs <session.json> <out.jsonl>
import { readFileSync, writeFileSync } from 'node:fs';
import { sessionToRecords } from './dist/nativeLog.js';
const [, , inPath, outPath] = process.argv;
const session = JSON.parse(readFileSync(inPath, 'utf8'));
const res = sessionToRecords(session);
writeFileSync(outPath, res.rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
const { rows, ...meta } = res;
console.error(JSON.stringify(meta, null, 2));
