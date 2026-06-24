"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  getDoc, 
  updateDoc, 
  addDoc, 
  setDoc,
  where
} from "firebase/firestore";
import { DropzoneUploader } from "@/components/ui/dropzone-uploader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Loader2, 
  DollarSign, 
  Check, 
  Plus, 
  FileText, 
  CheckCircle, 
  Clock, 
  Info, 
  AlertCircle 
} from "lucide-react";

export default function RoyaltyPage() {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useTranslation();

  const [royalties, setRoyalties] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Partner specific states
  const [partnerContractRate, setPartnerContractRate] = useState<number>(3.5);
  const [isDeclareOpen, setIsDeclareOpen] = useState(false);
  const [declareMonth, setDeclareMonth] = useState("");
  const [declareSales, setDeclareSales] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // HQ specific states
  const [isHQAddOpen, setIsHQAddOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [manualMonth, setManualMonth] = useState("");
  const [manualSales, setManualSales] = useState("");
  const [manualRate, setManualRate] = useState("3.5");

  // Evidence-only upload/update states
  const [isUploadEvidenceOpen, setIsUploadEvidenceOpen] = useState(false);
  const [selectedRoyaltyForUpload, setSelectedRoyaltyForUpload] = useState<any>(null);
  const [evidenceUploadFile, setEvidenceUploadFile] = useState<File | null>(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  // Sales edit states
  const [isEditDeclareOpen, setIsEditDeclareOpen] = useState(false);
  const [editSales, setEditSales] = useState("");
  const [selectedRoyaltyForEdit, setSelectedRoyaltyForEdit] = useState<any>(null);

  // Partner bank slip (receipt) upload states
  const [isReceiptUploadOpen, setIsReceiptUploadOpen] = useState(false);
  const [selectedRoyaltyForReceipt, setSelectedRoyaltyForReceipt] = useState<any>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // HQ bank receipt (voucher) upload states
  const [isVoucherUploadOpen, setIsVoucherUploadOpen] = useState(false);
  const [selectedRoyaltyForVoucher, setSelectedRoyaltyForVoucher] = useState<any>(null);
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [uploadingVoucher, setUploadingVoucher] = useState(false);

  // Load configuration & dynamic references
  useEffect(() => {
    async function loadSystemConfig() {
      try {
        const docRef = doc(db, "system", "config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSystemConfig(docSnap.data());
        }
      } catch (err) {
        console.error("Error loading system config:", err);
      }
    }
    loadSystemConfig();
  }, []);

  // Real-time subscription to royalties
  useEffect(() => {
    if (!user) return;

    let q;
    if (user.role === "HQ") {
      q = query(collection(db, "royalties"), orderBy("month", "desc"));
    } else {
      q = query(collection(db, "royalties"), where("partnerId", "==", user.role));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let royaltiesData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      if (user.role !== "HQ") {
        royaltiesData.sort((a: any, b: any) => (b.month || "").localeCompare(a.month || ""));
      }
      setRoyalties(royaltiesData);
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to royalties:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch partners list
  useEffect(() => {
    const q = query(collection(db, "partners"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPartners(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    }, (error) => {
      console.error("Error fetching partners:", error);
    });
    return () => unsubscribe();
  }, []);

  // Fetch partner's specific contract rate if not HQ
  useEffect(() => {
    if (user && user.role !== "HQ") {
      const fetchPartnerRate = async () => {
        try {
          const docSnap = await getDoc(doc(db, "partners", user.role));
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.royaltyRate !== undefined) {
              setPartnerContractRate(Number(data.royaltyRate));
            }
          }
        } catch (err) {
          console.error("Error fetching partner contract rate:", err);
        }
      };
      fetchPartnerRate();
    }
  }, [user]);

  // Convert file helper
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(",")[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Partner royalty declaration submit handler
  const handlePartnerDeclare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !declareMonth || !declareSales) {
      alert("모든 필드를 입력해 주세요.");
      return;
    }

    const posSales = parseFloat(declareSales.replace(/[^0-9.]/g, '')) || 0;
    const computedRoyalty = posSales * (partnerContractRate / 100);
    const recordId = `${declareMonth}_${user.role}`;

    setUploading(true);

    try {
      let evidenceUrl = "";
      if (evidenceFile && systemConfig?.gasUrl) {
        const base64Data = await fileToBase64(evidenceFile);
        const response = await fetch(systemConfig.gasUrl, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            filename: `RoyaltyEvidence_${declareMonth}_${user.role}_${evidenceFile.name}`,
            mimeType: evidenceFile.type,
            fileData: base64Data,
            folderId: systemConfig.driveFolderId || ""
          })
        });
        const resJson = await response.json();
        if (resJson && resJson.status === "success") {
          evidenceUrl = resJson.url;
        } else {
          console.warn("GAS upload succeeded but didn't return success code:", resJson);
        }
      }

      await setDoc(doc(db, "royalties", recordId), {
        partnerId: user.role,
        partnerName: user.name || user.role,
        partnerCode: user.role === "Vietnam" ? "VNM" : user.role === "Japan" ? "JPN" : "MF",
        month: declareMonth,
        posSales: posSales,
        royaltyRate: partnerContractRate,
        royaltyAmount: computedRoyalty,
        evidenceUrl: evidenceUrl,
        status: "DECLARED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // HQ alert notification
      await addDoc(collection(db, "notifications"), {
        type: "ROYALTY",
        message: `[${user.name}] 파트너사가 ${declareMonth}월 POS 실적에 대해 로열티를 자가 신고 하였습니다.`,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      setIsDeclareOpen(false);
      setDeclareMonth("");
      setDeclareSales("");
      setEvidenceFile(null);
      alert("매출 신고가 성공적으로 완료되었습니다. 본사 승인을 기다려주세요.");
    } catch (err) {
      alert("신고 등록 중 에러 발생: " + err);
    } finally {
      setUploading(false);
    }
  };

  // Partner or HQ standalone evidence document upload/update handler
  const handleEvidenceOnlyUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoyaltyForUpload || !evidenceUploadFile) {
      alert("파일을 선택해 주세요.");
      return;
    }

    setUploadingEvidence(true);

    try {
      let evidenceUrl = "";
      if (systemConfig?.gasUrl) {
        const base64Data = await fileToBase64(evidenceUploadFile);
        const response = await fetch(systemConfig.gasUrl, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            filename: `RoyaltyEvidence_${selectedRoyaltyForUpload.month}_${selectedRoyaltyForUpload.partnerId}_${evidenceUploadFile.name}`,
            mimeType: evidenceUploadFile.type,
            fileData: base64Data,
            folderId: systemConfig.driveFolderId || ""
          })
        });
        const resJson = await response.json();
        if (resJson && resJson.status === "success") {
          evidenceUrl = resJson.url;
        } else {
          console.warn("GAS upload succeeded but didn't return success code:", resJson);
          if (resJson.url) evidenceUrl = resJson.url;
        }
      }

      if (!evidenceUrl) {
        throw new Error("파일 업로드에 실패했습니다. API 설정을 확인하세요.");
      }

      await updateDoc(doc(db, "royalties", selectedRoyaltyForUpload.id), {
        evidenceUrl: evidenceUrl,
        updatedAt: new Date().toISOString()
      });

      // Notification
      await addDoc(collection(db, "notifications"), {
        type: "ROYALTY",
        message: `[${selectedRoyaltyForUpload.partnerName}] 파트너사가 ${selectedRoyaltyForUpload.month}월 로열티 매출 증빙 자료를 업로드/변경 하였습니다.`,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      setIsUploadEvidenceOpen(false);
      setEvidenceUploadFile(null);
      setSelectedRoyaltyForUpload(null);
      alert("매출 증빙 서류가 성공적으로 업로드 및 등록되었습니다.");
    } catch (err) {
      alert("증빙 등록 중 에러 발생: " + err);
    } finally {
      setUploadingEvidence(false);
    }
  };

  // Partner or HQ declared sales number edit handler
  const handleEditDeclareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoyaltyForEdit || !editSales) {
      alert("매출액을 입력해 주세요.");
      return;
    }

    const posSales = parseFloat(editSales.replace(/[^0-9.]/g, '')) || 0;
    const computedRoyalty = posSales * (selectedRoyaltyForEdit.royaltyRate / 100);

    try {
      await updateDoc(doc(db, "royalties", selectedRoyaltyForEdit.id), {
        posSales: posSales,
        royaltyAmount: computedRoyalty,
        updatedAt: new Date().toISOString()
      });

      // Notification
      await addDoc(collection(db, "notifications"), {
        type: "ROYALTY",
        message: `[${selectedRoyaltyForEdit.partnerName}] 파트너사가 ${selectedRoyaltyForEdit.month}월 POS 실적 매출 신고액을 $${Math.round(selectedRoyaltyForEdit.posSales).toLocaleString()}에서 $${Math.round(posSales).toLocaleString()}으로 수정하였습니다.`,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      setIsEditDeclareOpen(false);
      setSelectedRoyaltyForEdit(null);
      setEditSales("");
      alert("신고 매출 실적 및 로열티 산정 금액이 정상적으로 수정되었습니다.");
    } catch (err) {
      alert("신고 내역 수정 중 에러 발생: " + err);
    }
  };

  // HQ clearance approve handler (Step 2: DECLARED -> INVOICED)
  const handleHQApprove = async (royaltyId: string) => {
    try {
      await updateDoc(doc(db, "royalties", royaltyId), {
        status: "INVOICED",
        updatedAt: new Date().toISOString()
      });

      // Notification
      await addDoc(collection(db, "notifications"), {
        type: "STATUS",
        message: `로열티 매출 심사가 완료되었으며, 정식 인보이스가 청구되었습니다. 해외 가맹 본부 금액을 확인하고 해외 송금을 집행해 주십시오.`,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      alert("로열티 청구를 정상적으로 확정 및 발행(INVOICED) 완료하였습니다!");
    } catch (err) {
      alert("청구 승인 에러: " + err);
    }
  };

  // Partner bank slip upload handler (Step 3: INVOICED -> PAID_SUBMITTED)
  const handleReceiptUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoyaltyForReceipt || !receiptFile) {
      alert("송금 이체증/영수증 파일을 선택해 주세요.");
      return;
    }

    setUploadingReceipt(true);
    try {
      // 1. Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(",")[1];
          resolve(base64String);
        };
      });
      reader.readAsDataURL(receiptFile);
      const base64Data = await base64Promise;

      // 2. Upload to Google Drive via GAS App
      const gasUrl = "https://script.google.com/macros/s/AKfycbxOszg6c1l6uNspv4NlR1wN_J1L6L26g2L87y_1x19w84-3y10P/exec";
      const response = await fetch(gasUrl, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: `BankSlip_${selectedRoyaltyForReceipt.partnerCode}_${selectedRoyaltyForReceipt.month}_${Date.now()}.${receiptFile.name.split('.').pop()}`,
          mimeType: receiptFile.type,
          data: base64Data
        })
      });

      const resJson = await response.json();
      if (!resJson.success) {
        throw new Error(resJson.error || "GAS Upload Error");
      }

      const receiptUrl = resJson.fileUrl;

      // 3. Update Firestore entry
      await updateDoc(doc(db, "royalties", selectedRoyaltyForReceipt.id), {
        receiptUrl: receiptUrl,
        status: "PAID_SUBMITTED",
        updatedAt: new Date().toISOString()
      });

      // 4. Notification for HQ
      await addDoc(collection(db, "notifications"), {
        type: "ROYALTY",
        message: `[${selectedRoyaltyForReceipt.partnerName}] 파트너사가 ${selectedRoyaltyForReceipt.month}월 로열티 송금 증빙(T/T Copy)을 등록하였습니다.`,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      setIsReceiptUploadOpen(false);
      setReceiptFile(null);
      setSelectedRoyaltyForReceipt(null);
      alert("해외 송금 완료 확인증이 정상적으로 업로드 및 등록 완료되었습니다.");
    } catch (err) {
      alert("송금 증빙 업로드 중 에러 발생: " + err);
    } finally {
      setUploadingReceipt(false);
    }
  };

  // HQ bank receipt/voucher upload handler (Step 4: PAID_SUBMITTED -> CLEARED)
  const handleVoucherUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoyaltyForVoucher || !voucherFile) {
      alert("수납 확인 영수증/증빙 파일을 선택해 주세요.");
      return;
    }

    setUploadingVoucher(true);
    try {
      // 1. Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(",")[1];
          resolve(base64String);
        };
      });
      reader.readAsDataURL(voucherFile);
      const base64Data = await base64Promise;

      // 2. Upload via GAS Proxy
      const gasUrl = "https://script.google.com/macros/s/AKfycbxOszg6c1l6uNspv4NlR1wN_J1L6L26g2L87y_1x19w84-3y10P/exec";
      const response = await fetch(gasUrl, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: `HQVoucher_${selectedRoyaltyForVoucher.partnerCode}_${selectedRoyaltyForVoucher.month}_${Date.now()}.${voucherFile.name.split('.').pop()}`,
          mimeType: voucherFile.type,
          data: base64Data
        })
      });

      const resJson = await response.json();
      if (!resJson.success) {
        throw new Error(resJson.error || "GAS Upload Error");
      }

      const depositVoucherUrl = resJson.fileUrl;

      // 3. Update Firestore
      await updateDoc(doc(db, "royalties", selectedRoyaltyForVoucher.id), {
        depositVoucherUrl: depositVoucherUrl,
        status: "CLEARED",
        updatedAt: new Date().toISOString()
      });

      // 4. Notification for Partner
      await addDoc(collection(db, "notifications"), {
        type: "STATUS",
        message: `본사(HQ)에서 ${selectedRoyaltyForVoucher.month}월 로열티 송금 수납을 완료하고, 은행 입금 증빙을 업로드하였습니다.`,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      setIsVoucherUploadOpen(false);
      setVoucherFile(null);
      setSelectedRoyaltyForVoucher(null);
      alert("본사 은행 수납 확인증 및 영수증이 정상적으로 등록 완료되었습니다.");
    } catch (err) {
      alert("수납 확인증 등록 중 에러 발생: " + err);
    } finally {
      setUploadingVoucher(false);
    }
  };

  // HQ final closing handler (Step 5: CLEARED -> SETTLED)
  const handleFinalSettle = async (royaltyId: string) => {
    try {
      await updateDoc(doc(db, "royalties", royaltyId), {
        status: "SETTLED",
        updatedAt: new Date().toISOString()
      });

      alert("로열티 정산 마감이 정상 처리되었습니다! 해당 데이터는 영구 동결됩니다.");
    } catch (err) {
      alert("정산 마감 처리 에러: " + err);
    }
  };

  // HQ manual entry insert handler
  const handleHQAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerId || !manualMonth || !manualSales) {
      alert("모든 필드를 입력해주세요.");
      return;
    }

    const partner = partners.find(p => p.id === selectedPartnerId);
    if (!partner) return;

    const posSales = parseFloat(manualSales.replace(/[^0-9.]/g, '')) || 0;
    const royaltyRate = parseFloat(manualRate) || 3.5;
    const royaltyAmount = posSales * (royaltyRate / 100);
    const recordId = `${manualMonth}_${selectedPartnerId}`;

    try {
      await setDoc(doc(db, "royalties", recordId), {
        partnerId: selectedPartnerId,
        partnerName: partner.name,
        partnerCode: partner.country || "MF",
        month: manualMonth,
        posSales: posSales,
        royaltyRate: royaltyRate,
        royaltyAmount: royaltyAmount,
        evidenceUrl: "",
        status: "INVOICED", // HQ manual claims start as INVOICED directly
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setIsHQAddOpen(false);
      setSelectedPartnerId("");
      setManualMonth("");
      setManualSales("");
      setManualRate("3.5");
      alert("대리 로열티 정산서가 정상적으로 등록 및 발행되었습니다.");
    } catch (err) {
      alert("수동 등록 에러: " + err);
    }
  };

  if (authLoading || loading) {
    return <div className="h-96 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  // Filter local ledger lists based on user role
  const renderedLedger = user?.role === "HQ" 
    ? royalties 
    : royalties.filter(r => r.partnerId === user?.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-4 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">
            {lang === "KO" ? "로열티 정산 센터" : "Royalty Clearing & Settlement"}
          </h2>
          <p className="text-muted-foreground mt-2">
            {lang === "KO" 
              ? "글로벌 마스터 프랜차이즈 계약에 의한 POS 매출 연동 로열티의 신고, 청구서 발행, 그리고 입금 정산 흐름을 관리합니다."
              : "Track, issue invoices for, and clear contract royalties from global partners linked to monthly POS performance."}
          </p>
        </div>
        {user?.role !== "HQ" ? (
          <Button 
            onClick={() => setIsDeclareOpen(true)} 
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs font-bold h-9"
          >
            <Plus className="w-4 h-4" />
            {lang === "KO" ? "POS 매출 신고하기" : "Declare POS Sales"}
          </Button>
        ) : (
          <Button 
            onClick={() => setIsHQAddOpen(true)} 
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs font-bold h-9"
          >
            <Plus className="w-4 h-4" />
            {lang === "KO" ? "로열티 청구서 수동 발행" : "Issue Manual Claim"}
          </Button>
        )}
      </div>

      {/* Contract Rate Card for Partner, cleared summary cards for HQ */}
      {user?.role !== "HQ" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-blue-600 bg-gradient-to-br from-blue-50/20 to-indigo-50/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-extrabold text-muted-foreground uppercase">
                {lang === "KO" ? "계약 로열티 정산 비율" : "Contractual Royalty Rate"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono text-blue-600 flex items-baseline gap-1">
                {partnerContractRate}%
                <span className="text-xs text-muted-foreground font-semibold">({lang === "KO" ? "POS 매출 대비" : "of POS Sales"})</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                {lang === "KO" ? "본사 계약에 명시된 기본 정산 이율입니다." : "Default contract royalty rate with HQ."}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-600 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-extrabold text-muted-foreground uppercase">
                {lang === "KO" ? "입금 대기 금액 (청구서 발행 완료)" : "Awaiting Bank Transfer"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono text-yellow-600">
                ${renderedLedger.filter(r => r.status === "INVOICED" || r.status === "PAID_SUBMITTED").reduce((sum, r) => sum + (r.royaltyAmount || 0), 0).toLocaleString()}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">{lang === "KO" ? "본사에서 승인하여 납부 대기 상태인 청구액입니다." : "Invoiced by HQ, waiting for wire transfer."}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-600 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-extrabold text-muted-foreground uppercase">
                {lang === "KO" ? "정산 수납 완료 누적액" : "Settlement Cleared (Accumulated)"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono text-emerald-600">
                ${renderedLedger.filter(r => r.status === "CLEARED" || r.status === "SETTLED").reduce((sum, r) => sum + (r.royaltyAmount || 0), 0).toLocaleString()}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">{lang === "KO" ? "본사에서 입금 검증을 마친 정산 금액 총합입니다." : "Deposit validated and matched successfully."}</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-blue-600 bg-gradient-to-br from-blue-50/20 to-indigo-50/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-extrabold text-muted-foreground uppercase">
                {lang === "KO" ? "신고 검토 중 (검토 대기)" : "Awaiting Review"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono text-blue-600 flex items-baseline gap-1">
                ${renderedLedger.filter(r => r.status === "DECLARED").reduce((sum, r) => sum + (r.royaltyAmount || 0), 0).toLocaleString()}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">{lang === "KO" ? "파트너사에서 제출하여 검토 대기 중인 금액입니다." : "New partner self-declarations awaiting invoice issues."}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-600 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-extrabold text-muted-foreground uppercase">
                {lang === "KO" ? "수납 대기 (청구 완료)" : "Awaiting Payment"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono text-yellow-600">
                ${renderedLedger.filter(r => r.status === "INVOICED" || r.status === "PAID_SUBMITTED").reduce((sum, r) => sum + (r.royaltyAmount || 0), 0).toLocaleString()}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">{lang === "KO" ? "청구서 발행 완료 후 입금 송금을 기다리는 단계입니다." : "Invoices cleared, awaiting bank transfer receipts."}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-600 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-extrabold text-muted-foreground uppercase">
                {lang === "KO" ? "누적 정산 수납 완료" : "Total Settled (PAID)"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono text-emerald-600">
                ${renderedLedger.filter(r => r.status === "CLEARED" || r.status === "SETTLED").reduce((sum, r) => sum + (r.royaltyAmount || 0), 0).toLocaleString()}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">{lang === "KO" ? "본사 은행 계좌에 입금 확인되어 마감된 건의 총합입니다." : "Deposits verified and transaction ledger closed."}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Ledger Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-x-auto p-6">
        <div className="flex justify-between items-center pb-4 border-b mb-4">
          <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
            <DollarSign className="w-5 h-5 text-blue-600 bg-blue-50 rounded-full p-0.5" />
            {lang === "KO" ? "글로벌 로열티 정산 관리 내역" : "Royalty Management & Settlement Ledger"}
          </h3>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="w-[100px]">{lang === "KO" ? "정산월" : "Month"}</TableHead>
              {user?.role === "HQ" && <TableHead>{lang === "KO" ? "파트너사" : "Partner"}</TableHead>}
              <TableHead className="text-right">{lang === "KO" ? "POS 매출 실적" : "POS Sales (USD)"}</TableHead>
              <TableHead className="text-center">{lang === "KO" ? "요율" : "Rate"}</TableHead>
              <TableHead className="text-right font-extrabold text-blue-600">{lang === "KO" ? "로열티 청구액" : "Royalty Due"}</TableHead>
              <TableHead className="text-center">{lang === "KO" ? "1. 매출 증빙" : "1. Sales Doc"}</TableHead>
              <TableHead className="text-center">{lang === "KO" ? "2. 송금 증빙" : "2. Bank Slip"}</TableHead>
              <TableHead className="text-center">{lang === "KO" ? "3. 수납 증빙" : "3. HQ Voucher"}</TableHead>
              <TableHead className="text-center">{lang === "KO" ? "정산 상태" : "Status"}</TableHead>
              <TableHead className="text-right">{lang === "KO" ? "정산 관리" : "Management"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderedLedger.map((row, i) => (
              <TableRow key={i} className="hover:bg-muted/10 transition-colors">
                <TableCell className="font-mono text-xs font-bold">{row.month}</TableCell>
                {user?.role === "HQ" && (
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-xs">{row.partnerName}</span>
                      <Badge variant="outline" className="text-[9px] uppercase font-mono px-1.5 py-0">{row.partnerCode}</Badge>
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-right font-mono text-xs font-medium">${Math.round(row.posSales).toLocaleString()}</TableCell>
                <TableCell className="text-center font-mono text-xs text-slate-500">{row.royaltyRate}%</TableCell>
                <TableCell className="text-right font-mono text-xs font-extrabold text-blue-600">${Math.round(row.royaltyAmount).toLocaleString()}</TableCell>
                
                {/* 1. 매출 증빙 (POS Report) */}
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1 justify-center">
                    {row.evidenceUrl ? (
                      <div className="flex items-center gap-2">
                        <a 
                          href={row.evidenceUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {lang === "KO" ? "보기" : "View"}
                        </a>
                        {row.status === "DECLARED" && user?.role !== "HQ" && (
                          <button 
                            onClick={() => {
                              setSelectedRoyaltyForUpload(row);
                              setIsUploadEvidenceOpen(true);
                            }}
                            className="text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors hover:underline"
                            title={lang === "KO" ? "증빙 서류 변경" : "Change Document"}
                          >
                            {lang === "KO" ? "변경" : "Edit"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-muted-foreground italic">{lang === "KO" ? "증빙 없음" : "No file"}</span>
                        {row.status === "DECLARED" && user?.role !== "HQ" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedRoyaltyForUpload(row);
                              setIsUploadEvidenceOpen(true);
                            }}
                            className="h-6 px-1.5 text-[9px] font-extrabold text-blue-600 hover:text-blue-700 bg-blue-50/50 hover:bg-blue-50 border border-blue-100"
                          >
                            {lang === "KO" ? "파일 첨부" : "Attach File"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>

                {/* 2. 송금 증빙 (Bank Wire Slip) */}
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1 justify-center">
                    {row.receiptUrl ? (
                      <div className="flex items-center gap-2">
                        <a 
                          href={row.receiptUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-500" />
                          {lang === "KO" ? "보기" : "View"}
                        </a>
                        {row.status === "PAID_SUBMITTED" && user?.role !== "HQ" && (
                          <button 
                            onClick={() => {
                              setSelectedRoyaltyForReceipt(row);
                              setIsReceiptUploadOpen(true);
                            }}
                            className="text-[10px] font-bold text-slate-400 hover:text-emerald-600 transition-colors hover:underline"
                            title={lang === "KO" ? "송금 증빙 변경" : "Change Bank Slip"}
                          >
                            {lang === "KO" ? "변경" : "Edit"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-muted-foreground italic">{lang === "KO" ? "미제출" : "No Slip"}</span>
                        {row.status === "INVOICED" && user?.role !== "HQ" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedRoyaltyForReceipt(row);
                              setIsReceiptUploadOpen(true);
                            }}
                            className="h-6 px-1.5 text-[9px] font-extrabold text-emerald-600 hover:text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100"
                          >
                            {lang === "KO" ? "송금 등록" : "Upload Slip"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>

                {/* 3. 수납 증빙 (HQ Deposit Voucher) */}
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1 justify-center">
                    {row.depositVoucherUrl ? (
                      <div className="flex items-center gap-2">
                        <a 
                          href={row.depositVoucherUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5 text-amber-500" />
                          {lang === "KO" ? "보기" : "View"}
                        </a>
                        {row.status === "CLEARED" && user?.role === "HQ" && (
                          <button 
                            onClick={() => {
                              setSelectedRoyaltyForVoucher(row);
                              setIsVoucherUploadOpen(true);
                            }}
                            className="text-[10px] font-bold text-slate-400 hover:text-amber-600 transition-colors hover:underline"
                            title={lang === "KO" ? "수납 증빙 변경" : "Change Voucher"}
                          >
                            {lang === "KO" ? "변경" : "Edit"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-muted-foreground italic">{lang === "KO" ? "미확인" : "Unverified"}</span>
                        {row.status === "PAID_SUBMITTED" && user?.role === "HQ" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedRoyaltyForVoucher(row);
                              setIsVoucherUploadOpen(true);
                            }}
                            className="h-6 px-1.5 text-[9px] font-extrabold text-amber-600 hover:text-amber-700 bg-amber-50/50 hover:bg-amber-50 border border-amber-100"
                          >
                            {lang === "KO" ? "수납 등록" : "Confirm Voucher"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-center">
                  {row.status === "DECLARED" && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] font-bold">
                      {lang === "KO" ? "1단계: 신고 완료" : "Step 1: Declared"}
                    </Badge>
                  )}
                  {row.status === "INVOICED" && (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-[10px] font-bold">
                      {lang === "KO" ? "2단계: 청구 완료" : "Step 2: Invoiced"}
                    </Badge>
                  )}
                  {row.status === "PAID_SUBMITTED" && (
                    <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-[10px] font-bold">
                      {lang === "KO" ? "3단계: 송금 증빙 제출" : "Step 3: Transfer Copy"}
                    </Badge>
                  )}
                  {row.status === "CLEARED" && (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                      {lang === "KO" ? "4단계: 입금 승인 완료" : "Step 4: Cleared"}
                    </Badge>
                  )}
                  {row.status === "SETTLED" && (
                    <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-[10px] font-bold">
                      {lang === "KO" ? "5단계: 정산 완료" : "Step 5: Settled"}
                    </Badge>
                  )}
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {user?.role === "HQ" ? (
                      <>
                        {row.status === "DECLARED" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleHQApprove(row.id)}
                            className="h-7 text-[10px] font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200 gap-1"
                          >
                            <Check className="w-3 h-3" />
                            {lang === "KO" ? "청구서 발행" : "Issue Invoice"}
                          </Button>
                        )}
                        {row.status === "INVOICED" && (
                          <span className="text-[10px] text-yellow-600 font-bold py-1 px-2.5 rounded bg-yellow-50 border border-yellow-100">
                            {lang === "KO" ? "파트너 송금 대기" : "Awaiting Partner Transfer"}
                          </span>
                        )}
                        {row.status === "PAID_SUBMITTED" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedRoyaltyForVoucher(row);
                              setIsVoucherUploadOpen(true);
                            }}
                            className="h-7 text-[10px] font-bold bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200 gap-1"
                          >
                            <Check className="w-3 h-3" />
                            {lang === "KO" ? "수납 등록" : "Confirm Deposit"}
                          </Button>
                        )}
                        {row.status === "CLEARED" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleFinalSettle(row.id)}
                            className="h-7 text-[10px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200 gap-1"
                          >
                            <Check className="w-3 h-3" />
                            {lang === "KO" ? "최종 정산 마감" : "Close Month"}
                          </Button>
                        )}
                        {row.status === "SETTLED" && (
                          <span className="text-[10px] text-indigo-600 font-bold py-1 px-2.5 rounded bg-indigo-50 border border-indigo-100">
                            {lang === "KO" ? "정산 마감 완료" : "Settled"}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {row.status === "DECLARED" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedRoyaltyForEdit(row);
                              setEditSales(row.posSales.toString());
                              setIsEditDeclareOpen(true);
                            }}
                            className="h-7 text-[10px] font-bold bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200 gap-1"
                          >
                            {lang === "KO" ? "신고 수정" : "Edit Sales"}
                          </Button>
                        )}
                        {row.status === "INVOICED" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedRoyaltyForReceipt(row);
                              setIsReceiptUploadOpen(true);
                            }}
                            className="h-7 text-[10px] font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200 gap-1"
                          >
                            <Check className="w-3 h-3" />
                            {lang === "KO" ? "송금 증빙 제출" : "Submit Bank Slip"}
                          </Button>
                        )}
                        {row.status === "PAID_SUBMITTED" && (
                          <span className="text-[10px] text-orange-600 font-bold py-1 px-2.5 rounded bg-orange-50 border border-orange-100">
                            {lang === "KO" ? "수납 심사 대기" : "Awaiting HQ Review"}
                          </span>
                        )}
                        {row.status === "CLEARED" && (
                          <span className="text-[10px] text-emerald-600 font-bold py-1 px-2.5 rounded bg-emerald-50 border border-emerald-100">
                            {lang === "KO" ? "송금 수납 확인" : "Transfer Confirmed"}
                          </span>
                        )}
                        {row.status === "SETTLED" && (
                          <span className="text-[10px] text-indigo-600 font-bold py-1 px-2.5 rounded bg-indigo-50 border border-indigo-100">
                            {lang === "KO" ? "정산 마감 완료" : "Settled"}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {renderedLedger.length === 0 && (
              <TableRow>
                <TableCell colSpan={user?.role === "HQ" ? 8 : 7} className="h-24 text-center text-muted-foreground">
                  {lang === "KO" ? "로열티 정산 내역이 없습니다." : "No royalty records."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Partner Declaration Dialog Modal */}
      <Dialog open={isDeclareOpen} onOpenChange={setIsDeclareOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={handlePartnerDeclare}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-bold text-lg text-primary">
                <DollarSign className="w-5 h-5 bg-blue-100 rounded-full text-blue-600 p-0.5" />
                {lang === "KO" ? "월별 POS 매출 및 로열티 신고" : "Declare POS Sales & Royalty"}
              </DialogTitle>
              <DialogDescription>
                {lang === "KO" 
                  ? "해당 정산 월의 전체 POS 매출 총액을 신고하고 본사 검증을 위해 매출 증명 파일(PDF, 이미지)을 첨부하여 주십시오."
                  : "Submit monthly POS gross sales. Contract rates will apply, and please attach performance reports."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="declare-month">{lang === "KO" ? "정산 대상 월" : "Target Month"}</Label>
                  <Input 
                    id="declare-month"
                    type="month"
                    max={new Date().toISOString().substring(0, 7)}
                    value={declareMonth}
                    onChange={(e) => setDeclareMonth(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="declare-rate">{lang === "KO" ? "적용 요율" : "Contract Rate"}</Label>
                  <Input 
                    id="declare-rate"
                    type="text"
                    value={`${partnerContractRate}%`}
                    disabled
                    className="bg-slate-50 font-bold font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="declare-sales">{lang === "KO" ? "POS 총 매출액 (USD)" : "POS Gross Sales (USD)"}</Label>
                <Input 
                  id="declare-sales"
                  placeholder="0.00"
                  value={declareSales}
                  onChange={(e) => setDeclareSales(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2 mt-4">
                <Label>{lang === "KO" ? "매출 실적 증명 자료" : "Sales Evidence Report"}</Label>
                <DropzoneUploader 
                  onFileSelect={setEvidenceFile} 
                  selectedFile={evidenceFile}
                  label={lang === "KO" ? "클릭하거나 파일을 드래그하여 업로드" : "Drag & drop or click to upload"}
                />
              </div>

              {declareSales && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs font-bold text-blue-600 mt-2">
                  {lang === "KO" ? "예상 청구 로열티 금액" : "Estimated Royalty Due"}: 
                  <span className="font-mono ml-1 text-sm">${(parseFloat(declareSales.replace(/[^0-9.]/g, '')) * (partnerContractRate / 100) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDeclareOpen(false)}>
                {lang === "KO" ? "취소" : "Cancel"}
              </Button>
              <Button type="submit" disabled={uploading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    {lang === "KO" ? "업로드 및 신고 중..." : "Uploading..."}
                  </>
                ) : (lang === "KO" ? "신고서 제출" : "Submit Report")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* HQ Manual Add Dialog Modal */}
      <Dialog open={isHQAddOpen} onOpenChange={setIsHQAddOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <form onSubmit={handleHQAddManual}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary font-bold text-lg">
                <DollarSign className="w-5 h-5 bg-blue-100 rounded-full text-blue-600 p-0.5" />
                {lang === "KO" ? "로열티 청구서 수동 발행 (대리 입력)" : "Issue Manual Royalty Claim"}
              </DialogTitle>
              <DialogDescription>
                {lang === "KO" 
                  ? "파트너사의 실제 POS 실적을 검증하여 본사 담당자가 직접 청구 명세서를 수동 발행합니다."
                  : "Issue a royalty invoice manually on behalf of partners based on confirmed accounts."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="manual-partner">{lang === "KO" ? "대상 파트너사" : "Target Partner"}</Label>
                <select 
                  id="manual-partner"
                  value={selectedPartnerId} 
                  onChange={(e) => setSelectedPartnerId(e.target.value)} 
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-medium"
                >
                  <option value="">{lang === "KO" ? "파트너사 선택" : "Select Partner"}</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id} className="text-slate-900">{p.name} ({p.country})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="manual-month">{lang === "KO" ? "정산 대상 월" : "Target Month"}</Label>
                  <Input 
                    id="manual-month"
                    type="month"
                    max={new Date().toISOString().substring(0, 7)}
                    value={manualMonth}
                    onChange={(e) => setManualMonth(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-rate">{lang === "KO" ? "청구 요율 (%)" : "Royalty Rate (%)"}</Label>
                  <Input 
                    id="manual-rate"
                    type="number"
                    step="0.1"
                    value={manualRate}
                    onChange={(e) => setManualRate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="manual-sales">{lang === "KO" ? "POS 매출액 (USD)" : "POS Sales (USD)"}</Label>
                <Input 
                  id="manual-sales"
                  placeholder="0.00"
                  value={manualSales}
                  onChange={(e) => setManualSales(e.target.value)}
                  required
                />
              </div>

              {manualSales && (
                <div className="bg-slate-50 border p-3 rounded-lg text-xs font-bold text-blue-600">
                  {lang === "KO" ? "로열티 청구 금액 연산" : "Computed Royalty Invoice"}: 
                  <span className="font-mono ml-1 text-sm">${(parseFloat(manualSales.replace(/[^0-9.]/g, '')) * (parseFloat(manualRate) / 100) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsHQAddOpen(false)}>
                {lang === "KO" ? "취소" : "Cancel"}
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {lang === "KO" ? "발행 및 전송하기" : "Issue Invoice"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload/Edit Evidence Document Dialog Modal */}
      <Dialog open={isUploadEvidenceOpen} onOpenChange={setIsUploadEvidenceOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <form onSubmit={handleEvidenceOnlyUpload}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-bold text-lg text-primary">
                <FileText className="w-5 h-5 bg-blue-100 rounded-full text-blue-600 p-0.5" />
                {lang === "KO" ? "매출 증빙 자료 등록 및 변경" : "Upload & Edit Sales Evidence"}
              </DialogTitle>
              <DialogDescription>
                {lang === "KO"
                  ? `${selectedRoyaltyForUpload?.month} 정산분에 대한 본사 검토 및 승인용 POS 실적 보고서(PDF, 이미지)를 업로드합니다.`
                  : `Upload the POS performance document for the month of ${selectedRoyaltyForUpload?.month}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {selectedRoyaltyForUpload?.evidenceUrl && (
                <div className="bg-slate-50 border p-3 rounded-lg text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold">{lang === "KO" ? "현재 등록된 증빙 서류" : "Current Document"}</span>
                  </div>
                  <a 
                    href={selectedRoyaltyForUpload.evidenceUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    {lang === "KO" ? "파일 다운로드 / 보기" : "View / Download"}
                  </a>
                </div>
              )}

              <div className="grid gap-2 mt-4">
                <Label>
                  {selectedRoyaltyForUpload?.evidenceUrl 
                    ? (lang === "KO" ? "새로운 파일로 교체" : "Replace with New File")
                    : (lang === "KO" ? "증빙 서류 파일 선택" : "Select Evidence File")
                  }
                </Label>
                <DropzoneUploader 
                  onFileSelect={setEvidenceUploadFile} 
                  selectedFile={evidenceUploadFile}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsUploadEvidenceOpen(false);
                setEvidenceUploadFile(null);
              }}>
                {lang === "KO" ? "취소" : "Cancel"}
              </Button>
              <Button type="submit" disabled={uploadingEvidence} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {uploadingEvidence ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 animate-spin" />
                    {lang === "KO" ? "서류 업로드 중..." : "Uploading..."}
                  </>
                ) : (lang === "KO" ? "저장 및 제출" : "Save & Submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Sales Declaration Dialog Modal */}
      <Dialog open={isEditDeclareOpen} onOpenChange={setIsEditDeclareOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={handleEditDeclareSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-bold text-lg text-primary">
                <DollarSign className="w-5 h-5 bg-blue-100 rounded-full text-blue-600 p-0.5" />
                {lang === "KO" ? "POS 매출 신고 실적 수정" : "Edit POS Sales Declaration"}
              </DialogTitle>
              <DialogDescription>
                {lang === "KO"
                  ? `${selectedRoyaltyForEdit?.month} 정산분에 대한 매출 실적 수치를 올바르게 수정합니다. 수정에 따른 로열티가 자동 재연산됩니다.`
                  : `Correct the declared POS sales for target month ${selectedRoyaltyForEdit?.month}. Royalty values will recalculate automatically.`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-declare-month">{lang === "KO" ? "정산 대상 월" : "Target Month"}</Label>
                  <Input 
                    id="edit-declare-month"
                    type="month"
                    value={selectedRoyaltyForEdit?.month || ""}
                    disabled
                    className="bg-slate-50 font-mono text-xs"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-declare-rate">{lang === "KO" ? "적용 요율" : "Contract Rate"}</Label>
                  <Input 
                    id="edit-declare-rate"
                    type="text"
                    value={`${selectedRoyaltyForEdit?.royaltyRate || 3.5}%`}
                    disabled
                    className="bg-slate-50 font-bold font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-declare-sales">{lang === "KO" ? "POS 총 매출액 (USD)" : "POS Gross Sales (USD)"}</Label>
                <Input 
                  id="edit-declare-sales"
                  placeholder="0.00"
                  value={editSales}
                  onChange={(e) => setEditSales(e.target.value)}
                  required
                />
              </div>

              {editSales && selectedRoyaltyForEdit && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs font-bold text-blue-600 mt-2">
                  {lang === "KO" ? "수정된 예상 로열티 금액" : "Recalculated Royalty Due"}: 
                  <span className="font-mono ml-1 text-sm">
                    ${(parseFloat(editSales.replace(/[^0-9.]/g, '')) * (selectedRoyaltyForEdit.royaltyRate / 100) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                  </span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsEditDeclareOpen(false);
                setSelectedRoyaltyForEdit(null);
                setEditSales("");
              }}>
                {lang === "KO" ? "취소" : "Cancel"}
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {lang === "KO" ? "수정 내용 저장" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Partner bank slip (receipt) upload Dialog Modal */}
      <Dialog open={isReceiptUploadOpen} onOpenChange={setIsReceiptUploadOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={handleReceiptUpload}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-bold text-lg text-emerald-600">
                <FileText className="w-5 h-5 bg-emerald-100 rounded-full text-emerald-600 p-0.5" />
                {lang === "KO" ? "해외 송금 이체 확인증 등록" : "Submit Bank Wire Transfer Slip"}
              </DialogTitle>
              <DialogDescription>
                {lang === "KO"
                  ? `${selectedRoyaltyForReceipt?.month}월 청구 로열티 금액 $${Math.round(selectedRoyaltyForReceipt?.royaltyAmount || 0).toLocaleString()} 송금 내역에 대한 T/T Copy 또는 입금 확인증을 업로드하십시오.`
                  : `Upload the bank wire transfer receipt (T/T Copy) for month ${selectedRoyaltyForReceipt?.month} royalty amount of $${Math.round(selectedRoyaltyForReceipt?.royaltyAmount || 0).toLocaleString()}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {selectedRoyaltyForReceipt?.receiptUrl && (
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded text-xs font-bold text-emerald-700">
                  {lang === "KO" ? "기존 업로드된 송금 이체증이 존재합니다. 새 파일로 갱신하여 덮어씁니다." : "An active bank slip is already uploaded. Choosing a new file will overwrite it."}
                </div>
              )}
              <div className="grid gap-2 mt-4">
                <Label>
                  {lang === "KO" ? "송금 증빙 서류 선택" : "Select Wire Receipt File"}
                </Label>
                <DropzoneUploader 
                  onFileSelect={setReceiptFile} 
                  selectedFile={receiptFile}
                  subLabel={lang === "KO" ? "* 은행 이체 확인 PDF 문서 또는 사진 이미지(*.jpg, *.png)만 업로드 가능합니다." : "* Accepts PDF documents or image files."}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsReceiptUploadOpen(false);
                setReceiptFile(null);
                setSelectedRoyaltyForReceipt(null);
              }}>
                {lang === "KO" ? "취소" : "Cancel"}
              </Button>
              <Button type="submit" disabled={uploadingReceipt} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                {uploadingReceipt ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 animate-spin" />
                    {lang === "KO" ? "증빙 서류 전송 중..." : "Uploading..."}
                  </>
                ) : (lang === "KO" ? "송금 완료 보고" : "Report Payment")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* HQ Deposit Voucher upload Dialog Modal */}
      <Dialog open={isVoucherUploadOpen} onOpenChange={setIsVoucherUploadOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={handleVoucherUpload}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-bold text-lg text-amber-600">
                <FileText className="w-5 h-5 bg-amber-100 rounded-full text-amber-600 p-0.5" />
                {lang === "KO" ? "은행 입금 확인 및 수납 영수증 등록" : "Register Bank Deposit Receipt"}
              </DialogTitle>
              <DialogDescription>
                {lang === "KO"
                  ? `파트너사가 송금한 ${selectedRoyaltyForVoucher?.month}월 로열티 금액 $${Math.round(selectedRoyaltyForVoucher?.royaltyAmount || 0).toLocaleString()}이 본사 수취계좌에 실입금 되었는지 확인하고, 은행 수납 확인증을 업로드합니다.`
                  : `Confirm the reception of ${selectedRoyaltyForVoucher?.month} royalty amount of $${Math.round(selectedRoyaltyForVoucher?.royaltyAmount || 0).toLocaleString()}, and upload the bank deposit voucher.`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2 mt-4">
                <Label>
                  {lang === "KO" ? "본사 수납 증빙/영수증 서류 선택" : "Select HQ Voucher File"}
                </Label>
                <DropzoneUploader 
                  onFileSelect={setVoucherFile} 
                  selectedFile={voucherFile}
                  subLabel={lang === "KO" ? "* 은행 수납증 PDF 문서 또는 캡쳐 이미지(*.jpg, *.png)만 업로드 가능합니다." : "* Accepts PDF documents or captured image files."}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsVoucherUploadOpen(false);
                setVoucherFile(null);
                setSelectedRoyaltyForVoucher(null);
              }}>
                {lang === "KO" ? "취소" : "Cancel"}
              </Button>
              <Button type="submit" disabled={uploadingVoucher} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                {uploadingVoucher ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 animate-spin" />
                    {lang === "KO" ? "증빙 서류 등록 중..." : "Uploading..."}
                  </>
                ) : (lang === "KO" ? "수납 승인 완료" : "Approve Clear")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
