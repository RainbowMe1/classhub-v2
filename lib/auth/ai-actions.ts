'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, requireRole } from '@/lib/auth/actions';

const FALLBACKS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'meta-llama/llama-4-scout-17b-16e-instruct', 'gemma2-9b-it'];

export async function saveAISettings(formData: FormData) {
  await requireRole('admin');
  const api_key = String(formData.get('api_key') || '').trim();
  const model = String(formData.get('model') || '').trim() || 'llama-3.3-70b-versatile';
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

export async function askAI(messages: { role: string; text: string }[]) {
  await requireUser();
  const admin = createAdminClient();
  const { data } = await admin.from('ai_settings').select('*').limit(1).maybeSingle();
  if (!data || !data.api_key) return { error: 'AI belum dikonfigurasi. Admin harus isi Groq API key dulu di halaman AI.' };

  const first = data.model || 'llama-3.3-70b-versatile';
  const models = [first].concat(FALLBACKS.filter((m) => m !== first));
  let lastErr = '';
  let usedModel = '';

  const payload = {
    model: '',
    messages: [
      { role: 'system', content: 'Kamu asisten kelas yang ramah dan membantu. Jawab dalam Bahasa Indonesia dengan ringkas, jelas, dan pakai format yang enak dibaca. Kalau ditanya materi pelajaran, kasih contoh konkret.' },
      ...messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
    ],
    temperature: 0.7,
    max_tokens: 2048,
  };

  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + data.api_key,
        },
        body: JSON.stringify({ ...payload, model }),
      });
      if (res.ok) {
        const json = await res.json();
        const text = (json?.choices?.[0]?.message?.content || '').trim() || '(tidak ada jawaban)';
        usedModel = model;
        return { text, usedModel };
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
