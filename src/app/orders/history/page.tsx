"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, FileDown, Calendar, FileText, CheckCircle2, Clock, Truck, PackageCheck, Receipt, Download, Upload, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, query, where, deleteField, addDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";

// 7단계 워크플로우 정의
const getWorkflowStages = (t: any) => [
  { id: "DRAFT", label: t("draft"), color: "bg-gray-100 text-gray-700 border-gray-200", icon: FileText },
  { id: "PENDING", label: t("pendingApproval"), color: "bg-red-100 text-red-700 border-red-200", icon: Clock },
  { id: "PAYMENT_PENDING", label: t("pendingPayment"), color: "bg-orange-100 text-orange-700 border-orange-200", icon: Receipt },
  { id: "PREPARING", label: t("preparing"), color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: PackageCheck },
  { id: "SHIPPING", label: t("shipping_status"), color: "bg-blue-100 text-blue-700 border-blue-200", icon: Truck },
  { id: "DELIVERED", label: t("delivered"), color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: CheckCircle2 },
  { id: "COMPLETED", label: t("completed"), color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
];

const MOCK_PARTNERS = [
  { id: "MF-01", name: "Japan Master Franchise" },
  { id: "MF-02", name: "Vietnam Food Corp" },
];

export default function OrderHistoryPage() {
  const { user } = useAuth();
  const { t, lang } = useTranslation();
  const isHQ = user?.role === "HQ";
  const WORKFLOW_STAGES = getWorkflowStages(t);

  const [selectedPartner, setSelectedPartner] = useState(isHQ ? MOCK_PARTNERS[0].id : user?.role || "");
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{key: string, idx: number} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !isHQ) {
      setSelectedPartner(user.role);
    }
  }, [user, isHQ]);

  // Firestore 실시간 필터링 조회 (나의 발주 내역)
  useEffect(() => {
    const q = query(collection(db, "orders"), where("partnerId", "==", selectedPartner));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
      setLoading(false);

      if (selectedOrder) {
        const updated = ordersData.find(o => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
      }
    });

    return () => unsubscribe();
  }, [selectedPartner, selectedOrder?.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docKey: string) => {
    const file = e.target.files?.[0];
    if (!file || !selectedOrder) return;

    // 파일 크기 검증 (최대 5MB)
    const maxSize = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_BYTES) || 5242880;
    if (file.size > maxSize) {
      alert(lang === "KO" ? "파일 크기가 5MB를 초과합니다." : "File size exceeds 5MB limit.");
      e.target.value = "";
      return;
    }

    // 허용 파일 타입 검증
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      alert(lang === "KO" ? "PDF, JPG, PNG 파일만 업로드할 수 있습니다." : "Only PDF, JPG, PNG files are allowed.");
      e.target.value = "";
      return;
    }

    setUploadingDoc(docKey);
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(",")[1];
        const GAS_URL = process.env.NEXT_PUBLIC_GAS_UPLOAD_URL;

        if (!GAS_URL) {
          console.error("GAS Upload URL not configured");
          setUploadingDoc(null);
          alert(lang === "KO" ? "업로드 설정이 올바르지 않습니다." : "Upload configuration error.");
          return;
        }
        
        const response = await fetch(GAS_URL, {
          method: "POST",
          body: JSON.stringify({
            filename: `${selectedOrder.id}_${docKey}_${file.name}`,
            contentType: file.type,
            base64Data: base64Data,
            apiKey: process.env.NEXT_PUBLIC_GAS_API_KEY || ""
          }),
        });

        const fallbackUrl = process.env.NEXT_PUBLIC_DRIVE_FALLBACK_URL || "";
        let fileLink = fallbackUrl;
        
        try {
          const result = await response.json();
          if (result.status === "success" && result.fileUrl) {
            fileLink = result.fileUrl;
          }
        } catch (e) {
          console.log("Could not parse GAS response, using folder link fallback");
        }
        
        // 기존 문서 데이터 가져오기
        const existingDocs = selectedOrder.documents?.[docKey];
        const newDocUrls = Array.isArray(existingDocs) ? [...existingDocs, fileLink] : existingDocs ? [existingDocs, fileLink] : [fileLink];

        // Firestore 업데이트 (배열로 저장)
        await updateDoc(doc(db, "orders", selectedOrder.id), {
          [`documents.${docKey}`]: newDocUrls
        });

        // 알림 추가
        await addDoc(collection(db, "notifications"), {
          type: "FILE",
          orderId: selectedOrder.id,
          message: lang === "KO" ? `MF 파트너가 새로운 서류(${docKey.toUpperCase()})를 업로드했습니다.` : `MF Partner uploaded new document(${docKey.toUpperCase()}).`,
          isRead: false,
          createdAt: new Date().toISOString()
        });

        setUploadingDoc(null);
        alert(lang === "KO" ? "서류가 본사 드라이브로 업로드 되었습니다." : "Document uploaded to HQ Drive.");
      };
    } catch (error) {
      setUploadingDoc(null);
      alert(lang === "KO" ? "업로드 실패" : "Upload Failed");
    }
  };

  const getStageConfig = (statusId: string) => {
    return WORKFLOW_STAGES.find(s => s.id === statusId) || WORKFLOW_STAGES[0];
  };

  const renderTimeline = (currentStatus: string) => {
    const currentIndex = WORKFLOW_STAGES.findIndex(s => s.id === currentStatus);
    return (
      <div className="flex items-center justify-between w-full relative pt-2 pb-6 overflow-x-auto">
        <div className="absolute top-5 left-4 right-4 h-0.5 bg-muted z-0"></div>
        {WORKFLOW_STAGES.map((stage, index) => {
          const StageIcon = stage.icon;
          const isPast = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <div key={stage.id} className="relative z-10 flex flex-col items-center gap-2 min-w-[80px]">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors",
                isPast ? "bg-primary border-primary text-primary-foreground" : 
                isCurrent ? "bg-background border-primary text-primary ring-4 ring-primary/20" : 
                "bg-background border-muted text-muted-foreground"
              )}>
                <StageIcon className="w-4 h-4" />
              </div>
              <span className={cn("text-[10px] font-bold text-center", isCurrent ? "text-primary" : "text-muted-foreground")}>{stage.label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDocumentRow = (label: string, docKey: string, docData: any, uploader: string, isRequiredNow: boolean = false) => {
    const docUrls = Array.isArray(docData) ? docData : docData ? [docData] : [];
    const isUploaded = docUrls.length > 0;
    const isUploading = uploadingDoc === docKey;
    
    return (
      <div className="flex flex-col p-3 border rounded-lg bg-card gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", isUploaded ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground")}>
              {isUploaded ? <CheckCircle2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-xs font-bold">{label}</p>
              <p className="text-[9px] text-muted-foreground uppercase">{lang === "KO" ? "담당: " : "By: "}{uploader}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {uploader === "MF" ? (
              <>
                <input 
                  id={`file-${docKey}`}
                  type="file" 
                  className="hidden" 
                  onChange={(e) => handleFileUpload(e, docKey)}
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-[10px]"
                  onClick={() => document.getElementById(`file-${docKey}`)?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                  {isUploaded ? (lang === "KO" ? "추가" : "Add") : (lang === "KO" ? "업로드" : "Upload")}
                </Button>
              </>
            ) : !isUploaded && (
              <span className="text-[10px] text-muted-foreground italic">{lang === "KO" ? "본사 확인 중" : "Checking..."}</span>
            )}
          </div>
        </div>

        {isUploaded && (
          <div className="flex flex-wrap gap-1 mt-1 pt-2 border-t border-dashed">
            {docUrls.map((url, idx) => {
              const isConfirming = confirmDelete?.key === docKey && confirmDelete?.idx === idx;
              
              return (
                <div key={idx} className="flex items-center gap-1 bg-muted/50 p-1 rounded border">
                  {!isConfirming ? (
                    <>
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center h-6 text-[10px] px-2 py-0 bg-white border rounded hover:bg-slate-50 transition-colors"
                      >
                        <Eye className="w-3 h-3 mr-1" /> #{idx + 1}
                      </a>
                      {uploader === "MF" && (
                        <button 
                          type="button"
                          className="h-6 w-6 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete({ key: docKey, idx });
                          }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                      <button 
                        className="h-6 px-2 text-[9px] bg-red-500 text-white rounded hover:bg-red-600"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const newUrls = docUrls.filter((_, i) => i !== idx);
                            await updateDoc(doc(db, "orders", selectedOrder.id), {
                              [`documents.${docKey}`]: newUrls.length > 0 ? newUrls : deleteField()
                            });
                            setConfirmDelete(null);
                          } catch (err: any) {
                            alert((lang === "KO" ? "삭제 실패: " : "Delete Failed: ") + err.message);
                          }
                        }}
                      >
                        {lang === "KO" ? "삭제" : "Delete"}
                      </button>
                      <button 
                        className="h-6 px-2 text-[9px] bg-slate-200 text-slate-600 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(null);
                        }}
                      >
                        {lang === "KO" ? "취소" : "Cancel"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("myOrders")}</h2>
          <p className="text-muted-foreground mt-2">
            {lang === "KO" ? "나의 주문 상태를 실시간으로 확인하고 서류를 제출합니다." : "Real-time order tracking and document submission."}
          </p>
        </div>
      </div>

      <div className="bg-card p-6 rounded-lg border shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
          {isHQ && (
            <div className="space-y-1.5 flex-1 max-w-xs">
              <label className="text-sm font-medium">{lang === "KO" ? "계정 선택 (시뮬레이션)" : "Account Switcher (Simulation)"}</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                value={selectedPartner}
                onChange={(e) => setSelectedPartner(e.target.value)}
              >
                {MOCK_PARTNERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder={lang === "KO" ? "주문 번호로 검색..." : "Search by PO Number..."} className="pl-9" />
          </div>
        </div>

        <div className="rounded-md border">
          {loading ? (
             <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-2">
             <Loader2 className="w-8 h-8 animate-spin" />
             <p>{lang === "KO" ? "데이터 불러오는 중..." : "Loading Data..."}</p>
           </div>
          ) : (
            <Table>
              <TableHeader><TableRow className="bg-muted/50"><TableHead>{t("poNumber")}</TableHead><TableHead>{t("date")}</TableHead><TableHead>{lang === "KO" ? "품목 수" : "Items"}</TableHead><TableHead>{t("amount")}</TableHead><TableHead>{t("status")}</TableHead><TableHead className="text-right">{lang === "KO" ? "관리" : "Manage"}</TableHead></TableRow></TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const stage = getStageConfig(order.status);
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium font-mono text-xs">{order.id}</TableCell>
                      <TableCell><Calendar className="inline mr-2 h-3.5 w-3.5" />{order.date}</TableCell>
                      <TableCell>{order.items?.length || 0}{lang === "KO" ? "개 품목" : " items"}</TableCell>
                      <TableCell className="font-semibold">{order.amount}</TableCell>
                      <TableCell><Badge className={cn("border", stage.color)} variant="outline">{stage.label}</Badge></TableCell>
                      <TableCell className="text-right"><Button variant="outline" size="sm" className="h-8" onClick={() => setSelectedOrder(order)}><Eye className="mr-1.5 h-3 w-3" /> {t("viewDetail")}</Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader className="border-b pb-4 mb-4">
                <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                  {selectedOrder.id} <Badge className={cn("border", getStageConfig(selectedOrder.status).color)} variant="outline">{getStageConfig(selectedOrder.status).label}</Badge>
                </DialogTitle>
                <DialogDescription>{lang === "KO" ? "나의 발주건 실시간 진행 상황입니다." : "Real-time tracking for your order."}</DialogDescription>
              </DialogHeader>
              <div className="py-2 bg-muted/20 rounded-xl px-4 border border-border/50">
                <h3 className="text-sm font-bold mb-4 text-muted-foreground">{lang === "KO" ? "진행 상태 타임라인" : "Workflow Timeline"}</h3>
                {renderTimeline(selectedOrder.status)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="space-y-4 text-sm">
                  <h3 className="font-bold border-b pb-2">{lang === "KO" ? "주문 품목 상세 내역" : "Ordered Items Details"}</h3>
                  
                  {/* 품목별 상세 표 */}
                  <div className="rounded-lg border bg-card overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="text-xs py-2 h-8">{lang === "KO" ? "품목명" : "Item Name"}</TableHead>
                          <TableHead className="text-xs py-2 h-8 text-right">{lang === "KO" ? "단가" : "Price"}</TableHead>
                          <TableHead className="text-xs py-2 h-8 text-center">{lang === "KO" ? "수량" : "Qty"}</TableHead>
                          <TableHead className="text-xs py-2 h-8 text-right">{lang === "KO" ? "소계" : "Subtotal"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOrder.items && selectedOrder.items.length > 0 ? (
                          selectedOrder.items.map((item: any, idx: number) => (
                            <TableRow key={idx} className="hover:bg-muted/5">
                              <TableCell className="text-xs py-2 h-8 font-medium truncate max-w-[150px]">{item.name}</TableCell>
                              <TableCell className="text-xs py-2 h-8 text-right font-mono text-muted-foreground">${(item.price || 0).toFixed(2)}</TableCell>
                              <TableCell className="text-xs py-2 h-8 text-center font-bold">{item.qty || 0}</TableCell>
                              <TableCell className="text-xs py-2 h-8 text-right font-mono font-semibold">${((item.price || 0) * (item.qty || 0)).toFixed(2)}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-xs py-4 text-muted-foreground">
                              {lang === "KO" ? "상세 품목 정보가 없습니다." : "No item details available."}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="bg-muted/30 p-4 rounded-lg space-y-1">
                    <div className="flex justify-between font-bold text-base">
                      <span>{t("totalSum")}</span>
                      <span className="text-primary font-mono font-black">{selectedOrder.amount}</span>
                    </div>
                  </div>

                  {selectedOrder.status === "PAYMENT_PENDING" && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800">
                      <p className="font-bold">{lang === "KO" ? "송금 및 증빙 제출 단계" : "Payment & Document Phase"}</p>
                      <p className="mt-1 text-xs text-blue-600">
                        {lang === "KO" ? "본사의 PI를 확인하신 후, 송금을 완료하고 우측 메뉴에서 T/T Copy를 업로드해 주세요." : "Review the HQ Proforma Invoice, complete the remittance, and upload your T/T Copy from the right menu."}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold border-b pb-2">{t("docSubmission")}</h3>
                  <div className="space-y-2">
                    {renderDocumentRow("Proforma Invoice (PI)", "pi", selectedOrder.documents?.pi, "HQ")}
                    {renderDocumentRow(lang === "KO" ? "T/T Copy (해외 송금증)" : "T/T Copy (Wire Transfer)", "ttCopy", selectedOrder.documents?.ttCopy, "MF", selectedOrder.status === "PAYMENT_PENDING")}
                    {renderDocumentRow(lang === "KO" ? "은행 입금 확인증" : "Bank Receipt", "bankReceipt", selectedOrder.documents?.bankReceipt, "HQ")}
                    <div className="border-t border-dashed my-2"></div>
                    {renderDocumentRow(lang === "KO" ? "B/L 또는 AWB" : "B/L or AWB (Shipping Doc)", "bl", selectedOrder.documents?.bl, "HQ")}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
