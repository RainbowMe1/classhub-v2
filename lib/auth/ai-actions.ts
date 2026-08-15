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

async function fetchGrounding(q: string): Promise<string> {
  const parts: string[] = [];
  try {
    const ddg = await fetch('https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_html=1');
    if (ddg.ok) {
      const j = await ddg.json();
      if (j.AbstractText) parts.push(String(j.AbstractText));
      else if (j.Answer && typeof j.Answer === 'string') parts.push(j.Answer);
    }
  } catch (e) {}
  try {
    const ws = await fetch('https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(q) + '&format=json');
    if (ws.ok) {
      const j = await ws.json();
      const title = j?.query?.search?.[0]?.title;
      if (title) {
        const sum = await fetch('https://id.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title));
        if (sum.ok) {
          const sj = await sum.json();
          if (sj.extract) parts.push(String(sj.extract));
        }
      }
    }
  } catch (e) {}
  return parts.filter(Boolean).join('\n').slice(0, 3000);
}

export async function askAI(messages: { role: string; text: string }[]) {
  await requireUser();
  const admin = createAdminClient();
  const { data } = await admin.from('ai_settings').select('*').limit(1).maybeSingle();
  if (!data || !data.api_key) return { error: 'AI belum dikonfigurasi. Admin harus isi Groq API key dulu di halaman AI.' };

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const grounding = lastUser ? await fetchGrounding(lastUser.text) : '';

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  let system =
    'Kamu asisten kelas Sainstech 2 yang ramah dan membantu. Jawab dalam Bahasa Indonesia dengan ringkas dan jelas. ' +
    'Hari ini adalah ' + today + '.';
  if (grounding) {
    system +=
      '\n\nKONTEKS TERKINI HASIL PENCARIAN WEB (prioritaskan ini untuk fakta terbaru, dan sebutkan bahwa informasinya dari sumber terkini):\n' +
      grounding;
  }

  const chatMessages = [
    { role: 'system', content: system },
    ...messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
  ];

  const first = data.model || 'meta-llama/llama-4-scout-17b-16e-instruct';
  const models = [first].concat(FALLBACKS.filter((m) => m !== first));
  let lastErr = '';

  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.api_key },
        body: JSON.stringify({ model, messages: chatMessages, temperature: 0.7, max_tokens: 2048 }),
      });
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
