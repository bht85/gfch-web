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
const getCategories = (lang: string) => [
  { id: "RAW", label: lang === "KO" ? "식자재" : "Food Ingredient" },
  { id: "PACKAGING", label: lang === "KO" ? "포장재" : "Packaging" },
  { id: "UNIFORM", label: lang === "KO" ? "유니폼" : "Uniform" },
  { id: "CONSUMABLE", label: lang === "KO" ? "소모품" : "Consumable" },
  { id: "EQUIPMENT", label: lang === "KO" ? "장비" : "Equipment" },
  { id: "EQUIPMENT_PARTS", label: lang === "KO" ? "장비부품" : "Equipment Parts" },
];

export default function ProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const CATEGORIES = getCategories(lang);

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
    vendor: "Seoul Logistics",
    productCode: "",
    nameKo: "",
    nameEn: "",
    maker: "",
    country: "",
    expiration: "",
    spec: "",
    netVolume: "",
    width: "",
    length: "",
    height: "",
    cbm: "",
    netWeight: "",
    grossWeight: "",
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

  // 새 제품 등록용 원화/환율 실시간 달러 환산 및 CBM 계산 핸들러
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

      // 가로, 세로, 높이가 입력되면 CBM 계산
      if (field === "width" || field === "length" || field === "height") {
        const w = parseFloat(next.width);
        const l = parseFloat(next.length);
        const h = parseFloat(next.height);
        if (!isNaN(w) && !isNaN(l) && !isNaN(h)) {
          next.cbm = ((w * l * h) / 1000000).toFixed(4);
        }
      }
      return next;
    });
  };

  // 제품 수정용 원화/환율 실시간 달러 환산 및 CBM 계산 핸들러
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

      // 가로, 세로, 높이가 입력되면 CBM 계산
      if (field === "width" || field === "length" || field === "height") {
        const w = parseFloat(next.width);
        const l = parseFloat(next.length);
        const h = parseFloat(next.height);
        if (!isNaN(w) && !isNaN(l) && !isNaN(h)) {
          next.cbm = ((w * l * h) / 1000000).toFixed(4);
        }
      }
      return next;
    });
  };

  const handleAddProduct = async () => {
    const nameKo = formData.nameKo.trim();
    const nameEn = formData.nameEn.trim();
    if (!nameKo && !nameEn) {
      alert(lang === "KO" ? "품목명(국문 또는 영문)을 입력해주세요." : "Please enter product name (Korean or English).");
      return;
    }
    
    // 호환성을 위해 name 필드 합성
    const combinedName = nameKo && nameEn ? `${nameKo} (${nameEn})` : (nameKo || nameEn);

    try {
      const dataToSave = {
        name: combinedName,
        nameKo,
        nameEn,
        productCode: formData.productCode.trim(),
        category: formData.category,
        vendor: formData.vendor.trim(),
        maker: formData.maker.trim(),
        country: formData.country.trim(),
        expiration: formData.expiration.trim(),
        spec: formData.spec.trim(),
        netVolume: formData.netVolume.trim(),
        width: parseFloat(formData.width) || 0,
        length: parseFloat(formData.length) || 0,
        height: parseFloat(formData.height) || 0,
        cbm: parseFloat(formData.cbm) || 0,
        netWeight: parseFloat(formData.netWeight) || 0,
        grossWeight: parseFloat(formData.grossWeight) || 0,
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
        vendor: "Seoul Logistics",
        productCode: "",
        nameKo: "",
        nameEn: "",
        maker: "",
        country: "",
        expiration: "",
        spec: "",
        netVolume: "",
        width: "",
        length: "",
        height: "",
        cbm: "",
        netWeight: "",
        grossWeight: "",
      });
      setIsAddModalOpen(false);
    } catch (error) {
      alert("Error adding product");
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    const nameKo = editingProduct.nameKo?.trim() || "";
    const nameEn = editingProduct.nameEn?.trim() || "";
    if (!nameKo && !nameEn) {
      alert(lang === "KO" ? "품목명(국문 또는 영문)을 입력해주세요." : "Please enter product name (Korean or English).");
      return;
    }
    const combinedName = nameKo && nameEn ? `${nameKo} (${nameEn})` : (nameKo || nameEn);

    try {
      const { id, ...rawContent } = editingProduct;
      const dataToSave = {
        name: combinedName,
        nameKo,
        nameEn,
        productCode: (rawContent.productCode || "").trim(),
        category: rawContent.category,
        vendor: (rawContent.vendor || "").trim(),
        maker: (rawContent.maker || "").trim(),
        country: (rawContent.country || "").trim(),
        expiration: (rawContent.expiration || "").trim(),
        spec: (rawContent.spec || "").trim(),
        netVolume: (rawContent.netVolume || "").trim(),
        width: parseFloat(rawContent.width) || 0,
        length: parseFloat(rawContent.length) || 0,
        height: parseFloat(rawContent.height) || 0,
        cbm: parseFloat(rawContent.cbm) || 0,
        netWeight: parseFloat(rawContent.netWeight) || 0,
        grossWeight: parseFloat(rawContent.grossWeight) || 0,
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
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{lang === "KO" ? "새 제품 등록" : "Register New Product"}</DialogTitle>
              <DialogDescription>{lang === "KO" ? "제품 정보와 공급처를 입력하세요." : "Enter product details and vendor info."}</DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="productCode">{lang === "KO" ? "품목코드" : "Item Code"}</Label>
                <Input id="productCode" value={formData.productCode} onChange={(e) => handleFormDataChange("productCode", e.target.value)} placeholder="예: PA-01" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">{lang === "KO" ? "품목" : "Category"}</Label>
                <select 
                  id="category"
                  className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3"
                  value={formData.category}
                  onChange={(e) => handleFormDataChange("category", e.target.value)}
                >
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="nameKo">{lang === "KO" ? "품목명 (국문)" : "Product Name (Ko)"}</Label>
                <Input id="nameKo" value={formData.nameKo} onChange={(e) => handleFormDataChange("nameKo", e.target.value)} placeholder="국문 품목명" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nameEn">{lang === "KO" ? "품목명 (영문)" : "Product Name (En)"}</Label>
                <Input id="nameEn" value={formData.nameEn} onChange={(e) => handleFormDataChange("nameEn", e.target.value)} placeholder="영문 품목명" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="vendor">{lang === "KO" ? "공급사" : "Vendor"}</Label>
                <Input id="vendor" value={formData.vendor} onChange={(e) => handleFormDataChange("vendor", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maker">{lang === "KO" ? "제조사명" : "Manufacturer"}</Label>
                <Input id="maker" value={formData.maker} onChange={(e) => handleFormDataChange("maker", e.target.value)} placeholder="제조사명" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="country">{lang === "KO" ? "제조국가" : "Country of Origin"}</Label>
                <Input id="country" value={formData.country} onChange={(e) => handleFormDataChange("country", e.target.value)} placeholder="예: 대한민국" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expiration">{lang === "KO" ? "소비기한" : "Shelf Life"}</Label>
                <Input id="expiration" value={formData.expiration} onChange={(e) => handleFormDataChange("expiration", e.target.value)} placeholder="예: 제조일로부터 12개월" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="spec">{lang === "KO" ? "규격" : "Specification"}</Label>
                <Input id="spec" value={formData.spec} onChange={(e) => handleFormDataChange("spec", e.target.value)} placeholder="예: 500g, Box" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="netVolume">{lang === "KO" ? "제품 순증량" : "Net Content"}</Label>
                <Input id="netVolume" value={formData.netVolume} onChange={(e) => handleFormDataChange("netVolume", e.target.value)} placeholder="예: 450g" />
              </div>

              {/* 포장 박스 규격 정보 */}
              <div className="col-span-2 border-t pt-4 mt-2">
                <h4 className="text-xs font-bold text-slate-700 mb-3">
                  📦 {lang === "KO" ? "포장 박스 크기 및 CBM" : "Box Dimensions & CBM"}
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="width" className="text-[11px] text-muted-foreground">{lang === "KO" ? "가로 (cm)" : "Width (cm)"}</Label>
                    <Input id="width" type="number" placeholder="0" value={formData.width} onChange={(e) => handleFormDataChange("width", e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="length" className="text-[11px] text-muted-foreground">{lang === "KO" ? "세로 (cm)" : "Length (cm)"}</Label>
                    <Input id="length" type="number" placeholder="0" value={formData.length} onChange={(e) => handleFormDataChange("length", e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="height" className="text-[11px] text-muted-foreground">{lang === "KO" ? "높이 (cm)" : "Height (cm)"}</Label>
                    <Input id="height" type="number" placeholder="0" value={formData.height} onChange={(e) => handleFormDataChange("height", e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="cbm" className="text-[11px] text-primary font-bold">{lang === "KO" ? "CBM (자동)" : "CBM (Auto)"}</Label>
                    <Input id="cbm" type="number" placeholder="0.0000" className="border-primary/50 bg-primary/5 font-mono" value={formData.cbm} onChange={(e) => handleFormDataChange("cbm", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* 무게 정보 */}
              <div className="col-span-2 grid grid-cols-2 gap-4 border-t pt-4 mt-2">
                <div className="grid gap-2">
                  <Label htmlFor="netWeight">{lang === "KO" ? "Net Weight (kg)" : "Net Weight (kg)"}</Label>
                  <Input id="netWeight" type="number" placeholder="0.0" value={formData.netWeight} onChange={(e) => handleFormDataChange("netWeight", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="grossWeight">{lang === "KO" ? "Gross Weight (kg)" : "Gross Weight (kg)"}</Label>
                  <Input id="grossWeight" type="number" placeholder="0.0" value={formData.grossWeight} onChange={(e) => handleFormDataChange("grossWeight", e.target.value)} />
                </div>
              </div>

              {/* 본사 매입가 정보 */}
              <div className="col-span-2 border-t pt-4 mt-2 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  💵 {lang === "KO" ? "본사매입가 계산기 (원화 ➡️ 달러)" : "HQ Purchase Price Calculator (KRW ➡️ USD)"}
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
              <TableHead>{lang === "KO" ? "품목코드" : "Code"}</TableHead>
              <TableHead>{lang === "KO" ? "품목명" : "Product Name"}</TableHead>
              <TableHead>{lang === "KO" ? "품목 (분류)" : "Category"}</TableHead>
              <TableHead>{lang === "KO" ? "규격" : "Specification"}</TableHead>
              <TableHead>{lang === "KO" ? "공급사 / 제조사" : "Vendor / Maker"}</TableHead>
              <TableHead className="text-right">{lang === "KO" ? "본사매입가" : "HQ Purchase Price"}</TableHead>
              <TableHead className="text-right">{lang === "KO" ? "관리" : "Manage"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-mono text-xs font-bold">{product.productCode || product.id.substring(0,6)}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">{product.nameKo || product.name || "-"}</span>
                    {product.nameEn && <span className="text-xs text-muted-foreground font-mono">{product.nameEn}</span>}
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">{CATEGORIES.find(c => c.id === product.category)?.label || product.category}</Badge></TableCell>
                <TableCell className="text-xs">{product.spec || "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-col text-xs text-slate-700">
                    <span className="flex items-center gap-1"><Truck className="h-3 w-3 text-muted-foreground" /> {product.vendor || "-"}</span>
                    {product.maker && <span className="text-[10px] text-muted-foreground pl-4">Mfg: {product.maker}</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-semibold text-sm">${parseFloat(product.cost || 0).toFixed(2)}</span>
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
                        productCode: product.productCode || "",
                        nameKo: product.nameKo || "",
                        nameEn: product.nameEn || "",
                        maker: product.maker || "",
                        country: product.country || "",
                        expiration: product.expiration || "",
                        spec: product.spec || "",
                        netVolume: product.netVolume || "",
                        width: product.width !== undefined ? product.width.toString() : "",
                        length: product.length !== undefined ? product.length.toString() : "",
                        height: product.height !== undefined ? product.height.toString() : "",
                        cbm: product.cbm !== undefined ? product.cbm.toString() : "",
                        netWeight: product.netWeight !== undefined ? product.netWeight.toString() : "",
                        grossWeight: product.grossWeight !== undefined ? product.grossWeight.toString() : "",
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
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{lang === "KO" ? "제품 정보 수정" : "Edit Product"}</DialogTitle>
            <DialogDescription>{lang === "KO" ? "공급처 및 제품 상세 정보를 수정합니다." : "Update product and vendor details."}</DialogDescription>
          </DialogHeader>
          
          {editingProduct && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="grid gap-2">
                <Label>{lang === "KO" ? "제품 코드" : "Product ID"}</Label>
                <Input value={editingProduct.id} disabled className="bg-muted font-mono" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-productCode">{lang === "KO" ? "품목코드" : "Item Code"}</Label>
                <Input id="edit-productCode" value={editingProduct.productCode} onChange={(e) => handleEditingProductChange("productCode", e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-nameKo">{lang === "KO" ? "품목명 (국문)" : "Product Name (Ko)"}</Label>
                <Input id="edit-nameKo" value={editingProduct.nameKo} onChange={(e) => handleEditingProductChange("nameKo", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-nameEn">{lang === "KO" ? "품목명 (영문)" : "Product Name (En)"}</Label>
                <Input id="edit-nameEn" value={editingProduct.nameEn} onChange={(e) => handleEditingProductChange("nameEn", e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-vendor">{lang === "KO" ? "공급사" : "Vendor"}</Label>
                <Input id="edit-vendor" value={editingProduct.vendor} onChange={(e) => handleEditingProductChange("vendor", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-maker">{lang === "KO" ? "제조사명" : "Manufacturer"}</Label>
                <Input id="edit-maker" value={editingProduct.maker} onChange={(e) => handleEditingProductChange("maker", e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-country">{lang === "KO" ? "제조국가" : "Country of Origin"}</Label>
                <Input id="edit-country" value={editingProduct.country} onChange={(e) => handleEditingProductChange("country", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-expiration">{lang === "KO" ? "소비기한" : "Shelf Life"}</Label>
                <Input id="edit-expiration" value={editingProduct.expiration} onChange={(e) => handleEditingProductChange("expiration", e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-spec">{lang === "KO" ? "규격" : "Specification"}</Label>
                <Input id="edit-spec" value={editingProduct.spec} onChange={(e) => handleEditingProductChange("spec", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-netVolume">{lang === "KO" ? "제품 순증량" : "Net Content"}</Label>
                <Input id="edit-netVolume" value={editingProduct.netVolume} onChange={(e) => handleEditingProductChange("netVolume", e.target.value)} />
              </div>

              <div className="grid gap-2 col-span-2">
                <Label htmlFor="edit-category">{lang === "KO" ? "품목" : "Category"}</Label>
                <select 
                  id="edit-category"
                  className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3"
                  value={editingProduct.category}
                  onChange={(e) => handleEditingProductChange("category", e.target.value)}
                >
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              {/* 포장 박스 규격 정보 */}
              <div className="col-span-2 border-t pt-4 mt-2">
                <h4 className="text-xs font-bold text-slate-700 mb-3">
                  📦 {lang === "KO" ? "포장 박스 크기 및 CBM" : "Box Dimensions & CBM"}
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-width" className="text-[11px] text-muted-foreground">{lang === "KO" ? "가로 (cm)" : "Width (cm)"}</Label>
                    <Input id="edit-width" type="number" placeholder="0" value={editingProduct.width} onChange={(e) => handleEditingProductChange("width", e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-length" className="text-[11px] text-muted-foreground">{lang === "KO" ? "세로 (cm)" : "Length (cm)"}</Label>
                    <Input id="edit-length" type="number" placeholder="0" value={editingProduct.length} onChange={(e) => handleEditingProductChange("length", e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-height" className="text-[11px] text-muted-foreground">{lang === "KO" ? "높이 (cm)" : "Height (cm)"}</Label>
                    <Input id="edit-height" type="number" placeholder="0" value={editingProduct.height} onChange={(e) => handleEditingProductChange("height", e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-cbm" className="text-[11px] text-primary font-bold">{lang === "KO" ? "CBM (자동)" : "CBM (Auto)"}</Label>
                    <Input id="edit-cbm" type="number" placeholder="0.0000" className="border-primary/50 bg-primary/5 font-mono" value={editingProduct.cbm} onChange={(e) => handleEditingProductChange("cbm", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* 무게 정보 */}
              <div className="col-span-2 grid grid-cols-2 gap-4 border-t pt-4 mt-2">
                <div className="grid gap-2">
                  <Label htmlFor="edit-netWeight">{lang === "KO" ? "Net Weight (kg)" : "Net Weight (kg)"}</Label>
                  <Input id="edit-netWeight" type="number" placeholder="0.0" value={editingProduct.netWeight} onChange={(e) => handleEditingProductChange("netWeight", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-grossWeight">{lang === "KO" ? "Gross Weight (kg)" : "Gross Weight (kg)"}</Label>
                  <Input id="edit-grossWeight" type="number" placeholder="0.0" value={editingProduct.grossWeight} onChange={(e) => handleEditingProductChange("grossWeight", e.target.value)} />
                </div>
              </div>

              {/* 원화 입력 ➡️ 달러 변환 계산기 세션 (수정 모드) */}
              <div className="col-span-2 border-t pt-4 mt-2 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  💵 {lang === "KO" ? "본사매입가 계산기 (원화 ➡️ 달러)" : "HQ Purchase Price Calculator (KRW ➡️ USD)"}
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
