"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "KO" | "EN";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  KO: {
    dashboard: "대시보드",
    orders: "주문 및 물류",
    integratedOrderBoard: "통합 주문 보드",
    myOrders: "발주 내역",
    myLedger: "매입 현황",
    placeOrder: "발주 신청",
    partners: "파트너사",
    finance: "재무/입금 확인",
    shipping: "선적 및 배송 관리",
    products: "제품 관리",
    pricing: "MF별 가격 설정",
    documents: "문서 관리",
    settings: "설정",
    welcome: "님, 환영합니다!",
    hqDashboard: "본사 통합 대시보드",
    partnerDashboard: "오늘의 비즈니스 현황",
    totalOrders: "이번 달 총 발주액",
    processingOrders: "처리 중인 주문",
    pendingDocs: "미결제 서류",
    shippingTrack: "실시간 물류 추적",
    latestDocs: "최신 문서함",
    poNumber: "발주 번호",
    amount: "금액",
    status: "상태",
    date: "날짜",
    totalPurchaseAmt: "총 매입 금액 (기간 내)",
    popularItems: "인기 품목 비중 (TOP 5)",
    monthlyTrend: "월별 매입 추이",
    orderSummary: "주문별 요약",
    productAnalysis: "제품별 상세 분석",
    draft: "초안",
    pendingApproval: "승인 대기",
    pendingPayment: "입금 대기",
    preparing: "상품 준비",
    shipping_status: "배송 중",
    delivered: "배송 완료",
    completed: "주문 완료",
    viewDetail: "상세보기",
    totalSum: "최종 합계",
    docSubmission: "서류 제출 및 다운로드",
    qty: "수량",
    itemName: "품목명",
  },
  EN: {
    dashboard: "Dashboard",
    orders: "Orders & Logistics",
    integratedOrderBoard: "Integrated Board",
    myOrders: "Order History",
    myLedger: "Purchase Status",
    placeOrder: "Place Order",
    partners: "Partner Management",
    finance: "Finance & Deposit",
    shipping: "Shipping & Logistics",
    products: "Product Catalog",
    pricing: "Pricing by MF",
    documents: "Document Center",
    settings: "Settings",
    welcome: ", Welcome back!",
    hqDashboard: "HQ Global Dashboard",
    partnerDashboard: "Business Summary",
    totalOrders: "Total Purchases (MTD)",
    processingOrders: "Orders in Progress",
    pendingDocs: "Action Required",
    shippingTrack: "Logistics Tracking",
    latestDocs: "Recent Documents",
    poNumber: "PO Number",
    amount: "Amount",
    status: "Status",
    date: "Date",
    totalPurchaseAmt: "Total Purchase (Period)",
    popularItems: "Popular Items (TOP 5)",
    monthlyTrend: "Monthly Purchase Trend",
    orderSummary: "Order Summary",
    productAnalysis: "Product Analysis",
    draft: "Draft",
    pendingApproval: "Pending Approval",
    pendingPayment: "Pending Payment",
    preparing: "Preparing",
    shipping_status: "Shipping",
    delivered: "Delivered",
    completed: "Completed",
    viewDetail: "View Detail",
    totalSum: "Total Sum",
    docSubmission: "Document Center",
    qty: "Qty",
    itemName: "Item Name",
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>("EN");

  useEffect(() => {
    const saved = localStorage.getItem("gfch_lang") as Language;
    if (saved) setLang(saved);
  }, []);

  const handleSetLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem("gfch_lang", newLang);
  };

  const t = (key: string) => {
    return translations[lang][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
