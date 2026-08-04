"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Printer, ArrowLeft, Calendar, FileText, Loader2, Search, Building2, ChevronDown } from "lucide-react";
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

// Format for Header (dd/mm/yyyy)
const formatDateDMY = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
};

// Format for Bill Items (dd/mm/yyyy hh:mm)
const formatDateTime = (dateVal) => {
  const d = parseDate(dateVal);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
};

export default function DetailedSalesReport() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Advanced Combo Box State
  const [selectedPharmacy, setSelectedPharmacy] = useState("");
  const [pharmacySearch, setPharmacySearch] = useState("");
  const [isComboOpen, setIsComboOpen] = useState(false);
  const comboRef = useRef(null);

  // Close combo box on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (comboRef.current && !comboRef.current.contains(event.target)) {
        setIsComboOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch all sales bills
  const fetchBills = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "soldBills"));
      let fetchedBills = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Sort by date descending (newest first)
      fetchedBills.sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());
      setBills(fetchedBills);
    } catch (error) {
      console.error("Error fetching bills:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  // Extract unique pharmacies for combo box
  const uniquePharmacies = useMemo(() => {
    const names = bills.map(b => b.pharmacyName || b.name || "Walk-in").filter(Boolean);
    return [...new Set(names)].sort();
  }, [bills]);

  const filteredPharmacies = useMemo(() => {
    if (!pharmacySearch) return ["ALL PHARMACIES", ...uniquePharmacies];
    return ["ALL PHARMACIES", ...uniquePharmacies].filter(p => 
      p.toLowerCase().includes(pharmacySearch.toLowerCase())
    );
  }, [uniquePharmacies, pharmacySearch]);

  // Master Filter Logic
  const filteredBills = useMemo(() => {
    if (!selectedPharmacy) return []; // Require pharmacy selection first!

    return bills.filter(bill => {
      const bName = bill.pharmacyName || bill.name || "Walk-in";
      
      // Pharmacy Filter
      if (selectedPharmacy !== "ALL PHARMACIES" && bName !== selectedPharmacy) {
        return false;
      }

      const bDate = parseDate(bill.date);
      bDate.setHours(0, 0, 0, 0); // Normalize time for accurate date matching

      // Start Date Filter
      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        if (bDate < sDate) return false;
      }

      // End Date Filter
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(0, 0, 0, 0);
        if (bDate > eDate) return false;
      }

      return true;
    });
  }, [bills, selectedPharmacy, startDate, endDate]);

  // Grand Totals Calculation
  const grandTotals = useMemo(() => {
    let totalUSD = 0;
    let totalIQD = 0;

    filteredBills.forEach(bill => {
      const isIqd = bill.currency === "IQD";
      if (isIqd) {
        totalIQD += Number(bill.finalAmountIQD || bill.totalAmountIQD || 0);
      } else {
        totalUSD += Number(bill.finalAmountUSD || bill.totalAmountUSD || 0);
      }
    });

    return { totalUSD, totalIQD };
  }, [filteredBills]);

  const handlePrint = () => {
    window.print();
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
      
      {/* INJECTED CSS FOR PRINTING & RESPONSIVE MOBILE STYLING */}
      <style dangerouslySetInnerHTML={{__html: `
        .app-container, .app-container * {
          box-sizing: border-box; /* Crucial for preventing width overflow */
        }
        
        /* Mobile Layout Fixes */
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
            padding: 1rem !important; /* Smaller padding on mobile */
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

        /* Print Settings */
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
          
          /* Un-wrap items on print */
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

      {/* TOP CONTROLS (Hidden on Print) */}
      <div className="no-print controls-container" style={{ backgroundColor: "white", padding: "1rem 2rem", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link href="/sold" style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#64748b", textDecoration: "none", fontWeight: 600 }}>
              <ArrowLeft size={18} /> Back
            </Link>
            <h1 style={{ margin: 0, fontSize: "1.25rem", color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FileText size={20} color="#2563eb" /> Detailed Report
            </h1>
          </div>

          <div className="filters-wrapper" style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", width: "100%", maxWidth: "fit-content" }}>
            
            {/* ADVANCED COMBO BOX FOR PHARMACY */}
            <div ref={comboRef} className="combo-container" style={{ position: "relative", width: "260px" }}>
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
              disabled={!selectedPharmacy || filteredBills.length === 0}
              onClick={handlePrint}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.5rem 1rem", backgroundColor: (!selectedPharmacy || filteredBills.length === 0) ? "#94a3b8" : "#2563eb", color: "white", border: "none", borderRadius: "0.5rem", fontWeight: 600, cursor: (!selectedPharmacy || filteredBills.length === 0) ? "not-allowed" : "pointer", transition: "background 0.2s", width: "100%", maxWidth: "120px" }}
            >
              <Printer size={18} /> Print
            </button>
          </div>

        </div>
      </div>

      {/* PAPER CONTAINER */}
      <div style={{ padding: "2rem 1rem" }}>
        
        {/* PROMPT TO SELECT PHARMACY IF NONE SELECTED */}
        {!selectedPharmacy ? (
          <div style={{ maxWidth: "600px", margin: "4rem auto", textAlign: "center", backgroundColor: "white", padding: "3rem", borderRadius: "1rem", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0" }}>
            <Building2 size={48} color="#94a3b8" style={{ margin: "0 auto 1rem" }} />
            <h2 style={{ margin: "0 0 0.5rem 0", color: "#0f172a" }}>Select a Pharmacy</h2>
            <p style={{ margin: 0, color: "#64748b" }}>Please use the advanced search box above to choose a pharmacy and generate the detailed sales report.</p>
          </div>
        ) : (
          <div 
            className="print-container paper-shadow" 
            style={{ maxWidth: "900px", margin: "0 auto", backgroundColor: "white", padding: "2rem", borderRadius: "0.5rem", width: "100%" }}
          >
            {/* PRINT HEADER: LOGO & DETAILS */}
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
                <h2 style={{ margin: "0 0 4px 0", fontSize: "1.25rem", color: "#0f172a", textTransform: "uppercase" }}>Sales Ledger</h2>
                <p className="compact-text" style={{ margin: "2px 0", color: "#0f172a", fontSize: "0.875rem", fontWeight: 700 }}>Client: {selectedPharmacy}</p>
                <p className="compact-text" style={{ margin: "2px 0", color: "#475569", fontSize: "0.875rem" }}>
                  Period: {startDate ? formatDateDMY(startDate) : "Beginning"} - {endDate ? formatDateDMY(endDate) : "Present"}
                </p>
              </div>
            </div>

            {/* BILLS ITERATION */}
            {filteredBills.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
                No sales records found for this criteria.
              </div>
            ) : (
              filteredBills.map((bill, index) => {
                // Determine single currency for this bill
                const isIqd = bill.currency === "IQD";
                const currencySymbol = isIqd ? "IQD" : "USD";
                const subtotal = isIqd ? bill.totalAmountIQD : bill.totalAmountUSD;
                const discount = isIqd ? bill.discountIQD : bill.discountUSD;
                const finalTotal = isIqd ? (bill.finalAmountIQD || bill.totalAmountIQD) : (bill.finalAmountUSD || bill.totalAmountUSD);

                return (
                  <div key={bill.id} className="bill-section" style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px dashed #cbd5e1", width: "100%" }}>
                    
                    {/* Compact Bill Info Row */}
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.5rem", backgroundColor: "#f8fafc", padding: "6px 8px", borderLeft: "3px solid #2563eb", marginBottom: "8px", fontSize: "0.875rem" }}>
                      <div>
                        <span style={{ fontWeight: 700, color: "#0f172a", marginRight: "1rem" }}>Inv #{bill.billNumber || "N/A"}</span>
                        <span style={{ color: "#475569" }}>{formatDateTime(bill.date)}</span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600 }}>Status: </span>
                        <span style={{ color: bill.paymentStatus === "Paid" ? "#059669" : "#dc2626", fontWeight: "bold" }}>
                          {bill.paymentStatus?.toUpperCase() || "UNKNOWN"}
                        </span>
                      </div>
                    </div>

                    {/* WRAPPED TABLE TO PREVENT HORIZONTAL SCREEN SCROLLING */}
                    <div className="custom-scrollbar" style={{ width: "100%", overflowX: "auto", marginBottom: "8px" }}>
                      <table style={{ width: "100%", minWidth: "500px", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                        <thead>
                          <tr style={{ backgroundColor: "#e2e8f0", color: "#0f172a" }}>
                            <th style={{ padding: "6px", border: "1px solid #cbd5e1", textAlign: "left", width: "5%" }}>#</th>
                            <th style={{ padding: "6px", border: "1px solid #cbd5e1", textAlign: "left" }}>Item Description</th>
                            <th style={{ padding: "6px", border: "1px solid #cbd5e1", textAlign: "center", width: "8%" }}>Qty</th>
                            <th style={{ padding: "6px", border: "1px solid #cbd5e1", textAlign: "right", width: "15%" }}>Price</th>
                            <th style={{ padding: "6px", border: "1px solid #cbd5e1", textAlign: "right", width: "18%" }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bill.items && bill.items.length > 0 ? (
                            bill.items.map((item, idx) => {
                              const qty = Number(item.quantity) || 0;
                              // Pull price based on bill currency
                              const price = isIqd ? (Number(item.outPriceIQD) || Number(item.price) || 0) : (Number(item.outPriceUSD) || Number(item.price) || 0);
                              
                              return (
                                <tr key={idx}>
                                  <td style={{ padding: "4px 6px", border: "1px solid #cbd5e1", textAlign: "left", color: "#475569" }}>{idx + 1}</td>
                                  <td style={{ padding: "4px 6px", border: "1px solid #cbd5e1", textAlign: "left", fontWeight: 500, color: "#0f172a" }}>
                                    {item.name}
                                  </td>
                                  <td style={{ padding: "4px 6px", border: "1px solid #cbd5e1", textAlign: "center", fontWeight: "bold" }}>{qty}</td>
                                  <td style={{ padding: "4px 6px", border: "1px solid #cbd5e1", textAlign: "right", color: "#475569" }}>
                                    {formatCurrency(price, currencySymbol)}
                                  </td>
                                  <td style={{ padding: "4px 6px", border: "1px solid #cbd5e1", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>
                                    {formatCurrency(price * qty, currencySymbol)}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr><td colSpan="5" style={{ padding: "8px", textAlign: "center", color: "#94a3b8" }}>No items found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Single Currency Compact Total */}
                    <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.8125rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {Number(discount) > 0 && (
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <span style={{ color: "#64748b" }}>Subtotal:</span>
                            <span>{formatCurrency(subtotal, currencySymbol)}</span>
                            <span style={{ color: "#ef4444", marginLeft: "0.5rem" }}>Disc: -{formatCurrency(discount, currencySymbol)}</span>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "0.5rem", fontWeight: "bold", fontSize: "0.875rem", color: "#0f172a", backgroundColor: "#f1f5f9", padding: "2px 8px", borderRadius: "4px", alignItems: "center" }}>
                          <span>Bill Total:</span>
                          <span>{formatCurrency(finalTotal, currencySymbol)}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })
            )}

            {/* GRAND TOTALS FOOTER */}
            {filteredBills.length > 0 && (
              <div className="responsive-totals" style={{ marginTop: "2rem", borderTop: "3px double #0f172a", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", pageBreakInside: "avoid" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1rem", color: "#475569" }}>REPORT SUMMARY</h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.875rem", color: "#64748b" }}>Total Bills Count: {filteredBills.length}</p>
                </div>
                
                <div className="responsive-totals-boxes" style={{ display: "flex", gap: "2rem", flexWrap: "wrap", backgroundColor: "#f8fafc", padding: "1rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1" }}>
                  {grandTotals.totalUSD > 0 && (
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Grand Total USD</p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "1.25rem", color: "#2563eb", fontWeight: 800 }}>{formatCurrency(grandTotals.totalUSD, "USD")}</p>
                    </div>
                  )}
                  
                  {/* Divider hidden on mobile if they stack */}
                  {grandTotals.totalUSD > 0 && grandTotals.totalIQD > 0 && (
                    <div className="no-print" style={{ width: "1px", backgroundColor: "#cbd5e1" }}></div>
                  )}

                  {grandTotals.totalIQD > 0 && (
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Grand Total IQD</p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "1.25rem", color: "#059669", fontWeight: 800 }}>{formatCurrency(grandTotals.totalIQD, "IQD")}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ textAlign: "center", color: "#cbd5e1", fontSize: "0.75rem", marginTop: "2rem" }}>
              --- End of Generated Report ---
            </div>
          </div>
        )}
      </div>
    </div>
  );
}