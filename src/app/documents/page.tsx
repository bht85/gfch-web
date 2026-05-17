"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, FileText, Download, Trash2, Calendar, File, Upload, Search, Filter, AlertCircle, Edit } from "lucide-react";

interface DocItem {
  id: string;
  name: string;
  partner: string;
  category: "contract" | "renewal" | "nda" | "other";
  startDate: string;
  endDate: string;
  fileName: string;
  fileSize: string;
  fileUrl: string;
  notes: string;
  uploadedAt: string;
}

const CATEGORY_MAP = {
  contract: { KO: "기본 계약서", EN: "Base Contract", color: "bg-blue-50 text-blue-700 border-blue-200" },
  renewal: { KO: "갱신 계약서", EN: "Renewal Contract", color: "bg-purple-50 text-purple-700 border-purple-200" },
  nda: { KO: "비밀유지약정 (NDA)", EN: "NDA Agreement", color: "bg-amber-50 text-amber-700 border-amber-200" },
  other: { KO: "기타 일반문서", EN: "Other Documents", color: "bg-slate-50 text-slate-700 border-slate-200" }
};

export default function DocumentsPage() {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useTranslation();
  const router = useRouter();

  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 모달 상태
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);

  // 폼 상태
  const [newDoc, setNewDoc] = useState({
    name: "",
    partner: "",
    category: "contract" as DocItem["category"],
    startDate: "",
    endDate: "",
    notes: ""
  });
  
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPartner, setFilterPartner] = useState("ALL");
  const [filterCategory, setFilterCategory] = useState("ALL");

  // MF 파트너 목록 (자동 파악용 또는 사전 정의)
  const [partners, setPartners] = useState<string[]>([]);

  // 보안 체크
  useEffect(() => {
    if (!authLoading && user && user.role !== "HQ") {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Firestore 실시간 문서 데이터 조회
  useEffect(() => {
    const q = query(collection(db, "documents"), orderBy("uploadedAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DocItem[];
      setDocuments(data);
      
      // 파트너 목록 자동 수집
      const extractedPartners = Array.from(new Set(data.map(d => d.partner))).filter(Boolean);
      // 혹시 없으면 기본 리스트 세팅
      if (extractedPartners.length === 0) {
        setPartners(["Japan Master Franchise", "Vietnam Food Corp", "Thailand Synergy"]);
      } else {
        setPartners(extractedPartners);
      }
      
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // 파일 업로드 및 데이터 저장
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.name || !newDoc.partner) {
      alert("문서 제목과 파트너사는 필수 입력 사항입니다.");
      return;
    }

    setUploading(true);

    try {
      if (file) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
          const base64Data = (reader.result as string).split(",")[1];
          const GAS_URL = process.env.NEXT_PUBLIC_GAS_UPLOAD_URL;

          if (!GAS_URL) {
            console.error("GAS Upload URL not configured");
            setUploading(false);
            alert(lang === "KO" ? "업로드 설정이 올바르지 않습니다." : "Upload configuration error.");
            return;
          }

          const response = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({
              filename: `documents_${newDoc.partner}_${Date.now()}_${file.name}`,
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

          const docData = {
            ...newDoc,
            fileName: file.name,
            fileSize: formatBytes(file.size),
            fileUrl: fileLink,
            uploadedAt: new Date().toISOString()
          };

          await addDoc(collection(db, "documents"), docData);

          // 폼 초기화 및 정리
          setNewDoc({
            name: "",
            partner: "",
            category: "contract",
            startDate: "",
            endDate: "",
            notes: ""
          });
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          setIsAddOpen(false);
          setUploading(false);
          alert(lang === "KO" ? "문서가 성공적으로 업로드 및 등록되었습니다." : "Document successfully registered.");
        };
      } else {
        const docData = {
          ...newDoc,
          fileName: lang === "KO" ? "첨부파일 없음" : "No attached file",
          fileSize: "-",
          fileUrl: "#",
          uploadedAt: new Date().toISOString()
        };

        await addDoc(collection(db, "documents"), docData);
        
        // 폼 초기화 및 정리
        setNewDoc({
          name: "",
          partner: "",
          category: "contract",
          startDate: "",
          endDate: "",
          notes: ""
        });
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setIsAddOpen(false);
        setUploading(false);
        alert(lang === "KO" ? "문서가 성공적으로 업로드 및 등록되었습니다." : "Document successfully registered.");
      }
    } catch (err) {
      console.error("Failed to add document:", err);
      alert("문서 등록 과정 중 오류가 발생했습니다.");
      setUploading(false);
    }
  };

  // 문서 정보 수정 저장
  const handleUpdateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;

    try {
      const docRef = doc(db, "documents", selectedDoc.id);
      const { id, uploadedAt, fileName, fileSize, fileUrl, ...updateData } = selectedDoc;
      await updateDoc(docRef, updateData);
      setIsEditOpen(false);
      setSelectedDoc(null);
      alert(lang === "KO" ? "문서 정보가 변경되었습니다." : "Document info updated.");
    } catch (err) {
      alert("수정 실패: " + err);
    }
  };

  // 문서 삭제
  const handleDeleteDocument = async (docId: string, docName: string) => {
    if (!confirm(lang === "KO" ? `[${docName}] 문서를 목록에서 영구 삭제하시겠습니까?` : `Are you sure you want to delete [${docName}]?`)) return;
    try {
      await deleteDoc(doc(db, "documents", docId));
      alert(lang === "KO" ? "성공적으로 삭제되었습니다." : "Deleted successfully.");
    } catch (err) {
      alert("삭제 실패: " + err);
    }
  };

  // 필터링 적용된 문서 리스트
  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          doc.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doc.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPartner = filterPartner === "ALL" || doc.partner === filterPartner;
    const matchesCategory = filterCategory === "ALL" || doc.category === filterCategory;
    return matchesSearch && matchesPartner && matchesCategory;
  });

  if (authLoading || (user && user.role !== "HQ")) {
    return <div className="h-96 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* 상단 타이틀 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{lang === "KO" ? "글로벌 계약 및 문서 관리" : "Global Contract & Document Hub"} 📂</h2>
          <p className="text-muted-foreground mt-2">
            {lang === "KO" 
              ? "마스터 프랜차이즈(MF)별 계약서, 갱신이력 등 주요 문서를 클라우드에 업로드하여 기록 보관합니다."
              : "Keep secure backups and logs of main franchise contracts, NDAs, and renewals per partner."}
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {lang === "KO" ? "새 문서 등록" : "Upload Document"}
        </Button>
      </div>

      {/* 필터 및 검색 바 */}
      <div className="bg-card p-4 rounded-xl border shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={lang === "KO" ? "문서명, 첨부파일명, 메모 검색..." : "Search docs, file names..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-muted-foreground hidden md:inline" />
          
          <select 
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs focus:ring-1 focus:ring-primary w-full md:w-48"
            value={filterPartner}
            onChange={(e) => setFilterPartner(e.target.value)}
          >
            <option value="ALL">{lang === "KO" ? "모든 파트너사" : "All Partners"}</option>
            {partners.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select 
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs focus:ring-1 focus:ring-primary w-full md:w-40"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="ALL">{lang === "KO" ? "모든 문서 유형" : "All Categories"}</option>
            <option value="contract">{lang === "KO" ? "기본 계약서" : "Base Contract"}</option>
            <option value="renewal">{lang === "KO" ? "갱신 계약서" : "Renewal"}</option>
            <option value="nda">{lang === "KO" ? "비밀유지약정" : "NDA"}</option>
            <option value="other">{lang === "KO" ? "기타 문서" : "Other"}</option>
          </select>
        </div>
      </div>

      {/* 문서 데이터 보드 */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[200px]">{lang === "KO" ? "파트너사" : "Partner"}</TableHead>
              <TableHead className="w-[120px]">{lang === "KO" ? "유형" : "Category"}</TableHead>
              <TableHead>{lang === "KO" ? "문서 정보 및 메모" : "Document Info & Memo"}</TableHead>
              <TableHead className="w-[180px]">{lang === "KO" ? "계약 기간" : "Validity Period"}</TableHead>
              <TableHead className="w-[150px]">{lang === "KO" ? "첨부파일" : "Attached File"}</TableHead>
              <TableHead className="w-[100px] text-right">{lang === "KO" ? "관리" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">보관된 주요 기밀 문서들을 로딩 중입니다...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredDocs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm italic">
                  {lang === "KO" ? "조회된 문서가 존재하지 않습니다." : "No documents found."}
                </TableCell>
              </TableRow>
            ) : filteredDocs.map((docItem) => {
              const cat = CATEGORY_MAP[docItem.category] || CATEGORY_MAP.other;
              const hasExpired = docItem.endDate && new Date(docItem.endDate) < new Date();
              
              return (
                <TableRow key={docItem.id} className="hover:bg-muted/10">
                  {/* 파트너사 */}
                  <TableCell className="font-semibold text-foreground">
                    {docItem.partner}
                  </TableCell>
                  
                  {/* 유형 배지 */}
                  <TableCell>
                    <Badge className={`border text-[10px] px-1.5 py-0.5 rounded-full ${cat.color}`} variant="outline">
                      {lang === "KO" ? cat.KO : cat.EN}
                    </Badge>
                  </TableCell>
                  
                  {/* 문서제목 및 내용 요약 */}
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        {docItem.name}
                      </span>
                      {docItem.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed bg-muted/20 p-2 rounded-md border border-dashed">
                          {docItem.notes}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  
                  {/* 계약 기간 */}
                  <TableCell>
                    <div className="flex flex-col gap-1 text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{docItem.startDate || "N/A"} ~ {docItem.endDate || "N/A"}</span>
                      </div>
                      {docItem.endDate && (
                        hasExpired ? (
                          <Badge variant="outline" className="w-fit text-[9px] border-red-200 text-red-600 bg-red-50 py-0 px-1 font-bold">
                            {lang === "KO" ? "⚠️ 기간 만료" : "Expired"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="w-fit text-[9px] border-green-200 text-green-700 bg-green-50 py-0 px-1 font-bold">
                            {lang === "KO" ? "✅ 유효함" : "Valid"}
                          </Badge>
                        )
                      )}
                    </div>
                  </TableCell>
                  
                  {/* 첨부파일 다운로드 */}
                  <TableCell>
                    <div className="flex flex-col gap-1 max-w-[140px]">
                      <span className="text-xs font-medium truncate font-mono text-muted-foreground" title={docItem.fileName}>
                        {docItem.fileName}
                      </span>
                      {docItem.fileUrl && docItem.fileUrl !== "#" ? (
                        <a 
                          href={docItem.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-primary hover:underline font-bold w-fit bg-primary/5 px-1.5 py-0.5 rounded border border-primary/20"
                        >
                          <Download className="w-3 h-3" />
                          {lang === "KO" ? "다운로드" : "Download"} ({docItem.fileSize})
                        </a>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">파일 없음</span>
                      )}
                    </div>
                  </TableCell>
                  
                  {/* 관리 기능 */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-primary hover:bg-primary/5" 
                        onClick={() => {
                          setSelectedDoc({ ...docItem });
                          setIsEditOpen(true);
                        }}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:bg-destructive/5" 
                        onClick={() => handleDeleteDocument(docItem.id, docItem.name)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* 🔒 새 문서 업로드 등록 모달 */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleAddDocument}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Upload className="w-5 h-5 text-primary" />
                {lang === "KO" ? "새 주요 기밀 문서 업로드" : "Register New Document"}
              </DialogTitle>
              <DialogDescription>
                {lang === "KO" ? "마스터 프랜차이즈 관련 갱신계약서, NDA 계약서 등의 메타데이터 및 주요 PDF 파일을 업로드합니다." : "Back up and track key corporate and partner contracts."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
              <div className="grid gap-2">
                <Label htmlFor="doc-name">{lang === "KO" ? "문서 제목" : "Document Title"}</Label>
                <Input 
                  id="doc-name" 
                  placeholder={lang === "KO" ? "예: 2026 베트남 마스터 가맹 연장계약서" : "e.g., 2026 VNM Master Franchise Extension"}
                  value={newDoc.name}
                  onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="doc-partner">{lang === "KO" ? "대상 파트너사" : "Partner"}</Label>
                  <select
                    id="doc-partner"
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    value={newDoc.partner}
                    onChange={(e) => setNewDoc({ ...newDoc, partner: e.target.value })}
                    required
                  >
                    <option value="">{lang === "KO" ? "선택하세요" : "Select Partner"}</option>
                    <option value="Japan Master Franchise">Japan Master Franchise</option>
                    <option value="Vietnam Food Corp">Vietnam Food Corp</option>
                    <option value="Thailand Synergy">Thailand Synergy</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="doc-cat">{lang === "KO" ? "문서 유형" : "Category"}</Label>
                  <select
                    id="doc-cat"
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    value={newDoc.category}
                    onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value as DocItem["category"] })}
                  >
                    <option value="contract">{lang === "KO" ? "기본 계약서" : "Base Contract"}</option>
                    <option value="renewal">{lang === "KO" ? "갱신 계약서" : "Renewal Contract"}</option>
                    <option value="nda">{lang === "KO" ? "NDA 약정" : "NDA Agreement"}</option>
                    <option value="other">{lang === "KO" ? "기타 문서" : "Other"}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="doc-start">{lang === "KO" ? "계약 효력 시작일" : "Effective Date"}</Label>
                  <Input 
                    id="doc-start" 
                    type="date"
                    value={newDoc.startDate}
                    onChange={(e) => setNewDoc({ ...newDoc, startDate: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="doc-end">{lang === "KO" ? "계약 효력 만료일" : "Expiration Date"}</Label>
                  <Input 
                    id="doc-end" 
                    type="date"
                    value={newDoc.endDate}
                    onChange={(e) => setNewDoc({ ...newDoc, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="doc-file">{lang === "KO" ? "실제 파일 첨부 (PDF, Word 등)" : "Attach Contract File"}</Label>
                <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-2 hover:bg-muted/10 transition-all cursor-pointer relative">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-semibold">
                    {file ? `${file.name} (${formatBytes(file.size)})` : (lang === "KO" ? "마우스로 드래그하거나 여기를 클릭하세요" : "Click or drag to upload")}
                  </span>
                  <Input 
                    id="doc-file" 
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="doc-notes">{lang === "KO" ? "특이사항 및 메모" : "Notes / Contract Scope"}</Label>
                <textarea
                  id="doc-notes"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                  placeholder={lang === "KO" ? "가맹 해지 조건, 연장 옵션 등의 세부사항을 입력하세요." : "Details about extensions, guarantees, penalty clauses..."}
                  value={newDoc.notes}
                  onChange={(e) => setNewDoc({ ...newDoc, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>{lang === "KO" ? "취소" : "Cancel"}</Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {lang === "KO" ? "기밀 파일 보안 업로드 중..." : "Uploading securely..."}
                  </>
                ) : (
                  lang === "KO" ? "문서 저장하기" : "Save Document"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 🔒 문서 정보 수정 모달 */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          {selectedDoc && (
            <form onSubmit={handleUpdateDocument}>
              <DialogHeader>
                <DialogTitle>{lang === "KO" ? "문서 메타데이터 수정" : "Edit Document Meta"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
                <div className="grid gap-2">
                  <Label>{lang === "KO" ? "문서 제목" : "Document Title"}</Label>
                  <Input 
                    value={selectedDoc.name}
                    onChange={(e) => setSelectedDoc({ ...selectedDoc, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{lang === "KO" ? "대상 파트너사" : "Partner"}</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                      value={selectedDoc.partner}
                      onChange={(e) => setSelectedDoc({ ...selectedDoc, partner: e.target.value })}
                      required
                    >
                      <option value="Japan Master Franchise">Japan Master Franchise</option>
                      <option value="Vietnam Food Corp">Vietnam Food Corp</option>
                      <option value="Thailand Synergy">Thailand Synergy</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label>{lang === "KO" ? "문서 유형" : "Category"}</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                      value={selectedDoc.category}
                      onChange={(e) => setSelectedDoc({ ...selectedDoc, category: e.target.value as DocItem["category"] })}
                    >
                      <option value="contract">{lang === "KO" ? "기본 계약서" : "Base Contract"}</option>
                      <option value="renewal">{lang === "KO" ? "갱신 계약서" : "Renewal Contract"}</option>
                      <option value="nda">{lang === "KO" ? "NDA 약정" : "NDA Agreement"}</option>
                      <option value="other">{lang === "KO" ? "기타 문서" : "Other"}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{lang === "KO" ? "계약 효력 시작일" : "Effective Date"}</Label>
                    <Input 
                      type="date"
                      value={selectedDoc.startDate}
                      onChange={(e) => setSelectedDoc({ ...selectedDoc, startDate: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{lang === "KO" ? "계약 효력 만료일" : "Expiration Date"}</Label>
                    <Input 
                      type="date"
                      value={selectedDoc.endDate}
                      onChange={(e) => setSelectedDoc({ ...selectedDoc, endDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>{lang === "KO" ? "특이사항 및 메모" : "Notes / Contract Scope"}</Label>
                  <textarea
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                    value={selectedDoc.notes}
                    onChange={(e) => setSelectedDoc({ ...selectedDoc, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>{lang === "KO" ? "취소" : "Cancel"}</Button>
                <Button type="submit">{lang === "KO" ? "변경사항 저장" : "Save Changes"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
