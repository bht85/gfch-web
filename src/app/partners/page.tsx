"use client";

import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useState, useEffect, Fragment } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, setDoc, query, orderBy, getDoc } from "firebase/firestore";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, User, Trash2, Edit2, ChevronDown, ChevronUp, Plus, ShieldAlert, Send } from "lucide-react";

export default function PartnersPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useTranslation();
  const router = useRouter();

  const [partners, setPartners] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  
  const [newPartner, setNewPartner] = useState({ name: "", country: "대만", type: "MF", startDate: "", endDate: "", contacts: [], royaltyRate: 3.5, withholdingTaxRate: 0, storesStr: "1호점, 2호점" });
  const [editingPartner, setEditingPartner] = useState<any>(null);
  const [newContact, setNewContact] = useState({ name: "", email: "", role: "" });
  
  const [newInvite, setNewInvite] = useState({ email: "", name: "", role: "HQ", partnerCode: "" });

  // 보안 체크
  useEffect(() => {
    if (!authLoading && user && user.role !== "HQ") {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Firestore 실시간 조회 - 파트너 목록
  useEffect(() => {
    const q = query(collection(db, "partners"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPartners(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore 실시간 조회 - 초대장(사전 승인 이메일) 목록
  useEffect(() => {
    const q = query(collection(db, "invites"), orderBy("email", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvites(data);
      setInvitesLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSendInvite = async () => {
    if (!newInvite.email || !newInvite.name) {
      alert("이메일과 이름을 모두 입력해 주세요.");
      return;
    }
    const cleanEmail = newInvite.email.trim().toLowerCase();
    try {
      await setDoc(doc(db, "invites", cleanEmail), {
        email: cleanEmail,
        name: newInvite.name,
        role: newInvite.role,
        partnerCode: newInvite.role === "HQ" ? "" : newInvite.partnerCode,
        status: "PENDING",
        createdAt: new Date().toISOString()
      });
      setNewInvite({ email: "", name: "", role: "HQ", partnerCode: "" });
      setIsInviteModalOpen(false);
      alert("가입 승인(초대) 메일이 등록되었습니다.");
    } catch (e) {
      alert("등록 실패: " + e);
    }
  };

  const handleRevokeInvite = async (email: string) => {
    if (!confirm(`이메일 ${email}의 가입 승인 권한을 취소하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, "invites", email));
      alert("권한이 철회되었습니다.");
    } catch (e) {
      alert("철회 실패: " + e);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const handleAddPartner = async () => {
    if (!newPartner.name || !newPartner.country) return;
    try {
      const stores = newPartner.storesStr
        ? newPartner.storesStr.split(",").map(s => s.trim()).filter(Boolean)
        : [];
      const dataToSave = {
        name: newPartner.name,
        country: newPartner.country,
        type: newPartner.type,
        startDate: newPartner.startDate,
        endDate: newPartner.endDate,
        contacts: newPartner.contacts,
        royaltyRate: newPartner.royaltyRate,
        withholdingTaxRate: newPartner.withholdingTaxRate || 0,
        stores
      };
      await addDoc(collection(db, "partners"), dataToSave);
      setNewPartner({ name: "", country: "대만", type: "MF", startDate: "", endDate: "", contacts: [], royaltyRate: 3.5, withholdingTaxRate: 0, storesStr: "1호점, 2호점" });
      setIsAddModalOpen(false);
    } catch (error) {
      alert("Error adding partner: " + error);
    }
  };

  const handleUpdatePartner = async () => {
    if (!editingPartner) return;
    try {
      const { id, storesStr, ...data } = editingPartner;
      const stores = storesStr
        ? storesStr.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [];
      const dataToSave = {
        ...data,
        stores
      };
      await updateDoc(doc(db, "partners", id), dataToSave);
      
      // 🔒 자동 초대 연동 (Phase 2)
      if (data.contacts && Array.isArray(data.contacts)) {
        for (const contact of data.contacts) {
          if (!contact.email || !contact.name) continue;
          const cleanEmail = contact.email.trim().toLowerCase();
          const inviteRef = doc(db, "invites", cleanEmail);
          const inviteDoc = await getDoc(inviteRef);
          if (!inviteDoc.exists()) {
            await setDoc(inviteRef, {
              email: cleanEmail,
              name: contact.name,
              role: id, // 파트너사 Firestore 문서 ID를 유저의 권한 역할(SaaS 테넌트 ID)로 부여
              partnerCode: data.country || "MF",
              status: "PENDING",
              createdAt: new Date().toISOString()
            });
          }
        }
      }
      
      setIsEditModalOpen(false);
    } catch (error) {
      alert("Error updating partner: " + error);
    }
  };

  const addContactToEditing = () => {
    if (!newContact.name || !newContact.email) return;
    setEditingPartner({
      ...editingPartner,
      contacts: [...(editingPartner.contacts || []), newContact]
    });
    setNewContact({ name: "", email: "", role: "" });
  };

  const removeContactFromEditing = (index: number) => {
    const contacts = [...editingPartner.contacts];
    contacts.splice(index, 1);
    setEditingPartner({ ...editingPartner, contacts });
  };

  if (authLoading || (user && user.role !== "HQ")) {
    return <div className="h-96 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{lang === "KO" ? "파트너사 관리" : "Partner Management"}</h2>
          <p className="text-muted-foreground mt-2">
            {lang === "KO" ? "마스터 프랜차이즈(MF) 및 벤더 업체를 관리합니다." : "Manage Master Franchise (MF) and Vendor companies."}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsInviteModalOpen(true)} className="border-primary text-primary hover:bg-primary/5">
            <Send className="mr-2 h-4 w-4" /> {lang === "KO" ? "가입 승인(초대) 관리" : "Invite & Approve"}
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> {lang === "KO" ? "파트너 추가" : "Add Partner"}
          </Button>
        </div>

        {/* 🔒 가입 승인(초대) 관리 모달 */}
        <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <ShieldAlert className="w-5 h-5 text-primary" />
                {lang === "KO" ? "사전 가입 승인 및 회원 초대 관리" : "Pre-Authorized Registrations"}
              </DialogTitle>
              <DialogDescription>
                {lang === "KO" ? "본사에서 사전에 등록한 이메일만 플랫폼 회원가입이 가능합니다." : "Only pre-registered emails can sign up on this platform."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1">
              {/* 신규 초대 등록 폼 */}
              <div className="bg-muted/40 border rounded-xl p-4 space-y-4">
                <h3 className="font-semibold text-sm">{lang === "KO" ? "➕ 새 회원 사전 가입 승인 등록" : "Authorize New Email"}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="invite-email">{lang === "KO" ? "이메일 주소" : "Email Address"}</Label>
                    <Input 
                      id="invite-email" 
                      type="email" 
                      placeholder="partner@gfch.com" 
                      value={newInvite.email}
                      onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="invite-name">{lang === "KO" ? "이름 / 담당자명" : "Name / Designation"}</Label>
                    <Input 
                      id="invite-name" 
                      placeholder="John Doe" 
                      value={newInvite.name}
                      onChange={(e) => setNewInvite({ ...newInvite, name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="invite-role">{lang === "KO" ? "부여할 권한 (Role)" : "Assign Role"}</Label>
                    <select
                      id="invite-role"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                      value={newInvite.role}
                      onChange={(e) => {
                        const val = e.target.value;
                        const selectedPartner = partners.find(p => p.id === val);
                        setNewInvite({
                          ...newInvite,
                          role: val,
                          partnerCode: selectedPartner ? (selectedPartner.code || selectedPartner.country || "MF") : ""
                        });
                      }}
                    >
                      <option value="HQ">본사 관리자 (HQ Admin)</option>
                      {partners.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.country}) - {p.type}
                        </option>
                      ))}
                    </select>
                  </div>
                  {newInvite.role !== "HQ" && (
                    <div className="grid gap-1.5 animate-in fade-in">
                      <Label htmlFor="invite-partner">{lang === "KO" ? "파트너사 코드 (예: JPN, VNM)" : "Partner Code"}</Label>
                      <Input 
                        id="invite-partner" 
                        placeholder="JPN" 
                        value={newInvite.partnerCode}
                        onChange={(e) => setNewInvite({ ...newInvite, partnerCode: e.target.value.toUpperCase() })}
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={handleSendInvite} className="flex items-center gap-2">
                    <Send className="w-3.5 h-3.5" />
                    {lang === "KO" ? "가입 승인 등록" : "Authorize & Save"}
                  </Button>
                </div>
              </div>

              {/* 현재 등록 리스트 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">{lang === "KO" ? "📋 사전 승인 이메일 목록" : "Authorized Invitation List"} ({invites.length})</h3>
                <div className="rounded-md border overflow-hidden max-h-[300px] overflow-y-auto bg-background">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead>{lang === "KO" ? "이메일" : "Email"}</TableHead>
                        <TableHead>{lang === "KO" ? "이름" : "Name"}</TableHead>
                        <TableHead>{lang === "KO" ? "부여 권한" : "Role"}</TableHead>
                        <TableHead>{lang === "KO" ? "상태" : "Status"}</TableHead>
                        <TableHead className="w-[80px] text-right">{lang === "KO" ? "관리" : "Revoke"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitesLoading ? (
                        <TableRow><TableCell colSpan={5} className="h-20 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                      ) : invites.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="h-20 text-center text-xs text-muted-foreground italic">{lang === "KO" ? "등록된 승인 내역이 없습니다." : "No authorized invites."}</TableCell></TableRow>
                      ) : invites.map((invite) => (
                        <TableRow key={invite.id} className="text-xs">
                          <TableCell className="font-medium font-mono">{invite.email}</TableCell>
                          <TableCell>{invite.name}</TableCell>
                          <TableCell>
                            <Badge variant={invite.role === "HQ" ? "default" : "secondary"}>
                              {invite.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {invite.status === "PENDING" ? (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                                {lang === "KO" ? "가입 대기" : "Pending"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                                {lang === "KO" ? "가입 완료" : "Registered"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" 
                              onClick={() => handleRevokeInvite(invite.email)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
            
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setIsInviteModalOpen(false)}>
                {lang === "KO" ? "닫기" : "Close"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{lang === "KO" ? "새 파트너 추가" : "Add New Partner"}</DialogTitle>
              <DialogDescription>
                {lang === "KO" ? "새로운 마스터 프랜차이즈 또는 벤더 정보를 입력하세요." : "Enter new Master Franchise or Vendor information."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{lang === "KO" ? "업체명" : "Company Name"}</Label>
                <Input id="name" value={newPartner.name} onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })} placeholder="Company name" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country">{lang === "KO" ? "국가" : "Country"}</Label>
                <select
                  id="country"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  value={newPartner.country}
                  onChange={(e) => setNewPartner({ ...newPartner, country: e.target.value })}
                >
                  <option value="대만">대만</option>
                  <option value="필리핀">필리핀</option>
                  <option value="싱가포르">싱가포르</option>
                  <option value="말레이시아">말레이시아</option>
                  <option value="홍콩">홍콩</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">{lang === "KO" ? "유형" : "Type"}</Label>
                <select 
                  id="type"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  value={newPartner.type}
                  onChange={(e) => setNewPartner({ ...newPartner, type: e.target.value })}
                >
                  <option value="MF">MF (Master Franchise)</option>
                  <option value="VENDOR">VENDOR</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">{lang === "KO" ? "계약 시작일" : "Contract Start"}</Label>
                  <Input id="startDate" type="date" value={newPartner.startDate || ""} onChange={(e) => setNewPartner({ ...newPartner, startDate: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endDate">{lang === "KO" ? "계약 종료/중단일" : "Contract End/Halt"}</Label>
                  <Input id="endDate" type="date" value={newPartner.endDate || ""} onChange={(e) => setNewPartner({ ...newPartner, endDate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="royaltyRate">{lang === "KO" ? "로열티 요율 (%)" : "Royalty Rate (%)"}</Label>
                  <Input id="royaltyRate" type="number" step="0.1" placeholder="3.5" value={newPartner.royaltyRate} onChange={(e) => setNewPartner({ ...newPartner, royaltyRate: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="withholdingTaxRate">{lang === "KO" ? "원천징수 요율 (%)" : "Withholding Tax Rate (%)"}</Label>
                  <Input id="withholdingTaxRate" type="number" step="0.1" placeholder="0.0" value={newPartner.withholdingTaxRate || 0} onChange={(e) => setNewPartner({ ...newPartner, withholdingTaxRate: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="storesStr">{lang === "KO" ? "매장 목록 (쉼표 구분)" : "Store List (Comma Separated)"}</Label>
                <Input id="storesStr" value={newPartner.storesStr} onChange={(e) => setNewPartner({ ...newPartner, storesStr: e.target.value })} placeholder="예: 1호점, 2호점" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>{lang === "KO" ? "취소" : "Cancel"}</Button>
              <Button onClick={handleAddPartner}>{lang === "KO" ? "추가하기" : "Register"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>{lang === "KO" ? "업체명" : "Company Name"}</TableHead>
              <TableHead>{lang === "KO" ? "국가" : "Country"}</TableHead>
              <TableHead>{lang === "KO" ? "유형" : "Type"}</TableHead>
              <TableHead>{lang === "KO" ? "계약 시작일" : "Contract Start"}</TableHead>
              <TableHead>{lang === "KO" ? "계약 종료/중단일" : "Contract End/Halt"}</TableHead>
              <TableHead className="text-right">{lang === "KO" ? "관리" : "Manage"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
            ) : partners.map((partner) => (
              <Fragment key={partner.id}>
                <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(partner.id)}>
                  <TableCell>
                    {expandedRows.includes(partner.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </TableCell>
                  <TableCell className="font-medium">{partner.name}</TableCell>
                  <TableCell>{partner.country}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{partner.type}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{partner.startDate || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {partner.endDate ? (
                      <span className="text-destructive font-semibold">{partner.endDate} ({lang === "KO" ? "중단됨" : "Halted"})</span>
                    ) : (
                      <span className="text-emerald-600 font-semibold">{lang === "KO" ? "진행 중" : "Active"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setEditingPartner({ 
                          ...partner,
                          withholdingTaxRate: partner.withholdingTaxRate !== undefined ? partner.withholdingTaxRate : 0,
                          storesStr: partner.stores ? partner.stores.join(", ") : ""
                        });
                        setIsEditModalOpen(true);
                      }}
                    >
                      {lang === "KO" ? "수정" : "Edit"}
                    </Button>
                  </TableCell>
                </TableRow>
                {expandedRows.includes(partner.id) && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={7} className="p-0">
                      <div className="px-12 py-4 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 bg-background rounded-lg border text-xs shadow-sm">
                          <div>
                            <span className="text-muted-foreground block font-medium mb-1">{lang === "KO" ? "업체명" : "Company"}</span>
                            <span className="font-bold text-slate-800">{partner.name}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block font-medium mb-1">{lang === "KO" ? "유형" : "Type"}</span>
                            <span className="font-bold"><Badge variant="outline" className="text-[10px] py-0 px-1.5">{partner.type}</Badge></span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block font-medium mb-1">{lang === "KO" ? "계약 로열티 요율" : "Contract Royalty Rate"}</span>
                            <span className="font-extrabold text-blue-600 text-sm">{partner.royaltyRate !== undefined ? partner.royaltyRate : 3.5}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block font-medium mb-1">{lang === "KO" ? "원천징수 요율" : "Withholding Tax Rate"}</span>
                            <span className="font-extrabold text-amber-600 text-sm">{partner.withholdingTaxRate !== undefined ? partner.withholdingTaxRate : 0}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block font-medium mb-1">{lang === "KO" ? "매장 목록" : "Stores"}</span>
                            <span className="font-bold text-slate-700">{partner.stores?.length ? partner.stores.join(", ") : "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block font-medium mb-1">{lang === "KO" ? "유효 기간" : "Validity"}</span>
                            <span className="font-bold text-slate-700 text-[10px]">{partner.startDate || "N/A"} ~ {partner.endDate || (lang === "KO" ? "진행 중" : "Active")}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                            <User className="h-4 w-4" />
                            {lang === "KO" ? "담당자 정보" : "Contact Information"}
                          </div>
                          <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => { 
                            setEditingPartner({ 
                              ...partner,
                              withholdingTaxRate: partner.withholdingTaxRate !== undefined ? partner.withholdingTaxRate : 0,
                              storesStr: partner.stores ? partner.stores.join(", ") : ""
                            }); 
                            setIsEditModalOpen(true); 
                          }}>
                            <Plus className="mr-1 h-3 w-3" /> {lang === "KO" ? "담당자 추가/수정" : "Edit Contacts"}
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {partner.contacts?.length > 0 ? partner.contacts.map((contact: any, idx: number) => {
                            const contactInvite = invites.find(inv => inv.email === contact.email.trim().toLowerCase());
                            return (
                              <div key={idx} className="bg-background rounded-lg border p-3 flex flex-col gap-1 shadow-sm">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-sm">{contact.name}</span>
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1">{contact.role}</Badge>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  {contact.email}
                                </div>
                                
                                <div className="flex items-center justify-between mt-2 pt-2 border-t text-[10px]">
                                  <span className="text-muted-foreground font-semibold">초대 상태:</span>
                                  {contactInvite ? (
                                    contactInvite.status === "PENDING" ? (
                                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-[9px] px-1.5 py-0 h-4">
                                        초대 대기
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 text-[9px] px-1.5 py-0 h-4">
                                        가입 완료
                                      </Badge>
                                    )
                                  ) : (
                                    <button
                                      onClick={async () => {
                                        try {
                                          await setDoc(doc(db, "invites", contact.email.trim().toLowerCase()), {
                                            email: contact.email.trim().toLowerCase(),
                                            name: contact.name,
                                            role: partner.id,
                                            partnerCode: partner.country || "MF",
                                            status: "PENDING",
                                            createdAt: new Date().toISOString()
                                          });
                                          alert("해당 담당자에게 가입 승인 권한(초대)이 즉시 부여되었습니다.");
                                        } catch (e) {
                                          alert("초대 실패: " + e);
                                        }
                                      }}
                                      className="text-primary hover:underline font-bold text-[9px] flex items-center gap-1"
                                    >
                                      초대 등록하기
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          }) : (
                            <p className="text-xs text-muted-foreground italic">{lang === "KO" ? "등록된 담당자가 없습니다." : "No contacts registered."}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{lang === "KO" ? "파트너사 정보 수정" : "Edit Partner Info"}</DialogTitle>
          </DialogHeader>
          {editingPartner && (
            <div className="grid gap-6 py-4 max-h-[60vh] overflow-y-auto px-1">
              <div className="space-y-4 border-b pb-6">
                <h4 className="font-semibold text-sm">{lang === "KO" ? "기본 정보" : "General Info"}</h4>
                <div className="grid gap-2">
                  <Label>{lang === "KO" ? "업체명" : "Company Name"}</Label>
                  <Input value={editingPartner.name} onChange={(e) => setEditingPartner({ ...editingPartner, name: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>{lang === "KO" ? "국가" : "Country"}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={editingPartner.country}
                    onChange={(e) => setEditingPartner({ ...editingPartner, country: e.target.value })}
                  >
                    <option value="대만">대만</option>
                    <option value="필리핀">필리핀</option>
                    <option value="싱가포르">싱가포르</option>
                    <option value="말레이시아">말레이시아</option>
                    <option value="홍콩">홍콩</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{lang === "KO" ? "계약 시작일" : "Contract Start"}</Label>
                    <Input type="date" value={editingPartner.startDate || ""} onChange={(e) => setEditingPartner({ ...editingPartner, startDate: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>{lang === "KO" ? "계약 종료/중단일" : "Contract End/Halt"}</Label>
                    <Input type="date" value={editingPartner.endDate || ""} onChange={(e) => setEditingPartner({ ...editingPartner, endDate: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{lang === "KO" ? "로열티 요율 (%)" : "Royalty Rate (%)"}</Label>
                    <Input type="number" step="0.1" value={editingPartner.royaltyRate !== undefined ? editingPartner.royaltyRate : 3.5} onChange={(e) => setEditingPartner({ ...editingPartner, royaltyRate: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>{lang === "KO" ? "원천징수 요율 (%)" : "Withholding Tax Rate (%)"}</Label>
                    <Input type="number" step="0.1" value={editingPartner.withholdingTaxRate !== undefined ? editingPartner.withholdingTaxRate : 0} onChange={(e) => setEditingPartner({ ...editingPartner, withholdingTaxRate: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>{lang === "KO" ? "매장 목록 (쉼표 구분)" : "Store List (Comma Separated)"}</Label>
                  <Input value={editingPartner.storesStr || ""} onChange={(e) => setEditingPartner({ ...editingPartner, storesStr: e.target.value })} placeholder="예: 1호점, 2호점" />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-sm">{lang === "KO" ? "담당자 관리" : "Contacts"} ({editingPartner.contacts?.length || 0})</h4>
                <div className="space-y-2">
                  {editingPartner.contacts?.map((contact: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-md border bg-muted/20">
                      <div className="text-xs">
                        <p className="font-medium">{contact.name} ({contact.role})</p>
                        <p className="text-muted-foreground">{contact.email}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeContactFromEditing(idx)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
                <div className="bg-muted/30 p-3 rounded-lg space-y-3">
                  <p className="text-xs font-semibold">{lang === "KO" ? "새 담당자 추가" : "Add New Contact"}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Name" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} />
                    <Input placeholder="Role" value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
                    <Button size="sm" onClick={addContactToEditing}>{lang === "KO" ? "추가" : "Add"}</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>{lang === "KO" ? "취소" : "Cancel"}</Button>
            <Button onClick={handleUpdatePartner}>{lang === "KO" ? "저장하기" : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

