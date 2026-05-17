"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { Loader2 } from "lucide-react";

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== "/login") {
        router.replace("/login");
      } else if (user && pathname === "/login") {
        router.replace("/");
      }
    }
  }, [user, loading, pathname, router]);

  // 로딩 상태 (세션 확인 중)
  if (loading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-xs text-slate-400 font-mono tracking-widest">LOADING SESSION...</p>
      </div>
    );
  }

  // 1. 비로그인 유저가 로그인 페이지에 있는 경우: 풀 스크린 렌더링
  if (!user && pathname === "/login") {
    return <>{children}</>;
  }

  // 2. 비로그인 유저가 보호된 경로에 있는 경우: 리다이렉트 전 빈 로딩 화면
  if (!user) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-xs text-slate-400 font-mono tracking-widest font-bold">REDIRECTING TO SIGN IN...</p>
      </div>
    );
  }

  // 3. 로그인된 유저가 로그인 페이지에 머무르는 경우: 대시보드로 가기 전 대기 화면
  if (pathname === "/login") {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-xs text-slate-400 font-mono tracking-widest font-bold">LOADING DASHBOARD...</p>
      </div>
    );
  }

  // 4. 로그인된 유저가 보호된 페이지를 조회하는 경우: 전체 프레임 레이아웃 렌더링
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-muted/10 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
