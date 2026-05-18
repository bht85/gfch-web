"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, Mail, User, ShieldAlert, Globe, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const { user, loading, login, signup } = useAuth();
  const { lang, setLang } = useTranslation();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // 이미 로그인된 상태라면 메인 대시보드로 이동
  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setErrorMsg("");
    setSuccessMsg("");
    setActionLoading(true);

    try {
      await login(email, password);
      router.push("/");
    } catch (err: any) {
      console.error(err);
      let msg = "";
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        msg = lang === "KO" 
          ? "비밀번호가 틀렸거나 등록되지 않은 이메일입니다. 다시 확인해 주세요!" 
          : "Incorrect password or unregistered email. Please check and try again!";
      } else {
        msg = lang === "KO" 
          ? "로그인 중 에러가 발생했습니다. 이메일과 비밀번호를 확인해 주세요." 
          : "An error occurred during login. Please check your credentials.";
      }
      setErrorMsg(msg);
      alert(msg); // 🚨 Direct browser alert popup for clear notification
    } finally {
      setActionLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) return;
    setErrorMsg("");
    setSuccessMsg("");
    setActionLoading(true);

    try {
      await signup(email, password, name);
      setSuccessMsg(lang === "KO" ? "회원가입이 완료되었습니다! 자동으로 로그인합니다..." : "Registration successful! Logging in...");
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (err: any) {
      console.error(err);
      if (err.message === "NOT_INVITED") {
        setErrorMsg(lang === "KO" ? "본사로부터 가입 사전 승인(초대)을 받지 않은 이메일입니다. 본사 담당자에게 가입 허용을 요청해 주세요." : "This email has not been pre-authorized by HQ. Please request access from the HQ Admin.");
      } else if (err.code === "auth/email-already-in-use") {
        setErrorMsg(lang === "KO" ? "이미 가입되어 사용 중인 이메일 주소입니다." : "This email address is already in use.");
      } else if (err.code === "auth/weak-password") {
        setErrorMsg(lang === "KO" ? "비밀번호는 최소 6자 이상이어야 합니다." : "Password should be at least 6 characters.");
      } else {
        setErrorMsg(lang === "KO" ? "회원가입 중 에러가 발생했습니다." : "An error occurred during registration.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-xs text-slate-400 font-mono tracking-widest">LOADING SESSION...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen flex flex-col md:flex-row bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* 백그라운드 디자인 그리드 & 글로우 */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35" />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[150px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[150px] rounded-full" />

      {/* 왼쪽: 브랜드 및 플랫폼 소개 */}
      <div className="hidden md:flex flex-col justify-between p-12 md:w-1/2 relative z-10 border-r border-slate-900">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <span className="font-extrabold text-xl tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            GFCH PLATFORM
          </span>
        </div>

        <div className="space-y-6 max-w-lg">
          <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/10 px-3 py-1 text-xs">
            Global Franchise Control Hub
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black leading-tight tracking-tight text-white">
            Secure & Unified Operations for <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400">Global Franchise</span> partners
          </h1>
          <p className="text-slate-400 leading-relaxed text-sm">
            {lang === "KO" ? (
              <>
                본사 관리자와 마스터 프랜차이즈 파트너 간의 투명하고 안전한<br />
                주문, 정산을 제공 하는 플랫폼입니다.
              </>
            ) : (
              <>
                A unified platform providing secure and transparent<br />
                order placement and settlement for HQ and MF partners.
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="font-mono">composecoffee © 2026</span>
          <span>•</span>
          <span className="hover:text-slate-400 cursor-pointer transition-colors" onClick={() => setLang(lang === "KO" ? "EN" : "KO")}>
            {lang === "KO" ? "English Version" : "한국어 버전"}
          </span>
        </div>
      </div>

      {/* 오른쪽: 인증 폼 */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        {/* 모바일 화면용 로고 */}
        <div className="flex md:hidden items-center gap-3 mb-8">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-md tracking-wider">GFCH</span>
        </div>

        <Card className="w-full max-w-md border-slate-900 bg-slate-950/70 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          {/* 가디언 디자인 라인 */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center tracking-tight text-white">
              {activeTab === "login" ? (lang === "KO" ? "플랫폼 로그인" : "Sign In to GFCH") : (lang === "KO" ? "회원가입 신청" : "Register Account")}
            </CardTitle>
            <CardDescription className="text-center text-slate-400 text-xs">
              {activeTab === "login"
                ? (lang === "KO" ? "가입된 이메일과 비밀번호를 입력해 주세요." : "Enter your credentials to access your account.")
                : (lang === "KO" ? "본사에서 사전 승인받은 이메일로 가입을 진행하세요." : "Use your pre-authorized email address to register.")
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* 탭 전환기 */}
            <div className="grid grid-cols-2 bg-slate-900/60 p-1 rounded-lg border border-slate-800/80 mb-2">
              <button
                type="button"
                onClick={() => { setActiveTab("login"); setErrorMsg(""); setSuccessMsg(""); }}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                  activeTab === "login" ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {lang === "KO" ? "로그인" : "Sign In"}
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("signup"); setErrorMsg(""); setSuccessMsg(""); }}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                  activeTab === "signup" ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {lang === "KO" ? "회원가입" : "Sign Up"}
              </button>
            </div>

            {/* 에러 메시지 */}
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* 성공 메시지 */}
            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-lg flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 animate-bounce" />
                <span className="leading-relaxed">{successMsg}</span>
              </div>
            )}

            {/* 실제 폼 */}
            {activeTab === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300 text-xs font-medium">{lang === "KO" ? "이메일" : "Email Address"}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="email@example.com"
                      className="pl-10 bg-slate-900/40 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-blue-500"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300 text-xs font-medium">{lang === "KO" ? "비밀번호" : "Password"}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10 bg-slate-900/40 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-blue-500"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" disabled={actionLoading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white mt-2">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {lang === "KO" ? "로그인 완료" : "Sign In"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300 text-xs font-medium">{lang === "KO" ? "이름 / 담당자명" : "Your Name"}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      className="pl-10 bg-slate-900/40 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-blue-500"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-signup" className="text-slate-300 text-xs font-medium">{lang === "KO" ? "이메일 (사전 승인 이메일 필수)" : "Pre-approved Email"}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      id="email-signup"
                      type="email"
                      placeholder="partner@gfch.com"
                      className="pl-10 bg-slate-900/40 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-blue-500"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-signup" className="text-slate-300 text-xs font-medium">{lang === "KO" ? "비밀번호 설정" : "Password (min. 6 chars)"}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      id="password-signup"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10 bg-slate-900/40 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-blue-500"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" disabled={actionLoading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white mt-2">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {lang === "KO" ? "회원가입 신청" : "Register Now"}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-2 pt-4 border-t border-slate-900 bg-slate-950/30">
            <p className="text-[10.5px] text-center text-slate-300 font-medium max-w-xs leading-relaxed">
              {lang === "KO" ? (
                <>
                  본사는 모든 마스터 프랜차이즈 파트너의 비즈니스 안정성을 위해<br />
                  사전에 합의된 계정 이메일 등록만 승인하고 있습니다.
                </>
              ) : (
                "For security, registration is only permitted for emails invited in advance by composecoffee HQ."
              )}
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

// 간단한 Badge 컴포넌트 추가
function Badge({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
