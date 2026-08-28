"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import {
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingCart,
  Users,
  RefreshCw,
  Search,
  X,
  Calendar,
  DollarSign,
  FileText,
  Activity,
  Filter,
  Building2,
  AlertCircle,
  ShieldAlert,
  Wallet
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line
} from "recharts";

// --- Formatter Utilities ---
const formatCurrency = (amount, currency = "IQD") => {
  const num = Number(amount) || 0;
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(num);
  } else {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "IQD", minimumFractionDigits: 0 }).format(num);
  }
};

const formatNumber = (num) => new Intl.NumberFormat("en-US").format(Number(num) || 0);

const parseDate = (dateVal) => {
  if (!dateVal) return new Date();
  if (dateVal.toDate && typeof dateVal.toDate === 'function') return dateVal.toDate();
  if (dateVal.seconds) return new Date(dateVal.seconds * 1000);
  const parsed = new Date(dateVal);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

// --- Theme ---
const THEME = {
  primary: "#4F46E5",
  admin: "#2563EB",
  superAdmin: "#7C3AED",
  usd: "#2563EB",
  usdLight: "#DBEAFE",
  iqd: "#059669",
  iqdLight: "#D1FAE5",
  expense: "#DC2626",
  expenseLight: "#FEE2E2",
  profit: "#16A34A",
  neutral: "#64748B",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0"
};

// --- Custom WiFi Loader Component ---
const WifiLoader = ({ text = "Loading..." }) => {
  return (
    <div id="wifi-loader">
      <svg viewBox="0 0 86 86" className="circle-outer">
        <circle r="40" cy="43" cx="43" className="back"></circle>
        <circle r="40" cy="43" cx="43" className="front"></circle>
        <circle r="40" cy="43" cx="43" className="new"></circle>
      </svg>
      <svg viewBox="0 0 60 60" className="circle-middle">
        <circle r="27" cy="30" cx="30" className="back"></circle>
        <circle r="27" cy="30" cx="30" className="front"></circle>
      </svg>
      <svg viewBox="0 0 34 34" className="circle-inner">
        <circle r="14" cy="17" cx="17" className="back"></circle>
        <circle r="14" cy="17" cx="17" className="front"></circle>
      </svg>
      <div data-text={text} className="text"></div>
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function DetailedDashboardPage() {
  const router = useRouter();

  // --- State ---
  const [userRole, setUserRole] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("sales");
  const [data, setData] = useState({
    soldBills: [],
    boughtBills: [],
    storeItems: [],
  });

  const [filters, setFilters] = useState({
    dateRange: "month",
    selectedMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    selectedYear: new Date().getFullYear(),
    currency: "all",
    paymentStatus: "all",
    searchQuery: "",
  });

  const [refreshKey, setRefreshKey] = useState(0);

  // --- RBAC Logic ---
  const normalizedRole = (userRole || "").toLowerCase();
  const isSuperAdmin = normalizedRole === "superadmin" || normalizedRole === "super_admin";
  const isAdmin = normalizedRole === "admin";
  const canViewAll = isSuperAdmin || isAdmin;

  // --- Auth Guard & Role Fetching ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          setUserRole(userDocSnap.data().role || "user");
        } else {
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
        console.error("Error fetching user role:", error);
        setUserRole("user");
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // --- Data Fetching ---
  const fetchData = async () => {
    setDataLoading(true);
    try {
      const [soldSnap, boughtSnap, storeSnap] = await Promise.all([
        getDocs(collection(db, "soldBills")),
        canViewAll ? getDocs(collection(db, "boughtBills")) : Promise.resolve({ docs: [] }),
        canViewAll ? getDocs(collection(db, "storeItems")) : Promise.resolve({ docs: [] })
      ]);

      setData({
        soldBills: soldSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        boughtBills: boughtSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        storeItems: storeSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      });
    } catch (error) {
      console.error("Dashboard Fetch Error:", error);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [refreshKey, canViewAll, authLoading]);

  // --- Master Filter Engine ---
  const { filteredSold, filteredBought, filteredStore } = useMemo(() => {
    const { dateRange, selectedMonth, selectedYear, currency, paymentStatus, searchQuery } = filters;
    const [year, month] = selectedMonth.split("-").map(Number);
    const targetYear = dateRange === "year" ? selectedYear : year;
    const targetMonth = dateRange === "month" ? month - 1 : undefined;
    const queryStr = searchQuery.toLowerCase();

    const applyFilters = (bill, isStoreItem = false) => {
      if (queryStr) {
        const matchName = (bill.pharmacyName || bill.companyName || bill.name || "").toLowerCase().includes(queryStr);
        const matchNum = String(bill.billNumber || bill.barcode || "").includes(queryStr);
        const matchItems = !isStoreItem && bill.items?.some(i => i.name?.toLowerCase().includes(queryStr));
        if (!matchName && !matchNum && !matchItems) return false;
      }

      if (isStoreItem) {
        if (currency !== "all" && bill.priceType !== currency && bill.originalCurrency !== currency) return false;
        return true;
      }

      const bDate = parseDate(bill.date);
      if (dateRange === "month" && (bDate.getFullYear() !== targetYear || bDate.getMonth() !== targetMonth)) return false;
      if (dateRange === "year" && bDate.getFullYear() !== targetYear) return false;

      if (currency !== "all" && bill.currency !== currency) return false;
      if (paymentStatus !== "all" && bill.paymentStatus !== paymentStatus) return false;

      return true;
    };

    return {
      filteredSold: data.soldBills.filter(b => applyFilters(b)),
      filteredBought: data.boughtBills.filter(b => applyFilters(b)),
      filteredStore: data.storeItems.filter(i => applyFilters(i, true)),
    };
  }, [data, filters]);

  // --- Deep Metrics Processing ---
  const metrics = useMemo(() => {
    const m = {
      sales: { usd: 0, iqd: 0, count: filteredSold.length, itemsSold: 0, unpaidUsd: 0, unpaidIqd: 0 },
      purchases: { usd: 0, iqd: 0, count: filteredBought.length, itemsBought: 0, unpaidUsd: 0, unpaidIqd: 0 },
      profit: { usd: 0, iqd: 0 },
      inventoryValue: { usd: 0, iqd: 0 },
      topSoldProducts: {},
      topClients: {},
      topSuppliers: {}
    };

    filteredSold.forEach(bill => {
      const isUnpaid = bill.paymentStatus !== "Paid";
      m.sales.usd += bill.totalAmountUSD || 0;
      m.sales.iqd += bill.totalAmountIQD || 0;

      if (isUnpaid) {
        m.sales.unpaidUsd += bill.totalAmountUSD || 0;
        m.sales.unpaidIqd += bill.totalAmountIQD || 0;
      }

      const clientName = bill.pharmacyName || "Walk-in";
      if (!m.topClients[clientName]) m.topClients[clientName] = { name: clientName, usd: 0, iqd: 0, count: 0 };
      m.topClients[clientName].usd += bill.totalAmountUSD || 0;
      m.topClients[clientName].iqd += bill.totalAmountIQD || 0;
      m.topClients[clientName].count += 1;

      bill.items?.forEach(item => {
        const qty = Number(item.quantity) || 0;
        m.sales.itemsSold += qty;
        const pName = item.name || "Unknown";

        const costUsd = (Number(item.basePriceUSD) || 0) * qty;
        const costIqd = (Number(item.basePriceIQD) || 0) * qty;
        const revUsd = (Number(item.outPriceUSD) || Number(item.price) || 0) * qty;
        const revIqd = (Number(item.outPriceIQD) || Number(item.price) || 0) * qty;

        if (canViewAll) {
          m.profit.usd += (revUsd - costUsd);
          m.profit.iqd += (revIqd - costIqd);
        }

        if (!m.topSoldProducts[pName]) m.topSoldProducts[pName] = { name: pName, usd: 0, iqd: 0, qty: 0 };
        m.topSoldProducts[pName].usd += revUsd;
        m.topSoldProducts[pName].iqd += revIqd;
        m.topSoldProducts[pName].qty += qty;
      });
    });

    if (canViewAll) {
      filteredBought.forEach(bill => {
        const isUnpaid = bill.paymentStatus !== "Paid";
        let bUsd = 0, bIqd = 0;

        bill.items?.forEach(item => {
          const qty = Number(item.quantity) || 0;
          m.purchases.itemsBought += qty;
          const costUsd = (Number(item.basePriceUSD) || Number(item.price) || 0) * qty;
          const costIqd = (Number(item.basePriceIQD) || Number(item.price) || 0) * qty;
          bUsd += costUsd;
          bIqd += costIqd;
        });

        m.purchases.usd += bUsd;
        m.purchases.iqd += bIqd;

        if (isUnpaid) {
          m.purchases.unpaidUsd += bUsd;
          m.purchases.unpaidIqd += bIqd;
        }

        const supName = bill.companyName || "Unknown Supplier";
        if (!m.topSuppliers[supName]) m.topSuppliers[supName] = { name: supName, usd: 0, iqd: 0, count: 0 };
        m.topSuppliers[supName].usd += bUsd;
        m.topSuppliers[supName].iqd += bIqd;
        m.topSuppliers[supName].count += 1;
      });

      filteredStore.forEach(item => {
        const qty = Number(item.quantity) || 0;
        m.inventoryValue.usd += (Number(item.netPriceUSD) || 0) * qty;
        m.inventoryValue.iqd += (Number(item.netPriceIQD) || 0) * qty;
      });
    }

    return {
      ...m,
      topSoldProducts: Object.values(m.topSoldProducts).sort((a, b) => b.qty - a.qty).slice(0, 10),
      topClients: Object.values(m.topClients).sort((a, b) => b.usd - a.usd).slice(0, 5),
      topSuppliers: Object.values(m.topSuppliers).sort((a, b) => b.usd - a.usd).slice(0, 5)
    };
  }, [filteredSold, filteredBought, filteredStore, canViewAll]);

  // --- Chart Data Generators ---
  const timelineData = useMemo(() => {
    const { dateRange, selectedMonth, selectedYear } = filters;
    const [year, month] = selectedMonth.split("-").map(Number);
    const targetYear = dateRange === "year" ? selectedYear : year;

    let dataPoints = [];
    if (dateRange === "year") {
      dataPoints = Array(12).fill().map((_, i) => ({
        label: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
        salesUSD: 0, salesIQD: 0, purchasesUSD: 0, purchasesIQD: 0, profitUSD: 0
      }));

      const processBill = (bill, isSale) => {
        const d = parseDate(bill.date);
        const mIdx = d.getMonth();
        if (d.getFullYear() !== targetYear) return;

        bill.items?.forEach(item => {
          const qty = Number(item.quantity) || 0;
          if (isSale) {
            const rUsd = (Number(item.outPriceUSD) || 0) * qty;
            dataPoints[mIdx].salesUSD += rUsd;
            dataPoints[mIdx].salesIQD += (Number(item.outPriceIQD) || 0) * qty;
            dataPoints[mIdx].profitUSD += rUsd - ((Number(item.basePriceUSD) || 0) * qty);
          } else {
            dataPoints[mIdx].purchasesUSD += (Number(item.basePriceUSD) || Number(item.price) || 0) * qty;
            dataPoints[mIdx].purchasesIQD += (Number(item.basePriceIQD) || Number(item.price) || 0) * qty;
          }
        });
      };

      filteredSold.forEach(b => processBill(b, true));
      if (canViewAll) filteredBought.forEach(b => processBill(b, false));

    } else {
      const daysInMonth = new Date(targetYear, month, 0).getDate();
      dataPoints = Array(daysInMonth).fill().map((_, i) => ({
        label: `${i + 1}`,
        salesUSD: 0, salesIQD: 0, purchasesUSD: 0, purchasesIQD: 0, profitUSD: 0
      }));

      const processBillDay = (bill, isSale) => {
        const d = parseDate(bill.date);
        const dIdx = d.getDate() - 1;

        bill.items?.forEach(item => {
          const qty = Number(item.quantity) || 0;
          if (isSale) {
            const rUsd = (Number(item.outPriceUSD) || 0) * qty;
            dataPoints[dIdx].salesUSD += rUsd;
            dataPoints[dIdx].salesIQD += (Number(item.outPriceIQD) || 0) * qty;
            dataPoints[dIdx].profitUSD += rUsd - ((Number(item.basePriceUSD) || 0) * qty);
          } else {
            dataPoints[dIdx].purchasesUSD += (Number(item.basePriceUSD) || Number(item.price) || 0) * qty;
            dataPoints[dIdx].purchasesIQD += (Number(item.basePriceIQD) || Number(item.price) || 0) * qty;
          }
        });
      };

      filteredSold.forEach(b => processBillDay(b, true));
      if (canViewAll) filteredBought.forEach(b => processBillDay(b, false));
    }
    return dataPoints;
  }, [filteredSold, filteredBought, filters, canViewAll]);

  // --- Loader Screen ---
  if (authLoading || dataLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: THEME.bg }}>
        <style dangerouslySetInnerHTML={{ __html: loaderStyles }} />
        <WifiLoader text={authLoading ? "Authenticating..." : "Compiling Data..."} />
      </div>
    );
  }

  const Card = ({ children, className = "", style = {} }) => (
    <div className={className} style={{ background: THEME.card, borderRadius: "0.75rem", border: `1px solid ${THEME.border}`, padding: "1.25rem", ...style }}>
      {children}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: THEME.bg, fontFamily: "system-ui, sans-serif", paddingBottom: "4rem" }}>
      
      {/* INJECTED CSS STYLES (UI + WiFi Loader) */}
      <style dangerouslySetInnerHTML={{ __html: `
        ${loaderStyles}

        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .main-container { max-width: 1600px; margin: 1.5rem auto; padding: 0 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
        .header-wrap { display: flex; justify-content: space-between; align-items: center; }
        .filter-wrap { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; background: ${THEME.bg}; padding: 0.5rem; border-radius: 0.5rem; border: 1px solid ${THEME.border}; }
        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
        .chart-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; }
        .card-wrapper { min-width: 0; }
        .table-responsive { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        
        @media (max-width: 768px) {
          .main-container { padding: 0 0.5rem; margin: 1rem auto; gap: 1rem; }
          .header-wrap { flex-direction: column; align-items: flex-start; gap: 1rem; }
          .sync-btn { width: 100%; justify-content: center; }
          .filter-wrap { flex-direction: row; flex-wrap: nowrap; overflow-x: auto; padding-bottom: 0.75rem; -webkit-overflow-scrolling: touch; }
          .filter-wrap select, .filter-wrap input { flex-shrink: 0; min-width: 120px; }
          .search-box { min-width: 250px !important; }
          .chart-grid { grid-template-columns: 1fr; }
          .tabs-wrap { overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; padding-bottom: 5px; }
        }
      `}} />

      {/* HEADER & GLOBAL FILTERS */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${THEME.border}`, padding: "1rem" }}>
        <div style={{ maxWidth: "1600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
          
          <div className="header-wrap">
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ 
                background: isSuperAdmin ? THEME.superAdmin : isAdmin ? THEME.admin : THEME.iqd, 
                padding: "0.5rem", borderRadius: "0.5rem", color: "white" 
              }}>
                {canViewAll ? <ShieldAlert size={20} /> : <Activity size={20} />}
              </div>
              <div>
                <h1 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                  {isSuperAdmin ? "SuperAdmin Command Center" : canViewAll ? "Master Operation Hub" : "Sales Dashboard"}
                </h1>
                <p style={{ color: THEME.neutral, fontSize: "0.75rem", margin: 0, fontWeight: 500 }}>
                  Role: <span style={{ 
                    color: isSuperAdmin ? THEME.superAdmin : isAdmin ? THEME.admin : THEME.iqd,
                    fontWeight: "bold"
                  }}>
                    {(userRole || "USER").toUpperCase()}
                  </span>
                </p>
              </div>
            </div>
            
            <button className="sync-btn" onClick={() => setRefreshKey(k => k + 1)} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", background: THEME.bg, border: `1px solid ${THEME.border}`, borderRadius: "0.5rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: "500" }}>
              <RefreshCw size={16} /> Sync Data
            </button>
          </div>

          <div className="filter-wrap hide-scrollbar">
            <Filter size={16} color={THEME.neutral} style={{ margin: "0 0.5rem", flexShrink: 0 }} />
            
            <select value={filters.dateRange} onChange={(e) => setFilters(f => ({ ...f, dateRange: e.target.value }))} style={{ padding: "0.4rem", borderRadius: "0.375rem", border: `1px solid ${THEME.border}`, fontSize: "0.875rem" }}>
              <option value="month">Month View</option>
              <option value="year">Year View</option>
            </select>

            {filters.dateRange === "month" ? (
              <input type="month" value={filters.selectedMonth} onChange={(e) => setFilters(f => ({ ...f, selectedMonth: e.target.value }))} style={{ padding: "0.4rem", borderRadius: "0.375rem", border: `1px solid ${THEME.border}`, fontSize: "0.875rem" }} />
            ) : (
              <select value={filters.selectedYear} onChange={(e) => setFilters(f => ({ ...f, selectedYear: parseInt(e.target.value) }))} style={{ padding: "0.4rem", borderRadius: "0.375rem", border: `1px solid ${THEME.border}`, fontSize: "0.875rem" }}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}

            <select value={filters.currency} onChange={(e) => setFilters(f => ({ ...f, currency: e.target.value }))} style={{ padding: "0.4rem", borderRadius: "0.375rem", border: `1px solid ${THEME.border}`, fontSize: "0.875rem" }}>
              <option value="all">All Currencies</option>
              <option value="USD">USD Only</option>
              <option value="IQD">IQD Only</option>
            </select>

            <select value={filters.paymentStatus} onChange={(e) => setFilters(f => ({ ...f, paymentStatus: e.target.value }))} style={{ padding: "0.4rem", borderRadius: "0.375rem", border: `1px solid ${THEME.border}`, fontSize: "0.875rem" }}>
              <option value="all">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid / Debt</option>
            </select>

            <div className="search-box" style={{ display: "flex", flex: 1, minWidth: "200px", background: "white", padding: "0.4rem", borderRadius: "0.375rem", border: `1px solid ${THEME.border}`, alignItems: "center" }}>
              <Search size={16} color={THEME.neutral} style={{ marginRight: "0.5rem", flexShrink: 0 }} />
              <input type="text" placeholder="Search invoices, items, or clients..." value={filters.searchQuery} onChange={(e) => setFilters(f => ({ ...f, searchQuery: e.target.value }))} style={{ border: "none", outline: "none", width: "100%", fontSize: "0.875rem", minWidth: 0 }} />
              {filters.searchQuery && <X size={14} color={THEME.expense} cursor="pointer" style={{ flexShrink: 0 }} onClick={() => setFilters(f => ({ ...f, searchQuery: "" }))} />}
            </div>
          </div>

          {/* Contextual Tabs based on Role */}
          <div className="tabs-wrap hide-scrollbar" style={{ display: "flex", gap: "1rem", borderBottom: `2px solid ${THEME.border}` }}>
            {canViewAll && <button onClick={() => setActiveTab("overview")} style={{ background: "none", border: "none", borderBottom: activeTab === "overview" ? `2px solid ${isSuperAdmin ? THEME.superAdmin : THEME.admin}` : "none", color: activeTab === "overview" ? (isSuperAdmin ? THEME.superAdmin : THEME.admin) : THEME.neutral, padding: "0.5rem 0", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Command Center</button>}
            <button onClick={() => setActiveTab("sales")} style={{ background: "none", border: "none", borderBottom: activeTab === "sales" ? `2px solid ${THEME.primary}` : "none", color: activeTab === "sales" ? THEME.primary : THEME.neutral, padding: "0.5rem 0", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Sales & Distribution</button>
            {canViewAll && <button onClick={() => setActiveTab("purchases")} style={{ background: "none", border: "none", borderBottom: activeTab === "purchases" ? `2px solid ${THEME.expense}` : "none", color: activeTab === "purchases" ? THEME.expense : THEME.neutral, padding: "0.5rem 0", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Procurement</button>}
          </div>

        </div>
      </div>

      <div className="main-container">
        
        {/* ==================================================== */}
        {/* TAB: SALES (Visible to All) */}
        {/* ==================================================== */}
        {activeTab === "sales" && (
          <>
            {/* Sales KPIs */}
            <div className="kpi-grid">
              <Card style={{ borderTop: `4px solid ${THEME.usd}` }}>
                <p style={{ margin: 0, fontSize: "0.875rem", color: THEME.neutral, fontWeight: 600 }}>Total Revenue (USD)</p>
                <h2 style={{ margin: "0.5rem 0", fontSize: "1.75rem", color: "#0f172a" }}>{formatCurrency(metrics.sales.usd, "USD")}</h2>
                <p style={{ margin: 0, fontSize: "0.75rem", color: THEME.expense }}>Includes {formatCurrency(metrics.sales.unpaidUsd, "USD")} Unpaid</p>
              </Card>
              <Card style={{ borderTop: `4px solid ${THEME.iqd}` }}>
                <p style={{ margin: 0, fontSize: "0.875rem", color: THEME.neutral, fontWeight: 600 }}>Total Revenue (IQD)</p>
                <h2 style={{ margin: "0.5rem 0", fontSize: "1.75rem", color: "#0f172a" }}>{formatCurrency(metrics.sales.iqd, "IQD")}</h2>
                <p style={{ margin: 0, fontSize: "0.75rem", color: THEME.expense }}>Includes {formatCurrency(metrics.sales.unpaidIqd, "IQD")} Unpaid</p>
              </Card>
              <Card>
                <p style={{ margin: 0, fontSize: "0.875rem", color: THEME.neutral, fontWeight: 600 }}>Sales Volume</p>
                <h2 style={{ margin: "0.5rem 0", fontSize: "1.75rem", color: "#0f172a" }}>{formatNumber(metrics.sales.itemsSold)} Units</h2>
                <p style={{ margin: 0, fontSize: "0.75rem", color: THEME.neutral }}>Across {metrics.sales.count} invoices</p>
              </Card>
            </div>

            {/* Sales Charts & Tables */}
            <div className="chart-grid">
              <Card className="card-wrapper" style={{ minHeight: "350px" }}>
                <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem" }}>Sales Timeline</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="colorSalesUSD" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={THEME.usd} stopOpacity={0.3}/><stop offset="95%" stopColor={THEME.usd} stopOpacity={0}/></linearGradient>
                      <linearGradient id="colorSalesIQD" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={THEME.iqd} stopOpacity={0.3}/><stop offset="95%" stopColor={THEME.iqd} stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={THEME.border} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={v => `$${v/1000}k`} width={50} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} width={50} />
                    <Tooltip formatter={(val, name) => [formatCurrency(val, name.includes('USD') ? 'USD' : 'IQD'), name]} />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="salesUSD" name="Sales USD" stroke={THEME.usd} fill="url(#colorSalesUSD)" strokeWidth={2} />
                    <Area yAxisId="right" type="monotone" dataKey="salesIQD" name="Sales IQD" stroke={THEME.iqd} fill="url(#colorSalesIQD)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card className="card-wrapper">
                <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem" }}>Top Performing Clients</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {metrics.topClients.map((client, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${THEME.border}`, paddingBottom: "0.5rem" }}>
                      <div style={{ minWidth: 0, flex: 1, paddingRight: "10px" }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.name}</p>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: THEME.neutral }}>{client.count} orders</p>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, color: THEME.usd, fontSize: "0.875rem" }}>{formatCurrency(client.usd, "USD")}</p>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: THEME.iqd }}>{formatCurrency(client.iqd, "IQD")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Detailed Products List */}
            <Card className="card-wrapper">
              <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem" }}>Itemized Sales Performance</h3>
              <div className="table-responsive">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", minWidth: "500px" }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${THEME.border}`, color: THEME.neutral, textAlign: "left" }}>
                      <th style={{ padding: "0.75rem" }}>Product Name</th>
                      <th style={{ padding: "0.75rem" }}>Units Dispensed</th>
                      <th style={{ padding: "0.75rem", textAlign: "right" }}>Revenue (USD)</th>
                      <th style={{ padding: "0.75rem", textAlign: "right" }}>Revenue (IQD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.topSoldProducts.map((p, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                        <td style={{ padding: "0.75rem", fontWeight: 500 }}>{p.name}</td>
                        <td style={{ padding: "0.75rem" }}>{formatNumber(p.qty)}</td>
                        <td style={{ padding: "0.75rem", textAlign: "right", color: THEME.usd, fontWeight: 500 }}>{formatCurrency(p.usd, "USD")}</td>
                        <td style={{ padding: "0.75rem", textAlign: "right", color: THEME.iqd, fontWeight: 500 }}>{formatCurrency(p.iqd, "IQD")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* ==================================================== */}
        {/* TAB: COMMAND CENTER / OVERVIEW (Admin Only) */}
        {/* ==================================================== */}
        {canViewAll && activeTab === "overview" && (
          <>
            <div className="kpi-grid">
              <Card style={{ background: isSuperAdmin ? THEME.superAdmin : THEME.admin, color: "white" }}>
                <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.9 }}>Gross Profit (USD)</p>
                <h2 style={{ margin: "0.5rem 0", fontSize: "1.75rem" }}>{formatCurrency(metrics.profit.usd, "USD")}</h2>
                <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.8 }}>From recorded sales</p>
              </Card>
              <Card style={{ background: THEME.profit, color: "white" }}>
                <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.9 }}>Gross Profit (IQD)</p>
                <h2 style={{ margin: "0.5rem 0", fontSize: "1.75rem" }}>{formatCurrency(metrics.profit.iqd, "IQD")}</h2>
                <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.8 }}>From recorded sales</p>
              </Card>
              <Card>
                <p style={{ margin: 0, fontSize: "0.875rem", color: THEME.neutral, fontWeight: 600 }}>Total Warehouse Value</p>
                <h2 style={{ margin: "0.5rem 0", fontSize: "1.5rem", color: "#0f172a" }}>{formatCurrency(metrics.inventoryValue.usd, "USD")}</h2>
                <p style={{ margin: 0, fontSize: "0.75rem", color: THEME.neutral }}>Active Stock Valuation</p>
              </Card>
              <Card>
                <p style={{ margin: 0, fontSize: "0.875rem", color: THEME.neutral, fontWeight: 600 }}>Total Debts / Unpaid</p>
                <h2 style={{ margin: "0.5rem 0", fontSize: "1.5rem", color: THEME.expense }}>{formatCurrency(metrics.purchases.unpaidUsd, "USD")}</h2>
                <p style={{ margin: 0, fontSize: "0.75rem", color: THEME.neutral }}>Outstanding to suppliers</p>
              </Card>
            </div>

            <Card className="card-wrapper" style={{ minHeight: "400px" }}>
              <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem" }}>Cash Flow: Sales vs Procurement vs Profit</h3>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={THEME.border} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={v => `$${v/1000}k`} width={50} />
                  <Tooltip formatter={(val, name) => [formatCurrency(val, 'USD'), name]} />
                  <Legend />
                  <Bar dataKey="salesUSD" name="Revenue" fill={THEME.usd} radius={[4,4,0,0]} />
                  <Bar dataKey="purchasesUSD" name="Expenses/Purchases" fill={THEME.expense} radius={[4,4,0,0]} />
                  <Line type="monotone" dataKey="profitUSD" name="Net Profit Margin" stroke={THEME.profit} strokeWidth={3} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </>
        )}

        {/* ==================================================== */}
        {/* TAB: PURCHASES (Admin Only) */}
        {/* ==================================================== */}
        {canViewAll && activeTab === "purchases" && (
          <>
             <div className="kpi-grid">
              <Card style={{ borderTop: `4px solid ${THEME.expense}` }}>
                <p style={{ margin: 0, fontSize: "0.875rem", color: THEME.neutral, fontWeight: 600 }}>Total Spent (USD)</p>
                <h2 style={{ margin: "0.5rem 0", fontSize: "1.75rem", color: "#0f172a" }}>{formatCurrency(metrics.purchases.usd, "USD")}</h2>
              </Card>
              <Card style={{ borderTop: `4px solid ${THEME.expense}` }}>
                <p style={{ margin: 0, fontSize: "0.875rem", color: THEME.neutral, fontWeight: 600 }}>Total Spent (IQD)</p>
                <h2 style={{ margin: "0.5rem 0", fontSize: "1.75rem", color: "#0f172a" }}>{formatCurrency(metrics.purchases.iqd, "IQD")}</h2>
              </Card>
              <Card>
                <p style={{ margin: 0, fontSize: "0.875rem", color: THEME.neutral, fontWeight: 600 }}>Procurement Volume</p>
                <h2 style={{ margin: "0.5rem 0", fontSize: "1.75rem", color: "#0f172a" }}>{formatNumber(metrics.purchases.itemsBought)} Units</h2>
                <p style={{ margin: 0, fontSize: "0.75rem", color: THEME.neutral }}>Across {metrics.purchases.count} supplier bills</p>
              </Card>
            </div>

            <Card className="card-wrapper">
              <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem" }}>Top Suppliers</h3>
              <div className="table-responsive">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", minWidth: "500px" }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${THEME.border}`, color: THEME.neutral, textAlign: "left" }}>
                      <th style={{ padding: "0.75rem" }}>Supplier Name</th>
                      <th style={{ padding: "0.75rem" }}>Invoices</th>
                      <th style={{ padding: "0.75rem", textAlign: "right" }}>Spend (USD)</th>
                      <th style={{ padding: "0.75rem", textAlign: "right" }}>Spend (IQD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.topSuppliers.map((s, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                        <td style={{ padding: "0.75rem", fontWeight: 500 }}>{s.name}</td>
                        <td style={{ padding: "0.75rem" }}>{s.count}</td>
                        <td style={{ padding: "0.75rem", textAlign: "right", color: THEME.expense, fontWeight: 500 }}>{formatCurrency(s.usd, "USD")}</td>
                        <td style={{ padding: "0.75rem", textAlign: "right", color: THEME.expense, fontWeight: 500 }}>{formatCurrency(s.iqd, "IQD")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

      </div>
    </div>
  );
}

// --- CSS STYLES FOR THE LOADER ---
const loaderStyles = `
#wifi-loader {
  --background: #62abff;
  --front-color: #ef4d86;
  --front-color-in: #fbb216;
  --back-color: #c3c8de;
  --text-color: #414856;
  width: 64px;
  height: 64px;
  border-radius: 50px;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

#wifi-loader svg {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
}

#wifi-loader svg circle {
  position: absolute;
  fill: none;
  stroke-width: 6px;
  stroke-linecap: round;
  stroke-linejoin: round;
  transform: rotate(-100deg);
  transform-origin: center;
}

#wifi-loader svg circle.back {
  stroke: var(--back-color);
}

#wifi-loader svg circle.front {
  stroke: var(--front-color);
}

#wifi-loader svg.circle-outer {
  height: 86px;
  width: 86px;
}

#wifi-loader svg.circle-outer circle {
  stroke-dasharray: 62.75 188.25;
}

#wifi-loader svg.circle-outer circle.back {
  animation: circle-outer135 1.8s ease infinite 0.3s;
}

#wifi-loader svg.circle-outer circle.front {
  animation: circle-outer135 1.8s ease infinite 0.15s;
}

#wifi-loader svg.circle-middle {
  height: 60px;
  width: 60px;
}

#wifi-loader svg.circle-middle circle {
  stroke: var(--front-color-in);
  stroke-dasharray: 42.5 127.5;
}

#wifi-loader svg.circle-middle circle.back {
  animation: circle-middle6123 1.8s ease infinite 0.25s;
}

#wifi-loader svg.circle-middle circle.front {
  animation: circle-middle6123 1.8s ease infinite 0.1s;
}

#wifi-loader svg.circle-inner {
  height: 34px;
  width: 34px;
}

#wifi-loader svg.circle-inner circle {
  stroke-dasharray: 22 66;
}

#wifi-loader svg.circle-inner circle.back {
  animation: circle-inner162 1.8s ease infinite 0.2s;
}

#wifi-loader svg.circle-inner circle.front {
  animation: circle-inner162 1.8s ease infinite 0.05s;
}

#wifi-loader .text {
  position: absolute;
  bottom: -40px;
  display: flex;
  justify-content: center;
  align-items: center;
  text-transform: lowercase;
  font-weight: 500;
  font-size: 14px;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

#wifi-loader .text::before,
#wifi-loader .text::after {
  content: attr(data-text);
}

#wifi-loader .text::before {
  color: var(--text-color);
}

#wifi-loader .text::after {
  color: var(--front-color-in);
  animation: text-animation76 3.6s ease infinite;
  position: absolute;
  left: 0;
}

@keyframes circle-outer135 {
  0% { stroke-dashoffset: 25; }
  25% { stroke-dashoffset: 0; }
  65% { stroke-dashoffset: 301; }
  80% { stroke-dashoffset: 276; }
  100% { stroke-dashoffset: 276; }
}

@keyframes circle-middle6123 {
  0% { stroke-dashoffset: 17; }
  25% { stroke-dashoffset: 0; }
  65% { stroke-dashoffset: 204; }
  80% { stroke-dashoffset: 187; }
  100% { stroke-dashoffset: 187; }
}

@keyframes circle-inner162 {
  0% { stroke-dashoffset: 9; }
  25% { stroke-dashoffset: 0; }
  65% { stroke-dashoffset: 106; }
  80% { stroke-dashoffset: 97; }
  100% { stroke-dashoffset: 97; }
}

@keyframes text-animation76 {
  0% { clip-path: inset(0 100% 0 0); }
  50% { clip-path: inset(0); }
  100% { clip-path: inset(0 0 0 100%); }
}
`;