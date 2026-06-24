"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  User as FirebaseUser
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

export type UserRole = "HQ" | string;

interface User {
  uid: string;
  id: string; // 하위 호환성 필드 (uid와 동일값으로 자동 세팅)
  name: string;
  role: UserRole;
  partnerCode?: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        try {
          // 1. users 컬렉션에서 역할 정보 조회
          const userDocRef = doc(db, "users", firebaseUser.uid);
          
          // 💡 3초 타임아웃 적용: Firestore 데이터베이스가 생성되지 않았거나 연결이 지연될 때 무한 로딩 방지
          const docPromise = getDoc(userDocRef);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("FIRESTORE_TIMEOUT")), 3000)
          );
          
          const userDoc = await Promise.race([docPromise, timeoutPromise]);

          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
          } else {
            // 💡 예외 처리: hq-admin@gfch.com이 생성되어 있으나 DB가 비어있는 경우 자동 등록 (락아웃 방지)
            if (firebaseUser.email === "hq-admin@gfch.com") {
              const hqUser: User = {
                uid: firebaseUser.uid,
                id: firebaseUser.uid,
                name: "본사 관리자",
                role: "HQ",
                email: firebaseUser.email
              };
              // 💡 setDoc도 타임아웃 처리 적용
              const setPromise = setDoc(userDocRef, hqUser);
              await Promise.race([setPromise, timeoutPromise]);
              setUser(hqUser);
            } else {
              // 권한 없는 유저는 강제 로그아웃
              await firebaseSignOut(auth);
              setUser(null);
            }
          }
        } catch (error) {
          console.error("Auth initialization error:", error);
          // 💡 세션에 오류가 있거나 DB 접근 실패 시 로컬 로그아웃 처리하여 무한 로딩 탈출
          try {
            await firebaseSignOut(auth);
          } catch (e) {
            console.error("Failed to sign out on init error:", e);
          }
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      setLoading(false);
      throw error;
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    setLoading(true);
    const cleanedEmail = email.trim().toLowerCase();
    try {
      let role: UserRole = "MF";
      let partnerCode = "";
      let inviteRef = null;

      // 💡 예외 처리: hq-admin@gfch.com은 초기 가입 허용 (초대장 검증 패스)
      if (cleanedEmail === "hq-admin@gfch.com") {
        role = "HQ";
      } else {
        // 🔒 1단계: 본사가 사전 승인한 이메일인지 invites 컬렉션 검증
        inviteRef = doc(db, "invites", cleanedEmail);
        const inviteDoc = await getDoc(inviteRef);

        if (!inviteDoc.exists() || inviteDoc.data().status === "USED") {
          throw new Error("NOT_INVITED");
        }

        const inviteData = inviteDoc.data();
        role = inviteData.role as UserRole;
        partnerCode = inviteData.partnerCode || "";
      }

      // 🔒 2단계: 실제 Firebase Auth 계정 생성
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // 🔒 3단계: users 프로필 도큐먼트 생성
      const newUser: User = {
        uid: cred.user.uid,
        id: cred.user.uid,
        name: name || (cleanedEmail === "hq-admin@gfch.com" ? "본사 관리자" : "MF Partner"),
        role: role,
        partnerCode: partnerCode,
        email: cleanedEmail
      };

      await setDoc(doc(db, "users", cred.user.uid), newUser);

      // 🔒 4단계: 초대장 사용됨으로 변경 (hq-admin이 아닌 일반 파트너 가입 시에만)
      if (inviteRef) {
        await updateDoc(inviteRef, {
          status: "USED",
          registeredAt: new Date().toISOString(),
          uid: cred.user.uid
        });
      }

    } catch (error: any) {
      setLoading(false);
      throw error;
      }
    };

  const logout = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
