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

  // HQ specific states & new royalty fields
  const [isHQAddOpen, setIsHQAddOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [manualMonth, setManualMonth] = useState("");
  const [billingMonth, setBillingMonth] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [partnerStores, setPartnerStores] = useState<string[]>([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [grossSalesLocal, setGrossSalesLocal] = useState("");
  const [netSalesLocal, setNetSalesLocal] = useState("");
  const [manualRate, setManualRate] = useState("3.5");
  const [royaltyAmountUsd, setRoyaltyAmountUsd] = useState("");
  const [manualWithholdingTaxRate, setManualWithholdingTaxRate] = useState(0);

  // New Evidence upload files states
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [remittanceFile, setRemittanceFile] = useState<File | null>(null);
  const [salesEvidenceFile, setSalesEvidenceFile] = useState<File | null>(null);
  const [withholdingTaxFile, setWithholdingTaxFile] = useState<File | null>(null);

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

  // Unified Document Center States
  const [isDocumentCenterOpen, setIsDocumentCenterOpen] = useState(false);
  const [selectedRoyaltyForDocs, setSelectedRoyaltyForDocs] = useState<any>(null);
  const [uploadingDocType, setUploadingDocType] = useState<'invoice' | 'evidence' | 'remittance' | 'withholding' | null>(null);

  // Load configuration & dynamic references
  useEffect(() => {
    if (!user) return;
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
  }, [user]);

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

  // 파트너사 선택 시 로열티율, 원천징수율, 국가명, 매장목록 자동 연동
  useEffect(() => {
    if (!selectedPartnerId) {
      setManualRate("3.5");
      setManualWithholdingTaxRate(0);
      setSelectedCountry("");
      setPartnerStores([]);
      setSelectedStore("");
      return;
    }
    const partner = partners.find(p => p.id === selectedPartnerId);
    if (partner) {
      setManualRate(partner.royaltyRate !== undefined ? partner.royaltyRate.toString() : "3.5");
      setManualWithholdingTaxRate(partner.withholdingTaxRate !== undefined ? partner.withholdingTaxRate : 0);
      setSelectedCountry(partner.country || "");
      const stores = partner.stores || [];
      setPartnerStores(stores);
      setSelectedStore(stores[0] || "");
    }
  }, [selectedPartnerId, partners]);

  // Fetch partner's specific details if not HQ
  useEffect(() => {
    if (user && user.role !== "HQ") {
      const fetchPartnerData = async () => {
        try {
          const docSnap = await getDoc(doc(db, "partners", user.role));
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.royaltyRate !== undefined) {
              setPartnerContractRate(Number(data.royaltyRate));
              setManualRate(data.royaltyRate.toString());
            }
            if (data.withholdingTaxRate !== undefined) {
              setManualWithholdingTaxRate(Number(data.withholdingTaxRate));
            }
            if (data.country) {
              setSelectedCountry(data.country);
            }
            if (data.stores) {
              setPartnerStores(data.stores);
              setSelectedStore(data.stores[0] || "");
            }
          }
        } catch (err) {
          console.error("Error fetching partner details:", err);
        }
      };
      fetchPartnerData();
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
    if (!user || !declareMonth || !billingMonth || !netSalesLocal) {
      alert("정산월, 청구월, Net Sales는 필수 기입사항입니다.");
      return;
    }

    const grossSalesVal = parseFloat(grossSalesLocal) || 0;
    const netSalesVal = parseFloat(netSalesLocal) || 0;
    const royaltyRateVal = partnerContractRate;
    
    // 로열티 청구액(현지통화) = Net Sales * 청구율
    const royaltyAmountLocalVal = netSalesVal * (royaltyRateVal / 100);
    
    // 로열티 청구액(USD)
    const royaltyAmountUsdVal = parseFloat(royaltyAmountUsd) || 0;
    
    // 원천징수액(현지통화) = 로열티 청구액(현지통화) * 원천징수율
    const withholdingTaxLocalVal = royaltyAmountLocalVal * (manualWithholdingTaxRate / 100);
    
    // 로열티 실입금액(현지통화) = 청구액(현지통화) - 원천징수액(현지통화)
    const netRoyaltyLocalVal = royaltyAmountLocalVal - withholdingTaxLocalVal;

    // 문서 Key: 정산월_파트너ID_매장명(있을경우)
    const storeSuffix = selectedStore ? `_${selectedStore.replace(/\s+/g, "")}` : "";
    const recordId = `${declareMonth}_${user.role}${storeSuffix}`;

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
        billingMonth: billingMonth,
        country: selectedCountry,
        storeName: selectedStore,
        grossSalesLocal: grossSalesVal,
        netSalesLocal: netSalesVal,
        royaltyRate: royaltyRateVal,
        royaltyAmountLocal: royaltyAmountLocalVal,
        royaltyAmount: royaltyAmountUsdVal, // 로열티 청구액 USD
        withholdingTaxRate: manualWithholdingTaxRate,
        withholdingTaxLocal: withholdingTaxLocalVal,
        netRoyaltyLocal: netRoyaltyLocalVal,
        
        // 4종 증빙 서류 Url
        invoiceUrl: "",
        remittanceUrl: "",
        salesEvidenceUrl: evidenceUrl, // 자가신고 시 업로드한 파일을 매출증빙으로 등록
        withholdingTaxUrl: "",
        evidenceUrl: evidenceUrl, // 호환성용
        
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
      setBillingMonth("");
      setGrossSalesLocal("");
      setNetSalesLocal("");
      setRoyaltyAmountUsd("");
      setEvidenceFile(null);
      alert("매출 신고가 성공적으로 완료되었습니다. 본사 승인을 기다려주세요.");
    } catch (err) {
      alert("신고 등록 중 에러 발생: " + err);
    } finally {
      setUploading(false);
    }
  };

  // Unified document upload handler
  const handleDocumentUpload = async (file: File, type: 'invoice' | 'evidence' | 'remittance' | 'withholding') => {
    if (!selectedRoyaltyForDocs) return;
    
    setUploadingDocType(type);
    try {
      let fileUrl = "";
      const base64Data = await fileToBase64(file);
      
      const gasUrl = systemConfig?.gasUrl || "https://script.google.com/macros/s/AKfycbxOszg6c1l6uNspv4NlR1wN_J1L6L26g2L87y_1x19w84-3y10P/exec";
      const folderId = systemConfig?.driveFolderId || "";
      
      const response = await fetch(gasUrl, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          filename: `RoyaltyDoc_${type}_${selectedRoyaltyForDocs.month}_${selectedRoyaltyForDocs.partnerId}_${file.name}`,
          mimeType: file.type,
          fileData: base64Data,
          folderId: folderId
        })
      });
      
      const resJson = await response.json();
      if (resJson && resJson.status === "success") {
        fileUrl = resJson.url;
      } else if (resJson && resJson.url) {
        fileUrl = resJson.url;
      }
      
      if (!fileUrl) {
        throw new Error("파일 업로드에 실패했습니다. API 응답을 확인하세요.");
      }

      // Update in Firestore
      const updateData: any = {
        updatedAt: new Date().toISOString()
      };
      
      if (type === 'invoice') {
        updateData.invoiceUrl = fileUrl;
      } else if (type === 'evidence') {
        updateData.salesEvidenceUrl = fileUrl;
        updateData.evidenceUrl = fileUrl; // 호환성 유지
      } else if (type === 'remittance') {
        updateData.remittanceUrl = fileUrl;
        updateData.receiptUrl = fileUrl; // 호환성 유지
      } else if (type === 'withholding') {
        updateData.withholdingTaxUrl = fileUrl;
      }
      
      await updateDoc(doc(db, "royalties", selectedRoyaltyForDocs.id), updateData);
      
      // Update local state to reflect UI instantly
      setSelectedRoyaltyForDocs((prev: any) => ({
        ...prev,
        ...updateData
      }));
      
      alert("문서가 성공적으로 업로드되었습니다.");
    } catch (err) {
      alert("문서 업로드 에러: " + err);
    } finally {
      setUploadingDocType(null);
    }
  };

  // Unified document delete handler
  const handleDocumentDelete = async (type: 'invoice' | 'evidence' | 'remittance' | 'withholding') => {
    if (!selectedRoyaltyForDocs) return;
    if (!confirm("정말로 이 증빙 서류를 삭제하시겠습니까?")) return;
    
    setUploadingDocType(type);
    try {
      const updateData: any = {
        updatedAt: new Date().toISOString()
      };
      
      if (type === 'invoice') {
        updateData.invoiceUrl = "";
      } else if (type === 'evidence') {
        updateData.salesEvidenceUrl = "";
        updateData.evidenceUrl = "";
      } else if (type === 'remittance') {
        updateData.remittanceUrl = "";
        updateData.receiptUrl = "";
      } else if (type === 'withholding') {
        updateData.withholdingTaxUrl = "";
      }
      
      await updateDoc(doc(db, "royalties", selectedRoyaltyForDocs.id), updateData);
      
      // Update local state
      setSelectedRoyaltyForDocs((prev: any) => ({
        ...prev,
        ...updateData
      }));
      
      alert("문서가 성공적으로 삭제되었습니다.");
    } catch (err) {
      alert("문서 삭제 에러: " + err);
    } finally {
      setUploadingDocType(null);
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
    if (!selectedPartnerId || !manualMonth || !billingMonth || !netSalesLocal) {
      alert("정산월, 청구월, Net Sales 및 파트너사는 필수 기입사항입니다.");
      return;
    }

    const partner = partners.find(p => p.id === selectedPartnerId);
    if (!partner) return;

    const grossSalesVal = parseFloat(grossSalesLocal) || 0;
    const netSalesVal = parseFloat(netSalesLocal) || 0;
    const royaltyRateVal = parseFloat(manualRate) || 3.5;
    
    // 로열티 청구액(현지통화) = Net Sales * 청구율
    const royaltyAmountLocalVal = netSalesVal * (royaltyRateVal / 100);
    
    // 로열티 청구액(USD)
    const royaltyAmountUsdVal = parseFloat(royaltyAmountUsd) || 0;
    
    // 원천징수액(현지통화) = 로열티 청구액(현지통화) * 원천징수율
    const withholdingTaxLocalVal = royaltyAmountLocalVal * (manualWithholdingTaxRate / 100);
    
    // 로열티 실입금액(현지통화) = 청구액(현지통화) - 원천징수액(현지통화)
    const netRoyaltyLocalVal = royaltyAmountLocalVal - withholdingTaxLocalVal;

    // 문서 Key: 정산월_파트너ID_매장명(있을경우)
    const storeSuffix = selectedStore ? `_${selectedStore.replace(/\s+/g, "")}` : "";
    const recordId = `${manualMonth}_${selectedPartnerId}${storeSuffix}`;

    try {
      await setDoc(doc(db, "royalties", recordId), {
        partnerId: selectedPartnerId,
        partnerName: partner.name,
        partnerCode: partner.country || "MF",
        month: manualMonth,
        billingMonth: billingMonth,
        country: selectedCountry,
        storeName: selectedStore,
        grossSalesLocal: grossSalesVal,
        netSalesLocal: netSalesVal,
        royaltyRate: royaltyRateVal,
        royaltyAmountLocal: royaltyAmountLocalVal,
        royaltyAmount: royaltyAmountUsdVal, // 기존의 달러 로열티 청구액은 합계 등을 위해 유지
        withholdingTaxRate: manualWithholdingTaxRate,
        withholdingTaxLocal: withholdingTaxLocalVal,
        netRoyaltyLocal: netRoyaltyLocalVal,
        
        // 4종 증빙 서류 Url
        invoiceUrl: "",
        remittanceUrl: "",
        salesEvidenceUrl: "",
        withholdingTaxUrl: "",
        evidenceUrl: "", // 기존 소스 호환용
        
        status: "INVOICED", // HQ manual claims start as INVOICED directly
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setIsHQAddOpen(false);
      setSelectedPartnerId("");
      setManualMonth("");
      setBillingMonth("");
      setGrossSalesLocal("");
      setNetSalesLocal("");
      setRoyaltyAmountUsd("");
      setSelectedStore("");
      setPartnerStores([]);
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
              <TableHead className="w-[80px]">{lang === "KO" ? "정산/청구월" : "Month"}</TableHead>
              <TableHead>{lang === "KO" ? "파트너사 / 매장 (국가)" : "Partner / Store (Country)"}</TableHead>
              <TableHead className="text-right">{lang === "KO" ? "Gross 매출 (현지)" : "Gross Sales (Local)"}</TableHead>
              <TableHead className="text-right font-semibold">{lang === "KO" ? "Net 매출 (현지)" : "Net Sales (Local)"}</TableHead>
              <TableHead className="text-center text-xs">{lang === "KO" ? "요율/원천징수" : "Rate/WHT"}</TableHead>
              <TableHead className="text-right font-extrabold text-blue-600">{lang === "KO" ? "청구액 (현지)" : "Royalty (Local)"}</TableHead>
              <TableHead className="text-right font-extrabold text-indigo-600">{lang === "KO" ? "청구액 (USD)" : "Royalty (USD)"}</TableHead>
              <TableHead className="text-right font-bold text-emerald-600">{lang === "KO" ? "실입금액 (현지)" : "Net Royalty (Local)"}</TableHead>
              <TableHead className="text-center">{lang === "KO" ? "증빙 서류" : "Documents"}</TableHead>
              <TableHead className="text-center">{lang === "KO" ? "정산 상태" : "Status"}</TableHead>
              <TableHead className="text-right">{lang === "KO" ? "정산 관리" : "Management"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderedLedger.map((row, i) => (
              <TableRow key={i} className="hover:bg-muted/10 transition-colors">
                <TableCell className="font-mono text-xs">
                  <div className="font-bold text-slate-800">{row.month}</div>
                  <div className="text-[10px] text-slate-400 font-medium">{row.billingMonth || "-"}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 text-xs">{row.partnerName}</span>
                    <span className="text-[10px] text-slate-500 font-semibold">{row.storeName || "-"} {row.country ? `(${row.country})` : ""}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-slate-600">
                  {row.grossSalesLocal ? row.grossSalesLocal.toLocaleString() : "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold text-slate-800">
                  {row.netSalesLocal ? row.netSalesLocal.toLocaleString() : "-"}
                </TableCell>
                <TableCell className="text-center font-mono text-[11px] text-slate-500">
                  <div>R: {row.royaltyRate}%</div>
                  <div className="text-slate-400">W: {row.withholdingTaxRate || 0}%</div>
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-extrabold text-blue-600">
                  {row.royaltyAmountLocal ? Math.round(row.royaltyAmountLocal).toLocaleString() : "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-extrabold text-indigo-600">
                  ${row.royaltyAmount ? Math.round(row.royaltyAmount).toLocaleString() : "0"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-bold text-emerald-600">
                  {row.netRoyaltyLocal ? Math.round(row.netRoyaltyLocal).toLocaleString() : "-"}
                </TableCell>
                
                {/* 4대 증빙 서류 아이콘 & 모달 연결 */}
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1 justify-center">
                      <span 
                        className={`w-2.5 h-2.5 rounded-full ${row.invoiceUrl ? 'bg-emerald-500' : 'bg-slate-300'}`} 
                        title={lang === "KO" ? (row.invoiceUrl ? "인보이스 등록됨" : "인보이스 미등록") : (row.invoiceUrl ? "Invoice Uploaded" : "No Invoice")}
                      />
                      <span 
                        className={`w-2.5 h-2.5 rounded-full ${(row.salesEvidenceUrl || row.evidenceUrl) ? 'bg-blue-500' : 'bg-slate-300'}`} 
                        title={lang === "KO" ? ((row.salesEvidenceUrl || row.evidenceUrl) ? "매출증빙 등록됨" : "매출증빙 미등록") : ((row.salesEvidenceUrl || row.evidenceUrl) ? "Sales Evidence Uploaded" : "No Sales Evidence")}
                      />
                      <span 
                        className={`w-2.5 h-2.5 rounded-full ${(row.remittanceUrl || row.receiptUrl) ? 'bg-amber-500' : 'bg-slate-300'}`} 
                        title={lang === "KO" ? ((row.remittanceUrl || row.receiptUrl) ? "송금증 등록됨" : "송금증 미등록") : ((row.remittanceUrl || row.receiptUrl) ? "Remittance Uploaded" : "No Remittance")}
                      />
                      <span 
                        className={`w-2.5 h-2.5 rounded-full ${row.withholdingTaxUrl ? 'bg-purple-500' : 'bg-slate-300'}`} 
                        title={lang === "KO" ? (row.withholdingTaxUrl ? "원천징수증 등록됨" : "원천징수증 미등록") : (row.withholdingTaxUrl ? "WHT Receipt Uploaded" : "No WHT Receipt")}
                      />
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => {
                        setSelectedRoyaltyForDocs(row);
                        setIsDocumentCenterOpen(true);
                      }}
                      className="h-6 px-1.5 text-[10px] font-bold text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50/50 border border-slate-200"
                    >
                      {lang === "KO" ? "증빙 관리" : "Docs"}
                    </Button>
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
                              setSelectedRoyaltyForDocs(row);
                              setIsDocumentCenterOpen(true);
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
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                  {lang === "KO" ? "로열티 정산 내역이 없습니다." : "No royalty records."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Partner Declaration Dialog Modal */}
      <Dialog open={isDeclareOpen} onOpenChange={setIsDeclareOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handlePartnerDeclare}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-bold text-lg text-primary">
                <DollarSign className="w-5 h-5 bg-blue-100 rounded-full text-blue-600 p-0.5" />
                {lang === "KO" ? "월별 POS 매출 및 로열티 신고" : "Declare POS Sales & Royalty"}
              </DialogTitle>
              <DialogDescription>
                {lang === "KO" 
                  ? "현지 매장의 상세 매출 및 정산 정보를 기입하고 본사 승인을 요청합니다."
                  : "Submit monthly sales figures and details for contract calculation."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
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
                  <Label htmlFor="declare-billing-month">{lang === "KO" ? "청구 월" : "Billing Month"}</Label>
                  <Input 
                    id="declare-billing-month"
                    type="month"
                    value={billingMonth}
                    onChange={(e) => setBillingMonth(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{lang === "KO" ? "국가명" : "Country"}</Label>
                  <Input 
                    value={selectedCountry || ""} 
                    disabled 
                    className="bg-slate-50 font-bold"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="declare-store">{lang === "KO" ? "매장명" : "Store Name"}</Label>
                  <select
                    id="declare-store"
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-medium"
                  >
                    <option value="">{lang === "KO" ? "매장 선택" : "Select Store"}</option>
                    {partnerStores.map(store => (
                      <option key={store} value={store} className="text-slate-900">{store}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="declare-gross-sales">{lang === "KO" ? "Gross Sales (현지통화)" : "Gross Sales (Local)"}</Label>
                  <Input 
                    id="declare-gross-sales"
                    type="number"
                    placeholder="0"
                    value={grossSalesLocal}
                    onChange={(e) => setGrossSalesLocal(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="declare-net-sales">{lang === "KO" ? "Net Sales (현지통화)" : "Net Sales (Local)"}</Label>
                  <Input 
                    id="declare-net-sales"
                    type="number"
                    placeholder="0"
                    value={netSalesLocal}
                    onChange={(e) => setNetSalesLocal(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg text-xs border">
                <div>
                  <div className="text-slate-500 font-bold">{lang === "KO" ? "청구율" : "Royalty Rate"}</div>
                  <div className="font-mono text-sm font-black text-slate-800">{partnerContractRate}%</div>
                </div>
                <div>
                  <div className="text-slate-500 font-bold">{lang === "KO" ? "원천징수율" : "WHT Rate"}</div>
                  <div className="font-mono text-sm font-black text-slate-800">{manualWithholdingTaxRate}%</div>
                </div>
                <div>
                  <div className="text-slate-500 font-bold">{lang === "KO" ? "국가" : "Country"}</div>
                  <div className="font-sans text-sm font-bold text-slate-800">{selectedCountry || "-"}</div>
                </div>
              </div>

              {/* 실시간 계산 패널 */}
              {netSalesLocal && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between font-bold text-slate-600">
                    <span>{lang === "KO" ? "로열티 청구액 (현지통화)" : "Royalty Local"}</span>
                    <span className="font-mono text-blue-600">
                      {((parseFloat(netSalesLocal) || 0) * (partnerContractRate / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-600">
                    <span>{lang === "KO" ? "원천징수액 (현지통화)" : "WHT Local"}</span>
                    <span className="font-mono text-amber-600">
                      {(((parseFloat(netSalesLocal) || 0) * (partnerContractRate / 100)) * (manualWithholdingTaxRate / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="flex justify-between font-extrabold text-slate-900">
                    <span>{lang === "KO" ? "실 입금액 (현지통화)" : "Net Royalty Local"}</span>
                    <span className="font-mono text-emerald-600">
                      {(((parseFloat(netSalesLocal) || 0) * (partnerContractRate / 100)) * (1 - manualWithholdingTaxRate / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="declare-sales-usd">{lang === "KO" ? "로열티 청구액 (USD 수기입력)" : "Royalty Due (USD Manual)"}</Label>
                <Input 
                  id="declare-sales-usd"
                  placeholder="0.00"
                  value={royaltyAmountUsd}
                  onChange={(e) => setRoyaltyAmountUsd(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label>{lang === "KO" ? "매출 실적 증명 자료" : "Sales Evidence Report"}</Label>
                <DropzoneUploader 
                  onFileSelect={setEvidenceFile} 
                  selectedFile={evidenceFile}
                  label={lang === "KO" ? "클릭하거나 파일을 드래그하여 업로드" : "Drag & drop or click to upload"}
                />
              </div>
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
        <DialogContent className="sm:max-w-[500px]">
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
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
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
                  <Label htmlFor="manual-billing-month">{lang === "KO" ? "청구 월" : "Billing Month"}</Label>
                  <Input 
                    id="manual-billing-month"
                    type="month"
                    value={billingMonth}
                    onChange={(e) => setBillingMonth(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="manual-country">{lang === "KO" ? "국가명" : "Country"}</Label>
                  <select
                    id="manual-country"
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                  >
                    <option value="">{lang === "KO" ? "국가 선택" : "Select Country"}</option>
                    <option value="대만">대만 (Taiwan)</option>
                    <option value="필리핀">필리핀 (Philippines)</option>
                    <option value="싱가포르">싱가포르 (Singapore)</option>
                    <option value="말레이시아">말레이시아 (Malaysia)</option>
                    <option value="홍콩">홍콩 (Hong Kong)</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-store">{lang === "KO" ? "매장명" : "Store Name"}</Label>
                  <select
                    id="manual-store"
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                  >
                    <option value="">{lang === "KO" ? "매장 선택" : "Select Store"}</option>
                    {partnerStores.map(store => (
                      <option key={store} value={store} className="text-slate-900">{store}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="manual-gross-sales">{lang === "KO" ? "Gross Sales (현지통화)" : "Gross Sales (Local)"}</Label>
                  <Input 
                    id="manual-gross-sales"
                    type="number"
                    placeholder="0"
                    value={grossSalesLocal}
                    onChange={(e) => setGrossSalesLocal(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-net-sales">{lang === "KO" ? "Net Sales (현지통화)" : "Net Sales (Local)"}</Label>
                  <Input 
                    id="manual-net-sales"
                    type="number"
                    placeholder="0"
                    value={netSalesLocal}
                    onChange={(e) => setNetSalesLocal(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                <div className="grid gap-2">
                  <Label htmlFor="manual-tax-rate">{lang === "KO" ? "원천징수 요율 (%)" : "Withholding Tax Rate (%)"}</Label>
                  <Input 
                    id="manual-tax-rate"
                    type="number"
                    step="0.1"
                    value={manualWithholdingTaxRate}
                    onChange={(e) => setManualWithholdingTaxRate(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>

              {/* 실시간 계산 패널 */}
              {netSalesLocal && (
                <div className="bg-slate-50 border p-3 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between font-bold text-slate-600">
                    <span>{lang === "KO" ? "로열티 청구액 (현지통화)" : "Royalty Local"}</span>
                    <span className="font-mono text-blue-600">
                      {((parseFloat(netSalesLocal) || 0) * (parseFloat(manualRate) || 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-600">
                    <span>{lang === "KO" ? "원천징수액 (현지통화)" : "WHT Local"}</span>
                    <span className="font-mono text-amber-600">
                      {(((parseFloat(netSalesLocal) || 0) * (parseFloat(manualRate) || 0) / 100) * (manualWithholdingTaxRate / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="flex justify-between font-extrabold text-slate-900">
                    <span>{lang === "KO" ? "실 입금액 (현지통화)" : "Net Royalty Local"}</span>
                    <span className="font-mono text-emerald-600">
                      {(((parseFloat(netSalesLocal) || 0) * (parseFloat(manualRate) || 0) / 100) * (1 - manualWithholdingTaxRate / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="manual-sales-usd">{lang === "KO" ? "로열티 청구액 (USD 수기입력)" : "Royalty Due (USD Manual)"}</Label>
                <Input 
                  id="manual-sales-usd"
                  placeholder="0.00"
                  value={royaltyAmountUsd}
                  onChange={(e) => setRoyaltyAmountUsd(e.target.value)}
                  required
                />
              </div>
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

      {/* Unified Document Center Dialog Modal */}
      <Dialog open={isDocumentCenterOpen} onOpenChange={setIsDocumentCenterOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-lg text-primary">
              <FileText className="w-5 h-5 bg-blue-100 rounded-full text-blue-600 p-0.5" />
              {lang === "KO" ? "증빙 서류 센터" : "Royalty Document Center"}
            </DialogTitle>
            <DialogDescription>
              {lang === "KO"
                ? `${selectedRoyaltyForDocs?.month} 정산 분에 대한 4대 증빙 서류를 관리합니다.`
                : `Manage the 4 core settlement documents for target month ${selectedRoyaltyForDocs?.month}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            {/* 1. 인보이스 (Invoice) */}
            <div className="flex items-center justify-between border-b pb-3.5">
              <div>
                <div className="font-extrabold text-sm text-slate-800">{lang === "KO" ? "1. 인보이스 (Invoice)" : "1. Invoice"}</div>
                <div className="text-[11px] text-slate-400 font-medium">{lang === "KO" ? "본사 발행 공식 청구서" : "HQ Issued Claim Statement"}</div>
              </div>
              <div className="flex items-center gap-2">
                {selectedRoyaltyForDocs?.invoiceUrl ? (
                  <>
                    <a href={selectedRoyaltyForDocs.invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                      <FileText className="w-3.5 h-3.5" />
                      {lang === "KO" ? "보기" : "View"}
                    </a>
                    {user?.role === "HQ" && (
                      <Button size="sm" variant="ghost" onClick={() => handleDocumentDelete('invoice')} className="h-7 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold text-xs">
                        {lang === "KO" ? "삭제" : "Delete"}
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    {user?.role === "HQ" ? (
                      <>
                        <input 
                          type="file" 
                          id="upload-doc-invoice" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleDocumentUpload(file, 'invoice');
                          }} 
                        />
                        <Button size="sm" variant="outline" onClick={() => document.getElementById('upload-doc-invoice')?.click()} disabled={uploadingDocType === 'invoice'} className="text-xs h-8 border-dashed hover:border-solid gap-1">
                          {uploadingDocType === 'invoice' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          {lang === "KO" ? "업로드" : "Upload"}
                        </Button>
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic font-medium">{lang === "KO" ? "본사 발행 대기" : "Awaiting HQ Issue"}</span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 2. 매출증빙 (Sales Evidence) */}
            <div className="flex items-center justify-between border-b pb-3.5">
              <div>
                <div className="font-extrabold text-sm text-slate-800">{lang === "KO" ? "2. 매출증빙 (Sales Doc)" : "2. Sales Evidence"}</div>
                <div className="text-[11px] text-slate-400 font-medium">{lang === "KO" ? "POS 실적 보고서 및 마감 문서" : "POS Performance Report"}</div>
              </div>
              <div className="flex items-center gap-2">
                {(selectedRoyaltyForDocs?.salesEvidenceUrl || selectedRoyaltyForDocs?.evidenceUrl) ? (
                  <>
                    <a href={selectedRoyaltyForDocs.salesEvidenceUrl || selectedRoyaltyForDocs.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                      <FileText className="w-3.5 h-3.5" />
                      {lang === "KO" ? "보기" : "View"}
                    </a>
                    <Button size="sm" variant="ghost" onClick={() => handleDocumentDelete('evidence')} className="h-7 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold text-xs">
                      {lang === "KO" ? "삭제" : "Delete"}
                    </Button>
                  </>
                ) : (
                  <>
                    <input 
                      type="file" 
                      id="upload-doc-evidence" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleDocumentUpload(file, 'evidence');
                      }} 
                    />
                    <Button size="sm" variant="outline" onClick={() => document.getElementById('upload-doc-evidence')?.click()} disabled={uploadingDocType === 'evidence'} className="text-xs h-8 border-dashed hover:border-solid gap-1">
                      {uploadingDocType === 'evidence' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      {lang === "KO" ? "업로드" : "Upload"}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* 3. 송금증 (Remittance Slip) */}
            <div className="flex items-center justify-between border-b pb-3.5">
              <div>
                <div className="font-extrabold text-sm text-slate-800">{lang === "KO" ? "3. 송금증 (Remittance)" : "3. Remittance Slip"}</div>
                <div className="text-[11px] text-slate-400 font-medium">{lang === "KO" ? "해외 송금 이체 확인증 (T/T Copy)" : "T/T Copy or Bank Slip"}</div>
              </div>
              <div className="flex items-center gap-2">
                {(selectedRoyaltyForDocs?.remittanceUrl || selectedRoyaltyForDocs?.receiptUrl) ? (
                  <>
                    <a href={selectedRoyaltyForDocs.remittanceUrl || selectedRoyaltyForDocs.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                      <FileText className="w-3.5 h-3.5" />
                      {lang === "KO" ? "보기" : "View"}
                    </a>
                    <Button size="sm" variant="ghost" onClick={() => handleDocumentDelete('remittance')} className="h-7 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold text-xs">
                      {lang === "KO" ? "삭제" : "Delete"}
                    </Button>
                  </>
                ) : (
                  <>
                    {user?.role !== "HQ" ? (
                      <>
                        <input 
                          type="file" 
                          id="upload-doc-remittance" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleDocumentUpload(file, 'remittance');
                          }} 
                        />
                        <Button size="sm" variant="outline" onClick={() => document.getElementById('upload-doc-remittance')?.click()} disabled={uploadingDocType === 'remittance'} className="text-xs h-8 border-dashed hover:border-solid gap-1">
                          {uploadingDocType === 'remittance' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          {lang === "KO" ? "업로드" : "Upload"}
                        </Button>
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic font-medium">{lang === "KO" ? "파트너 송금 대기" : "Awaiting Partner Payment"}</span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 4. 원천징수영수증 (Withholding Tax Receipt) */}
            <div className="flex items-center justify-between pb-1">
              <div>
                <div className="font-extrabold text-sm text-slate-800">{lang === "KO" ? "4. 원천징수영수증 (WHT)" : "4. Tax Receipt"}</div>
                <div className="text-[11px] text-slate-400 font-medium">{lang === "KO" ? "세금 공제 영수증 (WHT Receipt)" : "Withholding Tax Receipt"}</div>
              </div>
              <div className="flex items-center gap-2">
                {selectedRoyaltyForDocs?.withholdingTaxUrl ? (
                  <>
                    <a href={selectedRoyaltyForDocs.withholdingTaxUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                      <FileText className="w-3.5 h-3.5" />
                      {lang === "KO" ? "보기" : "View"}
                    </a>
                    <Button size="sm" variant="ghost" onClick={() => handleDocumentDelete('withholding')} className="h-7 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold text-xs">
                      {lang === "KO" ? "삭제" : "Delete"}
                    </Button>
                  </>
                ) : (
                  <>
                    <input 
                      type="file" 
                      id="upload-doc-withholding" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleDocumentUpload(file, 'withholding');
                      }} 
                    />
                    <Button size="sm" variant="outline" onClick={() => document.getElementById('upload-doc-withholding')?.click()} disabled={uploadingDocType === 'withholding'} className="text-xs h-8 border-dashed hover:border-solid gap-1">
                      {uploadingDocType === 'withholding' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      {lang === "KO" ? "업로드" : "Upload"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setIsDocumentCenterOpen(false)} className="bg-slate-900 hover:bg-slate-800 text-white font-bold">
              {lang === "KO" ? "닫기" : "Close"}
            </Button>
          </DialogFooter>
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
