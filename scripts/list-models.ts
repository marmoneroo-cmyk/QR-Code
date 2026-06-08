import * as dotenv from 'dotenv';
import * as path from 'node:path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
import { GoogleGenAI } from '@google/genai';

async function main(): Promise<void> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const pager = await ai.models.list();
  const found: string[] = [];
  for await (const m of pager) {
    const name = m.name ?? '';
    const actions = (m.supportedActions ?? []).join(',');
    found.push(`${name}  [${actions}]`);
  }
  const imageRelated = found.filter((s) => /image|banana|imagen/i.test(s));
  console.log('=== Image-related models ===');
  console.log(imageRelated.join('\n'));
  console.log('\n=== All flash models ===');
  console.log(found.filter((s) => /flash/i.test(s)).join('\n'));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
