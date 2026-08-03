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
  
  // State to hold the user's role
  const [userRole, setUserRole] = useState("");

  const mobileMenuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const userMenuRef = useRef(null);

  // Fetch the role from Firestore when the component mounts
  useEffect(() => {
    const fetchRole = async () => {
      if (!user) return;
      
      // If your AuthContext already happens to fetch the role, use it
      if (user.role) {
        setUserRole(user.role);
        return;
      }

      try {
        // 1. Try UID first
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          setUserRole(userDocSnap.data().role || "user");
        } else {
          // 2. Fallback to Email
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("email", "==", user.email));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            setUserRole(querySnapshot.docs[0].data().role || "user");
          } else {
            setUserRole("user");
          }
        }
      } catch (error) {
        console.error("Navbar role fetch error:", error);
        setUserRole("user");
      }
    };

    fetchRole();
  }, [user]);

  // Case-insensitive role booleans
  const normalizedRole = (userRole || "").toLowerCase();
  const isSuperAdmin = normalizedRole === "superadmin" || normalizedRole === "super_admin";
  const isAdmin = normalizedRole === "admin";
  const isStandardUser = normalizedRole === "user";
  const isEmployee = normalizedRole === "employee";
  
  // Allow standard users to also view the Accounts dropdown
  const canViewAccounts = isSuperAdmin || isAdmin || isStandardUser;

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

  // Prevent body scroll when mobile menu is open
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
  
  if (isLoginPage || !user) {
    return null;
  }

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
            {/* Buying Dropdown - Only for superAdmin */}
            {isSuperAdmin && (
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
                  <svg
                    style={{
                      width: "14px",
                      height: "14px",
                      transition: "transform 0.2s ease",
                      transform: openDropdown === 'buying' ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openDropdown === 'buying' && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      minWidth: "190px",
                      backgroundColor: "#ffffff",
                      borderRadius: "0.5rem",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
                      padding: "0.375rem 0",
                      border: "1px solid #e5e7eb",
                      zIndex: 9999,
                    }}
                  >
                    <Link
                      href="/buying"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname === "/buying" ? "#2563eb" : "#374151",
                        fontWeight: pathname === "/buying" ? 600 : 400,
                        textDecoration: "none",
                        fontSize: "0.875rem",
                        transition: "all 0.15s ease",
                        backgroundColor: pathname === "/buying" ? "#f0f9ff" : "transparent",
                      }}
                      onClick={() => setOpenDropdown(null)}
                    >
                      Buying Form
                    </Link>
                    <Link
                      href="/bought"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname === "/bought" ? "#2563eb" : "#374151",
                        fontWeight: pathname === "/bought" ? 600 : 400,
                        textDecoration: "none",
                        fontSize: "0.875rem",
                        transition: "all 0.15s ease",
                        backgroundColor: pathname === "/bought" ? "#f0f9ff" : "transparent",
                      }}
                      onClick={() => setOpenDropdown(null)}
                    >
                      Buying History
                    </Link>
                    <Link
                      href="/bought_returns"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname === "/bought_returns" ? "#2563eb" : "#374151",
                        fontWeight: pathname === "/bought_returns" ? 600 : 400,
                        textDecoration: "none",
                        fontSize: "0.875rem",
                        transition: "all 0.15s ease",
                        backgroundColor: pathname === "/bought_returns" ? "#f0f9ff" : "transparent",
                      }}
                      onClick={() => setOpenDropdown(null)}
                    >
                      Bought Returns
                    </Link>
                    <Link
                      href="/Bought_Statement"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname === "/Bought_Statement" ? "#2563eb" : "#374151",
                        fontWeight: pathname === "/Bought_Statement" ? 600 : 400,
                        textDecoration: "none",
                        fontSize: "0.875rem",
                        transition: "all 0.15s ease",
                        backgroundColor: pathname === "/Bought_Statement" ? "#f0f9ff" : "transparent",
                      }}
                      onClick={() => setOpenDropdown(null)}
                    >
                      Bought Statement
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Sales Dropdown */}
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
                <svg
                  style={{
                    width: "14px",
                    height: "14px",
                    transition: "transform 0.2s ease",
                    transform: openDropdown === 'sales' ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'sales' && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    minWidth: "190px",
                    backgroundColor: "#ffffff",
                    borderRadius: "0.5rem",
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
                    padding: "0.375rem 0",
                    border: "1px solid #e5e7eb",
                    zIndex: 9999,
                  }}
                >
                  <Link
                    href="/selling"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/selling" ? "#2563eb" : "#374151",
                      fontWeight: pathname === "/selling" ? 600 : 400,
                      textDecoration: "none",
                      fontSize: "0.875rem",
                      backgroundColor: pathname === "/selling" ? "#f0f9ff" : "transparent",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Create Sale
                  </Link>
                  <Link
                    href="/sold"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/sold" ? "#2563eb" : "#374151",
                      fontWeight: pathname === "/sold" ? 600 : 400,
                      textDecoration: "none",
                      fontSize: "0.875rem",
                      backgroundColor: pathname === "/sold" ? "#f0f9ff" : "transparent",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Sales History
                  </Link>
                  <Link
                    href="/sold/detailed-report"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/sold/detailed-report" ? "#2563eb" : "#374151",
                      fontWeight: pathname === "/sold/detailed-report" ? 600 : 400,
                      textDecoration: "none",
                      fontSize: "0.875rem",
                      backgroundColor: pathname === "/sold/detailed-report" ? "#f0f9ff" : "transparent",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Detailed Report
                  </Link>
                  <Link
                    href="/return"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/return" ? "#2563eb" : "#374151",
                      fontWeight: pathname === "/return" ? 600 : 400,
                      textDecoration: "none",
                      fontSize: "0.875rem",
                      backgroundColor: pathname === "/return" ? "#f0f9ff" : "transparent",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Returns
                  </Link>
                  <div style={{ borderTop: "1px solid #f3f4f6", margin: "0.25rem 0" }} />
                  <Link
                    href="/statements"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/statements" ? "#2563eb" : "#374151",
                      fontWeight: pathname === "/statements" ? 600 : 400,
                      textDecoration: "none",
                      fontSize: "0.875rem",
                      backgroundColor: pathname === "/statements" ? "#f0f9ff" : "transparent",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Statements
                  </Link>
                </div>
              )}
            </div>

            {/* Inventory Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => toggleDropdown('inventory')}
                style={{
                  background: (pathname.includes("/items") || pathname.includes("/store")) ? "#eff6ff" : "none",
                  border: "none",
                  color: (pathname.includes("/items") || pathname.includes("/store")) ? "#2563eb" : "#4b5563",
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
                <svg
                  style={{
                    width: "14px",
                    height: "14px",
                    transition: "transform 0.2s ease",
                    transform: openDropdown === 'inventory' ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'inventory' && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    minWidth: "190px",
                    backgroundColor: "#ffffff",
                    borderRadius: "0.5rem",
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
                    padding: "0.375rem 0",
                    border: "1px solid #e5e7eb",
                    zIndex: 9999,
                  }}
                >
                  {!isEmployee && (
                    <Link
                      href="/items"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname === "/items" ? "#2563eb" : "#374151",
                        fontWeight: pathname === "/items" ? 600 : 400,
                        textDecoration: "none",
                        fontSize: "0.875rem",
                        backgroundColor: pathname === "/items" ? "#f0f9ff" : "transparent",
                      }}
                      onClick={() => setOpenDropdown(null)}
                    >
                      Items
                    </Link>
                  )}
                  <Link
                    href="/store"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/store" ? "#2563eb" : "#374151",
                      fontWeight: pathname === "/store" ? 600 : 400,
                      textDecoration: "none",
                      fontSize: "0.875rem",
                      backgroundColor: pathname === "/store" ? "#f0f9ff" : "transparent",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Store
                  </Link>
                </div>
              )}
            </div>

            {/* Payments Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => toggleDropdown('payments')}
                style={{
                  background: pathname.includes("/payments") ? "#eff6ff" : "none",
                  border: "none",
                  color: pathname.includes("/payments") ? "#2563eb" : "#4b5563",
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
                <svg
                  style={{
                    width: "14px",
                    height: "14px",
                    transition: "transform 0.2s ease",
                    transform: openDropdown === 'payments' ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'payments' && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    minWidth: "190px",
                    backgroundColor: "#ffffff",
                    borderRadius: "0.5rem",
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
                    padding: "0.375rem 0",
                    border: "1px solid #e5e7eb",
                    zIndex: 9999,
                  }}
                >
                  <Link
                    href="/payments/create"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/payments/create" ? "#2563eb" : "#374151",
                      fontWeight: pathname === "/payments/create" ? 600 : 400,
                      textDecoration: "none",
                      fontSize: "0.875rem",
                      backgroundColor: pathname === "/payments/create" ? "#f0f9ff" : "transparent",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Sales Payment
                  </Link>
                  {isSuperAdmin && (
                    <Link
                      href="/bought_payments/"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname.includes("/bought_payments/") ? "#2563eb" : "#374151",
                        fontWeight: pathname.includes("/bought_payments/") ? 600 : 400,
                        textDecoration: "none",
                        fontSize: "0.875rem",
                        backgroundColor: pathname.includes("/bought_payments/") ? "#f0f9ff" : "transparent",
                      }}
                      onClick={() => setOpenDropdown(null)}
                    >
                      Buy Payment
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Transport Dropdown */}
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
                <svg
                  style={{
                    width: "14px",
                    height: "14px",
                    transition: "transform 0.2s ease",
                    transform: openDropdown === 'transport' ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'transport' && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    minWidth: "190px",
                    backgroundColor: "#ffffff",
                    borderRadius: "0.5rem",
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
                    padding: "0.375rem 0",
                    border: "1px solid #e5e7eb",
                    zIndex: 9999,
                  }}
                >
                  <Link
                    href="/transport/send"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/transport/send" ? "#2563eb" : "#374151",
                      fontWeight: pathname === "/transport/send" ? 600 : 400,
                      textDecoration: "none",
                      fontSize: "0.875rem",
                      backgroundColor: pathname === "/transport/send" ? "#f0f9ff" : "transparent",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Send Transport
                  </Link>
                  <Link
                    href="/transport/receive"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/transport/receive" ? "#2563eb" : "#374151",
                      fontWeight: pathname === "/transport/receive" ? 600 : 400,
                      textDecoration: "none",
                      fontSize: "0.875rem",
                      backgroundColor: pathname === "/transport/receive" ? "#f0f9ff" : "transparent",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Receive Transport
                  </Link>
                  <Link
                    href="/transport/transportHistory"
                    style={{
                      display: "block",
                      padding: "0.5rem 1rem",
                      color: pathname === "/transport/transportHistory" ? "#2563eb" : "#374151",
                      fontWeight: pathname === "/transport/transportHistory" ? 600 : 400,
                      textDecoration: "none",
                      fontSize: "0.875rem",
                      backgroundColor: pathname === "/transport/transportHistory" ? "#f0f9ff" : "transparent",
                    }}
                    onClick={() => setOpenDropdown(null)}
                  >
                    Transport History
                  </Link>
                </div>
              )}
            </div>

            {/* Accounts Dropdown */}
            {canViewAccounts && (
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
                  <svg
                    style={{
                      width: "14px",
                      height: "14px",
                      transition: "transform 0.2s ease",
                      transform: openDropdown === 'accounts' ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openDropdown === 'accounts' && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      minWidth: "190px",
                      backgroundColor: "#ffffff",
                      borderRadius: "0.5rem",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
                      padding: "0.375rem 0",
                      border: "1px solid #e5e7eb",
                      zIndex: 9999,
                    }}
                  >
                    <Link
                      href="/pharmacies"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname === "/pharmacies" ? "#2563eb" : "#374151",
                        fontWeight: pathname === "/pharmacies" ? 600 : 400,
                        textDecoration: "none",
                        fontSize: "0.875rem",
                        backgroundColor: pathname === "/pharmacies" ? "#f0f9ff" : "transparent",
                      }}
                      onClick={() => setOpenDropdown(null)}
                    >
                      Pharmacies
                    </Link>
                    <Link
                      href="/companies"
                      style={{
                        display: "block",
                        padding: "0.5rem 1rem",
                        color: pathname === "/companies" ? "#2563eb" : "#374151",
                        fontWeight: pathname === "/companies" ? 600 : 400,
                        textDecoration: "none",
                        fontSize: "0.875rem",
                        backgroundColor: pathname === "/companies" ? "#f0f9ff" : "transparent",
                      }}
                      onClick={() => setOpenDropdown(null)}
                    >
                      Companies
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right side - User Profile Popover Menu (Desktop) & Mobile Toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
            
            {/* Desktop User Profile Button & Popover */}
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
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    👤 Account Settings
                  </Link>

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
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#fee2e2"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "#fef2f2"}
                  >
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle Button */}
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
                transition: "background-color 0.2s ease",
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                zIndex: 1001,
              }}
              className="mobile-toggle"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.2"
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
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

      {/* Mobile Drawer Menu */}
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
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
            padding: "1rem",
            zIndex: 999,
            overflowY: "auto",
            overflowX: "hidden",
            borderTop: "1px solid #e5e7eb",
            width: "100%",
            boxSizing: "border-box",
            animation: "slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
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

          {/* Buying Links */}
          {isSuperAdmin && (
            <div style={{ marginBottom: "0.5rem" }}>
              <button
                onClick={() => toggleDropdown('mobile-buying')}
                style={{
                  background: "none",
                  border: "none",
                  color: "#1e293b",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "0.625rem 0",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                Buying
                <svg
                  style={{
                    width: "16px",
                    height: "16px",
                    transition: "transform 0.2s ease",
                    transform: openDropdown === 'mobile-buying' ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'mobile-buying' && (
                <div style={{ paddingLeft: "0.75rem", marginTop: "0.25rem" }}>
                  <Link href="/buying" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Buying Form</Link>
                  <Link href="/bought" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Buying History</Link>
                  <Link href="/bought_returns" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Bought Returns</Link>
                  <Link href="/Bought_Statement" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Bought Statement</Link>
                </div>
              )}
            </div>
          )}

          {/* Sales Links */}
          <div style={{ marginBottom: "0.5rem" }}>
            <button
              onClick={() => toggleDropdown('mobile-sales')}
              style={{
                background: "none",
                border: "none",
                color: "#1e293b",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "0.625rem 0",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              Sales
              <svg
                style={{
                  width: "16px",
                  height: "16px",
                  transition: "transform 0.2s ease",
                  transform: openDropdown === 'mobile-sales' ? "rotate(180deg)" : "rotate(0deg)",
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openDropdown === 'mobile-sales' && (
              <div style={{ paddingLeft: "0.75rem", marginTop: "0.25rem" }}>
                <Link href="/selling" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Create Sale</Link>
                <Link href="/sold" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Sales History</Link>
                <Link href="/sold/detailed-report" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Detailed Report</Link>
                <Link href="/return" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Returns</Link>
                <Link href="/statements" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Statements</Link>
              </div>
            )}
          </div>

          {/* Inventory Links */}
          <div style={{ marginBottom: "0.5rem" }}>
            <button
              onClick={() => toggleDropdown('mobile-inventory')}
              style={{
                background: "none",
                border: "none",
                color: "#1e293b",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "0.625rem 0",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              Inventory
              <svg
                style={{
                  width: "16px",
                  height: "16px",
                  transition: "transform 0.2s ease",
                  transform: openDropdown === 'mobile-inventory' ? "rotate(180deg)" : "rotate(0deg)",
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openDropdown === 'mobile-inventory' && (
              <div style={{ paddingLeft: "0.75rem", marginTop: "0.25rem" }}>
                {!isEmployee && (
                  <Link href="/items" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Items</Link>
                )}
                <Link href="/store" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Store</Link>
              </div>
            )}
          </div>

          {/* Payments Links */}
          <div style={{ marginBottom: "0.5rem" }}>
            <button
              onClick={() => toggleDropdown('mobile-payments')}
              style={{
                background: "none",
                border: "none",
                color: "#1e293b",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "0.625rem 0",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              Payments
              <svg
                style={{
                  width: "16px",
                  height: "16px",
                  transition: "transform 0.2s ease",
                  transform: openDropdown === 'mobile-payments' ? "rotate(180deg)" : "rotate(0deg)",
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openDropdown === 'mobile-payments' && (
              <div style={{ paddingLeft: "0.75rem", marginTop: "0.25rem" }}>
                <Link href="/payments/create" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Sales Payment</Link>
                {isSuperAdmin && (
                  <Link href="/bought_payments/" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Buy Payment</Link>
                )}
              </div>
            )}
          </div>

          {/* Transport Links */}
          <div style={{ marginBottom: "0.5rem" }}>
            <button
              onClick={() => toggleDropdown('mobile-transport')}
              style={{
                background: "none",
                border: "none",
                color: "#1e293b",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "0.625rem 0",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              Transport
              <svg
                style={{
                  width: "16px",
                  height: "16px",
                  transition: "transform 0.2s ease",
                  transform: openDropdown === 'mobile-transport' ? "rotate(180deg)" : "rotate(0deg)",
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openDropdown === 'mobile-transport' && (
              <div style={{ paddingLeft: "0.75rem", marginTop: "0.25rem" }}>
                <Link href="/transport/send" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Send Transport</Link>
                <Link href="/transport/receive" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Receive Transport</Link>
                <Link href="/transport/transportHistory" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Transport History</Link>
              </div>
            )}
          </div>

          {/* Accounts Links */}
          {canViewAccounts && (
            <div style={{ marginBottom: "0.5rem" }}>
              <button
                onClick={() => toggleDropdown('mobile-accounts')}
                style={{
                  background: "none",
                  border: "none",
                  color: "#1e293b",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "0.625rem 0",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                Accounts
                <svg
                  style={{
                    width: "16px",
                    height: "16px",
                    transition: "transform 0.2s ease",
                    transform: openDropdown === 'mobile-accounts' ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'mobile-accounts' && (
                <div style={{ paddingLeft: "0.75rem", marginTop: "0.25rem" }}>
                  <Link href="/pharmacies" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Pharmacies</Link>
                  <Link href="/companies" style={{ display: "block", padding: "0.4rem 0", color: "#475569", textDecoration: "none", fontSize: "0.875rem" }} onClick={closeMobileMenu}>Companies</Link>
                </div>
              )}
            </div>
          )}

          {/* User Settings & Logout Button */}
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "0.875rem", marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Link
              href="/users"
              onClick={closeMobileMenu}
              style={{
                display: "block",
                padding: "0.625rem",
                borderRadius: "0.375rem",
                color: "#334155",
                fontWeight: 600,
                fontSize: "0.875rem",
                textDecoration: "none",
                backgroundColor: "#f8fafc",
                textAlign: "center",
              }}
            >
              👤 Account Settings
            </Link>

            <button
              onClick={() => {
                closeMobileMenu();
                handleLogout();
              }}
              style={{
                backgroundColor: "#ef4444",
                color: "#ffffff",
                border: "none",
                padding: "0.625rem",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "0.875rem",
                width: "100%",
                boxShadow: "0 2px 4px rgba(239, 68, 68, 0.2)",
                transition: "all 0.2s ease",
              }}
            >
              🚪 Sign Out
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @media (min-width: 768px) {
          .desktop-nav {
            display: flex !important;
          }
          .mobile-toggle {
            display: none !important;
          }
        }
        @media (max-width: 767px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-toggle {
            display: flex !important;
          }
          .user-badge {
            display: none !important;
          }
        }
        @media (min-width: 1024px) {
          .user-badge {
            display: block !important;
          }
        }
        body {
          overflow-x: hidden !important;
          width: 100% !important;
        }
      `}</style>
    </>
  );
}