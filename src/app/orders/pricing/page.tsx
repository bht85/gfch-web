"use client";

import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tag, Save, ArrowRight, Info, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

export default function PricingPage() {
  const [dbPartners, setDbPartners] = useState<any[]>([]);
  const [selectedPartner, setSelectedPartner] = useState("");
  const [partnerPrices, setPartnerPrices] = useState<Record<string, Record<string, number>>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      if (list.length > 0 && !selectedPartner) {
        // 기본값: JPN 파트너 또는 첫 번째 파트너
        const jpnPartner = list.find((p: any) => p.code === "JPN" || p.id === "MF-01");
        setSelectedPartner(jpnPartner ? jpnPartner.id : list[0].id);
      }
    });
    return () => unsubscribe();
  }, [selectedPartner]);

  // Firestore에서 상품 목록 로드 및 초기 판매가 매핑
  useEffect(() => {
    if (dbPartners.length === 0) return;

    const q = query(collection(db, "products"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(data);

      // 초기 가격 설정 (DB의 price 속성 또는 cost + 20% 마진을 기본값으로 사용)
      setPartnerPrices(prev => {
        const initial: Record<string, Record<string, number>> = { ...prev };
        dbPartners.forEach(p => {
          if (!initial[p.id]) initial[p.id] = {};
          data.forEach(prod => {
            const prodData = prod as any;
            if (!initial[p.id][prodData.id]) {
              initial[p.id][prodData.id] = prodData.price || (prodData.cost ? prodData.cost * 1.2 : 0);
            }
          });
        });
        return initial;
      });

      setLoading(false);
    });
    return () => unsubscribe();
  }, [dbPartners]);

  const handlePriceChange = (productId: string, value: string) => {
    const newPrice = parseFloat(value) || 0;
    setPartnerPrices(prev => ({
      ...prev,
      [selectedPartner]: {
        ...prev[selectedPartner],
        [productId]: newPrice
      }
    }));
  };

  const currentPrices = partnerPrices[selectedPartner] || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">MF별 판매가 설정</h2>
          <p className="text-muted-foreground mt-2">각 국가별 마스터 프랜차이즈에 공급하는 판매 가격을 개별적으로 설정합니다.</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700">
          <Save className="mr-2 h-4 w-4" /> 현재 설정 저장
        </Button>
      </div>

      <div className="bg-card p-6 rounded-lg border flex flex-col gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="space-y-1.5 flex-1">
            <label className="text-sm font-medium">대상 파트너사 선택</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
            >
              {dbPartners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-md flex gap-2 text-blue-800 text-sm flex-[1.5]">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              <strong>개별 가격 관리:</strong> 현재 선택된 **{dbPartners.find(p => p.id === selectedPartner)?.name || "로딩 중..."}** 전용 가격입니다.
              파트너사를 변경하면 해당 국가에 설정된 가격으로 화면이 전환됩니다.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>제품 정보</TableHead>
              <TableHead>기본 매입가 (HQ Cost)</TableHead>
              <TableHead className="w-[80px]"></TableHead>
              <TableHead className="w-[200px]">MF 공급가 (Selling Price)</TableHead>
              <TableHead>마진 (Margin)</TableHead>
              <TableHead>마진율 (%)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : products.map((product) => {
              const baseCost = product.cost || product.baseCost || 0;
              const sellingPrice = currentPrices[product.id] || 0;
              const margin = sellingPrice - baseCost;
              const marginPercent = baseCost > 0 ? ((margin / baseCost) * 100).toFixed(1) : "0.0";

              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{product.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{product.id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">${Number(baseCost).toFixed(2)}</TableCell>
                  <TableCell>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">$</span>
                      <Input
                        type="number"
                        value={sellingPrice}
                        onChange={(e) => handlePriceChange(product.id, e.target.value)}
                        className="w-full h-9 font-medium border-primary/20 focus:border-primary"
                      />
                    </div>
                  </TableCell>
                  <TableCell className={cn("font-medium", margin >= 0 ? "text-green-600" : "text-destructive")}>
                    ${margin.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={parseFloat(marginPercent) > 10 ? "default" : "secondary"}>
                      {marginPercent}%
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
