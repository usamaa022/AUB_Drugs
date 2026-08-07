"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import Select from "react-select";
import * as XLSX from "xlsx";
import {
  Package,
  Search,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  FileDown,
  Printer,
  BarChart3,
  Filter
} from "lucide-react";
import { getInitializedItems, getItemStockLedger } from "@/lib/data";

// ---- Type presentation (badge color, icon, sign) per ledger row type ----
const TYPE_META = {
  buy: { label: "Bought", color: "#2563eb", bg: "#eff6ff", icon: TrendingUp },
  sell: { label: "Sold", color: "#dc2626", bg: "#fef2f2", icon: TrendingDown },
  sell_return: { label: "Sale Return", color: "#059669", bg: "#ecfdf5", icon: RotateCcw },
  bought_return: { label: "Return to Company", color: "#d97706", bg: "#fffbeb", icon: RotateCcw },
};

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

// Helper to format date strictly to dd/mm/yyyy (safeguarded against timezone shifts)
const formatLocalDDMMYYYY = (dateVal) => {
  if (!dateVal) return "N/A";
  try {
    let dateObj;
    if (dateVal?.toDate) {
      dateObj = dateVal.toDate();
    } else if (dateVal?.seconds) {
      dateObj = new Date(dateVal.seconds * 1000);
    } else if (dateVal instanceof Date) {
      dateObj = dateVal;
    } else {
      const dateString = String(dateVal);
      if (dateString.includes('T')) {
        dateObj = new Date(dateString);
      } else {
        dateObj = new Date(dateString.replace(/-/g, '/'));
      }
    }

    if (!dateObj || isNaN(dateObj.getTime())) return "N/A";

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "N/A";
  }
};

export default function InventoryLedgerPage() {
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [selectedOption, setSelectedOption] = useState(null);

  const [ledger, setLedger] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [error, setError] = useState(null);

  // Global filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Column Filters & Sorting State
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });

  // Ref for print content
  const printRef = useRef();

  // Handle outside click for dropdowns
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
    (async () => {
      try {
        const initItems = await getInitializedItems();
        setItems(initItems);
      } catch (e) {
        console.error("Error loading items:", e);
        setError("Failed to load items list.");
      } finally {
        setLoadingItems(false);
      }
    })();
  }, []);

  const itemOptions = useMemo(
    () =>
      items
        .filter((it) => it.barcode)
        .map((it) => ({
          value: it.barcode,
          label: `${it.name || "Unnamed"} — ${it.barcode}`,
          name: it.name,
          barcode: it.barcode,
        })),
    [items]
  );

  const loadLedger = async (barcode) => {
    setLoadingLedger(true);
    setError(null);
    try {
      const data = await getItemStockLedger(barcode);
      setLedger(data);
    } catch (e) {
      console.error("Error loading ledger:", e);
      setError("Failed to load the stock ledger for this item.");
      setLedger([]);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleSelectItem = (option) => {
    setSelectedOption(option);
    if (option) loadLedger(option.value);
    else setLedger([]);
  };

  const handleSort = (key) => {
    const newDirection = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction: newDirection });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // --- Filtering Logic ---
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

  const filteredLedger = useMemo(() => {
    let sorted = [...ledger].sort((a, b) => {
      const key = sortConfig.key;
      const direction = sortConfig.direction;
      let valA = a[key];
      let valB = b[key];

      if (key === 'date') {
         valA = a.date ? new Date(a.date).getTime() : 0;
         valB = b.date ? new Date(b.date).getTime() : 0;
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted.filter((row) => {
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (startDate) {
        const rowDate = new Date(row.date);
        const from = new Date(startDate);
        if (rowDate < from) return false;
      }
      if (endDate) {
        const rowDate = new Date(row.date);
        const to = new Date(endDate);
        to.setHours(23, 59, 59, 999);
        if (rowDate > to) return false;
      }

      for (const [columnKey, filterData] of Object.entries(columnFilters)) {
        let itemValue = "";
        if (columnKey === 'date') itemValue = formatLocalDDMMYYYY(row.date);
        if (columnKey === 'type') itemValue = TYPE_META[row.type]?.label || row.type;
        if (columnKey === 'billNumber') itemValue = row.billNumber;
        if (columnKey === 'party') itemValue = row.party;
        if (columnKey === 'qtyIn') itemValue = row.qtyIn || 0;
        if (columnKey === 'qtyOut') itemValue = row.qtyOut || 0;
        if (columnKey === 'price') itemValue = row.price || 0;
        if (columnKey === 'total') itemValue = row.total || 0;
        if (columnKey === 'balance') itemValue = row.balance || 0;
        if (columnKey === 'note') itemValue = row.note || "";

        const isNum = ['qtyIn', 'qtyOut', 'price', 'total', 'balance'].includes(columnKey);
        if (!evaluateFilter(itemValue, filterData, isNum ? "number" : "string")) return false;
      }
      return true;
    });
  }, [ledger, typeFilter, startDate, endDate, sortConfig, columnFilters]);

  // Excel Dropdown Component for Column Headers
  const ExcelFilterDropdown = ({ columnKey, type = "string", alignDropdown = "right" }) => {
    const [search, setSearch] = useState("");
    const isOpen = activeFilterDropdown === columnKey;
    const operators = type === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;
    
    const filterState = columnFilters[columnKey] || { operator: operators[0].value, textValue: '', selectedValues: [] };
    const { operator, textValue, selectedValues } = filterState;

    const uniqueValues = useMemo(() => {
      const vals = new Set();
      ledger.forEach(row => {
        let val = "";
        if (columnKey === 'date') val = formatLocalDDMMYYYY(row.date);
        if (columnKey === 'type') val = TYPE_META[row.type]?.label || row.type;
        if (columnKey === 'billNumber') val = row.billNumber;
        if (columnKey === 'party') val = row.party;
        if (columnKey === 'qtyIn') val = row.qtyIn || 0;
        if (columnKey === 'qtyOut') val = row.qtyOut || 0;
        if (columnKey === 'price') val = row.price || 0;
        if (columnKey === 'total') val = row.total || 0;
        if (columnKey === 'balance') val = row.balance || 0;
        if (columnKey === 'note') val = row.note || "";
        vals.add(String(val || ""));
      });
      return Array.from(vals).sort();
    }, [ledger, columnKey]);

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
          onClick={(e) => { e.stopPropagation(); setActiveFilterDropdown(isOpen ? null : columnKey); }}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "0.25rem", borderRadius: "0.375rem", background: isActive ? "#dbeafe" : "transparent", color: isActive ? "#2563eb" : "#94a3b8" }}
        >
          <Filter size={14} />
        </div>

        {isOpen && (
          <div style={{ 
            position: "absolute", 
            top: "100%", 
            ...(alignDropdown === "left" ? { left: 0 } : { right: 0 }),
            marginTop: "0.5rem", 
            background: "white", 
            border: "1px solid #cbd5e1", 
            borderRadius: "0.5rem", 
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)", 
            zIndex: 9999, 
            width: "260px", 
            maxWidth: "85vw", 
            display: "flex", 
            flexDirection: "column", 
            cursor: "default", 
            overflow: "hidden", 
            color: "#2c3e50" 
          }} onClick={e => e.stopPropagation()}>
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

  const TableHeader = ({ title, columnKey, type = "string", textAlign="left", alignDropdown="right" }) => (
    <th style={{ ...styles.th, textAlign: textAlign }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: textAlign === "right" ? "flex-end" : "space-between", gap: "6px" }}>
        <div onClick={() => handleSort(columnKey)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
          {title}
          <span className="no-print" style={{ fontSize: "11px", color: "#94a3b8" }}>
            {getSortIcon(columnKey)}
          </span>
        </div>
        <ExcelFilterDropdown columnKey={columnKey} type={type} alignDropdown={alignDropdown} />
      </div>
    </th>
  );

  const summary = useMemo(() => {
    const totalIn = ledger.reduce((s, r) => s + (r.qtyIn || 0), 0);
    const totalOut = ledger.reduce((s, r) => s + (r.qtyOut || 0), 0);
    const currentBalance = ledger.length ? ledger[ledger.length - 1].balance : 0;
    return { totalIn, totalOut, currentBalance, transactions: ledger.length };
  }, [ledger]);

  const formatQty = (n) => (n ? n.toLocaleString() : "—");
  const formatMoney = (amount, currency) => {
    if (!amount) return "—";
    const formatted =
      currency === "IQD"
        ? Math.round(amount).toLocaleString()
        : amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${currency === "IQD" ? "IQD " : "$"}${formatted}`;
  };

  const handleExport = () => {
    if (!filteredLedger.length || !selectedOption) return;
    const rows = filteredLedger.map((r) => ({
      Date: formatLocalDDMMYYYY(r.date),
      Type: TYPE_META[r.type]?.label || r.type,
      "Bill No.": r.billNumber,
      "Ref Bill No.": r.refBillNumber || "",
      Party: r.party,
      "Qty In": r.qtyIn || "",
      "Qty Out": r.qtyOut || "",
      Currency: r.currency,
      "Unit Price": r.price || "",
      Total: r.total || "",
      Balance: r.balance,
      Note: r.note || "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Ledger");
    XLSX.writeFile(workbook, `Stock_Ledger_${selectedOption.barcode}.xlsx`);
  };

  // --- FIXED Print Handler ---
  const handlePrint = () => {
    if (!selectedOption || filteredLedger.length === 0) {
      alert("Please select an item with data to print.");
      return;
    }

    // Get the print content
    const printContent = document.getElementById('print-content');
    if (!printContent) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      alert('Please allow popups for printing.');
      return;
    }

    // Get the current date for the print header
    const now = new Date();
    const printDate = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Build the print HTML
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Stock Ledger - ${selectedOption.name}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              padding: 20px;
              background: white;
              color: #1e293b;
            }
            .print-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 2px solid #1e293b;
            }
            .print-title {
              font-size: 24px;
              font-weight: 700;
              color: #0f172a;
            }
            .print-subtitle {
              font-size: 14px;
              color: #64748b;
              margin-top: 4px;
            }
            .print-meta {
              text-align: right;
              font-size: 14px;
              color: #64748b;
            }
            .print-summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
              margin-bottom: 20px;
              padding: 15px;
              background: #f8fafc;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
            }
            .summary-item {
              display: flex;
              flex-direction: column;
            }
            .summary-label {
              font-size: 12px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.03em;
            }
            .summary-value {
              font-size: 18px;
              font-weight: 700;
              color: #0f172a;
              margin-top: 4px;
            }
            .summary-value.positive { color: #059669; }
            .summary-value.negative { color: #dc2626; }
            
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
            }
            th {
              background: #f1f5f9;
              padding: 10px 12px;
              text-align: left;
              font-weight: 600;
              border-bottom: 2px solid #e2e8f0;
              color: #475569;
              text-transform: uppercase;
              font-size: 11px;
              letter-spacing: 0.04em;
            }
            td {
              padding: 8px 12px;
              border-bottom: 1px solid #f1f5f9;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .badge {
              display: inline-block;
              padding: 2px 10px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
            }
            .badge-buy { background: #eff6ff; color: #2563eb; }
            .badge-sell { background: #fef2f2; color: #dc2626; }
            .badge-sell_return { background: #ecfdf5; color: #059669; }
            .badge-bought_return { background: #fffbeb; color: #d97706; }
            .print-footer {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 1px solid #e2e8f0;
              text-align: center;
              font-size: 12px;
              color: #94a3b8;
            }
            .qty-in { color: #059669; font-weight: 700; }
            .qty-out { color: #dc2626; font-weight: 700; }
            .balance-total { font-weight: 800; }
            @media print {
              body { padding: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <div>
              <div class="print-title">📊 Stock Ledger</div>
              <div class="print-subtitle">
                ${selectedOption.name} 
                <span style="color: #94a3b8; margin: 0 8px;">•</span>
                Barcode: ${selectedOption.barcode}
              </div>
            </div>
            <div class="print-meta">
              Printed: ${printDate}
            </div>
          </div>

          <div class="print-summary">
            <div class="summary-item">
              <span class="summary-label">Total In</span>
              <span class="summary-value positive">+${summary.totalIn.toLocaleString()}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Total Out</span>
              <span class="summary-value negative">-${summary.totalOut.toLocaleString()}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Current Balance</span>
              <span class="summary-value">${summary.currentBalance.toLocaleString()}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Transactions</span>
              <span class="summary-value">${summary.transactions}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Movement</th>
                <th>Bill No.</th>
                <th>Party</th>
                <th class="text-right">Qty In</th>
                <th class="text-right">Qty Out</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Total</th>
                <th class="text-right">Balance</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              ${filteredLedger.map((row, idx) => {
                const meta = TYPE_META[row.type] || { label: row.type, color: "#475569", bg: "#f1f5f9" };
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${formatLocalDDMMYYYY(row.date)}</td>
                    <td><span class="badge badge-${row.type}">${meta.label}</span></td>
                    <td>${row.billNumber || ''}${row.refBillNumber ? `<br><small style="color:#94a3b8">ref: ${row.refBillNumber}</small>` : ''}</td>
                    <td>${row.party || ''}</td>
                    <td class="text-right qty-in">${row.qtyIn ? `+${row.qtyIn.toLocaleString()}` : '—'}</td>
                    <td class="text-right qty-out">${row.qtyOut ? `-${row.qtyOut.toLocaleString()}` : '—'}</td>
                    <td class="text-right">${formatMoney(row.price, row.currency)}</td>
                    <td class="text-right">${formatMoney(row.total, row.currency)}</td>
                    <td class="text-right balance-total">${row.balance.toLocaleString()}</td>
                    <td style="color:#64748b">${row.note || '—'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="print-footer">
            Generated from Inventory System • ${printDate}
          </div>

          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          <\/script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const styles = {
    container: {
      minHeight: "100vh",
      width: "100%",
      background: "linear-gradient(135deg, #f0f4ff 0%, #e8ecf1 100%)",
      boxSizing: "border-box",
    },
    wrapper: { width: "100%", padding: "1rem 0rem", boxSizing: "border-box" },
    header: {
      width: "100%",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      padding: "1.5rem 2rem",
      borderRadius: "20px",
      marginBottom: "1.5rem",
      boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "1rem",
      boxSizing: "border-box",
    },
    headerTitle: { color: "white", fontSize: "1.8rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.75rem" },
    headerSubtitle: { color: "rgba(255,255,255,0.7)", fontSize: "0.9rem", margin: "0.25rem 0 0 0" },
    card: {
      width: "100%",
      background: "white",
      borderRadius: "20px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      overflow: "visible",
      marginBottom: "1.25rem",
      boxSizing: "border-box",
    },
    cardBody: { padding: "1.25rem 1.5rem", boxSizing: "border-box", position: "relative" },
    label: { fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.03em", display: "block" },
    filterGrid: { display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "1rem", alignItems: "end" },
    input: {
      padding: "0.6rem 0.75rem", border: "2px solid #e2e8f0", borderRadius: "10px", fontSize: "0.9rem",
      outline: "none", width: "100%", background: "white", color: "#1e293b", boxSizing: "border-box", minHeight: "44px"
    },
    summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.25rem" },
    summaryCard: { background: "white", borderRadius: "16px", padding: "1.1rem 1.25rem", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: "0.35rem" },
    summaryLabel: { fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em" },
    summaryValue: { fontSize: "1.6rem", fontWeight: 700, color: "#0f172a" },
    tableContainer: { 
      width: "100%", 
      overflowX: "auto", 
      overflowY: "auto",
      minHeight: "65vh", 
      maxHeight: "80vh", 
      borderRadius: "12px", 
      border: "1px solid #e2e8f0", 
      background: "white" 
    },
    table: { width: "100%", minWidth: "1050px", borderCollapse: "collapse", fontSize: "0.87rem" },
    th: {
      padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.04em", color: "#475569", background: "#f8fafc", borderBottom: "2px solid #e2e8f0",
      whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 10,
    },
    td: { padding: "0.7rem 1rem", borderBottom: "1px solid #f1f5f9", color: "#1e293b", whiteSpace: "nowrap" },
    badge: { padding: "0.25rem 0.65rem", borderRadius: "20px", fontSize: "0.72rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.3rem" },
    toolbarBtn: { display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", borderRadius: "10px", border: "none", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" },
    emptyState: { padding: "4rem 2rem", textAlign: "center", color: "#64748b" },
  };

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: "44px",
      borderRadius: "10px",
      borderWidth: "2px",
      borderColor: state.isFocused ? "#6366f1" : "#e2e8f0",
      boxShadow: "none",
    }),
    menu: (base) => ({ ...base, zIndex: 9999, position: 'absolute' }),
  };

  return (
    <>
      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          body, html { background: white !important; margin: 0; padding: 0; height: auto !important; }
          .no-print { display: none !important; }
          .print-area { display: block !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
          .table-container-print { overflow: visible !important; border: none !important; margin: 0 !important; box-shadow: none !important; }
          table { width: 100% !important; page-break-inside: auto; border-collapse: collapse !important; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th { -webkit-print-color-adjust: exact; color-adjust: exact; }
          td, th { border: 1px solid #ddd !important; padding: 6px !important; }
        }
      `}</style>

      <div style={styles.container} className="print-area">
        <div style={styles.wrapper}>
          <div style={styles.header} className="no-print">
            <div>
              <h1 style={styles.headerTitle}>
                <BarChart3 size={26} />
                Inventory Ledger
              </h1>
              <p style={styles.headerSubtitle}>
                Full stock card — every purchase, sale, sale return and company return for one item, in order
              </p>
            </div>
          </div>

          {/* Item picker + filters */}
          <div style={styles.card} className="no-print">
            <div style={styles.cardBody}>
              <div style={styles.filterGrid}>
                <div>
                  <label style={styles.label}>
                    <Search size={13} style={{ verticalAlign: "-2px", marginRight: "0.3rem" }} />
                    Item (search by name or barcode)
                  </label>
                  <Select
                    options={itemOptions}
                    value={selectedOption}
                    onChange={handleSelectItem}
                    isLoading={loadingItems}
                    isClearable
                    placeholder="Select an item..."
                    styles={selectStyles}
                  />
                </div>
                <div>
                  <label style={styles.label}>From</label>
                  <input
                    type="date"
                    style={styles.input}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={styles.label}>To</label>
                  <input
                    type="date"
                    style={styles.input}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={styles.label}>Movement</label>
                  <select
                    style={styles.input}
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="all">All movements</option>
                    <option value="buy">Bought</option>
                    <option value="sell">Sold</option>
                    <option value="sell_return">Sale Return</option>
                    <option value="bought_return">Return to Company</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ ...styles.card, ...styles.cardBody, color: "#dc2626", fontWeight: 600 }} className="no-print">
              {error}
            </div>
          )}

          {!selectedOption && !loadingLedger && (
            <div style={styles.card} className="no-print">
              <div style={styles.emptyState}>
                <Package size={40} style={{ opacity: 0.35, marginBottom: "0.75rem" }} />
                <div style={{ fontWeight: 600, fontSize: "1rem", color: "#334155" }}>
                  Select an item above to see its full stock ledger
                </div>
                <div style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
                  Every bought bill, sold bill, sale return and bought return for that item will be listed
                  chronologically with a running remaining-quantity balance.
                </div>
              </div>
            </div>
          )}

          {loadingLedger && (
            <div style={styles.card} className="no-print">
              <div style={styles.emptyState}>Loading ledger…</div>
            </div>
          )}

          {selectedOption && !loadingLedger && (
            <>
              {/* Summary cards */}
              <div style={styles.summaryGrid}>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Item</span>
                  <span style={{ ...styles.summaryValue, fontSize: "1.05rem" }}>
                    {selectedOption.name}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    Barcode: {selectedOption.barcode}
                  </span>
                </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Total In</span>
                  <span style={{ ...styles.summaryValue, color: "#059669" }}>
                    +{summary.totalIn.toLocaleString()}
                  </span>
                </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Total Out</span>
                  <span style={{ ...styles.summaryValue, color: "#dc2626" }}>
                    -{summary.totalOut.toLocaleString()}
                  </span>
                </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Current Remaining</span>
                  <span style={styles.summaryValue}>{summary.currentBalance.toLocaleString()}</span>
                </div>
                <div style={{...styles.summaryCard, display: 'none'}} className="no-print">
                  <span style={styles.summaryLabel}>Transactions</span>
                  <span style={styles.summaryValue}>{summary.transactions}</span>
                </div>
              </div>

              {/* Toolbar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  marginBottom: "0.75rem",
                }}
                className="no-print"
              >
                <button
                  style={{ ...styles.toolbarBtn, background: "#8b5cf6", color: "white" }}
                  onClick={handleExport}
                  disabled={!filteredLedger.length}
                >
                  <FileDown size={16} /> Export Excel
                </button>
                <button
                  style={{ ...styles.toolbarBtn, background: "#0f172a", color: "white" }}
                  onClick={handlePrint}
                  disabled={!filteredLedger.length}
                >
                  <Printer size={16} /> Print
                </button>
              </div>

              {/* Ledger table */}
              <div style={{...styles.card, overflow: "visible"}} className="table-container-print" id="print-content">
                <div style={styles.tableContainer} className="table-container-print">
                  {filteredLedger.length === 0 ? (
                    <div style={styles.emptyState} className="no-print">No movements found for this item in the selected range.</div>
                  ) : (
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>#</th>
                          <TableHeader title="Date" columnKey="date" alignDropdown="left" />
                          <TableHeader title="Movement" columnKey="type" alignDropdown="left" />
                          <TableHeader title="Bill No." columnKey="billNumber" alignDropdown="left" />
                          <TableHeader title="Party" columnKey="party" alignDropdown="left" />
                          <TableHeader title="Qty In" columnKey="qtyIn" type="number" textAlign="right" alignDropdown="right" />
                          <TableHeader title="Qty Out" columnKey="qtyOut" type="number" textAlign="right" alignDropdown="right" />
                          <TableHeader title="Unit Price" columnKey="price" type="number" textAlign="right" alignDropdown="right" />
                          <TableHeader title="Total" columnKey="total" type="number" textAlign="right" alignDropdown="right" />
                          <TableHeader title="Remaining" columnKey="balance" type="number" textAlign="right" alignDropdown="right" />
                          <TableHeader title="Note" columnKey="note" alignDropdown="right" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLedger.map((row, idx) => {
                          const meta = TYPE_META[row.type] || {
                            label: row.type,
                            color: "#475569",
                            bg: "#f1f5f9",
                            icon: Package,
                          };
                          const Icon = meta.icon;
                          return (
                            <tr key={row.rowId ?? idx}>
                              <td style={styles.td}>{idx + 1}</td>
                              <td style={styles.td}>{formatLocalDDMMYYYY(row.date)}</td>
                              <td style={styles.td}>
                                <span
                                  style={{
                                    ...styles.badge,
                                    color: meta.color,
                                    background: meta.bg,
                                  }}
                                >
                                  <span className="no-print"><Icon size={12} /></span> {meta.label}
                                </span>
                              </td>
                              <td style={styles.td}>
                                {row.billNumber}
                                {row.refBillNumber ? (
                                  <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                                    ref: {row.refBillNumber}
                                  </div>
                                ) : null}
                              </td>
                              <td style={styles.td}>{row.party}</td>
                              <td style={{ ...styles.td, textAlign: "right", color: "#059669", fontWeight: 700 }}>
                                {row.qtyIn ? `+${formatQty(row.qtyIn)}` : "—"}
                              </td>
                              <td style={{ ...styles.td, textAlign: "right", color: "#dc2626", fontWeight: 700 }}>
                                {row.qtyOut ? `-${formatQty(row.qtyOut)}` : "—"}
                              </td>
                              <td style={{ ...styles.td, textAlign: "right" }}>
                                {formatMoney(row.price, row.currency)}
                              </td>
                              <td style={{ ...styles.td, textAlign: "right", fontWeight: 600 }}>
                                {formatMoney(row.total, row.currency)}
                              </td>
                              <td
                                style={{
                                  ...styles.td,
                                  textAlign: "right",
                                  fontWeight: 800,
                                  color: row.balance < 0 ? "#dc2626" : "#0f172a",
                                }}
                              >
                                {row.balance.toLocaleString()}
                              </td>
                              <td style={{ ...styles.td, whiteSpace: "normal", color: "#64748b" }}>
                                {row.note || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}