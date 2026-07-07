"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="text-sm text-gray-500">加载中...</div>;
  }

  if (session) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-700">
          {session.user?.name || session.user?.email}
        </span>
        <button
          onClick={() => signOut()}
          className="text-sm px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 transition"
        >
          退出
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn("github")}
      className="px-4 py-2 rounded bg-gray-900 text-white hover:bg-gray-700 transition"
    >
      使用 GitHub 登录
    </button>
  );
}
