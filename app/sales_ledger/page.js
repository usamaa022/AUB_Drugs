"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { getSoldBills, getAllReturns, getSoldPayments } from "../../lib/data";
import { Filter, Search } from "lucide-react";

// --- Advanced Filter Operators ---
const STRING_OPERATORS = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "startsWith", label: "Starts with" },
  { value: "endsWith", label: "Ends with" },
  { value: "isEmpty", label: "Is empty" },
  { value: "isNotEmpty", label: "Is not empty" }
];

const NUMBER_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "notEquals", label: "Not equals" },
  { value: "greaterThan", label: "> Greater than" },
  { value: "greaterThanOrEqual", label: ">= Greater or eq" },
  { value: "lessThan", label: "< Less than" },
  { value: "lessThanOrEqual", label: "<= Less or eq" },
  { value: "isEmpty", label: "Is empty" },
  { value: "isNotEmpty", label: "Is not empty" }
];

// NRT font style
const nrtFontStyle = {
  fontFamily: 'var(--font-nrt-regular), "NRT Regular", Tahoma, sans-serif',
};
const nrtFontBoldStyle = {
  fontFamily: 'var(--font-nrt-bold), "NRT Bold", Tahoma, sans-serif',
  fontWeight: '700',
};

// Color generation for Payment ID Links
const getPaymentColorHex = (paymentNumber) => {
  if (!paymentNumber || paymentNumber === "Unpaid") return null;
  let hash = 0;
  for (let i = 0; i < paymentNumber.length; i++) {
    hash = paymentNumber.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#3b82f6", "#10b981", "#8b5cf6", "#f97316", "#ec4899", 
    "#14b8a6", "#6366f1", "#f43f5e", "#eab308", "#0ea5e9",
    "#22c55e", "#a855f7", "#ef4444", "#06b6d4"
  ];
  return colors[Math.abs(hash) % colors.length];
};

// Formatters
const formatDateTime = (date) => {
  if (!date) return "N/A";
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return "N/A";
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return "N/A";
  }
};

const formatUSD = (amount) => {
  if (amount === undefined || amount === null || amount === 0) return "-";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
};

const formatIQD = (amount) => {
  if (amount === undefined || amount === null || amount === 0) return "-";
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0
  }).format(amount) + " IQD";
};

// DEEP SCANNER
const extractReferences = (obj, foundIds) => {
  if (!obj) return;
  if (Array.isArray(obj)) {
    obj.forEach(item => extractReferences(item, foundIds));
  } else if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isRefKey = lowerKey.includes('id') || lowerKey.includes('bill') || lowerKey.includes('num') || lowerKey.includes('ref');
      
      if (typeof value === 'string') {
        if (isRefKey || value.length >= 15) {
          foundIds.add(value.trim());
        }
      } else if (typeof value === 'number' && isRefKey) {
        foundIds.add(String(value));
      } else if (typeof value === 'object') {
        extractReferences(value, foundIds);
      }
    }
  }
};

// =========================================================================
// DEFINED OUTSIDE TO PREVENT RE-RENDERS & FIX TEXT BOX FOCUS BUGS
// =========================================================================
const ExcelFilterDropdown = ({ 
  columnKey, type = "string",
  allData, selectedPharmacy,
  columnFilters, activeFilterDropdown, setActiveFilterDropdown,
  handleUpdateColumnFilter 
}) => {
  const [search, setSearch] = useState("");
  const isOpen = activeFilterDropdown === columnKey;
  const operators = type === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;
  const filterState = columnFilters[columnKey] || { operator: operators[0].value, textValue: '', selectedValues: [] };
  const { operator, textValue, selectedValues } = filterState;

  const uniqueValues = useMemo(() => {
    const vals = new Set();
    allData.filter(r => r.pharmacyName === selectedPharmacy).forEach(item => {
      let val = "";
      if (columnKey === 'date') val = formatDateTime(item.date);
      if (columnKey === 'type') val = item.type;
      if (columnKey === 'documentNumber') val = item.documentNumber;
      if (columnKey === 'amountUSD') val = Math.abs(item.amountUSD);
      if (columnKey === 'amountIQD') val = Math.abs(item.amountIQD);
      if (columnKey === 'status') val = item.status;
      if (columnKey === 'paymentNumber') val = item.paymentNumber || "";
      vals.add(String(val || ""));
    });
    return Array.from(vals).sort();
  }, [allData, selectedPharmacy, columnKey]);

  const displayValues = uniqueValues.filter(v => v.toLowerCase().includes(search.toLowerCase()));
  const isActive = !!(textValue || (selectedValues && selectedValues.length > 0) || ['isEmpty', 'isNotEmpty'].includes(operator));

  const handleCheckbox = (val, checked) => {
    const current = selectedValues || [];
    const updated = checked ? [...current, val] : current.filter(v => v !== val);
    handleUpdateColumnFilter(columnKey, { selectedValues: updated });
  };

  const handleSelectAll = (checked) => {
    handleUpdateColumnFilter(columnKey, { selectedValues: checked ? [...uniqueValues] : [] });
  };

  return (
    <div className="filter-dropdown-container no-print" style={{ position: "relative", display: "inline-block" }}>
      <div
        onClick={(e) => { 
          e.stopPropagation(); 
          setActiveFilterDropdown(isOpen ? null : columnKey); 
        }}
        style={{ 
          cursor: "pointer", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          padding: "0.25rem", 
          borderRadius: "0.375rem", 
          background: isActive ? "#dbeafe" : "transparent", 
          color: isActive ? "#2563eb" : "#bdc3c7" 
        }}
      >
        <Filter size={14} />
      </div>
      {isOpen && (
    <div 
          style={{ 
            position: "absolute", 
            top: "100%", 
            right: 0, 
            marginTop: "0.5rem", 
            background: "white", 
            border: "1px solid #cbd5e1", 
            borderRadius: "0.5rem", 
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)", 
            zIndex: 99999, 
            width: "260px", 
            display: "flex", 
            flexDirection: "column", 
            color: "#2c3e50" 
          }} 
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Top Section: Operator Select & Value Input stacked vertically */}
          <div 
            style={{ 
              padding: "0.75rem", 
              borderBottom: "1px solid #e2e8f0", 
              backgroundColor: "#f8fafc", 
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              width: "100%"
            }}
          >
            <select 
              value={operator || operators[0].value} 
              onChange={(e) => handleUpdateColumnFilter(columnKey, { operator: e.target.value })} 
              style={{ 
                width: "100%", 
                padding: "0.45rem 0.5rem", 
                borderRadius: "0.375rem", 
                border: "1px solid #cbd5e1", 
                fontSize: "0.875rem", 
                outline: "none",
                boxSizing: "border-box",
                backgroundColor: "white",
                color: "#2c3e50"
              }}
            >
              {operators.map(op => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
            
            {!['isEmpty', 'isNotEmpty'].includes(operator) && (
              <input 
                type={type === "number" ? "number" : "text"} 
                placeholder="Value..." 
                value={textValue || ""} 
                onChange={(e) => handleUpdateColumnFilter(columnKey, { textValue: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()} 
                style={{ 
                  width: "100%", 
                  padding: "0.45rem 0.5rem", 
                  borderRadius: "0.375rem", 
                  border: "1px solid #cbd5e1", 
                  fontSize: "0.875rem", 
                  outline: "none", 
                  boxSizing: "border-box",
                  backgroundColor: "white",
                  color: "#2c3e50"
                }} 
              />
            )}
          </div>
          
          {/* Middle Section: Checkbox Search & List */}
          <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: "0.375rem", padding: "0.25rem 0.5rem", marginBottom: "0.5rem", backgroundColor: "white" }}>
              <Search size={14} color="#94a3b8" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                onKeyDown={(e) => e.stopPropagation()}
                style={{ border: "none", outline: "none", width: "100%", fontSize: "0.875rem", marginLeft: "0.5rem", backgroundColor: "transparent" }} 
              />
            </div>
            
            <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer", borderBottom: "1px solid #f1f5f9", paddingBottom: "4px" }}>
                <input 
                  type="checkbox" 
                  checked={selectedValues.length === uniqueValues.length && uniqueValues.length > 0} 
                  onChange={(e) => handleSelectAll(e.target.checked)} 
                />
                <span>(Select All)</span>
              </label>
              {displayValues.map(val => (
                <label key={val} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={selectedValues.includes(val)} 
                    onChange={(e) => handleCheckbox(val, e.target.checked)} 
                  />
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {val || "(Empty)"}
                  </span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Bottom Actions: Clear & Apply */}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", padding: "0.75rem", backgroundColor: "#f8fafc" }}>
            <button 
              onClick={() => handleUpdateColumnFilter(columnKey, { operator: operators[0].value, textValue: '', selectedValues: [] })} 
              style={{ background: "transparent", border: "none", color: "#ef4444", fontWeight: 600, cursor: "pointer" }}
            >
              Clear
            </button>
            <button 
              onClick={() => setActiveFilterDropdown(null)} 
              style={{ background: "#2563eb", border: "none", color: "white", padding: "0.4rem 1rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600 }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const TableHeader = ({ 
  title, columnKey, type = "string", colWidth, 
  handleSort, getSortIcon, 
  allData, selectedPharmacy, columnFilters, activeFilterDropdown, setActiveFilterDropdown, handleUpdateColumnFilter 
}) => {
  const isActive = activeFilterDropdown === columnKey;
  
  return (
    <th style={{ 
      backgroundColor: "#34495e", color: "white", padding: "12px 10px", 
      textAlign: "left", fontSize: "14px", fontFamily: "'NRT-Bd', sans-serif", 
      whiteSpace: "nowrap", borderRight: "1px solid #576574", 
      width: colWidth || "auto", 
      position: "relative", // Needed so z-index works correctly locally
      zIndex: isActive ? 9999 : 1 // Elevates the active header above siblings
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
        <div onClick={() => handleSort(columnKey)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", flex: 1 }}>
          {title} <span className="no-print" style={{ fontSize: "11px", color: "#bdc3c7" }}>{getSortIcon(columnKey)}</span>
        </div>
        <ExcelFilterDropdown 
          columnKey={columnKey} type={type} 
          allData={allData} selectedPharmacy={selectedPharmacy}
          columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} 
          setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter}
        />
      </div>
    </th>
  );
};

// =========================================================================
// MAIN COMPONENT
// =========================================================================
export default function SalesLedgerPage() {
  const [allData, setAllData] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pharmacySearch, setPharmacySearch] = useState("");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.filter-dropdown-container')) {
        setActiveFilterDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    fetchLedgerData();
  }, []);

const fetchLedgerData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [bills, returns, payments] = await Promise.all([
        getSoldBills(),
        getAllReturns(),
        getSoldPayments()
      ]);

      const normalizedData = [];
      const pharmacySet = new Set();

      // ==========================================================
      // 1. BUILD BI-DIRECTIONAL PAYMENT MAP
      // ==========================================================
      const paymentMap = new Map();
      
      payments.forEach(pay => {
        const payNum = pay.paymentNumber || pay.paymentId || pay.transactionId || pay.id;
        if (!payNum) return;
        
        const registerId = (val) => {
          if (!val) return;
          if (typeof val === "string" || typeof val === "number") {
            const clean = String(val).trim().toLowerCase();
            if (clean && clean !== "undefined" && clean !== "null") {
              paymentMap.set(clean, payNum);
            }
          } else if (typeof val === "object") {
            // If the array contains object items (e.g. { id, documentId, returnBillNumber })
            if (val.id) registerId(val.id);
            if (val.documentId) registerId(val.documentId);
            if (val.docId) registerId(val.docId);
            if (val.returnBillNumber) registerId(val.returnBillNumber);
            if (val.returnId) registerId(val.returnId);
            if (val.billNumber) registerId(val.billNumber);
            if (val.billId) registerId(val.billId);
          }
        };

        // Standard payment properties
        registerId(pay.billId);
        registerId(pay.soldBillId);
        registerId(pay.returnId);
        registerId(pay.billNumber);
        registerId(pay.documentNumber);
        registerId(pay.paymentNumber);
        registerId(pay.paymentId);
        registerId(pay.returnBillNumber);
        registerId(pay.id);

        // Arrays containing IDs or objects
        if (Array.isArray(pay.selectedSoldBills)) pay.selectedSoldBills.forEach(registerId);
        if (Array.isArray(pay.selectedBills)) pay.selectedBills.forEach(registerId);
        if (Array.isArray(pay.billIds)) pay.billIds.forEach(registerId);
        
        // Return arrays
        if (Array.isArray(pay.selectedReturns)) pay.selectedReturns.forEach(registerId);
        if (Array.isArray(pay.returns)) pay.returns.forEach(registerId);
        if (Array.isArray(pay.selectedReturnBills)) pay.selectedReturnBills.forEach(registerId);
        if (Array.isArray(pay.items)) pay.items.forEach(registerId);

        // Deep recursive scan
        const deepScan = (obj) => {
          if (!obj) return;
          if (Array.isArray(obj)) {
            obj.forEach(deepScan);
          } else if (typeof obj === "object") {
            Object.entries(obj).forEach(([key, val]) => {
              const lowerKey = key.toLowerCase();
              if (lowerKey.includes("id") || lowerKey.includes("bill") || lowerKey.includes("return") || lowerKey.includes("num") || lowerKey.includes("ref")) {
                registerId(val);
              } else if (typeof val === "object") {
                deepScan(val);
              }
            });
          }
        };
        deepScan(pay);
      });

      // ==========================================================
      // 2. Process Sold Bills
      // ==========================================================
      bills.forEach(bill => {
        const pName = bill.pharmacyName || "Unknown";
        pharmacySet.add(pName);
        
        let payNum = bill.paymentNumber || bill.paymentId || bill.linkedPayment || null;
        
        if (!payNum) {
          const identifiers = [
            String(bill.id || ""),
            String(bill.billNumberDisplay || ""),
            String(bill.billNumber || ""),
            String(bill.documentNumber || "")
          ];
          for (const id of identifiers) {
            if (!id || id === "undefined" || id === "null") continue;
            const found = paymentMap.get(id.toLowerCase());
            if (found) {
              payNum = found;
              break;
            }
          }
        }

        let currentStatus = "Unpaid";
        const statusStr = String(bill.paymentStatus || bill.status || "").toLowerCase();
        const isMarkedPaid = bill.isPaid === true || statusStr === "paid" || statusStr === "completed" || statusStr === "processed";
        if (payNum || isMarkedPaid) currentStatus = "Paid";

        let bUSD = bill.totalAmountUSD || bill.amountUSD || 0;
        let bIQD = bill.totalAmountIQD || bill.amountIQD || 0;
        if (bUSD === 0 && bIQD === 0 && bill.totalAmount) {
          const curr = String(bill.priceType || bill.currency || 'USD').toUpperCase();
          if (curr === 'IQD' || curr.includes('DINAR')) bIQD = bill.totalAmount;
          else bUSD = bill.totalAmount;
        }

        normalizedData.push({
          id: bill.id,
          type: "Sold Bill",
          date: new Date(bill.date || bill.createdAt),
          documentNumber: bill.billNumberDisplay || bill.billNumber || bill.id,
          pharmacyName: pName,
          amountUSD: Math.abs(bUSD),
          amountIQD: Math.abs(bIQD),
          status: currentStatus,
          paymentNumber: payNum,
        });
      });

      // ==========================================================
      // 3. Process Returns
      // ==========================================================
      returns.forEach(ret => {
        const pName = ret.pharmacyName || "Unknown";
        pharmacySet.add(pName);
        
        let payNum = ret.paymentNumber || ret.paymentId || ret.returnPaymentNumber || ret.linkedPayment || null;
        
        if (!payNum) {
          // Check all possible aliases including Firestore documentId and returnBillNumber
          const identifiers = [
            String(ret.documentId || ""),
            String(ret.docId || ""),
            String(ret.id || ""),
            String(ret.returnBillNumber || ""),
            String(ret.documentNumber || ""),
            String(ret.pharmacyReturnBillNumber || "")
          ];
          
          for (const id of identifiers) {
            if (!id || id === "undefined" || id === "null") continue;
            const found = paymentMap.get(id.toLowerCase());
            if (found) {
              payNum = found;
              break;
            }
          }
        }

        // Direct matching fallback against all payments
        if (!payNum) {
          for (const pay of payments) {
            const pNum = pay.paymentNumber || pay.paymentId || pay.transactionId || pay.id;
            if (!pNum) continue;

            const selectedList = [
              ...(Array.isArray(pay.selectedReturns) ? pay.selectedReturns : []),
              ...(Array.isArray(pay.returns) ? pay.returns : []),
              ...(Array.isArray(pay.selectedReturnBills) ? pay.selectedReturnBills : [])
            ];

            const matches = selectedList.some(entry => {
              if (!entry) return false;
              const val = (typeof entry === "object" ? (entry.id || entry.documentId || entry.returnBillNumber) : entry).toString().toLowerCase();
              return val === String(ret.documentId || "").toLowerCase() ||
                     val === String(ret.id || "").toLowerCase() ||
                     val === String(ret.returnBillNumber || "").toLowerCase();
            });

            if (matches) {
              payNum = pNum;
              break;
            }
          }
        }

        let currentStatus = "Unpaid";
        const statusStr = String(ret.paymentStatus || ret.status || "").toLowerCase();
        const isMarkedPaid = ret.isPaid === true || statusStr === "paid" || statusStr === "completed" || statusStr === "processed";
        if (payNum || isMarkedPaid) currentStatus = "Paid";

        let retUSD = ret.totalReturnAmountUSD || ret.amountUSD || 0;
        let retIQD = ret.totalReturnAmountIQD || ret.amountIQD || 0;
        if (retUSD === 0 && retIQD === 0 && ret.totalReturnAmount) {
          const curr = String(ret.priceType || ret.currency || 'USD').toUpperCase();
          if (curr === 'IQD' || curr.includes('DINAR')) retIQD = ret.totalReturnAmount;
          else retUSD = ret.totalReturnAmount;
        }

        normalizedData.push({
          id: ret.id,
          type: "Return",
          date: new Date(ret.returnDate || ret.date || ret.createdAt),
          documentNumber: ret.returnBillNumber || ret.documentNumber || ret.id,
          pharmacyName: pName,
          amountUSD: -Math.abs(retUSD), 
          amountIQD: -Math.abs(retIQD),
          status: currentStatus,
          paymentNumber: payNum,
        });
      });

      // ==========================================================
      // 4. Process Payments
      // ==========================================================
      payments.forEach(pay => {
        const pName = pay.pharmacyName || "Unknown";
        pharmacySet.add(pName);
        
        let payUSD = pay.amountUSD || pay.totalAmountUSD || pay.netAmountUSD || pay.paymentAmountUSD || pay.paidAmountUSD || 0;
        let payIQD = pay.amountIQD || pay.totalAmountIQD || pay.netAmountIQD || pay.paymentAmountIQD || pay.paidAmountIQD || 0;

        if (payUSD === 0 && payIQD === 0) {
          const genericAmount = pay.amount || pay.totalAmount || pay.paidAmount || pay.paymentAmount || 0;
          if (genericAmount > 0) {
            const currency = String(pay.currency || pay.priceType || 'USD').toUpperCase();
            if (currency === 'IQD' || currency.includes('DINAR')) payIQD = genericAmount;
            else payUSD = genericAmount;
          }
        }

        const payNum = pay.paymentNumber || pay.paymentId || pay.transactionId || pay.id || null;

        normalizedData.push({
          id: pay.id,
          type: "Payment",
          date: new Date(pay.paymentDate || pay.date || pay.createdAt),
          documentNumber: payNum,
          pharmacyName: pName,
          amountUSD: Math.abs(payUSD),
          amountIQD: Math.abs(payIQD),
          status: "Paid",
          paymentNumber: payNum,
        });
      });

      setAllData(normalizedData);
      setPharmacies(Array.from(pharmacySet).sort());
    } catch (err) {
      console.error("Failed to fetch ledger data", err);
      setError("Failed to load ledger data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const sortItems = useCallback((items) => {
    return [...items].sort((a, b) => {
      const key = sortConfig.key;
      const direction = sortConfig.direction;
      let valA, valB;

      if (key === 'date') { valA = a.date.getTime(); valB = b.date.getTime(); }
      else if (key === 'documentNumber') { valA = a.documentNumber; valB = b.documentNumber; }
      else if (key === 'type') { valA = a.type; valB = b.type; }
      else if (key === 'amountUSD') { valA = Math.abs(a.amountUSD); valB = Math.abs(b.amountUSD); }
      else if (key === 'amountIQD') { valA = Math.abs(a.amountIQD); valB = Math.abs(b.amountIQD); }
      else if (key === 'status') { valA = a.status; valB = b.status; }
      else if (key === 'paymentNumber') { valA = a.paymentNumber || ''; valB = b.paymentNumber || ''; }
      else { valA = a[key]; valB = b[key]; }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return direction === 'asc' ? valA - valB : valB - valA;
    });
  }, [sortConfig]);

  const handleSort = useCallback((key) => {
    setSortConfig(prev => {
      const newDirection = prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc';
      return { key, direction: newDirection };
    });
  }, []);

  const getSortIcon = useCallback((key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  }, [sortConfig]);

  const handleUpdateColumnFilter = useCallback((columnKey, updates) => {
    setColumnFilters(prev => {
      const current = prev[columnKey] || { operator: '', textValue: '', selectedValues: [] };
      const next = { ...current, ...updates };
      if (!next.operator && !next.textValue && (!next.selectedValues || next.selectedValues.length === 0)) {
        const newFilters = { ...prev };
        delete newFilters[columnKey];
        return newFilters;
      }
      return { ...prev, [columnKey]: next };
    });
  }, []);

  const evaluateFilter = (itemValue, filterData, type = "string") => {
    if (!filterData) return true;
    const { operator, textValue, selectedValues } = filterData;

    if (selectedValues && selectedValues.length > 0) {
      if (!selectedValues.includes(String(itemValue))) return false;
    }

    if (operator && (textValue !== "" || ['isEmpty', 'isNotEmpty'].includes(operator))) {
      const valStr = String(itemValue || '').toLowerCase();
      const searchStr = String(textValue).toLowerCase();
      const valNum = Number(itemValue);
      const searchNum = Number(textValue);

      switch (operator) {
        case 'contains': return valStr.includes(searchStr);
        case 'equals': return type === 'number' ? valNum === searchNum : valStr === searchStr;
        case 'notEquals': return type === 'number' ? valNum !== searchNum : valStr !== searchStr;
        case 'startsWith': return valStr.startsWith(searchStr);
        case 'endsWith': return valStr.endsWith(searchStr);
        case 'greaterThan': return valNum > searchNum;
        case 'greaterThanOrEqual': return valNum >= searchNum;
        case 'lessThan': return valNum < searchNum;
        case 'lessThanOrEqual': return valNum <= searchNum;
        case 'isEmpty': return !itemValue || itemValue === "N/A" || itemValue === "-";
        case 'isNotEmpty': return !!itemValue && itemValue !== "N/A" && itemValue !== "-";
        default: return true;
      }
    }
    return true;
  };

  const filteredLedger = useMemo(() => {
    const sorted = sortItems(allData);
    return sorted.filter(row => {
      if (row.pharmacyName !== selectedPharmacy) return false;
      if (typeFilter !== "All" && row.type !== typeFilter) return false;
      if (searchTerm && !row.documentNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;

      for (const [columnKey, filterData] of Object.entries(columnFilters)) {
        let itemValue = "";
        if (columnKey === 'date') itemValue = formatDateTime(row.date);
        if (columnKey === 'type') itemValue = row.type;
        if (columnKey === 'documentNumber') itemValue = row.documentNumber;
        if (columnKey === 'amountUSD') itemValue = Math.abs(row.amountUSD);
        if (columnKey === 'amountIQD') itemValue = Math.abs(row.amountIQD);
        if (columnKey === 'status') itemValue = row.status;
        if (columnKey === 'paymentNumber') itemValue = row.paymentNumber || "";

        const isNum = ['amountUSD', 'amountIQD'].includes(columnKey);
        if (!evaluateFilter(itemValue, filterData, isNum ? "number" : "string")) return false;
      }
      return true;
    });
  }, [allData, selectedPharmacy, typeFilter, searchTerm, sortItems, columnFilters]);

  const filteredPharmacies = pharmacies.filter(p => 
    p.toLowerCase().includes(pharmacySearch.toLowerCase())
  );

  const handlePrint = () => {
    const tableHtml = document.getElementById('printable-table-area').innerHTML;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.write(`
      <html>
        <head>
          <title>Sales Ledger - ${selectedPharmacy}</title>
          <style>
            body { font-family: Tahoma, sans-serif; padding: 20px; color: #111; }
            h2 { text-align: center; margin-bottom: 20px; font-size: 24px; color: #1f2937; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6 !important; color: #1f2937 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: bold; }
            tr { page-break-inside: avoid; }
            .no-print { display: none !important; }
            th div { display: block !important; }
            th svg { display: none !important; }
            tfoot { display: table-footer-group; }
            thead { display: table-header-group; }
          </style>
        </head>
        <body>
          <h2>Ledger: ${selectedPharmacy}</h2>
          ${tableHtml}
        </body>
      </html>
    `);
    doc.close();
    
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  };

  const totalBalanceUSD = filteredLedger.reduce((sum, row) => sum + row.amountUSD, 0);
  const totalBalanceIQD = filteredLedger.reduce((sum, row) => sum + row.amountIQD, 0);

  const totalSalesUSD = filteredLedger.filter(row => row.type === "Sold Bill" && row.amountUSD > 0).reduce((sum, row) => sum + row.amountUSD, 0);
  const totalSalesIQD = filteredLedger.filter(row => row.type === "Sold Bill" && row.amountIQD > 0).reduce((sum, row) => sum + row.amountIQD, 0);

  const totalPaidSalesUSD = filteredLedger.filter(row => row.type === "Sold Bill" && row.status === "Paid" && row.amountUSD > 0).reduce((sum, row) => sum + row.amountUSD, 0);
  const totalPaidSalesIQD = filteredLedger.filter(row => row.type === "Sold Bill" && row.status === "Paid" && row.amountIQD > 0).reduce((sum, row) => sum + row.amountIQD, 0);

  const totalUnpaidSalesUSD = filteredLedger.filter(row => row.type === "Sold Bill" && row.status === "Unpaid" && row.amountUSD > 0).reduce((sum, row) => sum + row.amountUSD, 0);
  const totalUnpaidSalesIQD = filteredLedger.filter(row => row.type === "Sold Bill" && row.status === "Unpaid" && row.amountIQD > 0).reduce((sum, row) => sum + row.amountIQD, 0);

  const totalReturnsUSD = filteredLedger.filter(row => row.type === "Return" && row.amountUSD < 0).reduce((sum, row) => sum + row.amountUSD, 0);
  const totalReturnsIQD = filteredLedger.filter(row => row.type === "Return" && row.amountIQD < 0).reduce((sum, row) => sum + row.amountIQD, 0);

  const totalPaidReturnsUSD = filteredLedger.filter(row => row.type === "Return" && row.status === "Paid" && row.amountUSD < 0).reduce((sum, row) => sum + row.amountUSD, 0);
  const totalPaidReturnsIQD = filteredLedger.filter(row => row.type === "Return" && row.status === "Paid" && row.amountIQD < 0).reduce((sum, row) => sum + row.amountIQD, 0);

  const totalUnpaidReturnsUSD = filteredLedger.filter(row => row.type === "Return" && row.status === "Unpaid" && row.amountUSD < 0).reduce((sum, row) => sum + row.amountUSD, 0);
  const totalUnpaidReturnsIQD = filteredLedger.filter(row => row.type === "Return" && row.status === "Unpaid" && row.amountIQD < 0).reduce((sum, row) => sum + row.amountIQD, 0);

  const totalPaymentsUSD = filteredLedger.filter(row => row.type === "Payment").reduce((sum, row) => sum + row.amountUSD, 0);
  const totalPaymentsIQD = filteredLedger.filter(row => row.type === "Payment").reduce((sum, row) => sum + row.amountIQD, 0);

  const remainedUSD = totalUnpaidSalesUSD + totalUnpaidReturnsUSD;
  const remainedIQD = totalUnpaidSalesIQD + totalUnpaidReturnsIQD;

  if (loading) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb', ...nrtFontStyle }}>
        <div style={{ animation: 'spin 1s linear infinite', borderRadius: '9999px', height: '40px', width: '40px', borderTop: '2px solid #3b82f6', borderBottom: '2px solid #3b82f6' }}></div>
      </div>
    );
  }

  if (!selectedPharmacy) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', justifyContent: 'center', backgroundColor: '#f9fafb', paddingTop: '5rem', ...nrtFontStyle }}>
        <div style={{ width: '100%', maxWidth: '450px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', height: 'fit-content' }}>
          <div style={{ backgroundColor: '#2563eb', padding: '1.5rem', textAlign: 'center', color: 'white', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', ...nrtFontBoldStyle }}>Sales Ledger</h1>
            <p style={{ margin: '0.5rem 0 0 0', color: '#bfdbfe', fontSize: '14px' }}>Select a pharmacy to view history</p>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <input 
              type="text" 
              placeholder="Search pharmacy..." 
              value={pharmacySearch}
              onChange={(e) => setPharmacySearch(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px', marginBottom: '1rem', boxSizing: 'border-box', outline: 'none', ...nrtFontStyle }}
            />
            <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredPharmacies.length > 0 ? (
                filteredPharmacies.map(pharmacy => (
                  <button 
                    key={pharmacy} 
                    onClick={() => setSelectedPharmacy(pharmacy)}
                    style={{ padding: '12px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '16px', fontWeight: '500', color: '#374151', transition: 'all 0.2s', ...nrtFontStyle }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = 'white'; }}
                  >
                    {pharmacy}
                  </button>
                ))
              ) : (
                <p style={{ textAlign: 'center', color: '#9ca3af', margin: '1rem 0' }}>No pharmacies found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', margin: 0, padding: 0, boxSizing: 'border-box', backgroundColor: 'white', minHeight: '100vh', ...nrtFontStyle }}>
      <div style={{ padding: '15px', width: '100%', boxSizing: 'border-box' }}>
        
        {/* Top Header */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setSelectedPharmacy(null)} style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>←</button>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', margin: 0, ...nrtFontBoldStyle }}>{selectedPharmacy} - Ledger</h2>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={handlePrint} style={{ padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', ...nrtFontStyle }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Print List
            </button>
            
            {Object.keys(columnFilters).length > 0 && (
              <button onClick={() => setColumnFilters({})} style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', ...nrtFontStyle }}>
                Clear Filters
              </button>
            )}
            
            <select 
              value={typeFilter} 
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', ...nrtFontStyle }}
            >
              <option value="All">All Transactions</option>
              <option value="Bill">Bills Only</option>
              <option value="Return">Returns Only</option>
              <option value="Payment">Payments Only</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="no-print" style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', marginBottom: '1rem', ...nrtFontStyle }}>
            {error}
          </div>
        )}

        {/* Table container */}
        <div id="printable-table-area" style={{ width: '100%', overflowX: 'auto', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', maxHeight: '80vh' }}>
          <table style={{ width: '100%', margin: 0, borderCollapse: 'collapse', minWidth: '1000px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 50 }}>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <TableHeader title="Date" columnKey="date" colWidth="130px" handleSort={handleSort} getSortIcon={getSortIcon} allData={allData} selectedPharmacy={selectedPharmacy} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} />
                <TableHeader title="Type" columnKey="type" colWidth="100px" handleSort={handleSort} getSortIcon={getSortIcon} allData={allData} selectedPharmacy={selectedPharmacy} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} />
                <TableHeader title="Doc Number" columnKey="documentNumber" colWidth="140px" handleSort={handleSort} getSortIcon={getSortIcon} allData={allData} selectedPharmacy={selectedPharmacy} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} />
                <TableHeader title="Amount (USD)" columnKey="amountUSD" type="number" colWidth="130px" handleSort={handleSort} getSortIcon={getSortIcon} allData={allData} selectedPharmacy={selectedPharmacy} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} />
                <TableHeader title="Amount (IQD)" columnKey="amountIQD" type="number" colWidth="130px" handleSort={handleSort} getSortIcon={getSortIcon} allData={allData} selectedPharmacy={selectedPharmacy} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} />
                <TableHeader title="Status" columnKey="status" colWidth="100px" handleSort={handleSort} getSortIcon={getSortIcon} allData={allData} selectedPharmacy={selectedPharmacy} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} />
                <TableHeader title="Payment ID" columnKey="paymentNumber" colWidth="180px" handleSort={handleSort} getSortIcon={getSortIcon} allData={allData} selectedPharmacy={selectedPharmacy} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} />
              </tr>
            </thead>
            <tbody>
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#6b7280', backgroundColor: '#f9fafb', ...nrtFontStyle }}>
                    No records match your filters.
                  </td>
                </tr>
              ) : (
                filteredLedger.map((row, idx) => {
                  const isPayment = row.type === "Payment";
                  const isReturn = row.type === "Return";
                  
                  const pColor = getPaymentColorHex(row.paymentNumber);
                  const rowBg = pColor ? `${pColor}10` : 'white'; 
                  const rowBorderLeft = pColor ? `5px solid ${pColor}` : '5px solid transparent';

                  let typeBg = '#dcfce7'; let typeColor = '#166534';
                  if (isPayment) { typeBg = '#f3e8ff'; typeColor = '#6b21a8'; }
                  if (isReturn) { typeBg = '#ffe4e6'; typeColor = '#9f1239'; }

                  const isPaid = row.status?.toLowerCase() === 'paid' || row.status?.toLowerCase() === 'completed';
                  const amountSign = row.type === "Return" ? "-" : "+";
                  const amountColor = isPayment ? "#7c3aed" : (row.type === "Return" ? "#ef4444" : "#10b981");

                  return (
                    <tr key={`${row.type}-${row.id}-${idx}`} style={{ 
                      borderBottom: '1px solid #e5e7eb', 
                      backgroundColor: rowBg, 
                      borderLeft: rowBorderLeft,
                      transition: 'background 0.2s', 
                      ...nrtFontStyle 
                    }}>
                      <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb', color: '#475569', fontWeight: '500' }}>
                        {formatDateTime(row.date)}
                      </td>
                      <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb' }}>
                        <span style={{ backgroundColor: typeBg, color: typeColor, padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', display: 'inline-block', ...nrtFontStyle }}>
                          {row.type}
                        </span>
                      </td>
                      <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb', fontWeight: '600', color: '#1f2937' }}>
                        {row.documentNumber}
                      </td>
                      <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb', textAlign: 'right', fontWeight: '700', color: amountColor }}>
                        {Math.abs(row.amountUSD) > 0 ? `${amountSign}${formatUSD(Math.abs(row.amountUSD))}` : "-"}
                      </td>
                      <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb', textAlign: 'right', fontWeight: '700', color: amountColor }}>
                        {Math.abs(row.amountIQD) > 0 ? `${amountSign}${formatIQD(Math.abs(row.amountIQD))}` : "-"}
                      </td>
                      <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb' }}>
                         <span style={{ 
                           backgroundColor: isPaid ? '#dcfce7' : '#f1f5f9', 
                           color: isPaid ? '#166534' : '#64748b', 
                           padding: '4px 8px', 
                           borderRadius: '6px', 
                           fontSize: '12px', 
                           fontWeight: '600', 
                           display: 'inline-block',
                           ...nrtFontStyle 
                         }}>
                            {isPaid ? "Paid" : "Unpaid"}
                         </span>
                      </td>
                      <td style={{ padding: '12px', borderRight: 'none' }}>
                        {row.paymentNumber ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="no-print" style={{ 
                              display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: pColor 
                            }}></span>
                            <span style={{ fontWeight: '700', color: '#374151', fontSize: '13px', letterSpacing: '0.05em' }}>
                              {row.paymentNumber}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '13px' }}>
                            {isPaid ? "Paid (No ID)" : "-"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            
            {/* The footer is given zIndex: 10 so it stays UNDER the dropdowns when opened (which have 99999) */}
            <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 10 }}>
              <tr style={{ backgroundColor: '#f0fdf4', borderTop: '2px solid #cbd5e1' }}>
                <td colSpan="3" style={{ padding: '10px 12px', textAlign: 'right', borderRight: '1px solid #cbd5e1', color: '#1e293b', fontSize: '13px', ...nrtFontBoldStyle }}>
                  Sales Totals:
                </td>
                <td style={{ padding: '10px 12px', borderRight: '1px solid #cbd5e1', textAlign: 'right', fontSize: '13px' }}>
                  <div><span style={{ color: '#10b981', fontWeight: '700' }}>All Sales: {formatUSD(totalSalesUSD)}</span></div>
                  <div><span style={{ color: '#22c55e', fontWeight: '600' }}>Paid: {formatUSD(totalPaidSalesUSD)}</span></div>
                  <div><span style={{ color: '#f59e0b', fontWeight: '600' }}>Unpaid: {formatUSD(totalUnpaidSalesUSD)}</span></div>
                </td>
                <td style={{ padding: '10px 12px', borderRight: '1px solid #cbd5e1', textAlign: 'right', fontSize: '13px' }}>
                  <div><span style={{ color: '#10b981', fontWeight: '700' }}>All Sales: {formatIQD(totalSalesIQD)}</span></div>
                  <div><span style={{ color: '#22c55e', fontWeight: '600' }}>Paid: {formatIQD(totalPaidSalesIQD)}</span></div>
                  <div><span style={{ color: '#f59e0b', fontWeight: '600' }}>Unpaid: {formatIQD(totalUnpaidSalesIQD)}</span></div>
                </td>
                <td colSpan="2" style={{ padding: '10px 12px', borderRight: 'none' }}></td>
              </tr>
              
              <tr style={{ backgroundColor: '#fef2f2', borderTop: '1px solid #cbd5e1' }}>
                <td colSpan="3" style={{ padding: '10px 12px', textAlign: 'right', borderRight: '1px solid #cbd5e1', color: '#1e293b', fontSize: '13px', ...nrtFontBoldStyle }}>
                  Return Totals:
                </td>
                <td style={{ padding: '10px 12px', borderRight: '1px solid #cbd5e1', textAlign: 'right', fontSize: '13px' }}>
                  <div><span style={{ color: '#ef4444', fontWeight: '700' }}>All Returns: {formatUSD(Math.abs(totalReturnsUSD))}</span></div>
                  <div><span style={{ color: '#dc2626', fontWeight: '600' }}>Paid: {formatUSD(Math.abs(totalPaidReturnsUSD))}</span></div>
                  <div><span style={{ color: '#f59e0b', fontWeight: '600' }}>Unpaid: {formatUSD(Math.abs(totalUnpaidReturnsUSD))}</span></div>
                </td>
                <td style={{ padding: '10px 12px', borderRight: '1px solid #cbd5e1', textAlign: 'right', fontSize: '13px' }}>
                  <div><span style={{ color: '#ef4444', fontWeight: '700' }}>All Returns: {formatIQD(Math.abs(totalReturnsIQD))}</span></div>
                  <div><span style={{ color: '#dc2626', fontWeight: '600' }}>Paid: {formatIQD(Math.abs(totalPaidReturnsIQD))}</span></div>
                  <div><span style={{ color: '#f59e0b', fontWeight: '600' }}>Unpaid: {formatIQD(Math.abs(totalUnpaidReturnsIQD))}</span></div>
                </td>
                <td colSpan="2" style={{ padding: '10px 12px', borderRight: 'none' }}></td>
              </tr>
              
              <tr style={{ backgroundColor: '#f3e8ff', borderTop: '1px solid #cbd5e1' }}>
                <td colSpan="3" style={{ padding: '10px 12px', textAlign: 'right', borderRight: '1px solid #cbd5e1', color: '#1e293b', fontSize: '13px', ...nrtFontBoldStyle }}>
                  Payment Totals:
                </td>
                <td style={{ padding: '10px 12px', borderRight: '1px solid #cbd5e1', textAlign: 'right', fontSize: '13px' }}>
                  <div><span style={{ color: '#7c3aed', fontWeight: '700' }}>Total Payments: {formatUSD(totalPaymentsUSD)}</span></div>
                </td>
                <td style={{ padding: '10px 12px', borderRight: '1px solid #cbd5e1', textAlign: 'right', fontSize: '13px' }}>
                  <div><span style={{ color: '#7c3aed', fontWeight: '700' }}>Total Payments: {formatIQD(totalPaymentsIQD)}</span></div>
                </td>
                <td colSpan="2" style={{ padding: '10px 12px', borderRight: 'none' }}></td>
              </tr>

              <tr style={{ backgroundColor: '#fef3c7', borderTop: '2px solid #cbd5e1' }}>
                <td colSpan="3" style={{ padding: '14px 12px', textAlign: 'right', borderRight: '1px solid #cbd5e1', color: '#92400e', fontSize: '15px', ...nrtFontBoldStyle }}>
                  Remained Amount <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#78350f' }}>(Unpaid Balance)</span>:
                </td>
                <td style={{ padding: '14px 12px', borderRight: '1px solid #cbd5e1', textAlign: 'right', fontSize: '16px', color: remainedUSD < 0 ? '#ef4444' : '#d97706', ...nrtFontBoldStyle }}>
                  {remainedUSD === 0 ? "-" : `${remainedUSD < 0 ? "-" : ""}${formatUSD(Math.abs(remainedUSD))}`}
                </td>
                <td style={{ padding: '14px 12px', borderRight: '1px solid #cbd5e1', textAlign: 'right', fontSize: '16px', color: remainedIQD < 0 ? '#ef4444' : '#d97706', ...nrtFontBoldStyle }}>
                   {remainedIQD === 0 ? "-" : `${remainedIQD < 0 ? "-" : ""}${formatIQD(Math.abs(remainedIQD))}`}
                </td>
                <td colSpan="2" style={{ padding: '12px', borderRight: 'none' }}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}