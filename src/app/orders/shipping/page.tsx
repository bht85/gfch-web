"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Truck, 
  Search, 
  Loader2, 
  Ship, 
  Plane, 
  MapPin, 
  CheckCircle2, 
  FileText,
  Plus,
  Calendar
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  addDoc 
} from "firebase/firestore";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function ShippingPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const isHQ = user?.role === "HQ";

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [shippingData, setShippingData] = useState({ trackingNo: "", method: "SEA", carrier: "" });
  const [activeTab, setActiveTab] = useState<"shipping" | "purchase">("shipping");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // 1. 기간 필터가 적용된 주문 목록 (Shipping Board & Purchase Summary 공통 적용)
  const dateFilteredOrders = orders.filter(order => {
    if (!order.date) return true;
    if (startDate && order.date < startDate) return false;
    if (endDate && order.date > endDate) return false;
    return true;
  });

  // 당사 매입 내역 집계 로직 (실제 제품 원가 기반)
  const purchaseMap: Record<string, { month: string, itemName: string, totalQty: number, totalCost: number }> = {};
  
  dateFilteredOrders.forEach(order => {
    const month = order.date ? order.date.substring(0, 7) : "Unknown"; 
    order.items?.forEach((item: any) => {
      const key = `${month}_${item.name}`;
      const qty = item.qty || 0;
      // DB의 제품 원가(cost)를 적용
      const cost = (item.cost || (item.price || 0) * 0.7) * qty;
      if (!purchaseMap[key]) {
        purchaseMap[key] = { month, itemName: item.name, totalQty: 0, totalCost: 0 };
      }
      purchaseMap[key].totalQty += qty;
      purchaseMap[key].totalCost += cost;
    });
  });
  const purchaseStatements = Object.values(purchaseMap).sort((a, b) => b.month.localeCompare(a.month) || a.itemName.localeCompare(b.itemName));

  // 물류 관리 대상 상태들
  const SHIPPING_TARGET_STATUS = ["PREPARING", "SHIPPING", "DELIVERED"];

  // 데이터 로딩 (권한 기반 필터링)
  useEffect(() => {
    if (!user) return;

    let q;
    if (isHQ) {
      // 본사는 모든 배송 대상 조회
      q = query(
        collection(db, "orders"), 
        where("status", "in", SHIPPING_TARGET_STATUS)
      );
    } else {
      // MF는 본인 데이터만 조회
      q = query(
        collection(db, "orders"), 
        where("partnerId", "==", user.role),
        where("status", "in", SHIPPING_TARGET_STATUS)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sortedData = data.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setOrders(sortedData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isHQ]);

  const handleUpdateShipping = async () => {
    if (!selectedOrder || !shippingData.trackingNo) return;
    try {
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        status: "SHIPPING",
        shippingInfo: shippingData,
        updatedAt: new Date().toISOString()
      });

      await addDoc(collection(db, "notifications"), {
        type: "SHIPPING",
        orderId: selectedOrder.id,
        message: lang === "KO" 
          ? `상품이 발송되었습니다! (B/L No: ${shippingData.trackingNo})` 
          : `Items Shipped! (B/L No: ${shippingData.trackingNo})`,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      setSelectedOrder(null);
      alert(lang === "KO" ? "배송 정보 업데이트 완료!" : "Shipping Info Updated!");
    } catch (error) {
      alert("Error: " + error);
    }
  };

  const handleCompleteDelivery = async (orderId: string) => {
    if (!confirm(lang === "KO" ? "해당 주문을 [배송 완료] 상태로 변경하시겠습니까?" : "Do you want to mark this order as [Delivered]?")) return;
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "DELIVERED",
        updatedAt: new Date().toISOString()
      });

      await addDoc(collection(db, "notifications"), {
        type: "STATUS",
        orderId: orderId,
        message: lang === "KO" 
          ? `상품 배송이 완료되었습니다!` 
          : `Items have been delivered!`,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      alert(lang === "KO" ? "배송 완료 처리되었습니다." : "Order marked as Delivered.");
    } catch (error) {
      alert("Error: " + error);
    }
  };

  const filteredOrders = dateFilteredOrders.filter(o => 
    o.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (o.mf && o.mf.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (authLoading) return <div className="h-96 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {lang === "KO" ? "선적 및 배송 관리" : "Shipping & Logistics"}
          </h2>
          <p className="text-muted-foreground mt-2">
            {lang === "KO" 
              ? "상품 준비가 완료된 발주건의 선적 일정을 잡고 B/L 정보를 관리합니다." 
              : "Manage shipping schedules and B/L information for prepared orders."}
          </p>
        </div>
      </div>

      {/* 기간 필터 섹션 */}
      <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary shrink-0" />
          <div>
            <h4 className="text-sm font-bold">{lang === "KO" ? "기간별 조회 필터" : "Date Range Filter"}</h4>
            <p className="text-[10px] text-muted-foreground">{lang === "KO" ? "발주 날짜 기준의 선적 현황 및 매입 장부를 실시간 조회합니다." : "Filter shipping list and purchase summary by order date."}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Input 
              type="date" 
              className="w-36 h-9 text-xs" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
            <span className="text-muted-foreground text-xs">~</span>
            <Input 
              type="date" 
              className="w-36 h-9 text-xs" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
          </div>
          {(startDate || endDate) && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
            >
              {lang === "KO" ? "필터 초기화" : "Reset"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b mb-6">
        <Button 
          variant="ghost" 
          className={cn(
            "rounded-none border-b-2 px-6 pb-2",
            activeTab === "shipping" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground"
          )}
          onClick={() => setActiveTab("shipping")}
        >
          <Truck className="w-4 h-4 mr-2" />
          {lang === "KO" ? "선적 현황 보드" : "Shipping Board"}
        </Button>
        {isHQ && (
          <Button 
            variant="ghost" 
            className={cn(
              "rounded-none border-b-2 px-6 pb-2",
              activeTab === "purchase" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground"
            )}
            onClick={() => setActiveTab("purchase")}
          >
            <FileText className="w-4 h-4 mr-2" />
            {lang === "KO" ? "본사 매입 집계표" : "HQ Purchase Summary"}
          </Button>
        )}
      </div>

      {activeTab === "shipping" ? (
        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-muted/20 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={lang === "KO" ? "PO 번호 또는 파트너 검색..." : "Search PO or Partner..."} 
                className="pl-9 bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>{t("poNumber")}</TableHead>
              {isHQ && <TableHead>{lang === "KO" ? "MF 파트너" : "Partner"}</TableHead>}
              <TableHead>{lang === "KO" ? "운송 수단" : "Method"}</TableHead>
              <TableHead>{lang === "KO" ? "B/L / Tracking No." : "B/L / Tracking No."}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{lang === "KO" ? "관리" : "Action"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="h-48 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filteredOrders.length > 0 ? (
              filteredOrders.map((order) => (
                <TableRow key={order.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs font-bold">{order.id}</TableCell>
                  {isHQ && <TableCell className="font-semibold">{order.mf}</TableCell>}
                  <TableCell>
                    {order.shippingInfo?.method === "AIR" ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1"><Plane className="w-3 h-3" /> AIR</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1"><Ship className="w-3 h-3" /> SEA</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.shippingInfo?.trackingNo ? (
                      <span className="font-mono text-xs text-blue-600 font-bold underline cursor-pointer">{order.shippingInfo.trackingNo}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">{lang === "KO" ? "배정 대기" : "Awaiting Schedule"}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-[10px]", 
                      order.status === "SHIPPING" ? "bg-blue-100 text-blue-700" : 
                      order.status === "DELIVERED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                      {order.status === "SHIPPING" ? t("shipping_status") : t(order.status.toLowerCase()) || order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {isHQ ? (
                      <div className="flex gap-2 justify-end">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShippingData(order.shippingInfo || { trackingNo: "", method: "SEA", carrier: "" });
                          }}
                        >
                          {lang === "KO" ? "배송 정보 수정" : "Update Shipping"}
                        </Button>
                        {order.status === "SHIPPING" && (
                          <Button 
                            size="sm" 
                            variant="default"
                            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => handleCompleteDelivery(order.id)}
                          >
                            {lang === "KO" ? "배송 완료 처리" : "Complete Delivery"}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-8 text-xs">{lang === "KO" ? "상세 보기" : "View Detail"}</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">
                  {lang === "KO" ? "배송 관리 대상이 없습니다." : "No shipping items found."}
                </TableCell>
              </TableRow>
            )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> 
              {lang === "KO" ? "기간별 / 품목별 실질 매입 누적 현황" : "Actual Purchase Accumulation by Period/Item"}
            </h3>
            <Badge variant="secondary" className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 font-semibold uppercase">
              {lang === "KO" ? "실제 원가(True Cost) 기준" : "Based on True HQ Cost"}
            </Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/10">
                <TableHead>{lang === "KO" ? "연월" : "Month"}</TableHead>
                <TableHead>{lang === "KO" ? "품목명" : "Item Name"}</TableHead>
                <TableHead className="text-right">{lang === "KO" ? "총 매입 수량 (Total Qty)" : "Total Qty"}</TableHead>
                <TableHead className="text-right text-red-600 font-bold">{lang === "KO" ? "당사 실질 매입액" : "Actual Purchase Cost"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="h-48 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : purchaseStatements.length > 0 ? (
                purchaseStatements.map((row, i) => (
                  <TableRow key={i} className="hover:bg-muted/20">
                    <TableCell className="font-medium text-muted-foreground">{row.month}</TableCell>
                    <TableCell className="font-bold">{row.itemName}</TableCell>
                    <TableCell className="text-right font-medium">{row.totalQty.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-black text-red-500">${Math.round(row.totalCost).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic">
                    {lang === "KO" ? "매입 집계 데이터가 없습니다." : "No purchase data found."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              {lang === "KO" ? "배송 및 선적 정보 업데이트" : "Update Shipping Information"}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="grid gap-2 text-sm bg-muted/50 p-3 rounded-lg border">
                <p className="text-muted-foreground">{t("poNumber")}: <span className="font-mono font-bold text-foreground">{selectedOrder.id}</span></p>
                <p className="text-muted-foreground">{lang === "KO" ? "파트너사" : "Partner"}: <span className="font-bold text-foreground">{selectedOrder.mf}</span></p>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="method">{lang === "KO" ? "운송 수단" : "Transport Method"}</Label>
                  <select 
                    id="method"
                    className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={shippingData.method}
                    onChange={(e) => setShippingData({...shippingData, method: e.target.value})}
                  >
                    <option value="SEA">SEA (Ship)</option>
                    <option value="AIR">AIR (Plane)</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="carrier">{lang === "KO" ? "포워더 / 선사 명" : "Carrier / Forwarder"}</Label>
                  <Input 
                    id="carrier" 
                    placeholder={lang === "KO" ? "예: HMM, Korean Air" : "e.g. HMM, Korean Air"}
                    value={shippingData.carrier}
                    onChange={(e) => setShippingData({...shippingData, carrier: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tracking">{lang === "KO" ? "B/L 또는 Tracking Number" : "B/L or Tracking Number"}</Label>
                  <Input 
                    id="tracking" 
                    placeholder="PO-JPN-BL-..."
                    value={shippingData.trackingNo}
                    onChange={(e) => setShippingData({...shippingData, trackingNo: e.target.value})}
                  />
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex gap-2">
                <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-700 leading-relaxed">
                  {lang === "KO" 
                    ? "저장 시 파트너사의 주문 상태가 [배송 중(Shipping)]으로 자동 변경되며 알림이 전송됩니다." 
                    : "Saving will automatically change the order status to [Shipping] and notify the partner."}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>{lang === "KO" ? "취소" : "Cancel"}</Button>
            <Button onClick={handleUpdateShipping}>{lang === "KO" ? "배송 정보 저장" : "Save Shipping Info"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
