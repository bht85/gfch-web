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
          const userDoc = await getDoc(userDocRef);

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
              await setDoc(userDocRef, hqUser);
              setUser(hqUser);
            } else {
              // 권한 없는 유저는 강제 로그아웃
              await firebaseSignOut(auth);
              setUser(null);
            }
          }
        } catch (error) {
          console.error("Auth initialization error:", error);
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
      // 🔒 1단계: 본사가 사전 승인한 이메일인지 invites 컬렉션 검증
      const inviteRef = doc(db, "invites", cleanedEmail);
      const inviteDoc = await getDoc(inviteRef);

      if (!inviteDoc.exists() || inviteDoc.data().status === "USED") {
        throw new Error("NOT_INVITED");
      }

      const inviteData = inviteDoc.data();

      // 🔒 2단계: 실제 Firebase Auth 계정 생성
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // 🔒 3단계: users 프로필 도큐먼트 생성
      const newUser: User = {
        uid: cred.user.uid,
        id: cred.user.uid,
        name: name || inviteData.name || "MF Partner",
        role: inviteData.role as UserRole,
        partnerCode: inviteData.partnerCode || "",
        email: cleanedEmail
      };

      await setDoc(doc(db, "users", cred.user.uid), newUser);

      // 🔒 4단계: 초대장 사용됨으로 변경
      await updateDoc(inviteRef, {
        status: "USED",
        registeredAt: new Date().toISOString(),
        uid: cred.user.uid
      });

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
