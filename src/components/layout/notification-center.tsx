"use client";

import { Bell } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';

export function NotificationCenter() {
  const { lang } = useTranslation();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    setMounted(true);
    // orderBy + limit으로 서버에서 필터링 (클라이언트 전체 fetch 방지)
    const q = query(
      collection(db, "notifications"),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(data);
    });
    return () => unsubscribe();
  }, []);

  const markAllAsRead = async () => {
    for (const n of notifications.filter(n => !n.isRead)) {
      await updateDoc(doc(db, "notifications", n.id), { isRead: true });
    }
  };

  const translateMessage = (msg: string, type: string) => {
    if (!msg) return "";
    
    if (lang === "KO") {
      // 영어 -> 한국어로 실시간 매핑 번역
      let translated = msg;
      if (msg.includes("Payment confirmed")) {
        translated = "입금이 확인되어 상품 준비(Preparing) 단계로 전환되었습니다.";
      } else if (msg.includes("status changed to")) {
        const match = msg.match(/Order (.*?)\.\.\. status changed to \[(.*?)\]/);
        if (match) {
          const po = match[1];
          const stage = match[2];
          const krStage = 
            stage === "Preparing" || stage === "preparing" ? "상품 준비" : 
            stage === "Pending Payment" || stage === "pending_payment" ? "입금 대기" : 
            stage === "Pending Approval" || stage === "pending_approval" ? "승인 대기" : stage;
          translated = `주문 ${po}...의 상태가 [${krStage}]으로 변경되었습니다.`;
        }
      } else if (msg.includes("uploaded new document")) {
        const match = msg.match(/MF Partner uploaded new document\((.*?)\)/);
        const docName = match ? match[1] : "DOCUMENT";
        translated = `MF 파트너가 새로운 서류(${docName})를 업로드했습니다.`;
      } else if (msg.includes("Items Shipped!")) {
        const match = msg.match(/B\/L No: (.*?)\)/);
        const bl = match ? match[1] : "";
        translated = `상품이 발송되었습니다! (B/L No: ${bl})`;
      }
      return translated;
    } else {
      // 한국어 -> 영어로 실시간 매핑 번역
      let translated = msg;
      if (msg.includes("입금이 확인되어")) {
        translated = "Payment confirmed. Order status changed to Preparing.";
      } else if (msg.includes("의 상태가") && msg.includes("변경되었습니다")) {
        const match = msg.match(/주문 (.*?)\.\.\.의 상태가 \[(.*?)\]으로 변경되었습니다/);
        if (match) {
          const po = match[1];
          const stage = match[2];
          const enStage = 
            stage === "상품 준비" || stage === "Preparing" ? "Preparing" : 
            stage === "입금 대기" || stage === "입금대기" ? "Pending Payment" : 
            stage === "승인 대기" || stage === "승인대기" ? "Pending Approval" : stage;
          translated = `Order ${po}... status changed to [${enStage}].`;
        }
      } else if (msg.includes("새로운 서류") && msg.includes("업로드했습니다")) {
        const match = msg.match(/새로운 서류\((.*?)\)/);
        const docName = match ? match[1] : "DOCUMENT";
        translated = `MF Partner uploaded new document(${docName}).`;
      } else if (msg.includes("상품이 발송되었습니다!")) {
        const match = msg.match(/B\/L No: (.*?)\)/);
        const bl = match ? match[1] : "";
        translated = `Items Shipped! (B/L No: ${bl})`;
      }
      return translated;
    }
  };

  const getBadgeLabel = (type: string) => {
    if (lang === "KO") {
      return type === "STATUS" ? "상태변경" : type === "SHIPPING" ? "배송안내" : "서류업로드";
    } else {
      return type === "STATUS" ? "STATUS" : type === "SHIPPING" ? "SHIPPING" : "DOCUMENT";
    }
  };

  if (!mounted) return (
    <button className="relative p-2 text-muted-foreground">
      <Bell className="h-5 w-5" />
    </button>
  );

  return (
    <Popover>
      <PopoverTrigger className="relative p-2 text-muted-foreground hover:text-primary transition-colors focus:outline-none">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-85 p-0" align="end">
        <div className="p-4 border-b flex items-center justify-between bg-muted/30">
          <h3 className="font-bold text-sm">{lang === "KO" ? "최근 알림" : "Recent Notifications"}</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={markAllAsRead}>
              {lang === "KO" ? "모두 읽음" : "Mark all as read"}
            </Button>
          )}
        </div>
        <div className="max-h-[350px] overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map((n) => (
              <div 
                key={n.id} 
                className={cn(
                  "p-3 border-b last:border-0 text-xs transition-colors cursor-pointer hover:bg-muted/50",
                  !n.isRead && "bg-primary/5 font-medium"
                )}
                onClick={() => updateDoc(doc(db, "notifications", n.id), { isRead: true })}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase", 
                    n.type === "STATUS" ? "bg-blue-100 text-blue-700" : 
                    n.type === "SHIPPING" ? "bg-indigo-100 text-indigo-700" : "bg-orange-100 text-orange-700"
                  )}>
                    {getBadgeLabel(n.type)}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                  </span>
                </div>
                <p className="line-clamp-2 leading-relaxed">{translateMessage(n.message, n.type)}</p>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground text-xs italic">
              {lang === "KO" ? "새로운 알림이 없습니다." : "No new notifications."}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
