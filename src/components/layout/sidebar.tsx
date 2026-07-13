"use client";

import Link from 'next/link';
import { Home, Users, ShoppingCart, DollarSign, FileText, Settings, ChevronDown, ChevronRight, Package, Tag, ClipboardList, Building2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';

export function Sidebar() {
  const [isOrdersOpen, setIsOrdersOpen] = useState(true);
  const { user } = useAuth();
  const { t, lang } = useTranslation();
  const isHQ = user?.role === "HQ";

  return (
    <aside className="w-64 border-r bg-muted/20 hidden md:flex flex-col h-full transition-all duration-300">
      <div className="h-16 flex items-center border-b px-6">
        <h1 className="font-bold text-xl tracking-tight text-primary">GFCH</h1>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          <li>
            <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:text-primary hover:bg-muted transition-all">
              <Home className="h-5 w-5" />
              <span className="font-medium">{t("dashboard")}</span>
            </Link>
          </li>
          
          {isHQ && (
            <li>
              <Link href="/partners" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:text-primary hover:bg-muted transition-all">
                <Users className="h-5 w-5" />
                <span className="font-medium">{t("partners")}</span>
              </Link>
            </li>
          )}

          {/* 🪙 로열티 정산 센터 (본사 & 파트너 공통 메뉴) */}
          <li>
            <Link href="/royalty" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:text-primary hover:bg-muted transition-all">
              <ClipboardList className="h-5 w-5 text-indigo-500" />
              <span className="font-medium">{t("royalty")}</span>
            </Link>
          </li>

          <li>
            <button 
              onClick={() => setIsOrdersOpen(!isOrdersOpen)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-muted-foreground hover:text-primary hover:bg-muted transition-all"
            >
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5" />
                <span className="font-medium">{t("orders")}</span>
              </div>
              {isOrdersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            
            {isOrdersOpen && (
              <ul className="mt-1 ml-4 space-y-1 border-l pl-4">
                {/* 파트너용 메뉴 */}
                {!isHQ && (
                  <>
                    <li><Link href="/orders/create" className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted">{t("placeOrder")}</Link></li>
                    <li><Link href="/orders/history" className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted">{t("myOrders")}</Link></li>
                    <li><Link href="/orders/ledger" className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted">{t("myLedger")}</Link></li>
                  </>
                )}
                
                {/* 본사용 메뉴 */}
                {isHQ && (
                  <>
                    <li><Link href="/orders" className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted">{t("integratedOrderBoard")}</Link></li>
                    <li><Link href="/orders/finance" className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted">{t("finance")}</Link></li>
                    <li><Link href="/orders/shipping" className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted">{t("shipping")}</Link></li>
                    <li><Link href="/orders/products" className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted">{t("products")}</Link></li>
                    <li><Link href="/orders/pricing" className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted">{t("pricing")}</Link></li>
                    <li><Link href="/orders/billing" className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted">{lang === "KO" ? "매출/매입 대장" : "Sales & Cost Ledger"}</Link></li>
                  </>
                )}
              </ul>
            )}
          </li>

          {isHQ && (
            <>
              <li>
                <Link href="/store-openings" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:text-primary hover:bg-muted transition-all">
                  <Building2 className="h-5 w-5 text-violet-500" />
                  <span className="font-medium">{lang === "KO" ? "매장 오픈 관리" : "Store Openings"}</span>
                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 shrink-0">개발중</span>
                </Link>
              </li>
              <li>
                <Link href="/sales" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:text-primary hover:bg-muted transition-all">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                  <span className="font-medium">{lang === "KO" ? "MF별 손익 분석" : "MF P&L Analysis"}</span>
                </Link>
              </li>
              <li>
                <Link href="/documents" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:text-primary hover:bg-muted transition-all">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">{t("documents")}</span>
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
      
      <div className="p-4 border-t">
        <Link href="/settings" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:text-primary hover:bg-muted transition-all">
          <Settings className="h-5 w-5" />
          <span className="font-medium text-sm">{t("settings")}</span>
        </Link>
      </div>
    </aside>
  );
}
