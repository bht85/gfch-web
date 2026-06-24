"use client";

import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, query, orderBy, getDoc } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Edit2, Trash2, Search, Truck } from "lucide-react";

// 카테고리 정의
const getCategories = (t: any) => [
  { id: "RAW", label: t("rawMaterial") || "Raw Material" },
  { id: "CONSUMABLE", label: t("consumable") || "Consumable" },
  { id: "MD", label: t("mdProduct") || "MD Product" },
];

export default function ProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const CATEGORIES = getCategories(t);

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  
  // 시스템 기준 환율 (기본값 1340)
  const [systemExchangeRate, setSystemExchangeRate] = useState(1340);

  // 새 제품 폼 데이터
  const [formData, setFormData] = useState({
    name: "",
    category: "RAW",
    cost: "",
    costKrw: "",
    exchangeRate: "1340",
    vendor: "Seoul Logistics"
  });

  // 보안 체크
  useEffect(() => {
    if (!authLoading && user && user.role !== "HQ") {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // 1. 시스템 기준 환율 로드
  useEffect(() => {
    async function loadSystemConfig() {
      try {
        const docRef = doc(db, "system", "config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const rate = docSnap.data().rateKrw || 1340;
          setSystemExchangeRate(rate);
          setFormData(prev => ({ ...prev, exchangeRate: rate.toString() }));
        }
      } catch (err) {
        console.error("Error loading system config exchange rate:", err);
      }
    }
    loadSystemConfig();
  }, []);

  // 2. Firestore 실시간 조회
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 새 제품 등록용 원화/환율 실시간 달러 환산 핸들러
  const handleFormDataChange = (field: string, value: any) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      
      // 원화(costKrw) 또는 환율(exchangeRate)이 바뀌었으면 달러(cost) 자동 계산
      if (field === "costKrw" || field === "exchangeRate") {
        const krw = parseFloat(next.costKrw);
        const rate = parseFloat(next.exchangeRate);
        if (!isNaN(krw) && !isNaN(rate) && rate > 0) {
          next.cost = (krw / rate).toFixed(2);
        } else {
          next.cost = "";
        }
      }
      return next;
    });
  };

  // 제품 수정용 원화/환율 실시간 달러 환산 핸들러
  const handleEditingProductChange = (field: string, value: any) => {
    setEditingProduct((prev: any) => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      
      // 원화(costKrw) 또는 환율(exchangeRate)이 바뀌었으면 달러(cost) 자동 계산
      if (field === "costKrw" || field === "exchangeRate") {
        const krw = parseFloat(next.costKrw);
        const rate = parseFloat(next.exchangeRate);
        if (!isNaN(krw) && !isNaN(rate) && rate > 0) {
          next.cost = (krw / rate).toFixed(2);
        } else {
          next.cost = "";
        }
      }
      return next;
    });
  };

  const handleAddProduct = async () => {
    if (!formData.name) return;
    try {
      const dataToSave = {
        name: formData.name,
        category: formData.category,
        vendor: formData.vendor,
        cost: parseFloat(formData.cost) || 0,
        costKrw: parseFloat(formData.costKrw) || 0,
        exchangeRate: parseFloat(formData.exchangeRate) || systemExchangeRate || 1340,
      };
      await addDoc(collection(db, "products"), dataToSave);
      setFormData({
        name: "",
        category: "RAW",
        cost: "",
        costKrw: "",
        exchangeRate: systemExchangeRate.toString(),
        vendor: "Seoul Logistics"
      });
      setIsAddModalOpen(false);
    } catch (error) {
      alert("Error adding product");
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    try {
      const { id, ...rawContent } = editingProduct;
      const dataToSave = {
        name: rawContent.name,
        category: rawContent.category,
        vendor: rawContent.vendor,
        cost: parseFloat(rawContent.cost) || 0,
        costKrw: parseFloat(rawContent.costKrw) || 0,
        exchangeRate: parseFloat(rawContent.exchangeRate) || systemExchangeRate || 1340,
      };
      await updateDoc(doc(db, "products", id), dataToSave);
      setIsEditModalOpen(false);
    } catch (error) {
      alert("Error updating product");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm(lang === "KO" ? "정말 이 제품을 삭제하시겠습니까?" : "Are you sure you want to delete this product?")) {
      try {
        await deleteDoc(doc(db, "products", id));
      } catch (error) {
        alert("Error deleting product");
      }
    }
  };

  if (authLoading || (user && user.role !== "HQ")) {
    return <div className="h-96 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{lang === "KO" ? "제품 마스터 관리" : "Product Master Management"}</h2>
          <p className="text-muted-foreground mt-2">
            {lang === "KO" ? "발주 가능한 전체 제품 리스트 및 공급처를 관리합니다." : "Manage the global product list and vendors."}
          </p>
        </div>
        
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> {lang === "KO" ? "새 제품 등록" : "Add New Product"}
        </Button>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>{lang === "KO" ? "새 제품 등록" : "Register New Product"}</DialogTitle>
              <DialogDescription>{lang === "KO" ? "제품 정보와 공급처를 입력하세요." : "Enter product details and vendor info."}</DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{lang === "KO" ? "제품명" : "Product Name"}</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder={lang === "KO" ? "제품명을 입력하세요" : "Enter product name"} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="vendor">{lang === "KO" ? "공급사 (Vendor)" : "Vendor"}</Label>
                <Input id="vendor" value={formData.vendor} onChange={(e) => setFormData({...formData, vendor: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2 col-span-2">
                  <Label htmlFor="category">{lang === "KO" ? "카테고리" : "Category"}</Label>
                  <select 
                    id="category"
                    className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  >
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              
              {/* 원화 입력 ➡️ 달러 변환 계산기 세션 */}
              <div className="border-t pt-4 mt-2 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  💵 {lang === "KO" ? "매입 단가 계산기 (원화 ➡️ 달러)" : "Cost Calculator (KRW ➡️ USD)"}
                </h4>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="grid gap-1.5">
                    <Label htmlFor="costKrw" className="text-[11px] text-muted-foreground">{lang === "KO" ? "매입가 (₩)" : "Cost (₩)"}</Label>
                    <Input 
                      id="costKrw" 
                      type="number" 
                      placeholder="0" 
                      value={formData.costKrw} 
                      onChange={(e) => handleFormDataChange("costKrw", e.target.value)} 
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="exchangeRate" className="text-[11px] text-muted-foreground">{lang === "KO" ? "적용 환율 (₩/$)" : "Ex. Rate (₩/$)"}</Label>
                    <Input 
                      id="exchangeRate" 
                      type="number" 
                      placeholder="1340" 
                      value={formData.exchangeRate} 
                      onChange={(e) => handleFormDataChange("exchangeRate", e.target.value)} 
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="cost" className="text-[11px] text-primary font-bold">{lang === "KO" ? "환산 매입가 ($)" : "Calc. Cost ($)"}</Label>
                    <Input 
                      id="cost" 
                      type="number" 
                      placeholder="0.00" 
                      className="border-primary/50 bg-primary/5 font-bold font-mono"
                      value={formData.cost} 
                      onChange={(e) => handleFormDataChange("cost", e.target.value)} 
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 italic mt-1 leading-relaxed">
                  {lang === "KO" 
                    ? `* 입력한 원화 매입가를 적용 환율로 나누어 최종 달러($) 단가를 실시간 계산합니다.` 
                    : `* Computes final USD cost in real-time by dividing the KRW cost by the exchange rate.`}
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>{lang === "KO" ? "취소" : "Cancel"}</Button>
              <Button onClick={handleAddProduct}>{lang === "KO" ? "등록하기" : "Register"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder={lang === "KO" ? "제품명 또는 공급사 검색..." : "Search products or vendors..."} className="pl-9" />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>{lang === "KO" ? "제품 코드" : "Code"}</TableHead>
              <TableHead>{lang === "KO" ? "제품명" : "Product Name"}</TableHead>
              <TableHead>{lang === "KO" ? "공급사" : "Vendor"}</TableHead>
              <TableHead>{lang === "KO" ? "카테고리" : "Category"}</TableHead>
              <TableHead className="text-right">{lang === "KO" ? "HQ 매입 단가" : "HQ Cost"}</TableHead>
              <TableHead className="text-right">{lang === "KO" ? "관리" : "Manage"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-mono text-xs">{product.id.substring(0,6)}</TableCell>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell><div className="flex items-center gap-1.5 text-sm"><Truck className="h-3.5 w-3.5 text-muted-foreground" />{product.vendor}</div></TableCell>
                <TableCell><Badge variant="outline">{CATEGORIES.find(c => c.id === product.category)?.label || product.category}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-semibold text-sm">${parseFloat(product.cost || product.baseCost || 0).toFixed(2)}</span>
                    {product.costKrw ? (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ₩{parseInt(product.costKrw).toLocaleString()} ({product.exchangeRate || 1340})
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/60 italic font-mono">
                        (USD Only)
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { 
                      const initialRate = product.exchangeRate || systemExchangeRate || 1340;
                      const initialCostKrw = product.costKrw || (product.cost ? Math.round(parseFloat(product.cost) * initialRate).toString() : "");
                      setEditingProduct({ 
                        ...product, 
                        exchangeRate: initialRate.toString(),
                        costKrw: initialCostKrw
                      }); 
                      setIsEditModalOpen(true); 
                    }}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteProduct(product.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{lang === "KO" ? "제품 정보 수정" : "Edit Product"}</DialogTitle>
            <DialogDescription>{lang === "KO" ? "공급처 및 제품 상세 정보를 수정합니다." : "Update product and vendor details."}</DialogDescription>
          </DialogHeader>
          
          {editingProduct && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{lang === "KO" ? "제품 코드" : "Product ID"}</Label>
                <Input value={editingProduct.id} disabled className="bg-muted font-mono" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-name">{lang === "KO" ? "제품명" : "Product Name"}</Label>
                <Input id="edit-name" value={editingProduct.name} onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-vendor">{lang === "KO" ? "공급사" : "Vendor"}</Label>
                <Input id="edit-vendor" value={editingProduct.vendor} onChange={(e) => setEditingProduct({...editingProduct, vendor: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2 col-span-2">
                  <Label htmlFor="edit-category">{lang === "KO" ? "카테고리" : "Category"}</Label>
                  <select 
                    id="edit-category"
                    className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3"
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})}
                  >
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              {/* 원화 입력 ➡️ 달러 변환 계산기 세션 (수정 모드) */}
              <div className="border-t pt-4 mt-2 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  💵 {lang === "KO" ? "매입 단가 계산기 (원화 ➡️ 달러)" : "Cost Calculator (KRW ➡️ USD)"}
                </h4>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-costKrw" className="text-[11px] text-muted-foreground">{lang === "KO" ? "매입가 (₩)" : "Cost (₩)"}</Label>
                    <Input 
                      id="edit-costKrw" 
                      type="number" 
                      placeholder="0" 
                      value={editingProduct.costKrw || ""} 
                      onChange={(e) => handleEditingProductChange("costKrw", e.target.value)} 
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-exchangeRate" className="text-[11px] text-muted-foreground">{lang === "KO" ? "적용 환율 (₩/$)" : "Ex. Rate (₩/$)"}</Label>
                    <Input 
                      id="edit-exchangeRate" 
                      type="number" 
                      placeholder="1340" 
                      value={editingProduct.exchangeRate || ""} 
                      onChange={(e) => handleEditingProductChange("exchangeRate", e.target.value)} 
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-cost" className="text-[11px] text-primary font-bold">{lang === "KO" ? "환산 매입가 ($)" : "Calc. Cost ($)"}</Label>
                    <Input 
                      id="edit-cost" 
                      type="number" 
                      placeholder="0.00" 
                      className="border-primary/50 bg-primary/5 font-bold font-mono"
                      value={editingProduct.cost || ""} 
                      onChange={(e) => handleEditingProductChange("cost", e.target.value)} 
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 italic mt-1 leading-relaxed">
                  {lang === "KO" 
                    ? `* 입력한 원화 매입가를 적용 환율로 나누어 최종 달러($) 단가를 실시간 계산합니다.` 
                    : `* Computes final USD cost in real-time by dividing the KRW cost by the exchange rate.`}
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>{lang === "KO" ? "취소" : "Cancel"}</Button>
            <Button onClick={handleUpdateProduct}>{lang === "KO" ? "저장하기" : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
