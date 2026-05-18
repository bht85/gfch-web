"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, Minus, Send, Package, Info, Loader2, Search, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, setDoc, doc, onSnapshot } from "firebase/firestore";

interface Product {
  id: string;
  name: string;
  vendor: string;
  category: string;
  cost: number;
  price: number;
}

export default function PlaceOrderPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, lang } = useTranslation();
  const isHQ = user?.role === "HQ";

  // 상태 관리
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isOrdered, setIsOrdered] = useState(false);
  
  // Firestore에서 로드된 실시간 파트너 목록
  const [dbPartners, setDbPartners] = useState<any[]>([]);
  // HQ(본사)일 경우 대리 발주할 대상 파트너 선택
  const [selectedPartnerId, setSelectedPartnerId] = useState("");

  // Firestore에서 실제 파트너 목록 실시간 연동
  useEffect(() => {
    const q = query(collection(db, "partners"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const list = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        code: doc.data().code || doc.data().country || "MF",
        name: doc.data().name || "Unknown Partner",
        ...doc.data()
      }) as any);
      setDbPartners(list);
      if (list.length > 0 && !selectedPartnerId) {
        // 기본값 세팅: 베트남 푸드 또는 첫 번째 항목
        const vnmPartner = list.find((p: any) => p.code === "VNM" || p.id === "MF-02");
        setSelectedPartnerId(vnmPartner ? vnmPartner.id : list[0].id);
      }
    });
    return () => unsubscribe();
  }, [selectedPartnerId]);

  // 1. Firestore에서 실제 상품 마스터 목록 실시간 조회
  useEffect(() => {
    async function fetchProducts() {
      try {
        const q = query(collection(db, "products"), orderBy("name", "asc"));
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        
        // 상품이 없을 경우 기본 세트 세팅
        if (fetched.length === 0) {
          const defaultTemplates: Product[] = [
            { id: "PROD-001", name: "Coffee Bean - Signature Blend (1kg)", vendor: "Seoul Logistics", category: "rawMaterial", cost: 15, price: 25 },
            { id: "PROD-002", name: "Coffee Bean - Ethiopia Yirgacheffe (1kg)", vendor: "Seoul Logistics", category: "rawMaterial", cost: 20, price: 32 },
            { id: "PROD-003", name: "Paper Cup - 12oz (Box 1000ea)", vendor: "EcoPack KR", category: "packaging", cost: 30, price: 45 },
            { id: "PROD-004", name: "Plastic Cup - 16oz (Box 1000ea)", vendor: "EcoPack KR", category: "packaging", cost: 38, price: 55 },
            { id: "PROD-005", name: "Syrup - Vanilla (1L)", vendor: "SweetFlavor Co.", category: "rawMaterial", cost: 8, price: 12 }
          ];
          setProducts(defaultTemplates);
        } else {
          setProducts(fetched);
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  // 파트너 정보 식별 (HQ 대리 발주 vs 일반 파트너 직접 발주)
  const currentPartner = isHQ 
    ? (dbPartners.find(p => p.id === selectedPartnerId) || dbPartners[0] || { id: "", name: "", code: "" })
    : {
        id: user?.role || "MF-02",
        name: user?.name || "Vietnam Food Corp",
        code: user?.partnerCode || "VNM"
      };

  // 🔒 파트너 전용 커스텀 판매가 정보 실시간 로드 (Phase 3)
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!currentPartner.id) return;
    const priceDocRef = doc(db, "prices", currentPartner.id);
    const unsubscribe = onSnapshot(priceDocRef, (docSnap: any) => {
      if (docSnap.exists()) {
        setCustomPrices(docSnap.data().prices || {});
      } else {
        setCustomPrices({});
      }
    });
    return () => unsubscribe();
  }, [currentPartner.id]);

  const getProductPrice = (product: Product) => {
    if (customPrices && customPrices[product.id] !== undefined) {
      return customPrices[product.id];
    }
    return product.price || (product.cost ? product.cost * 1.2 : 0);
  };

  // 수량 가감 처리
  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  // 검색 필터링된 상품
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.vendor.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 장바구니 담긴 항목
  const cartItems = Object.entries(cart).filter(([_, qty]) => qty > 0);
  
  // 합계 금액 계산
  const totalAmount = cartItems.reduce((sum, [id, qty]) => {
    const prod = products.find(p => p.id === id);
    return sum + (prod ? getProductPrice(prod) : 0) * qty;
  }, 0);

  // 2. 발주서 전송 (Firestore 실제 추가)
  const handleOrderSubmit = async () => {
    if (cartItems.length === 0 || isOrdered) return;
    setIsOrdered(true);

    try {
      // PO 고유 번호 생성 (PO-코드-오늘날짜-랜덤3자리)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const dateStr = `${year}${month}${day}`;
      const sequence = Math.floor(100 + Math.random() * 900); // 100~999 랜덤
      const poNumber = `PO-${currentPartner.code}-${dateStr}-${sequence}`;

      // 주문서에 들어갈 아이템 구성
      const orderItems = cartItems.map(([id, qty]) => {
        const prod = products.find(p => p.id === id)!;
        return {
          name: prod.name,
          qty: qty,
          price: getProductPrice(prod),
          cost: prod.cost
        };
      });

      // 신규 주문 도큐먼트 생성
      const orderData = {
        id: poNumber,
        partnerId: currentPartner.id,
        partnerName: currentPartner.name,
        partnerCode: currentPartner.code,
        mf: currentPartner.name, // 통합 주문보드 및 피드 호환용
        date: now.toISOString().split("T")[0], // 발주 날짜
        amount: `$${totalAmount.toLocaleString()}`, // 형식화된 금액 문자열
        totalAmount: totalAmount, // 숫자형 원본 금액
        status: "PENDING", // 승인 대기
        paymentStatus: "UNPAID",
        receiptUrl: "",
        documents: {}, // 객체 형태로 호환성 높임
        items: orderItems,
        createdAt: now.toISOString(),
        history: [
          {
            status: "PENDING",
            date: now.toISOString().split("T")[0],
            description: lang === "KO" 
              ? `${currentPartner.name} 발주 신청 완료` 
              : `Order placed by ${currentPartner.name}`
          }
        ]
      };

      // Firestore 저장
      await setDoc(doc(db, "orders", poNumber), orderData);
      
      alert(lang === "KO" 
        ? `발주가 정상 접수되었습니다!\n발주번호: ${poNumber}` 
        : `Order placed successfully!\nPO Number: ${poNumber}`
      );
      
      setCart({});
      router.push("/orders/history");
    } catch (error) {
      console.error("Order creation failed:", error);
      alert("발주서 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsOrdered(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 상단 타이틀 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {lang === "KO" ? "신규 발주 신청" : "Place New Order"} 🛍️
          </h2>
          <p className="text-muted-foreground mt-2">
            {lang === "KO" 
              ? "본사에 공급을 요청할 물류 품목과 수량을 선택해 주세요." 
              : "Select required logistics items and quantity to request supply from HQ."}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => router.push("/orders/history")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === "KO" ? "발주 내역으로 돌아가기" : "Back to Order History"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 왼쪽: 상품 검색 및 목록 선택 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card p-6 rounded-lg border shadow-sm space-y-6">
            
            {/* 검색 및 역할에 따른 파트너 선택 */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={lang === "KO" ? "품목명, 벤더사 검색..." : "Search items, vendors..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* 본사 관리자일 경우 대리 발주용 파트너사 선택 가능 */}
              {isHQ ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-100 rounded px-2 py-1 shrink-0">
                    대리 발주 모드
                  </span>
                  <select 
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs focus:ring-1 focus:ring-primary w-48"
                    value={selectedPartnerId}
                    onChange={(e) => {
                      setSelectedPartnerId(e.target.value);
                      setCart({}); // 파트너 변경 시 장바구니 리셋
                    }}
                  >
                    {dbPartners.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs px-3 py-1 font-semibold">
                    {currentPartner.name} ({currentPartner.code})
                  </Badge>
                </div>
              )}
            </div>

            {/* 실제 상품 리스트 테이블 */}
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>{lang === "KO" ? "제품 상세 정보" : "Product Details"}</TableHead>
                    <TableHead>{lang === "KO" ? "공급가 (Unit Price)" : "Unit Price"}</TableHead>
                    <TableHead className="text-center w-[160px]">{lang === "KO" ? "수량 선택" : "Quantity"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">상품 정보를 불러오고 있습니다...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-32 text-center text-muted-foreground text-sm">
                        검색 조건에 맞는 상품이 존재하지 않습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => (
                      <TableRow key={product.id} className="hover:bg-muted/10">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground text-sm">{product.name}</span>
                            <span className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] uppercase font-mono">
                                {product.category}
                              </Badge>
                              • {product.vendor}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-foreground text-sm">
                          ${getProductPrice(product).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-3">
                            <Button 
                              variant="outline" 
                              size="icon-xs" 
                              onClick={() => updateQuantity(product.id, -1)}
                              disabled={!cart[product.id]}
                              className="h-7 w-7"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-8 text-center font-bold text-sm text-foreground">
                              {cart[product.id] || 0}
                            </span>
                            <Button 
                              variant="outline" 
                              size="icon-xs" 
                              onClick={() => updateQuantity(product.id, 1)}
                              className="h-7 w-7"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* 오른쪽: 실시간 발주 요약 */}
        <div className="space-y-4">
          <div className="bg-card p-6 rounded-lg border shadow-sm sticky top-6 space-y-6">
            <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
              <Package className="h-5 w-5 text-primary" />
              {lang === "KO" ? "실시간 발주서 요약" : "Order Summary"}
            </h3>

            {/* 담긴 물품 내역 */}
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {cartItems.length === 0 ? (
                <div className="text-sm text-muted-foreground py-12 text-center border-2 border-dashed rounded-md flex flex-col items-center justify-center gap-2">
                  <ShoppingCart className="h-6 w-6 text-muted-foreground/50" />
                  <p>{lang === "KO" ? "장바구니가 비어 있습니다." : "No items selected."}</p>
                </div>
              ) : (
                cartItems.map(([id, qty]) => {
                  const prod = products.find(p => p.id === id);
                  const price = prod ? getProductPrice(prod) : 0;
                  return (
                    <div key={id} className="flex justify-between items-start text-sm border-b pb-2 last:border-0 last:pb-0 animate-in fade-in slide-in-from-right-2">
                      <div className="flex flex-col pr-4">
                        <span className="font-medium text-foreground text-xs leading-tight">{prod?.name}</span>
                        <span className="text-[10px] text-muted-foreground mt-1">
                          ${price.toFixed(2)} x {qty}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-foreground text-sm shrink-0">
                        ${(price * qty).toFixed(2)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* 합계금액 및 발주 버튼 */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-muted-foreground text-xs font-semibold">
                  {lang === "KO" ? "총 합계 금액" : "Total Amount"}
                </span>
                <div className="text-right">
                  <span className="text-2xl font-black text-primary font-mono">${totalAmount.toLocaleString()}</span>
                  <p className="text-[10px] text-muted-foreground mt-1">현재 적용 고정환율 기준</p>
                </div>
              </div>
              
              <div className="bg-orange-50 border border-orange-100 p-3 rounded-md flex gap-2 text-orange-800 text-[11px] leading-relaxed">
                <Info className="h-4 w-4 shrink-0 text-orange-600 mt-0.5" />
                <p>
                  {lang === "KO"
                    ? "본사 관리자의 전산 확인 및 승인 절차를 거쳐 선적 및 배송 단계로 진입합니다."
                    : "The shipment and logistics stage begins once the HQ administrator reviews and approves this order request."}
                </p>
              </div>

              <Button 
                className="w-full h-12 text-base font-bold shadow-lg shadow-primary/10 transition-all hover:scale-[1.01]" 
                disabled={cartItems.length === 0 || isOrdered}
                onClick={handleOrderSubmit}
              >
                {isOrdered ? (
                  <div className="flex items-center gap-2 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{lang === "KO" ? "발주서 전송 중..." : "Sending..."}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 justify-center">
                    <Send className="h-4 w-4" /> 
                    <span>{lang === "KO" ? "발주서 제출하기" : "Submit Purchase Order"}</span>
                  </div>
                )}
              </Button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
