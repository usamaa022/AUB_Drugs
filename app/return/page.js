"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import React from "react";
import {
  getAllReturns,
  getPharmacies,
  getSoldBills,
  returnItemsToStore,
  deleteReturnBillAndRestoreToSale,
  updateReturnItems,
  getReturnById,
  getFilteredReturns,
  getUsers
} from "@/lib/data";
import Select from "react-select";
import * as XLSX from 'xlsx';
import {
  FaPrint, FaEdit, FaTrash, FaCheck, FaTimes, FaRedo,
  FaFileInvoice, FaBuilding, FaDollarSign,
  FaBox, FaBarcode, FaStickyNote, FaStore, FaClipboardList,
  FaLock, FaFileExcel
} from 'react-icons/fa';
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

// Font styles
const nrtFontStyle = {
  fontFamily: 'var(--font-nrt-regular), "NRT Regular", Tahoma, sans-serif',
};

const nrtFontBoldStyle = {
  fontFamily: 'var(--font-nrt-bold), "NRT Bold", Tahoma, sans-serif',
  fontWeight: '700',
};

export default function ReturnHistory() {
  const [returns, setReturns] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [soldBills, setSoldBills] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [editingReturn, setEditingReturn] = useState(null);
  
  // Global Filters
  const [filters, setFilters] = useState({
    billNumber: "",
    itemName: "",
    barcode: "",
    paymentStatus: "all",
    pharmacyName: "",
    note: "",
    pharmacyReturnBillNumber: ""
  });
  
  // Advanced Column Filters
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);

  const [returnItems, setReturnItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [pharmacyReturnBillNumber, setPharmacyReturnBillNumber] = useState("");
  const [returnBillNumber, setReturnBillNumber] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [expandedBillId, setExpandedBillId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Sorting state
  const [returnSort, setReturnSort] = useState({ col: "returnDate", dir: "desc" });
  const [billSort, setBillSort] = useState({ col: "billNumber", dir: "desc" });

  const editSectionRef = useRef(null);

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

  const escapeHtml = (text) => {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      let d;
      if (date.toDate) d = date.toDate();
      else if (date instanceof Date) d = date;
      else if (typeof date === 'string') d = new Date(date);
      else if (date.seconds) d = new Date(date.seconds * 1000);
      else return "N/A";
      if (isNaN(d.getTime())) return "N/A";
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch { return "N/A"; }
  };

  const formatCurrency = (amount, currency = "IQD") => {
    if (amount === null || amount === undefined) amount = 0;
    if (currency === "USD") {
      const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
      return `$${formatted}`;
    } else {
      const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
      return `${formatted} IQD`;
    }
  };

  const getDisplayItems = (returnItem) => {
    if (!returnItem) return [];
    if (returnItem.items && Array.isArray(returnItem.items) && returnItem.items.length > 0) {
      const firstItem = returnItem.items[0];
      if (firstItem.name || firstItem.barcode || firstItem.returnQuantity !== undefined) {
        return returnItem.items;
      }
    }
    return returnItem.items || [];
  };

  const getBillCurrency = (bill) => {
    if (bill?.currency) return bill.currency;
    if (bill?.items && bill.items.length > 0) {
      const firstItem = bill.items[0];
      if ((firstItem?.outPriceIQD || 0) > 0 && !(firstItem?.outPriceUSD > 0)) return "IQD";
      if ((firstItem?.outPriceUSD || 0) > 0) return "USD";
      if (firstItem?.currency) return firstItem.currency;
      if (firstItem?.originalCurrency) return firstItem.originalCurrency;
    }
    return "IQD";
  };

  const getItemPrice = (item, billCurrency) => {
    if (billCurrency === "USD") {
      return item.outPriceUSD || item.priceUSD || item.sellingPriceUSD || item.outPrice || item.price || 0;
    } else {
      return item.outPriceIQD || item.outPrice || item.price || item.sellingPriceIQD || 0;
    }
  };

  const getAlreadyReturnedQuantity = (barcode, billId, pharmacyId, currentReturns, excludeReturnId = null) => {
    let totalReturned = 0;
    currentReturns.forEach(returnBill => {
      if (returnBill.id !== excludeReturnId &&
        returnBill.pharmacyId === pharmacyId &&
        returnBill.billId === billId &&
        returnBill.items) {
        const item = returnBill.items.find(i => i.barcode === barcode);
        if (item) totalReturned += item.returnQuantity || 0;
      }
    });
    return totalReturned;
  };

  const calculateReturnTotal = (items) => {
    return items.reduce((sum, item) => sum + ((item.returnPrice || 0) * (item.returnQuantity || 0)), 0);
  };

  const parseCurrency = (value) => {
    if (!value) return 0;
    const cleaned = value.toString().replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const getStatusBadge = (status) => {
    if (status === "Paid") {
      return { backgroundColor: "#dcfce7", color: "#15803d", border: "1px solid #86efac" };
    }
    if (status === "Processed") {
      return { backgroundColor: "#ffedd5", color: "#c2410c", border: "1px solid #fdba74" };
    }
    return { backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" };
  };

  // 🔥 Lock check: Returns that are Paid or Processed cannot be edited
  const isEditable = (returnItem) => {
    const status = String(returnItem?.paymentStatus || "").toLowerCase();
    return status !== "processed" && status !== "paid" && returnItem?.isPaid !== true;
  };

  const SortIcon = ({ col, sortState }) => {
    if (sortState.col !== col) return <span style={{ opacity: 0.4 }}>↕️</span>;
    return sortState.dir === "asc"
      ? <span style={{ color: "#fff" }}>↑</span>
      : <span style={{ color: "#fff" }}>↓</span>;
  };

  const compareValues = (a, b, dir) => {
    if (a === null || a === undefined) return dir === "asc" ? -1 : 1;
    if (b === null || b === undefined) return dir === "asc" ? 1 : -1;
    if (typeof a === "string" && typeof b === "string") {
      return dir === "asc" ? a.localeCompare(b) : b.localeCompare(a);
    }
    return dir === "asc" ? (a > b ? 1 : a < b ? -1 : 0) : (a < b ? 1 : a > b ? -1 : 0);
  };

  const extractNote = (returnItem) => {
    if (!returnItem) return "";
    let note = returnItem.returnBillNote || returnItem.note || returnItem.returnNote || "";
    if (!note && returnItem.items && returnItem.items.length > 0) {
      note = returnItem.items[0].returnBillNote || returnItem.items[0].note || returnItem.items[0].returnNote || "";
    }
    return note;
  };

  // --- Advanced Filter Logic ---
  const handleUpdateColumnFilter = (columnKey, updates) => {
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
  };

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

  const getCellDisplayValue = (row, key) => {
    switch(key) {
      case 'returnBillNumber': return row.returnBillNumber;
      case 'pharmacyName': return row.pharmacyName;
      case 'itemName': return row.itemName;
      case 'barcode': return row.barcode;
      case 'itemQty': return row.itemQty;
      case 'itemPrice': return row.itemPrice;
      case 'itemTotal': return row.itemTotal;
      case 'billNumber': return row.billNumber;
      case 'returnDate': return formatDate(row.returnDate);
      case 'paymentStatus': return row.paymentStatus;
      default: return String(row[key] || "");
    }
  };

  const flattenedReturns = (returns || []).flatMap(returnBill => {
    const items = getDisplayItems(returnBill);
    if (!items || items.length === 0) {
      return [{
        ...returnBill,
        parentBill: returnBill,
        uniqueRowId: `${returnBill.id}-empty`,
        itemName: "—",
        barcode: "—",
        itemQty: returnBill.totalReturnQty || 0,
        itemPrice: 0,
        itemTotal: returnBill.totalReturnAmount || 0,
        itemCurrency: returnBill.currency || "IQD"
      }];
    }
    return items.map((item, idx) => ({
      ...returnBill,
      parentBill: returnBill,
      uniqueRowId: `${returnBill.id}-${item.id || item.barcode || idx}`,
      itemName: item.name || "—",
      barcode: item.barcode || "—",
      itemQty: item.returnQuantity || 0,
      itemPrice: item.returnPrice || 0,
      itemTotal: (item.returnQuantity || 0) * (item.returnPrice || 0),
      itemCurrency: item.currency || returnBill.currency || "IQD"
    }));
  });

  const displayFilteredAndSorted = useMemo(() => {
    let result = flattenedReturns.filter(row => {
      const displayNote = extractNote(row.parentBill);
      if (filters.billNumber && !row.billNumber?.toString().includes(filters.billNumber)) return false;
      if (filters.itemName && !row.itemName?.toLowerCase().includes(filters.itemName.toLowerCase())) return false;
      if (filters.barcode && !row.barcode?.toLowerCase().includes(filters.barcode.toLowerCase())) return false;
      if (filters.paymentStatus !== "all" && row.paymentStatus !== filters.paymentStatus) return false;
      if (filters.pharmacyName && !row.pharmacyName?.toLowerCase().includes(filters.pharmacyName.toLowerCase())) return false;
      if (filters.note && !displayNote.toLowerCase().includes(filters.note.toLowerCase())) return false;
      if (filters.pharmacyReturnBillNumber && !row.pharmacyReturnBillNumber?.toLowerCase().includes(filters.pharmacyReturnBillNumber.toLowerCase())) return false;
      return true;
    });

    for (const [columnKey, filterData] of Object.entries(columnFilters)) {
      result = result.filter(row => {
        const itemValue = getCellDisplayValue(row, columnKey);
        const isNum = ['itemQty', 'itemPrice', 'itemTotal'].includes(columnKey);
        return evaluateFilter(itemValue, filterData, isNum ? "number" : "string");
      });
    }

    return result.sort((a, b) => {
      const { col, dir } = returnSort;
      let aVal, bVal;
      switch (col) {
        case "returnBillNumber": aVal = a.returnBillNumber; bVal = b.returnBillNumber; break;
        case "pharmacyName": aVal = a.pharmacyName; bVal = b.pharmacyName; break;
        case "itemName": aVal = a.itemName; bVal = b.itemName; break;
        case "barcode": aVal = a.barcode; bVal = b.barcode; break;
        case "itemQty": aVal = a.itemQty; bVal = b.itemQty; break;
        case "itemPrice": aVal = a.itemPrice; bVal = b.itemPrice; break;
        case "itemTotal": aVal = a.itemTotal; bVal = b.itemTotal; break;
        case "billNumber": aVal = Number(a.billNumber) || 0; bVal = Number(b.billNumber) || 0; break;
        case "returnDate": aVal = a.returnDate instanceof Date ? a.returnDate.getTime() : 0; bVal = b.returnDate instanceof Date ? b.returnDate.getTime() : 0; break;
        case "paymentStatus": aVal = a.paymentStatus; bVal = b.paymentStatus; break;
        default: aVal = a.returnDate instanceof Date ? a.returnDate.getTime() : 0; bVal = b.returnDate instanceof Date ? b.returnDate.getTime() : 0;
      }
      return compareValues(aVal, bVal, dir);
    });
  }, [flattenedReturns, filters, columnFilters, returnSort]);

  const ExcelFilterDropdown = ({ columnKey, type = "string" }) => {
    const [search, setSearch] = useState("");
    const isOpen = activeFilterDropdown === columnKey;
    const operators = type === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;
    
    const filterState = columnFilters[columnKey] || { operator: operators[0].value, textValue: '', selectedValues: [] };
    const { operator, textValue, selectedValues } = filterState;

    const uniqueValues = useMemo(() => {
      const vals = new Set();
      flattenedReturns.forEach(row => {
        const val = getCellDisplayValue(row, columnKey);
        vals.add(String(val || ""));
      });
      return Array.from(vals).sort();
    }, [flattenedReturns, columnKey]);

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
      <div className="filter-dropdown-container" style={{ position: "relative", display: "inline-block" }}>
        <div 
          onClick={(e) => { e.stopPropagation(); setActiveFilterDropdown(isOpen ? null : columnKey); }}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "0.25rem", borderRadius: "0.375rem", background: isActive ? "rgba(255,255,255,0.2)" : "transparent", color: isActive ? "#fff" : "#cbd5e1", transition: "all 0.2s" }}
        >
          <Filter size={14} />
        </div>

        {isOpen && (
          <div style={{ position: "absolute", top: "100%", right: 0, marginTop: "0.5rem", background: "white", border: "1px solid #cbd5e1", borderRadius: "0.5rem", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)", zIndex: 9999, width: "260px", maxWidth: "85vw", display: "flex", flexDirection: "column", cursor: "default", overflow: "hidden", color: "#2c3e50" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc", boxSizing: "border-box" }}>
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>Condition</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <select 
                  value={operator || operators[0].value} 
                  onChange={(e) => handleUpdateColumnFilter(columnKey, { operator: e.target.value })}
                  style={{ width: "100%", boxSizing: "border-box", padding: "0.4rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.875rem", outline: "none", background: "white" }}
                >
                  {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                {!['isEmpty', 'isNotEmpty'].includes(operator) && (
                  <input 
                    type={type === "number" ? "number" : "text"} 
                    placeholder="Value..." 
                    value={textValue || ""} 
                    onChange={(e) => handleUpdateColumnFilter(columnKey, { textValue: e.target.value })}
                    style={{ width: "100%", boxSizing: "border-box", padding: "0.4rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.875rem", outline: "none" }}
                  />
                )}
              </div>
            </div>

            <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", flex: 1, boxSizing: "border-box" }}>
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>Values</p>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: "0.375rem", padding: "0.25rem 0.5rem", marginBottom: "0.5rem", boxSizing: "border-box" }}>
                <Search size={14} color="#94a3b8" />
                <input 
                  type="text" 
                  placeholder="Search values..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  style={{ border: "none", outline: "none", width: "100%", boxSizing: "border-box", fontSize: "0.875rem", marginLeft: "0.5rem" }} 
                />
              </div>

              <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", padding: "0.25rem", cursor: "pointer", fontWeight: "500", borderBottom: "1px solid #f1f5f9" }}>
                  <input 
                    type="checkbox" 
                    checked={selectedValues.length === uniqueValues.length && uniqueValues.length > 0} 
                    onChange={(e) => handleSelectAll(e.target.checked)} 
                    style={{ cursor: "pointer", width: "1rem", height: "1rem", accentColor: "#2563eb" }}
                  />
                  <span>(Select All)</span>
                </label>
                {displayValues.map(val => (
                  <label key={val} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", padding: "0.25rem", cursor: "pointer", color: "#1e293b" }}>
                    <input 
                      type="checkbox" 
                      checked={selectedValues.includes(val)} 
                      onChange={(e) => handleCheckbox(val, e.target.checked)} 
                      style={{ cursor: "pointer", width: "1rem", height: "1rem", accentColor: "#2563eb" }}
                    />
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val === "" ? "(Blank)" : val}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", padding: "0.75rem", backgroundColor: "#f8fafc", boxSizing: "border-box" }}>
              <button onClick={() => {
                const updated = {...columnFilters};
                delete updated[columnKey];
                setColumnFilters(updated);
              }} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: "0.875rem", cursor: "pointer", fontWeight: 600 }}>Clear</button>
              <button onClick={() => setActiveFilterDropdown(null)} style={{ background: "#2563eb", border: "none", color: "white", fontSize: "0.875rem", padding: "0.4rem 1rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600 }}>Apply</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const TableHeader = ({ title, columnKey, type = "string", colWidth }) => (
    <th style={{ 
      backgroundColor: "#979797", color: "white", padding: "12px 10px", 
      textAlign: "left", fontSize: "14px", fontFamily: "'NRT-Bd', sans-serif", 
      whiteSpace: "nowrap", borderRight: "1px solid #576574",
      width: colWidth || "auto", 
      minWidth: colWidth || "auto"
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
        <div onClick={() => toggleReturnSort(columnKey)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", flex: 1 }}>
          {title}
          <span style={{ fontSize: "11px", color: "#bdc3c7" }}>
            <SortIcon col={columnKey} sortState={returnSort} />
          </span>
        </div>
        <ExcelFilterDropdown columnKey={columnKey} type={type} />
      </div>
    </th>
  );

  const filteredBills = (soldBills || [])
    .filter(bill => {
      if (!selectedPharmacy?.id || !bill) return false;
      if (bill.pharmacyId !== selectedPharmacy.id) return false;
      if (filters.billNumber && !bill.billNumber?.toString().includes(filters.billNumber)) return false;
      if (filters.itemName && !bill.items?.some(i => i?.name?.toLowerCase().includes(filters.itemName.toLowerCase()))) return false;
      if (filters.barcode && !bill.items?.some(i => i?.barcode?.toLowerCase().includes(filters.barcode.toLowerCase()))) return false;
      return true;
    })
    .sort((a, b) => {
      const { col, dir } = billSort;
      let aVal, bVal;
      switch (col) {
        case "billNumber": aVal = Number(a.billNumber) || 0; bVal = Number(b.billNumber) || 0; break;
        case "date": aVal = a.date instanceof Date ? a.date.getTime() : 0; bVal = b.date instanceof Date ? b.date.getTime() : 0; break;
        case "currency": aVal = getBillCurrency(a); bVal = getBillCurrency(b); break;
        case "totalAmount": {
          const ca = getBillCurrency(a);
          aVal = ca === "USD" ? a.totalAmountUSD || 0 : a.totalAmountIQD || 0;
          const cb = getBillCurrency(b);
          bVal = cb === "USD" ? b.totalAmountUSD || 0 : b.totalAmountIQD || 0;
          break;
        }
        case "items": aVal = a.items?.length || 0; bVal = b.items?.length || 0; break;
        default: aVal = Number(a.billNumber) || 0; bVal = Number(b.billNumber) || 0;
      }
      return compareValues(aVal, bVal, dir);
    });

  const generateReturnBillNumberLocal = (existingReturns = []) => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `RET-${year}${month}-`;

    let maxSeq = 0;
    existingReturns.forEach(r => {
      if (r.returnBillNumber && r.returnBillNumber.startsWith(prefix)) {
        const seq = parseInt(r.returnBillNumber.slice(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });

    return `${prefix}${maxSeq + 1}`;
  };

  const exportToExcel = useCallback(() => {
    try {
      setIsExporting(true);
      const exportData = displayFilteredAndSorted.map(row => {
        const displayNote = extractNote(row.parentBill);
        return {
          "Return Bill Number": row.returnBillNumber || "",
          "Pharmacy Name": row.pharmacyName || "",
          "Item Name": row.itemName,
          "Barcode": row.barcode,
          "Quantity": row.itemQty,
          "Unit Price": formatCurrency(row.itemPrice, row.itemCurrency),
          "Total Price": formatCurrency(row.itemTotal, row.itemCurrency),
          "Currency": row.itemCurrency,
          "Original Bill Number": row.billNumber || "",
          "Pharmacy Return #": row.pharmacyReturnBillNumber || "",
          "Return Date": formatDate(row.returnDate),
          "Payment Status": row.paymentStatus || "",
          "Note": displayNote
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const colWidths = [
        {wch:20}, {wch:25}, {wch:35}, {wch:15}, {wch:10}, {wch:15}, 
        {wch:15}, {wch:10}, {wch:20}, {wch:18}, {wch:20}, {wch:15}, {wch:30} 
      ];
      ws['!cols'] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Item Return History");
      const fileName = `Item_Return_History_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      setSuccessMessage("Export to Excel completed successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      setError(`Failed to export: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsExporting(false);
    }
  }, [displayFilteredAndSorted]);

  const handlePrint = useCallback((returnItem) => {
    if (!returnItem) return;
    const currency = returnItem.currency || "IQD";
    const items = getDisplayItems(returnItem);
    const pharmacyNameDisplay = returnItem.pharmacyName || "N/A";
    const pharmacyReturnNumberDisplay = returnItem.pharmacyReturnBillNumber || "N/A";
    const displayNote = extractNote(returnItem);

    let printGrandTotal = 0;

    const itemRows = items.map((item, idx) => {
      const itemCurrency = item.currency || currency;
      const qty = item.returnQuantity || 0;
      const price = item.returnPrice || 0;
      const total = price * qty;
      
      printGrandTotal += total;

      return `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td class="font-medium">${escapeHtml(item.name || "")}</td>
          <td class="text-center barcode-text">${item.barcode || ""}</td>
          <td class="text-center">
            <span class="qty-badge">${qty}</span>
          </td>
          <td class="text-right">${formatCurrency(price, itemCurrency)}</td>
          <td class="text-right font-bold total-col">${formatCurrency(total, itemCurrency)}</td>
        </tr>`;
    }).join("");

    const statusBg = returnItem.paymentStatus === "Paid" ? "#dcfce7" : returnItem.paymentStatus === "Processed" ? "#ffedd5" : "#fef3c7";
    const statusColor = returnItem.paymentStatus === "Paid" ? "#15803d" : returnItem.paymentStatus === "Processed" ? "#c2410c" : "#92400e";
    const statusBorder = returnItem.paymentStatus === "Paid" ? "#86efac" : returnItem.paymentStatus === "Processed" ? "#fdba74" : "#fcd34d";
    
    const noteHtml = displayNote
      ? `<div class="note-section">
           <strong>📝 Note:</strong> <span>${escapeHtml(displayNote)}</span>
         </div>`
      : "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <style>
    :root {
      --primary: #4b5563; 
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-500: #6b7280;
      --gray-700: #374151;
      --gray-900: #111827;
    }
    * { 
      box-sizing: border-box; 
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body { 
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; 
      background: #f0f2f5; 
      margin: 0; 
      padding: 20px; 
      color: var(--gray-900);
    }
    @page { 
      size: A4 portrait; 
      margin: 10mm 15mm; 
    }
    @media print {
      body { background: white; padding: 0; }
      .print-container { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; padding: 0 !important; }
      .no-print { display: none; }
    }
    .print-container { 
      width: 100%; 
      max-width: 210mm; 
      margin: 0 auto; 
      background: white; 
      border-radius: 12px; 
      box-shadow: 0 10px 25px rgba(0,0,0,0.05); 
      padding: 40px; 
    }
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 25px;
      border-bottom: 2px solid var(--gray-200);
    }
    .logo { height: 75px; object-fit: contain; }
    .company-details { text-align: right; }
    .company-name { font-size: 26px; font-weight: 800; color: var(--gray-900); margin: 0 0 8px 0; letter-spacing: 0.5px; }
    .company-contact { margin: 2px 0; color: var(--gray-500); font-size: 13px; }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 35px;
    }
    .info-box {
      background: var(--gray-50);
      border: 1px solid var(--gray-200);
      border-radius: 8px;
      padding: 15px 20px;
    }
    .info-box-title {
      font-size: 12px;
      text-transform: uppercase;
      color: var(--gray-500);
      font-weight: 600;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px; }
    .info-label { color: var(--gray-500); font-weight: 500; }
    .info-value { font-weight: 600; color: var(--gray-900); text-align: right; }
    .status-badge { 
      background: ${statusBg}; 
      color: ${statusColor}; 
      border: 1px solid ${statusBorder};
      padding: 4px 12px; 
      border-radius: 20px; 
      font-size: 12px; 
      font-weight: 700; 
      display: inline-block;
      text-transform: uppercase;
    }
    .items-table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-bottom: 25px; 
      border-radius: 8px; 
      overflow: hidden;
      border: 1px solid var(--gray-200);
    }
    .items-table th { 
      background: var(--gray-100); 
      color: var(--gray-900); 
      padding: 12px 15px; 
      font-weight: 600; 
      font-size: 13px; 
      text-transform: uppercase; 
      letter-spacing: 0.5px; 
      border-bottom: 2px solid var(--gray-200);
    }
    .items-table td { 
      padding: 12px 15px; 
      border-bottom: 1px solid var(--gray-200); 
      font-size: 14px; 
      vertical-align: middle; 
    }
    .items-table tr:last-child td { border-bottom: none; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-medium { font-weight: 500; }
    .font-bold { font-weight: 700; }
    .barcode-text { font-family: 'Courier New', Courier, monospace; font-size: 13px; color: var(--gray-500); }
    .total-col { color: #059669; }
    .qty-badge {
      background: var(--gray-50);
      border: 1px solid var(--gray-200);
      padding: 4px 12px;
      border-radius: 6px;
      font-weight: 600;
      display: inline-block;
    }
    .totals-container {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 18px;
    }
    .total-label { font-weight: 700; color: var(--gray-700); }
    .total-amount { font-weight: 800; color: #059669; font-size: 22px; }
    .note-section {
      background: #f9fafb;
      border-left: 4px solid var(--gray-500);
      padding: 15px 20px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 40px;
      font-size: 14px;
      color: var(--gray-700);
    }
    .signatures { 
      display: flex; 
      justify-content: space-between; 
      gap: 40px; 
      margin-top: 50px; 
      padding-top: 40px; 
    }
    .signature-line { flex: 1; text-align: center; }
    .signature-dash { border-top: 1px solid var(--gray-400); width: 80%; margin: 0 auto 10px; }
    .signature-text { font-size: 13px; color: var(--gray-500); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="invoice-header">
      <div>
        <img src="/Aranlogo.png" alt="Aran Med Store" class="logo" onerror="this.style.display='none'" />
      </div>
      <div class="company-details" style="margin-top: 25px;">
        <p class="company-contact">📞 +964 772 533 5252 | +964 751 741 2241</p>
        <p class="company-contact">📍 سلێمانی بەرامبەر تاوەری تەندروستی سمارت</p>
      </div>
    </div>
    
    <div class="info-grid">
      <div class="info-box">
        <div class="info-box-title">Return Details</div>
        <div class="info-row">
          <span class="info-label">Return #:</span>
          <span class="info-value">${returnItem.returnBillNumber}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date:</span>
          <span class="info-value">${formatDate(returnItem.returnDate)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Original Bill:</span>
          <span class="info-value">${returnItem.billNumber}</span>
        </div>
        <div class="info-row" style="margin-top: 8px;">
          <span class="info-label">Status:</span>
          <span class="info-value"><span class="status-badge">${returnItem.paymentStatus}</span></span>
        </div>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">Pharmacy Details</div>
        <div class="info-row">
          <span class="info-label">Pharmacy Name:</span>
          <span class="info-value">${escapeHtml(pharmacyNameDisplay)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Pharmacy Return #:</span>
          <span class="info-value">${escapeHtml(pharmacyReturnNumberDisplay)}</span>
        </div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th class="text-center" style="width: 5%;">#</th>
          <th style="width: 35%; text-align: left;">Item Name</th>
          <th class="text-center" style="width: 15%;">Barcode</th>
          <th class="text-center" style="width: 10%;">Qty</th>
          <th class="text-right" style="width: 15%;">Unit Price</th>
          <th class="text-right" style="width: 20%;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--gray-500);">No items found</td></tr>`}
      </tbody>
    </table>

    <div class="totals-container">
      <div style="border: 1px solid var(--gray-200); border-radius: 8px; padding: 15px 20px; background: var(--gray-50);">
        <div class="total-row">
          <span class="total-label" style="font-size: 15px; text-align: left;">TOTAL RETURN:    </span>
          <span class="total-amount" style="font-size: 15px; text-align: right;">${formatCurrency(printGrandTotal, currency)}</span>
        </div>
      </div>
    </div>
    
    ${noteHtml}
    
    <div class="signatures">
      <div class="signature-line">
        <div class="signature-dash"></div>
        <div class="signature-text">Pharmacy Representative<br>Signature &amp; Stamp</div>
      </div>
      <div class="signature-line">
        <div class="signature-dash"></div>
        <div class="signature-text">Aran Med Store Representative<br>Signature &amp; Stamp</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=1000,height=800,toolbar=yes,scrollbars=yes,resizable=yes");
    if (!printWindow) { alert("Please allow popups to print. Check your browser settings."); return; }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.onafterprint = () => { printWindow.close(); };
      }, 500);
    };
  }, []);

  const toggleReturnSort = (col) => {
    setReturnSort(prev => ({
      col, dir: prev.col === col && prev.dir === "asc" ? "desc" : "asc"
    }));
  };

  const toggleBillSort = (col) => {
    setBillSort(prev => ({
      col, dir: prev.col === col && prev.dir === "asc" ? "desc" : "asc"
    }));
  };

  const handlePharmacySelect = (selectedOption) => {
    setSelectedPharmacy(selectedOption?.value || null);
    setSelectedBill(null);
    setEditingReturn(null);
    setReturnItems([]);
    setPharmacyReturnBillNumber("");
    setReturnNote("");
    setExpandedBillId(null);
    setError(null);
    setSuccessMessage(null);
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const toggleBillSelection = (bill) => {
    if (selectedBill?.id === bill.id) {
      setSelectedBill(null);
      setExpandedBillId(null);
      setReturnItems([]);
    } else {
      setSelectedBill(bill);
      setExpandedBillId(bill.id);
      initializeReturnItems(bill);
    }
  };

  const initializeReturnItems = (bill) => {
    if (!bill || !bill.items || !Array.isArray(bill.items)) {
      setError("Invalid bill selected");
      return;
    }
    try {
      const newReturnBillNumber = generateReturnBillNumberLocal(returns);
      setReturnBillNumber(newReturnBillNumber);

      const billCurrency = getBillCurrency(bill);
      const existingReturns = returns.filter(r =>
        r.pharmacyId === selectedPharmacy?.id && r.billId === bill.id
      );

      const itemsWithReturnInfo = bill.items
        .filter(item => item && item.barcode)
        .map(item => {
          const alreadyReturned = getAlreadyReturnedQuantity(
            item.barcode, bill.id, selectedPharmacy?.id, existingReturns
          );
          const originalQty = item.originalQuantity || item.quantity || 0;
          const availableQty = Math.max(0, originalQty - alreadyReturned);
          const itemPrice = getItemPrice(item, billCurrency);
          
          return {
            id: item.id,
            barcode: item.barcode,
            name: item.name || 'Unknown Item',
            billNumber: bill.billNumber,
            billId: bill.id,
            returnQuantity: 0,
            returnPrice: itemPrice,
            originalQuantity: originalQty,
            alreadyReturned: alreadyReturned,
            availableQuantity: availableQty,
            currency: billCurrency,
            originalCurrency: item.originalCurrency || billCurrency, 
            outPriceUSD: item.outPriceUSD || 0,
            outPriceIQD: item.outPriceIQD || 0,
            expireDate: item.expireDate,
            branch: item.branch || "Slemany",
            boughtBillNumber: item.boughtBillNumber || null,
            saleBatchAllocations: item.batchAllocations || [],
          };
        })
        .filter(item => item.availableQuantity > 0);

      if (itemsWithReturnInfo.length === 0) {
        setError("No items available for return. All items have been fully returned.");
        setReturnItems([]);
      } else {
        setReturnItems(itemsWithReturnInfo);
      }
    } catch (error) {
      console.error("Error initializing return items:", error);
      setError(`Error initializing return items: ${error.message}`);
    }
  };

  const handleCancelBillSelection = () => {
    setSelectedBill(null);
    setExpandedBillId(null);
    setReturnItems([]);
    setPharmacyReturnBillNumber("");
    setReturnNote("");
    setReturnBillNumber("");
    setError(null);
    setSuccessMessage(null);
  };

  const handleReturnQuantityChange = (index, value) => {
    const newReturnItems = [...returnItems];
    if (!newReturnItems[index]) return;
    let inputQty = parseInt(value);
    if (isNaN(inputQty)) inputQty = 0;
    inputQty = Math.max(0, inputQty);
    const maxAllowed = newReturnItems[index].maxReturnable || newReturnItems[index].originalQuantity;
    newReturnItems[index].returnQuantity = Math.min(inputQty, maxAllowed);
    setReturnItems(newReturnItems);
  };

  const handleReturnPriceChange = (index, value) => {
    const newReturnItems = [...returnItems];
    if (!newReturnItems[index]) return;
    newReturnItems[index].returnPrice = parseCurrency(value);
    setReturnItems(newReturnItems);
  };

  const handleDeleteReturnItemFromList = (index) => {
    const itemName = returnItems[index]?.name || "Item";
    if (confirm(`Remove "${itemName}" from return?`)) {
      setReturnItems(returnItems.filter((_, i) => i !== index));
      setSuccessMessage(`"${itemName}" removed`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleSubmitReturn = async () => {
    if (!selectedPharmacy?.id || !selectedBill) {
      setError("Please select a pharmacy and bill");
      setTimeout(() => setError(null), 3000);
      return;
    }
    const itemsToReturn = returnItems.filter(item => item.returnQuantity > 0);
    if (itemsToReturn.length === 0) {
      setError("Please select at least one item to return");
      setTimeout(() => setError(null), 3000);
      return;
    }
    const invalidItems = itemsToReturn.filter(item => item.returnQuantity > item.availableQuantity);
    if (invalidItems.length > 0) {
      setError(`Cannot return more than available: ${invalidItems.map(i => i.name).join(", ")}`);
      setTimeout(() => setError(null), 5000);
      return;
    }
    try {
      setIsSubmitting(true);
      const totalReturnAmount = calculateReturnTotal(itemsToReturn);
      const totalReturnQty = itemsToReturn.reduce((sum, i) => sum + (i.returnQuantity || 0), 0);
      const billCurrency = itemsToReturn[0]?.currency || "USD"; 

      const preparedItems = itemsToReturn.map(item => {
        return {
          barcode: item.barcode,
          name: item.name,
          billNumber: selectedBill.billNumber,
          billId: selectedBill.id,
          originalQuantity: item.originalQuantity,
          returnQuantity: item.returnQuantity,
          returnPrice: item.returnPrice,
          originalPrice: item.returnPrice,
          netPrice: item.returnPrice,
          outPrice: item.returnPrice,
          currency: item.currency, 
          originalCurrency: item.originalCurrency || item.currency,
          expireDate: item.expireDate || null,
          pharmacyId: selectedPharmacy.id,
          pharmacyName: selectedPharmacy.name,
          pharmacyReturnBillNumber: pharmacyReturnBillNumber || "",
          availableQuantity: item.availableQuantity,
          alreadyReturned: item.alreadyReturned,
          newRemainingQuantity: item.originalQuantity - (item.alreadyReturned + item.returnQuantity),
          returnBillNumber: returnBillNumber,
          branch: item.branch || "Slemany",
          boughtBillNumber: item.boughtBillNumber || null,
          saleBatchAllocations: item.saleBatchAllocations || [],
        };
      });

      const result = await returnItemsToStore(
        selectedPharmacy.id,
        preparedItems,
        returnNote,
        returnBillNumber,
        totalReturnAmount,
        totalReturnQty,
        billCurrency 
      );

      setSuccessMessage(`Return processed successfully! Bill: ${result?.returnBillNumber || returnBillNumber}`);
      setSelectedBill(null);
      setExpandedBillId(null);
      setReturnItems([]);
      setPharmacyReturnBillNumber("");
      setReturnNote("");
      setReturnBillNumber("");

      const filteredReturnsData = await getFilteredReturns(
        selectedPharmacy.id,
        filters.note,
        filters.pharmacyReturnBillNumber
      );
      setReturns(filteredReturnsData);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error("Error processing return:", error);
      setError(`Failed to process return: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🔥 Strict lock on deleting paid returns
  const handleDeleteReturn = async (returnItem) => {
    if (!returnItem) { alert("Invalid return item"); return; }
    
    const status = String(returnItem.paymentStatus || "").toLowerCase();
    const isPaid = returnItem.isPaid === true || status === "paid" || status === "completed";

    if (isPaid) {
      alert("❌ This return bill has already been PAID and cannot be deleted.");
      return;
    }

    if (status === "processed") {
      alert("❌ This return bill is Processed and cannot be deleted directly. Change status to Unpaid first.");
      return;
    }

    if (confirm("Delete this entire return bill? Inventory will be adjusted automatically.")) {
      try {
        const deleteId = returnItem.documentId || returnItem.id;
        await deleteReturnBillAndRestoreToSale(deleteId);
        setSuccessMessage("Return deleted successfully!");
        const filteredReturnsData = await getFilteredReturns(
          selectedPharmacy?.id, filters.note, filters.pharmacyReturnBillNumber
        );
        setReturns(filteredReturnsData);
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (error) {
        console.error("Error deleting return:", error);
        setError(`Failed to delete: ${error.message}`);
        setTimeout(() => setError(null), 5000);
      }
    }
  };

  // 🔥 Strict lock on editing paid returns
  const handleEditReturn = async (returnItem) => {
    if (!returnItem?.documentId && !returnItem?.id) { alert("Invalid return item"); return; }

    const status = String(returnItem.paymentStatus || "").toLowerCase();
    const isPaid = returnItem.isPaid === true || status === "paid" || status === "completed";

    if (isPaid) {
      alert("❌ This return bill is marked as PAID and cannot be edited.");
      return;
    }

    if (status === "processed") {
      alert("⚠️ This return is Processed and cannot be edited. Change it to Unpaid first.");
      return;
    }

    try {
      const editId = returnItem.documentId || returnItem.id;
      const returnDetails = await getReturnById(editId);
      if (!returnDetails?.items) throw new Error("Could not fetch return details");

      setEditingReturn(returnDetails);
      setSelectedPharmacy({ id: returnDetails.pharmacyId, name: returnDetails.pharmacyName });
      setPharmacyReturnBillNumber(returnDetails.pharmacyReturnBillNumber || "");
      setReturnBillNumber(returnDetails.returnBillNumber);
      
      const extractedNote = extractNote(returnDetails);
      setReturnNote(extractedNote);

      const returnCurrency = returnDetails.currency || "IQD";

      const otherReturns = returns.filter(r =>
        r.billId === returnDetails.items[0]?.billId &&
        r.id !== returnDetails.id
      );

      const editableItems = returnDetails.items.map(item => {
        const alreadyReturnedByOthers = getAlreadyReturnedQuantity(
          item.barcode,
          item.billId,
          returnDetails.pharmacyId,
          otherReturns,
          returnDetails.id
        );
        const originalQty = item.originalQuantity || 0;
        const maxReturnable = originalQty;

        return {
          ...item,
          returnQuantity: item.returnQuantity || 0,
          returnPrice: item.returnPrice || 0,
          originalQuantity: originalQty,
          availableQuantity: maxReturnable - alreadyReturnedByOthers,
          maxReturnable: maxReturnable,
          alreadyReturnedByOthers: alreadyReturnedByOthers,
          newRemainingQuantity: originalQty - (alreadyReturnedByOthers + (item.returnQuantity || 0)),
          currency: returnCurrency,
          originalCurrency: item.originalCurrency || returnCurrency,
          branch: item.branch || "Slemany",
          boughtBillNumber: item.boughtBillNumber || null,
          saleBatchAllocations: item.saleBatchAllocations || [],
        };
      });

      setReturnItems(editableItems);
      setSuccessMessage(`Editing ${returnDetails.returnBillNumber}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error loading return:", error);
      setError(`Failed to load return: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleUpdateReturn = async () => {
    if (!editingReturn?.returnBillNumber) { setError("No return selected for editing"); return; }
    const itemsToReturn = returnItems.filter(item => item.returnQuantity > 0);
    if (itemsToReturn.length === 0) { setError("Please select at least one item"); return; }
    const invalidItems = itemsToReturn.filter(item => item.returnQuantity > (item.maxReturnable || item.originalQuantity));
    if (invalidItems.length > 0) {
      setError(`Cannot return more than original quantity for: ${invalidItems.map(i => i.name).join(", ")}`);
      return;
    }
    try {
      setIsSubmitting(true);
      const billCurrency = itemsToReturn[0]?.currency || "USD";

      const preparedItems = itemsToReturn.map(item => {
        return {
          id: item.id,
          barcode: item.barcode,
          name: item.name,
          billNumber: item.billNumber,
          billId: item.billId,
          originalQuantity: item.originalQuantity,
          returnQuantity: item.returnQuantity,
          returnPrice: item.returnPrice,
          originalPrice: item.originalPrice || item.returnPrice,
          netPrice: item.netPrice || item.returnPrice,
          outPrice: item.returnPrice,
          currency: item.currency,
          originalCurrency: item.originalCurrency || item.currency,
          expireDate: item.expireDate,
          pharmacyId: editingReturn.pharmacyId,
          pharmacyReturnBillNumber: pharmacyReturnBillNumber,
          newRemainingQuantity: item.originalQuantity - (item.alreadyReturnedByOthers + item.returnQuantity),
          branch: item.branch || "Slemany",
          boughtBillNumber: item.boughtBillNumber || null,
          saleBatchAllocations: item.saleBatchAllocations || [],
        };
      });

      const totalAmount = calculateReturnTotal(preparedItems);
      const totalQty = preparedItems.reduce((sum, i) => sum + (i.returnQuantity || 0), 0);

      await updateReturnItems(
        editingReturn.returnBillNumber, 
        preparedItems, 
        totalAmount, 
        totalQty, 
        billCurrency, 
        returnNote, 
        pharmacyReturnBillNumber
      );

      setSuccessMessage("Return updated successfully!");
      setEditingReturn(null);
      setReturnItems([]);
      setPharmacyReturnBillNumber("");
      setReturnNote("");

      const filteredReturnsData = await getFilteredReturns(
        selectedPharmacy?.id, filters.note, filters.pharmacyReturnBillNumber
      );
      setReturns(filteredReturnsData);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error("Error updating return:", error);
      setError(`Failed to update: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingReturn(null);
    setReturnItems([]);
    setPharmacyReturnBillNumber("");
    setReturnNote("");
    setSelectedBill(null);
    setExpandedBillId(null);
    setError(null);
    setSuccessMessage(null);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [allReturns, pharmaciesData, soldBillsData, usersData] = await Promise.all([
          getAllReturns(), getPharmacies(), getSoldBills(), getUsers()
        ]);
        setReturns(allReturns || []);
        setPharmacies((pharmaciesData || []).filter(p => p && p.id));
        setSoldBills((soldBillsData || []).filter(b => b && b.id));
        setUsers(usersData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to fetch data. Please try again. " + error.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const loadReturns = async () => {
      if (!selectedPharmacy?.id) return;
      try {
        const filteredReturnsData = await getFilteredReturns(
          selectedPharmacy.id, filters.note, filters.pharmacyReturnBillNumber
        );
        setReturns(filteredReturnsData || []);
      } catch (error) {
        console.error("Error fetching returns:", error);
      }
    };
    loadReturns();
  }, [selectedPharmacy, filters.note, filters.pharmacyReturnBillNumber]);

  useEffect(() => {
    if (editingReturn && editSectionRef.current) {
      setTimeout(() => { editSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100);
    }
  }, [editingReturn]);

  const styles = {
    header: { marginBottom: "24px" },
    headerTitle: { fontSize: "24px", fontWeight: "bold", color: "#1f2937", display: "flex", alignItems: "center", gap: "8px", ...nrtFontBoldStyle, marginBottom: "4px" },
    headerSubtitle: { color: "#6b7280", fontSize: "14px", ...nrtFontStyle },
    alertError: { marginBottom: "16px", padding: "16px", backgroundColor: "#fee2e2", borderLeft: "4px solid #ef4444", color: "#991b1b", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px", ...nrtFontStyle },
    alertSuccess: { marginBottom: "16px", padding: "16px", backgroundColor: "#d1fae5", borderLeft: "4px solid #10b981", color: "#065f46", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px", ...nrtFontStyle },
    cardHeader: { padding: "20px", borderBottom: "1px solid #e5e7eb", background: "linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)" },
    cardTitle: { fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px", color: "#374151", fontSize: "18px", ...nrtFontBoldStyle },
    cardBody: { padding: "20px" },
    filterGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px", marginBottom: "16px" },
    filterGroup: { display: "flex", flexDirection: "column", gap: "6px" },
    filterLabel: { fontSize: "14px", fontWeight: "500", color: "#4b5563", display: "flex", alignItems: "center", gap: "6px", ...nrtFontStyle },
    filterInput: { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", transition: "all 0.2s", ...nrtFontStyle, boxSizing: "border-box" },
    tableRow: { borderBottom: "1px solid #e5e7eb", transition: "backgroundColor 0.2s" },
    tableCell: { padding: "14px 16px", fontSize: "14px", color: "#4b5563", ...nrtFontStyle },
    badge: { display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: "6px", fontSize: "14px", fontWeight: "500", whiteSpace: "nowrap", ...nrtFontStyle },
    badgePrimary: { backgroundColor: "#dbeafe", color: "#1e40af" },
    badgeWarning: { backgroundColor: "#fef3c7", color: "#92400e" },
    badgePurple: { backgroundColor: "#f3e8ff", color: "#7c3aed" },
    badgeGreen: { backgroundColor: "#d1fae5", color: "#065f46" },
    btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer", border: "none", transition: "all 0.2s", whiteSpace: "nowrap", ...nrtFontStyle },
    btnPrimary: { backgroundColor: "#3b82f6", color: "white" },
    btnSecondary: { backgroundColor: "#6b7280", color: "white" },
    btnDanger: { backgroundColor: "#ef4444", color: "white" },
    btnSuccess: { backgroundColor: "#10b981", color: "white" },
    btnWarning: { backgroundColor: "#f59e0b", color: "white" },
    btnOutline: { backgroundColor: "transparent", border: "1px solid #d1d5db", color: "#4b5563" },
    btnSmall: { padding: "5px 10px", fontSize: "14px" },
    quantityInput: { width: "100%", minWidth: "60px", maxWidth: "120px", boxSizing: "border-box", padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "6px", textAlign: "center", fontSize: "14px", ...nrtFontStyle },
    priceInput: { width: "100%", minWidth: "80px", maxWidth: "150px", boxSizing: "border-box", padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "6px", textAlign: "right", fontSize: "14px", ...nrtFontStyle },
    flexBetween: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  };

  if (isLoading && returns.length === 0) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6', ...nrtFontStyle }}>
        <div style={{ animation: 'spin 1s linear infinite', borderRadius: '9999px', height: '40px', width: '40px', borderTop: '2px solid #3b82f6', borderBottom: '2px solid #3b82f6' }}></div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .full-width-container {
          width: 100%;
          min-height: 100vh;
          background-color: white;
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        .inner-content {
          width: 100%;
          box-sizing: border-box;
          padding: 15px;
        }
        .table-responsive {
          width: 100%;
          overflow-x: auto;
          overflow-y: auto;
          min-height: 50vh;
          max-height: 75vh;
          border-top: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1200px;
          margin: 0;
        }
      `}</style>

      <div className="full-width-container" style={nrtFontStyle}>
        <div className="inner-content">
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h1 style={styles.headerTitle}>
                <FaClipboardList style={{ color: "#3b82f6" }} /> Item Return History
              </h1>
              <p style={styles.headerSubtitle}>Manage and track all individual returned products</p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={exportToExcel} disabled={isExporting || displayFilteredAndSorted.length === 0} style={{ ...styles.btn, ...styles.btnSuccess }}>
                <FaFileExcel /> {isExporting ? "Exporting..." : "Export to Excel"}
              </button>
            </div>
          </div>

          {/* Messages */}
          {error && <div style={styles.alertError}><FaTimes /> {error}</div>}
          {successMessage && <div style={styles.alertSuccess}><FaCheck /> {successMessage}</div>}

          {/* Global Search Filters */}
          <div style={{ padding: '15px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Filter style={{ color: "#3b82f6" }} size={18} /> 
              <h3 style={{ margin: 0, fontWeight: '600', fontSize: '16px', ...nrtFontBoldStyle }}>Global Search Filters</h3>
            </div>
            <div style={styles.filterGrid}>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}><FaStore size={14} /> Pharmacy</label>
                <Select
                  options={[{ value: null, label: "All Pharmacies" }, ...pharmacies.map(p => ({ value: p, label: p.name }))]}
                  onChange={handlePharmacySelect}
                  placeholder="Select pharmacy..."
                  isClearable
                  maxMenuHeight={320}
                  styles={{ 
                    control: (base) => ({ 
                      ...base, 
                      fontFamily: nrtFontStyle.fontFamily, 
                      fontSize: '14px', 
                      boxSizing: "border-box" 
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 9999
                    })
                  }}
                />
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}><FaBox size={14} /> Item Name</label>
                <input style={styles.filterInput} placeholder="Search by item name..." value={filters.itemName} onChange={e => handleFilterChange("itemName", e.target.value)} />
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}><FaBarcode size={14} /> Barcode</label>
                <input style={styles.filterInput} placeholder="Search by barcode..." value={filters.barcode} onChange={e => handleFilterChange("barcode", e.target.value)} />
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}><FaDollarSign size={14} /> Payment Status</label>
                <select style={styles.filterInput} value={filters.paymentStatus} onChange={e => handleFilterChange("paymentStatus", e.target.value)}>
                  <option value="all">All Status</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Processed">Processed</option>
                </select>
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}><FaFileInvoice size={14} /> Orig. Bill Number</label>
                <input style={styles.filterInput} placeholder="Bill number..." value={filters.billNumber} onChange={e => handleFilterChange("billNumber", e.target.value)} />
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}><FaBuilding size={14} /> Pharmacy Return #</label>
                <input style={styles.filterInput} placeholder="Search by pharmacy return bill number.." value={filters.pharmacyReturnBillNumber} onChange={e => handleFilterChange("pharmacyReturnBillNumber", e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                Showing {displayFilteredAndSorted.length} items 
                {selectedPharmacy && ` for ${selectedPharmacy.name}`}
              </div>
              <div>
                <button
                  onClick={() => {
                    setFilters({ billNumber: "", itemName: "", barcode: "", paymentStatus: "all", pharmacyName: "", note: "", pharmacyReturnBillNumber: "" });
                    setColumnFilters({});
                  }}
                  style={{ ...styles.btn, ...styles.btnSecondary, padding: '6px 12px' }}
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          </div>

          {/* Returns History Table */}
          <div className="table-responsive">
            <table>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <TableHeader title="Return #" columnKey="returnBillNumber" colWidth="120px" />
                  <TableHeader title="Pharmacy" columnKey="pharmacyName" colWidth="400px" />
                  <TableHeader title="Item Name" columnKey="itemName" colWidth="auto" />
                  <TableHeader title="Barcode" columnKey="barcode" colWidth="130px" />
                  <TableHeader title="Qty" columnKey="itemQty" type="number" colWidth="90px" />
                  <TableHeader title="Price" columnKey="itemPrice" type="number" colWidth="110px" />
                  <TableHeader title="Total" columnKey="itemTotal" type="number" colWidth="120px" />
                  <TableHeader title="Orig. Bill" columnKey="billNumber" colWidth="110px" />
                  <TableHeader title="Date" columnKey="returnDate" colWidth="130px" />
                  <TableHeader title="Status" columnKey="paymentStatus" colWidth="110px" />
                  <th style={{ backgroundColor: "#999999", color: "white", padding: "14px 16px", textAlign: "center", fontSize: "14px", ...nrtFontBoldStyle, width: "160px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayFilteredAndSorted.map(row => {
                  const statusStyle = getStatusBadge(row.paymentStatus);
                  const canEdit = isEditable(row.parentBill);
                  const statusLower = String(row.paymentStatus || "").toLowerCase();
                  const isPaid = row.isPaid === true || statusLower === "paid" || statusLower === "completed";

                  return (
                    <tr
                      key={row.uniqueRowId}
                      style={styles.tableRow}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f9fafb"}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <td style={styles.tableCell}>
                        <div style={{ fontWeight: "bold", color: "#3b82f6", fontSize: "14px" }}>{row.returnBillNumber}</div>
                        {row.pharmacyReturnBillNumber && (
                          <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>Pharm: {row.pharmacyReturnBillNumber}</div>
                        )}
                      </td>
                      <td style={styles.tableCell}>{row.pharmacyName}</td>
                      <td style={{...styles.tableCell, fontWeight: "500"}}>{row.itemName}</td>
                      <td style={{...styles.tableCell, fontFamily: "monospace", fontSize: "13px"}}>{row.barcode}</td>
                      <td style={{ ...styles.tableCell, textAlign: "center" }}>
                        <span style={{ ...styles.badge, ...styles.badgeWarning }}>{row.itemQty}</span>
                      </td>
                      <td style={{ ...styles.tableCell, textAlign: "right" }}>
                        {formatCurrency(row.itemPrice, row.itemCurrency)}
                      </td>
                      <td style={{ ...styles.tableCell, textAlign: "right", fontWeight: "bold", color: "#059669" }}>
                        {formatCurrency(row.itemTotal, row.itemCurrency)}
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{ ...styles.badge, ...styles.badgePrimary }}>{row.billNumber}</span>
                      </td>
                      <td style={{...styles.tableCell, fontSize: "13px"}}>{formatDate(row.returnDate)}</td>
                      <td style={styles.tableCell}>
                        <span style={{ ...styles.badge, ...statusStyle }}>
                          {row.paymentStatus === "Paid"
                            ? <FaCheck size={10} style={{ marginRight: "3px" }} />
                            : row.paymentStatus === "Processed"
                              ? <FaLock size={10} style={{ marginRight: "3px" }} />
                              : <FaTimes size={10} style={{ marginRight: "3px" }} />
                          }
                          {row.paymentStatus}
                        </span>
                      </td>
                      <td style={{ ...styles.tableCell, textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center", gap: "6px", flexWrap: "wrap" }}>
                          <button
                            style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnPrimary, fontSize: "12px", padding: "4px 8px" }}
                            onClick={e => { e.stopPropagation(); handlePrint(row.parentBill); }}
                            title="Print original Return Bill"
                          >
                            <FaPrint size={11} /> Print
                          </button>
                          
                          {canEdit ? (
                            <button
                              style={{ ...styles.btn, ...styles.btnSecondary, ...styles.btnSmall, fontSize: "12px", padding: "4px 8px" }}
                              onClick={e => { e.stopPropagation(); handleEditReturn(row.parentBill); }}
                              title="Edit Bill"
                            >
                              <FaEdit size={11} /> Edit
                            </button>
                          ) : (
                            <button
                              style={{ ...styles.btn, ...styles.btnSmall, backgroundColor: "#e5e7eb", color: "#9ca3af", cursor: "not-allowed", fontSize: "12px", padding: "4px 8px" }}
                              title={isPaid ? "Paid returns cannot be edited" : "Change to Unpaid to edit"}
                              onClick={e => { 
                                e.stopPropagation(); 
                                alert(isPaid ? "❌ This return bill is PAID and cannot be edited." : "This return is Processed. Change it to Unpaid first to edit."); 
                              }}
                            >
                              <FaLock size={11} /> Edit
                            </button>
                          )}

                          {!isPaid ? (
                            <button
                              style={{ ...styles.btn, ...styles.btnDanger, ...styles.btnSmall, fontSize: "12px", padding: "4px 8px" }}
                              onClick={e => { e.stopPropagation(); handleDeleteReturn(row.parentBill); }}
                              title="Delete entire bill"
                            >
                              <FaTrash size={11} />
                            </button>
                          ) : (
                            <button
                              style={{ ...styles.btn, ...styles.btnSmall, backgroundColor: "#e5e7eb", color: "#9ca3af", cursor: "not-allowed", fontSize: "12px", padding: "4px 8px" }}
                              title="Paid returns cannot be deleted"
                              onClick={e => { 
                                e.stopPropagation(); 
                                alert("❌ This return bill has already been PAID and cannot be deleted."); 
                              }}
                            >
                              <FaLock size={11} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {displayFilteredAndSorted.length === 0 && (
                  <tr>
                    <td colSpan="11" style={{ padding: "60px", textAlign: "center", color: "#6b7280" }}>
                      <FaBox size={48} style={{ color: "#d1d5db", marginBottom: "16px", display: "block", margin: "0 auto 16px" }} />
                      <p style={nrtFontStyle}>No item returns found matching the current filters.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Create / Edit Return Section */}
          {selectedPharmacy?.id && (
            <div style={{ marginTop: "24px", padding: "20px", backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} ref={editSectionRef}>
              <h3 style={{ ...styles.cardTitle, marginBottom: "20px" }}>
                {editingReturn
                  ? <><FaEdit style={{ color: "#ea580c" }} /> Edit Return Bill — {editingReturn.returnBillNumber}</>
                  : <><FaRedo style={{ color: "#10b981" }} /> Create New Return Bill</>}
              </h3>
              
              {/* Meta fields */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px", marginBottom: "24px", padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                <div style={styles.filterGroup}>
                  <label style={styles.filterLabel}>Return Bill Number</label>
                  <input style={{ ...styles.filterInput, backgroundColor: "#f3f4f6", fontFamily: "monospace" }} value={returnBillNumber} readOnly placeholder="Auto-generated" />
                  <small style={{ fontSize: "12px", color: "#6b7280" }}>Auto-generated sequential number</small>
                </div>
                <div style={styles.filterGroup}>
                  <label style={styles.filterLabel}>Pharmacy Return Invoice #</label>
                  <input style={styles.filterInput} value={pharmacyReturnBillNumber} onChange={e => setPharmacyReturnBillNumber(e.target.value)} placeholder="Optional" />
                </div>
                <div style={styles.filterGroup}>
                  <label style={styles.filterLabel}>Note</label>
                  <input style={styles.filterInput} value={returnNote} onChange={e => setReturnNote(e.target.value)} placeholder="Add a note..." />
                </div>
              </div>

              {/* Bill list (create mode) */}
              {!editingReturn ? (
                <>
                  <h4 style={{ fontWeight: "bold", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px", ...nrtFontBoldStyle }}>
                    <FaFileInvoice style={{ color: "#6b7280" }} /> Available Bills for Return
                  </h4>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", minWidth: "600px", borderCollapse: "collapse" }}>
                        <thead style={{ backgroundColor: "#34495e", color: "white" }}>
                          <tr>
                            {[
                              { key: "billNumber", label: "Bill #" },
                              { key: "date", label: "Date" },
                              { key: "currency", label: "Currency", align: "center" },
                              { key: "totalAmount", label: "Total Amount", align: "right" },
                              { key: "items", label: "Items", align: "center" },
                            ].map(({ key, label, align }) => (
                              <th key={key} style={{ padding: "12px 16px", textAlign: align || "left", fontSize: "14px", ...nrtFontBoldStyle, borderRight: "1px solid #576574" }}>
                                {label}
                              </th>
                            ))}
                            <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "14px", ...nrtFontBoldStyle }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBills.map(bill => {
                            const currency = getBillCurrency(bill);
                            const total = currency === "USD"
                              ? (bill.totalAmountUSD || bill.items?.reduce((s, i) => s + (getItemPrice(i, "USD") * (i.quantity || 0)), 0) || 0)
                              : (bill.totalAmountIQD || bill.items?.reduce((s, i) => s + (getItemPrice(i, "IQD") * (i.quantity || 0)), 0) || 0);
                            const isExpanded = expandedBillId === bill.id;
                            return (
                              <React.Fragment key={bill.id}>
                                <tr
                                  style={{ borderBottom: "1px solid #e5e7eb", cursor: "pointer", backgroundColor: isExpanded ? "#eff6ff" : "transparent", transition: "all 0.2s" }}
                                  onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.backgroundColor = "#f9fafb"; }}
                                  onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.backgroundColor = "transparent"; }}
                                  onClick={() => toggleBillSelection(bill)}
                                >
                                  <td style={{ padding: "12px 16px", fontWeight: "bold", color: "#3b82f6", ...nrtFontStyle }}>{bill.billNumber}</td>
                                  <td style={{ padding: "12px 16px", fontSize: "14px", ...nrtFontStyle }}>{formatDate(bill.date)}</td>
                                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                                    <span style={{ ...styles.badge, ...(currency === 'USD' ? styles.badgeGreen : styles.badgePurple) }}>{currency}</span>
                                  </td>
                                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "bold", color: "#059669", ...nrtFontStyle }}>{formatCurrency(total, currency)}</td>
                                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                                    <span style={{ ...styles.badge, backgroundColor: "#e5e7eb", color: "#374151" }}>{bill.items?.length || 0}</span>
                                  </td>
                                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                                    <button
                                      style={{ ...styles.btn, ...styles.btnPrimary, ...styles.btnSmall }}
                                      onClick={e => { e.stopPropagation(); toggleBillSelection(bill); }}
                                    >
                                      {isExpanded ? "Close" : "Select"}
                                    </button>
                                  </td>
                                </tr>

                                {isExpanded && selectedBill?.id === bill.id && (
                                  <tr>
                                    <td colSpan="6" style={{ padding: "20px", backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                                      <div style={{ backgroundColor: "white", borderRadius: "8px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #e5e7eb" }}>
                                        <h5 style={{ fontWeight: "bold", marginBottom: "16px", fontSize: "16px", ...nrtFontBoldStyle }}>Select Items to Return</h5>
                                        {returnItems.length > 0 ? (
                                          <>
                                            <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "6px" }}>
                                              <table style={{ width: "100%", fontSize: "14px", minWidth: "800px", borderCollapse: "collapse" }}>
                                                <thead style={{ backgroundColor: "#f3f4f6", ...nrtFontBoldStyle, color: "#374151" }}>
                                                  <tr>
                                                    <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>Item</th>
                                                    <th style={{ padding: "10px 12px", textAlign: "center", borderBottom: "2px solid #e5e7eb" }}>Original</th>
                                                    <th style={{ padding: "10px 12px", textAlign: "center", borderBottom: "2px solid #e5e7eb" }}>Already Returned</th>
                                                    <th style={{ padding: "10px 12px", textAlign: "center", borderBottom: "2px solid #e5e7eb" }}>Available to Return</th>
                                                    <th style={{ padding: "10px 12px", textAlign: "center", borderBottom: "2px solid #e5e7eb", color: "#3b82f6" }}>Return Qty</th>
                                                    <th style={{ padding: "10px 12px", textAlign: "right", borderBottom: "2px solid #e5e7eb" }}>Return Price</th>
                                                    <th style={{ padding: "10px 12px", textAlign: "right", borderBottom: "2px solid #e5e7eb" }}>Total</th>
                                                    <th style={{ padding: "10px 12px", textAlign: "center", borderBottom: "2px solid #e5e7eb" }}>Action</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {returnItems.map((item, idx) => {
                                                    const itemTotal = (item.returnQuantity || 0) * (item.returnPrice || 0);
                                                    return (
                                                      <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: item.returnQuantity > 0 ? "#eff6ff" : "white" }}>
                                                        <td style={{ padding: "10px 12px" }}>
                                                          <div style={{ fontWeight: "600", color: "#1f2937", ...nrtFontStyle }}>{item.name}</div>
                                                          <div style={{ fontSize: "12px", color: "#6b7280", fontFamily: "monospace" }}>{item.barcode}</div>
                                                        </td>
                                                        <td style={{ padding: "10px 12px", textAlign: "center", color: "#4b5563" }}>{item.originalQuantity}</td>
                                                        <td style={{ padding: "10px 12px", textAlign: "center", color: "#ea580c", fontWeight: "500" }}>{item.alreadyReturned}</td>
                                                        <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: "bold", color: "#059669" }}>{item.availableQuantity}</td>
                                                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                                          <input type="number" min="0" max={item.availableQuantity} value={item.returnQuantity} onChange={e => handleReturnQuantityChange(idx, e.target.value)} style={{ ...styles.quantityInput, borderColor: item.returnQuantity > 0 ? "#3b82f6" : "#d1d5db" }} />
                                                        </td>
                                                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                                          <input type="number" step="0.01" value={item.returnPrice} onChange={e => handleReturnPriceChange(idx, e.target.value)} style={styles.priceInput} />
                                                        </td>
                                                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "bold", color: "#059669", ...nrtFontStyle }}>{formatCurrency(itemTotal, item.currency)}</td>
                                                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                                          <button style={{ ...styles.btn, ...styles.btnDanger, padding: "4px 8px", fontSize: "12px" }} onClick={() => handleDeleteReturnItemFromList(idx)}>
                                                            <FaTrash size={10} /> Remove
                                                          </button>
                                                        </td>
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                                <tfoot style={{ backgroundColor: "#f9fafb", ...nrtFontBoldStyle, color: "#374151" }}>
                                                  <tr>
                                                    <td colSpan="4" style={{ padding: "12px 16px", textAlign: "right" }}>Totals:</td>
                                                    <td style={{ padding: "12px 16px", textAlign: "center", fontSize: "16px", color: "#3b82f6" }}>{returnItems.reduce((s, i) => s + (i.returnQuantity || 0), 0)}</td>
                                                    <td></td>
                                                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#059669", fontSize: "16px" }}>
                                                      {formatCurrency(returnItems.reduce((s, i) => s + ((i.returnQuantity || 0) * (i.returnPrice || 0)), 0), returnItems[0]?.currency)}
                                                    </td>
                                                    <td></td>
                                                  </tr>
                                                </tfoot>
                                              </table>
                                            </div>
                                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #e5e7eb" }}>
                                              <button style={{ ...styles.btn, ...styles.btnOutline, padding: "10px 20px" }} onClick={handleCancelBillSelection}>Cancel</button>
                                              <button
                                                style={{ ...styles.btn, ...styles.btnSuccess, padding: "10px 24px", fontSize: "16px" }}
                                                onClick={handleSubmitReturn}
                                                disabled={isSubmitting || returnItems.filter(i => i.returnQuantity > 0).length === 0}
                                              >
                                                {isSubmitting ? "Processing..." : <><FaCheck /> Process Return</>}
                                              </button>
                                            </div>
                                          </>
                                        ) : (
                                          <div style={{ textAlign: "center", padding: "40px", color: "#6b7280", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px dashed #d1d5db" }}>
                                            <FaBox size={40} style={{ color: "#d1d5db", marginBottom: "16px", display: "block", margin: "0 auto 16px" }} />
                                            <p style={{ fontSize: "16px", ...nrtFontStyle }}>All items in this bill have already been fully returned.</p>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                          {filteredBills.length === 0 && (
                            <tr>
                              <td colSpan="6" style={{ padding: "60px", textAlign: "center", color: "#6b7280" }}>
                                <FaFileInvoice size={48} style={{ color: "#d1d5db", marginBottom: "16px", display: "block", margin: "0 auto 16px" }} />
                                <p style={nrtFontStyle}>No bills found for this pharmacy</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                /* Edit mode */
                <>
                  <h4 style={{ fontWeight: "bold", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", ...nrtFontBoldStyle }}>
                    <FaEdit style={{ color: "#ea580c" }} /> Editing Return Items
                  </h4>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", minWidth: "900px", borderCollapse: "collapse" }}>
                        <thead style={{ backgroundColor: "#34495e", color: "white", ...nrtFontBoldStyle }}>
                          <tr>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", borderRight: "1px solid #576574" }}>Item</th>
                            <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "14px", borderRight: "1px solid #576574" }}>Original Qty</th>
                            <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "14px", borderRight: "1px solid #576574" }}>Others Returned</th>
                            <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "14px", borderRight: "1px solid #576574" }}>Max Returnable</th>
                            <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "14px", borderRight: "1px solid #576574", color: "#93c5fd" }}>Current Return Qty</th>
                            <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "14px", borderRight: "1px solid #576574" }}>Return Price</th>
                            <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "14px", borderRight: "1px solid #576574" }}>Total</th>
                            <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "14px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {returnItems.map((item, idx) => {
                            const itemTotal = (item.returnQuantity || 0) * (item.returnPrice || 0);
                            return (
                              <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "white" }}>
                                <td style={{ padding: "12px 16px" }}>
                                  <div style={{ fontWeight: "600", color: "#1f2937", ...nrtFontStyle }}>{item.name}</div>
                                  <div style={{ fontSize: "12px", color: "#6b7280", fontFamily: "monospace" }}>{item.barcode}</div>
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "center", color: "#4b5563" }}>{item.originalQuantity}</td>
                                <td style={{ padding: "12px 16px", textAlign: "center", color: "#ea580c" }}>{item.alreadyReturnedByOthers || 0}</td>
                                <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "bold", color: "#059669" }}>
                                  {item.maxReturnable || item.originalQuantity}
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "center", backgroundColor: "#f0f9ff" }}>
                                  <input
                                    type="number"
                                    min="0"
                                    max={item.maxReturnable || item.originalQuantity}
                                    value={item.returnQuantity}
                                    onChange={e => handleReturnQuantityChange(idx, e.target.value)}
                                    style={{ ...styles.quantityInput, borderColor: "#3b82f6" }}
                                  />
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right", backgroundColor: "#f0f9ff" }}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.returnPrice}
                                    onChange={e => handleReturnPriceChange(idx, e.target.value)}
                                    style={{ ...styles.priceInput, borderColor: "#3b82f6" }}
                                  />
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "bold", color: "#059669", ...nrtFontStyle }}>{formatCurrency(itemTotal, item.currency)}</td>
                                <td style={{ padding: "12px 16px", textAlign: "center" }}>
                                  <button style={{ ...styles.btn, ...styles.btnDanger, padding: "6px 12px", fontSize: "12px" }} onClick={() => handleDeleteReturnItemFromList(idx)}>
                                    <FaTrash size={12} style={{ marginRight: "4px" }}/> Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot style={{ backgroundColor: "#f9fafb", ...nrtFontBoldStyle, color: "#374151" }}>
                          <tr>
                            <td colSpan="4" style={{ padding: "16px", textAlign: "right", borderTop: "2px solid #e5e7eb" }}>Totals:</td>
                            <td style={{ padding: "16px", textAlign: "center", fontSize: "18px", color: "#3b82f6", borderTop: "2px solid #e5e7eb" }}>{returnItems.reduce((s, i) => s + (i.returnQuantity || 0), 0)}</td>
                            <td style={{ borderTop: "2px solid #e5e7eb" }}></td>
                            <td style={{ padding: "16px", textAlign: "right", color: "#059669", fontSize: "18px", borderTop: "2px solid #e5e7eb" }}>
                              {formatCurrency(returnItems.reduce((s, i) => s + ((i.returnQuantity || 0) * (i.returnPrice || 0)), 0), returnItems[0]?.currency)}
                            </td>
                            <td style={{ borderTop: "2px solid #e5e7eb" }}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #e5e7eb" }}>
                    <button style={{ ...styles.btn, ...styles.btnOutline, padding: "10px 20px" }} onClick={handleCancelEdit}>Cancel Edit</button>
                    <button
                      style={{ ...styles.btn, ...styles.btnWarning, padding: "10px 24px", fontSize: "16px", backgroundColor: "#f59e0b", color: "white" }}
                      onClick={handleUpdateReturn}
                      disabled={isSubmitting || returnItems.filter(i => i.returnQuantity > 0).length === 0}
                    >
                      {isSubmitting ? "Updating..." : <><FaEdit /> Update Return Bill</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}