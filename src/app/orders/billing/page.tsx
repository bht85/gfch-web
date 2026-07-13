"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Loader2, DollarSign, Calendar, Search, Eye, Coins, Scale, FileText, ArrowLeft, Download
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SalesCostLedgerPage() {
  const { user, loading: authLoading } = useAuth();
  const { lang, t } = useTranslation();
  const router = useRouter();

  const [orders, setOrders] = useState<any[]>([]);
  const [dbPartners, setDbPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [systemExchangeRate, setSystemExchangeRate] = useState(1340);

  // 필터 상태
  const [selectedPartnerId, setSelectedPartnerId] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  // HQ 전용 페이지 접근 제어
  useEffect(() => {
    if (!authLoading && user && user.role !== "HQ") {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Firestore 데이터 바인딩
  useEffect(() => {
    const qOrders = query(collection(db, "orders"), orderBy("date", "desc"));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const qPartners = query(collection(db, "partners"), orderBy("name", "asc"));
    const unsubPartners = onSnapshot(qPartners, (snapshot) => {
      setDbPartners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubRate = onSnapshot(doc(db, "system", "config"), (docSnap: any) => {
      if (docSnap.exists()) {
        const rate = docSnap.data().exchangeRate || 1340;
        setSystemExchangeRate(Number(rate));
      }
    });

    return () => {
      unsubOrders();
      unsubPartners();
      unsubRate();
    };
  }, []);

  const parseAmount = (amt: any) => {
    if (typeof amt === "number") return amt;
    if (typeof amt === "string") return Number(amt.replace(/[^0-9.-]+/g, ""));
    return 0;
  };

  // HQ 기준 매출 원가 (매입액) 계산
  const calculateOrderCost = (order: any) => {
    if (order.items && Array.isArray(order.items)) {
      return order.items.reduce((sum: number, item: any) => {
        const itemCost = item.cost !== undefined ? item.cost : (item.price * 0.7);
        return sum + (itemCost * (item.qty || 0));
      }, 0);
    }
    const revenue = typeof order.totalAmount === "number" ? order.totalAmount : parseAmount(order.amount);
    return revenue * 0.7; // 폴백
  };

  // 엑셀(CSV) 다운로드 기능
  const exportToExcel = () => {
    const BOM = "\uFEFF";
    const headers = [
      lang === "KO" ? "MF 파트너" : "Partner",
      lang === "KO" ? "발주 번호" : "PO Number",
      lang === "KO" ? "일자" : "Date",
      lang === "KO" ? "진행 단계" : "Stage",
      lang === "KO" ? "결제 상태" : "Payment Status",
      lang === "KO" ? "매출액 (USD)" : "Revenue (USD)",
      lang === "KO" ? "매입액 (USD)" : "Cost (USD)",
      lang === "KO" ? "매입액 (KRW)" : "Cost (KRW)",
      lang === "KO" ? "마진액 (USD)" : "Margin (USD)",
      lang === "KO" ? "마진율 (%)" : "Margin Rate (%)"
    ];

    const rows = filteredOrders.map(order => {
      const sales = typeof order.totalAmount === "number" ? order.totalAmount : parseAmount(order.amount);
      const cost = calculateOrderCost(order);
      const costKrw = cost * systemExchangeRate;
      const margin = sales - cost;
      const rate = sales > 0 ? (margin / sales) * 100 : 0;

      return [
        `"${order.partnerName || 'MF Partner'}"`,
        `"${order.id}"`,
        `"${order.date}"`,
        `"${order.status}"`,
        `"${order.paymentStatus}"`,
        sales.toFixed(2),
        cost.toFixed(2),
        Math.round(costKrw),
        margin.toFixed(2),
        `${rate.toFixed(1)}%`
      ];
    });

    const totalSales = filteredOrders.reduce((sum, order) => sum + (typeof order.totalAmount === "number" ? order.totalAmount : parseAmount(order.amount)), 0);
    const totalCost = filteredOrders.reduce((sum, order) => sum + calculateOrderCost(order), 0);
    const totalMargin = totalSales - totalCost;
    const avgMarginRate = totalSales > 0 ? (totalMargin / totalSales) * 100 : 0;

    rows.push([
      `"${lang === 'KO' ? '합계' : 'TOTAL'}"`,
      `""`,
      `""`,
      `""`,
      `""`,
      totalSales.toFixed(2),
      totalCost.toFixed(2),
      Math.round(totalCost * systemExchangeRate),
      totalMargin.toFixed(2),
      `${avgMarginRate.toFixed(1)}%`
    ]);

    const csvContent = BOM + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Sales_Cost_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 필터링 적용된 발주 목록
  const filteredOrders = orders.filter(order => {
    // 1. 날짜 범위 필터
    const matchDate = order.date >= startDate && order.date <= endDate;
    
    // 2. 파트너사 필터
    const matchPartner = selectedPartnerId === "ALL" || order.partnerId === selectedPartnerId;
    
    // 3. 검색어 필터 (발주 번호 또는 품목명 포함 여부)
    const normalizedQuery = searchQuery.toLowerCase().trim();
    const matchSearch = !normalizedQuery || 
      order.id.toLowerCase().includes(normalizedQuery) ||
      (order.items && order.items.some((item: any) => item.name.toLowerCase().includes(normalizedQuery)));

    return matchDate && matchPartner && matchSearch;
  });

  // 집계치 계산
  const totalSales = filteredOrders.reduce((sum, order) => {
    const revenue = typeof order.totalAmount === "number" ? order.totalAmount : parseAmount(order.amount);
    return sum + revenue;
  }, 0);

  const totalCost = filteredOrders.reduce((sum, order) => sum + calculateOrderCost(order), 0);
  const totalMargin = totalSales - totalCost;
  const marginRate = totalSales > 0 ? (totalMargin / totalSales) * 100 : 0;

  if (authLoading || (user && user.role !== "HQ")) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground font-medium">세션 확인 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {lang === "KO" ? "글로벌 매출/매입 대장" : "Global Sales & Cost Ledger"} 📊
          </h2>
          <p className="text-muted-foreground mt-2">
            {lang === "KO" 
              ? "마스터 프랜차이즈(MF)별 발주 기준으로 매출(공급가), 매입(본사 원가), 그리고 마진을 실시간으로 분석합니다." 
              : "Analyze revenue (supply price), cost (HQ cost), and margin for global partners by PO number in real-time."}
          </p>
        </div>
      </div>

      {/* 종합 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
              {lang === "KO" ? "총 매출액 (공급가 합계)" : "Total Revenue (Sales)"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-blue-600">
              ${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {lang === "KO" ? "파트너사 주문 결제 금액" : "Cumulative partner purchase orders"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
              {lang === "KO" ? "총 매입액 (본사 원가 합계)" : "Total Purchase Cost"}
            </CardTitle>
            <Coins className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-rose-600">
              ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-rose-700 font-bold mt-1">
              ₩{Math.round(totalCost * systemExchangeRate).toLocaleString()} ({lang === "KO" ? `적용 환율: ${systemExchangeRate}원` : `Rate: ₩${systemExchangeRate}`})
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
              {lang === "KO" ? "총 마진액 (본사 수익)" : "Total HQ Margin"}
            </CardTitle>
            <Scale className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-emerald-600">
              ${totalMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {lang === "KO" ? "매출액 - 원가 마진액" : "Revenue minus logistics costs"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500 bg-violet-50/5 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-extrabold text-violet-800 uppercase">
              {lang === "KO" ? "평균 마진율" : "Average Margin Rate"}
            </CardTitle>
            <Coins className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-violet-600">
              {marginRate.toFixed(2)}%
            </div>
            <p className="text-[10px] text-violet-600 font-bold mt-1">
              {lang === "KO" ? "총 매출액 대비 마진액 비중" : "HQ gross margin percentage"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center bg-white p-4 rounded-xl border shadow-sm">
        {/* 파트너사 선택 */}
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-slate-50 w-full lg:w-max h-10">
          <label className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">Partner</label>
          <select 
            className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer w-full lg:w-40"
            value={selectedPartnerId}
            onChange={(e) => setSelectedPartnerId(e.target.value)}
          >
            <option value="ALL">{lang === "KO" ? "전체 파트너사" : "All Partners"}</option>
            {dbPartners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* 날짜 범위 */}
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-slate-50 w-full lg:w-max h-10">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input 
            type="date" 
            className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-xs text-muted-foreground font-bold">~</span>
          <input 
            type="date" 
            className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* 발주 번호 및 품목 검색 */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={lang === "KO" ? "발주 번호(PO), 품목명 검색..." : "Search PO, Product..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 text-xs"
          />
        </div>

        {/* 엑셀 다운로드 버튼 */}
        <Button 
          onClick={exportToExcel}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-4 text-xs gap-1.5 flex items-center shrink-0 w-full lg:w-auto"
        >
          <Download className="w-4 h-4" />
          {lang === "KO" ? "엑셀 다운로드" : "Excel Download"}
        </Button>
      </div>

      {/* 테이블 대장 */}
      <div className="rounded-md border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[120px]">{lang === "KO" ? "MF 파트너" : "Partner"}</TableHead>
              <TableHead className="w-[180px]">{lang === "KO" ? "발주 번호 (PO)" : "PO Number"}</TableHead>
              <TableHead>{lang === "KO" ? "일자" : "Date"}</TableHead>
              <TableHead className="text-right text-blue-700">{lang === "KO" ? "매출액 (공급가)" : "Revenue"}</TableHead>
              <TableHead className="text-right text-rose-600">{lang === "KO" ? "매입액 (원화/달러)" : "Purchase (Cost)"}</TableHead>
              <TableHead className="text-right text-emerald-700 font-bold">{lang === "KO" ? "마진 (당사수익)" : "Margin"}</TableHead>
              <TableHead className="text-center">{lang === "KO" ? "마진율" : "Margin %"}</TableHead>
              <TableHead className="text-center">{lang === "KO" ? "진행 단계" : "Stage"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-64 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : filteredOrders.map((order) => {
              const sales = typeof order.totalAmount === "number" ? order.totalAmount : parseAmount(order.amount);
              const cost = calculateOrderCost(order);
              const margin = sales - cost;
              const rate = sales > 0 ? (margin / sales) * 100 : 0;

              return (
                <TableRow key={order.id} className="hover:bg-muted/10">
                  <TableCell className="font-bold text-slate-800 text-xs truncate max-w-[120px]" title={order.partnerName}>
                    {order.partnerName || "MF Partner"}
                  </TableCell>
                  <TableCell>
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      className="font-mono text-xs font-bold text-blue-600 hover:underline hover:text-blue-800 flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      {order.id}
                    </button>
                  </TableCell>
                  <TableCell className="text-slate-500 font-mono text-xs">{order.date}</TableCell>
                  <TableCell className="text-right font-bold text-blue-600 font-mono text-xs">
                    ${sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-medium text-rose-500 font-mono text-xs leading-tight">
                    <div>${cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="text-[10px] text-rose-455 font-semibold mt-0.5">₩{Math.round(cost * systemExchangeRate).toLocaleString()}</div>
                  </TableCell>
                  <TableCell className="text-right font-black text-emerald-600 font-mono text-xs">
                    ${margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-center font-bold text-slate-700 font-mono text-xs">
                    {rate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5",
                        order.status === "COMPLETED" ? "bg-green-50 text-green-700 border-green-200" :
                        order.status === "DELIVERED" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                        order.status === "SHIPPING" ? "bg-blue-50 text-blue-700 border-blue-200" :
                        order.status === "PREPARING" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                        order.status === "PAYMENT_PENDING" ? "bg-orange-50 text-orange-700 border-orange-200" :
                        order.status === "PENDING" ? "bg-red-50 text-red-700 border-red-200" :
                        "bg-gray-50 text-gray-700 border-gray-200"
                      )}
                    >
                      {order.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && filteredOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-40 text-center text-muted-foreground text-xs font-semibold">
                  {lang === "KO" ? "조회 조건에 맞는 발주 데이터가 없습니다." : "No PO ledger records match filter criteria."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 발주 상세 모달 */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-none max-w-[1600px] w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <FileText className="w-5 h-5 text-primary" />
              {lang === "KO" ? "발주 상세 내역" : "Purchase Order Details"}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1 scrollbar-thin">
              {/* 기본 요약 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-lg text-xs border">
                <div>
                  <p className="text-muted-foreground font-semibold">{lang === "KO" ? "발주 번호" : "PO Number"}</p>
                  <p className="font-mono font-bold text-slate-800 mt-1">{selectedOrder.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold">{lang === "KO" ? "파트너사" : "Partner"}</p>
                  <p className="font-bold text-slate-800 mt-1">{selectedOrder.partnerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold">{lang === "KO" ? "발주 일자" : "Date"}</p>
                  <p className="font-mono font-bold text-slate-850 mt-1">{selectedOrder.date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold">{lang === "KO" ? "무역 조건" : "Incoterms"}</p>
                  <p className="font-bold text-slate-800 mt-1">
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
                      {selectedOrder.incoterms || "N/A"}
                    </Badge>
                  </p>
                </div>
              </div>

              {/* 품목 명세 테이블 */}
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead>{lang === "KO" ? "제품명" : "Product Name"}</TableHead>
                      <TableHead className="text-center">{lang === "KO" ? "수량" : "Qty"}</TableHead>
                      <TableHead className="text-right text-blue-700">{lang === "KO" ? "공급 단가" : "Unit Price"}</TableHead>
                      <TableHead className="text-right text-rose-600">{lang === "KO" ? "원가 단가 (원화/달러)" : "Cost Price"}</TableHead>
                      <TableHead className="text-right text-blue-700">{lang === "KO" ? "매출 합계" : "Sales Sum"}</TableHead>
                      <TableHead className="text-right text-rose-600">{lang === "KO" ? "원가 합계 (원화/달러)" : "Cost Sum"}</TableHead>
                      <TableHead className="text-right text-emerald-700 font-bold">{lang === "KO" ? "마진액" : "Margin"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items && selectedOrder.items.map((item: any, idx: number) => {
                      const qty = item.qty || 0;
                      const price = item.price || 0;
                      const cost = item.cost !== undefined ? item.cost : (price * 0.7);
                      
                      const salesSum = price * qty;
                      const costSum = cost * qty;
                      const itemMargin = salesSum - costSum;

                      return (
                        <TableRow key={idx} className="hover:bg-muted/10 text-xs">
                          <TableCell className="font-semibold text-slate-800 max-w-[200px] truncate" title={item.name}>
                            {item.name}
                          </TableCell>
                          <TableCell className="text-center font-mono font-medium text-slate-500">
                            {qty.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-blue-600">${price.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono text-rose-500 leading-tight">
                            <div>${cost.toFixed(2)}</div>
                            <div className="text-[9px] text-rose-455 mt-0.5">₩{Math.round(cost * systemExchangeRate).toLocaleString()}</div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-blue-600">
                            ${salesSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-rose-500 leading-tight">
                            <div>${costSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div className="text-[9px] text-rose-455 mt-0.5">₩{Math.round(costSum * systemExchangeRate).toLocaleString()}</div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-black text-emerald-600">
                            ${itemMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* 총액 및 마진 정보 */}
              <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center p-4 bg-slate-50 rounded-lg border gap-4 text-xs">
                <div className="flex gap-4">
                  <div>
                    <span className="text-muted-foreground font-semibold">{lang === "KO" ? "진행 단계: " : "Stage: "}</span>
                    <Badge variant="outline" className="font-bold ml-1">{selectedOrder.status}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold">{lang === "KO" ? "결제 상태: " : "Payment: "}</span>
                    <Badge variant="outline" className="font-bold ml-1">{selectedOrder.paymentStatus}</Badge>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="flex justify-between md:justify-end gap-6 items-center">
                    <span className="text-slate-500 font-bold">{lang === "KO" ? "총 매출액:" : "Total Sales:"}</span>
                    <span className="font-mono font-bold text-blue-600 text-sm">
                      ${parseAmount(selectedOrder.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between md:justify-end gap-6 items-center border-t border-dashed pt-1 mt-1">
                    <span className="text-slate-500 font-bold">{lang === "KO" ? "총 매입액 (원가):" : "Total Cost:"}</span>
                    {(() => {
                      const cost = calculateOrderCost(selectedOrder);
                      return (
                        <span className="font-mono font-semibold text-rose-500 text-sm">
                          ${cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-[10px] text-rose-500 bg-rose-50 px-1 py-0.5 rounded font-bold ml-1.5">
                            ₩{Math.round(cost * systemExchangeRate).toLocaleString()}
                          </span>
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex justify-between md:justify-end gap-6 items-center border-t border-solid pt-1 mt-1">
                    <span className="text-slate-500 font-bold">{lang === "KO" ? "본사 마진액:" : "HQ Net Profit:"}</span>
                    {(() => {
                      const sales = parseAmount(selectedOrder.amount);
                      const cost = calculateOrderCost(selectedOrder);
                      const margin = sales - cost;
                      const rate = sales > 0 ? (margin / sales) * 100 : 0;
                      return (
                        <span className="font-mono font-black text-emerald-600 text-sm flex items-center gap-1.5">
                          ${margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-bold">
                            {rate.toFixed(1)}%
                          </span>
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-lg text-xs text-amber-800">
                  <span className="font-bold block mb-1">📝 {lang === "KO" ? "요청 사항 (Notes)" : "Notes"}</span>
                  <p>{selectedOrder.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
