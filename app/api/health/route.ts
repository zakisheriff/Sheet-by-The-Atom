import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function configured(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export async function GET() {
  const checks = {
    app: true,
    database: configured(process.env.DATABASE_URL),
    nextAuthUrl: configured(process.env.NEXTAUTH_URL),
    nextAuthSecret: configured(process.env.NEXTAUTH_SECRET),
    googleClientId: configured(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
    collaborationServer: configured(process.env.NEXT_PUBLIC_YJS_WEBSOCKET_URL)
  };
  const ready = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString()
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
