import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import {
  validateFullName,
  validateEmail,
  normalizePhoneE164,
  normalizeCPF,
  validateCEP,
  validateUF,
} from "@/lib/validation/profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

type Address = {
  street?: string;
  number?: string;
  complement?: string | null;
  neighborhood?: string;
  city?: string;
  state?: string; // UF
  cep?: string;
};

interface BodyShape {
  fullName?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  address?: Address;
}

function sanitizeString(s: any): string | undefined {
  if (typeof s !== "string") return undefined;
  const v = s.trim();
  if (v.length === 0) return undefined;
  // strip angled brackets to avoid HTML injection in accidental contexts
  return v.replace(/[<>]/g, "");
}

export async function POST(req: Request) {
  try {
    // Auth: prefer Firebase ID token, fallback x-firebase-uid
    let firebaseUid: string | null = null;
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      firebaseUid = await verifyFirebaseIdToken(token);
    }
    if (!firebaseUid) firebaseUid = req.headers.get("x-firebase-uid");
    if (!firebaseUid) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body: BodyShape | null = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Detect existing users row to ensure uid presence
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("id, firebase_uid")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();
    if (userErr) return NextResponse.json({ error: "user_check_failed", detail: userErr.message }, { status: 500 });
    if (!userRow) {
      // do not auto-create here; ask client to init first
      return NextResponse.json({ error: "user_not_initialized" }, { status: 400 });
    }

    const warnings: string[] = [];
    const schemaMissing: { tables?: string[]; columns?: Record<string, string[]> } = { tables: [], columns: {} };

    // Prepare partial updates to users (non-sensitive): full_name, email
    const usersPatch: Record<string, any> = {};
    if (body.fullName !== undefined) {
      const v = validateFullName(body.fullName);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      usersPatch.full_name = v.value;
    }
    if (body.email !== undefined) {
      const v = validateEmail(body.email);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      // Check column existence by attempting a select on email
      const sel = await supabase.from("users").select("id").eq("email", v.value).limit(1);
      if (sel.error && /column .* does not exist/i.test(sel.error.message)) {
        schemaMissing.columns = schemaMissing.columns || {};
        (schemaMissing.columns["users"] ||= []).push("email");
        warnings.push("users.email missing; skipping email update");
      } else {
        // Ensure uniqueness (best-effort if column exists)
        if (!sel.error && (sel.data?.length || 0) > 0) {
          // If found, ensure it's not the same user
          const dup = await supabase
            .from("users")
            .select("firebase_uid")
            .eq("email", v.value)
            .limit(1)
            .maybeSingle();
          if (!dup.error && dup.data && dup.data.firebase_uid !== firebaseUid) {
            return NextResponse.json({ error: "email_in_use" }, { status: 409 });
          }
        }
        usersPatch.email = v.value;
      }
    }

    let usersUpdated: any = null;
    if (Object.keys(usersPatch).length > 0) {
      const upd = await supabase
        .from("users")
        .update(usersPatch)
        .eq("firebase_uid", firebaseUid)
        .select("id, firebase_uid, display_name, avatar_url, full_name, email, onboarding_completed")
        .maybeSingle();
      if (upd.error) {
        // Handle missing columns generically
        if (/column .* does not exist/i.test(upd.error.message)) {
          warnings.push("Some users columns missing; partial update skipped");
        } else {
          return NextResponse.json({ error: "update_failed", detail: upd.error.message }, { status: 500 });
        }
      } else {
        usersUpdated = upd.data;
      }
    }

    // Prepare user_private upsert (PII): cpf, phone_e164, address fields
    // Detect table existence by attempting a select
    let privateExists = true;
    const probe = await supabase.from("user_private").select("uid").eq("uid", firebaseUid).limit(1);
    if (probe.error) {
      if (/relation .*user_private.* does not exist/i.test(probe.error.message)) {
        privateExists = false;
        (schemaMissing.tables as string[]).push("user_private");
        warnings.push("user_private table missing; skipping sensitive update");
      } else {
        // Other errors
        return NextResponse.json({ error: "private_check_failed", detail: probe.error.message }, { status: 500 });
      }
    }

    let privateUpdated: any = null;
    if (privateExists) {
      const privPatch: Record<string, any> = {};
      if (body.phone !== undefined) {
        const v = normalizePhoneE164(body.phone);
        if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
        privPatch.phone_e164 = v.value;
      }
      if (body.cpf !== undefined) {
        const v = normalizeCPF(body.cpf);
        if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
        // Uniqueness check (best-effort)
        const dup = await supabase.from("user_private").select("uid").eq("cpf", v.value).limit(1).maybeSingle();
        if (!dup.error && dup.data && dup.data.uid !== firebaseUid) {
          return NextResponse.json({ error: "cpf_in_use" }, { status: 409 });
        }
        privPatch.cpf = v.value;
      }
      if (body.address !== undefined && typeof body.address === "object") {
        const a = body.address;
        const street = sanitizeString(a.street);
        const number = sanitizeString(a.number);
        const complement = a.complement === null ? null : sanitizeString(a.complement);
        const neighborhood = sanitizeString(a.neighborhood);
        const city = sanitizeString(a.city);
        let state: string | undefined;
        if (a.state !== undefined) {
          const uv = validateUF(a.state);
          if (!uv.ok) return NextResponse.json({ error: uv.error }, { status: 400 });
          state = uv.value;
        }
        let cep: string | undefined;
        if (a.cep !== undefined) {
          const cv = validateCEP(a.cep);
          if (!cv.ok) return NextResponse.json({ error: cv.error }, { status: 400 });
          cep = cv.value;
        }
        if (street !== undefined) privPatch.address_street = street;
        if (number !== undefined) privPatch.address_number = number;
        if (complement !== undefined) privPatch.address_complement = complement;
        if (neighborhood !== undefined) privPatch.address_neighborhood = neighborhood;
        if (city !== undefined) privPatch.address_city = city;
        if (state !== undefined) privPatch.address_state = state;
        if (cep !== undefined) privPatch.address_cep = cep;
      }

      if (Object.keys(privPatch).length > 0) {
        // Upsert: update if exists, else insert
        const existing = await supabase
          .from("user_private")
          .select("uid")
          .eq("uid", firebaseUid)
          .maybeSingle();
        if (existing.error) {
          return NextResponse.json({ error: "private_fetch_failed", detail: existing.error.message }, { status: 500 });
        }
        if (existing.data) {
          const upd = await supabase
            .from("user_private")
            .update(privPatch)
            .eq("uid", firebaseUid)
            .select("uid, cpf, phone_e164, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_cep")
            .maybeSingle();
          if (upd.error) return NextResponse.json({ error: "private_update_failed", detail: upd.error.message }, { status: 500 });
          privateUpdated = upd.data;
        } else {
          const ins = await supabase
            .from("user_private")
            .insert({ uid: firebaseUid, ...privPatch })
            .select("uid, cpf, phone_e164, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_cep")
            .maybeSingle();
          if (ins.error) return NextResponse.json({ error: "private_insert_failed", detail: ins.error.message }, { status: 500 });
          privateUpdated = ins.data;
        }
      }
    }

    const resp: any = { ok: true };
    if (usersUpdated) {
      resp.user = {
        id: usersUpdated.id,
        firebaseUid: usersUpdated.firebase_uid,
        displayName: usersUpdated.display_name ?? null,
        avatarUrl: usersUpdated.avatar_url ?? null,
        fullName: usersUpdated.full_name ?? null,
        email: usersUpdated.email ?? null,
        onboardingCompleted: Boolean(usersUpdated.onboarding_completed ?? false),
      };
    }
    if (privateUpdated) {
      resp.private = {
        hasCpf: Boolean(privateUpdated.cpf),
        cpf: privateUpdated.cpf ?? null,
        phone: privateUpdated.phone_e164 ?? null,
        street: privateUpdated.address_street ?? null,
        number: privateUpdated.address_number ?? null,
        complement: privateUpdated.address_complement ?? null,
        neighborhood: privateUpdated.address_neighborhood ?? null,
        city: privateUpdated.address_city ?? null,
        state: privateUpdated.address_state ?? null,
        cep: privateUpdated.address_cep ?? null,
      };
    }
    if (warnings.length > 0) resp.warnings = warnings;
    if ((schemaMissing.tables?.length || 0) > 0 || Object.keys(schemaMissing.columns || {}).length > 0) resp.schemaMissing = schemaMissing;

    return NextResponse.json(resp, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server_error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "POST extended profile fields to update-sensitive. Fields: fullName, email, phone, cpf, address{street,number,complement,neighborhood,city,state,cep}." });
}

