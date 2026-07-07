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
    const prs = await fetchUserPRs((session as any).accessToken, repo);
    return NextResponse.json(prs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
