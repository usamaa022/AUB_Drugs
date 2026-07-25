"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingCart,
  Users,
  RefreshCw,
  Search,
  Loader2,
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
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

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
  admin: "#7C3AED",
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

// ==========================================
// MAIN COMPONENT
// Replace "admin" with actual user role from your auth context ("user", "admin", "superAdmin")
// ==========================================
export default function DetailedDashboardPage({ userRole = "admin" }) {
  // --- RBAC Logic ---
  const canViewAll = userRole === "admin" || userRole === "superAdmin";
  
  // --- State ---
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("sales");
  const [data, setData] = useState({
    soldBills: [],
    boughtBills: [],
    storeItems: [],
  });

  const [filters, setFilters] = useState({
    dateRange: "month", // all, day, week, month, year
    selectedMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    selectedYear: new Date().getFullYear(),
    currency: "all", // all, USD, IQD
    paymentStatus: "all", // all, Paid, Unpaid
    searchQuery: "",
  });

  const [refreshKey, setRefreshKey] = useState(0);

  // --- Data Fetching ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // Parallel fetching for performance
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshKey, canViewAll]);

  // --- Master Filter Engine ---
  const { filteredSold, filteredBought, filteredStore } = useMemo(() => {
    const { dateRange, selectedMonth, selectedYear, currency, paymentStatus, searchQuery } = filters;
    const [year, month] = selectedMonth.split("-").map(Number);
    const targetYear = dateRange === "year" ? selectedYear : year;
    const targetMonth = dateRange === "month" ? month - 1 : undefined;
    const query = searchQuery.toLowerCase();

    const applyFilters = (bill, isStoreItem = false) => {
      // Search Filter
      if (query) {
        const matchName = (bill.pharmacyName || bill.companyName || bill.name || "").toLowerCase().includes(query);
        const matchNum = String(bill.billNumber || bill.barcode || "").includes(query);
        const matchItems = !isStoreItem && bill.items?.some(i => i.name?.toLowerCase().includes(query));
        if (!matchName && !matchNum && !matchItems) return false;
      }

      if (isStoreItem) {
        if (currency !== "all" && bill.priceType !== currency && bill.originalCurrency !== currency) return false;
        return true;
      }

      // Date Filter
      const bDate = parseDate(bill.date);
      if (dateRange === "month" && (bDate.getFullYear() !== targetYear || bDate.getMonth() !== targetMonth)) return false;
      if (dateRange === "year" && bDate.getFullYear() !== targetYear) return false;

      // Currency Filter
      if (currency !== "all" && bill.currency !== currency) return false;

      // Payment Status Filter
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
      // Sales
      sales: { usd: 0, iqd: 0, count: filteredSold.length, itemsSold: 0, unpaidUsd: 0, unpaidIqd: 0 },
      // Purchases
      purchases: { usd: 0, iqd: 0, count: filteredBought.length, itemsBought: 0, unpaidUsd: 0, unpaidIqd: 0 },
      // Profit & Inventory (Admins only)
      profit: { usd: 0, iqd: 0 },
      inventoryValue: { usd: 0, iqd: 0 },
      // Rankings
      topSoldProducts: {},
      topClients: {},
      topSuppliers: {}
    };

    // Process Sales
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
        
        // Cost calculation for profit
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

    // Process Purchases (Admins only)
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

      // Inventory Valuation
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
            dataPoints[mIdx].profitUSD += rUsd - ((Number(item.basePriceUSD)||0) * qty);
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
            dataPoints[dIdx].profitUSD += rUsd - ((Number(item.basePriceUSD)||0) * qty);
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

  // --- View Control ---
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: THEME.bg }}>
        <div style={{ textAlign: "center" }}>
          <Loader2 style={{ width: "3rem", height: "3rem", animation: "spin 1s linear infinite", color: THEME.primary, margin: "0 auto 1rem" }} />
          <p style={{ color: THEME.neutral, fontWeight: 500 }}>Compiling Datasets...</p>
        </div>
      </div>
    );
  }

  const Card = ({ children, style = {} }) => (
    <div style={{ background: THEME.card, borderRadius: "0.75rem", border: `1px solid ${THEME.border}`, padding: "1.25rem", ...style }}>
      {children}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: THEME.bg, fontFamily: "system-ui, sans-serif", paddingBottom: "4rem" }}>
      
      {/* HEADER & GLOBAL FILTERS */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${THEME.border}`, padding: "1rem 1.5rem" }}>
        <div style={{ maxWidth: "1600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ background: canViewAll ? THEME.admin : THEME.primary, padding: "0.5rem", borderRadius: "0.5rem", color: "white" }}>
                {canViewAll ? <ShieldAlert size={20} /> : <Activity size={20} />}
              </div>
              <div>
                <h1 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                  {canViewAll ? "Master Operation Hub" : "Sales Dashboard"}
                </h1>
                <p style={{ color: THEME.neutral, fontSize: "0.75rem", margin: 0, fontWeight: 500 }}>
                  Role: <span style={{ color: canViewAll ? THEME.admin : THEME.primary }}>{userRole.toUpperCase()}</span>
                </p>
              </div>
            </div>
            
            <button onClick={() => setRefreshKey(k=>k+1)} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", background: THEME.bg, border: `1px solid ${THEME.border}`, borderRadius: "0.5rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: "500" }}>
              <RefreshCw size={16} /> Sync Data
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", background: THEME.bg, padding: "0.5rem", borderRadius: "0.5rem", border: `1px solid ${THEME.border}` }}>
            <Filter size={16} color={THEME.neutral} style={{ margin: "0 0.5rem" }} />
            
            <select value={filters.dateRange} onChange={(e) => setFilters(f => ({ ...f, dateRange: e.target.value }))} style={{ padding: "0.4rem", borderRadius: "0.375rem", border: `1px solid ${THEME.border}`, fontSize: "0.875rem" }}>
              <option value="month">Month View</option>
              <option value="year">Year View</option>
            </select>

            {filters.dateRange === "month" ? (
              <input type="month" value={filters.selectedMonth} onChange={(e) => setFilters(f => ({...f, selectedMonth: e.target.value}))} style={{ padding: "0.4rem", borderRadius: "0.375rem", border: `1px solid ${THEME.border}`, fontSize: "0.875rem" }} />
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

            <div style={{ display: "flex", flex: 1, minWidth: "200px", background: "white", padding: "0.4rem", borderRadius: "0.375rem", border: `1px solid ${THEME.border}`, alignItems: "center" }}>
              <Search size={16} color={THEME.neutral} style={{ marginRight: "0.5rem" }} />
              <input type="text" placeholder="Search invoices, items, or clients..." value={filters.searchQuery} onChange={(e) => setFilters(f => ({ ...f, searchQuery: e.target.value }))} style={{ border: "none", outline: "none", width: "100%", fontSize: "0.875rem" }} />
              {filters.searchQuery && <X size={14} color={THEME.expense} cursor="pointer" onClick={() => setFilters(f => ({...f, searchQuery: ""}))} />}
            </div>
          </div>

          {/* Contextual Tabs based on Role */}
          <div style={{ display: "flex", gap: "1rem", borderBottom: `2px solid ${THEME.border}`, paddingBottom: "0.25rem" }}>
            {canViewAll && <button onClick={() => setActiveTab("overview")} style={{ background: "none", border: "none", borderBottom: activeTab === "overview" ? `2px solid ${THEME.admin}` : "none", color: activeTab === "overview" ? THEME.admin : THEME.neutral, padding: "0.5rem 0", fontWeight: 600, cursor: "pointer" }}>Command Center</button>}
            <button onClick={() => setActiveTab("sales")} style={{ background: "none", border: "none", borderBottom: activeTab === "sales" ? `2px solid ${THEME.primary}` : "none", color: activeTab === "sales" ? THEME.primary : THEME.neutral, padding: "0.5rem 0", fontWeight: 600, cursor: "pointer" }}>Sales & Distribution</button>
            {canViewAll && <button onClick={() => setActiveTab("purchases")} style={{ background: "none", border: "none", borderBottom: activeTab === "purchases" ? `2px solid ${THEME.expense}` : "none", color: activeTab === "purchases" ? THEME.expense : THEME.neutral, padding: "0.5rem 0", fontWeight: 600, cursor: "pointer" }}>Procurement</button>}
          </div>

        </div>
      </div>

      <div style={{ maxWidth: "1600px", margin: "1.5rem auto", padding: "0 1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* ==================================================== */}
        {/* TAB: SALES (Visible to All) */}
        {/* ==================================================== */}
        {activeTab === "sales" && (
          <>
            {/* Sales KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
              <Card style={{ minHeight: "350px" }}>
                <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem" }}>Sales Timeline</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="colorSalesUSD" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={THEME.usd} stopOpacity={0.3}/><stop offset="95%" stopColor={THEME.usd} stopOpacity={0}/></linearGradient>
                      <linearGradient id="colorSalesIQD" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={THEME.iqd} stopOpacity={0.3}/><stop offset="95%" stopColor={THEME.iqd} stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={THEME.border} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={v => `$${v/1000}k`} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(val, name) => [formatCurrency(val, name.includes('USD') ? 'USD' : 'IQD'), name]} />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="salesUSD" name="Sales USD" stroke={THEME.usd} fill="url(#colorSalesUSD)" strokeWidth={2} />
                    <Area yAxisId="right" type="monotone" dataKey="salesIQD" name="Sales IQD" stroke={THEME.iqd} fill="url(#colorSalesIQD)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem" }}>Top Performing Clients</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {metrics.topClients.map((client, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${THEME.border}`, paddingBottom: "0.5rem" }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem" }}>{client.name}</p>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: THEME.neutral }}>{client.count} orders</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: 0, fontWeight: 600, color: THEME.usd, fontSize: "0.875rem" }}>{formatCurrency(client.usd, "USD")}</p>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: THEME.iqd }}>{formatCurrency(client.iqd, "IQD")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Detailed Products List */}
            <Card>
              <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem" }}>Itemized Sales Performance</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
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
            </Card>
          </>
        )}

        {/* ==================================================== */}
        {/* TAB: COMMAND CENTER / OVERVIEW (Admin Only) */}
        {/* ==================================================== */}
        {canViewAll && activeTab === "overview" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              <Card style={{ background: THEME.admin, color: "white" }}>
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

            <Card style={{ minHeight: "400px" }}>
              <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem" }}>Cash Flow: Sales vs Procurement vs Profit</h3>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={THEME.border} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={v => `$${v/1000}k`} />
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
             <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
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

            <Card>
              <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem" }}>Top Suppliers</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
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
            </Card>
          </>
        )}

      </div>
    </div>
  );
}