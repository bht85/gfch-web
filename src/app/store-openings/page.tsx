"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  MapPin,
  Calendar,
  Users,
  CheckSquare,
  Image,
  ChevronRight,
  X,
  Loader2,
  Check,
  AlertCircle,
  Clock,
  Building2,
  Globe,
  Pencil,
  Trash2,
  ArrowRight,
  Info,
  Upload,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type PipelineStage =
  | "CANDIDATE"
  | "CONTRACT_PENDING"
  | "CONSTRUCTION"
  | "TRAINING"
  | "OPEN";

interface ScheduleItem {
  date: string;
  done: boolean;
}

interface InteriorData {
  blueprintUrl: string;
  render3dUrl: string;
  constructionPhotoUrls: string[];
  signageUrl: string;
  vMaterialApplied: boolean;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvalNote: string;
}

interface TrainingData {
  trainingDates: string;
  trainingCount: string;
  completed: boolean;
  note: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  requiresHQApproval: boolean;
  approved: boolean;
  done: boolean;
  note: string;
}

interface StoreOpening {
  id: string;
  pipeline: PipelineStage;
  storeName: string;
  country: string;
  city: string;
  address: string;
  area: string;
  seats: string;
  openDate: string;
  operationType: string;
  partnerId: string;
  schedule: {
    interior: ScheduleItem;
    equipment: ScheduleItem;
    material: ScheduleItem;
    training: ScheduleItem;
    dryRun: ScheduleItem;
    softOpening: ScheduleItem;
  };
  interior: InteriorData;
  training: TrainingData;
  checklist: ChecklistItem[];
  createdAt: any;
  updatedAt: any;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_STAGES: { key: PipelineStage; label: string; color: string; bg: string; border: string; dot: string }[] = [
  { key: "CANDIDATE",       label: "후보지",    color: "text-slate-600",  bg: "bg-slate-50",   border: "border-slate-200", dot: "bg-slate-400" },
  { key: "CONTRACT_PENDING",label: "계약 예정", color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200", dot: "bg-amber-400" },
  { key: "CONSTRUCTION",    label: "공사 중",   color: "text-orange-700", bg: "bg-orange-50",  border: "border-orange-200",dot: "bg-orange-400" },
  { key: "TRAINING",        label: "교육 중",   color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200",  dot: "bg-blue-400" },
  { key: "OPEN",            label: "오픈 완료", color: "text-emerald-700",bg: "bg-emerald-50", border: "border-emerald-200",dot: "bg-emerald-500" },
];

const STAGE_ORDER: PipelineStage[] = ["CANDIDATE", "CONTRACT_PENDING", "CONSTRUCTION", "TRAINING", "OPEN"];

const DEFAULT_CHECKLIST: Omit<ChecklistItem, "approved" | "done" | "note">[] = [
  { id: "blueprint",     label: "인테리어 도면 최종 승인",   requiresHQApproval: true },
  { id: "render3d",      label: "3D 렌더링 승인",           requiresHQApproval: true },
  { id: "signage",       label: "사인물(간판) 시안 승인",    requiresHQApproval: true },
  { id: "vmaterial",     label: "V 소재 적용 확인",          requiresHQApproval: true },
  { id: "equipment",     label: "장비 입고 완료 확인",       requiresHQApproval: false },
  { id: "material",      label: "원부재료 입고 완료 확인",   requiresHQApproval: false },
  { id: "training_done", label: "교육 완료 서명",            requiresHQApproval: true },
  { id: "dryrun",        label: "Dry Run 진행",              requiresHQApproval: false },
  { id: "soft_open",     label: "Soft Opening 완료",         requiresHQApproval: false },
  { id: "hq_final",      label: "본사 최종 오픈 승인",       requiresHQApproval: true },
];

const DEFAULT_SCHEDULE = {
  interior:    { date: "", done: false },
  equipment:   { date: "", done: false },
  material:    { date: "", done: false },
  training:    { date: "", done: false },
  dryRun:      { date: "", done: false },
  softOpening: { date: "", done: false },
};

const DEFAULT_INTERIOR: InteriorData = {
  blueprintUrl: "",
  render3dUrl: "",
  constructionPhotoUrls: [],
  signageUrl: "",
  vMaterialApplied: false,
  approvalStatus: "PENDING",
  approvalNote: "",
};

const DEFAULT_TRAINING: TrainingData = {
  trainingDates: "",
  trainingCount: "",
  completed: false,
  note: "",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StoreOpeningsPage() {
  const { user } = useAuth();
  const isHQ = user?.role === "HQ";

  const [stores, setStores] = useState<StoreOpening[]>([]);
  const [loading, setLoading] = useState(true);

  // 선택된 매장 (슬라이드 패널)
  const [selectedStore, setSelectedStore] = useState<StoreOpening | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "schedule" | "interior" | "training" | "checklist">("info");

  // 신규 매장 추가 모달
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addLoading, setSavingNew] = useState(false);
  const [newStore, setNewStore] = useState({
    storeName: "",
    country: "",
    city: "",
    address: "",
    area: "",
    seats: "",
    openDate: "",
    operationType: "MF",
    partnerId: "",
  });

  // 저장 상태
  const [saving, setSaving] = useState(false);

  // ── Firestore 실시간 구독 ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "storeOpenings"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StoreOpening[];
      setStores(data);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user]);

  // ── 선택된 매장 정보 실시간 동기화 ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedStore) return;
    const updated = stores.find((s) => s.id === selectedStore.id);
    if (updated) setSelectedStore(updated);
  }, [stores]);

  // ── 신규 매장 생성 ─────────────────────────────────────────────────────────
  const handleAddStore = async () => {
    if (!newStore.storeName || !newStore.country) {
      alert("매장명과 국가는 필수 입력 항목입니다.");
      return;
    }
    setSavingNew(true);
    try {
      await addDoc(collection(db, "storeOpenings"), {
        ...newStore,
        pipeline: "CANDIDATE" as PipelineStage,
        schedule: DEFAULT_SCHEDULE,
        interior: DEFAULT_INTERIOR,
        training: DEFAULT_TRAINING,
        checklist: DEFAULT_CHECKLIST.map((item) => ({
          ...item,
          approved: false,
          done: false,
          note: "",
        })),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setIsAddOpen(false);
      setNewStore({ storeName: "", country: "", city: "", address: "", area: "", seats: "", openDate: "", operationType: "MF", partnerId: "" });
    } catch (e) {
      alert("저장 실패: " + e);
    } finally {
      setSavingNew(false);
    }
  };

  // ── Pipeline 단계 변경 ─────────────────────────────────────────────────────
  const handleStageChange = async (storeId: string, newStage: PipelineStage) => {
    try {
      await updateDoc(doc(db, "storeOpenings", storeId), {
        pipeline: newStage,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      alert("상태 변경 실패: " + e);
    }
  };

  // ── 기본정보 저장 ──────────────────────────────────────────────────────────
  const handleSaveInfo = async (storeId: string, data: Partial<StoreOpening>) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "storeOpenings", storeId), { ...data, updatedAt: serverTimestamp() });
    } catch (e) {
      alert("저장 실패: " + e);
    } finally {
      setSaving(false);
    }
  };

  // ── 체크리스트 토글 ────────────────────────────────────────────────────────
  const handleChecklistToggle = async (store: StoreOpening, itemId: string, field: "done" | "approved") => {
    const updated = store.checklist.map((item) =>
      item.id === itemId ? { ...item, [field]: !item[field] } : item
    );
    await updateDoc(doc(db, "storeOpenings", store.id), {
      checklist: updated,
      updatedAt: serverTimestamp(),
    });
  };

  // ── 일정 전체 저장 ─────────────────────────────────────────────────────
  const handleScheduleSave = async (store: StoreOpening, scheduleData: StoreOpening["schedule"]) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "storeOpenings", store.id), {
        schedule: scheduleData,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setSaving(false);
    }
  };

  // ── 교육 정보 업데이트 ─────────────────────────────────────────────────────
  const handleTrainingUpdate = async (store: StoreOpening, data: Partial<TrainingData>) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "storeOpenings", store.id), {
        training: { ...store.training, ...data },
        updatedAt: serverTimestamp(),
      });
    } finally {
      setSaving(false);
    }
  };

  // ── 인테리어 업데이트 ──────────────────────────────────────────────────────
  const handleInteriorUpdate = async (store: StoreOpening, data: Partial<InteriorData>) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "storeOpenings", store.id), {
        interior: { ...store.interior, ...data },
        updatedAt: serverTimestamp(),
      });
    } finally {
      setSaving(false);
    }
  };

  // ── 매장 삭제 ──────────────────────────────────────────────────────────────
  const handleDelete = async (storeId: string) => {
    if (!confirm("이 매장 정보를 삭제하시겠습니까?")) return;
    await deleteDoc(doc(db, "storeOpenings", storeId));
    setSelectedStore(null);
  };

  const stageInfo = (key: PipelineStage) => PIPELINE_STAGES.find((s) => s.key === key)!;

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            해외 매장 오픈 관리
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            MF 계약 전 단계의 해외 매장 오픈 진행 현황을 Pipeline으로 관리합니다.
          </p>
        </div>
        {isHQ && (
          <Button onClick={() => setIsAddOpen(true)} className="flex items-center gap-2 shadow-sm">
            <Plus className="w-4 h-4" />
            신규 매장 추가
          </Button>
        )}
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {PIPELINE_STAGES.map((stage) => {
          const count = stores.filter((s) => s.pipeline === stage.key).length;
          return (
            <div
              key={stage.key}
              className={cn("rounded-xl border p-3 text-center transition-all cursor-default", stage.bg, stage.border)}
            >
              <div className={cn("text-2xl font-black font-mono", stage.color)}>{count}</div>
              <div className={cn("text-xs font-medium mt-0.5", stage.color)}>{stage.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Kanban Board ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex gap-4 flex-1 overflow-x-auto pb-4 min-h-0">
          {PIPELINE_STAGES.map((stage) => {
            const stageStores = stores.filter((s) => s.pipeline === stage.key);
            return (
              <div
                key={stage.key}
                className="flex-1 min-w-[220px] max-w-[280px] flex flex-col gap-2"
              >
                {/* Column Header */}
                <div className={cn("rounded-lg px-3 py-2 flex items-center gap-2 border", stage.bg, stage.border)}>
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", stage.dot)} />
                  <span className={cn("text-sm font-semibold flex-1", stage.color)}>{stage.label}</span>
                  <span className={cn("text-xs font-mono font-bold px-1.5 py-0.5 rounded", stage.color, "bg-white/60")}>
                    {stageStores.length}
                  </span>
                </div>

                {/* Store Cards */}
                <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                  {stageStores.length === 0 && (
                    <div className="rounded-lg border border-dashed border-muted-foreground/20 p-4 text-center text-xs text-muted-foreground/60">
                      없음
                    </div>
                  )}
                  {stageStores.map((store) => {
                    const checkDone = store.checklist?.filter((c) => c.done).length ?? 0;
                    const checkTotal = store.checklist?.length ?? 0;
                    const nextStageIdx = STAGE_ORDER.indexOf(store.pipeline) + 1;
                    const nextStage = STAGE_ORDER[nextStageIdx] as PipelineStage | undefined;

                    return (
                      <div
                        key={store.id}
                        onClick={() => { setSelectedStore(store); setActiveTab("info"); }}
                        className="rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/30 transition-all cursor-pointer p-3 group"
                      >
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <p className="font-semibold text-sm leading-tight truncate">{store.storeName}</p>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-0.5 transition-colors" />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <Globe className="w-3 h-3" />
                          <span>{store.country}{store.city ? ` · ${store.city}` : ""}</span>
                        </div>
                        {store.openDate && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                            <Calendar className="w-3 h-3" />
                            <span>목표 오픈 {store.openDate}</span>
                          </div>
                        )}
                        {/* 체크리스트 진행률 */}
                        {checkTotal > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                              <span>체크리스트</span>
                              <span className="font-mono">{checkDone}/{checkTotal}</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", stage.dot)}
                                style={{ width: `${(checkDone / checkTotal) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {/* 다음 단계 버튼 */}
                        {isHQ && nextStage && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStageChange(store.id, nextStage); }}
                            className={cn(
                              "mt-2.5 w-full flex items-center justify-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border transition-all opacity-0 group-hover:opacity-100",
                              stageInfo(nextStage).color,
                              stageInfo(nextStage).bg,
                              stageInfo(nextStage).border
                            )}
                          >
                            <ArrowRight className="w-3 h-3" />
                            {stageInfo(nextStage).label}로 이동
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ── Slide Panel (매장 상세) ──
      ══════════════════════════════════════════════════════════════════════ */}
      {selectedStore && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/30 backdrop-blur-sm"
            onClick={() => setSelectedStore(null)}
          />
          {/* Panel */}
          <div className="w-full max-w-2xl bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base truncate">{selectedStore.storeName}</h3>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-2 py-0.5 font-semibold border flex-shrink-0",
                      stageInfo(selectedStore.pipeline).color,
                      stageInfo(selectedStore.pipeline).bg,
                      stageInfo(selectedStore.pipeline).border
                    )}
                  >
                    {stageInfo(selectedStore.pipeline).label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedStore.country}{selectedStore.city ? ` · ${selectedStore.city}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                {isHQ && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(selectedStore.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSelectedStore(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Pipeline Stage Selector (HQ only) */}
            {isHQ && (
              <div className="px-6 py-3 border-b flex items-center gap-1.5 overflow-x-auto">
                <span className="text-xs text-muted-foreground flex-shrink-0 mr-1">단계 변경:</span>
                {PIPELINE_STAGES.map((stage, idx) => (
                  <button
                    key={stage.key}
                    onClick={() => handleStageChange(selectedStore.id, stage.key)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all flex-shrink-0",
                      selectedStore.pipeline === stage.key
                        ? cn(stage.bg, stage.border, stage.color, "ring-2 ring-offset-1", stage.dot.replace("bg-", "ring-"))
                        : "bg-muted/30 border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {selectedStore.pipeline === stage.key && <Check className="w-3 h-3" />}
                    {stage.label}
                  </button>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b px-6 overflow-x-auto">
              {(
                [
                  { key: "info",      label: "기본정보",    Icon: MapPin },
                  { key: "schedule",  label: "오픈 일정",   Icon: Calendar },
                  { key: "interior",  label: "인테리어",    Icon: Image },
                  { key: "training",  label: "교육 현황",   Icon: Users },
                  { key: "checklist", label: "체크리스트",  Icon: CheckSquare },
                ] as const
              ).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-all flex-shrink-0",
                    activeTab === key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* ── 탭1: 기본정보 ── */}
              {activeTab === "info" && (
                <InfoTab
                  store={selectedStore}
                  isHQ={isHQ}
                  saving={saving}
                  onSave={(data) => handleSaveInfo(selectedStore.id, data)}
                />
              )}

              {/* ── 탭2: 오픈 일정 ── */}
              {activeTab === "schedule" && (
                <ScheduleTab
                  store={selectedStore}
                  isHQ={isHQ}
                  saving={saving}
                  onSave={(scheduleData) => handleScheduleSave(selectedStore, scheduleData)}
                />
              )}

              {/* ── 탭3: 인테리어 승인 ── */}
              {activeTab === "interior" && (
                <InteriorTab
                  store={selectedStore}
                  isHQ={isHQ}
                  saving={saving}
                  onUpdate={(data) => handleInteriorUpdate(selectedStore, data)}
                />
              )}

              {/* ── 탭4: 교육 현황 ── */}
              {activeTab === "training" && (
                <TrainingTab
                  store={selectedStore}
                  isHQ={isHQ}
                  saving={saving}
                  onUpdate={(data) => handleTrainingUpdate(selectedStore, data)}
                />
              )}

              {/* ── 탭5: 오픈 체크리스트 ── */}
              {activeTab === "checklist" && (
                <ChecklistTab
                  store={selectedStore}
                  isHQ={isHQ}
                  onToggle={(itemId, field) => handleChecklistToggle(selectedStore, itemId, field)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 신규 매장 추가 모달 ── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              신규 해외 매장 등록
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <Label className="text-xs mb-1.5 block">매장명 *</Label>
              <Input
                placeholder="예) Tokyo Sinagawa"
                value={newStore.storeName}
                onChange={(e) => setNewStore((p) => ({ ...p, storeName: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">국가 *</Label>
              <Input
                placeholder="예) 일본"
                value={newStore.country}
                onChange={(e) => setNewStore((p) => ({ ...p, country: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">도시</Label>
              <Input
                placeholder="예) 도쿄"
                value={newStore.city}
                onChange={(e) => setNewStore((p) => ({ ...p, city: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1.5 block">주소</Label>
              <Input
                placeholder="상세 주소 입력"
                value={newStore.address}
                onChange={(e) => setNewStore((p) => ({ ...p, address: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">면적 (㎡)</Label>
              <Input
                type="number"
                placeholder="0"
                value={newStore.area}
                onChange={(e) => setNewStore((p) => ({ ...p, area: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">좌석 수</Label>
              <Input
                type="number"
                placeholder="0"
                value={newStore.seats}
                onChange={(e) => setNewStore((p) => ({ ...p, seats: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">목표 오픈일</Label>
              <Input
                type="date"
                value={newStore.openDate}
                onChange={(e) => setNewStore((p) => ({ ...p, openDate: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">운영 형태</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={newStore.operationType}
                onChange={(e) => setNewStore((p) => ({ ...p, operationType: e.target.value }))}
              >
                <option value="MF">MF (마스터 프랜차이즈)</option>
                <option value="직영">직영</option>
                <option value="합작">합작</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>취소</Button>
            <Button onClick={handleAddStore} disabled={addLoading} className="flex items-center gap-2">
              {addLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              등록하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Sub-Tab Components ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ── 탭1: 기본정보 ─────────────────────────────────────────────────────────────
function InfoTab({ store, isHQ, saving, onSave }: { store: StoreOpening; isHQ: boolean; saving: boolean; onSave: (d: any) => void }) {
  const [form, setForm] = useState({
    storeName: store.storeName || "",
    country: store.country || "",
    city: store.city || "",
    address: store.address || "",
    area: store.area || "",
    seats: store.seats || "",
    openDate: store.openDate || "",
    operationType: store.operationType || "MF",
    partnerId: store.partnerId || "",
  });
  const [dirty, setDirty] = useState(false);

  const set = (k: string, v: string) => { setForm((p) => ({ ...p, [k]: v })); setDirty(true); };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs mb-1.5 block text-muted-foreground">매장명</Label>
          {isHQ ? <Input value={form.storeName} onChange={(e) => set("storeName", e.target.value)} /> : <p className="text-sm font-semibold">{store.storeName}</p>}
        </div>
        <div>
          <Label className="text-xs mb-1.5 block text-muted-foreground">국가</Label>
          {isHQ ? <Input value={form.country} onChange={(e) => set("country", e.target.value)} /> : <p className="text-sm">{store.country || "—"}</p>}
        </div>
        <div>
          <Label className="text-xs mb-1.5 block text-muted-foreground">도시</Label>
          {isHQ ? <Input value={form.city} onChange={(e) => set("city", e.target.value)} /> : <p className="text-sm">{store.city || "—"}</p>}
        </div>
        <div className="col-span-2">
          <Label className="text-xs mb-1.5 block text-muted-foreground">주소</Label>
          {isHQ ? <Input value={form.address} onChange={(e) => set("address", e.target.value)} /> : <p className="text-sm">{store.address || "—"}</p>}
        </div>
        <div>
          <Label className="text-xs mb-1.5 block text-muted-foreground">면적 (㎡)</Label>
          {isHQ ? <Input type="number" value={form.area} onChange={(e) => set("area", e.target.value)} /> : <p className="text-sm">{store.area ? `${store.area} ㎡` : "—"}</p>}
        </div>
        <div>
          <Label className="text-xs mb-1.5 block text-muted-foreground">좌석 수</Label>
          {isHQ ? <Input type="number" value={form.seats} onChange={(e) => set("seats", e.target.value)} /> : <p className="text-sm">{store.seats ? `${store.seats}석` : "—"}</p>}
        </div>
        <div>
          <Label className="text-xs mb-1.5 block text-muted-foreground">목표 오픈일</Label>
          {isHQ ? <Input type="date" value={form.openDate} onChange={(e) => set("openDate", e.target.value)} /> : <p className="text-sm">{store.openDate || "—"}</p>}
        </div>
        <div>
          <Label className="text-xs mb-1.5 block text-muted-foreground">운영 형태</Label>
          {isHQ ? (
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.operationType}
              onChange={(e) => set("operationType", e.target.value)}
            >
              <option value="MF">MF (마스터 프랜차이즈)</option>
              <option value="직영">직영</option>
              <option value="합작">합작</option>
            </select>
          ) : (
            <p className="text-sm">{store.operationType || "—"}</p>
          )}
        </div>
        <div className="col-span-2">
          <Label className="text-xs mb-1.5 block text-muted-foreground">파트너 ID (선택)</Label>
          {isHQ ? <Input placeholder="연결할 파트너 UID 입력" value={form.partnerId} onChange={(e) => set("partnerId", e.target.value)} /> : <p className="text-sm">{store.partnerId || "—"}</p>}
        </div>
      </div>
      {isHQ && dirty && (
        <Button onClick={() => { onSave(form); setDirty(false); }} disabled={saving} className="w-full flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          변경사항 저장
        </Button>
      )}
    </div>
  );
}

// ── 탭2: 오픈 일정 ────────────────────────────────────────────────────────────
const SCHEDULE_LABELS: { key: keyof StoreOpening["schedule"]; label: string; icon: string }[] = [
  { key: "interior",    label: "인테리어 공사",     icon: "🏗️" },
  { key: "equipment",   label: "장비 입고",          icon: "⚙️" },
  { key: "material",    label: "원부재료 입고",       icon: "📦" },
  { key: "training",    label: "교육",               icon: "📚" },
  { key: "dryRun",      label: "Dry Run",            icon: "🧪" },
  { key: "softOpening", label: "Soft Opening",       icon: "🌅" },
];

function ScheduleTab({ store, isHQ, saving, onSave }: { store: StoreOpening; isHQ: boolean; saving: boolean; onSave: (schedule: StoreOpening["schedule"]) => Promise<void> }) {
  const [localSchedule, setLocalSchedule] = useState<StoreOpening["schedule"]>(store.schedule || DEFAULT_SCHEDULE);
  const [saved, setSaved] = useState(false);

  // store가 바뀌면 로컬 상태 초기화
  useEffect(() => {
    setLocalSchedule(store.schedule || DEFAULT_SCHEDULE);
    setSaved(false);
  }, [store.id, store.schedule]);

  const hasChanges = JSON.stringify(localSchedule) !== JSON.stringify(store.schedule || DEFAULT_SCHEDULE);

  const handleLocalUpdate = (key: keyof StoreOpening["schedule"], field: "date" | "done", value: string | boolean) => {
    setLocalSchedule(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    await onSave(localSchedule);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="w-3.5 h-3.5" />
          날짜 입력 후 완료 체크로 진행 현황을 관리하세요.
        </p>
        {isHQ && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={cn(
              "h-8 px-4 text-xs font-semibold transition-all",
              saved && "bg-emerald-500 hover:bg-emerald-500"
            )}
          >
            {saving ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />저장 중...</>
            ) : saved ? (
              <><Check className="w-3.5 h-3.5 mr-1.5" />저장 완료!</>
            ) : (
              "저장"
            )}
          </Button>
        )}
      </div>
      {SCHEDULE_LABELS.map(({ key, label, icon }) => {
        const item = localSchedule[key] || { date: "", done: false };
        return (
          <div
            key={key}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border transition-all",
              item.done ? "bg-emerald-50 border-emerald-200" : "bg-card border-border"
            )}
          >
            <span className="text-lg w-6 text-center flex-shrink-0">{icon}</span>
            <div className="flex-1">
              <p className={cn("text-sm font-medium", item.done && "line-through text-muted-foreground")}>{label}</p>
              {isHQ ? (
                <Input
                  type="date"
                  className="mt-1 h-7 text-xs"
                  value={item.date || ""}
                  onChange={(e) => handleLocalUpdate(key, "date", e.target.value)}
                />
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">{item.date || "날짜 미정"}</p>
              )}
            </div>
            <button
              onClick={() => isHQ && handleLocalUpdate(key, "done", !item.done)}
              disabled={!isHQ}
              className={cn(
                "w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                item.done
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-muted-foreground/30 text-transparent hover:border-emerald-400",
                !isHQ && "cursor-not-allowed"
              )}
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── 탭3: 인테리어 승인 ────────────────────────────────────────────────────────
function InteriorTab({ store, isHQ, saving, onUpdate }: { store: StoreOpening; isHQ: boolean; saving: boolean; onUpdate: (d: Partial<InteriorData>) => void }) {
  const interior = store.interior || DEFAULT_INTERIOR;
  const [note, setNote] = useState(interior.approvalNote || "");

  const approvalColors = {
    PENDING:  { badge: "bg-amber-100 text-amber-700 border-amber-300", label: "검토 중" },
    APPROVED: { badge: "bg-emerald-100 text-emerald-700 border-emerald-300", label: "승인 완료" },
    REJECTED: { badge: "bg-red-100 text-red-700 border-red-300", label: "반려" },
  };
  const ac = approvalColors[interior.approvalStatus];

  return (
    <div className="space-y-5">
      {/* 승인 상태 */}
      <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/10">
        <div>
          <p className="text-xs text-muted-foreground mb-1">인테리어 승인 상태</p>
          <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", ac.badge)}>
            {ac.label}
          </span>
        </div>
        {isHQ && (
          <div className="flex gap-2">
            {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
              <button
                key={s}
                onClick={() => onUpdate({ approvalStatus: s })}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all",
                  interior.approvalStatus === s
                    ? approvalColors[s].badge
                    : "bg-muted text-muted-foreground border-border"
                )}
              >
                {approvalColors[s].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* V 소재 적용 여부 */}
      <div className="flex items-center justify-between p-3 rounded-xl border">
        <div>
          <p className="text-sm font-medium">V 소재 적용 여부</p>
          <p className="text-xs text-muted-foreground">브랜드 지정 V 소재 적용 확인</p>
        </div>
        <button
          onClick={() => isHQ && onUpdate({ vMaterialApplied: !interior.vMaterialApplied })}
          disabled={!isHQ}
          className={cn(
            "w-12 h-6 rounded-full border-2 relative transition-all",
            interior.vMaterialApplied ? "bg-emerald-500 border-emerald-500" : "bg-muted border-muted-foreground/30",
            !isHQ && "cursor-not-allowed opacity-70"
          )}
        >
          <span className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
            interior.vMaterialApplied ? "left-6" : "left-0.5"
          )} />
        </button>
      </div>

      {/* 파일 링크 관리 */}
      {[
        { key: "blueprintUrl",  label: "도면 URL",          icon: "📐" },
        { key: "render3dUrl",   label: "3D 렌더링 URL",     icon: "🖼️" },
        { key: "signageUrl",    label: "사인물 시안 URL",    icon: "🪧" },
      ].map(({ key, label, icon }) => {
        const url = (interior as any)[key] || "";
        return (
          <div key={key}>
            <Label className="text-xs mb-1.5 flex items-center gap-1">
              <span>{icon}</span> {label}
            </Label>
            <div className="flex gap-2">
              {isHQ ? (
                <Input
                  placeholder="URL 입력 또는 Drive 링크 붙여넣기"
                  value={url}
                  onChange={(e) => onUpdate({ [key]: e.target.value })}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{url || "—"}</p>
              )}
              {url && (
                <a href={url} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        );
      })}

      {/* 시공 사진 URL 목록 */}
      <div>
        <Label className="text-xs mb-1.5 flex items-center gap-1">📷 시공 사진 URL 목록</Label>
        <div className="space-y-2">
          {(interior.constructionPhotoUrls || []).map((url, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                value={url}
                readOnly={!isHQ}
                onChange={(e) => {
                  if (!isHQ) return;
                  const updated = [...(interior.constructionPhotoUrls || [])];
                  updated[i] = e.target.value;
                  onUpdate({ constructionPhotoUrls: updated });
                }}
              />
              {url && (
                <a href={url} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </a>
              )}
              {isHQ && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0 text-destructive"
                  onClick={() => {
                    const updated = (interior.constructionPhotoUrls || []).filter((_, j) => j !== i);
                    onUpdate({ constructionPhotoUrls: updated });
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
          {isHQ && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => onUpdate({ constructionPhotoUrls: [...(interior.constructionPhotoUrls || []), ""] })}
            >
              <Plus className="w-3 h-3 mr-1" /> 사진 URL 추가
            </Button>
          )}
        </div>
      </div>

      {/* 승인 메모 */}
      {isHQ && (
        <div>
          <Label className="text-xs mb-1.5 block text-muted-foreground">승인 메모</Label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => onUpdate({ approvalNote: note })}
            placeholder="승인 또는 반려 사유를 입력하세요..."
          />
        </div>
      )}
      {!isHQ && interior.approvalNote && (
        <div className="p-3 rounded-xl bg-muted/20 border">
          <p className="text-xs text-muted-foreground mb-1">본사 메모</p>
          <p className="text-sm">{interior.approvalNote}</p>
        </div>
      )}
    </div>
  );
}

// ── 탭4: 교육 현황 ────────────────────────────────────────────────────────────
function TrainingTab({ store, isHQ, saving, onUpdate }: { store: StoreOpening; isHQ: boolean; saving: boolean; onUpdate: (d: Partial<TrainingData>) => void }) {
  const t = store.training || DEFAULT_TRAINING;
  const [form, setForm] = useState({
    trainingDates: t.trainingDates || "",
    trainingCount: t.trainingCount || "",
    note: t.note || "",
  });
  const [dirty, setDirty] = useState(false);

  const set = (k: string, v: string) => { setForm((p) => ({ ...p, [k]: v })); setDirty(true); };

  return (
    <div className="space-y-4">
      {/* 교육 완료 여부 */}
      <div className={cn(
        "flex items-center justify-between p-4 rounded-xl border-2 transition-all",
        t.completed ? "bg-emerald-50 border-emerald-300" : "bg-muted/10 border-border"
      )}>
        <div>
          <p className="font-semibold text-sm">교육 완료 여부</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.completed ? "✅ 교육이 완료되었습니다." : "⏳ 교육 진행 중 또는 예정"}
          </p>
        </div>
        <button
          onClick={() => isHQ && onUpdate({ completed: !t.completed })}
          disabled={!isHQ}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all",
            t.completed
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "bg-card border-muted-foreground/30 text-muted-foreground",
            !isHQ && "cursor-not-allowed"
          )}
        >
          <Check className="w-4 h-4" />
          {t.completed ? "완료" : "미완료"}
        </button>
      </div>

      {/* 교육 일정 */}
      <div>
        <Label className="text-xs mb-1.5 block text-muted-foreground">📅 교육 일정</Label>
        {isHQ ? (
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={form.trainingDates}
            onChange={(e) => set("trainingDates", e.target.value)}
            placeholder="예) 2025-08-01 ~ 2025-08-05 (1차), 2025-08-10 (실습)"
          />
        ) : (
          <div className="p-3 rounded-xl bg-muted/10 border">
            <p className="text-sm whitespace-pre-wrap">{t.trainingDates || "—"}</p>
          </div>
        )}
      </div>

      {/* 교육 인원 */}
      <div>
        <Label className="text-xs mb-1.5 block text-muted-foreground">👥 교육 인원</Label>
        {isHQ ? (
          <Input
            placeholder="예) 매니저 2명, 바리스타 4명"
            value={form.trainingCount}
            onChange={(e) => set("trainingCount", e.target.value)}
          />
        ) : (
          <p className="text-sm">{t.trainingCount || "—"}</p>
        )}
      </div>

      {/* 비고 */}
      <div>
        <Label className="text-xs mb-1.5 block text-muted-foreground">비고</Label>
        {isHQ ? (
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="교육 관련 메모..."
          />
        ) : (
          <div className="p-3 rounded-xl bg-muted/10 border">
            <p className="text-sm whitespace-pre-wrap">{t.note || "—"}</p>
          </div>
        )}
      </div>

      {isHQ && dirty && (
        <Button
          onClick={() => { onUpdate(form); setDirty(false); }}
          disabled={saving}
          className="w-full flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          저장
        </Button>
      )}
    </div>
  );
}

// ── 탭5: 오픈 체크리스트 ──────────────────────────────────────────────────────
function ChecklistTab({ store, isHQ, onToggle }: { store: StoreOpening; isHQ: boolean; onToggle: (itemId: string, field: "done" | "approved") => void }) {
  const checklist = store.checklist || [];
  const doneCount = checklist.filter((c) => c.done).length;
  const approvedCount = checklist.filter((c) => c.requiresHQApproval && c.approved).length;
  const approvalRequired = checklist.filter((c) => c.requiresHQApproval).length;
  const riskCount = checklist.filter((c) => c.requiresHQApproval && !c.approved).length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border p-3 text-center bg-muted/10">
          <div className="text-xl font-black font-mono text-foreground">{doneCount}/{checklist.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">완료 항목</div>
        </div>
        <div className="rounded-xl border p-3 text-center bg-emerald-50 border-emerald-200">
          <div className="text-xl font-black font-mono text-emerald-700">{approvedCount}/{approvalRequired}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">본사 승인</div>
        </div>
        <div className={cn("rounded-xl border p-3 text-center", riskCount > 0 ? "bg-red-50 border-red-200" : "bg-muted/10")}>
          <div className={cn("text-xl font-black font-mono", riskCount > 0 ? "text-red-600" : "text-foreground")}>{riskCount}</div>
          <div className={cn("text-[10px] mt-0.5", riskCount > 0 ? "text-red-500" : "text-muted-foreground")}>오픈 리스크</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>전체 진행률</span>
          <span className="font-mono font-bold">{checklist.length > 0 ? Math.round((doneCount / checklist.length) * 100) : 0}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${checklist.length > 0 ? (doneCount / checklist.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-2">
        {checklist.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border transition-all",
              item.done ? "bg-emerald-50/60 border-emerald-200" : "bg-card border-border"
            )}
          >
            {/* 완료 체크 */}
            <button
              onClick={() => onToggle(item.id, "done")}
              className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                item.done
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-muted-foreground/40 hover:border-emerald-400"
              )}
            >
              {item.done && <Check className="w-3.5 h-3.5" />}
            </button>

            {/* 라벨 */}
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium", item.done && "line-through text-muted-foreground")}>
                {item.label}
              </p>
              {item.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.note}</p>}
            </div>

            {/* HQ 승인 배지 */}
            {item.requiresHQApproval && (
              <button
                onClick={() => isHQ && onToggle(item.id, "approved")}
                disabled={!isHQ}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 transition-all",
                  item.approved
                    ? "bg-blue-100 text-blue-700 border-blue-300"
                    : "bg-amber-50 text-amber-600 border-amber-300",
                  !isHQ && "cursor-not-allowed"
                )}
              >
                {item.approved ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {item.approved ? "승인됨" : "승인 필요"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
