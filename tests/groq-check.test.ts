import { describe, it } from 'vitest';
import { createWorkerSupabaseClient } from '../packages/database/src/index';
import { decryptSecret } from '../packages/shared/src/server';

describe('Groq Check', () => {
  it('checks groq models and latency', async () => {
    const sb = createWorkerSupabaseClient();
    const { data: creds } = await sb.from('ai_credentials').select('*');
    console.log('Creds count:', creds?.length);
    for (const c of creds || []) {
      console.log('Provider:', c.provider, 'Label:', c.label);
      const key = decryptSecret(c.encrypted_api_key);
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: 'Bearer ' + key }
      });
      console.log('Groq models HTTP status:', res.status);
      if (res.ok) {
        const data = await res.json();
        const ids = (data.data as Array<{ id: string }>).map(m => m.id);
        console.log('ALL Available models on Groq:');
        console.log(ids);

        // Test latency of llama-3.3-70b-versatile vs llama-3.1-8b-instant vs openai/gpt-oss-120b
        for (const testModel of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b']) {
          const t0 = Date.now();
          try {
            const chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + key,
              },
              body: JSON.stringify({
                model: testModel,
                messages: [{ role: 'user', content: 'Reponds juste "OK"' }],
                max_tokens: 10,
              }),
            });
            const elapsed = Date.now() - t0;
            if (chatRes.ok) {
              const chatData = await chatRes.json();
              console.log(`Model [${testModel}] SUCCESS in ${elapsed}ms:`, chatData.choices?.[0]?.message?.content);
            } else {
              const errBody = await chatRes.text();
              console.log(`Model [${testModel}] FAILED in ${elapsed}ms (${chatRes.status}):`, errBody);
            }
          } catch (err: any) {
            console.log(`Model [${testModel}] ERROR:`, err.message);
          }
        }
      }
    }
  }, 30000);
});
