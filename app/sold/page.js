"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { searchSoldBills, getPharmacies, getBase64BillAttachment, getBillAttachmentUrlEnhanced } from "@/lib/data";
import React from "react";
import Select from "react-select";
import * as XLSX from 'xlsx';
import { Search, X, Filter, ChevronDown, Check, Maximize2, Minimize2, Download, Image as ImageIcon } from "lucide-react";

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

export default function SoldPage() {
  // --- State ---
  const [bills, setBills] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [userRole, setUserRole] = useState('user');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Global Range Filters (Dates)
  const [globalFilters, setGlobalFilters] = useState({
    startDate: "",
    endDate: "",
  });

  // Advanced Excel-Style Column Filters 
  // Structure: { columnKey: { operator: 'contains', textValue: '', selectedValues: [] } }
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Modal State
  const [attachmentModal, setAttachmentModal] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // --- Initialization ---
  useEffect(() => {
    const role = localStorage.getItem('userRole') || 'user';
    setUserRole(role);
    
    const handleClickOutside = (e) => {
      if (!e.target.closest('.filter-dropdown-container')) {
        setActiveFilterDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [billsData, pharmaciesData] = await Promise.all([
          searchSoldBills(""),
          getPharmacies()
        ]);
        
        const billsWithAttachments = await Promise.all(
          billsData.map(async (bill) => {
            try {
              let url = await getBase64BillAttachment(bill.billNumber);
              if (!url) url = await getBillAttachmentUrlEnhanced(bill.billNumber);
              return { ...bill, attachment: url || null, hasAttachment: !!url };
            } catch (error) {
              return { ...bill, attachment: null, hasAttachment: false };
            }
          })
        );
        
        billsWithAttachments.sort((a, b) => new Date(b.date) - new Date(a.date));
        setBills(billsWithAttachments);
        setPharmacies(pharmaciesData);
      } catch (error) {
        setError("Failed to fetch data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Formatters ---
  const formatNumberIQD = (num) => num ? Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "0";
  const formatNumberUSD = (num) => num ? Number(num).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "0";

  // Robust Expire Date Formatter (fixes the N/A issue)
  const formatExpireDate = (date) => {
    if (!date) return "N/A";
    try {
      let dateObj;
      if (date.toDate && typeof date.toDate === "function") {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (date.seconds) {
        dateObj = new Date(date.seconds * 1000);
      } else if (typeof date === "string") {
        dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
          // Handle DD/MM/YYYY
          const parts = date.split("/");
          if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const year = parseInt(parts[2]);
            dateObj = new Date(year, month, day);
          }
          // Handle DD-MM-YYYY
          if (isNaN(dateObj.getTime())) {
            const parts2 = date.split("-");
            if (parts2.length === 3) {
              const year = parseInt(parts2[0]);
              const month = parseInt(parts2[1]) - 1;
              const day = parseInt(parts2[2]);
              dateObj = new Date(year, month, day);
            }
          }
        }
      } else {
        return "N/A";
      }
      
      if (!dateObj || isNaN(dateObj.getTime())) return "N/A";
      const day = String(dateObj.getDate()).padStart(2, "0");
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const year = dateObj.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error("Error formatting expire date:", error, date);
      return "N/A";
    }
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // --- Data Processing ---
  const allItems = useMemo(() =>
    bills.flatMap(bill =>
      bill.items?.map(item => {
        // 🔥 FIXED: Selling Currency is determined by the BILL, not the item's original state
        const billCurrency = bill.currency || 'USD'; 
        const isIQD = billCurrency === 'IQD';
        const isUSD = billCurrency === 'USD';

        const priceIQD = isIQD ? (item.outPriceIQD || item.price || 0) : 0;
        const priceUSD = isUSD ? (item.outPriceUSD || item.price || 0) : 0;

        return {
          ...item,
          billNumber: String(bill.billNumber),
          saleDate: bill.date,
          pharmacyId: bill.pharmacyId,
          pharmacyName: pharmacies.find(p => p.id === bill.pharmacyId)?.name || bill.pharmacyName || 'Unknown',
          paymentStatus: bill.paymentStatus || 'Unpaid',
          isConsignment: bill.isConsignment ? 'تحت صرف' : 'Owned',
          attachment: bill.attachment || item.attachment || null,
          hasAttachment: (bill.hasAttachment || item.attachment) ? 'Yes' : 'No',
          billCurrency, // Store the bill currency for rendering later
          priceIQD, priceUSD,
          totalPriceIQD: isIQD ? (priceIQD * (item.quantity || 0)) : 0,
          totalPriceUSD: isUSD ? (priceUSD * (item.quantity || 0)) : 0,
          originalCurrency: item.originalCurrency || 'USD',
          netPriceIQD: item.originalCurrency === 'IQD' ? (item.netPriceIQD || item.netPrice || 0) : 0,
          netPriceUSD: item.originalCurrency === 'USD' ? (item.netPriceUSD || item.netPrice || 0) : 0,
          expireDate: item.expireDate || null,
          
          _formattedSaleDate: formatDateTime(bill.date),
          _formattedExpireDate: formatExpireDate(item.expireDate)
        };
      }) || []
    ), [bills, pharmacies]
  );

  // --- Advanced Filter Engine ---
  const evaluateFilter = (itemValue, filterData) => {
    if (!filterData) return true;
    const { operator, textValue, selectedValues } = filterData;
    
    // 1. Array Selection Filter (Checkboxes)
    if (selectedValues && selectedValues.length > 0) {
      if (!selectedValues.includes(String(itemValue))) return false;
    }

    // 2. Operator Condition Filter
    if (operator && (textValue !== "" || ['isEmpty', 'isNotEmpty'].includes(operator))) {
      const valStr = String(itemValue || '').toLowerCase();
      const searchStr = String(textValue).toLowerCase();
      const valNum = Number(itemValue);
      const searchNum = Number(textValue);

      switch (operator) {
        case 'contains': if (!valStr.includes(searchStr)) return false; break;
        case 'equals': if (valStr !== searchStr && valNum !== searchNum) return false; break;
        case 'notEquals': if (valNum === searchNum) return false; break;
        case 'startsWith': if (!valStr.startsWith(searchStr)) return false; break;
        case 'endsWith': if (!valStr.endsWith(searchStr)) return false; break;
        case 'greaterThan': if (valNum <= searchNum) return false; break;
        case 'greaterThanOrEqual': if (valNum < searchNum) return false; break;
        case 'lessThan': if (valNum >= searchNum) return false; break;
        case 'lessThanOrEqual': if (valNum > searchNum) return false; break;
        case 'isEmpty': if (itemValue !== null && itemValue !== undefined && itemValue !== '') return false; break;
        case 'isNotEmpty': if (itemValue === null || itemValue === undefined || itemValue === '') return false; break;
        default: break;
      }
    }
    return true;
  };

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (globalFilters.startDate || globalFilters.endDate) {
        const saleDate = item.saleDate?.toDate ? item.saleDate.toDate() : new Date(item.saleDate);
        if (globalFilters.startDate) {
          const start = new Date(globalFilters.startDate.split('/').reverse().join('-'));
          if (saleDate < start) return false;
        }
        if (globalFilters.endDate) {
          const end = new Date(globalFilters.endDate.split('/').reverse().join('-'));
          end.setHours(23, 59, 59, 999);
          if (saleDate > end) return false;
        }
      }

      for (const [columnKey, filterData] of Object.entries(columnFilters)) {
        let itemValue = item[columnKey];
        if (columnKey === 'saleDate') itemValue = item._formattedSaleDate;
        if (columnKey === 'expireDate') itemValue = item._formattedExpireDate;
        
        if (!evaluateFilter(itemValue, filterData)) return false;
      }
      return true;
    });
  }, [allItems, globalFilters, columnFilters]);

  // --- Sorting Logic ---
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      if (!sortConfig.key) return 0;
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (["saleDate", "expireDate"].includes(sortConfig.key)) {
        aValue = aValue?.toDate ? aValue.toDate().getTime() : new Date(aValue).getTime();
        bValue = bValue?.toDate ? bValue.toDate().getTime() : new Date(bValue).getTime();
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortConfig]);

  const itemsWithUniqueId = sortedItems.map((item, index) => ({
    ...item, uniqueId: `${item.billNumber}-${item.barcode}-${index}`,
  }));

  // --- Handlers ---
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const handleUpdateColumnFilter = (columnKey, updates) => {
    setColumnFilters(prev => {
      const current = prev[columnKey] || { operator: '', textValue: '', selectedValues: [] };
      const next = { ...current, ...updates };
      
      // Cleanup if empty
      if (!next.operator && !next.textValue && (!next.selectedValues || next.selectedValues.length === 0)) {
        const newFilters = { ...prev };
        delete newFilters[columnKey];
        return newFilters;
      }
      return { ...prev, [columnKey]: next };
    });
  };

  const clearColumnFilter = (columnKey) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[columnKey];
      return next;
    });
  };

  // --- Download Function ---
  const downloadImage = async (url, billNumber) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Invoice_${billNumber}_Attachment.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      // Fallback for direct base64
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice_${billNumber}_Attachment.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // --- Excel Export ---
  const exportToExcel = () => {
    if (itemsWithUniqueId.length === 0) return alert("No data to export.");
    const exportData = itemsWithUniqueId.map((item, index) => ({
      '#': index + 1,
      'ناوی کاڵا': item.name,
      'بارکۆد': item.barcode,
      'عدد': item.quantity,
      'نرخ (دینار)': item.billCurrency === 'IQD' ? formatNumberIQD(item.priceIQD) : "0",
      'کۆی گشتی (دینار)': item.billCurrency === 'IQD' ? formatNumberIQD(item.totalPriceIQD) : "0",
      'نرخ ($)': item.billCurrency === 'USD' ? formatNumberUSD(item.priceUSD) : "0",
      'کۆی گشتی ($)': item.billCurrency === 'USD' ? formatNumberUSD(item.totalPriceUSD) : "0",
      'ژمارەی پسوڵە': item.billNumber,
      'دەرمانخانە': item.pharmacyName,
      'بەرواری فرۆشتن': item._formattedSaleDate,
      'دۆخی تحت صرف': item.isConsignment,
      'بەرواری بەسەرچوون': item._formattedExpireDate,
      'جۆری پارەدان': item.paymentStatus,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sold Items");
    XLSX.writeFile(wb, `sold_items_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // --- Component: Advanced Excel-Style Dropdown ---
  const ExcelFilterDropdown = ({ columnKey, title, type = "string", isDate = false, isTime = false }) => {
    const [search, setSearch] = useState("");
    const isOpen = activeFilterDropdown === columnKey;
    const operators = type === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;
    
    const filterState = columnFilters[columnKey] || { operator: operators[0].value, textValue: '', selectedValues: [] };
    const { operator, textValue, selectedValues } = filterState;

    const uniqueValues = useMemo(() => {
      const vals = new Set();
      allItems.forEach(item => {
        let val = item[columnKey];
        if (isTime) val = item._formattedSaleDate;
        else if (isDate) val = item._formattedExpireDate;
        vals.add(String(val));
      });
      return Array.from(vals).sort();
    }, [allItems, columnKey, isDate, isTime]);

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
          style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "0.25rem", borderRadius: "0.375rem", background: isActive ? "#dbeafe" : "transparent", color: isActive ? "#2563eb" : "#94a3b8", transition: "all 0.2s" }}
        >
          <Filter size={14} />
        </div>

        {isOpen && (
          <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "0.5rem", background: "white", border: "1px solid #cbd5e1", borderRadius: "0.5rem", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)", zIndex: 100, width: "260px", display: "flex", flexDirection: "column", cursor: "default", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            
            {/* Top Section: Condition Operator */}
            <div style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>Condition</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <select 
                  value={operator || operators[0].value} 
                  onChange={(e) => handleUpdateColumnFilter(columnKey, { operator: e.target.value })}
                  style={{ padding: "0.4rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.875rem", outline: "none", background: "white" }}
                >
                  {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                {!['isEmpty', 'isNotEmpty'].includes(operator) && (
                  <input 
                    type={type === "number" ? "number" : "text"} 
                    placeholder="Value..." 
                    value={textValue || ""} 
                    onChange={(e) => handleUpdateColumnFilter(columnKey, { textValue: e.target.value })}
                    style={{ padding: "0.4rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.875rem", outline: "none" }}
                  />
                )}
              </div>
            </div>

            {/* Bottom Section: Multi-Select Checkboxes */}
            <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", flex: 1 }}>
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>Values</p>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: "0.375rem", padding: "0.25rem 0.5rem", marginBottom: "0.5rem" }}>
                <Search size={14} color="#94a3b8" />
                <input 
                  type="text" 
                  placeholder="Search values..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  style={{ border: "none", outline: "none", width: "100%", fontSize: "0.875rem", marginLeft: "0.5rem" }} 
                />
              </div>

              <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", padding: "0.25rem", cursor: "pointer", fontWeight: "500", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem", marginBottom: "0.25rem" }}>
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
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val === "undefined" || val === "null" || val === "" ? "(Blank)" : val}</span>
                  </label>
                ))}
                {displayValues.length === 0 && <div style={{ fontSize: "0.875rem", color: "#94a3b8", textAlign: "center", padding: "1rem 0" }}>No matches found</div>}
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", padding: "0.75rem", backgroundColor: "#f8fafc" }}>
              <button onClick={() => clearColumnFilter(columnKey)} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: "0.875rem", cursor: "pointer", fontWeight: 600 }}>Clear</button>
              <button onClick={() => setActiveFilterDropdown(null)} style={{ background: "#2563eb", border: "none", color: "white", fontSize: "0.875rem", padding: "0.4rem 1rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600 }}>Apply</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const TableHeader = ({ title, columnKey, isDate = false, isTime = false, type="string", color = "#334155", isLast = false }) => (
    <th style={{ 
      padding: "0.75rem", 
      borderBottom: "2px solid #cbd5e1", 
      borderRight: isLast ? "none" : "1px solid #cbd5e1", // The Vertical Border
      verticalAlign: "middle", 
      whiteSpace: "nowrap",
      backgroundColor: "#f8fafc" 
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: "600", color: color, fontSize: "0.875rem" }}>
        
        {/* Left Side: Title & Sort */}
        <div onClick={() => handleSort(columnKey)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem", flex: 1, userSelect: "none" }}>
          {title}
          <span style={{ color: "#94a3b8", fontSize: "0.75rem", width: "12px" }}>
            {sortConfig.key === columnKey ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </div>

        {/* Right Side: Filter Icon with a subtle inner divider */}
        <div style={{ paddingLeft: "0.5rem", borderLeft: "1px solid #e2e8f0", marginLeft: "0.5rem" }}>
          <ExcelFilterDropdown columnKey={columnKey} title={title} type={type} isDate={isDate} isTime={isTime} />
        </div>

      </div>
    </th>
  );

  // --- Handlers ---
  const handleOpenAttachment = async (item) => {
    setAttachmentModal(item);
    setIsFullscreen(false);
    if (item.attachment) {
      setImagePreview(item.attachment);
      return;
    }
    try {
      let url = await getBase64BillAttachment(item.billNumber);
      if (!url) url = await getBillAttachmentUrlEnhanced(item.billNumber);
      if (url) {
        setImagePreview(url);
        setBills(prev => prev.map(bill => bill.billNumber === item.billNumber ? { ...bill, attachment: url, hasAttachment: true } : bill));
      } else {
        setImagePreview(null);
      }
    } catch (error) {
      setImagePreview(null);
    }
  };

  if (isLoading) return <div style={{ padding: "2rem", textAlign: "center", fontWeight: "bold", fontSize: "1.25rem", color: "#475569" }}>Loading Sales Architecture...</div>;
  if (error) return <div style={{ padding: "2rem", color: "#dc2626", fontWeight: "bold" }}>{error}</div>;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "98%", margin: "0 auto", padding: "1.5rem" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#0f172a", margin: 0 }}>Sales History</h1>
        <div style={{ display: "flex", gap: "1rem" }}>
          {Object.keys(columnFilters).length > 0 && (
            <button onClick={() => setColumnFilters({})} style={{ padding: "0.5rem 1rem", backgroundColor: "#fef2f2", color: "#ef4444", border: "1px solid #fca5a5", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", transition: "background 0.2s" }}>
              Clear Filters
            </button>
          )}
          <button onClick={exportToExcel} style={{ padding: "0.5rem 1.25rem", backgroundColor: "#10b981", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.2)", transition: "background 0.2s" }}>
            Export to Excel 📊
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", backgroundColor: "#fff", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.5rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#475569", display: "block", marginBottom: "0.375rem" }}>Start Date</label>
          <input type="date" value={globalFilters.startDate ? globalFilters.startDate.split('/').reverse().join('-') : ''} onChange={(e) => setGlobalFilters({...globalFilters, startDate: e.target.value ? e.target.value.split('-').reverse().join('/') : ''})} style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", outline: "none", color: "#0f172a" }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#475569", display: "block", marginBottom: "0.375rem" }}>End Date</label>
          <input type="date" value={globalFilters.endDate ? globalFilters.endDate.split('/').reverse().join('-') : ''} onChange={(e) => setGlobalFilters({...globalFilters, endDate: e.target.value ? e.target.value.split('-').reverse().join('/') : ''})} style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", outline: "none", color: "#0f172a" }} />
        </div>
      </div>

      <div style={{ backgroundColor: "#fff", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", overflowX: "auto", minHeight: "500px", paddingBottom: "8rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "2000px", textAlign: "left" }}>
          <thead style={{ backgroundColor: "#f8fafc", position: "sticky", top: 0, zIndex: 10 }}>
            <tr>
              <TableHeader title="Product Name" columnKey="name" />
              <TableHeader title="Barcode" columnKey="barcode" />
              <TableHeader title="Qty" columnKey="quantity" type="number" />
              <TableHeader title="Price (IQD)" columnKey="priceIQD" type="number" color="#059669" />
              <TableHeader title="Total (IQD)" columnKey="totalPriceIQD" type="number" color="#059669" />
              <TableHeader title="Price ($)" columnKey="priceUSD" type="number" color="#2563eb" />
              <TableHeader title="Total ($)" columnKey="totalPriceUSD" type="number" color="#2563eb" />
              <TableHeader title="Invoice #" columnKey="billNumber" />
              <TableHeader title="Client" columnKey="pharmacyName" />
              <TableHeader title="Sell Date & Time" columnKey="saleDate" isTime={true} />
              <TableHeader title="Consignment" columnKey="isConsignment" />
              <TableHeader title="Expire Date" columnKey="expireDate" isDate={true} />
              <TableHeader title="Status" columnKey="paymentStatus" />
              <TableHeader title="Attachment" columnKey="hasAttachment" isLast={!['admin', 'superAdmin'].includes(userRole)} />
              
              {['admin', 'superAdmin'].includes(userRole) && (
                <>
                  <TableHeader title="Net (IQD)" columnKey="netPriceIQD" type="number" color="#ea580c" />
                  <TableHeader title="Net ($)" columnKey="netPriceUSD" type="number" color="#ea580c" isLast={true} />
                </>
              )}
            </tr>
          </thead>
          
          <tbody>
            {itemsWithUniqueId.length === 0 ? (
              <tr><td colSpan="20" style={{ padding: "3rem", textAlign: "center", color: "#94a3b8", fontSize: "1.125rem" }}>No records match the current filters.</td></tr>
            ) : (
              itemsWithUniqueId.map((item, index) => (
                <tr key={item.uniqueId} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: index % 2 === 0 ? "white" : "#fafafa", transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.background="#f1f5f9"} onMouseOut={e=>e.currentTarget.style.background=index % 2 === 0 ? "white" : "#fafafa"}>
                  <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", fontWeight: "500", color: "#0f172a", borderRight: "1px solid #e2e8f0" }}>{item.name}</td>
                  <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{item.barcode}</td>
                  <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", fontWeight: "600", color: "#334155", borderRight: "1px solid #e2e8f0" }}>{item.quantity}</td>
                  <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#059669", borderRight: "1px solid #e2e8f0" }}>{item.billCurrency === 'IQD' ? formatNumberIQD(item.priceIQD) : ""}</td>
                  <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#059669", fontWeight: "bold", borderRight: "1px solid #e2e8f0" }}>{item.billCurrency === 'IQD' ? formatNumberIQD(item.totalPriceIQD) : ""}</td>
                  <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#2563eb", borderRight: "1px solid #e2e8f0" }}>{item.billCurrency === 'USD' ? formatNumberUSD(item.priceUSD) : ""}</td>
                  <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#2563eb", fontWeight: "bold", borderRight: "1px solid #e2e8f0" }}>{item.billCurrency === 'USD' ? formatNumberUSD(item.totalPriceUSD) : ""}</td>
                  <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", fontFamily: "monospace", color: "#475569", borderRight: "1px solid #e2e8f0" }}>{item.billNumber}</td>
                  <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#0f172a", fontWeight: "500", borderRight: "1px solid #e2e8f0" }}>{item.pharmacyName}</td>
                  <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#475569", borderRight: "1px solid #e2e8f0" }}>{item._formattedSaleDate}</td>
                  
                  <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.75rem", borderRight: "1px solid #e2e8f0" }}>
                    <span style={{ padding: "0.25rem 0.6rem", borderRadius: "0.375rem", background: item.isConsignment === 'تحت صرف' ? '#fef3c7' : '#f1f5f9', color: item.isConsignment === 'تحت صرف' ? '#92400e' : '#475569', fontWeight: "600", border: `1px solid ${item.isConsignment === 'تحت صرف' ? '#fde68a' : '#e2e8f0'}` }}>
                      {item.isConsignment}
                    </span>
                  </td>

                  <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", borderRight: "1px solid #e2e8f0", color: (new Date(item.expireDate) < new Date() && item.expireDate !== null) ? "#dc2626" : "#475569", fontWeight: (new Date(item.expireDate) < new Date() && item.expireDate !== null) ? "bold" : "normal" }}>
                    {item._formattedExpireDate}
                  </td>

                  <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.75rem", borderRight: "1px solid #e2e8f0" }}>
                    <span style={{ padding: "0.25rem 0.6rem", borderRadius: "0.375rem", background: item.paymentStatus === 'Paid' ? '#dcfce7' : item.paymentStatus === 'Cash' ? '#e0e7ff' : '#fee2e2', color: item.paymentStatus === 'Paid' ? '#166534' : item.paymentStatus === 'Cash' ? '#1e40af' : '#991b1b', fontWeight: "600", border: `1px solid ${item.paymentStatus === 'Paid' ? '#bbf7d0' : item.paymentStatus === 'Cash' ? '#c7d2fe' : '#fecaca'}` }}>
                      {item.paymentStatus}
                    </span>
                  </td>
                  
                  <td style={{ padding: "0.875rem 0.75rem", borderRight: ['admin', 'superAdmin'].includes(userRole) ? "1px solid #e2e8f0" : "none" }}>
                    {item.hasAttachment === 'Yes' ? (
                      <button onClick={(e) => { e.stopPropagation(); handleOpenAttachment(item); }} style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem", backgroundColor: "#f8fafc", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.75rem", fontWeight: "600", transition: "all 0.2s" }} onMouseOver={e=>e.currentTarget.style.backgroundColor="#eff6ff"} onMouseOut={e=>e.currentTarget.style.backgroundColor="#f8fafc"}>
                        <ImageIcon size={14} /> View
                      </button>
                    ) : (
                      <span style={{ color: "#cbd5e1", fontSize: "0.875rem" }}>None</span>
                    )}
                  </td>
                  
                  {['admin', 'superAdmin'].includes(userRole) && (
                    <>
                      <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#ea580c", borderRight: "1px solid #e2e8f0" }}>{item.originalCurrency === 'IQD' ? formatNumberIQD(item.netPriceIQD) : ""}</td>
                      <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#ea580c" }}>{item.originalCurrency === 'USD' ? formatNumberUSD(item.netPriceUSD) : ""}</td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Attachment View Modal with Fullscreen & Download support */}
      {attachmentModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isFullscreen ? "#000000" : "rgba(15, 23, 42, 0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: isFullscreen ? "0" : "1.5rem", transition: "background-color 0.3s ease" }}>
          <div style={{ backgroundColor: isFullscreen ? "#000000" : "white", borderRadius: isFullscreen ? "0" : "0.75rem", width: "100%", height: isFullscreen ? "100%" : "auto", maxWidth: isFullscreen ? "none" : "36rem", display: "flex", flexDirection: "column", boxShadow: isFullscreen ? "none" : "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)", overflow: "hidden", transition: "all 0.3s ease" }}>
            
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem", borderBottom: isFullscreen ? "1px solid #334155" : "1px solid #e2e8f0", backgroundColor: isFullscreen ? "#0f172a" : "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: isFullscreen ? "#f8fafc" : "#0f172a", margin: 0 }}>Invoice #{attachmentModal.billNumber}</h3>
                <span style={{ fontSize: "0.875rem", color: isFullscreen ? "#94a3b8" : "#64748b" }}>{attachmentModal.pharmacyName}</span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {imagePreview && (
                  <button onClick={() => downloadImage(imagePreview, attachmentModal.billNumber)} style={{ background: "#2563eb", border: "none", color: "white", display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.4rem 0.75rem", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: "500", transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.background="#1d4ed8"} onMouseOut={e=>e.currentTarget.style.background="#2563eb"}>
                    <Download size={16} /> Save to Gallery
                  </button>
                )}
                <button onClick={() => setAttachmentModal(null)} style={{ background: isFullscreen ? "#334155" : "#f1f5f9", border: "none", color: isFullscreen ? "#f8fafc" : "#475569", width: "36px", height: "36px", borderRadius: "0.375rem", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.background=isFullscreen ? "#475569" : "#e2e8f0"} onMouseOut={e=>e.currentTarget.style.background=isFullscreen ? "#334155" : "#f1f5f9"}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Image Viewer Area */}
            <div style={{ flex: 1, padding: isFullscreen ? "0" : "1.5rem", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: isFullscreen ? "#000000" : "#f8fafc", minHeight: "300px", position: "relative" }}>
              {imagePreview ? (
                <>
                  <img 
                    src={imagePreview} 
                    alt="Invoice Attachment" 
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    style={{ maxWidth: "100%", maxHeight: isFullscreen ? "100vh" : "60vh", objectFit: "contain", borderRadius: isFullscreen ? "0" : "0.5rem", boxShadow: isFullscreen ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.1)", cursor: "zoom-in", transition: "all 0.3s ease" }} 
                  />
                  <button onClick={() => setIsFullscreen(!isFullscreen)} style={{ position: "absolute", bottom: "1rem", right: "1rem", background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(255,255,255,0.2)", color: "white", padding: "0.5rem", borderRadius: "0.5rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
                    {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                  </button>
                </>
              ) : (
                <div style={{ textAlign: "center", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                  <ImageIcon size={48} opacity={0.5} />
                  <p style={{ margin: 0, fontWeight: "500" }}>Loading or No Image Available</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
