"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Printer, ArrowLeft, Calendar, FileText, Loader2, Search, Building2, ChevronDown, RotateCcw, Receipt } from "lucide-react";
import Link from "next/link";

// --- Utility Functions ---
const formatCurrency = (amount, currency = "IQD") => {
  const num = Number(amount) || 0;
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(num);
  } else {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "IQD", minimumFractionDigits: 0 }).format(num);
  }
};

const parseDate = (dateVal) => {
  if (!dateVal) return new Date();
  if (dateVal.toDate && typeof dateVal.toDate === 'function') return dateVal.toDate();
  if (dateVal.seconds) return new Date(dateVal.seconds * 1000);
  const parsed = new Date(dateVal);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatDateDMY = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatDateTime = (dateVal) => {
  const d = parseDate(dateVal);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
};

// Safe price extraction for items
const getItemUnitPrice = (item, isIqd) => {
  if (item.returnPrice !== undefined && item.returnPrice !== null) {
    return Number(item.returnPrice) || 0;
  }
  if (isIqd) {
    if (item.outPriceIQD && Number(item.outPriceIQD) > 0) return Number(item.outPriceIQD);
    return Number(item.price) || 0;
  } else {
    if (item.outPriceUSD && Number(item.outPriceUSD) > 0) return Number(item.outPriceUSD);
    return Number(item.price) || 0;
  }
};

// Calculate individual invoice balance
const calculateDocComputedTotal = (docItem) => {
  const isIqd = docItem.currency === "IQD";
  
  if (!docItem.items || !Array.isArray(docItem.items) || docItem.items.length === 0) {
    if (docItem.docType === "return") {
      return Number(docItem.totalReturnAmount || docItem.totalAmount || 0);
    }
    return isIqd
      ? Number(docItem.finalAmountIQD || docItem.totalAmountIQD || docItem.totalAmount || 0)
      : Number(docItem.finalAmountUSD || docItem.totalAmountUSD || docItem.totalAmount || 0);
  }

  const itemsSum = docItem.items.reduce((sum, item) => {
    const qty = Number(item.quantity || item.returnQuantity || 0);
    const price = getItemUnitPrice(item, isIqd);
    return sum + (price * qty);
  }, 0);

  if (docItem.docType === "return") {
    return itemsSum;
  }

  const discount = isIqd ? (Number(docItem.discountIQD) || 0) : (Number(docItem.discountUSD) || 0);
  return Math.max(0, itemsSum - discount);
};

export default function DetailedSalesReport() {
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportType, setReportType] = useState("all"); // 'all' | 'sales' | 'returns'
  
  // Advanced Combo Box State
  const [selectedPharmacy, setSelectedPharmacy] = useState("");
  const [pharmacySearch, setPharmacySearch] = useState("");
  const [isComboOpen, setIsComboOpen] = useState(false);
  const comboRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (comboRef.current && !comboRef.current.contains(event.target)) {
        setIsComboOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch both sales and returns
  const fetchData = async () => {
    setLoading(true);
    try {
      const [salesSnap, returnsSnap] = await Promise.all([
        getDocs(collection(db, "soldBills")),
        getDocs(collection(db, "returns"))
      ]);

      const sales = salesSnap.docs.map(d => ({
        id: d.id,
        docType: "sale",
        ...d.data()
      }));

      const returns = returnsSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          docType: "return",
          date: data.returnDate || data.date || data.createdAt,
          ...data
        };
      });

      const combined = [...sales, ...returns];
      combined.sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());
      setAllRecords(combined);
    } catch (error) {
      console.error("Error fetching report records:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Extract unique pharmacies
  const uniquePharmacies = useMemo(() => {
    const names = allRecords.map(b => b.pharmacyName || b.name || "Walk-in").filter(Boolean);
    return [...new Set(names)].sort();
  }, [allRecords]);

  const filteredPharmacies = useMemo(() => {
    if (!pharmacySearch) return ["ALL PHARMACIES", ...uniquePharmacies];
    return ["ALL PHARMACIES", ...uniquePharmacies].filter(p => 
      p.toLowerCase().includes(pharmacySearch.toLowerCase())
    );
  }, [uniquePharmacies, pharmacySearch]);

  // Master Filter Logic
  const filteredRecords = useMemo(() => {
    if (!selectedPharmacy) return [];

    return allRecords.filter(item => {
      const pName = item.pharmacyName || item.name || "Walk-in";
      
      if (selectedPharmacy !== "ALL PHARMACIES" && pName !== selectedPharmacy) {
        return false;
      }

      // Filter by type: Sales vs Returns
      if (reportType === "sales" && item.docType !== "sale") return false;
      if (reportType === "returns" && item.docType !== "return") return false;

      const itemDate = parseDate(item.date);
      itemDate.setHours(0, 0, 0, 0);

      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        if (itemDate < sDate) return false;
      }

      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(0, 0, 0, 0);
        if (itemDate > eDate) return false;
      }

      return true;
    });
  }, [allRecords, selectedPharmacy, reportType, startDate, endDate]);

  // Grand Totals Calculation
  const grandTotals = useMemo(() => {
    let salesUSD = 0;
    let salesIQD = 0;
    let returnsUSD = 0;
    let returnsIQD = 0;

    filteredRecords.forEach(record => {
      const isIqd = record.currency === "IQD";
      const total = calculateDocComputedTotal(record);

      if (record.docType === "return") {
        if (isIqd) returnsIQD += total;
        else returnsUSD += total;
      } else {
        if (isIqd) salesIQD += total;
        else salesUSD += total;
      }
    });

    return {
      salesUSD,
      salesIQD,
      returnsUSD,
      returnsIQD,
      netUSD: salesUSD - returnsUSD,
      netIQD: salesIQD - returnsIQD,
    };
  }, [filteredRecords]);

  const handlePrint = () => {
    window.print();
  };

  // Header Title Helper
  const getHeaderTitle = () => {
    if (reportType === "sales") return "Sales Ledger";
    if (reportType === "returns") return "Returns Ledger";
    return "Account Statement & Ledger";
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <Loader2 style={{ animation: "spin 1s linear infinite", color: "#3b82f6" }} size={48} />
      </div>
    );
  }

  return (
    <div className="app-container" style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", fontFamily: "system-ui, sans-serif", paddingBottom: "3rem" }}>
      
      <style dangerouslySetInnerHTML={{__html: `
        .app-container, .app-container * {
          box-sizing: border-box;
        }
        
        @media (max-width: 768px) {
          .responsive-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 1rem;
          }
          .responsive-header-right {
            text-align: left !important;
            width: 100%;
          }
          .responsive-totals {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 1rem;
          }
          .responsive-totals-boxes {
            width: 100%;
            justify-content: space-between;
          }
          .print-container {
            padding: 1rem !important;
          }
          .combo-container {
            width: 100% !important;
          }
          .filters-wrapper {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .date-filter-box {
            width: 100%;
            justify-content: space-between;
          }
          .controls-container {
            padding: 1rem !important;
          }
        }

        @media print {
          @page { margin: 10mm; size: A4 portrait; }
          body { background: white !important; -webkit-print-color-adjust: exact; color-adjust: exact; }
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          .no-print { display: none !important; }
          .bill-section {
            page-break-inside: avoid;
            border-bottom: 1px dashed #64748b !important;
            margin-bottom: 8px !important;
            padding-bottom: 8px !important;
          }
          table th, table td { padding: 4px !important; font-size: 11px !important; }
          .compact-text { font-size: 11px !important; margin: 2px 0 !important; }
          
          .responsive-header { flex-direction: row !important; align-items: flex-end !important; }
          .responsive-header-right { text-align: right !important; }
          .responsive-totals { flex-direction: row !important; align-items: center !important; }
        }
        
        .paper-shadow {
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
      `}} />

      {/* TOP CONTROLS */}
      <div className="no-print controls-container" style={{ backgroundColor: "white", padding: "1rem 2rem", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link href="/sold" style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748b", textDecoration: "none", fontWeight: 600 }}>
              <ArrowLeft size={18} /> Back
            </Link>
            <h1 style={{ margin: 0, fontSize: "1.25rem", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FileText size={20} color="#2563eb" /> Detailed Report
            </h1>
          </div>

          <div className="filters-wrapper" style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", width: "100%", maxWidth: "fit-content" }}>
            
            {/* TYPE SELECTOR COMBO */}
            <div style={{ display: "flex", alignItems: "center", backgroundColor: "#f8fafc", padding: "0.4rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1" }}>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                style={{ border: "none", background: "transparent", outline: "none", color: "#0f172a", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}
              >
                <option value="all">📑 All Transactions</option>
                <option value="sales">💰 Sales Only</option>
                <option value="returns">🔄 Returns Only</option>
              </select>
            </div>

            {/* PHARMACY COMBO BOX */}
            <div ref={comboRef} className="combo-container" style={{ position: "relative", width: "240px" }}>
              <div 
                onClick={() => setIsComboOpen(true)}
                style={{ display: "flex", alignItems: "center", backgroundColor: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "0.5rem", padding: "0.4rem 0.75rem", cursor: "text", width: "100%" }}
              >
                <Search size={16} color="#64748b" style={{ marginRight: "0.5rem", flexShrink: 0 }} />
                <input 
                  type="text"
                  placeholder="Select Pharmacy..."
                  value={pharmacySearch}
                  onChange={(e) => {
                    setPharmacySearch(e.target.value);
                    setIsComboOpen(true);
                  }}
                  onFocus={() => setIsComboOpen(true)}
                  style={{ border: "none", background: "transparent", outline: "none", width: "100%", fontSize: "0.875rem", color: "#0f172a", fontWeight: 500 }}
                />
                <ChevronDown size={16} color="#64748b" style={{ flexShrink: 0 }} />
              </div>

              {isComboOpen && (
                <div className="custom-scrollbar" style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: "4px", backgroundColor: "white", border: "1px solid #cbd5e1", borderRadius: "0.5rem", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", maxHeight: "250px", overflowY: "auto", zIndex: 100 }}>
                  {filteredPharmacies.length > 0 ? (
                    filteredPharmacies.map((pharm, idx) => (
                      <div 
                        key={idx}
                        onClick={() => {
                          setSelectedPharmacy(pharm);
                          setPharmacySearch(pharm);
                          setIsComboOpen(false);
                        }}
                        style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", cursor: "pointer", borderBottom: "1px solid #f1f5f9", backgroundColor: selectedPharmacy === pharm ? "#eff6ff" : "white", color: selectedPharmacy === pharm ? "#2563eb" : "#334155", fontWeight: selectedPharmacy === pharm ? 600 : 400 }}
                      >
                        {pharm}
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: "1rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>No matches found</div>
                  )}
                </div>
              )}
            </div>

            {/* DATE FILTERS */}
            <div className="date-filter-box" style={{ display: "flex", alignItems: "center", gap: "0.5rem", backgroundColor: "#f8fafc", padding: "0.4rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1" }}>
              <Calendar size={16} color="#64748b" style={{ flexShrink: 0 }} />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ border: "none", background: "transparent", outline: "none", color: "#334155", fontSize: "0.875rem", width: "100%" }}
              />
              <span style={{ color: "#94a3b8" }}>-</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ border: "none", background: "transparent", outline: "none", color: "#334155", fontSize: "0.875rem", width: "100%" }}
              />
            </div>

            {/* PRINT BUTTON */}
            <button 
              disabled={!selectedPharmacy || filteredRecords.length === 0}
              onClick={handlePrint}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.5rem 1rem", backgroundColor: (!selectedPharmacy || filteredRecords.length === 0) ? "#94a3b8" : "#2563eb", color: "white", border: "none", borderRadius: "0.5rem", fontWeight: 600, cursor: (!selectedPharmacy || filteredRecords.length === 0) ? "not-allowed" : "pointer", transition: "background 0.2s", width: "100%", maxWidth: "120px" }}
            >
              <Printer size={18} /> Print
            </button>
          </div>

        </div>
      </div>

      {/* PAPER CONTAINER */}
      <div style={{ padding: "2rem 1rem" }}>
        {!selectedPharmacy ? (
          <div style={{ maxWidth: "600px", margin: "4rem auto", textAlign: "center", backgroundColor: "white", padding: "3rem", borderRadius: "1rem", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0" }}>
            <Building2 size={48} color="#94a3b8" style={{ margin: "0 auto 1rem" }} />
            <h2 style={{ margin: "0 0 0.5rem 0", color: "#0f172a" }}>Select a Pharmacy</h2>
            <p style={{ margin: 0, color: "#64748b" }}>Please use the advanced search box above to choose a pharmacy and generate the detailed ledger report.</p>
          </div>
        ) : (
          <div 
            className="print-container paper-shadow" 
            style={{ maxWidth: "900px", margin: "0 auto", backgroundColor: "white", padding: "2rem", borderRadius: "0.5rem", width: "100%" }}
          >
            {/* PRINT HEADER */}
            <div className="responsive-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #0f172a", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
              
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <img src="/Aranlogo.png" alt="Aran Med Store Logo" style={{ height: "60px", objectFit: "contain" }} />
                <div>
                  <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#0f172a", fontWeight: "900", letterSpacing: "0.5px" }}>ARAN MED STORE</h1>
                  <p className="compact-text" style={{ margin: "2px 0", color: "#334155", fontSize: "0.875rem" }}>سلێمانی - بەرامبەر نەخۆشخانەی سمارت</p>
                  <p className="compact-text" style={{ margin: "2px 0", color: "#334155", fontSize: "0.875rem" }}>+964 772 533 5252 || +964 751 741 2241</p>
                </div>
              </div>

              <div className="responsive-header-right" style={{ textAlign: "right" }}>
                <h2 style={{ margin: "0 0 4px 0", fontSize: "1.25rem", color: "#0f172a", textTransform: "uppercase" }}>{getHeaderTitle()}</h2>
                <p className="compact-text" style={{ margin: "2px 0", color: "#0f172a", fontSize: "0.875rem", fontWeight: 700 }}>Client: {selectedPharmacy}</p>
                <p className="compact-text" style={{ margin: "2px 0", color: "#475569", fontSize: "0.875rem" }}>
                  Period: {startDate ? formatDateDMY(startDate) : "Beginning"} - {endDate ? formatDateDMY(endDate) : "Present"}
                </p>
              </div>
            </div>

            {/* TRANSACTIONS ITERATION */}
            {filteredRecords.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
                No records found for the selected criteria.
              </div>
            ) : (
              filteredRecords.map((item) => {
                const isReturn = item.docType === "return";
                const isIqd = item.currency === "IQD";
                const currencySymbol = isIqd ? "IQD" : "USD";
                
                const computedSubtotal = item.items && Array.isArray(item.items)
                  ? item.items.reduce((acc, itm) => acc + (getItemUnitPrice(itm, isIqd) * (Number(itm.quantity || itm.returnQuantity) || 0)), 0)
                  : (isIqd ? Number(item.totalAmountIQD || item.totalAmount || 0) : Number(item.totalAmountUSD || item.totalAmount || 0));

                const discount = !isReturn && isIqd ? (Number(item.discountIQD) || 0) : (!isReturn ? (Number(item.discountUSD) || 0) : 0);
                const finalTotal = isReturn ? computedSubtotal : Math.max(0, computedSubtotal - discount);
                const docIdentifier = isReturn 
                  ? (item.returnBillNumber || item.pharmacyReturnBillNumber || `RET-${item.id?.slice(-6)}`) 
                  : `Inv #${item.billNumber || "N/A"}`;

                return (
                  <div 
                    key={item.id} 
                    className="bill-section" 
                    style={{ 
                      marginBottom: "1rem", 
                      paddingBottom: "1rem", 
                      borderBottom: "1px dashed #cbd5e1", 
                      width: "100%" 
                    }}
                  >
                    {/* Compact Info Row */}
                    <div style={{ 
                      display: "flex", 
                      flexWrap: "wrap", 
                      justifyContent: "space-between", 
                      gap: "0.5rem", 
                      backgroundColor: isReturn ? "#fff1f2" : "#f8fafc", 
                      padding: "6px 8px", 
                      borderLeft: `4px solid ${isReturn ? "#e11d48" : "#2563eb"}`, 
                      marginBottom: "8px", 
                      fontSize: "0.875rem",
                      borderRadius: "0 4px 4px 0"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                        <span style={{ 
                          display: "inline-flex", 
                          alignItems: "center", 
                          gap: "4px",
                          fontWeight: 800, 
                          color: isReturn ? "#e11d48" : "#0f172a" 
                        }}>
                          {isReturn ? <RotateCcw size={14} /> : <Receipt size={14} />}
                          {docIdentifier}
                        </span>
                        
                        {isReturn && item.billNumber && (
                          <span style={{ fontSize: "0.75rem", color: "#64748b", background: "white", padding: "1px 6px", borderRadius: "4px", border: "1px solid #fecdd3" }}>
                            Orig Bill: #{item.billNumber}
                          </span>
                        )}
                        <span style={{ color: "#475569" }}>{formatDateTime(item.date)}</span>
                      </div>

                      <div>
                        <span style={{ fontWeight: 600 }}>Status: </span>
                        <span style={{ 
                          color: item.paymentStatus === "Paid" ? "#059669" : item.paymentStatus === "Processed" ? "#d97706" : "#dc2626", 
                          fontWeight: "bold" 
                        }}>
                          {item.paymentStatus?.toUpperCase() || "UNPAID"}
                        </span>
                      </div>
                    </div>

                    {/* ITEMS TABLE */}
                    <div className="custom-scrollbar" style={{ width: "100%", overflowX: "auto", marginBottom: "8px" }}>
                      <table style={{ width: "100%", minWidth: "500px", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                        <thead>
                          <tr style={{ backgroundColor: isReturn ? "#ffe4e6" : "#e2e8f0", color: "#0f172a" }}>
                            <th style={{ padding: "6px", border: "1px solid #cbd5e1", textAlign: "left", width: "5%" }}>#</th>
                            <th style={{ padding: "6px", border: "1px solid #cbd5e1", textAlign: "left" }}>Item Description</th>
                            <th style={{ padding: "6px", border: "1px solid #cbd5e1", textAlign: "center", width: "8%" }}>Qty</th>
                            <th style={{ padding: "6px", border: "1px solid #cbd5e1", textAlign: "right", width: "15%" }}>Price</th>
                            <th style={{ padding: "6px", border: "1px solid #cbd5e1", textAlign: "right", width: "18%" }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.items && item.items.length > 0 ? (
                            item.items.map((itm, idx) => {
                              const qty = Number(itm.quantity || itm.returnQuantity || 0);
                              const price = getItemUnitPrice(itm, isIqd);
                              
                              return (
                                <tr key={idx}>
                                  <td style={{ padding: "4px 6px", border: "1px solid #cbd5e1", textAlign: "left", color: "#475569" }}>{idx + 1}</td>
                                  <td style={{ padding: "4px 6px", border: "1px solid #cbd5e1", textAlign: "left", fontWeight: 500, color: "#0f172a" }}>
                                    {itm.name}
                                  </td>
                                  <td style={{ padding: "4px 6px", border: "1px solid #cbd5e1", textAlign: "center", fontWeight: "bold", color: isReturn ? "#e11d48" : "inherit" }}>
                                    {isReturn ? `-${qty}` : qty}
                                  </td>
                                  <td style={{ padding: "4px 6px", border: "1px solid #cbd5e1", textAlign: "right", color: "#475569" }}>
                                    {formatCurrency(price, currencySymbol)}
                                  </td>
                                  <td style={{ padding: "4px 6px", border: "1px solid #cbd5e1", textAlign: "right", fontWeight: 600, color: isReturn ? "#e11d48" : "#0f172a" }}>
                                    {isReturn ? `-${formatCurrency(price * qty, currencySymbol)}` : formatCurrency(price * qty, currencySymbol)}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr><td colSpan="5" style={{ padding: "8px", textAlign: "center", color: "#94a3b8" }}>No items listed.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* TOTAL FOOTER */}
                    <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.8125rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {Number(discount) > 0 && (
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <span style={{ color: "#64748b" }}>Subtotal:</span>
                            <span>{formatCurrency(computedSubtotal, currencySymbol)}</span>
                            <span style={{ color: "#ef4444", marginLeft: "0.5rem" }}>Disc: -{formatCurrency(discount, currencySymbol)}</span>
                          </div>
                        )}
                        <div style={{ 
                          display: "flex", 
                          gap: "0.5rem", 
                          fontWeight: "bold", 
                          fontSize: "0.875rem", 
                          color: isReturn ? "#e11d48" : "#0f172a", 
                          backgroundColor: isReturn ? "#ffe4e6" : "#f1f5f9", 
                          padding: "2px 8px", 
                          borderRadius: "4px", 
                          alignItems: "center" 
                        }}>
                          <span>{isReturn ? "Return Total:" : "Bill Total:"}</span>
                          <span>{isReturn ? `-${formatCurrency(finalTotal, currencySymbol)}` : formatCurrency(finalTotal, currencySymbol)}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })
            )}

            {/* COMPREHENSIVE FINANCIAL SUMMARY */}
            {filteredRecords.length > 0 && (
              <div className="responsive-totals" style={{ marginTop: "2rem", borderTop: "3px double #0f172a", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", pageBreakInside: "avoid" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1rem", color: "#475569" }}>FINANCIAL SUMMARY</h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.875rem", color: "#64748b" }}>Transactions: {filteredRecords.length}</p>
                </div>
                
                <div className="responsive-totals-boxes" style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", backgroundColor: "#f8fafc", padding: "1rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1" }}>
                  
                  {/* USD Breakdown */}
                  {(grandTotals.salesUSD > 0 || grandTotals.returnsUSD > 0) && (
                    <div style={{ textAlign: "right", minWidth: "140px" }}>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>USD Balance</p>
                      {reportType === "all" && grandTotals.salesUSD > 0 && (
                        <p style={{ margin: "2px 0", fontSize: "0.75rem", color: "#059669" }}>Sales: +{formatCurrency(grandTotals.salesUSD, "USD")}</p>
                      )}
                      {reportType === "all" && grandTotals.returnsUSD > 0 && (
                        <p style={{ margin: "2px 0", fontSize: "0.75rem", color: "#e11d48" }}>Returns: -{formatCurrency(grandTotals.returnsUSD, "USD")}</p>
                      )}
                      <p style={{ margin: "4px 0 0 0", fontSize: "1.15rem", color: grandTotals.netUSD >= 0 ? "#2563eb" : "#e11d48", fontWeight: 800 }}>
                        {formatCurrency(grandTotals.netUSD, "USD")}
                      </p>
                    </div>
                  )}

                  {/* Vertical Divider */}
                  {(grandTotals.salesUSD > 0 || grandTotals.returnsUSD > 0) && (grandTotals.salesIQD > 0 || grandTotals.returnsIQD > 0) && (
                    <div className="no-print" style={{ width: "1px", backgroundColor: "#cbd5e1" }}></div>
                  )}

                  {/* IQD Breakdown */}
                  {(grandTotals.salesIQD > 0 || grandTotals.returnsIQD > 0) && (
                    <div style={{ textAlign: "right", minWidth: "140px" }}>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>IQD Balance</p>
                      {reportType === "all" && grandTotals.salesIQD > 0 && (
                        <p style={{ margin: "2px 0", fontSize: "0.75rem", color: "#059669" }}>Sales: +{formatCurrency(grandTotals.salesIQD, "IQD")}</p>
                      )}
                      {reportType === "all" && grandTotals.returnsIQD > 0 && (
                        <p style={{ margin: "2px 0", fontSize: "0.75rem", color: "#e11d48" }}>Returns: -{formatCurrency(grandTotals.returnsIQD, "IQD")}</p>
                      )}
                      <p style={{ margin: "4px 0 0 0", fontSize: "1.15rem", color: grandTotals.netIQD >= 0 ? "#059669" : "#e11d48", fontWeight: 800 }}>
                        {formatCurrency(grandTotals.netIQD, "IQD")}
                      </p>
                    </div>
                  )}

                </div>
              </div>
            )}

            <div style={{ textAlign: "center", color: "#cbd5e1", fontSize: "0.75rem", marginTop: "2rem" }}>
              --- End of Generated Statement ---
            </div>
          </div>
        )}
      </div>
    </div>
  );
}