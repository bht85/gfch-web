"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Globe, PieChart, BarChart2, Coins } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function SalesManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useTranslation();
  const router = useRouter();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 보안 체크
  useEffect(() => {
    if (!authLoading && user && user.role !== "HQ") {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const parseAmount = (amt: string) => Number(amt.replace(/[^0-9.-]+/g,""));

  // 월별, MF별 매출/매입/마진 집계 (실제 제품 원가 반영)
  const monthlyDataMap: Record<string, { month: string, mf: string, revenue: number, cost: number, margin: number }> = {};
  
  const factOrders = orders.filter(o => ["DELIVERED", "COMPLETED"].includes(o.status));

  factOrders.forEach(order => {
    const month = order.date ? order.date.substring(0, 7) : "Unknown"; 
    const mf = order.mf || "Unknown";
    const key = `${month}_${mf}`;
    
    const revenue = parseAmount(order.amount || "0");
    
    // DB의 제품 원가(cost)를 기반으로 매입액 정밀 계산
    let cost = 0;
    if (order.items && Array.isArray(order.items)) {
      cost = order.items.reduce((acc: number, item: any) => {
        return acc + (item.cost || (item.price * 0.7)) * (item.qty || 1);
      }, 0);
    } else {
      cost = revenue * 0.7; // 예외 처리용 폴백
    }
    
    const margin = revenue - cost;

    if (!monthlyDataMap[key]) {
      monthlyDataMap[key] = { month, mf, revenue: 0, cost: 0, margin: 0 };
    }
    monthlyDataMap[key].revenue += revenue;
    monthlyDataMap[key].cost += cost;
    monthlyDataMap[key].margin += margin;
  });

  const monthlyStatements = Object.values(monthlyDataMap).sort((a, b) => b.month.localeCompare(a.month) || a.mf.localeCompare(b.mf));
  
  const latestMonth = monthlyStatements.length > 0 ? monthlyStatements[0].month : "";
  const latestMonthStatements = monthlyStatements.filter(s => s.month === latestMonth);

  // 차트 데이터 가공 (월별 데이터)
  const chartDataMap: Record<string, any> = {};
  factOrders.forEach(order => {
    const month = order.date ? order.date.substring(0, 7) : "Unknown"; 
    const mf = order.mf || "Unknown";
    const revenue = parseAmount(order.amount || "0");

    if (!chartDataMap[month]) {
      chartDataMap[month] = { month };
    }
    if (!chartDataMap[month][mf]) {
      chartDataMap[month][mf] = 0;
    }
    chartDataMap[month][mf] += revenue;
  });

  const chartData = Object.values(chartDataMap).sort((a, b) => a.month.localeCompare(b.month));
  
  // MF 목록 추출
  const mfList = Array.from(new Set(factOrders.map(o => o.mf || "Unknown"))).filter(m => m !== "Unknown");
  const colors = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  // 통계 계산
  const totalSales = factOrders.reduce((acc, curr) => acc + parseAmount(curr.amount || "0"), 0);
  const jpnSales = factOrders.filter(o => o.mf?.includes("Japan")).reduce((acc, curr) => acc + parseAmount(curr.amount || "0"), 0);
  const vnmSales = factOrders.filter(o => o.mf?.includes("Vietnam")).reduce((acc, curr) => acc + parseAmount(curr.amount || "0"), 0);
  const totalMargin = monthlyStatements.reduce((acc, curr) => acc + curr.margin, 0);

  const salesByMonth = factOrders.reduce((acc: Record<string, number>, curr) => {
    const month = curr.date ? curr.date.substring(0, 7) : "Unknown";
    acc[month] = (acc[month] || 0) + parseAmount(curr.amount || "0");
    return acc;
  }, {});
  const sortedMonths = Object.keys(salesByMonth).sort((a, b) => b.localeCompare(a));
  const currentMonthSales = sortedMonths.length > 0 ? salesByMonth[sortedMonths[0]] : 0;
  const lastMonthSales = sortedMonths.length > 1 ? salesByMonth[sortedMonths[1]] : 0;
  let salesGrowth = 0;
  if (lastMonthSales > 0) {
    salesGrowth = ((currentMonthSales - lastMonthSales) / lastMonthSales) * 100;
  }

  if (authLoading || (user && user.role !== "HQ")) {
    return <div className="h-96 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-4 gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {lang === "KO" ? "글로벌 손익 분석" : "Global Profit & Loss Analytics"}
          </h2>
          <p className="text-muted-foreground mt-2">
            {lang === "KO" 
              ? "글로벌 마스터 프랜차이즈별 물류 매출, HQ 원가, 그리고 마진율을 실시간 분석합니다." 
              : "Real-time analysis of logistics revenue, HQ true cost, and margin rates by global partners."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase">
              {lang === "KO" ? "총 매출액" : "Total Revenue"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-blue-600">${totalSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {salesGrowth >= 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
              <span className={salesGrowth >= 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                {salesGrowth >= 0 ? "+" : ""}{salesGrowth.toFixed(1)}%
              </span>
              {lang === "KO" ? "전월 대비" : "vs last month"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase">
              {lang === "KO" ? "일본 (JPN) 매출" : "Japan (JPN) Sales"}
            </CardTitle>
            <Globe className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-purple-600">${jpnSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {lang === "KO" ? `비중: ${totalSales > 0 ? Math.round((jpnSales/totalSales)*100) : 0}%` : `Ratio: ${totalSales > 0 ? Math.round((jpnSales/totalSales)*100) : 0}%`}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase">
              {lang === "KO" ? "베트남 (VNM) 매출" : "Vietnam (VNM) Sales"}
            </CardTitle>
            <Globe className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-indigo-600">${vnmSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {lang === "KO" ? `비중: ${totalSales > 0 ? Math.round((vnmSales/totalSales)*100) : 0}%` : `Ratio: ${totalSales > 0 ? Math.round((vnmSales/totalSales)*100) : 0}%`}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-extrabold text-emerald-800 uppercase">
              {lang === "KO" ? "당사 총 이익 (Margin)" : "Total HQ Margin"}
            </CardTitle>
            <Coins className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-emerald-600">${totalMargin.toLocaleString()}</div>
            <p className="text-xs text-emerald-600 font-bold mt-1">
              {lang === "KO" ? `마진율: ${totalSales > 0 ? ((totalMargin/totalSales)*100).toFixed(1) : 0}%` : `Margin rate: ${totalSales > 0 ? ((totalMargin/totalSales)*100).toFixed(1) : 0}%`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-1 text-slate-800">
              <BarChart2 className="w-4 h-4 text-primary" />
              {lang === "KO" ? "월별 본사 유통 마진 추이 (USD)" : "Monthly HQ Profit Margins Trend"}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} style={{ fontSize: '11px', fontFamily: 'monospace' }} />
                <YAxis tickLine={false} style={{ fontSize: '11px', fontFamily: 'monospace' }} />
                <Tooltip cursor={{ fill: 'rgba(0, 0, 0, 0.03)' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {mfList.map((mf, index) => (
                  <Bar key={mf} dataKey={mf} name={mf} fill={colors[index % colors.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-1 text-slate-800">
              <PieChart className="w-4 h-4 text-primary" />
              {lang === "KO" ? "국가별 매출 누적 비중" : "Accumulated Sales Share by Country"}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80 flex flex-col justify-between">
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} style={{ fontSize: '11px', fontFamily: 'monospace' }} />
                  <YAxis tickLine={false} style={{ fontSize: '11px', fontFamily: 'monospace' }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  {mfList.map((mf, index) => (
                    <Line key={mf} type="monotone" dataKey={mf} stroke={colors[index % colors.length]} strokeWidth={3} dot={{ r: 4 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="border-t pt-4 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 font-medium text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] inline-block" />
                  일본 (JPN)
                </span>
                <span className="font-extrabold text-slate-900">${jpnSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 font-medium text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] inline-block" />
                  베트남 (VNM)
                </span>
                <span className="font-extrabold text-slate-900">${vnmSales.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <div className="border-b px-6 py-4 flex items-center justify-between bg-muted/20">
          <h3 className="text-sm font-bold flex items-center gap-1.5 text-slate-800">
            <DollarSign className="w-4 h-4 text-primary" /> 
            {lang === "KO" ? `[${latestMonth}] 파트너별 손익 (P&L)` : `[${latestMonth}] P&L by Partner`}
          </h3>
          <Badge variant="secondary" className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 font-semibold uppercase">
            {lang === "KO" ? "실제 원가(True Cost) 기준" : "Based on True HQ Cost"}
          </Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/10">
              <TableHead>{lang === "KO" ? "MF 파트너" : "Partner"}</TableHead>
              <TableHead className="text-right text-blue-700">{lang === "KO" ? "매출액 (발주 총합)" : "Revenue"}</TableHead>
              <TableHead className="text-right text-red-600">{lang === "KO" ? "매입액 (원가 기준)" : "Purchase (Cost)"}</TableHead>
              <TableHead className="text-right text-green-700 font-bold">{lang === "KO" ? "마진액 (당사 수익)" : "Margin"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="h-48 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : latestMonthStatements.map((row, i) => (
              <TableRow key={i} className="hover:bg-muted/20">
                <TableCell className="font-bold">{row.mf}</TableCell>
                <TableCell className="text-right font-black text-blue-600">${Math.round(row.revenue).toLocaleString()}</TableCell>
                <TableCell className="text-right font-medium text-red-500">${Math.round(row.cost).toLocaleString()}</TableCell>
                <TableCell className="text-right font-black text-green-600">${Math.round(row.margin).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {latestMonthStatements.length === 0 && !loading && (
              <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">{lang === "KO" ? "데이터가 없습니다." : "No data available."}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
