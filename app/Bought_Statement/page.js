"use client";
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getCompanyBoughtBills, getReturnsForCompany } from "@/lib/data";
import CompanySelectionModal from "@/components/CompanySelectionModal";

const BoughtStatementPage = () => {
  const { user } = useAuth();
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showModal, setShowModal] = useState(true);
  const [bills, setBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState("");
  const printRef = useRef(null);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);

  const formatIQD = (amount) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);

  const toDate = (val) => {
    if (!val) return null;
    if (typeof val.toDate === "function") return val.toDate();
    if (val instanceof Date) return val;
    if (val.seconds !== undefined) return new Date(val.seconds * 1000);
    if (typeof val === "string" || typeof val === "number") return new Date(val);
    return null;
  };

  const formatDate = (val) => {
    const d = toDate(val);
    if (!d || isNaN(d.getTime())) return "N/A";
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${d.getFullYear()}`;
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1f2937; background: white; padding: 20px; }
            .header-container { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; }
            h1 { font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 4px; }
            p.subtitle { color: #6b7280; font-size: 11px; }
            
            h2 { font-size: 12px; font-weight: 700; margin: 20px 0 8px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; }
            th { background: #f8fafc; padding: 6px 8px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; color: #4b5563; text-transform: uppercase; }
            th.right { text-align: right; }
            td { padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: middle; }
            td.right { text-align: right; }
            td.center { text-align: center; color: #9ca3af; }
            
            tr.alt { background: #f8fafc; }
            tfoot tr { background: #f1f5f9; font-weight: 700; }
            
            .usd { color: #059669; font-weight: 600; }
            .iqd { color: #2563eb; font-weight: 600; }
            .ret-usd { color: #dc2626; font-weight: 600; }
            .ret-iqd { color: #b91c1c; font-weight: 600; }
            
            .summary-container { margin-top: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            .summary-header { display: grid; grid-template-columns: 2fr 1fr 1fr; background: #f8fafc; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; font-size: 10px; color: #6b7280; text-transform: uppercase; }
            .summary-header div:nth-child(2), .summary-header div:nth-child(3) { text-align: right; }
            .summary-row { display: grid; grid-template-columns: 2fr 1fr 1fr; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; align-items: center; }
            .summary-row:last-child { border-bottom: none; }
            .summary-row.balance { background: #f0fdf4; border-top: 2px solid #bbf7d0; }
            .summary-label { font-weight: 500; color: #374151; }
            .summary-val { text-align: right; font-weight: 700; }
            
            .notes-box { margin-top: 20px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 10px; line-height: 1.5; color: #4b5563; }
            .notes-box strong { color: #1f2937; display: block; margin-bottom: 4px; }
            
            @media print { 
              body { padding: 0; } 
              .summary-container { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

const handleCompanySelect = async (company) => {
    setSelectedCompany(company);
    setShowModal(false);
    setIsLoading(true);
    setError(null);
    try {
      const [companyBills, returnsData] = await Promise.all([
        getCompanyBoughtBills(company.id),
        getReturnsForCompany(company.id),
      ]);

      // Group returns by returnBillNumber
      const returnsMap = new Map();

      returnsData.forEach((ret) => {
        let returnBillNumber = ret.returnBillNumber || ret.returnNumber || `BRET-${ret.id.slice(-6).toUpperCase()}`;

        if (!returnsMap.has(returnBillNumber)) {
          returnsMap.set(returnBillNumber, {
            id: returnBillNumber,
            returnBillNumber: returnBillNumber,
            billNumber: ret.billNumber,
            date: ret.returnDate || ret.date,
            note: ret.returnNote || "",
            totalUSD: 0,
            totalIQD: 0,
            items: [],
            paymentStatus: ret.paymentStatus,
          });
        }

        const group = returnsMap.get(returnBillNumber);
        const qty = Number(ret.returnQuantity) || 0;
        const itemCurrency = String(ret.currency || "USD").toUpperCase();

        // Extract price accurately with multiple fallbacks
        const priceUSD = Number(ret.returnPriceUSD || (itemCurrency === "USD" ? (ret.returnPrice || ret.netPrice || 0) : 0)) || 0;
        const priceIQD = Number(ret.returnPriceIQD || (itemCurrency === "IQD" ? (ret.returnPrice || ret.netPrice || 0) : 0)) || 0;

        if (itemCurrency === "USD" || priceUSD > 0) {
          group.totalUSD += qty * (priceUSD > 0 ? priceUSD : Number(ret.returnPrice || 0));
        }
        if (itemCurrency === "IQD" || priceIQD > 0) {
          group.totalIQD += qty * (priceIQD > 0 ? priceIQD : Number(ret.returnPrice || 0));
        }

        group.items.push(ret);

        if (!group.date && (ret.returnDate || ret.date)) {
          group.date = ret.returnDate || ret.date;
        }
        if (!group.note && ret.returnNote) {
          group.note = ret.returnNote;
        }
      });

      const groupedReturns = Array.from(returnsMap.values()).filter(
        (ret) => (ret.totalUSD > 0 || ret.totalIQD > 0) && ret.paymentStatus !== "Processed" && ret.paymentStatus !== "Paid"
      );

      setBills(companyBills);
      setReturns(groupedReturns);
    } catch (err) {
      console.error("Error loading company statement data:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const billTotals = bills.map((bill) => {
    const currency = bill.currency || "USD";
    const exchangeRate = bill.exchangeRate || 1500;
    
    let usd = 0;
    let iqd = 0;

    (bill.items || []).forEach(item => {
      const q = Number(item.quantity) || 0;
      const c = item.currency || item.originalCurrency || currency;
      if (c === "USD") {
        usd += (Number(item.basePriceUSD || item.netPriceUSD || item.price || 0)) * q;
      } else {
        iqd += (Number(item.basePriceIQD || item.netPriceIQD || item.price || 0)) * q;
      }
    });

    if (currency === "USD" && usd === 0 && bill.totalAmountUSD) usd = bill.totalAmountUSD;
    if (currency === "IQD" && iqd === 0 && bill.totalAmountIQD) iqd = bill.totalAmountIQD;

    return { usd: usd > 0 ? usd : null, iqd: iqd > 0 ? iqd : null, currency };
  });

  const totalBeforeReturnUSD = billTotals.reduce((s, t) => s + (t.usd || 0), 0);
  const totalBeforeReturnIQD = billTotals.reduce((s, t) => s + (t.iqd || 0), 0);

  const totalReturnUSD = returns.reduce((s, r) => s + (r.totalUSD || 0), 0);
  const totalReturnIQD = returns.reduce((s, r) => s + (r.totalIQD || 0), 0);

  const totalAfterReturnUSD = totalBeforeReturnUSD - totalReturnUSD;
  const totalAfterReturnIQD = totalBeforeReturnIQD - totalReturnIQD;

  if (showModal) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", padding: "32px 24px" }}>
        <CompanySelectionModal onSelect={handleCompanySelect} onClose={() => setShowModal(false)} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)" }}>
        <div className="modern-spinner"></div>
        <p style={{ marginTop: "1.5rem", color: "#64748b", fontSize: "0.95rem", fontWeight: "500", letterSpacing: "0.5px" }}>Compiling statement...</p>
        <style dangerouslySetInnerHTML={{__html: `
          .modern-spinner { width: 40px; height: 40px; border-radius: 50%; border: 3px solid #E5E7EB; border-top-color: #8B5CF6; animation: spin 1s linear infinite; }
          @keyframes spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }
        `}} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", padding: "32px 24px" }}>
        <div style={{ backgroundColor: "#fef2f2", padding: "20px", borderRadius: "12px", color: "#991b1b", border: "1px solid #fecaca" }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: "12px", textDecoration: "underline", background: "none", border: "none", color: "#991b1b", cursor: "pointer", fontWeight: "600" }}>
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (!selectedCompany) return null;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)", padding: "1rem", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '1000px', margin: "0 auto" }}>
        
        {/* Top Control Header */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", backgroundColor: "white", padding: "1.25rem 1.5rem", borderRadius: "1rem", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: "1px solid #E5E7EB" }}>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#111827", margin: 0 }}>
              Statement Overview (All Branches)
            </h1>
            <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: "4px 0 0 0" }}>{selectedCompany.name}</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              onClick={() => setShowModal(true)}
              style={{ padding: "0.6rem 1rem", borderRadius: "0.5rem", fontSize: "0.85rem", fontWeight: "600", cursor: "pointer", backgroundColor: "white", color: "#4b5563", border: "1px solid #d1d5db", transition: "all 0.2s" }}
            >
              Change Company
            </button>
            <button
              onClick={handlePrint}
              disabled={!bills.length && !returns.length}
              style={{ padding: "0.6rem 1rem", borderRadius: "0.5rem", fontSize: "0.85rem", fontWeight: "600", cursor: !bills.length && !returns.length ? "not-allowed" : "pointer", backgroundColor: "#8B5CF6", color: "white", border: "none", opacity: !bills.length && !returns.length ? 0.5 : 1, boxShadow: "0 2px 4px rgba(139, 92, 246, 0.2)" }}
            >
              🖨️ Print Statement
            </button>
          </div>
        </div>

        {/* Printable Area Wrapper */}
        <div style={{ backgroundColor: "white", padding: "1.5rem 1rem", borderRadius: "1rem", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)", border: "1px solid #E5E7EB" }}>
          <div ref={printRef}>
            
            {/* Print Header */}
            <div className="header-container" style={{ textAlign: "center", marginBottom: "2rem", borderBottom: "2px solid #f1f5f9", paddingBottom: "1.5rem" }}>
              <h1 style={{ fontSize: "1.4rem", fontWeight: "800", color: "#111827", margin: "0 0 4px 0" }}>
                {selectedCompany.name} - کشف حساب کڕین (سەرجەم لقییەکان)
              </h1>
              <p className="subtitle" style={{ fontSize: "0.85rem", color: "#6b7280", margin: 0 }}>
                Generated on: {formatDate(new Date())}
              </p>
            </div>

            {/* Unpaid Bills */}
            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "0.9rem", fontWeight: "700", color: "#374151", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Unpaid Purchase Bills
              </h2>
              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: "600px" }}>
                  <thead>
                    <tr>
                      <th style={{ background: "#f8fafc", padding: "8px 10px", textAlign: "left", border: "1px solid #e2e8f0", color: "#4b5563", fontWeight: "600" }}>Bill #</th>
                      <th style={{ background: "#f8fafc", padding: "8px 10px", textAlign: "left", border: "1px solid #e2e8f0", color: "#4b5563", fontWeight: "600" }}>Company Bill #</th>
                      <th style={{ background: "#f8fafc", padding: "8px 10px", textAlign: "left", border: "1px solid #e2e8f0", color: "#4b5563", fontWeight: "600" }}>Branch</th>
                      <th style={{ background: "#f8fafc", padding: "8px 10px", textAlign: "left", border: "1px solid #e2e8f0", color: "#4b5563", fontWeight: "600" }}>Date</th>
                      <th className="right" style={{ background: "#f8fafc", padding: "8px 10px", textAlign: "right", border: "1px solid #e2e8f0", color: "#4b5563", fontWeight: "600" }}>Amount ($)</th>
                      <th className="right" style={{ background: "#f8fafc", padding: "8px 10px", textAlign: "right", border: "1px solid #e2e8f0", color: "#4b5563", fontWeight: "600" }}>Amount (IQD)</th>
                      <th style={{ background: "#f8fafc", padding: "8px 10px", textAlign: "left", border: "1px solid #e2e8f0", color: "#4b5563", fontWeight: "600", width: "20%" }}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((bill, idx) => {
                      const { usd, iqd } = billTotals[idx];
                      return (
                        <tr key={bill.id || idx} className={idx % 2 === 0 ? "" : "alt"} style={{ background: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                          <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", fontWeight: "600", color: "#1f2937" }}>#{bill.billNumber}</td>
                          <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", color: "#4b5563" }}>{bill.companyBillNumber || "N/A"}</td>
                          <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", color: "#4b5563" }}>
                            <span style={{ backgroundColor: bill.branch === "Slemany" ? "#dcfce7" : "#fef3c7", color: bill.branch === "Slemany" ? "#166534" : "#92400e", padding: "2px 6px", borderRadius: "4px", fontWeight: "600" }}>
                              {bill.branch || "Slemany"}
                            </span>
                          </td>
                          <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", color: "#4b5563" }}>{formatDate(bill.date)}</td>
                          {usd ? (
                            <td className="right usd" style={{ padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "right", color: "#059669", fontWeight: "600" }}>${formatCurrency(usd)}</td>
                          ) : (
                            <td className="center" style={{ padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "center", color: "#9ca3af" }}>—</td>
                          )}
                          {iqd ? (
                            <td className="right iqd" style={{ padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "right", color: "#2563eb", fontWeight: "600" }}>{formatIQD(iqd)} IQD</td>
                          ) : (
                            <td className="center" style={{ padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "center", color: "#9ca3af" }}>—</td>
                          )}
                          <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", color: "#4b5563", fontSize: "0.75rem", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bill.billNote || "—"}</td>
                        </tr>
                      );
                    })}
                    {!bills.length && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", padding: "24px", color: "#9ca3af", border: "1px solid #e2e8f0" }}>
                          No unpaid purchase bills found
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#f1f5f9" }}>
                      <td colSpan="4" style={{ padding: "10px", border: "1px solid #e2e8f0", textAlign: "right", fontWeight: "700", color: "#4b5563", fontSize: "0.8rem" }}>TOTAL BOUGHT:</td>
                      <td className="right usd" style={{ padding: "10px", border: "1px solid #e2e8f0", textAlign: "right", color: "#059669", fontWeight: "700", fontSize: "0.9rem" }}>
                        {totalBeforeReturnUSD > 0 ? `$${formatCurrency(totalBeforeReturnUSD)}` : "—"}
                      </td>
                      <td className="right iqd" style={{ padding: "10px", border: "1px solid #e2e8f0", textAlign: "right", color: "#2563eb", fontWeight: "700", fontSize: "0.9rem" }}>
                        {totalBeforeReturnIQD > 0 ? `${formatIQD(totalBeforeReturnIQD)} IQD` : "—"}
                      </td>
                      <td style={{ padding: "10px", border: "1px solid #e2e8f0" }} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Returns */}
            {returns.length > 0 && (
              <div style={{ marginBottom: "2rem" }}>
                <h2 style={{ fontSize: "0.9rem", fontWeight: "700", color: "#991b1b", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Return Bills
                </h2>
                <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: "600px" }}>
                    <thead>
                      <tr>
                        <th style={{ background: "#fef2f2", padding: "8px 10px", textAlign: "left", border: "1px solid #fecaca", color: "#991b1b", fontWeight: "600" }}>Return Bill #</th>
                        <th style={{ background: "#fef2f2", padding: "8px 10px", textAlign: "left", border: "1px solid #fecaca", color: "#991b1b", fontWeight: "600" }}>Original Bill</th>
                        <th style={{ background: "#fef2f2", padding: "8px 10px", textAlign: "left", border: "1px solid #fecaca", color: "#991b1b", fontWeight: "600" }}>Date</th>
                        <th className="right" style={{ background: "#fef2f2", padding: "8px 10px", textAlign: "right", border: "1px solid #fecaca", color: "#991b1b", fontWeight: "600" }}>Amount ($)</th>
                        <th className="right" style={{ background: "#fef2f2", padding: "8px 10px", textAlign: "right", border: "1px solid #fecaca", color: "#991b1b", fontWeight: "600" }}>Amount (IQD)</th>
                        <th style={{ background: "#fef2f2", padding: "8px 10px", textAlign: "left", border: "1px solid #fecaca", color: "#991b1b", fontWeight: "600", width: "25%" }}>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returns.map((ret, idx) => (
                        <tr key={ret.id || idx} style={{ background: idx % 2 === 0 ? "white" : "#fef2f2" }}>
                          <td style={{ padding: "8px 10px", border: "1px solid #fecaca", fontWeight: "600", color: "#7f1d1d" }}>
                            {ret.returnBillNumber}
                          </td>
                          <td style={{ padding: "8px 10px", border: "1px solid #fecaca", color: "#991b1b" }}>{ret.billNumber || "N/A"}</td>
                          <td style={{ padding: "8px 10px", border: "1px solid #fecaca", color: "#991b1b" }}>{formatDate(ret.date)}</td>
                          {ret.totalUSD > 0 ? (
                            <td className="right ret-usd" style={{ padding: "8px 10px", border: "1px solid #fecaca", textAlign: "right", color: "#dc2626", fontWeight: "600" }}>
                              -${formatCurrency(ret.totalUSD)}
                            </td>
                          ) : (
                            <td className="center" style={{ padding: "8px 10px", border: "1px solid #fecaca", textAlign: "center", color: "#fca5a5" }}>—</td>
                          )}
                          {ret.totalIQD > 0 ? (
                            <td className="right ret-iqd" style={{ padding: "8px 10px", border: "1px solid #fecaca", textAlign: "right", color: "#b91c1c", fontWeight: "600" }}>
                              -{formatIQD(ret.totalIQD)} IQD
                            </td>
                          ) : (
                            <td className="center" style={{ padding: "8px 10px", border: "1px solid #fecaca", textAlign: "center", color: "#fca5a5" }}>—</td>
                          )}
                          <td style={{ padding: "8px 10px", border: "1px solid #fecaca", color: "#991b1b", fontSize: "0.75rem", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ret.note || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#fee2e2" }}>
                        <td colSpan="3" style={{ padding: "10px", border: "1px solid #fecaca", textAlign: "right", fontWeight: "700", color: "#991b1b", fontSize: "0.8rem" }}>TOTAL RETURN:</td>
                        <td className="right ret-usd" style={{ padding: "10px", border: "1px solid #fecaca", textAlign: "right", color: "#dc2626", fontWeight: "700", fontSize: "0.9rem" }}>
                          {totalReturnUSD > 0 ? `-$${formatCurrency(totalReturnUSD)}` : "—"}
                        </td>
                        <td className="right ret-iqd" style={{ padding: "10px", border: "1px solid #fecaca", textAlign: "right", color: "#b91c1c", fontWeight: "700", fontSize: "0.9rem" }}>
                          {totalReturnIQD > 0 ? `-${formatIQD(totalReturnIQD)} IQD` : "—"}
                        </td>
                        <td style={{ padding: "10px", border: "1px solid #fecaca" }} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Summary Grid */}
            <div className="summary-container" style={{ marginTop: "2rem", border: "1px solid #e2e8f0", borderRadius: "12px", overflowX: "auto", background: "white" }}>
              <div style={{ minWidth: "400px" }}>
                <div className="summary-header" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", background: "#f8fafc", padding: "10px 16px", borderBottom: "1px solid #e2e8f0", fontWeight: "600", fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <div>Description</div>
                  <div style={{ textAlign: "right", color: "#059669" }}>USD ($)</div>
                  <div style={{ textAlign: "right", color: "#2563eb" }}>IQD</div>
                </div>
                
                <div className="summary-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "12px 16px", borderBottom: "1px solid #e2e8f0", alignItems: "center" }}>
                  <div className="summary-label" style={{ fontWeight: "500", color: "#4b5563", fontSize: "0.9rem" }}>Total Before Return</div>
                  <div className="summary-val" style={{ textAlign: "right", fontWeight: "600", color: "#059669", fontSize: "1.05rem" }}>
                    {totalBeforeReturnUSD > 0 ? `$${formatCurrency(totalBeforeReturnUSD)}` : "—"}
                  </div>
                  <div className="summary-val" style={{ textAlign: "right", fontWeight: "600", color: "#2563eb", fontSize: "1.05rem" }}>
                    {totalBeforeReturnIQD > 0 ? `${formatIQD(totalBeforeReturnIQD)} IQD` : "—"}
                  </div>
                </div>

                <div className="summary-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "12px 16px", borderBottom: "1px solid #e2e8f0", alignItems: "center" }}>
                  <div className="summary-label" style={{ fontWeight: "500", color: "#4b5563", fontSize: "0.9rem" }}>Total Returns</div>
                  <div className="summary-val" style={{ textAlign: "right", fontWeight: "600", color: "#dc2626", fontSize: "1.05rem" }}>
                    {totalReturnUSD > 0 ? `-$${formatCurrency(totalReturnUSD)}` : "—"}
                  </div>
                  <div className="summary-val" style={{ textAlign: "right", fontWeight: "600", color: "#b91c1c", fontSize: "1.05rem" }}>
                    {totalReturnIQD > 0 ? `-${formatIQD(totalReturnIQD)} IQD` : "—"}
                  </div>
                </div>

                <div className="summary-row balance" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "16px", background: "#f0fdf4", borderTop: "2px solid #bbf7d0", alignItems: "center" }}>
                  <div className="summary-label" style={{ fontWeight: "700", color: "#166534", fontSize: "1rem" }}>BALANCE DUE</div>
                  <div className="summary-val" style={{ textAlign: "right", fontWeight: "800", color: totalAfterReturnUSD >= 0 ? "#059669" : "#dc2626", fontSize: "1.2rem" }}>
                    {totalBeforeReturnUSD > 0 || totalReturnUSD > 0 ? `$${formatCurrency(totalAfterReturnUSD)}` : "—"}
                  </div>
                  <div className="summary-val" style={{ textAlign: "right", fontWeight: "800", color: totalAfterReturnIQD >= 0 ? "#2563eb" : "#b91c1c", fontSize: "1.2rem" }}>
                    {totalBeforeReturnIQD > 0 || totalReturnIQD > 0 ? `${formatIQD(totalAfterReturnIQD)} IQD` : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            {notes && (
              <div className="notes-box" style={{ marginTop: "24px", padding: "16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                <strong style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", color: "#1f2937", marginBottom: "4px" }}>Statement Notes:</strong>
                <div style={{ fontSize: "0.85rem", color: "#4b5563", whiteSpace: "pre-wrap", lineHeight: "1.5" }}>{notes}</div>
              </div>
            )}
          </div>
        </div>

        {/* Note Input Area */}
        <div style={{ marginTop: "1.5rem", backgroundColor: "white", borderRadius: "1rem", padding: "1.5rem 1rem", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: "1px solid #E5E7EB" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "#374151", marginBottom: "0.75rem" }}>Add Notes to Statement</h3>
          <textarea
            style={{ width: "100%", padding: "12px 16px", border: "1px solid #d1d5db", borderRadius: "0.5rem", fontSize: "0.9rem", minHeight: "80px", resize: "vertical", fontFamily: "inherit", outline: "none", transition: "border 0.2s" }}
            placeholder="Type any additional information here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onFocus={(e) => e.target.style.borderColor = "#8B5CF6"}
            onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
          />
        </div>
      </div>
    </div>
  );
};

export default BoughtStatementPage;