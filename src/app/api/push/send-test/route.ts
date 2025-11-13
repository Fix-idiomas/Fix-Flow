import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyFirebaseIdToken, getFirebaseAdmin } from "@/lib/firebase-admin";
import { getMessaging, type Message } from "firebase-admin/messaging";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/push/send-test
// Body: { token?: string, title?: string, body?: string, link?: string }
// Sends a simple notification via FCM using Firebase Admin SDK.
export async function POST(req: Request) {
  try {
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return NextResponse.json({ error: "admin_unavailable" }, { status: 500 });

    // auth
    let firebaseUid: string | null = null;
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      firebaseUid = await verifyFirebaseIdToken(token).catch(() => null);
    }
    if (!firebaseUid) firebaseUid = req.headers.get("x-firebase-uid");
    if (!firebaseUid) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Partial<{
      token: string;
      title: string;
      body: string;
      link: string;
    }>;
    let token: string | undefined = typeof body.token === "string" ? body.token : undefined;
    const title = typeof body.title === "string" && body.title ? body.title : "Fix Flow — teste";
    const notifBody = typeof body.body === "string" && body.body ? body.body : "Notificação de teste";
    const link = typeof body.link === "string" && body.link ? body.link : process.env.NEXT_PUBLIC_SITE_URL || "https://fix-flow-eight.vercel.app/";

    // fetch token from DB if not provided
    if (!token) {
      const supabase = getSupabase();
      const { data: userRow } = await supabase
        .from("users")
        .select("id")
        .eq("firebase_uid", firebaseUid)
        .maybeSingle();
      if (!userRow) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("token")
        .eq("user_id", userRow.id)
        .limit(1);
      token = tokens && tokens[0]?.token;
      if (!token) return NextResponse.json({ error: "no_token" }, { status: 400 });
    }

    const messaging = getMessaging(adminApp);
    const message: Message = {
      token,
      notification: { title, body: notifBody },
      webpush: {
        fcmOptions: { link },
      },
    };

    const messageId = await messaging.send(message);
    return NextResponse.json({ ok: true, messageId });
  } catch (e: unknown) {
    let msg = "server_error";
    if (e instanceof Error) msg = e.message;
    else if (typeof e === "string") msg = e;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}