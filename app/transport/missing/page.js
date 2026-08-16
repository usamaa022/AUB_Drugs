"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getMissingTransportItems, resolveMissingTransportItem, formatDate } from "@/lib/data";
import { 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  RotateCcw, 
  Building2, 
  FileText, 
  Hash, 
  Calendar,
  MessageSquare,
  Search,
  Check
} from "lucide-react";

export default function MissingTransportItemsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [missingItems, setMissingItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedTargetBranch, setSelectedTargetBranch] = useState({});
  const [resolveQuantities, setResolveQuantities] = useState({});
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    loadData();
  }, [user, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMissingTransportItems(user.role === "superAdmin" ? "all" : user.branch);
      setMissingItems(data);
      setFilteredItems(data);

      const initialQty = {};
      const initialBranch = {};
      data.forEach(item => {
        initialQty[item.id] = item.quantity;
        initialBranch[item.id] = item.toBranch || "Slemany";
      });
      setResolveQuantities(initialQty);
      setSelectedTargetBranch(initialBranch);
    } catch (err) {
      console.error("Error loading missing items:", err);
      setError("Failed to load missing transport items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredItems(missingItems);
    } else {
      const q = searchQuery.toLowerCase().trim();
      setFilteredItems(
        missingItems.filter(item =>
          item.name?.toLowerCase().includes(q) ||
          item.barcode?.toLowerCase().includes(q) ||
          item.boughtBillNumber?.toString().toLowerCase().includes(q) ||
          item.senderNotes?.toLowerCase().includes(q) ||
          item.transportId?.toLowerCase().includes(q)
        )
      );
    }
  }, [searchQuery, missingItems]);

  const handleQtyChange = (itemId, maxAllowed, val) => {
    let parsed = parseInt(val, 10);
    if (isNaN(parsed)) parsed = 1;
    parsed = Math.max(1, Math.min(parsed, maxAllowed));
    setResolveQuantities(prev => ({ ...prev, [itemId]: parsed }));
  };

  const handleResolve = async (item) => {
    const target = selectedTargetBranch[item.id] || item.toBranch;
    const qtyToResolve = resolveQuantities[item.id] || item.quantity;

    const isPartial = qtyToResolve < item.quantity;
    const confirmMessage = isPartial
      ? `Confirm Partial Allocation:\n\n• Item: ${item.name}\n• Found Qty: ${qtyToResolve} of ${item.quantity} missing\n• Target Branch Store: ${target}\n• Remaining Missing: ${item.quantity - qtyToResolve} pcs\n\nAdd ${qtyToResolve} unit(s) to store inventory?`
      : `Confirm Complete Allocation:\n\n• Item: ${item.name}\n• Found Qty: ${qtyToResolve} pcs (All)\n• Target Branch Store: ${target}\n• Bought Bill: ${item.boughtBillNumber || "N/A"}\n\nAdd back to store inventory?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      setProcessingId(item.id);
      setError(null);
      const res = await resolveMissingTransportItem(item.id, target, user.uid, qtyToResolve);
      
      if (res.remainingMissing > 0) {
        setSuccess(`✅ Added ${qtyToResolve}x "${item.name}" to ${target}. (${res.remainingMissing} pcs still marked as missing).`);
      } else {
        setSuccess(`✅ Fully resolved ${qtyToResolve}x "${item.name}" and added to ${target} store inventory.`);
      }

      await loadData();
      setTimeout(() => setSuccess(null), 4500);
    } catch (err) {
      console.error("Error resolving missing item:", err);
      setError(`Failed to resolve item: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ width: "100%", minHeight: "70vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" }}>
        <div style={{ width: "36px", height: "36px", border: "3px solid #e2e8f0", borderTop: "3px solid #f59e0b", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <p style={{ marginTop: "1rem", color: "#64748b", fontWeight: 600, fontSize: "14px" }}>Loading missing items ledger...</p>
        <style>{`@keyframes spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }`}</style>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#f8fafc", padding: 0, margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", boxSizing: "border-box", overflowX: "hidden" }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
      `}</style>
      
      <div style={{ width: "100%", margin: 0, padding: 0, boxSizing: "border-box" }}>
        
        {/* Top Header Card */}
        <div style={{ backgroundColor: "white", padding: "20px 24px", borderRadius: 0, borderBottom: "1px solid #e2e8f0", marginBottom: "20px", width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", width: "100%" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ backgroundColor: "#fef3c7", padding: "8px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AlertTriangle size={24} color="#d97706" />
                </div>
                <h1 style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                  Missing Transport Items
                </h1>
              </div>
              <p style={{ color: "#64748b", fontSize: "14px", margin: "6px 0 0 0" }}>
                Track transit shortages, inspect original sender notes, and allocate found quantities (full or partial) into branch stock.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", backgroundColor: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "6px 12px", width: "240px" }}>
                <Search size={16} color="#94a3b8" style={{ marginRight: "8px" }} />
                <input
                  type="text"
                  placeholder="Search item, barcode, bill..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ border: "none", background: "transparent", outline: "none", fontSize: "13px", color: "#1e293b", width: "100%" }}
                />
              </div>

              <button
                onClick={loadData}
                style={{ padding: "8px 16px", backgroundColor: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: "8px", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}
              >
                🔄 Refresh
              </button>
              <button
                onClick={() => router.push("/transport/transportHistory")}
                style={{ padding: "8px 16px", backgroundColor: "#3b82f6", color: "white", border: "none", borderRadius: "8px", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}
              >
                ← Back to Transports
              </button>
            </div>
          </div>
        </div>

        {/* Error & Success Banners */}
        <div style={{ padding: "0 24px", width: "100%", boxSizing: "border-box" }}>
          {error && (
            <div style={{ padding: "14px 18px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#991b1b", fontSize: "14px", fontWeight: "600", marginBottom: "16px", width: "100%", boxSizing: "border-box" }}>
              ❌ {error}
            </div>
          )}
          {success && (
            <div style={{ padding: "14px 18px", backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "8px", color: "#065f46", fontSize: "14px", fontWeight: "600", marginBottom: "16px", width: "100%", boxSizing: "border-box" }}>
              {success}
            </div>
          )}
        </div>

        {/* Main Table */}
        {filteredItems.length === 0 ? (
          <div style={{ backgroundColor: "white", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", borderRadius: 0, padding: "60px 24px", textAlign: "center", width: "100%", boxSizing: "border-box" }}>
            <CheckCircle2 size={52} color="#10b981" style={{ margin: "0 auto 12px" }} />
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: "0 0 6px 0" }}>No Missing Items</h3>
            <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
              {searchQuery ? "No missing item matches your search filter." : "All shipments are completely accounted for across all branches."}
            </p>
          </div>
        ) : (
          <div style={{ backgroundColor: "white", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", borderRadius: 0, overflow: "hidden", width: "100%", margin: 0 }}>
            <div style={{ overflowX: "auto", width: "100%", boxSizing: "border-box" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px", minWidth: "980px", margin: 0 }}>
                <thead>
                  <tr style={{ backgroundColor: "#34495e", color: "white", borderBottom: "1px solid #475569" }}>
                    <th style={{ padding: "12px 18px", fontWeight: "700" }}>Item & Batch Details</th>
                    <th style={{ padding: "12px 18px", fontWeight: "700" }}>Barcode</th>
                    <th style={{ padding: "12px 18px", fontWeight: "700" }}>Transport Context</th>
                    <th style={{ padding: "12px 18px", fontWeight: "700", textAlign: "center" }}>Missing Quantity</th>
                    <th style={{ padding: "12px 18px", fontWeight: "700" }}>Sender Notes</th>
                    <th style={{ padding: "12px 18px", fontWeight: "700", textAlign: "right" }}>Action & Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => {
                    const resolveQty = resolveQuantities[item.id] !== undefined ? resolveQuantities[item.id] : item.quantity;
                    const isPartial = resolveQty < item.quantity;
                    const targetBranch = selectedTargetBranch[item.id] || item.toBranch;

                    return (
                      <tr 
                        key={item.id || idx} 
                        style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: idx % 2 === 0 ? "white" : "#fafafa" }}
                      >
                        {/* 1. Item Details */}
                        <td style={{ padding: "16px 18px", verticalAlign: "top" }}>
                          <div style={{ fontWeight: "700", color: "#0f172a", fontSize: "14px" }}>{item.name}</div>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px", flexWrap: "wrap" }}>
                            {item.boughtBillNumber && item.boughtBillNumber !== "N/A" ? (
                              <span style={{ fontSize: "11px", backgroundColor: "#e2e8f0", color: "#1e293b", padding: "2px 6px", borderRadius: "4px", fontWeight: "600" }}>
                                Bill #{item.boughtBillNumber}
                              </span>
                            ) : (
                              <span style={{ fontSize: "11px", color: "#94a3b8" }}>No Bill #</span>
                            )}
                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                              Exp: {item.expireDate ? formatDate(item.expireDate) : "N/A"}
                            </span>
                          </div>
                        </td>

                        {/* 2. Barcode */}
                        <td style={{ padding: "16px 18px", fontFamily: "monospace", color: "#475569", fontWeight: "600", verticalAlign: "top" }}>
                          {item.barcode}
                        </td>

                        {/* 3. Transport Route */}
                        <td style={{ padding: "16px 18px", verticalAlign: "top" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "600", color: "#334155" }}>
                            <span>{item.fromBranch}</span>
                            <ArrowRight size={13} color="#94a3b8" />
                            <span style={{ color: "#2563eb" }}>{item.toBranch}</span>
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>
                            Sent: {item.sentQuantity} | Recv: {item.receivedQuantity}
                          </div>
                          <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "1px" }}>
                            {item.reportedAt ? formatDate(item.reportedAt) : "N/A"}
                          </div>
                        </td>

                        {/* 4. Missing Qty Badge */}
                        <td style={{ padding: "16px 18px", textAlign: "center", verticalAlign: "top" }}>
                          <div style={{ display: "inline-block", backgroundColor: "#fef3c7", border: "1px solid #fde68a", color: "#b45309", padding: "4px 10px", borderRadius: "20px", fontWeight: "800", fontSize: "13px" }}>
                            -{item.quantity} pcs
                          </div>
                        </td>

                        {/* 5. Sender Notes Callout */}
                        <td style={{ padding: "16px 18px", verticalAlign: "top", maxWidth: "240px" }}>
                          {item.senderNotes ? (
                            <div style={{ backgroundColor: "#fffbeb", borderLeft: "3px solid #f59e0b", padding: "6px 10px", borderRadius: "0 6px 6px 0", fontSize: "12px", color: "#78350f" }}>
                              <div style={{ fontWeight: "700", display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                <MessageSquare size={12} /> Note:
                              </div>
                              <div style={{ wordBreak: "break-word", lineHeight: 1.3 }}>{item.senderNotes}</div>
                            </div>
                          ) : (
                            <span style={{ color: "#cbd5e1", fontStyle: "italic", fontSize: "12px" }}>No sender note</span>
                          )}
                        </td>

                        {/* 6. Action / Partial Input / Branch Picker */}
                        <td style={{ padding: "16px 18px", textAlign: "right", verticalAlign: "top" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                            
                            {/* Controls Row: Qty Stepper & Branch Picker */}
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                <label style={{ fontSize: "10px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Found Qty</label>
                                <input
                                  type="number"
                                  min="1"
                                  max={item.quantity}
                                  value={resolveQty}
                                  onChange={(e) => handleQtyChange(item.id, item.quantity, e.target.value)}
                                  style={{
                                    width: "55px",
                                    padding: "4px 6px",
                                    border: isPartial ? "2px solid #f59e0b" : "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    textAlign: "center",
                                    fontSize: "13px",
                                    fontWeight: "700",
                                    outline: "none",
                                    backgroundColor: isPartial ? "#fffbeb" : "white"
                                  }}
                                />
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                                <label style={{ fontSize: "10px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>To Store</label>
                                <select
                                  value={targetBranch}
                                  onChange={(e) =>
                                    setSelectedTargetBranch((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value,
                                    }))
                                  }
                                  style={{
                                    padding: "5px 8px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    backgroundColor: "white",
                                    outline: "none",
                                    cursor: "pointer"
                                  }}
                                >
                                  <option value="Slemany">Slemany</option>
                                  <option value="Erbil">Erbil</option>
                                </select>
                              </div>
                            </div>

                            {/* Submit Action Button */}
                            <button
                              onClick={() => handleResolve(item)}
                              disabled={processingId === item.id}
                              style={{
                                padding: "6px 14px",
                                backgroundColor: isPartial ? "#d97706" : "#059669",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                fontWeight: "700",
                                fontSize: "12px",
                                cursor: processingId === item.id ? "not-allowed" : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                transition: "background 0.15s"
                              }}
                            >
                              {processingId === item.id ? (
                                "Allocating..."
                              ) : (
                                <>
                                  <Check size={14} />
                                  {isPartial ? `Add Partial (${resolveQty})` : `Add Found (${resolveQty})`}
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}