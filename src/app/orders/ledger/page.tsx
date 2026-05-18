"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Calendar, TrendingUp, AlertCircle, ListFilter, Package, Info, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PurchaseLedgerPage() {
  const { user } = useAuth();
  const { t, lang } = useTranslation();
  const isHQ = user?.role === "HQ";
  
  const [dbPartners, setDbPartners] = useState<any[]>([]);
  const [selectedPartner, setSelectedPartner] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Firestore에서 파트너사 목록 로드
  useEffect(() => {
    const q = query(collection(db, "partners"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const list = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        name: doc.data().name || "Unknown Partner",
        code: doc.data().code || doc.data().country || "MF",
        ...doc.data()
      }) as any);
      setDbPartners(list);
      if (isHQ && list.length > 0 && !selectedPartner) {
        // 기본값: JPN 파트너 또는 첫 번째 파트너
        const jpnPartner = list.find((p: any) => p.code === "JPN" || p.id === "MF-01");
        setSelectedPartner(jpnPartner ? jpnPartner.id : list[0].id);
      }
    });
    return () => unsubscribe();
  }, [isHQ, selectedPartner]);

  useEffect(() => {
    if (user && !isHQ) {
      setSelectedPartner(user.role);
    }
  }, [user, isHQ]);

  useEffect(() => {
    if (!selectedPartner) return;
    const q = query(collection(db, "orders"), where("partnerId", "==", selectedPartner));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [selectedPartner]);

  const filteredOrders = orders.filter(order => {
    return order.date >= startDate && order.date <= endDate;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const parseAmount = (amt: string) => Number(amt.replace(/[^0-9.-]+/g,""));

  const totalPurchase = filteredOrders.reduce((acc, curr) => acc + parseAmount(curr.amount), 0);
  const unpaidAmount = filteredOrders
    .filter(o => o.paymentStatus === "UNPAID")
    .reduce((acc, curr) => acc + parseAmount(curr.amount), 0);

  const productAnalytics = filteredOrders.reduce((acc: any, order) => {
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item: any) => {
        if (!acc[item.name]) {
          acc[item.name] = { name: item.name, totalQty: 0, totalAmount: 0, orderCount: 0 };
        }
        acc[item.name].totalQty += item.qty || 0;
        acc[item.name].totalAmount += ((item.qty || 0) * (item.price || 0));
        acc[item.name].orderCount += 1;
      });
    }
    return acc;
  }, {});

  const productList = Object.values(productAnalytics);

  const chartColors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
  const skuChartData = Object.entries(productAnalytics).map(([name, stats]: [string, any]) => ({
    name,
    value: stats.totalAmount
  })).sort((a, b) => b.value - a.value).slice(0, 5);

  const monthlyChartData = filteredOrders.reduce((acc: any[], order) => {
    const month = order.date.substring(0, 7);
    const existing = acc.find(d => d.month === month);
    const amountNum = parseAmount(order.amount);
    if (existing) {
      existing.amount += amountNum;
    } else {
      acc.push({ month, amount: amountNum });
    }
    return acc;
  }, []).sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("myLedger")}</h2>
          <p className="text-muted-foreground mt-2">
            {lang === "KO" ? "기간별 매입 내역과 품목별 통계를 실시간으로 분석합니다." : "Real-time purchase history and itemized statistics analytics."}
          </p>
        </div>
        {isHQ && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg border shadow-sm h-10">
              <label className="text-[10px] font-bold text-muted-foreground ml-2 uppercase">Partner</label>
              <select 
                className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
                value={selectedPartner}
                onChange={(e) => setSelectedPartner(e.target.value)}
              >
                {dbPartners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 요약 카드 및 차트 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-slate-900 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium opacity-70">{t("totalPurchaseAmt")}</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${totalPurchase.toLocaleString()}</div>
              <p className="text-xs opacity-50 mt-1">{lang === "KO" ? "선택된 기간의 누적 주문액" : "Accumulated orders for period"}</p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t("popularItems")}</CardTitle></CardHeader>
            <CardContent className="h-[200px]">
              {skuChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={skuChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value">
                      {skuChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `$${Number(value).toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">{lang === "KO" ? "데이터 없음" : "No Data"}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader><CardTitle className="text-sm font-medium">{t("monthlyTrend")}</CardTitle></CardHeader>
          <CardContent className="h-[320px]">
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value/1000}k`} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, lang === "KO" ? "매입액" : "Purchases"]} 
                  />
                  <Bar dataKey="amount" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">{lang === "KO" ? "데이터 없음" : "No Data"}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 필터 섹션 */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-slate-50">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input 
            type="date" 
            className="text-xs font-medium focus:outline-none bg-transparent" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-muted-foreground text-xs">~</span>
          <input 
            type="date" 
            className="text-xs font-medium focus:outline-none bg-transparent" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs h-9"
            onClick={() => {
              const now = new Date();
              setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
              setEndDate(new Date().toISOString().split('T')[0]);
            }}
          >
            {lang === "KO" ? "이번 달" : "MTD"}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs h-9"
            onClick={() => {
              setStartDate("2026-01-01");
              setEndDate("2026-12-31");
            }}
          >
            {lang === "KO" ? "2026년 전체" : "2026 Full Year"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-4">
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ListFilter className="w-4 h-4" /> {t("orderSummary")}
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="w-4 h-4" /> {t("productAnalysis")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("poNumber")}</TableHead>
                  <TableHead>{lang === "KO" ? "결제 방식" : "Payment Type"}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{lang === "KO" ? "품목 수" : "Items"}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length > 0 ? filteredOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-xs">{order.date}</TableCell>
                    <TableCell className="font-mono text-[10px] font-bold">{order.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px]", order.paymentType === "PREPAID" ? "border-blue-200 text-blue-700 bg-blue-50/30" : "border-purple-200 text-purple-700 bg-purple-50/30")}>
                        {order.paymentType === "PREPAID" ? (lang === "KO" ? "선불" : "Prepaid") : (lang === "KO" ? "후불" : "Postpaid")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px] font-bold", order.paymentStatus === "PAID" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100")}>
                        {order.paymentStatus === "PAID" ? (lang === "KO" ? "완료" : "PAID") : (lang === "KO" ? "미결제" : "UNPAID")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{order.items?.length || 0}{lang === "KO" ? "개" : " items"}</TableCell>
                    <TableCell className="text-right font-bold text-xs">{order.amount}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(order)} className="text-[10px] h-7 px-2">
                        {t("viewDetail")}
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-xs italic">{lang === "KO" ? "데이터가 없습니다." : "No data available."}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>{lang === "KO" ? "제품명" : "Product Name"}</TableHead>
                  <TableHead>{lang === "KO" ? "주문 횟수" : "Order Count"}</TableHead>
                  <TableHead className="text-right">{lang === "KO" ? "누적 수량" : "Total Qty"}</TableHead>
                  <TableHead className="text-right">{lang === "KO" ? "누적 매입액" : "Total Amount"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productList.length > 0 ? productList.map((prod: any) => (
                  <TableRow key={prod.name}>
                    <TableCell className="font-medium text-xs flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40"></div>
                      {prod.name}
                    </TableCell>
                    <TableCell className="text-xs">{prod.orderCount}{lang === "KO" ? "회" : " times"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{prod.totalQty.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-bold text-primary text-xs">${prod.totalAmount.toLocaleString()}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-xs italic">{lang === "KO" ? "데이터가 없습니다." : "No data available."}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" /> {lang === "KO" ? "주문 상세 내역" : "Order Detail Items"}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="mt-4 space-y-4">
              <div className="flex justify-between text-[10px] bg-muted/50 p-3 rounded-lg border">
                <div><p className="text-muted-foreground">{t("poNumber")}</p><p className="font-bold">{selectedOrder.id}</p></div>
                <div className="text-right"><p className="text-muted-foreground">{t("date")}</p><p className="font-bold">{selectedOrder.date}</p></div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader><TableRow className="bg-muted/50 text-[10px]"><TableHead>{lang === "KO" ? "품목명" : "Item Name"}</TableHead><TableHead className="text-right">{lang === "KO" ? "수량" : "Qty"}</TableHead><TableHead className="text-right">{t("amount")}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {selectedOrder.items?.map((item: any, idx: number) => (
                      <TableRow key={idx} className="text-xs">
                        <TableCell className="py-2">{item.name}</TableCell>
                        <TableCell className="text-right py-2">{item.qty}</TableCell>
                        <TableCell className="text-right py-2 font-bold">${(item.qty * (item.price || 0)).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-900 text-white rounded-lg">
                <span className="text-xs font-bold">{lang === "KO" ? "최종 합계" : "Total Sum"}</span>
                <span className="text-lg font-black text-primary">{selectedOrder.amount}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
