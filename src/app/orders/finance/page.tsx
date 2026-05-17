"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Receipt, 
  Eye, 
  CheckCircle2, 
  Loader2, 
  ExternalLink, 
  Search,
  DollarSign,
  Clock,
  AlertCircle
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
} from "@/components/ui/dialog";

export default function FinancePage() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useTranslation();
  const router = useRouter();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [approveModalOrder, setApproveModalOrder] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedReceiptUrl, setUploadedReceiptUrl] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");

  // 보안 체크: 본사 관리자만 접근 가능
  useEffect(() => {
    if (!authLoading && user && user.role !== "HQ") {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // 재무팀 조회를 위해 전체 주문을 가져온 뒤 클라이언트에서 필터링
  useEffect(() => {
    const q = query(collection(db, "orders"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sortedData = data.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setOrders(sortedData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprovePayment = async () => {
    if (!approveModalOrder) return;
    const orderId = approveModalOrder.id;
    setProcessing(orderId);
    try {
      // 1. 주문 상태 변경 (PREPARING), 결제 상태 변경 (PAID), 증빙 서류 추가
      await updateDoc(doc(db, "orders", orderId), { 
        status: "PREPARING",
        paymentStatus: "PAID",
        "documents.bankReceipt": uploadedReceiptUrl || "https://example.com/mock-bank-receipt.pdf"
      });

      // 2. 알림 발송
      await addDoc(collection(db, "notifications"), {
        type: "STATUS",
        orderId: orderId,
        message: lang === "KO" 
          ? `입금이 확인되어 상품 준비(Preparing) 단계로 전환되었습니다.`
          : `Payment confirmed. Order status changed to Preparing.`,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      setApproveModalOrder(null);
      setUploadedReceiptUrl("");
      alert(lang === "KO" ? "입금 승인 및 증빙 업로드 완료!" : "Payment Approved and Receipt Uploaded!");
    } catch (error) {
      alert("Error: " + error);
    } finally {
      setProcessing(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !approveModalOrder) return;

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

    setUploadedFileName(file.name);
    setIsUploading(true);
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(",")[1];
        const GAS_URL = process.env.NEXT_PUBLIC_GAS_UPLOAD_URL;

        if (!GAS_URL) {
          console.error("GAS Upload URL not configured");
          setIsUploading(false);
          alert(lang === "KO" ? "업로드 설정이 올바르지 않습니다." : "Upload configuration error.");
          return;
        }
        
        const response = await fetch(GAS_URL, {
          method: "POST",
          body: JSON.stringify({
            filename: `${approveModalOrder.id}_bankReceipt_${file.name}`,
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
        
        setUploadedReceiptUrl(fileLink);
        setIsUploading(false);
      };
    } catch (error) {
      setIsUploading(false);
      alert(lang === "KO" ? "업로드 실패" : "Upload Failed");
    }
  };

  const pendingOrders = orders.filter(o => o.status === "PAYMENT_PENDING");
  const approvedOrders = orders.filter(o => o.paymentStatus === "PAID");
  const displayOrders = activeTab === "pending" ? pendingOrders : approvedOrders;

  const filteredOrders = displayOrders.filter(o => 
    o.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    o.mf.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || (user && user.role !== "HQ")) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {lang === "KO" ? "재무 / 입금 승인" : "Finance / Payment Approval"}
          </h2>
          <p className="text-muted-foreground mt-2">
            {lang === "KO" 
              ? "글로벌 파트너의 T/T Copy를 확인하고 실제 입금을 승인합니다." 
              : "Review T/T Copies from global partners and approve remittance."}
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg border border-orange-200 flex items-center gap-2 text-sm font-bold">
            <Clock className="w-4 h-4" />
            {lang === "KO" ? "승인 대기:" : "Pending:"} {pendingOrders.length}
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b mb-6">
        <Button 
          variant="ghost" 
          className={cn(
            "rounded-none border-b-2 px-6 pb-2",
            activeTab === "pending" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground"
          )}
          onClick={() => setActiveTab("pending")}
        >
          {lang === "KO" ? "입금 승인 대기" : "Pending Approval"}
          <Badge variant="secondary" className="ml-2">{pendingOrders.length}</Badge>
        </Button>
        <Button 
          variant="ghost" 
          className={cn(
            "rounded-none border-b-2 px-6 pb-2",
            activeTab === "approved" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground"
          )}
          onClick={() => setActiveTab("approved")}
        >
          {lang === "KO" ? "승인 완료 내역" : "Approved History"}
          <Badge variant="secondary" className="ml-2">{approvedOrders.length}</Badge>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card p-4 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold">{lang === "KO" ? "승인 대기 금액 합계" : "Total Pending Amount"}</p>
            <p className="text-xl font-black">${pendingOrders.reduce((sum, o) => sum + parseFloat(o.amount.replace(/[^0-9.]/g, '')), 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/20">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={lang === "KO" ? "PO 번호 또는 파트너사 검색..." : "Search PO or Partner..."} 
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
              <TableHead>{lang === "KO" ? "MF 파트너" : "Partner"}</TableHead>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("amount")}</TableHead>
              <TableHead>{lang === "KO" ? "T/T 증빙" : "T/T Copy"}</TableHead>
              <TableHead className="text-right">{lang === "KO" ? "관리" : "Action"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredOrders.length > 0 ? (
              filteredOrders.map((order) => (
                <TableRow key={order.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs font-bold">{order.id}</TableCell>
                  <TableCell className="font-semibold">{order.mf}</TableCell>
                  <TableCell className="text-xs">{order.date}</TableCell>
                  <TableCell className="font-bold text-primary">{order.amount}</TableCell>
                  <TableCell>
                    {order.documents?.ttCopy ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs gap-1.5 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <Eye className="w-3.5 h-3.5" /> {lang === "KO" ? "송금증 확인" : "View T/T"}
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">
                        {lang === "KO" ? "미제출" : "Not Submitted"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {activeTab === "pending" ? (
                      <Button 
                        size="sm" 
                        className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                        onClick={() => {
                          setApproveModalOrder(order);
                          setUploadedReceiptUrl("");
                        }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        {lang === "KO" ? "승인 및 증빙업로드" : "Approve & Upload"}
                      </Button>
                    ) : (
                      order.documents?.bankReceipt ? (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-8 text-xs border-green-200 bg-green-50 text-green-700"
                          onClick={() => window.open(order.documents.bankReceipt, "_blank")}
                        >
                          <Receipt className="w-3.5 h-3.5 mr-1" />
                          {lang === "KO" ? "입금증 보기" : "View Receipt"}
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">
                          {lang === "KO" ? "증빙 없음" : "No Receipt"}
                        </Badge>
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">
                  {lang === "KO" ? "승인 대기 중인 입금 내역이 없습니다." : "No pending payments found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              {lang === "KO" ? "T/T Copy (해외 송금 증빙) 확인" : "Review T/T Copy Evidence"}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border text-sm">
                <div>
                  <p className="text-muted-foreground">{lang === "KO" ? "파트너사" : "Partner"}</p>
                  <p className="font-bold">{selectedOrder.mf}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">{t("totalSum")}</p>
                  <p className="font-bold text-lg text-primary">{selectedOrder.amount}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden bg-slate-900 min-h-[300px] flex items-center justify-center relative group">
                {selectedOrder.documents?.ttCopy ? (
                  Array.isArray(selectedOrder.documents.ttCopy) ? (
                    <div className="w-full h-full p-4 space-y-4 overflow-y-auto max-h-[500px]">
                      {selectedOrder.documents.ttCopy.map((url: string, idx: number) => (
                        <div key={idx} className="relative">
                          <img 
                            src={url} 
                            alt={`T/T Copy ${idx + 1}`} 
                            className="w-full rounded border border-slate-700 shadow-2xl"
                          />
                          <a 
                            href={url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <img 
                      src={selectedOrder.documents.ttCopy} 
                      alt="T/T Copy" 
                      className="max-w-full max-h-[500px] shadow-2xl"
                    />
                  )
                ) : (
                  <div className="text-center text-slate-400 space-y-2">
                    <AlertCircle className="w-12 h-12 mx-auto opacity-20" />
                    <p>{lang === "KO" ? "업로드된 증빙이 없습니다." : "No evidence uploaded."}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setSelectedOrder(null)}
                >
                  {lang === "KO" ? "닫기" : "Close"}
                </Button>
                <Button 
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setApproveModalOrder(selectedOrder);
                    setSelectedOrder(null);
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {lang === "KO" ? "승인 및 증빙업로드 진행" : "Proceed to Approve"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!approveModalOrder} onOpenChange={(open) => !open && setApproveModalOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{lang === "KO" ? "은행 입금 증빙 업로드 및 승인" : "Upload Bank Receipt & Approve"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted/50 rounded-lg border text-sm">
              <p className="text-muted-foreground">{lang === "KO" ? "파트너사" : "Partner"}: <span className="font-bold text-foreground">{approveModalOrder?.mf}</span></p>
              <p className="text-muted-foreground mt-1">{lang === "KO" ? "승인 금액" : "Approval Amount"}: <span className="font-bold text-primary">{approveModalOrder?.amount}</span></p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{lang === "KO" ? "은행 입금증(Bank Receipt) 업로드" : "Upload Bank Receipt"}</label>
              {!uploadedReceiptUrl ? (
                <label className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/50 transition-colors cursor-pointer relative">
                  <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} />
                  {isUploading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-2" />
                  ) : (
                    <Receipt className="w-8 h-8 text-muted-foreground mb-2" />
                  )}
                  <p className="text-sm font-medium text-center">
                    {isUploading ? (lang === "KO" ? "업로드 중..." : "Uploading...") : (lang === "KO" ? "클릭하여 파일 선택" : "Click to select file")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG (Max 5MB)</p>
                </label>
              ) : (
                <div className="p-3 border rounded-lg bg-green-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium line-clamp-1">{uploadedFileName || "bank_receipt.pdf"}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => { setUploadedReceiptUrl(""); setUploadedFileName(""); }}>
                    {lang === "KO" ? "삭제" : "Remove"}
                  </Button>
                </div>
              )}
            </div>

            <Button 
              className="w-full bg-green-600 hover:bg-green-700 mt-4"
              disabled={!uploadedReceiptUrl || processing === approveModalOrder?.id}
              onClick={handleApprovePayment}
            >
              {processing === approveModalOrder?.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {lang === "KO" ? "업로드 및 입금 승인 완료" : "Upload & Approve Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
