"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  ShoppingCart, 
  Users, 
  AlertCircle, 
  Package, 
  FileText, 
  Truck, 
  Edit3, 
  Megaphone,
  Save,
  Loader2,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, collection, query, where, orderBy, getDoc, addDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { user } = useAuth();
  const { t, lang } = useTranslation();
  const isHQ = user?.role === "HQ";

  // 공지사항 실시간 연동 상태
  const [announcement, setAnnouncement] = useState({
    title: "📢 5월 정기 재고 조사 안내",
    content: "모든 MF 파트너사는 오는 20일까지 현지 창고 재고 현황을 업로드해주시기 바랍니다."
  });
  const [announcementLoading, setAnnouncementLoading] = useState(true);

  // 공지사항 편집 모달 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);



  // 실시간 주문 데이터 바인딩 상태
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Firestore 실시간 공지사항 조회
  useEffect(() => {
    if (!user) return;
    const annRef = doc(db, "config", "announcement");
    const unsubscribe = onSnapshot(annRef, (docSnap) => {
      if (docSnap.exists()) {
        setAnnouncement(docSnap.data() as any);
      } else {
        // 도큐먼트가 없다면 기본값으로 자동 초기화 생성
        setDoc(annRef, {
          title: "📢 5월 정기 재고 조사 안내",
          content: "모든 MF 파트너사는 오는 20일까지 현지 창고 재고 현황을 업로드해주시기 바랍니다.",
          updatedAt: new Date().toISOString(),
          updatedBy: "System"
        });
      }
      setAnnouncementLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Firestore 실시간 주문 조회 (본사는 전체, 파트너사는 본인 소속만)
  useEffect(() => {
    if (!user) return;

    let q;
    if (isHQ) {
      q = query(collection(db, "orders"), orderBy("date", "desc"));
    } else {
      q = query(
        collection(db, "orders"),
        where("partnerId", "==", user.role)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // 파트너사의 경우 date 내림차순 정렬 (where 쿼리 사용 시 복합 색인 우회용)
      if (!isHQ) {
        ordersData.sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));
      }
      setOrders(ordersData);
      setOrdersLoading(false);
    }, (err) => {
      console.error("Error subscribing to orders:", err);
      setOrdersLoading(false);
    });

    return () => unsubscribe();
  }, [user, isHQ]);

  // 공지사항 수정 제출
  const handleSaveAnnouncement = async () => {
    if (!editTitle || !editContent) {
      alert(lang === "KO" ? "제목과 내용을 모두 입력해 주세요." : "Please enter both title and content.");
      return;
    }
    setSavingAnnouncement(true);
    try {
      const annRef = doc(db, "config", "announcement");
      await setDoc(annRef, {
        title: editTitle,
        content: editContent,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || "HQ Admin"
      });
      setIsEditModalOpen(false);
    } catch (e) {
      console.error(e);
      alert((lang === "KO" ? "공지사항 저장 실패: " : "Failed to save announcement: ") + e);
    } finally {
      setSavingAnnouncement(false);
    }
  };

  // 모달 열릴 때 현재 값으로 에디터 폼 바인딩
  const openEditModal = () => {
    setEditTitle(announcement.title);
    setEditContent(announcement.content);
    setIsEditModalOpen(true);
  };

  // ----------------------------------------------------
  // 실시간 통계 계산 (Aggregations)
  // ----------------------------------------------------
  const parseAmount = (amt: any) => {
    if (typeof amt === "number") return amt;
    if (typeof amt === "string") return Number(amt.replace(/[^0-9.-]+/g, ""));
    return 0;
  };

  // 1. 이번 달 총 주문액 (MTD Purchases)
  const currentMonthStr = new Date().toISOString().substring(0, 7); // e.g. "2026-05"
  const mtdOrders = orders.filter(o => o.date && o.date.startsWith(currentMonthStr));
  const totalMTD = mtdOrders.reduce((sum, o) => sum + parseAmount(o.amount || o.totalAmount), 0);

  // 2. 처리 중인 발주 건 (Active Orders) - COMPLETED, DRAFT 제외
  const activeOrders = orders.filter(o => o.status && ["PENDING", "PAYMENT_PENDING", "PREPARING", "SHIPPING", "DELIVERED"].includes(o.status));
  const activeCount = activeOrders.length;

  // 3. 조치 필요 서류 건 (Action Required) - PAYMENT_PENDING 상태 건수
  const actionRequiredOrders = orders.filter(o => o.status === "PAYMENT_PENDING");
  const actionCount = actionRequiredOrders.length;

  // 4. 파트너사 전용: 가장 최근 주문 정보 및 물류 타임라인 계산
  const latestOrder = orders.length > 0 ? orders[0] : null;

  // 5. 파트너사 전용: 최근 업로드된 실제 문서 리스트 추출
  const getRecentDocuments = () => {
    const docList: any[] = [];
    orders.slice(0, 4).forEach(o => {
      if (o.documents) {
        if (o.documents.pi && o.documents.pi.length > 0) {
          docList.push({ name: `Proforma Invoice PI (${o.id})`, date: o.date || "Today", type: "PI", url: o.documents.pi[0] });
        }
        if (o.documents.ttCopy && o.documents.ttCopy.length > 0) {
          docList.push({ name: `T/T Copy Wire Transfer (${o.id})`, date: o.date || "Today", type: "TT", url: o.documents.ttCopy[0] });
        }
        if (o.documents.bankReceipt && o.documents.bankReceipt.length > 0) {
          docList.push({ name: `Bank Receipt (${o.id})`, date: o.date || "Today", type: "BANK", url: o.documents.bankReceipt[0] });
        }
        if (o.documents.bl && o.documents.bl.length > 0) {
          docList.push({ name: `B/L Shipping Document (${o.id})`, date: o.date || "Today", type: "BL", url: o.documents.bl[0] });
        }
        if (o.documents.exportDeclaration && o.documents.exportDeclaration.length > 0) {
          docList.push({ name: `Export Dec (${o.id})`, date: o.date || "Today", type: "ED", url: o.documents.exportDeclaration[0] });
        }
      }
    });
    return docList.slice(0, 3); // 상위 3개만 표출
  };
  const recentDocs = getRecentDocuments();

  // 본사 전용 대시보드
  if (isHQ) {
    // 본사용 활성 파트너 수 추출
    const activePartnersCount = new Set(orders.map(o => o.partnerId)).size;

    return (
      <div className="space-y-6 animate-in fade-in duration-350">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {lang === "KO" ? "본사 통합 대시보드" : "HQ Global Dashboard"} 🌐
            </h2>
            <p className="text-muted-foreground mt-2">
              {lang === "KO" 
                ? "글로벌 프랜차이즈 관리 허브(GFCH)의 실시간 운영 현황입니다." 
                : "Real-time operational status of the Global Franchise Control Hub (GFCH)."}
            </p>
          </div>
        </div>
        
        {/* 실시간 Aggregations 카드 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-primary/5 border-primary/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-primary">
                {lang === "KO" ? "이번 달 총 주문액" : "Total MTD Orders"}
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black font-mono">${totalMTD.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "KO" ? `${currentMonthStr}월 누적 수집 데이터` : `Live aggregate for ${currentMonthStr}`}
              </p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {lang === "KO" ? "활성 파트너사" : "Active Partners"}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activePartnersCount || 2}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "KO" ? "거래 발생 마스터 프랜차이즈" : "Registered MFs with transactions"}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {lang === "KO" ? "신규 발주 건수" : "New Order Requests"}
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">
                {orders.filter(o => o.status === "PENDING").length}{lang === "KO" ? "건" : ""}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "KO" ? "본사 승인 대기 중인 발주" : "Orders awaiting HQ approval"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-red-600">
                {lang === "KO" ? "미결제/미승인 건" : "Unpaid/Unapproved Orders"}
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 font-mono">{activeCount}{lang === "KO" ? "건" : ""}</div>
              <p className="text-xs text-red-400 font-medium italic mt-1">
                {lang === "KO" ? "진행 중인 활성 트랜잭션" : "Active transactions in progress"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          {/* 최근 통합 활동 */}
          <Card className="col-span-4 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">
                {lang === "KO" ? "최근 통합 활동" : "Recent Global Activity"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                {ordersLoading ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : orders.length > 0 ? (
                  orders.slice(0, 5).map((o, idx) => (
                    <div key={idx} className="flex items-center gap-4 border-b pb-3 last:border-0 hover:bg-muted/5 p-1.5 rounded transition-colors">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        {o.status === "PENDING" ? <ShoppingCart className="h-4 w-4 text-amber-600" /> : o.status === "PAYMENT_PENDING" ? <FileText className="h-4 w-4 text-blue-600" /> : <Truck className="h-4 w-4 text-indigo-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {lang === "KO" 
                            ? `${o.mf || "파트너"} - 발주 번호 [${o.id}] 상태: ${o.status}` 
                            : `${o.mf || "Partner"} - Order [${o.id}] Status: ${o.status}`}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{o.date} | {o.amount}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-mono shrink-0">{o.status}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-10">
                    {lang === "KO" ? "최근 거래 데이터가 없습니다." : "No recent transaction data available."}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 📢 본사 공지사항 카드 (실시간 연동 & 수정 기능 탑재) */}
          <Card className="col-span-3 bg-muted/20 border border-primary/10 relative overflow-hidden flex flex-col justify-between shadow-sm">
            <div>
              <CardHeader className="flex flex-row items-center justify-between pb-3 bg-muted/30">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                  <Megaphone className="w-4 h-4 text-primary animate-pulse" />
                  {lang === "KO" ? "관리자 공지" : "Admin Notice"}
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                  onClick={openEditModal}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {announcementLoading ? (
                  <div className="flex items-center justify-center h-20"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                ) : (
                  <>
                    <p className="font-extrabold text-slate-800 text-sm leading-snug">{announcement.title}</p>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{announcement.content}</p>
                  </>
                )}
              </CardContent>
            </div>
          </Card>
        </div>

        {/* 🔒 공지사항 편집 모달 */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <Edit3 className="w-5 h-5 text-primary" />
                {lang === "KO" ? "관리자 공지 수정" : "Edit Admin Notice"}
              </DialogTitle>
              <DialogDescription>
                {lang === "KO" 
                  ? "모든 MF 파트너사의 메인 대시보드에 실시간으로 표시될 공지 사항을 입력하세요." 
                  : "Enter the announcement that will be displayed in real-time on all MF partner dashboards."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="ann-title">{lang === "KO" ? "공지 제목" : "Notice Title"}</Label>
                <Input 
                  id="ann-title" 
                  value={editTitle} 
                  onChange={(e) => setEditTitle(e.target.value)} 
                  placeholder={lang === "KO" ? "📢 공지 제목 입력..." : "📢 Enter title..."} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ann-content">{lang === "KO" ? "공지 내용" : "Notice Content"}</Label>
                <textarea 
                  id="ann-content" 
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={editContent} 
                  onChange={(e) => setEditContent(e.target.value)} 
                  placeholder={lang === "KO" ? "모든 MF 파트너사는..." : "All MF partners must..."}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                {lang === "KO" ? "취소" : "Cancel"}
              </Button>
              <Button onClick={handleSaveAnnouncement} disabled={savingAnnouncement} className="flex items-center gap-2">
                {savingAnnouncement ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {lang === "KO" ? "저장하기" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ----------------------------------------------------
  // MF 파트너 전용 대시보드 뷰
  // ----------------------------------------------------
  return (
    <div className="space-y-6 animate-in fade-in duration-350">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">
            {user?.name}{lang === "KO" ? "님, 환영합니다!" : ", Welcome back!"} 👋
          </h2>
          <p className="text-muted-foreground mt-2">
            {lang === "KO" ? "오늘의 비즈니스 현황을 요약해 드립니다." : "Here is a summary of today's business activities."}
          </p>
        </div>
        <div className="text-right">
          <Badge variant="outline" className="mb-1 border-blue-200 bg-blue-50/50 text-blue-800 font-semibold">
            {user?.partnerCode} Partner
          </Badge>
          <p className="text-[10px] text-muted-foreground italic">
            {lang === "KO" ? "동기화 시간: 방금 전" : "Last Sync: Just now"}
          </p>
        </div>
      </div>

      {/* 📢 파트너 전용 실시간 공지사항 배너 */}
      <Card className="bg-primary/5 border border-primary/20 overflow-hidden shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 p-4 items-start md:items-center">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Megaphone className="w-5 h-5 animate-bounce" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="font-extrabold text-sm text-primary flex items-center gap-2">
              {lang === "KO" ? "본사 공지사항" : "HQ Official Notice"}
              <Badge variant="secondary" className="text-[9px] h-4 px-1 font-semibold uppercase">
                {announcementLoading ? (lang === "KO" ? "로드 중..." : "Loading...") : (lang === "KO" ? "최신" : "New")}
              </Badge>
            </p>
            {announcementLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800">{announcement.title}</p>
                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{announcement.content}</p>
              </div>
            )}
          </div>
        </div>
      </Card>


      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("totalOrders")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-3xl font-extrabold font-mono text-slate-800">${totalMTD.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "KO" ? "이번 달 실제 누적 발주 금액" : "Accumulated purchase amount for this month"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("processingOrders")}
            </CardTitle>
            <Package className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-3xl font-extrabold font-mono text-slate-800">{activeCount}{lang === "KO" ? "건" : ""}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "KO" ? "현재 처리 진행 중인 활성 발주" : "Active order requests in progress"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-sm bg-red-50/20 hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-red-600">
              {t("pendingDocs")}
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-3xl font-extrabold font-mono text-red-600">{actionCount}{lang === "KO" ? "건" : ""}</div>
                <p className="text-xs text-red-400 mt-1 font-medium italic">
                  {lang === "KO" ? "송금 및 T/T Copy 제출 대기" : "Awaiting T/T Wire Copy"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 실시간 물류 추적 패널 (가장 최근 발주 건 추적) */}
        <Card className="shadow-sm">
          <CardHeader className="border-b bg-muted/10">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Truck className="w-4 h-4 text-primary" /> 
              {t("shippingTrack")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {ordersLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : latestOrder ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded border mb-2">
                  <span className="text-xs font-mono font-bold text-slate-600">PO: {latestOrder.id}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{latestOrder.status}</Badge>
                </div>
                
                {/* 동적 실시간 단계 타임라인 */}
                <div className="space-y-4">
                  <div className="relative pl-6 border-l-2 border-primary pb-1">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-white flex items-center justify-center" />
                    <p className="text-xs font-bold text-foreground">
                      {lang === "KO" ? "발주 접수 및 검토 단계" : "Order Placed & HQ Review"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{latestOrder.date} | PO Created</p>
                  </div>

                  <div className={cn(
                    "relative pl-6 border-l-2 pb-1",
                    latestOrder.status !== "PENDING" ? "border-primary" : "border-muted opacity-50"
                  )}>
                    <div className={cn(
                      "absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-white",
                      latestOrder.status !== "PENDING" ? "bg-primary" : "bg-muted"
                    )} />
                    <p className="text-xs font-bold text-foreground">
                      {lang === "KO" ? "Proforma Invoice (PI) 발행 및 승인" : "Proforma Invoice (PI) Issued"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {latestOrder.status === "PENDING" 
                        ? (lang === "KO" ? "대기 중" : "Awaiting HQ check") 
                        : (lang === "KO" ? "본사 PI 확인 단계" : "Awaiting Wire Transfer")}
                    </p>
                  </div>

                  <div className={cn(
                    "relative pl-6 border-l-2 pb-1",
                    ["PREPARING", "SHIPPING", "DELIVERED", "COMPLETED"].includes(latestOrder.status) ? "border-primary" : "border-muted opacity-50"
                  )}>
                    <div className={cn(
                      "absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-white",
                      ["PREPARING", "SHIPPING", "DELIVERED", "COMPLETED"].includes(latestOrder.status) ? "bg-primary" : "bg-muted"
                    )} />
                    <p className="text-xs font-bold text-foreground">
                      {lang === "KO" ? "선적 선박 수배 및 출항" : "Shipping Logistics & Departure"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {["SHIPPING", "DELIVERED", "COMPLETED"].includes(latestOrder.status)
                        ? (lang === "KO" ? "선적 완료 (In Transit)" : "In Transit / Shipped")
                        : (lang === "KO" ? "준비 대기" : "Awaiting preparation")}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic text-center py-10">
                {lang === "KO" ? "진행 중인 물류 배송 내역이 없습니다." : "No active shipping logs available."}
              </p>
            )}
            <Link href="/orders/history" className="block text-center mt-6 text-xs text-primary font-bold hover:underline">
              {lang === "KO" ? "전체 물류 내역 보기 →" : "View Full Logistics History →"}
            </Link>
          </CardContent>
        </Card>

        {/* 최신 문서함 패널 (실제 업로드된 문서들 동적 조회) */}
        <Card className="shadow-sm">
          <CardHeader className="border-b bg-muted/10">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-primary" /> 
              {t("latestDocs")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {ordersLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : recentDocs.length > 0 ? (
                recentDocs.map((doc, idx) => (
                  <a 
                    key={idx}
                    href={doc.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    <div className="pr-4 min-w-0">
                      <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {doc.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">{doc.date}</p>
                    </div>
                    <Badge variant="secondary" className="text-[9px] shrink-0 font-mono flex items-center gap-1">
                      {doc.type} <ExternalLink className="w-2.5 h-2.5" />
                    </Badge>
                  </a>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-10">
                  {lang === "KO" ? "제출되거나 발행된 문서가 없습니다." : "No documents available yet."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
