import { db } from "./firebase";
import { collection, setDoc, doc, getDocs, deleteDoc } from "firebase/firestore";

const PRODUCT_TEMPLATES = [
  { id: "PROD-001", name: "Coffee Bean - Signature Blend (1kg)", vendor: "Seoul Logistics", category: "rawMaterial", cost: 15, price: 25 },
  { id: "PROD-002", name: "Coffee Bean - Ethiopia Yirgacheffe (1kg)", vendor: "Seoul Logistics", category: "rawMaterial", cost: 20, price: 32 },
  { id: "PROD-003", name: "Coffee Bean - Brazil Santos (1kg)", vendor: "Seoul Logistics", category: "rawMaterial", cost: 14, price: 22 },
  { id: "PROD-004", name: "Paper Cup - 12oz (Box 1000ea)", vendor: "EcoPack KR", category: "packaging", cost: 30, price: 45 },
  { id: "PROD-005", name: "Plastic Cup - 16oz (Box 1000ea)", vendor: "EcoPack KR", category: "packaging", cost: 38, price: 55 },
  { id: "PROD-006", name: "Syrup - Vanilla (1L)", vendor: "SweetFlavor Co.", category: "rawMaterial", cost: 8, price: 12 },
  { id: "PROD-007", name: "Powder - Choco (1kg)", vendor: "SweetFlavor Co.", category: "rawMaterial", cost: 9, price: 15 },
];

export const seedOrders = async () => {
  try {
    // 1. Seed Products Collection
    const prodSnapshot = await getDocs(collection(db, "products"));
    for (const docRef of prodSnapshot.docs) {
      await deleteDoc(docRef.ref);
    }
    for (const prod of PRODUCT_TEMPLATES) {
      await setDoc(doc(db, "products", prod.id), prod);
    }

    // 2. Seed Orders Collection
    const querySnapshot = await getDocs(collection(db, "orders"));
    for (const docRef of querySnapshot.docs) {
      await deleteDoc(docRef.ref);
    }

    const partners = [
      { id: "MF-01", code: "JPN", name: "Japan Master Franchise" },
      { id: "MF-02", code: "VNM", name: "Vietnam Food Corp" },
    ];

    const statuses = ["DRAFT", "PENDING", "DEPOSIT_WAIT", "PREPARING", "SHIPPING", "ARRIVED", "COMPLETED"];

    for (let i = 1; i <= 15; i++) {
      const partner = partners[i % 2];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const dateStr = `202605${String(Math.max(1, i)).padStart(2, '0')}`;
      const displayDate = `2026-05-${String(Math.max(1, i)).padStart(2, '0')}`;
      
      const orderId = `PO-${partner.code}-${dateStr}-${String(i).padStart(3, '0')}`;
      
      const itemCount = 2 + Math.floor(Math.random() * 4);
      const items = [];
      let totalAmount = 0;
      
      const shuffled = [...PRODUCT_TEMPLATES].sort(() => 0.5 - Math.random());
      for (let j = 0; j < itemCount; j++) {
        const qty = 5 + Math.floor(Math.random() * 50);
        const product = shuffled[j];
        items.push({
          name: product.name,
          qty: qty,
          price: product.price,
          cost: product.cost
        });
        totalAmount += qty * product.price;
      }

      const orderData = {
        partnerId: partner.id,
        mf: partner.name,
        date: displayDate,
        amount: `$${totalAmount.toLocaleString()}`,
        status: status,
        paymentType: i % 3 === 0 ? "POSTPAID" : "PREPAID",
        paymentStatus: status === "COMPLETED" ? "PAID" : (Math.random() > 0.5 ? "PAID" : "UNPAID"),
        items: items,
        documents: {
          pi: ["https://example.com/sample-pi.pdf"],
          tt: status !== "PENDING" && status !== "DRAFT" ? ["https://example.com/sample-tt.pdf"] : []
        },
        createdAt: new Date().toISOString()
      };

      // 자동 생성 ID 대신 우리가 만든 가독성 있는 ID를 문서 ID로 사용
      await setDoc(doc(db, "orders", orderId), orderData);
    }

    alert("가독성 있는 발주 번호 체계로 샘플 데이터가 갱신되었습니다!");
    window.location.reload();
  } catch (error) {
    console.error("Error seeding orders: ", error);
    alert("데이터 생성 중 오류 발생");
  }
};
