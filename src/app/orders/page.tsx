"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, CheckCircle2, Clock, Truck, PackageCheck, Receipt, ArrowRight, Loader2, Upload, Eye, X, FileDown, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, query, orderBy, deleteField, addDoc } from "firebase/firestore";
import { seedOrders } from "@/lib/seed";
import { useDropzone } from "react-dropzone";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "next/navigation";

// 7단계 워크플로우 정의 함수화
const getWorkflowStages = (t: any) => [
  { id: "DRAFT", label: t("draft"), color: "bg-gray-100 text-gray-700 border-gray-200", icon: FileText },
  { id: "PENDING", label: t("pendingApproval"), color: "bg-red-100 text-red-700 border-red-200", icon: Clock },
  { id: "PAYMENT_PENDING", label: t("pendingPayment"), color: "bg-orange-100 text-orange-700 border-orange-200", icon: Receipt },
  { id: "PREPARING", label: t("preparing"), color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: PackageCheck },
  { id: "SHIPPING", label: t("shipping_status"), color: "bg-blue-100 text-blue-700 border-blue-200", icon: Truck },
  { id: "DELIVERED", label: t("delivered"), color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: CheckCircle2 },
  { id: "COMPLETED", label: t("completed"), color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
];

const DocumentRow = ({ 
  label, docKey, docData, uploader, isRequiredNow, lang, selectedOrder,
  uploadingDoc, handleFileUpload, confirmDelete, setConfirmDelete
}: any) => {
  const docUrls = Array.isArray(docData) ? docData : docData ? [docData] : [];
  const isUploaded = docUrls.length > 0;
  const isUploading = uploadingDoc === docKey;

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleFileUpload(acceptedFiles[0], docKey);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'application/pdf': [] },
    maxSize: 5242880,
    multiple: false
  });

  return (
    <div className={cn("flex flex-col p-4 border rounded-lg bg-card gap-3 transition-colors", isDragActive ? "border-primary bg-primary/5 border-dashed" : "", isRequiredNow ? "border-orange-300 bg-orange-50/30" : "")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", isUploaded ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground")}>
            {isUploaded ? <CheckCircle2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </div>
          <div>
            <p className="text-sm font-bold flex items-center gap-2">
              {label} 
              {isRequiredNow && <Badge variant="destructive" className="text-[9px] px-1 h-4">REQUIRED</Badge>}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase">{lang === "KO" ? "담당: " : "By: "}{uploader}</p>
          </div>
        </div>
      </div>

      {uploader === "HQ" && !isUploaded && (
        <div {...getRootProps()} className={cn("mt-2 border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors", isDragActive ? "border-primary bg-primary/10" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50")}>
          <input {...getInputProps()} />
          {isUploading ? (
            <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
          ) : (
            <Upload className={cn("w-6 h-6 mb-2", isDragActive ? "text-primary" : "text-muted-foreground")} />
          )}
          <p className="text-xs font-semibold">{isUploading ? (lang === "KO" ? "업로드 중..." : "Uploading...") : isDragActive ? (lang === "KO" ? "파일을 여기에 놓으세요" : "Drop the file here") : (lang === "KO" ? "클릭하거나 파일을 드래그하여 업로드" : "Drag & drop a file here, or click to select")}</p>
          <p className="text-[10px] text-muted-foreground mt-1">PDF, JPG, PNG (Max 5MB)</p>
        </div>
      )}
      
      {uploader === "MF" && !isUploaded && (
        <div className="mt-2 py-4 flex flex-col items-center justify-center text-center bg-muted/20 border border-dashed rounded-lg">
          <Clock className="w-5 h-5 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground italic">{lang === "KO" ? "MF 파트너가 제출 대기 중입니다." : "Awaiting MF submission."}</span>
        </div>
      )}

      {isUploaded && (
        <div className="flex flex-wrap gap-2 mt-2 pt-3 border-t border-dashed">
          {docUrls.map((url: string, idx: number) => {
            const isConfirming = confirmDelete?.key === docKey && confirmDelete?.idx === idx;
            return (
              <div key={idx} className="flex items-center gap-2 bg-muted/30 p-2 rounded-md border w-full justify-between">
                {!isConfirming ? (
                  <>
                    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:underline">
                      <FileText className="w-4 h-4" /> {label} #{idx + 1}
                    </a>
                    {uploader === "HQ" && (
                      <button type="button" className="h-7 w-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded" onClick={(e) => { e.stopPropagation(); setConfirmDelete({ key: docKey, idx }); }}>
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                    <span className="text-xs font-bold text-red-600 mr-2">{lang === "KO" ? "정말 삭제하시겠습니까?" : "Are you sure to delete?"}</span>
                    <button className="h-7 px-3 text-xs bg-red-500 text-white rounded hover:bg-red-600 font-bold" onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const newUrls = docUrls.filter((_: any, i: number) => i !== idx);
                        await updateDoc(doc(db, "orders", selectedOrder.id), {
                          [`documents.${docKey}`]: newUrls.length > 0 ? newUrls : deleteField()
                        });
                        setConfirmDelete(null);
                      } catch (err: any) {
                        alert((lang === "KO" ? "삭제 실패: " : "Delete Failed: ") + err.message);
                      }
                    }}>
                      {lang === "KO" ? "삭제" : "Delete"}
                    </button>
                    <button className="h-7 px-3 text-xs bg-slate-200 text-slate-700 rounded font-bold" onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}>
                      {lang === "KO" ? "취소" : "Cancel"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          
          {uploader === "HQ" && (
            <div {...getRootProps()} className={cn("mt-2 border-2 border-dashed rounded-lg p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-colors w-full", isDragActive ? "border-primary bg-primary/10" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50")}>
              <input {...getInputProps()} />
              {isUploading ? (
                <div className="flex items-center gap-2 text-xs font-bold text-primary"><Loader2 className="w-4 h-4 animate-spin" /> 업로드 중...</div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Plus className="w-4 h-4" /> {lang === "KO" ? "파일 추가 업로드" : "Upload Additional File"}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


export default function IntegratedOrderBoardPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const WORKFLOW_STAGES = getWorkflowStages(t);

  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{key: string, idx: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  // 보안 체크: 본사 관리자만 접근 가능
  useEffect(() => {
    if (!authLoading && user && user.role !== "HQ") {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Firestore 실시간 데이터 바인딩
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
      setLoading(false);
      
      // 모달이 열려있다면 선택된 주문 데이터도 업데이트
      if (selectedOrder) {
        const updated = ordersData.find(o => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
      }
    });

    return () => unsubscribe();
  }, [selectedOrder?.id]);

  const handleStatusChange = async (orderId: string, nextStatus: string) => {
    // 클라이언트 role 재검증 (HQ만 상태 변경 가능)
    if (user?.role !== "HQ") {
      alert(lang === "KO" ? "권한이 없습니다." : "Permission denied.");
      return;
    }
    try {
      await updateDoc(doc(db, "orders", orderId), { status: nextStatus });
      
      const stage = getStageConfig(nextStatus);
      await addDoc(collection(db, "notifications"), {
        type: "STATUS",
        orderId: orderId,
        message: lang === "KO" 
          ? `주문 ${orderId.substring(0,8)}...의 상태가 [${stage.label}]으로 변경되었습니다.`
          : `Order ${orderId.substring(0,8)}... status changed to [${stage.label}].`,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      alert(lang === "KO" ? "상태 변경 중 오류가 발생했습니다." : "Error changing status.");
    }
  };

  const generateInvoicePDF = (order: any) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(40);
    doc.text("PROFORMA INVOICE", 105, 20, { align: "center" });
    
    // Company Info
    doc.setFontSize(10);
    doc.text("GFCH Headquarters (Global Franchise Control Hub)", 14, 40);
    doc.text("123 Business Road, Seoul, Korea", 14, 45);
    doc.text("Email: ops@gfch-global.com | Web: www.gfch-global.com", 14, 50);
    
    // Invoice Info
    doc.setFontSize(10);
    doc.text(`Invoice No: INV-${order.id}`, 140, 40);
    doc.text(`Date: ${order.date}`, 140, 45);
    doc.text(`Partner: ${order.mf}`, 140, 50);
    
    // Items Table
    const tableData = order.items?.map((item: any) => [
      item.name,
      (item.qty || 0).toLocaleString(),
      `$${(item.price || 0).toLocaleString()}`,
      `$${((item.qty || 0) * (item.price || 0)).toLocaleString()}`
    ]) || [];
    
    autoTable(doc, {
      startY: 60,
      head: [['Product Name', 'Quantity', 'Unit Price', 'Total']],
      body: tableData,
      foot: [['', '', 'GRAND TOTAL', order.amount]],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
    });
    
    // Banking Info
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text("Banking Information for Remittance", 14, finalY);
    doc.setFontSize(9);
    doc.text("Bank Name: GLOBAL STANDARD BANK", 14, finalY + 7);
    doc.text("Account No: 110-456-789012 (USD)", 14, finalY + 12);
    doc.text("SWIFT Code: GBSBKRSExxx", 14, finalY + 17);
    doc.text("Beneficiary: GFCH CO., LTD.", 14, finalY + 22);
    
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("This is a computer-generated document and no signature is required.", 105, finalY + 40, { align: "center" });
    
    const blobUrl = doc.output('bloburl');
    setPreviewPdfUrl(blobUrl.toString());
  };

  const handleFileUpload = async (file: File | undefined, docKey: string) => {
    if (!file || !selectedOrder) return;

    // 파일 크기 검증 (최대 5MB)
    const maxSize = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_BYTES) || 5242880;
    if (file.size > maxSize) {
      alert(lang === "KO" ? "파일 크기가 5MB를 초과합니다." : "File size exceeds 5MB limit.");
      return;
    }

    // 허용 파일 타입 검증
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      alert(lang === "KO" ? "PDF, JPG, PNG 파일만 업로드할 수 있습니다." : "Only PDF, JPG, PNG files are allowed.");
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
          message: `${selectedOrder.mf} 파트너가 새로운 서류(${docKey.toUpperCase()})를 업로드했습니다.`,
          isRead: false,
          createdAt: new Date().toISOString()
        });

        setUploadingDoc(null);
        alert(lang === "KO" ? "업로드가 완료되어 DB에 저장되었습니다." : "Upload complete and saved to DB.");
      };
    } catch (error) {
      setUploadingDoc(null);
      alert(lang === "KO" ? "업로드 중 오류가 발생했습니다." : "Error during upload.");
    }
  };

  const getNextStatus = (currentStatus: string) => {
    const idx = WORKFLOW_STAGES.findIndex(s => s.id === currentStatus);
    if (idx >= 0 && idx < WORKFLOW_STAGES.length - 1) {
      return WORKFLOW_STAGES[idx + 1];
    }
    return null;
  };

  const filteredOrders = activeTab === "ALL" 
    ? orders 
    : orders.filter(o => o.status === activeTab);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{lang === "KO" ? "통합 주문 보드 (HQ)" : "Integrated Order Board (HQ)"}</h2>
          <p className="text-muted-foreground mt-2">
            {lang === "KO" ? "전 세계 MF에서 들어온 모든 발주건의 상태와 서류를 실시간 관리합니다." : "Real-time management of all orders and documents from global MF partners."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={seedOrders} variant="outline" size="sm" className="border-primary/50 text-primary">
            {lang === "KO" ? "샘플 데이터 갱신 (10건)" : "Refresh Sample Data (10)"}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <Button variant={activeTab === "ALL" ? "default" : "outline"} onClick={() => setActiveTab("ALL")} className="rounded-full">
          {lang === "KO" ? "전체 보기" : "View All"}
        </Button>
        {WORKFLOW_STAGES.filter(s => s.id !== "DRAFT").map(stage => (
          <Button key={stage.id} variant={activeTab === stage.id ? "default" : "outline"} onClick={() => setActiveTab(stage.id)} className={cn("rounded-full", activeTab === stage.id ? "" : "border-dashed text-muted-foreground")}>
            {stage.label} <span className="ml-2 bg-muted/20 px-1.5 py-0.5 rounded-full text-xs">{orders.filter(o => o.status === stage.id).length}</span>
          </Button>
        ))}
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p>데이터 불러오는 중...</p>
          </div>
        ) : (
          <Table>
            <TableHeader><TableRow className="bg-muted/30"><TableHead>{t("poNumber")}</TableHead><TableHead>{lang === "KO" ? "MF 파트너" : "MF Partner"}</TableHead><TableHead>{t("date")}</TableHead><TableHead>{t("amount")}</TableHead><TableHead>{t("status")}</TableHead><TableHead className="text-right">{lang === "KO" ? "관리" : "Manage"}</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const stage = getStageConfig(order.status);
                return (
                  <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedOrder(order)}>
                    <TableCell className="font-mono text-xs font-bold">{order.id}</TableCell>
                    <TableCell className="font-medium">{order.mf}</TableCell>
                    <TableCell>{order.date}</TableCell>
                    <TableCell className="font-semibold">{order.amount}</TableCell>
                    <TableCell><Badge className={cn("border", stage.color)} variant="outline">{stage.label}</Badge></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" className="text-blue-600">{lang === "KO" ? "상세 및 서류" : "Detail & Docs"}</Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto w-[90vw]">
          {selectedOrder && (() => {
            const currentStage = getStageConfig(selectedOrder.status);
            const nextStage = getNextStatus(selectedOrder.status);
            return (
              <>
                <DialogHeader className="border-b pb-4 mb-4">
                  <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                    {selectedOrder.id} <Badge className={cn("border", currentStage.color)} variant="outline">{currentStage.label}</Badge>
                  </DialogTitle>
                  <DialogDescription>{selectedOrder.mf} • {t("amount")}: {selectedOrder.amount}</DialogDescription>
                </DialogHeader>

                <div className="py-2 bg-muted/20 rounded-xl px-4 border border-border/50">
                  <h3 className="text-sm font-bold mb-4 text-muted-foreground">{lang === "KO" ? "실시간 진행 워크플로우" : "Real-time Workflow"}</h3>
                  {renderTimeline(selectedOrder.status)}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <div className="space-y-4">
                    <h3 className="font-bold border-b pb-2">{lang === "KO" ? "주문 정보 요약" : "Order Summary"}</h3>
                    <div className="bg-muted/30 p-4 rounded-lg border text-sm space-y-2">
                      {selectedOrder.items && selectedOrder.items.length > 0 && (
                        <div className="space-y-1 mb-3 max-h-[140px] overflow-y-auto pr-1">
                          <div className="text-[10px] text-muted-foreground grid grid-cols-12 font-bold uppercase tracking-wider pb-1 border-b border-dashed">
                            <span className="col-span-6">{lang === "KO" ? "품목명" : "Product"}</span>
                            <span className="col-span-2 text-right">{lang === "KO" ? "수량" : "Qty"}</span>
                            <span className="col-span-4 text-right">{lang === "KO" ? "금액" : "Price"}</span>
                          </div>
                          {selectedOrder.items.map((item: any, idx: number) => (
                            <div key={idx} className="grid grid-cols-12 text-xs py-1.5 border-b border-slate-100 last:border-b-0 items-center">
                              <span className="col-span-6 font-medium text-slate-700 truncate pr-1" title={item.name}>{item.name}</span>
                              <span className="col-span-2 text-right font-mono text-slate-500">{item.qty?.toLocaleString()}</span>
                              <span className="col-span-4 text-right font-mono font-semibold text-slate-800">
                                ${(item.price * item.qty).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex justify-between font-bold text-base border-t pt-2 mb-2"><span>{t("totalSum")}</span> <span className="text-primary">{selectedOrder.amount}</span></div>
                      <Button variant="outline" className="w-full bg-white" onClick={() => generateInvoicePDF(selectedOrder)}>
                        <FileDown className="w-4 h-4 mr-2" /> {lang === "KO" ? "인보이스 (PI) PDF 다운로드" : "Download Invoice (PI) PDF"}
                      </Button>
                    </div>
                    {nextStage && (
                      <div className="bg-orange-50 border border-orange-100 p-4 rounded-lg">
                        <h4 className="font-bold text-orange-800 text-sm mb-2">{lang === "KO" ? "본사 승인 액션" : "HQ Approval Action"}</h4>
                        <p className="text-xs text-orange-700 mb-3">
                          {lang === "KO" ? `${nextStage.label} 단계로 이동시키려면 아래 버튼을 누르세요.` : `Click the button below to move to the ${nextStage.label} stage.`}
                        </p>
                        <Button className="w-full" onClick={() => handleStatusChange(selectedOrder.id, nextStage.id)}>
                          {lang === "KO" ? `${nextStage.label} 상태로 승인` : `Approve to ${nextStage.label}`} <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-bold border-b pb-2">{lang === "KO" ? "실시간 증빙 서류 (Google Drive)" : "Evidence Documents (Google Drive)"}</h3>
                    <div className="space-y-4">
                      <DocumentRow label="Proforma Invoice (PI)" docKey="pi" docData={selectedOrder.documents?.pi} uploader="HQ" isRequiredNow={selectedOrder.status === "PENDING"} lang={lang} selectedOrder={selectedOrder} uploadingDoc={uploadingDoc} handleFileUpload={handleFileUpload} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} />
                      <DocumentRow label={lang === "KO" ? "T/T Copy (해외 송금증)" : "T/T Copy (Wire Transfer)"} docKey="ttCopy" docData={selectedOrder.documents?.ttCopy} uploader="MF" lang={lang} selectedOrder={selectedOrder} uploadingDoc={uploadingDoc} handleFileUpload={handleFileUpload} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} />
                      <DocumentRow label={lang === "KO" ? "은행 입금 확인증" : "Bank Receipt"} docKey="bankReceipt" docData={selectedOrder.documents?.bankReceipt} uploader="HQ" isRequiredNow={selectedOrder.status === "PAYMENT_PENDING"} lang={lang} selectedOrder={selectedOrder} uploadingDoc={uploadingDoc} handleFileUpload={handleFileUpload} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} />
                      <div className="my-4 border-t border-dashed"></div>
                      <DocumentRow label={lang === "KO" ? "B/L 또는 AWB" : "B/L or AWB"} docKey="bl" docData={selectedOrder.documents?.bl} uploader="HQ" isRequiredNow={selectedOrder.status === "SHIPPING"} lang={lang} selectedOrder={selectedOrder} uploadingDoc={uploadingDoc} handleFileUpload={handleFileUpload} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} />
                      <DocumentRow label={lang === "KO" ? "수출신고필증" : "Export Declaration"} docKey="exportDeclaration" docData={selectedOrder.documents?.exportDeclaration} uploader="HQ" isRequiredNow={selectedOrder.status === "SHIPPING"} lang={lang} selectedOrder={selectedOrder} uploadingDoc={uploadingDoc} handleFileUpload={handleFileUpload} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} />
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewPdfUrl} onOpenChange={(open) => !open && setPreviewPdfUrl(null)}>
        <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between">
            <DialogTitle>{lang === "KO" ? "인보이스 미리보기 (Proforma Invoice)" : "Invoice Preview (Proforma Invoice)"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-muted/20 relative">
            {previewPdfUrl && (
              <iframe 
                src={previewPdfUrl} 
                className="w-full h-full border-none"
                title="Invoice Preview"
              />
            )}
          </div>
          <div className="p-4 border-t flex justify-end gap-2 bg-white">
            <Button variant="outline" onClick={() => setPreviewPdfUrl(null)}>{lang === "KO" ? "닫기" : "Close"}</Button>
            <Button onClick={() => {
              const link = document.createElement('a');
              link.href = previewPdfUrl!;
              link.download = `PI_${selectedOrder?.id}.pdf`;
              link.click();
            }}>
              <Download className="w-4 h-4 mr-2" /> {lang === "KO" ? "PDF 다운로드" : "Download PDF"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
