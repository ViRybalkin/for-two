import { NextResponse } from "next/server";
import { getIntegrationStatus } from "@/lib/integration-config";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "na-dvoih",
    time: new Date().toISOString(),
    integrations: getIntegrationStatus()
  });
}
