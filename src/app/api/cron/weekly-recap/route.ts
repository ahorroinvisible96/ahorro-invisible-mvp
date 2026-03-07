import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VAPID_PUBLIC_KEY  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT ?? 'mailto:ahorroinvisible@gmail.com';
const CRON_SECRET       = process.env.CRON_SECRET;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Missing configuration' }, { status: 503 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Ventana de la semana pasada (lun-dom)
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const cutoff = weekAgo.toISOString().split('T')[0];

  // Obtener todas las suscripciones push
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, subscription');

  if (!subs?.length) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Obtener decisiones de los últimos 7 días agrupadas por user
  const userIds = subs.map((s: { user_id: string }) => s.user_id);
  const { data: decisions } = await supabase
    .from('decisions')
    .select('user_id, delta_amount, question_id')
    .gte('date', cutoff)
    .in('user_id', userIds);

  // Calcular resumen por usuario
  type UserStats = { count: number; saved: number };
  const statsMap: Record<string, UserStats> = {};
  for (const d of decisions ?? []) {
    if (!statsMap[d.user_id]) statsMap[d.user_id] = { count: 0, saved: 0 };
    if (d.question_id !== 'grace_day') {
      statsMap[d.user_id].count++;
      statsMap[d.user_id].saved += d.delta_amount ?? 0;
    }
  }

  let sent = 0;
  let failed = 0;
  const expired: string[] = [];

  for (const sub of subs) {
    const stats = statsMap[sub.user_id] ?? { count: 0, saved: 0 };
    if (stats.count === 0) continue; // No enviar resumen si no hubo actividad

    const savedStr = new Intl.NumberFormat('es-ES', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
    }).format(stats.saved);

    const body = stats.count >= 7
      ? `¡Semana perfecta! 7/7 decisiones. Has ahorrado ${savedStr} esta semana. 🏆`
      : `Esta semana: ${stats.count} decisiones y ${savedStr} ahorrados. ¡Sigue así! 💪`;

    try {
      await webpush.sendNotification(
        sub.subscription as webpush.PushSubscription,
        JSON.stringify({
          title: 'Tu resumen semanal 📊',
          body,
          url: '/history',
          icon: '/icon-192.png',
          badge: '/icon-96.png',
          tag: 'weekly-recap',
        }),
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) {
        expired.push(sub.user_id);
      } else {
        failed++;
      }
    }
  }

  if (expired.length) {
    await supabase.from('push_subscriptions').delete().in('user_id', expired);
  }

  console.log(`[cron/weekly-recap] sent=${sent} failed=${failed} expired=${expired.length}`);
  return NextResponse.json({ ok: true, sent, failed, expired: expired.length });
}
