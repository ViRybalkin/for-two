import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ok: true, service: "na-dvoih", time: new Date().toISOString() });
}
