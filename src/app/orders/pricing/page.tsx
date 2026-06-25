"use client";

import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tag, Save, ArrowRight, Info, Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, setDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth";

type Incoterm = "FOB" | "CIF" | "EXW";

const INCOTERMS: { key: Incoterm; label: string; desc: string; color: string; bg: string; border: string }[] = [
  {
    key: "FOB",
    label: "FOB",
    desc: "Free On Board — 수출지 본선 선적까지 HQ 부담",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  {
    key: "CIF",
    label: "CIF",
    desc: "Cost, Insurance & Freight — 도착항 보험·운임 HQ 포함",
    color: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-200",
  },
  {
    key: "EXW",
    label: "EXW",
    desc: "Ex Works — 공장 출고 이후 전비용 MF 부담",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
];

export default function PricingPage() {
  const { user } = useAuth();
  const [dbPartners, setDbPartners] = useState<any[]>([]);
  const [selectedPartner, setSelectedPartner] = useState("");
  const [selectedIncoterm, setSelectedIncoterm] = useState<Incoterm>("FOB");
  const [defaultIncoterm, setDefaultIncoterm] = useState<Incoterm>("FOB");
  const [allowedIncoterms, setAllowedIncoterms] = useState<Record<Incoterm, boolean>>({ FOB: true, CIF: true, EXW: true });

  // 3차원 가격 구조: partnerId → incoterm → productId → price
  const [allPrices, setAllPrices] = useState<Record<string, Record<Incoterm, Record<string, number>>>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Firestore 파트너별 가격 실시간 로드
  useEffect(() => {
    const q = query(collection(db, "prices"));
    const unsub = onSnapshot(q, (snapshot: any) => {
      const priceMap: Record<string, any> = {};
      snapshot.docs.forEach((d: any) => {
        priceMap[d.id] = d.data();
      });
      setAllPrices((prev) => {
        const updated = { ...prev };
        Object.entries(priceMap).forEach(([partnerId, data]) => {
          // 기존 incoterms 구조 또는 레거시 prices 구조 모두 지원
          const incoterms: Record<Incoterm, Record<string, number>> = {
            FOB: (data.incoterms?.FOB) || data.prices || {},
            CIF: (data.incoterms?.CIF) || {},
            EXW: (data.incoterms?.EXW) || {},
          };
          updated[partnerId] = incoterms;
        });
        return updated;
      });

      if (selectedPartner && priceMap[selectedPartner]) {
        const data = priceMap[selectedPartner];
        if (data.defaultIncoterms) {
          setDefaultIncoterm(data.defaultIncoterms as Incoterm);
        } else {
          setDefaultIncoterm("FOB");
        }
        
        if (data.allowedIncoterms) {
          setAllowedIncoterms(data.allowedIncoterms);
        } else {
          setAllowedIncoterms({ FOB: true, CIF: true, EXW: true });
        }
      } else if (selectedPartner) {
        setAllPrices((prev) => ({ ...prev, [selectedPartner]: { FOB: {}, CIF: {}, EXW: {} } }));
        setDefaultIncoterm("FOB");
        setAllowedIncoterms({ FOB: true, CIF: true, EXW: true });
      }
    });
    return () => unsub();
  }, [selectedPartner]);

  // 파트너 목록 로드
  useEffect(() => {
    const q = query(collection(db, "partners"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snapshot: any) => {
      const list = snapshot.docs.map((d: any) => ({
        id: d.id,
        name: d.data().name || "Unknown Partner",
        code: d.data().code || d.data().country || "MF",
        defaultIncoterms: d.data().defaultIncoterms || "FOB",
        ...d.data(),
      }));
      setDbPartners(list);
      if (list.length > 0 && !selectedPartner) {
        const first = list[0];
        setSelectedPartner(first.id);
        setDefaultIncoterm(first.defaultIncoterms || "FOB");
      }
    });
    return () => unsub();
  }, [selectedPartner]);

  // 상품 목록 로드
  useEffect(() => {
    if (dbPartners.length === 0) return;
    const q = query(collection(db, "products"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProducts(data);

      // 초기 가격 세팅 (DB 미등록 파트너/상품)
      setAllPrices((prev) => {
        const initial = { ...prev };
        dbPartners.forEach((p) => {
          if (!initial[p.id]) {
            initial[p.id] = { FOB: {}, CIF: {}, EXW: {} };
          }
          data.forEach((prod: any) => {
            const defaultPrice = prod.price || (prod.cost ? prod.cost * 1.2 : 0);
            (["FOB", "CIF", "EXW"] as Incoterm[]).forEach((term) => {
              if (initial[p.id][term][prod.id] === undefined) {
                initial[p.id][term][prod.id] = defaultPrice;
              }
            });
          });
        });
        return initial;
      });
      setLoading(false);
    });
    return () => unsub();
  }, [dbPartners]);

  const handlePriceChange = (productId: string, value: string) => {
    const newPrice = parseFloat(value) || 0;
    setAllPrices((prev) => ({
      ...prev,
      [selectedPartner]: {
        ...prev[selectedPartner],
        [selectedIncoterm]: {
          ...(prev[selectedPartner]?.[selectedIncoterm] || {}),
          [productId]: newPrice,
        },
      },
    }));
  };

  const handleSavePrices = async () => {
    if (!selectedPartner) return;
    try {
      setSaving(true);
      const partnerPrices = allPrices[selectedPartner] || { FOB: {}, CIF: {}, EXW: {} };
      await setDoc(doc(db, "prices", selectedPartner), {
        incoterms: partnerPrices,
        prices: partnerPrices.FOB, // 하위 호환 유지
        defaultIncoterms: defaultIncoterm,
        allowedIncoterms: allowedIncoterms,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || user?.email || "system",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      alert("가격 저장 실패: " + error);
    } finally {
      setSaving(false);
    }
  };

  const currentPartnerData = dbPartners.find((p) => p.id === selectedPartner);
  const currentPrices = allPrices[selectedPartner]?.[selectedIncoterm] || {};
  const activeIncoterm = INCOTERMS.find((t) => t.key === selectedIncoterm)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">MF별 판매가 설정</h2>
          <p className="text-muted-foreground mt-2">
            파트너사 및 무역조건(Incoterms)별 공급 단가를 개별 설정합니다.
          </p>
        </div>
        <Button
          className={cn(
            "flex items-center gap-2 transition-all",
            saved ? "bg-emerald-600 hover:bg-emerald-700" : "bg-green-600 hover:bg-green-700"
          )}
          onClick={handleSavePrices}
          disabled={saving || !selectedPartner}
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> 저장 중...</>
          ) : saved ? (
            <><Check className="h-4 w-4" /> 저장 완료!</>
          ) : (
            <><Save className="h-4 w-4" /> 현재 설정 저장</>
          )}
        </Button>
      </div>

      {/* 파트너사 선택 + 기본 무역조건 */}
      <div className="bg-card p-5 rounded-xl border shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">대상 파트너사</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedPartner}
              onChange={(e) => {
                setSelectedPartner(e.target.value);
                const partner = dbPartners.find((p) => p.id === e.target.value);
                // The useEffect will load the actual prices and allowed/default incoterms for this partner
              }}
            >
              {dbPartners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold">
              기본 무역조건 (Default Incoterms)
              <span className="ml-2 text-xs text-muted-foreground font-normal">— 발주 시 기본값</span>
            </label>
            <div className="flex gap-2">
              {INCOTERMS.map((term) => (
                <button
                  key={term.key}
                  onClick={() => setDefaultIncoterm(term.key)}
                  disabled={!allowedIncoterms[term.key]}
                  className={cn(
                    "flex-1 h-10 rounded-md text-sm font-bold border-2 transition-all",
                    defaultIncoterm === term.key
                      ? cn(term.bg, term.border, term.color)
                      : "border-border text-muted-foreground hover:bg-muted",
                    !allowedIncoterms[term.key] && "opacity-50 cursor-not-allowed bg-slate-100"
                  )}
                >
                  {term.key}
                </button>
              ))}
            </div>
          </div>
          
          <div className="space-y-1.5 md:col-span-2 border-t pt-4 mt-2">
            <label className="text-sm font-semibold flex items-center gap-2">
              MF사 발주 가능 조건 (Allowed Incoterms)
              <span className="text-xs text-muted-foreground font-normal">— MF사가 발주 신청 시 선택 가능한 무역조건을 제어합니다.</span>
            </label>
            <div className="flex gap-4">
              {INCOTERMS.map((term) => (
                <label key={`allow-${term.key}`} className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={allowedIncoterms[term.key]}
                    onChange={(e) => {
                      const newAllowed = { ...allowedIncoterms, [term.key]: e.target.checked };
                      setAllowedIncoterms(newAllowed);
                      // 기본 무역조건이 차단되면 첫 번째 허용된 조건으로 변경
                      if (!e.target.checked && defaultIncoterm === term.key) {
                        const firstAllowed = INCOTERMS.find(t => newAllowed[t.key])?.key;
                        if (firstAllowed) setDefaultIncoterm(firstAllowed);
                      }
                    }}
                  />
                  <span className={cn("text-sm font-semibold", term.color)}>{term.key} 허용</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className={cn("p-3 rounded-lg border flex gap-2 text-sm", activeIncoterm.bg, activeIncoterm.border)}>
          <Info className={cn("h-4 w-4 shrink-0 mt-0.5", activeIncoterm.color)} />
          <p className={activeIncoterm.color}>
            <strong>{currentPartnerData?.name || "파트너사"}</strong> — {activeIncoterm.label}: {activeIncoterm.desc}
          </p>
        </div>
      </div>

      {/* Incoterms 탭 */}
      <div className="flex gap-2">
        {INCOTERMS.map((term) => {
          const isActive = selectedIncoterm === term.key;
          return (
            <button
              key={term.key}
              onClick={() => setSelectedIncoterm(term.key)}
              className={cn(
                "flex flex-col items-start px-5 py-3 rounded-xl border-2 transition-all flex-1 text-left",
                isActive
                  ? cn(term.bg, term.border, term.color, "shadow-sm")
                  : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("text-base font-black font-mono", isActive ? term.color : "")}>
                  {term.key}
                </span>
                {defaultIncoterm === term.key && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                    기본값
                  </span>
                )}
              </div>
              <span className={cn("text-[11px] leading-snug", isActive ? term.color : "text-muted-foreground")}>
                {term.desc.split("—")[0].trim()}
              </span>
            </button>
          );
        })}
      </div>

      {/* 가격 테이블 */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className={cn("px-4 py-2.5 border-b flex items-center gap-2", activeIncoterm.bg)}>
          <Tag className={cn("h-4 w-4", activeIncoterm.color)} />
          <span className={cn("text-sm font-bold", activeIncoterm.color)}>
            {currentPartnerData?.name || "—"} · {selectedIncoterm} 기준 판매단가
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>제품 정보</TableHead>
              <TableHead>기본 매입가 (HQ Cost)</TableHead>
              <TableHead className="w-[60px]"></TableHead>
              <TableHead className="w-[200px]">
                <span className={cn("font-bold", activeIncoterm.color)}>
                  {selectedIncoterm} 공급가 (Selling Price)
                </span>
              </TableHead>
              <TableHead>마진</TableHead>
              <TableHead>마진율</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <tr>
                <td colSpan={6} className="h-32 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </td>
              </tr>
            ) : (
              products.map((product: any) => {
                const baseCost = product.cost || product.baseCost || 0;
                const sellingPrice = currentPrices[product.id] ?? (product.price || (baseCost * 1.2));
                const margin = sellingPrice - baseCost;
                const marginPercent = baseCost > 0 ? ((margin / baseCost) * 100).toFixed(1) : "0.0";

                return (
                  <TableRow key={product.id} className="hover:bg-muted/5">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{product.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{product.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono">
                      ${Number(baseCost).toFixed(2)}
                    </TableCell>
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
                          className={cn(
                            "w-full h-9 font-medium font-mono",
                            margin < 0 ? "border-red-300 focus:border-red-500" : "border-primary/20 focus:border-primary"
                          )}
                          step="0.01"
                        />
                      </div>
                    </TableCell>
                    <TableCell className={cn("font-medium font-mono", margin >= 0 ? "text-green-600" : "text-destructive")}>
                      ${margin.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={parseFloat(marginPercent) > 10 ? "default" : "secondary"}
                        className="font-mono"
                      >
                        {marginPercent}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
