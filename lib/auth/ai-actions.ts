'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, requireRole } from '@/lib/auth/actions';

const FALLBACKS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.5-flash'];

export async function saveAISettings(formData: FormData) {
  await requireRole('admin');
  const api_key = String(formData.get('api_key') || '').trim();
  const model = String(formData.get('model') || '').trim() || 'gemini-3.6-flash';
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
  if (!data || !data.api_key) return { error: 'AI belum dikonfigurasi. Admin harus isi API key dulu di halaman AI.' };

  const first = data.model || 'gemini-3.6-flash';
  const models = [first].concat(FALLBACKS.filter((m) => m !== first));
  let lastErr = '';
  let usedModel = '';

  for (const model of models) {
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + data.api_key, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: 'Kamu asisten kelas yang ramah dan membantu. Jawab dalam Bahasa Indonesia dengan ringkas dan jelas.' }],
          },
          contents: messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const text = (json?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text).join('') || '(tidak ada jawaban)';
        usedModel = model;
        return { text, usedModel };
      }
      const t = await res.text();
      lastErr = 'Gemini error ' + res.status + ' (' + model + '): ' + t.slice(0, 250);
      if (res.status !== 404) break;
    } catch (e: any) {
      lastErr = 'Gagal memanggil Gemini: ' + (e && e.message ? e.message : 'network error');
      break;
    }
  }
  return { error: lastErr };
}
