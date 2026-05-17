"use client";

import { Search, UserCircle, LogOut, ShieldCheck, Globe, Languages } from 'lucide-react';
import { NotificationCenter } from './notification-center';
import { useAuth, UserRole } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';

export function Header() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useTranslation();

  return (
    <header className="h-16 border-b flex items-center justify-between px-6 bg-background">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md hidden md:flex items-center">
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder={lang === "KO" ? "PO 번호, 업체명 검색..." : "Search PO, Partner..."}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        {/* 언어 토글 버튼 */}
        <div className="flex items-center bg-muted/50 rounded-full p-1 border">
          <button 
            onClick={() => setLang("KO")}
            className={cn("px-3 py-1 rounded-full text-[10px] font-bold transition-all", lang === "KO" ? "bg-white shadow-sm text-primary" : "text-muted-foreground")}
          >KR</button>
          <button 
            onClick={() => setLang("EN")}
            className={cn("px-3 py-1 rounded-full text-[10px] font-bold transition-all", lang === "EN" ? "bg-white shadow-sm text-primary" : "text-muted-foreground")}
          >EN</button>
        </div>

        <NotificationCenter />
        
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none ml-2">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold">{user?.name || "Login Required"}</p>
              <p className="text-[10px] text-muted-foreground">{user?.role === "HQ" ? (lang === "KO" ? "본사 관리자" : "HQ Admin") : (lang === "KO" ? "MF 파트너" : "MF Partner")}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-sm">
              <UserCircle className="h-6 w-6" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{lang === "KO" ? "내 계정 정보" : "My Account"}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">{user?.name}</p>
              <p>{user?.email}</p>
              {user?.partnerCode && <p className="mt-1 font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded w-max">{user.partnerCode}</p>}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600 cursor-pointer" onClick={() => logout()}>
              <LogOut className="w-4 h-4 mr-2" /> {lang === "KO" ? "로그아웃" : "Sign Out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
