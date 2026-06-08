// Probe a Hugging Face Space's gradio API: prints named endpoints + their
// parameters so we can wire generate-3d.ts correctly.
//   node scripts/hf-introspect.mjs <space>   e.g. hysts/TripoSR
import { Client } from '@gradio/client';

const space = process.argv[2];
if (!space) {
  console.error('usage: node scripts/hf-introspect.mjs <space>');
  process.exit(1);
}

const token = process.env.HF_TOKEN || undefined;

try {
  const app = await Client.connect(space, token ? { hf_token: token } : undefined);
  const api = await app.view_api();
  const named = api.named_endpoints || {};
  console.log(`CONNECTED: ${space}`);
  for (const [name, def] of Object.entries(named)) {
    const params = (def.parameters || []).map((p) => `${p.parameter_name || p.label}:${p.python_type?.type || p.type}`).join(', ');
    const returns = (def.returns || []).map((r) => `${r.label}:${r.python_type?.type || r.type}`).join(', ');
    console.log(`  ${name}  IN(${params})  OUT(${returns})`);
  }
} catch (e) {
  console.error(`FAILED ${space}: ${e?.message || e}`);
  process.exit(2);
}
