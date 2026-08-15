'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, requireRole } from '@/lib/auth/actions';

export async function saveAISettings(formData: FormData) {
  await requireRole('admin');
  const api_key = String(formData.get('api_key') || '').trim();
  const model = String(formData.get('model') || '').trim() || 'gemini-2.5-flash';
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
  const model = data.model || 'gemini-2.5-flash';
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
    if (!res.ok) {
      const t = await res.text();
      return { error: 'Gemini error ' + res.status + ': ' + t.slice(0, 300) };
    }
    const json = await res.json();
    const text = (json?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text).join('') || '(tidak ada jawaban)';
    return { text };
  } catch (e: any) {
    return { error: 'Gagal memanggil Gemini: ' + (e && e.message ? e.message : 'network error') };
  }
}
