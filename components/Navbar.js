"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

export default function Navbar() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  const [userRole, setUserRole] = useState("");
  const [permissions, setPermissions] = useState({});

  const mobileMenuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const userMenuRef = useRef(null);

  // Fetch Role & Permissions from Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      try {
        // 1. Try UID first
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          setUserRole(data.role || "user");
          setPermissions(data.permissions || {});
          return;
        }

        // 2. Fallback to Email search
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", user.email));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const data = querySnapshot.docs[0].data();
          setUserRole(data.role || "user");
          setPermissions(data.permissions || {});
        } else {
          setUserRole("user");
          setPermissions({});
        }
      } catch (error) {
        console.error("Navbar user data fetch error:", error);
        setUserRole("user");
        setPermissions({});
      }
    };

    fetchUserData();
  }, [user]);

  const normalizedRole = (userRole || "").toLowerCase();
  const isSuperAdmin = normalizedRole === "superadmin" || normalizedRole === "super_admin";
  const isAdmin = normalizedRole === "admin";

  // Dynamic permission check
  const canAccess = (key) => {
    if (isSuperAdmin) return true;
    return !!permissions[key];
  };

  // Group Visibility Checks (Dropdown renders if user can access at least ONE sub-page)
  const canSeeBuying = isSuperAdmin || canAccess("buying_form") || canAccess("buying_history") || canAccess("bought_returns") || canAccess("bought_statement");
  const canSeeSales = isSuperAdmin || canAccess("create_sale") || canAccess("sales_history") || canAccess("detailed_report") || canAccess("sales_returns") || canAccess("sales_statements");
  const canSeeInventory = isSuperAdmin || canAccess("inventory_items") || canAccess("inventory_store") || canAccess("inventory_ledger");
  const canSeePayments = isSuperAdmin || canAccess("sales_payment") || canAccess("buy_payment") || canAccess("sales_ledger");
  const canSeeTransport = isSuperAdmin || canAccess("transport_send") || canAccess("transport_receive") || canAccess("transport_history");
  const canSeeAccounts = isSuperAdmin || canAccess("accounts_pharmacies") || canAccess("accounts_companies");

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        mobileMenuRef.current && 
        !mobileMenuRef.current.contains(event.target) &&
        menuButtonRef.current && 
        !menuButtonRef.current.contains(event.target)
      ) {
        setIsMobileMenuOpen(false);
      }

      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target)
      ) {
        setIsUserMenuOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const isLoginPage = pathname === '/login';
  if (isLoginPage || !user) return null;

  const toggleDropdown = (name) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const toggleMobileMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMobileMenuOpen(prev => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <nav
        style={{
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
          position: "sticky",
          top: 0,
          zIndex: 1000,
          width: "100%",
          padding: "0",
        }}
      >
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            padding: "0 1rem",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "60px",
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          {/* Logo */}
          <Link
            href="/"
            style={{
              fontSize: "1rem",
              fontWeight: "bold",
              color: "#3b82f6",
              textDecoration: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            <img src="/Aranlogo.png" alt="Aran Logo" style={{ width: '140px', height: 'auto', objectFit: 'contain' }} /> 
          </Link>

          {/* Desktop Navigation */}
          <div
            style={{
              display: "none",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "nowrap",
            }}
            className="desktop-nav"
          >
            {/* Buying Dropdown */}
            {canSeeBuying && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('buying')}
                  style={{
                    background: pathname.includes("/buying") || pathname.includes("/bought") ? "#eff6ff" : "none",
                    border: "none",
                    color: pathname.includes("/buying") || pathname.includes("/bought") ? "#2563eb" : "#4b5563",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.375rem",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  Buying
                  <svg style={{ width: "14px", height: "14px", transform: openDropdown === 'buying' ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {openDropdown === 'buying' && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: "190px", backgroundColor: "#ffffff", borderRadius: "0.5rem", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", padding: "0.375rem 0", border: "1px solid #e5e7eb", zIndex: 9999 }}>
                    {canAccess("buying_form") && <Link href="/buying" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/buying" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Buying Form</Link>}
                    {canAccess("buying_history") && <Link href="/bought" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/bought" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Buying History</Link>}
                    {canAccess("bought_returns") && <Link href="/bought_returns" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/bought_returns" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Bought Returns</Link>}
                    {canAccess("bought_statement") && <Link href="/Bought_Statement" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/Bought_Statement" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Bought Statement</Link>}
                  </div>
                )}
              </div>
            )}

            {/* Sales Dropdown */}
            {canSeeSales && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('sales')}
                  style={{
                    background: (pathname.includes("/selling") || pathname.includes("/sold") || pathname.includes("/return") || pathname === "/statements") ? "#eff6ff" : "none",
                    border: "none",
                    color: (pathname.includes("/selling") || pathname.includes("/sold") || pathname.includes("/return") || pathname === "/statements") ? "#2563eb" : "#4b5563",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.375rem",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  Sales
                  <svg style={{ width: "14px", height: "14px", transform: openDropdown === 'sales' ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {openDropdown === 'sales' && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: "190px", backgroundColor: "#ffffff", borderRadius: "0.5rem", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", padding: "0.375rem 0", border: "1px solid #e5e7eb", zIndex: 9999 }}>
                    {canAccess("create_sale") && <Link href="/selling" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/selling" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Create Sale</Link>}
                    {canAccess("sales_history") && <Link href="/sold" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/sold" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Sales History</Link>}
                    {canAccess("detailed_report") && <Link href="/sold/detailed-report" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/sold/detailed-report" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Detailed Report</Link>}
                    {canAccess("sales_returns") && <Link href="/return" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/return" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Returns</Link>}
                    <div style={{ borderTop: "1px solid #f3f4f6", margin: "0.25rem 0" }} />
                    {canAccess("sales_statements") && <Link href="/statements" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/statements" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Statements</Link>}
                  </div>
                )}
              </div>
            )}

            {/* Inventory Dropdown */}
            {canSeeInventory && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('inventory')}
                  style={{
                    background: (pathname.includes("/items") || pathname.includes("/store") || pathname.includes("/inventory_ledger")) ? "#eff6ff" : "none",
                    border: "none",
                    color: (pathname.includes("/items") || pathname.includes("/store") || pathname.includes("/inventory_ledger")) ? "#2563eb" : "#4b5563",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.375rem",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  Inventory
                  <svg style={{ width: "14px", height: "14px", transform: openDropdown === 'inventory' ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {openDropdown === 'inventory' && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: "190px", backgroundColor: "#ffffff", borderRadius: "0.5rem", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", padding: "0.375rem 0", border: "1px solid #e5e7eb", zIndex: 9999 }}>
                    {canAccess("inventory_items") && <Link href="/items" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/items" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Items</Link>}
                    {canAccess("inventory_store") && <Link href="/store" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/store" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Store</Link>}
                    {canAccess("inventory_ledger") && <Link href="/inventory_ledger" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/inventory_ledger" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Ledger</Link>}
                  </div>
                )}
              </div>
            )}

            {/* Payments Dropdown */}
            {canSeePayments && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('payments')}
                  style={{
                    background: (pathname.includes("/payments") || pathname.includes("/bought_payments") || pathname.includes("/sales_ledger")) ? "#eff6ff" : "none",
                    border: "none",
                    color: (pathname.includes("/payments") || pathname.includes("/bought_payments") || pathname.includes("/sales_ledger")) ? "#2563eb" : "#4b5563",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.375rem",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  Payments
                  <svg style={{ width: "14px", height: "14px", transform: openDropdown === 'payments' ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {openDropdown === 'payments' && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: "190px", backgroundColor: "#ffffff", borderRadius: "0.5rem", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", padding: "0.375rem 0", border: "1px solid #e5e7eb", zIndex: 9999 }}>
                    {canAccess("sales_payment") && <Link href="/payments/create" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/payments/create" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Sales Payment</Link>}
                    {canAccess("buy_payment") && <Link href="/bought_payments/" style={{ display: "block", padding: "0.5rem 1rem", color: pathname.includes("/bought_payments/") ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Buy Payment</Link>}
                    {canAccess("sales_ledger") && <Link href="/sales_ledger/" style={{ display: "block", padding: "0.5rem 1rem", color: pathname.includes("/sales_ledger/") ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Sales Ledger</Link>}
                  </div>
                )}
              </div>
            )}

            {/* Transport Dropdown */}
            {canSeeTransport && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('transport')}
                  style={{
                    background: pathname.includes("/transport") ? "#eff6ff" : "none",
                    border: "none",
                    color: pathname.includes("/transport") ? "#2563eb" : "#4b5563",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.375rem",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  Transport
                  <svg style={{ width: "14px", height: "14px", transform: openDropdown === 'transport' ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {openDropdown === 'transport' && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: "190px", backgroundColor: "#ffffff", borderRadius: "0.5rem", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", padding: "0.375rem 0", border: "1px solid #e5e7eb", zIndex: 9999 }}>
                    {canAccess("transport_send") && <Link href="/transport/send" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/transport/send" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Send Transport</Link>}
                    {canAccess("transport_receive") && <Link href="/transport/receive" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/transport/receive" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Receive Transport</Link>}
                    {canAccess("transport_history") && <Link href="/transport/transportHistory" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/transport/transportHistory" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Transport History</Link>}
                  </div>
                )}
              </div>
            )}

            {/* Accounts Dropdown */}
            {canSeeAccounts && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('accounts')}
                  style={{
                    background: (pathname.includes("/companies") || pathname.includes("/pharmacies")) ? "#eff6ff" : "none",
                    border: "none",
                    color: (pathname.includes("/companies") || pathname.includes("/pharmacies")) ? "#2563eb" : "#4b5563",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.375rem",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  Accounts
                  <svg style={{ width: "14px", height: "14px", transform: openDropdown === 'accounts' ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {openDropdown === 'accounts' && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: "190px", backgroundColor: "#ffffff", borderRadius: "0.5rem", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", padding: "0.375rem 0", border: "1px solid #e5e7eb", zIndex: 9999 }}>
                    {canAccess("accounts_pharmacies") && <Link href="/pharmacies" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/pharmacies" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Pharmacies</Link>}
                    {canAccess("accounts_companies") && <Link href="/companies" style={{ display: "block", padding: "0.5rem 1rem", color: pathname === "/companies" ? "#2563eb" : "#374151", textDecoration: "none", fontSize: "0.875rem" }} onClick={() => setOpenDropdown(null)}>Companies</Link>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Popover Profile Menu */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
            <div className="user-badge" style={{ position: "relative" }} ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  padding: "0.35rem 0.75rem",
                  borderRadius: "9999px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  outline: "none",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    backgroundColor: "#2563eb",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                  }}
                >
                  {(user?.email || "U")[0].toUpperCase()}
                </div>
                <span
                  style={{
                    color: "#0f172a",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    maxWidth: "140px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user?.email}
                </span>
                <svg
                  style={{
                    width: "12px",
                    height: "12px",
                    color: "#64748b",
                    transform: isUserMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 6px)",
                    width: "240px",
                    backgroundColor: "#ffffff",
                    borderRadius: "0.75rem",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)",
                    zIndex: 9999,
                    padding: "0.75rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>
                      Logged in as
                    </p>
                    <p style={{ margin: "0.125rem 0 0 0", fontSize: "0.875rem", color: "#0f172a", fontWeight: 700, wordBreak: "break-all" }}>
                      {user?.email}
                    </p>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: "0.375rem",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px",
                        fontSize: "0.6875rem",
                        fontWeight: "700",
                        backgroundColor: isSuperAdmin ? "#f3e8ff" : isAdmin ? "#dbeafe" : "#d1fae5",
                        color: isSuperAdmin ? "#7c3aed" : isAdmin ? "#1e40af" : "#065f46",
                        textTransform: "uppercase",
                      }}
                    >
                      {userRole || "User"}
                    </span>
                  </div>

                  <Link
                    href="/users"
                    onClick={() => setIsUserMenuOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      color: "#334155",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      textDecoration: "none",
                    }}
                  >
                    👤 Account Settings
                  </Link>

                  {/* SuperAdmin Control Center Link */}
                  {isSuperAdmin && (
                    <Link
                      href="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem",
                        borderRadius: "0.375rem",
                        color: "#2563eb",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        backgroundColor: "#eff6ff",
                        textDecoration: "none",
                      }}
                    >
                      🛡️ Control Center
                    </Link>
                  )}

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      handleLogout();
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      backgroundColor: "#fef2f2",
                      color: "#dc2626",
                      border: "1px solid #fecaca",
                      fontSize: "0.875rem",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              ref={menuButtonRef}
              onClick={toggleMobileMenu}
              style={{
                display: "flex",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "6px",
                alignItems: "center",
                justifyContent: "center",
                color: "#4b5563",
                borderRadius: "6px",
              }}
              className="mobile-toggle"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {isMobileMenuOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          style={{
            position: "fixed",
            top: "60px",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#ffffff",
            padding: "1rem",
            zIndex: 999,
            overflowY: "auto",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          {/* Mobile User Profile Summary Banner */}
          {user && (
            <div
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "0.75rem",
                padding: "0.875rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: "#2563eb",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1rem",
                  fontWeight: "bold",
                  flexShrink: 0,
                }}
              >
                {(user.email || "U")[0].toUpperCase()}
              </div>
              <div style={{ overflow: "hidden", flex: 1 }}>
                <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "#0f172a", wordBreak: "break-all" }}>
                  {user.email}
                </p>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "0.25rem",
                    padding: "0.1rem 0.5rem",
                    borderRadius: "4px",
                    fontSize: "0.6875rem",
                    fontWeight: "700",
                    backgroundColor: isSuperAdmin ? "#f3e8ff" : isAdmin ? "#dbeafe" : "#d1fae5",
                    color: isSuperAdmin ? "#7c3aed" : isAdmin ? "#1e40af" : "#065f46",
                    textTransform: "uppercase",
                  }}
                >
                  {userRole || "User"}
                </span>
              </div>
            </div>
          )}

          {canSeeBuying && (
            <div style={{ marginBottom: "0.5rem" }}>
              <button onClick={() => toggleDropdown('m-buying')} style={{ background: "none", border: "none", color: "#1e293b", fontSize: "0.9375rem", fontWeight: 600, width: "100%", textAlign: "left", padding: "0.625rem 0", display: "flex", justifyContent: "space-between" }}>
                Buying
              </button>
              {openDropdown === 'm-buying' && (
                <div style={{ paddingLeft: "0.75rem" }}>
                  {canAccess("buying_form") && <Link href="/buying" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Buying Form</Link>}
                  {canAccess("buying_history") && <Link href="/bought" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Buying History</Link>}
                  {canAccess("bought_returns") && <Link href="/bought_returns" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Bought Returns</Link>}
                  {canAccess("bought_statement") && <Link href="/Bought_Statement" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Bought Statement</Link>}
                </div>
              )}
            </div>
          )}

          {canSeeSales && (
            <div style={{ marginBottom: "0.5rem" }}>
              <button onClick={() => toggleDropdown('m-sales')} style={{ background: "none", border: "none", color: "#1e293b", fontSize: "0.9375rem", fontWeight: 600, width: "100%", textAlign: "left", padding: "0.625rem 0", display: "flex", justifyContent: "space-between" }}>
                Sales
              </button>
              {openDropdown === 'm-sales' && (
                <div style={{ paddingLeft: "0.75rem" }}>
                  {canAccess("create_sale") && <Link href="/selling" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Create Sale</Link>}
                  {canAccess("sales_history") && <Link href="/sold" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Sales History</Link>}
                  {canAccess("detailed_report") && <Link href="/sold/detailed-report" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Detailed Report</Link>}
                  {canAccess("sales_returns") && <Link href="/return" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Returns</Link>}
                  {canAccess("sales_statements") && <Link href="/statements" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Statements</Link>}
                </div>
              )}
            </div>
          )}

          {canSeeInventory && (
            <div style={{ marginBottom: "0.5rem" }}>
              <button onClick={() => toggleDropdown('m-inventory')} style={{ background: "none", border: "none", color: "#1e293b", fontSize: "0.9375rem", fontWeight: 600, width: "100%", textAlign: "left", padding: "0.625rem 0", display: "flex", justifyContent: "space-between" }}>
                Inventory
              </button>
              {openDropdown === 'm-inventory' && (
                <div style={{ paddingLeft: "0.75rem" }}>
                  {canAccess("inventory_items") && <Link href="/items" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Items</Link>}
                  {canAccess("inventory_store") && <Link href="/store" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Store</Link>}
                  {canAccess("inventory_ledger") && <Link href="/inventory_ledger" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Ledger</Link>}
                </div>
              )}
            </div>
          )}

          {canSeePayments && (
            <div style={{ marginBottom: "0.5rem" }}>
              <button onClick={() => toggleDropdown('m-payments')} style={{ background: "none", border: "none", color: "#1e293b", fontSize: "0.9375rem", fontWeight: 600, width: "100%", textAlign: "left", padding: "0.625rem 0", display: "flex", justifyContent: "space-between" }}>
                Payments
              </button>
              {openDropdown === 'm-payments' && (
                <div style={{ paddingLeft: "0.75rem" }}>
                  {canAccess("sales_payment") && <Link href="/payments/create" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Sales Payment</Link>}
                  {canAccess("buy_payment") && <Link href="/bought_payments/" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Buy Payment</Link>}
                  {canAccess("sales_ledger") && <Link href="/sales_ledger/" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Sales Ledger</Link>}
                </div>
              )}
            </div>
          )}

          {canSeeTransport && (
            <div style={{ marginBottom: "0.5rem" }}>
              <button onClick={() => toggleDropdown('m-transport')} style={{ background: "none", border: "none", color: "#1e293b", fontSize: "0.9375rem", fontWeight: 600, width: "100%", textAlign: "left", padding: "0.625rem 0", display: "flex", justifyContent: "space-between" }}>
                Transport
              </button>
              {openDropdown === 'm-transport' && (
                <div style={{ paddingLeft: "0.75rem" }}>
                  {canAccess("transport_send") && <Link href="/transport/send" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Send Transport</Link>}
                  {canAccess("transport_receive") && <Link href="/transport/receive" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Receive Transport</Link>}
                  {canAccess("transport_history") && <Link href="/transport/transportHistory" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Transport History</Link>}
                </div>
              )}
            </div>
          )}

          {canSeeAccounts && (
            <div style={{ marginBottom: "0.5rem" }}>
              <button onClick={() => toggleDropdown('m-accounts')} style={{ background: "none", border: "none", color: "#1e293b", fontSize: "0.9375rem", fontWeight: 600, width: "100%", textAlign: "left", padding: "0.625rem 0", display: "flex", justifyContent: "space-between" }}>
                Accounts
              </button>
              {openDropdown === 'm-accounts' && (
                <div style={{ paddingLeft: "0.75rem" }}>
                  {canAccess("accounts_pharmacies") && <Link href="/pharmacies" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Pharmacies</Link>}
                  {canAccess("accounts_companies") && <Link href="/companies" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none" }} onClick={closeMobileMenu}>Companies</Link>}
                </div>
              )}
            </div>
          )}

          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "0.875rem", marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Link href="/users" onClick={closeMobileMenu} style={{ display: "block", padding: "0.625rem", borderRadius: "0.375rem", color: "#334155", fontWeight: 600, backgroundColor: "#f8fafc", textAlign: "center", textDecoration: "none" }}>
              👤 Account Settings
            </Link>

            {isSuperAdmin && (
              <Link href="/settings" onClick={closeMobileMenu} style={{ display: "block", padding: "0.625rem", borderRadius: "0.375rem", color: "#2563eb", fontWeight: 600, backgroundColor: "#eff6ff", textAlign: "center", textDecoration: "none" }}>
                🛡️ Control Center
              </Link>
            )}

            <button onClick={() => { closeMobileMenu(); handleLogout(); }} style={{ backgroundColor: "#ef4444", color: "#ffffff", border: "none", padding: "0.625rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600", width: "100%" }}>
              🚪 Sign Out
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @media (min-width: 768px) {
          .desktop-nav { display: flex !important; }
          .mobile-toggle { display: none !important; }
        }
        @media (max-width: 767px) {
          .desktop-nav { display: none !important; }
          .mobile-toggle { display: flex !important; }
          .user-badge { display: none !important; }
        }
        @media (min-width: 1024px) {
          .user-badge { display: block !important; }
        }
      `}</style>
    </>
  );
}