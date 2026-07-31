"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- Utility: Clears old 'peshin' cache left over from previous projects ---
  const cleanupLegacyStorage = () => {
    const legacyKeys = [
      "peshinAdmin", "peshinContent", "peshin_admin", "peshin_data_v2", 
      "pb_admin", "pb_products", "isAdmin", "vn_admin"
    ];
    legacyKeys.forEach(key => localStorage.removeItem(key));
  };

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      
      cleanupLegacyStorage();

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData.role || "user";
        const branch = userData.branch || "Slemany";

        // Sync role to localStorage so SoldPage.jsx can authorize SuperAdmins
        localStorage.setItem("userRole", role);
        localStorage.setItem("userBranch", branch);

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: role,
          branch: branch,
        });
      } else {
        // Fallback default changed from "employee" to "user"
        await setDoc(doc(db, "users", firebaseUser.uid), {
          role: "user",
          branch: "Slemany",
        });

        localStorage.setItem("userRole", "user");
        localStorage.setItem("userBranch", "Slemany");

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: "user",
          branch: "Slemany",
        });
      }
    } catch (error) {
      console.error("Error during login:", error);
      throw error;
    }
  };

  // --- NEW: Global logout function to ensure roles are wiped from local storage ---
  const logout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("userRole");
      localStorage.removeItem("userBranch");
      setUser(null);
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          cleanupLegacyStorage();

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const role = userData.role || "user";
            const branch = userData.branch || "Slemany";

            localStorage.setItem("userRole", role);
            localStorage.setItem("userBranch", branch);

            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: role,
              branch: branch,
            });
          } else {
            await setDoc(doc(db, "users", firebaseUser.uid), {
              role: "user",
              branch: "Slemany",
            });

            localStorage.setItem("userRole", "user");
            localStorage.setItem("userBranch", "Slemany");

            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: "user",
              branch: "Slemany",
            });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          // Safe fallback
          localStorage.setItem("userRole", "user");
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: "user",
            branch: "Slemany",
          });
        }
      } else {
        localStorage.removeItem("userRole");
        localStorage.removeItem("userBranch");
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    // Export logout so it can be called from your Topbar/Sidebar
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}