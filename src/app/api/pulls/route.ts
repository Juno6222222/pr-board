import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchUserPRs } from "@/lib/github";

export async function GET() {
  const session = await auth();

  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = process.env.TARGET_REPO || "autokernel-sz/kerwork";

  try {
    // Debug: check token scope
    const debugRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${(session as any).accessToken}` },
    });
    const scopes = debugRes.headers.get("x-oauth-scopes");
    console.log("[api/pulls] Token scopes:", scopes);
    console.log("[api/pulls] User status:", debugRes.status);
    
    const prs = await fetchUserPRs((session as any).accessToken, repo);
    return NextResponse.json(prs);
  } catch (error: any) {
    console.error("[api/pulls] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
