import { NextRequest, NextResponse } from "next/server";
import { enviarAvisosPausa } from "@/lib/supabase/notificaciones";

// Endpoint interno para envío de emails de aviso de pausa.
// Llamado por pg_net desde el cron de Supabase.
// Protegido por CRON_SECRET (header Authorization: Bearer <secret>).
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 500 });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await enviarAvisosPausa();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, enviados: result.enviados });
}
