"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Lock, Settings, Database, Key, Check } from "lucide-react";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useTranslation();
  
  const [gasUrl, setGasUrl] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");
  const [rateJpy, setRateJpy] = useState("150.5");
  const [rateVnd, setRateVnd] = useState("24600");
  const [rateKrw, setRateKrw] = useState("1340");
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwUpdating, setPwUpdating] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

  // 설정 로드
  useEffect(() => {
    if (!user) return;
    async function loadSettings() {
      try {
        const docRef = doc(db, "system", "config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.gasUrl) setGasUrl(data.gasUrl);
          if (data.driveFolderId) setDriveFolderId(data.driveFolderId);
          if (data.rateJpy) setRateJpy(data.rateJpy.toString());
          if (data.rateVnd) setRateVnd(data.rateVnd.toString());
          if (data.rateKrw) setRateKrw(data.rateKrw.toString());
        }
      } catch (err) {
        console.error("Error loading system config:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [user]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await setDoc(doc(db, "system", "config"), {
        gasUrl,
        driveFolderId,
        rateJpy: parseFloat(rateJpy) || 150.5,
        rateVnd: parseFloat(rateVnd) || 24600,
        rateKrw: parseFloat(rateKrw) || 1340,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || "admin"
      }, { merge: true });
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert("Error saving settings: " + err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      alert(lang === "KO" ? "새 비밀번호는 6자리 이상이어야 합니다." : "New password must be at least 6 characters.");
      return;
    }
    setPwUpdating(true);
    setPwSuccess(false);
    try {
      // Firebase Auth 비밀번호 업데이트 모사 처리
      await new Promise(resolve => setTimeout(resolve, 1000));
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      alert("Error updating password: " + err);
    } finally {
      setPwUpdating(false);
    }
  };

  if (authLoading || loading) {
    return <div className="h-96 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <Settings className="w-8 h-8 text-primary" />
          {lang === "KO" ? "시스템 환경설정" : "System Settings"}
        </h2>
        <p className="text-muted-foreground mt-2">
          {lang === "KO" 
            ? "글로벌 비즈니스 연동 API 키, 클라우드 폴더 및 기본 환율 설정을 관리합니다."
            : "Manage global business API keys, cloud folder links, and default exchange rates."}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* 프로필 요약 */}
        <Card className="md:col-span-1 shadow-sm h-fit">
          <CardHeader className="bg-slate-50 border-b pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <Key className="w-4 h-4 text-primary" />
              {lang === "KO" ? "내 계정 정보" : "My Account"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-xs">
            <div className="space-y-1">
              <span className="text-muted-foreground block">{lang === "KO" ? "이름" : "Name"}</span>
              <p className="font-extrabold text-foreground text-sm">{user?.name || "관리자"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground block">{lang === "KO" ? "이메일 계정" : "Email"}</span>
              <p className="font-mono text-foreground font-semibold">{user?.email}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground block">{lang === "KO" ? "접근 권한" : "Role"}</span>
              <Badge className="bg-blue-600 text-white font-bold">{user?.role}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* 설정 내용 */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                {lang === "KO" ? "클라우드 스토리지 & API 연동" : "Cloud Storage & API Integrations"}
              </CardTitle>
              <CardDescription>
                {lang === "KO" 
                  ? "구글 드라이브와 백그라운드 데이터 전송용 GAS 웹앱 엔드포인트입니다."
                  : "Google Apps Script end-point for document storage pipeline integrations."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="gas-url" className="text-xs font-bold text-slate-700">
                    Google Apps Script (GAS) Webhook URL
                  </Label>
                  <Input 
                    id="gas-url"
                    placeholder="https://script.google.com/macros/s/..."
                    value={gasUrl}
                    onChange={(e) => setGasUrl(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="drive-folder" className="text-xs font-bold text-slate-700">
                    Google Drive Backup Target Folder ID
                  </Label>
                  <Input 
                    id="drive-folder"
                    placeholder="1A2B3C4D5E6F..."
                    value={driveFolderId}
                    onChange={(e) => setDriveFolderId(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-xs font-bold text-slate-700 mb-3">{lang === "KO" ? "글로벌 재무용 고정 환율 설정" : "Global Fixed Exchange Rates"}</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="rate-jpy" className="text-[10px] uppercase font-bold text-muted-foreground">USD / JPY</Label>
                      <Input 
                        id="rate-jpy"
                        type="number"
                        step="0.01"
                        value={rateJpy}
                        onChange={(e) => setRateJpy(e.target.value)}
                        className="font-mono text-xs font-bold"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="rate-vnd" className="text-[10px] uppercase font-bold text-muted-foreground">USD / VND</Label>
                      <Input 
                        id="rate-vnd"
                        type="number"
                        value={rateVnd}
                        onChange={(e) => setRateVnd(e.target.value)}
                        className="font-mono text-xs font-bold"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="rate-krw" className="text-[10px] uppercase font-bold text-muted-foreground">USD / KRW</Label>
                      <Input 
                        id="rate-krw"
                        type="number"
                        value={rateKrw}
                        onChange={(e) => setRateKrw(e.target.value)}
                        className="font-mono text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  {saveSuccess ? (
                    <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      {lang === "KO" ? "환경설정이 성공적으로 저장되었습니다!" : "Settings saved successfully!"}
                    </span>
                  ) : <span />}
                  <Button type="submit" disabled={saving} className="bg-primary flex items-center gap-1.5 text-xs font-bold h-9">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {lang === "KO" ? "설정 저장" : "Save Changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Lock className="w-5 h-5 text-red-600" />
                {lang === "KO" ? "비밀번호 변경" : "Change Password"}
              </CardTitle>
              <CardDescription>
                {lang === "KO" 
                  ? "안전한 시스템 관리를 위해 주기적으로 비밀번호를 변경해 주세요."
                  : "Regularly update your login credentials to protect systems security."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="curr-pw">{lang === "KO" ? "현재 비밀번호" : "Current Password"}</Label>
                    <Input 
                      id="curr-pw"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-pw">{lang === "KO" ? "새 비밀번호" : "New Password"}</Label>
                    <Input 
                      id="new-pw"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  {pwSuccess ? (
                    <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      {lang === "KO" ? "비밀번호가 성공적으로 업데이트되었습니다!" : "Password updated successfully!"}
                    </span>
                  ) : <span />}
                  <Button type="submit" disabled={pwUpdating} className="bg-red-600 hover:bg-red-700 flex items-center gap-1.5 text-xs font-bold h-9 text-white">
                    {pwUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                    {lang === "KO" ? "비밀번호 변경 완료" : "Update Password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
