import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VAPID_PUBLIC_KEY     = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY    = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT        = process.env.VAPID_SUBJECT ?? 'mailto:ahorroinvisible@gmail.com';
const CRON_SECRET          = process.env.CRON_SECRET;
const APP_URL              = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ahorro-invisible-mvp.vercel.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function GET(req: NextRequest) {
  // Proteger el endpoint: solo Vercel Cron o llamadas con el secreto correcto
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase service role not configured' }, { status: 503 });
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 503 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const today = new Date().toISOString().split('T')[0];

  // 1. Obtener todos los usuarios con push subscription
  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('user_id, subscription');

  if (subsErr || !subs?.length) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No subscriptions found' });
  }

  // 2. Obtener los users que YA tienen decisión hoy
  const { data: doneToday } = await supabase
    .from('decisions')
    .select('user_id')
    .eq('date', today)
    .not('question_id', 'in', '(grace_day,extra_saving)');

  const doneSet = new Set((doneToday ?? []).map((d: { user_id: string }) => d.user_id));

  // 3. Enviar notificación solo a los que NO han completado
  const pending = subs.filter((s: { user_id: string }) => !doneSet.has(s.user_id));

  let sent = 0;
  let failed = 0;
  const expired: string[] = [];

  for (const sub of pending) {
    try {
      await webpush.sendNotification(
        sub.subscription as webpush.PushSubscription,
        JSON.stringify({
          title: 'Ahorro Invisible ⚡',
          body: '¿Ya registraste tu decisión de hoy? Solo tarda 10 segundos.',
          url: '/daily',
          icon: `${APP_URL}/api/icon?size=192`,
          badge: `${APP_URL}/api/icon?size=96`,
          tag: 'daily-reminder',
        }),
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) {
        // Suscripción expirada → limpiar de BD
        expired.push(sub.user_id);
      } else {
        failed++;
        console.error('[cron/daily-reminder] push error:', err);
      }
    }
  }

  // 4. Limpiar suscripciones expiradas
  if (expired.length) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('user_id', expired);
  }

  console.log(`[cron/daily-reminder] sent=${sent} failed=${failed} expired=${expired.length} total=${subs.length} pending=${pending.length}`);
  return NextResponse.json({ ok: true, sent, failed, expired: expired.length, total: subs.length, pending: pending.length });
}
