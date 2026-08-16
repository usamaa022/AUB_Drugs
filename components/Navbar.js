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
  const dropdownTimeoutRef = useRef(null);

  // Fetch Role & Permissions from Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          setUserRole(data.role || "user");
          setPermissions(data.permissions || {});
          return;
        }

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

  const canAccess = (key) => {
    if (isSuperAdmin) return true;
    return !!permissions[key];
  };

  const canSeeBuying = isSuperAdmin || canAccess("buying_form") || canAccess("buying_history") || canAccess("bought_returns") || canAccess("bought_statement");
  const canSeeSales = isSuperAdmin || canAccess("create_sale") || canAccess("sales_history") || canAccess("detailed_report") || canAccess("sales_returns") || canAccess("sales_statements");
  const canSeeInventory = isSuperAdmin || canAccess("inventory_items") || canAccess("inventory_store") || canAccess("inventory_ledger");
  const canSeePayments = isSuperAdmin || canAccess("sales_payment") || canAccess("buy_payment") || canAccess("sales_ledger");
  const canSeeTransport = isSuperAdmin || canAccess("transport_send") || canAccess("transport_receive") || canAccess("transport_history");
  const canSeeAccounts = isSuperAdmin || canAccess("accounts_pharmacies") || canAccess("accounts_companies");
  const canSeeExpenses = isSuperAdmin || canAccess("expenses") || true;

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
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
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

  // Helper to check if any route in a group is active
  const isGroupActive = (routes) => {
    return routes.some(route => pathname.includes(route));
  };

  // Dropdown item component with active state
  const DropdownItem = ({ href, children, onClick }) => {
    const isActive = pathname === href || pathname.startsWith(href + '/');
    return (
      <Link
        href={href}
        onClick={onClick}
        style={{
          display: "block",
          padding: "0.6rem 1.25rem",
          color: isActive ? "#2563eb" : "#374151",
          textDecoration: "none",
          fontSize: "0.875rem",
          fontWeight: isActive ? 600 : 400,
          backgroundColor: isActive ? "#eff6ff" : "transparent",
          borderLeft: isActive ? "3px solid #2563eb" : "3px solid transparent",
          transition: "all 0.15s ease",
          borderRadius: "0 0.375rem 0.375rem 0",
          margin: "1px 0",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.target.style.backgroundColor = "#f8fafc";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.target.style.backgroundColor = "transparent";
          }
        }}
      >
        {children}
      </Link>
    );
  };

  return (
    <>
      <style jsx global>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .dropdown-animate {
          animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: top center;
        }
        .mobile-dropdown-animate {
          animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .nav-button {
          position: relative;
          transition: all 0.2s ease;
        }
        .nav-button::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 50%;
          width: 0;
          height: 2px;
          background: #3b82f6;
          transition: all 0.3s ease;
          transform: translateX(-50%);
          border-radius: 2px;
        }
        .nav-button:hover::after,
        .nav-button.active::after {
          width: 70%;
        }
        .nav-button.active {
          color: #2563eb !important;
        }
        .dropdown-indicator {
          display: inline-block;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .dropdown-indicator.open {
          transform: rotate(180deg);
        }
        .badge-pulse {
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

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
          backdropFilter: "blur(10px)",
          backgroundColor: "rgba(255, 255, 255, 0.95)",
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
            height: "64px",
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
              gap: "0.25rem",
              flexWrap: "nowrap",
            }}
            className="desktop-nav"
          >
            {/* Buying Dropdown */}
            {canSeeBuying && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('buying')}
                  className={`nav-button ${openDropdown === 'buying' || isGroupActive(['/buying', '/bought', '/Bought_Statement', '/bought_returns']) ? 'active' : ''}`}
                  style={{
                    background: "none",
                    border: "none",
                    color: openDropdown === 'buying' || isGroupActive(['/buying', '/bought', '/Bought_Statement', '/bought_returns']) ? "#2563eb" : "#4b5563",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.5rem 0.875rem",
                    borderRadius: "0.5rem",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                    position: "relative",
                  }}
                  onMouseEnter={() => {
                    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 0 1-8 0"/>
                  </svg>
                  Buying
                  <span className={`dropdown-indicator ${openDropdown === 'buying' ? 'open' : ''}`}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                  {openDropdown === 'buying' && (
                    <span style={{
                      position: 'absolute',
                      bottom: '-6px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#2563eb',
                      borderRadius: '50%',
                      boxShadow: '0 0 12px rgba(37, 99, 235, 0.4)',
                    }} />
                  )}
                </button>
                {openDropdown === 'buying' && (
                  <div 
                    className="dropdown-animate"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      minWidth: "210px",
                      backgroundColor: "#ffffff",
                      borderRadius: "0.75rem",
                      boxShadow: "0 12px 40px -8px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.05)",
                      padding: "0.375rem 0",
                      border: "1px solid #f1f5f9",
                      zIndex: 9999,
                    }}
                    onMouseLeave={() => {
                      dropdownTimeoutRef.current = setTimeout(() => {
                        setOpenDropdown(null);
                      }, 150);
                    }}
                    onMouseEnter={() => {
                      if (dropdownTimeoutRef.current) {
                        clearTimeout(dropdownTimeoutRef.current);
                      }
                    }}
                  >
                    <div style={{ padding: "0.375rem 0.75rem 0.25rem", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Purchasing</span>
                    </div>
                    {canAccess("buying_form") && <DropdownItem href="/buying" onClick={() => setOpenDropdown(null)}>📝 Buying Form</DropdownItem>}
                    {canAccess("buying_history") && <DropdownItem href="/bought" onClick={() => setOpenDropdown(null)}>📋 Buying History</DropdownItem>}
                    {canAccess("bought_returns") && <DropdownItem href="/bought_returns" onClick={() => setOpenDropdown(null)}>↩️ Bought Returns</DropdownItem>}
                    {canAccess("bought_statement") && <DropdownItem href="/Bought_Statement" onClick={() => setOpenDropdown(null)}>📊 Bought Statement</DropdownItem>}
                  </div>
                )}
              </div>
            )}

            {/* Sales Dropdown */}
            {canSeeSales && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('sales')}
                  className={`nav-button ${openDropdown === 'sales' || isGroupActive(['/selling', '/sold', '/return', '/statements']) ? 'active' : ''}`}
                  style={{
                    background: "none",
                    border: "none",
                    color: openDropdown === 'sales' || isGroupActive(['/selling', '/sold', '/return', '/statements']) ? "#2563eb" : "#4b5563",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.5rem 0.875rem",
                    borderRadius: "0.5rem",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                    position: "relative",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  Sales
                  <span className={`dropdown-indicator ${openDropdown === 'sales' ? 'open' : ''}`}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                  {openDropdown === 'sales' && (
                    <span style={{
                      position: 'absolute',
                      bottom: '-6px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#2563eb',
                      borderRadius: '50%',
                      boxShadow: '0 0 12px rgba(37, 99, 235, 0.4)',
                    }} />
                  )}
                </button>
                {openDropdown === 'sales' && (
                  <div 
                    className="dropdown-animate"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      minWidth: "210px",
                      backgroundColor: "#ffffff",
                      borderRadius: "0.75rem",
                      boxShadow: "0 12px 40px -8px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.05)",
                      padding: "0.375rem 0",
                      border: "1px solid #f1f5f9",
                      zIndex: 9999,
                    }}
                  >
                    <div style={{ padding: "0.375rem 0.75rem 0.25rem", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Selling</span>
                    </div>
                    {canAccess("create_sale") && <DropdownItem href="/selling" onClick={() => setOpenDropdown(null)}>🛒 Create Sale</DropdownItem>}
                    {canAccess("sales_history") && <DropdownItem href="/sold" onClick={() => setOpenDropdown(null)}>📋 Sales History</DropdownItem>}
                    {canAccess("detailed_report") && <DropdownItem href="/sold/detailed-report" onClick={() => setOpenDropdown(null)}>📊 Detailed Report</DropdownItem>}
                    {canAccess("sales_returns") && <DropdownItem href="/return" onClick={() => setOpenDropdown(null)}>↩️ Returns</DropdownItem>}
                    <div style={{ borderTop: "1px solid #f1f5f9", margin: "0.25rem 0.75rem" }} />
                    {canAccess("sales_statements") && <DropdownItem href="/statements" onClick={() => setOpenDropdown(null)}>📄 Statements</DropdownItem>}
                  </div>
                )}
              </div>
            )}

            {/* Inventory Dropdown */}
            {canSeeInventory && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('inventory')}
                  className={`nav-button ${openDropdown === 'inventory' || isGroupActive(['/items', '/store', '/inventory_ledger']) ? 'active' : ''}`}
                  style={{
                    background: "none",
                    border: "none",
                    color: openDropdown === 'inventory' || isGroupActive(['/items', '/store', '/inventory_ledger']) ? "#2563eb" : "#4b5563",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.5rem 0.875rem",
                    borderRadius: "0.5rem",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                    position: "relative",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                  Inventory
                  <span className={`dropdown-indicator ${openDropdown === 'inventory' ? 'open' : ''}`}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                  {openDropdown === 'inventory' && (
                    <span style={{
                      position: 'absolute',
                      bottom: '-6px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#2563eb',
                      borderRadius: '50%',
                      boxShadow: '0 0 12px rgba(37, 99, 235, 0.4)',
                    }} />
                  )}
                </button>
                {openDropdown === 'inventory' && (
                  <div 
                    className="dropdown-animate"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      minWidth: "210px",
                      backgroundColor: "#ffffff",
                      borderRadius: "0.75rem",
                      boxShadow: "0 12px 40px -8px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.05)",
                      padding: "0.375rem 0",
                      border: "1px solid #f1f5f9",
                      zIndex: 9999,
                    }}
                  >
                    <div style={{ padding: "0.375rem 0.75rem 0.25rem", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Stock Management</span>
                    </div>
                    {canAccess("inventory_items") && <DropdownItem href="/items" onClick={() => setOpenDropdown(null)}>📦 Items</DropdownItem>}
                    {canAccess("inventory_store") && <DropdownItem href="/store" onClick={() => setOpenDropdown(null)}>🏪 Store</DropdownItem>}
                    {canAccess("inventory_ledger") && <DropdownItem href="/inventory_ledger" onClick={() => setOpenDropdown(null)}>📒 Ledger</DropdownItem>}
                  </div>
                )}
              </div>
            )}

            {/* Payments Dropdown */}
            {canSeePayments && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('payments')}
                  className={`nav-button ${openDropdown === 'payments' || isGroupActive(['/payments', '/bought_payments', '/sales_ledger']) ? 'active' : ''}`}
                  style={{
                    background: "none",
                    border: "none",
                    color: openDropdown === 'payments' || isGroupActive(['/payments', '/bought_payments', '/sales_ledger']) ? "#2563eb" : "#4b5563",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.5rem 0.875rem",
                    borderRadius: "0.5rem",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                    position: "relative",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                    <line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                  Payments
                  <span className={`dropdown-indicator ${openDropdown === 'payments' ? 'open' : ''}`}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                  {openDropdown === 'payments' && (
                    <span style={{
                      position: 'absolute',
                      bottom: '-6px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#2563eb',
                      borderRadius: '50%',
                      boxShadow: '0 0 12px rgba(37, 99, 235, 0.4)',
                    }} />
                  )}
                </button>
                {openDropdown === 'payments' && (
                  <div 
                    className="dropdown-animate"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      minWidth: "210px",
                      backgroundColor: "#ffffff",
                      borderRadius: "0.75rem",
                      boxShadow: "0 12px 40px -8px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.05)",
                      padding: "0.375rem 0",
                      border: "1px solid #f1f5f9",
                      zIndex: 9999,
                    }}
                  >
                    <div style={{ padding: "0.375rem 0.75rem 0.25rem", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Financial Transactions</span>
                    </div>
                    {canAccess("sales_payment") && <DropdownItem href="/payments/create" onClick={() => setOpenDropdown(null)}>💰 Sales Payment</DropdownItem>}
                    {canAccess("buy_payment") && <DropdownItem href="/bought_payments/" onClick={() => setOpenDropdown(null)}>💳 Buy Payment</DropdownItem>}
                    {canAccess("sales_ledger") && <DropdownItem href="/sales_ledger/" onClick={() => setOpenDropdown(null)}>📊 Sales Ledger</DropdownItem>}
                  </div>
                )}
              </div>
            )}

            {/* Transport Dropdown */}
            {canSeeTransport && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('transport')}
                  className={`nav-button ${openDropdown === 'transport' || isGroupActive(['/transport']) ? 'active' : ''}`}
                  style={{
                    background: "none",
                    border: "none",
                    color: openDropdown === 'transport' || isGroupActive(['/transport']) ? "#2563eb" : "#4b5563",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.5rem 0.875rem",
                    borderRadius: "0.5rem",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                    position: "relative",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13" rx="2"/>
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                    <circle cx="5.5" cy="18" r="2.5"/>
                    <circle cx="18.5" cy="18" r="2.5"/>
                  </svg>
                  Transport
                  <span className={`dropdown-indicator ${openDropdown === 'transport' ? 'open' : ''}`}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                  {openDropdown === 'transport' && (
                    <span style={{
                      position: 'absolute',
                      bottom: '-6px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#2563eb',
                      borderRadius: '50%',
                      boxShadow: '0 0 12px rgba(37, 99, 235, 0.4)',
                    }} />
                  )}
                </button>
                {openDropdown === 'transport' && (
                  <div 
                    className="dropdown-animate"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      minWidth: "210px",
                      backgroundColor: "#ffffff",
                      borderRadius: "0.75rem",
                      boxShadow: "0 12px 40px -8px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.05)",
                      padding: "0.375rem 0",
                      border: "1px solid #f1f5f9",
                      zIndex: 9999,
                    }}
                  >
                    <div style={{ padding: "0.375rem 0.75rem 0.25rem", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Logistics</span>
                    </div>
                    {canAccess("transport_send") && <DropdownItem href="/transport/send" onClick={() => setOpenDropdown(null)}>📤 Send Transport</DropdownItem>}
                    {canAccess("transport_receive") && <DropdownItem href="/transport/receive" onClick={() => setOpenDropdown(null)}>📥 Receive Transport</DropdownItem>}
                    {canAccess("transport_history") && <DropdownItem href="/transport/transportHistory" onClick={() => setOpenDropdown(null)}>📋 Transport History</DropdownItem>}
                    {canAccess("transport_missing") && <DropdownItem href="/transport/missing" onClick={() => setOpenDropdown(null)}>🔍 Missing Items</DropdownItem>}
                  </div>
                )}
              </div>
            )}

            {/* Expenses Dropdown */}
            {canSeeExpenses && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('expenses')}
                  className={`nav-button ${openDropdown === 'expenses' || isGroupActive(['/expenses']) ? 'active' : ''}`}
                  style={{
                    background: "none",
                    border: "none",
                    color: openDropdown === 'expenses' || isGroupActive(['/expenses']) ? "#2563eb" : "#4b5563",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.5rem 0.875rem",
                    borderRadius: "0.5rem",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                    position: "relative",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Expenses
                  <span className={`dropdown-indicator ${openDropdown === 'expenses' ? 'open' : ''}`}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                  {openDropdown === 'expenses' && (
                    <span style={{
                      position: 'absolute',
                      bottom: '-6px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#2563eb',
                      borderRadius: '50%',
                      boxShadow: '0 0 12px rgba(37, 99, 235, 0.4)',
                    }} />
                  )}
                </button>
                {openDropdown === 'expenses' && (
                  <div 
                    className="dropdown-animate"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      minWidth: "210px",
                      backgroundColor: "#ffffff",
                      borderRadius: "0.75rem",
                      boxShadow: "0 12px 40px -8px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.05)",
                      padding: "0.375rem 0",
                      border: "1px solid #f1f5f9",
                      zIndex: 9999,
                    }}
                  >
                    <div style={{ padding: "0.375rem 0.75rem 0.25rem", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cost Tracking</span>
                    </div>
                    <DropdownItem href="/expenses" onClick={() => setOpenDropdown(null)}>🏷️ Store Expenses</DropdownItem>
                  </div>
                )}
              </div>
            )}

            {/* Accounts Dropdown */}
            {canSeeAccounts && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('accounts')}
                  className={`nav-button ${openDropdown === 'accounts' || isGroupActive(['/companies', '/pharmacies']) ? 'active' : ''}`}
                  style={{
                    background: "none",
                    border: "none",
                    color: openDropdown === 'accounts' || isGroupActive(['/companies', '/pharmacies']) ? "#2563eb" : "#4b5563",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.5rem 0.875rem",
                    borderRadius: "0.5rem",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                    position: "relative",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Accounts
                  <span className={`dropdown-indicator ${openDropdown === 'accounts' ? 'open' : ''}`}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                  {openDropdown === 'accounts' && (
                    <span style={{
                      position: 'absolute',
                      bottom: '-6px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#2563eb',
                      borderRadius: '50%',
                      boxShadow: '0 0 12px rgba(37, 99, 235, 0.4)',
                    }} />
                  )}
                </button>
                {openDropdown === 'accounts' && (
                  <div 
                    className="dropdown-animate"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      minWidth: "210px",
                      backgroundColor: "#ffffff",
                      borderRadius: "0.75rem",
                      boxShadow: "0 12px 40px -8px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.05)",
                      padding: "0.375rem 0",
                      border: "1px solid #f1f5f9",
                      zIndex: 9999,
                    }}
                  >
                    <div style={{ padding: "0.375rem 0.75rem 0.25rem", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Partners</span>
                    </div>
                    {canAccess("accounts_pharmacies") && <DropdownItem href="/pharmacies" onClick={() => setOpenDropdown(null)}>🏥 Pharmacies</DropdownItem>}
                    {canAccess("accounts_companies") && <DropdownItem href="/companies" onClick={() => setOpenDropdown(null)}>🏢 Companies</DropdownItem>}
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
                  border: "1px solid #e2e8f0",
                  padding: "0.35rem 0.75rem",
                  borderRadius: "9999px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#94a3b8";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
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
                    fontWeight: 500,
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
                    transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
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
                  className="dropdown-animate"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    width: "260px",
                    backgroundColor: "#ffffff",
                    borderRadius: "0.75rem",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 12px 40px -8px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.05)",
                    zIndex: 9999,
                    padding: "0.75rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem" }}>
                    <p style={{ margin: 0, fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Logged in as
                    </p>
                    <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem", color: "#0f172a", fontWeight: 700, wordBreak: "break-all" }}>
                      {user?.email}
                    </p>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: "0.375rem",
                        padding: "0.15rem 0.6rem",
                        borderRadius: "9999px",
                        fontSize: "0.65rem",
                        fontWeight: "700",
                        backgroundColor: isSuperAdmin ? "#f3e8ff" : isAdmin ? "#dbeafe" : "#d1fae5",
                        color: isSuperAdmin ? "#7c3aed" : isAdmin ? "#1e40af" : "#065f46",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
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
                      gap: "0.75rem",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.375rem",
                      color: "#334155",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      textDecoration: "none",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <span style={{ fontSize: "1.1rem" }}>👤</span> Account Settings
                  </Link>

                  {isSuperAdmin && (
                    <Link
                      href="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.375rem",
                        color: "#2563eb",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        backgroundColor: "#eff6ff",
                        textDecoration: "none",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#dbeafe"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#eff6ff"}
                    >
                      <span style={{ fontSize: "1.1rem" }}>🛡️</span> Control Center
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
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#fee2e2";
                      e.currentTarget.style.borderColor = "#fca5a5";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#fef2f2";
                      e.currentTarget.style.borderColor = "#fecaca";
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
                padding: "8px",
                alignItems: "center",
                justifyContent: "center",
                color: "#4b5563",
                borderRadius: "8px",
                transition: "background 0.2s ease",
              }}
              className="mobile-toggle"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f1f5f9"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
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
            top: "64px",
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
                background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
                border: "1px solid #e2e8f0",
                borderRadius: "0.75rem",
                padding: "0.875rem",
                marginBottom: "1.25rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #2563eb, #7c3aed)",
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
                    padding: "0.1rem 0.6rem",
                    borderRadius: "4px",
                    fontSize: "0.65rem",
                    fontWeight: "700",
                    backgroundColor: isSuperAdmin ? "#f3e8ff" : isAdmin ? "#dbeafe" : "#d1fae5",
                    color: isSuperAdmin ? "#7c3aed" : isAdmin ? "#1e40af" : "#065f46",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  {userRole || "User"}
                </span>
              </div>
            </div>
          )}

          {/* Mobile Menu Items */}
          {canSeeBuying && (
            <div style={{ marginBottom: "0.25rem" }}>
              <button 
                onClick={() => toggleDropdown('m-buying')} 
                style={{ 
                  background: "none", 
                  border: "none", 
                  color: "#1e293b", 
                  fontSize: "0.9375rem", 
                  fontWeight: 600, 
                  width: "100%", 
                  textAlign: "left", 
                  padding: "0.625rem 0", 
                  display: "flex", 
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: openDropdown === 'm-buying' ? "2px solid #2563eb" : "2px solid transparent",
                  transition: "border-color 0.2s ease",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 0 1-8 0"/>
                  </svg>
                  Buying
                </span>
                <span className={`dropdown-indicator ${openDropdown === 'm-buying' ? 'open' : ''}`}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              {openDropdown === 'm-buying' && (
                <div className="mobile-dropdown-animate" style={{ paddingLeft: "1rem", marginTop: "0.25rem" }}>
                  {canAccess("buying_form") && <Link href="/buying" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/buying" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/buying" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>📝 Buying Form</Link>}
                  {canAccess("buying_history") && <Link href="/bought" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/bought" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/bought" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>📋 Buying History</Link>}
                  {canAccess("bought_returns") && <Link href="/bought_returns" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/bought_returns" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/bought_returns" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>↩️ Bought Returns</Link>}
                  {canAccess("bought_statement") && <Link href="/Bought_Statement" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/Bought_Statement" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/Bought_Statement" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>📊 Bought Statement</Link>}
                </div>
              )}
            </div>
          )}

          {canSeeSales && (
            <div style={{ marginBottom: "0.25rem" }}>
              <button onClick={() => toggleDropdown('m-sales')} style={{ background: "none", border: "none", color: "#1e293b", fontSize: "0.9375rem", fontWeight: 600, width: "100%", textAlign: "left", padding: "0.625rem 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: openDropdown === 'm-sales' ? "2px solid #2563eb" : "2px solid transparent", transition: "border-color 0.2s ease" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  Sales
                </span>
                <span className={`dropdown-indicator ${openDropdown === 'm-sales' ? 'open' : ''}`}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              {openDropdown === 'm-sales' && (
                <div className="mobile-dropdown-animate" style={{ paddingLeft: "1rem", marginTop: "0.25rem" }}>
                  {canAccess("create_sale") && <Link href="/selling" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/selling" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/selling" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>🛒 Create Sale</Link>}
                  {canAccess("sales_history") && <Link href="/sold" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/sold" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/sold" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>📋 Sales History</Link>}
                  {canAccess("detailed_report") && <Link href="/sold/detailed-report" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/sold/detailed-report" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/sold/detailed-report" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>📊 Detailed Report</Link>}
                  {canAccess("sales_returns") && <Link href="/return" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/return" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/return" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>↩️ Returns</Link>}
                  {canAccess("sales_statements") && <Link href="/statements" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/statements" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/statements" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>📄 Statements</Link>}
                </div>
              )}
            </div>
          )}

          {canSeeInventory && (
            <div style={{ marginBottom: "0.25rem" }}>
              <button onClick={() => toggleDropdown('m-inventory')} style={{ background: "none", border: "none", color: "#1e293b", fontSize: "0.9375rem", fontWeight: 600, width: "100%", textAlign: "left", padding: "0.625rem 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: openDropdown === 'm-inventory' ? "2px solid #2563eb" : "2px solid transparent", transition: "border-color 0.2s ease" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                  Inventory
                </span>
                <span className={`dropdown-indicator ${openDropdown === 'm-inventory' ? 'open' : ''}`}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              {openDropdown === 'm-inventory' && (
                <div className="mobile-dropdown-animate" style={{ paddingLeft: "1rem", marginTop: "0.25rem" }}>
                  {canAccess("inventory_items") && <Link href="/items" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/items" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/items" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>📦 Items</Link>}
                  {canAccess("inventory_store") && <Link href="/store" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/store" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/store" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>🏪 Store</Link>}
                  {canAccess("inventory_ledger") && <Link href="/inventory_ledger" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/inventory_ledger" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/inventory_ledger" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>📒 Ledger</Link>}
                </div>
              )}
            </div>
          )}

          {canSeePayments && (
            <div style={{ marginBottom: "0.25rem" }}>
              <button onClick={() => toggleDropdown('m-payments')} style={{ background: "none", border: "none", color: "#1e293b", fontSize: "0.9375rem", fontWeight: 600, width: "100%", textAlign: "left", padding: "0.625rem 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: openDropdown === 'm-payments' ? "2px solid #2563eb" : "2px solid transparent", transition: "border-color 0.2s ease" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                    <line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                  Payments
                </span>
                <span className={`dropdown-indicator ${openDropdown === 'm-payments' ? 'open' : ''}`}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              {openDropdown === 'm-payments' && (
                <div className="mobile-dropdown-animate" style={{ paddingLeft: "1rem", marginTop: "0.25rem" }}>
                  {canAccess("sales_payment") && <Link href="/payments/create" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/payments/create" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/payments/create" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>💰 Sales Payment</Link>}
                  {canAccess("buy_payment") && <Link href="/bought_payments/" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname.includes("/bought_payments/") ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname.includes("/bought_payments/") ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>💳 Buy Payment</Link>}
                  {canAccess("sales_ledger") && <Link href="/sales_ledger/" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname.includes("/sales_ledger/") ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname.includes("/sales_ledger/") ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>📊 Sales Ledger</Link>}
                </div>
              )}
            </div>
          )}

          {canSeeTransport && (
            <div style={{ marginBottom: "0.25rem" }}>
              <button onClick={() => toggleDropdown('m-transport')} style={{ background: "none", border: "none", color: "#1e293b", fontSize: "0.9375rem", fontWeight: 600, width: "100%", textAlign: "left", padding: "0.625rem 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: openDropdown === 'm-transport' ? "2px solid #2563eb" : "2px solid transparent", transition: "border-color 0.2s ease" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13" rx="2"/>
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                    <circle cx="5.5" cy="18" r="2.5"/>
                    <circle cx="18.5" cy="18" r="2.5"/>
                  </svg>
                  Transport
                </span>
                <span className={`dropdown-indicator ${openDropdown === 'm-transport' ? 'open' : ''}`}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              {openDropdown === 'm-transport' && (
                <div className="mobile-dropdown-animate" style={{ paddingLeft: "1rem", marginTop: "0.25rem" }}>
                  {canAccess("transport_send") && <Link href="/transport/send" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/transport/send" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/transport/send" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>📤 Send Transport</Link>}
                  {canAccess("transport_receive") && <Link href="/transport/receive" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/transport/receive" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/transport/receive" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>📥 Receive Transport</Link>}
                  {canAccess("transport_history") && <Link href="/transport/transportHistory" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/transport/transportHistory" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/transport/transportHistory" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>📋 Transport History</Link>}
                  {canAccess("transport_missing") && <Link href="/transport/missing" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/transport/missing" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/transport/missing" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>🔍 Missing Items</Link>}
                </div>
              )}
            </div>
          )}

          {canSeeExpenses && (
            <div style={{ marginBottom: "0.25rem" }}>
              <button onClick={() => toggleDropdown('m-expenses')} style={{ background: "none", border: "none", color: "#1e293b", fontSize: "0.9375rem", fontWeight: 600, width: "100%", textAlign: "left", padding: "0.625rem 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: openDropdown === 'm-expenses' ? "2px solid #2563eb" : "2px solid transparent", transition: "border-color 0.2s ease" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Expenses
                </span>
                <span className={`dropdown-indicator ${openDropdown === 'm-expenses' ? 'open' : ''}`}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              {openDropdown === 'm-expenses' && (
                <div className="mobile-dropdown-animate" style={{ paddingLeft: "1rem", marginTop: "0.25rem" }}>
                  <Link href="/expenses" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/expenses" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/expenses" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>🏷️ Store Expenses</Link>
                </div>
              )}
            </div>
          )}

          {canSeeAccounts && (
            <div style={{ marginBottom: "0.25rem" }}>
              <button onClick={() => toggleDropdown('m-accounts')} style={{ background: "none", border: "none", color: "#1e293b", fontSize: "0.9375rem", fontWeight: 600, width: "100%", textAlign: "left", padding: "0.625rem 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: openDropdown === 'm-accounts' ? "2px solid #2563eb" : "2px solid transparent", transition: "border-color 0.2s ease" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Accounts
                </span>
                <span className={`dropdown-indicator ${openDropdown === 'm-accounts' ? 'open' : ''}`}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              {openDropdown === 'm-accounts' && (
                <div className="mobile-dropdown-animate" style={{ paddingLeft: "1rem", marginTop: "0.25rem" }}>
                  {canAccess("accounts_pharmacies") && <Link href="/pharmacies" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/pharmacies" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/pharmacies" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>🏥 Pharmacies</Link>}
                  {canAccess("accounts_companies") && <Link href="/companies" style={{ display: "block", padding: "0.4rem 0.5rem", color: pathname === "/companies" ? "#2563eb" : "#475569", textDecoration: "none", fontSize: "0.875rem", borderLeft: pathname === "/companies" ? "3px solid #2563eb" : "3px solid transparent", paddingLeft: "0.75rem" }} onClick={closeMobileMenu}>🏢 Companies</Link>}
                </div>
              )}
            </div>
          )}

          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "0.875rem", marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Link href="/users" onClick={closeMobileMenu} style={{ display: "block", padding: "0.625rem", borderRadius: "0.375rem", color: "#334155", fontWeight: 600, backgroundColor: "#f8fafc", textAlign: "center", textDecoration: "none", transition: "background 0.15s ease" }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f1f5f9"} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"}>
              👤 Account Settings
            </Link>

            {isSuperAdmin && (
              <Link href="/settings" onClick={closeMobileMenu} style={{ display: "block", padding: "0.625rem", borderRadius: "0.375rem", color: "#2563eb", fontWeight: 600, backgroundColor: "#eff6ff", textAlign: "center", textDecoration: "none", transition: "background 0.15s ease" }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#dbeafe"} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#eff6ff"}>
                🛡️ Control Center
              </Link>
            )}

            <button 
              onClick={() => { closeMobileMenu(); handleLogout(); }} 
              style={{ 
                backgroundColor: "#dc2626", 
                color: "#ffffff", 
                border: "none", 
                padding: "0.625rem", 
                borderRadius: "0.375rem", 
                cursor: "pointer", 
                fontWeight: "600", 
                width: "100%",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#b91c1c"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#dc2626"}
            >
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