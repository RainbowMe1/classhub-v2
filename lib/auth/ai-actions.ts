'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, requireRole } from '@/lib/auth/actions';

const FALLBACKS = ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

export async function saveAISettings(formData: FormData) {
  await requireRole('admin');
  const api_key = String(formData.get('api_key') || '').trim();
  const model = String(formData.get('model') || '').trim() || 'meta-llama/llama-4-scout-17b-16e-instruct';
  const admin = createAdminClient();
  const { data: existing } = await admin.from('ai_settings').select('id').limit(1).maybeSingle();
  const payload: any = { model };
  if (api_key) payload.api_key = api_key;
  let error: any = null;
  if (existing) {
    const r = await admin.from('ai_settings').update(payload).eq('id', existing.id);
    error = r.error;
  } else {
    const r = await admin.from('ai_settings').insert(payload);
    error = r.error;
  }
  if (error) return { error: error.message };
  return { success: true };
}

async function callGroq(apiKey: string, model: string, messages: any[], useTools: boolean) {
  const body: any = { model, messages, temperature: 0.7, max_tokens: 2048 };
  if (useTools) body.tools = [{ type: 'web_search' }];
  return await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
    body: JSON.stringify(body),
  });
}

export async function askAI(messages: { role: string; text: string }[]) {
  await requireUser();
  const admin = createAdminClient();
  const { data } = await admin.from('ai_settings').select('*').limit(1).maybeSingle();
  if (!data || !data.api_key) return { error: 'AI belum dikonfigurasi. Admin harus isi Groq API key dulu di halaman AI.' };

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const chatMessages = [
    {
      role: 'system',
      content:
        'Kamu asisten kelas Sainstech 2 yang ramah dan membantu. Jawab dalam Bahasa Indonesia dengan ringkas dan jelas. ' +
        'Hari ini adalah ' + today + '. Pengetahuan dasarmu mungkin lebih lama dari tanggal itu. ' +
        'Jika tersedia alat pencarian web, gunakan untuk pertanyaan tentang kejadian terbaru. ' +
        'Jika tidak yakin tentang fakta terbaru, katakan jujur bahwa informasimu mungkin belum terkini.',
    },
    ...messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
  ];

  const first = data.model || 'meta-llama/llama-4-scout-17b-16e-instruct';
  const models = [first].concat(FALLBACKS.filter((m) => m !== first));
  let lastErr = '';

  for (const model of models) {
    try {
      let res = await callGroq(data.api_key, model, chatMessages, true);
      if (res.status === 400) {
        res = await callGroq(data.api_key, model, chatMessages, false);
      }
      if (res.ok) {
        const json = await res.json();
        const text = (json?.choices?.[0]?.message?.content || '').trim() || '(tidak ada jawaban)';
        return { text, usedModel: model };
      }
      const t = await res.text();
      lastErr = 'Groq error ' + res.status + ' (' + model + '): ' + t.slice(0, 250);
      if (res.status !== 404 && res.status !== 429) break;
    } catch (e: any) {
      lastErr = 'Gagal memanggil Groq: ' + (e && e.message ? e.message : 'network error');
      break;
    }
  }
  return { error: lastErr };
}
