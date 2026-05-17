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
import { Loader2, TrendingUp, TrendingDown, DollarSign, Globe, PieChart, Users, BarChart2 } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function SalesManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useTranslation();
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
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
  const japanSales = factOrders.filter(o => o.mf?.includes("Japan")).reduce((acc, curr) => acc + parseAmount(curr.amount || "0"), 0);
  const vietnamSales = factOrders.filter(o => o.mf?.includes("Vietnam")).reduce((acc, curr) => acc + parseAmount(curr.amount || "0"), 0);
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {lang === "KO" ? "MF별 매출 및 로열티 관리" : "Global Sales & Royalty Management"}
          </h2>
          <p className="text-muted-foreground mt-2">
            {lang === "KO" 
              ? "글로벌 파트너사별 매출 실적과 로열티를 통합 모니터링합니다." 
              : "Integrated monitoring of sales performance and royalties by global partners."}
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
            <div className="text-2xl font-black">${totalSales.toLocaleString()}</div>
            <p className={`text-xs flex items-center gap-1 font-bold mt-1 ${salesGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
              {salesGrowth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {salesGrowth > 0 ? "+" : ""}{salesGrowth.toFixed(1)}% 
              <span className="text-muted-foreground font-normal ml-1">vs last month</span>
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase">
              {lang === "KO" ? "일본 (Japan)" : "Japan Region"}
            </CardTitle>
            <Globe className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${japanSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {((japanSales / (totalSales || 1)) * 100).toFixed(1)}% of total sales
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase">
              {lang === "KO" ? "베트남 (Vietnam)" : "Vietnam Region"}
            </CardTitle>
            <Globe className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${vietnamSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {((vietnamSales / (totalSales || 1)) * 100).toFixed(1)}% of total sales
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase">
              {lang === "KO" ? "총 마진액" : "Total Margin"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">${Math.round(totalMargin).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {((totalMargin / (totalSales || 1)) * 100).toFixed(1)}% {lang === "KO" ? "평균 이익률" : "Avg. Margin Rate"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 mb-2">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2 font-bold">
                <BarChart2 className="w-5 h-5 text-primary" />
                {lang === "KO" ? "월별 / MF별 매출 추이" : "Monthly Revenue Trend by MF"}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {lang === "KO" ? "최근 파트너사들의 월별 실적을 차트로 확인합니다." : "Check the monthly performance of partners through charts."}
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[16rem] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} tick={{fontSize: 10}} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value/1000}k`} tickMargin={8} tick={{fontSize: 10}} />
                  <Tooltip 
                    cursor={{fill: 'rgba(0,0,0,0.05)'}}
                    formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                  {mfList.map((mf, index) => (
                    <Bar key={mf} dataKey={mf} fill={colors[index % colors.length]} radius={[2, 2, 0, 0]} maxBarSize={40} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm flex flex-col p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              {lang === "KO" ? "파트너별 연간 추이 (Line)" : "Annual Trend by MF"}
            </h3>
          </div>
          <div className="flex-1 min-h-[16rem] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10}} tickMargin={8} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} tickFormatter={(val) => `$${val/1000}k`} tickMargin={8} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                {mfList.map((mf, index) => (
                  <Line key={mf} type="monotone" dataKey={mf} stroke={colors[index % colors.length]} strokeWidth={2} dot={{r: 3}} activeDot={{r: 5}} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
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
    </div>
  );
}
