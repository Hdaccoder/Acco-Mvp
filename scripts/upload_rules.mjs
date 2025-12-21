import fs from 'fs';
import fetch from 'node-fetch';

async function run(){
  const rules = fs.readFileSync('./firestore.rules', 'utf8');
  const project = 'demo-project';
  const url = `http://localhost:8080/emulator/v1/projects/${project}/rulesets`;
  const body = { source: { files: [{ name: 'firestore.rules', content: rules }] } };
  console.log('Uploading rules to', url);
  const res = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }});
  const text = await res.text();
  console.log('Status', res.status);
  console.log(text);
}

run().catch(e=>{ console.error(e); process.exit(1); });
