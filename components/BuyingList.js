"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import React from 'react';
import { getBoughtBills, getCompanies, deleteBoughtBill, updateBoughtBill } from "@/lib/data";
import { useRouter } from "next/navigation";
import Select from "react-select";
import { 
  FiChevronUp, 
  FiChevronDown, 
  FiX, 
  FiDownload, 
  FiCamera, 
  FiImage, 
  FiFilter, 
  FiSearch, 
  FiMaximize2, 
  FiMinimize2 
} from "react-icons/fi";

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

// Helper functions
const formatNumber = (number) => {
  if (!number && number !== 0) return '0';
  if (Number.isInteger(number)) {
    return new Intl.NumberFormat('en-US').format(number);
  } else {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number);
  }
};

const formatDateToDDMMYYYY = (date) => {
  if (!date) return 'N/A';
  try {
    let dateObj = null;
    if (date?.toDate && typeof date.toDate === 'function') {
      dateObj = date.toDate();
    } else if (date?.seconds) {
      dateObj = new Date(date.seconds * 1000);
    } else if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      if (date.includes('-')) {
        const [year, month, day] = date.split('-');
        dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
      } else if (date.includes('/')) {
        const [day, month, year] = date.split('/');
        dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
      }
    }

    if (dateObj && !isNaN(dateObj.getTime())) {
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    }
  } catch (e) {
    console.error("Error formatting date:", e);
  }
  return 'N/A';
};

const formatExpireDate = (expireDate) => {
  if (!expireDate) return 'N/A';
  try {
    let dateObj = null;
    if (expireDate?.toDate && typeof expireDate.toDate === 'function') {
      dateObj = expireDate.toDate();
    } else if (expireDate?.seconds) {
      dateObj = new Date(expireDate.seconds * 1000);
    } else if (expireDate instanceof Date) {
      dateObj = expireDate;
    } else if (typeof expireDate === 'string') {
      if (expireDate.includes('-')) {
        const [year, month, day] = expireDate.split('-');
        dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
      } else if (expireDate.includes('/')) {
        const [day, month, year] = expireDate.split('/');
        dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
      }
    }

    if (dateObj && !isNaN(dateObj.getTime())) {
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    console.error("Error formatting expire date:", e);
  }
  return 'N/A';
};

const parseDate = (dateValue) => {
  if (!dateValue) return null;
  if (dateValue.toDate) return dateValue.toDate();
  if (dateValue.seconds) return new Date(dateValue.seconds * 1000);
  if (typeof dateValue === 'string') {
    if (dateValue.includes('/')) {
      const [day, month, year] = dateValue.split('/');
      return new Date(year, month - 1, day);
    }
    return new Date(dateValue);
  }
  if (dateValue instanceof Date) return dateValue;
  return null;
};

const formatDateForInput = (date) => {
  if (!date) return '';
  let dateObj;
  if (date.toDate) dateObj = date.toDate();
  else if (date.seconds) dateObj = new Date(date.seconds * 1000);
  else if (date instanceof Date) dateObj = date;
  else if (typeof date === 'string') {
    if (date.includes('/')) {
      const [day, month, year] = date.split('/');
      dateObj = new Date(year, month - 1, day);
    } else dateObj = new Date(date);
  } else return '';
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getOutPrice = (item, billCurrency) => {
  if (billCurrency === "USD") {
    return item.outPriceUSD !== undefined && item.outPriceUSD !== null ? item.outPriceUSD : 0;
  } else {
    return item.outPriceIQD !== undefined && item.outPriceIQD !== null ? item.outPriceIQD : 0;
  }
};

const getPurchasePrice = (item, billCurrency) => {
  if (billCurrency === "USD") {
    return item.basePriceUSD !== undefined && item.basePriceUSD !== null ? item.basePriceUSD : 0;
  } else {
    return item.basePriceIQD !== undefined && item.basePriceIQD !== null ? item.basePriceIQD : 0;
  }
};

const getNetPrice = (item, billCurrency) => {
  if (billCurrency === "USD") {
    if (item.netPriceUSD !== undefined && item.netPriceUSD !== null) {
      return item.netPriceUSD;
    }
    return item.netPrice !== undefined ? item.netPrice : item.basePriceUSD || 0;
  } else {
    if (item.netPriceIQD !== undefined && item.netPriceIQD !== null) {
      return item.netPriceIQD;
    }
    return item.netPrice !== undefined ? item.netPrice : item.basePriceIQD || 0;
  }
};

const getTransportFee = (bill, currency) => {
  if (currency === "USD") {
    return bill.totalTransportFeeUSD || 0;
  } else {
    return bill.totalTransportFeeIQD || 0;
  }
};

const getExternalExpense = (bill, currency) => {
  if (currency === "USD") {
    return bill.totalExternalExpenseUSD || 0;
  } else {
    return bill.totalExternalExpenseIQD || 0;
  }
};

export default function BuyingList({ refreshTrigger }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState(null);
  const [filters, setFilters] = useState({
    billNumber: "",
    companySearch: "",
    companyBillNumber: "",
    startDate: "",
    endDate: "",
    paymentStatus: "all",
    consignmentStatus: "all",
  });
  const [itemFilters, setItemFilters] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [bills, setBills] = useState([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [attachmentModal, setAttachmentModal] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'billNumber', direction: 'desc' });
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);
  const [internalRefresh, setInternalRefresh] = useState(0);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const [billsData, companiesData] = await Promise.all([
        getBoughtBills(),
        getCompanies()
      ]);
      setBills(billsData);
      setCompanies(companiesData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger, internalRefresh]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.filter-dropdown-container')) {
        setActiveFilterDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const items = new Set();
    bills.forEach(bill => {
      bill.items?.forEach(item => {
        items.add(item.name);
      });
    });
    setAvailableItems(Array.from(items));
  }, [bills]);

  useEffect(() => {
    if (filters.companySearch.length > 0) {
      const results = companies.filter(company =>
        company.name.toLowerCase().includes(filters.companySearch.toLowerCase())
      );
      setCompanySuggestions(results);
      setShowCompanySuggestions(results.length > 0);
    } else {
      setCompanySuggestions([]);
      setShowCompanySuggestions(false);
    }
  }, [filters.companySearch, companies]);

  const processedBills = useMemo(() => {
    return bills.map(bill => {
      const companyObj = companies.find(c => c.id === bill.companyId);
      const companyName = companyObj?.name || 'Unknown Company';
      const companyCode = companyObj?.code || 'N/A';
      const formattedDate = formatDateToDDMMYYYY(bill.date);
      const hasAttachment = bill.attachment ? 'Yes' : 'No';
      const consignmentText = bill.isConsignment ? 'Consignment' : 'Owned';

      return {
        ...bill,
        companyName,
        companyCode,
        formattedDate,
        hasAttachment,
        consignmentText,
      };
    });
  }, [bills, companies]);

  const evaluateFilter = (itemValue, filterData) => {
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

  const clearColumnFilter = (columnKey) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[columnKey];
      return next;
    });
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleCompanySelect = (company) => {
    setFilters({ ...filters, companySearch: company.name, companyId: company.id });
    setShowCompanySuggestions(false);
  };

  const itemOptions = availableItems.map(item => ({
    value: item,
    label: item
  }));

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredBills = useMemo(() => {
    let filtered = processedBills.filter(bill => {
      const matchesBillNumber = !filters.billNumber || bill.billNumber.toString().includes(filters.billNumber);
      const matchesCompanyBillNumber = !filters.companyBillNumber || bill.companyBillNumber?.toString().includes(filters.companyBillNumber);
      const matchesCompany = !filters.companySearch || bill.companyName.toLowerCase().includes(filters.companySearch.toLowerCase());
      const billDate = parseDate(bill.date);
      const startDate = filters.startDate ? new Date(filters.startDate) : null;
      const endDate = filters.endDate ? new Date(filters.endDate) : null;
      const matchesStartDate = !startDate || (billDate && billDate >= startDate);
      const matchesEndDate = !endDate || (billDate && billDate <= endDate);
      const matchesPaymentStatus = filters.paymentStatus === "all" || bill.paymentStatus === filters.paymentStatus;
      const matchesConsignmentStatus = filters.consignmentStatus === "all" ||
        (filters.consignmentStatus === "consignment" && bill.isConsignment) ||
        (filters.consignmentStatus === "owned" && !bill.isConsignment);
      const matchesSearch = !searchQuery ||
        bill.items.some(item =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.barcode.includes(searchQuery)
        ) ||
        bill.billNumber.toString().includes(searchQuery);
      const matchesItemFilters = itemFilters.length === 0 ||
        bill.items.some(item => itemFilters.includes(item.name));

      if (!matchesBillNumber || !matchesCompanyBillNumber || !matchesCompany ||
        !matchesStartDate || !matchesEndDate || !matchesPaymentStatus ||
        !matchesSearch || !matchesItemFilters || !matchesConsignmentStatus) {
        return false;
      }

      for (const [columnKey, filterData] of Object.entries(columnFilters)) {
        let itemValue = bill[columnKey];
        if (columnKey === 'company') itemValue = bill.companyName;
        if (columnKey === 'date') itemValue = bill.formattedDate;
        if (columnKey === 'consignment') itemValue = bill.consignmentText;
        if (columnKey === 'hasAttachment') itemValue = bill.hasAttachment;

        if (!evaluateFilter(itemValue, filterData)) return false;
      }

      return true;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue, bValue;

        if (sortConfig.key === 'billNumber') {
          aValue = a.billNumber;
          bValue = b.billNumber;
        } else if (sortConfig.key === 'company') {
          aValue = a.companyName;
          bValue = b.companyName;
        } else if (sortConfig.key === 'date') {
          aValue = parseDate(a.date)?.getTime() || 0;
          bValue = parseDate(b.date)?.getTime() || 0;
        } else if (sortConfig.key === 'paymentStatus') {
          aValue = a.paymentStatus || '';
          bValue = b.paymentStatus || '';
        } else if (sortConfig.key === 'consignment') {
          aValue = a.isConsignment ? 'Consignment' : 'Owned';
          bValue = b.isConsignment ? 'Consignment' : 'Owned';
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [processedBills, filters, searchQuery, itemFilters, columnFilters, sortConfig]);

  const handleUpdateBill = async (bill) => {
    try {
      const company = companies.find(c => c.id === bill.companyId);
      const exchangeRate = bill.exchangeRate || 1500;
      const currency = bill.currency || "USD";

      const billWithCompanyData = {
        ...bill,
        companyId: bill.companyId,
        companyName: company?.name || '',
        companyCode: company?.code || '',
        companySearch: company?.name || '',
        billDate: formatDateForInput(bill.date),
        branch: bill.branch || "Slemany",
        paymentStatus: bill.paymentStatus || "Unpaid",
        isConsignment: bill.isConsignment || false,
        expensePercentage: bill.expensePercentage || 7,
        exchangeRate: exchangeRate,
        currency: currency,
        billNote: bill.billNote || "",
        totalTransportFee: getTransportFee(bill, currency),
        totalExternalExpense: getExternalExpense(bill, currency),
        items: bill.items.map(item => {
          return {
            ...item,
            basePriceUSD: item.basePriceUSD,
            basePriceIQD: item.basePriceIQD,
            netPriceUSD: item.netPriceUSD,
            netPriceIQD: item.netPriceIQD,
            expireDate: item.expireDate ? formatDateForInput(item.expireDate) : "",
          };
        })
      };

      localStorage.setItem('editingBill', JSON.stringify(billWithCompanyData));
      router.push('/buying?edit=true');
    } catch (error) {
      console.error("Error preparing bill for edit:", error);
      alert("Failed to load bill for editing. Please try again.");
    }
  };

  const handleDeleteBill = async (billNumber) => {
    if (confirm("Are you sure you want to delete this bill?")) {
      try {
        await deleteBoughtBill(billNumber);
        setInternalRefresh(prev => prev + 1);
        setSelectedBill(null);
      } catch (error) {
        console.error("Error deleting bill:", error);
      }
    }
  };

  const toggleBillDetails = (bill) => {
    setSelectedBill(selectedBill?.billNumber === bill.billNumber ? null : bill);
  };

  const openAttachmentModal = (bill) => {
    setAttachmentModal(bill);
    setAttachmentPreview(bill.attachment || null);
  };

  const closeAttachmentModal = () => {
    setAttachmentModal(null);
    setAttachmentPreview(null);
  };

  const openFullScreen = (imageData) => {
    setFullScreenImage(imageData);
  };

  const closeFullScreen = () => {
    setFullScreenImage(null);
  };

  const downloadImage = (imageData) => {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = `attachment_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let width = img.width;
            let height = img.height;
            const maxWidth = 800;
            if (width > maxWidth) {
              height = (maxWidth / width) * height;
              width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            const compressedImage = canvas.toDataURL('image/jpeg', 0.85);
            setAttachmentPreview(compressedImage);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        alert('Please select an image file.');
      }
    }
  };

  const handleCameraCapture = async () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const saveAttachment = async () => {
    if (!attachmentPreview || !attachmentModal) return;
    try {
      await updateBoughtBill(attachmentModal.billNumber, {
        attachment: attachmentPreview,
        attachmentDate: new Date().toISOString()
      });

      setInternalRefresh(prev => prev + 1);

      setAttachmentModal(prev => ({
        ...prev,
        attachment: attachmentPreview
      }));

      alert('Attachment saved successfully!');
    } catch (error) {
      console.error('Error saving attachment:', error);
      alert('Failed to save attachment. Please try again.');
    }
  };

  const removeAttachment = async () => {
    if (!attachmentModal) return;

    if (confirm("Are you sure you want to remove this attachment?")) {
      try {
        await updateBoughtBill(attachmentModal.billNumber, {
          attachment: null,
          attachmentDate: null
        });

        setInternalRefresh(prev => prev + 1);

        setAttachmentModal(prev => ({
          ...prev,
          attachment: null
        }));
        setAttachmentPreview(null);

        alert('Attachment removed successfully!');
      } catch (error) {
        console.error('Error removing attachment:', error);
        alert('Failed to remove attachment. Please try again.');
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const PaymentStatusBadge = ({ status }) => {
    const getStatusStyles = () => {
      switch (status) {
        case "Paid":
        case "Cash":
          return "bg-green-100 text-green-800 border border-green-300";
        case "Unpaid":
          return "bg-orange-100 text-orange-800 border border-orange-300";
        default:
          return "bg-orange-100 text-orange-800 border border-orange-300";
      }
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusStyles()}`}>
        {status}
      </span>
    );
  };

  const ConsignmentBadge = ({ isConsignment }) => {
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
        isConsignment ? "bg-purple-100 text-purple-800 border-purple-300" : "bg-blue-100 text-blue-800 border-blue-300"
      }`}>
        {isConsignment ? "تحت صرف" : "OWNED"}
      </span>
    );
  };

  const ExcelFilterDropdown = ({ columnKey, title, type = "string" }) => {
    const [search, setSearch] = useState("");
    const isOpen = activeFilterDropdown === columnKey;
    const operators = type === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;

    const filterState = columnFilters[columnKey] || { operator: operators[0].value, textValue: '', selectedValues: [] };
    const { operator, textValue, selectedValues } = filterState;

    const uniqueValues = useMemo(() => {
      const vals = new Set();
      processedBills.forEach(item => {
        let val = item[columnKey];
        if (columnKey === 'company') val = item.companyName;
        if (columnKey === 'date') val = item.formattedDate;
        if (columnKey === 'consignment') val = item.consignmentText;
        if (columnKey === 'hasAttachment') val = item.hasAttachment;
        vals.add(String(val));
      });
      return Array.from(vals).sort();
    }, [columnKey]);

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
          style={{
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.25rem",
            borderRadius: "0.375rem",
            background: isActive ? "#dbeafe" : "transparent",
            color: isActive ? "#2563eb" : "#94a3b8",
            transition: "all 0.2s"
          }}
        >
          <FiFilter size={14} />
        </div>

        {isOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: "0.5rem",
              background: "white",
              border: "1px solid #cbd5e1",
              borderRadius: "0.5rem",
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1)",
              zIndex: 9999,
              width: "260px",
              display: "flex",
              flexDirection: "column",
              cursor: "default",
              overflow: "hidden"
            }}
            onClick={e => e.stopPropagation()}
          >
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

            <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", flex: 1 }}>
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>Values</p>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: "0.375rem", padding: "0.25rem 0.5rem", marginBottom: "0.5rem" }}>
                <FiSearch size={14} color="#94a3b8" />
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

            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", padding: "0.75rem", backgroundColor: "#f8fafc" }}>
              <button onClick={() => clearColumnFilter(columnKey)} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: "0.875rem", cursor: "pointer", fontWeight: 600 }}>Clear</button>
              <button onClick={() => setActiveFilterDropdown(null)} style={{ background: "#2563eb", border: "none", color: "white", fontSize: "0.875rem", padding: "0.4rem 1rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600 }}>Apply</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const TableHeader = ({ title, columnKey, type = "string", isLast = false }) => (
    <th className="sortable">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: "600", color: "#4b5563", fontSize: "0.875rem" }}>
        <div onClick={() => requestSort(columnKey)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem", flex: 1, userSelect: "none" }}>
          {title}
          <span style={{ color: "#94a3b8", fontSize: "0.75rem", width: "12px" }}>
            {sortConfig.key === columnKey ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </div>
        <div style={{ paddingLeft: "0.5rem", borderLeft: "1px solid #e2e8f0", marginLeft: "0.5rem" }}>
          <ExcelFilterDropdown columnKey={columnKey} title={title} type={type} />
        </div>
      </div>
    </th>
  );

  return (
    <>
      <style jsx global>{`
        /* CSS RESET FOR NEXTJS CONTAINERS */
        body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }

        /* 100% WIDTH BREAKOUT TRICK */
        .buying-list-wrapper {
          width: 100vw;
          position: relative;
          left: 50%;
          right: 50%;
          margin-left: -50vw;
          margin-right: -50vw;
          background: #f1f5f9;
          min-height: 100vh;
          box-sizing: border-box;
          padding: 0; /* Remove parent padding to stretch completely */
        }

        .main-card-container {
          width: 100%;
          background-color: white;
          border-radius: 0; /* Flush against the edges */
          border: none;
          box-shadow: none; /* No shadow needed if edge-to-edge */
          overflow: hidden;
        }

        .main-card-header {
          background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
          padding: 1.25rem 2rem;
        }

        /* Padding specifically for filters so they don't touch the edge */
        .filter-section-wrapper {
          padding: 1.5rem 2rem;
          background-color: white;
        }

        /* Table container needs to stretch full width with 0 side margins */
        .table-container {
          background: white;
          border-radius: 0;
          border-top: 1px solid #E5E7EB;
          border-bottom: 1px solid #E5E7EB;
          border-left: none;
          border-right: none;
          overflow: hidden;
          width: 100%;
          margin: 0;
        }

        .table-scroll-wrapper {
          overflow-x: auto;
          overflow-y: visible;
          min-height: 450px;
          max-height: 75vh;
          -webkit-overflow-scrolling: touch;
          width: 100%;
        }

        .purchase-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 14px;
          min-width: 100%; /* Stretch fully */
        }

        .purchase-table th {
          padding: 0.75rem 1rem;
          font-weight: 600;
          color: #4b5563;
          text-align: left;
          border-bottom: 2px solid #cbd5e1;
          position: sticky;
          top: 0;
          background: #f8fafc;
          z-index: 10;
          font-size: 13px;
          white-space: nowrap;
        }

        /* Add extra padding to first and last columns so text isn't glued to monitor edges */
        .purchase-table th:first-child, .purchase-table td:first-child {
          padding-left: 2rem;
        }
        
        .purchase-table th:last-child, .purchase-table td:last-child {
          padding-right: 2rem;
        }

        .purchase-table td {
          padding: 0.75rem 1rem;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
          transition: all 0.2s ease;
          font-size: 13px;
          border-right: 1px solid #e5e7eb;
        }

        .purchase-table td:last-child {
          border-right: none;
        }

        .purchase-table tbody tr {
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .purchase-table tbody tr:hover {
          background-color: #f9fafb;
        }

        .purchase-table tbody tr.selected-row {
          background: #f5f3ff;
        }

        .action-buttons {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .btn-icon {
          padding: 0.3rem 0.6rem;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          transition: all 0.2s ease;
          border: 1px solid transparent;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }

        .btn-edit { background: #ede9fe; color: #5b21b6; border-color: #c4b5fd; }
        .btn-delete { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
        .btn-attach { background: #f3f4f6; color: #374151; border-color: #d1d5db; }
        .btn-view { background: #dcfce7; color: #166534; border-color: #bbf7d0; }

        .details-panel {
          background: #f8fafc;
          border-top: 2px solid #8b5cf6;
          border-bottom: 1px solid #e5e7eb;
        }

        .details-content { padding: 1rem 2rem; }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 0.75rem;
          background: white;
          border-radius: 8px;
          padding: 1rem;
          border: 1px solid #e5e7eb;
          margin-bottom: 1rem;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .info-label {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #6b7280;
        }

        .info-value {
          font-size: 0.95rem;
          font-weight: 600;
          color: #111827;
        }

        .items-table-container {
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          overflow: hidden;
          margin: 0.75rem 0;
          overflow-x: auto;
          width: 100%;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
          min-width: 600px;
        }

        .items-table th {
          background: #f9fafb;
          padding: 0.5rem 0.75rem;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          font-size: 0.8rem;
          border-bottom: 1px solid #e5e7eb;
          text-align: left;
          white-space: nowrap;
        }

        .items-table td {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid #e5e7eb;
          color: #111827;
          font-size: 0.85rem;
        }

        .barcode-cell {
          font-family: 'Courier New', monospace;
          background: #f3f4f6;
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-size: 0.85rem;
          color: #8b5cf6;
        }

        .quantity-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.8rem;
          padding: 0.1rem 0.4rem;
          background: #f3f4f6;
          color: #111827;
          border-radius: 9999px;
          font-weight: 700;
          font-size: 0.85rem;
        }

        .filter-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1rem;
        }

        .filter-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .filter-header h3 {
          font-size: 1.1rem;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        @media (min-width: 640px) {
          .filter-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (min-width: 1024px) {
          .filter-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
        }

        .filter-input {
          width: 100%;
          padding: 0.6rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 0.9rem;
        }

        .filter-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: #4b5563;
          margin-bottom: 0.35rem;
        }

        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.7);
          display: flex; alignItems: center; justify-content: center;
          padding: 1rem; z-index: 10000;
          backdrop-filter: blur(4px);
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          width: 100%; max-width: 500px; max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
        }

        .modal-header {
          position: sticky; top: 0;
          background: white; border-bottom: 1px solid #e5e7eb;
          padding: 1.25rem 1.5rem;
          display: flex; justify-content: space-between; align-items: center;
          z-index: 10;
        }

        .modal-header h3 {
          font-size: 1.1rem; font-weight: 700; color: #111827; margin: 0;
        }

        .modal-close { color: #9ca3af; cursor: pointer; border: none; background: transparent; display: flex; align-items: center; justify-content: center; }
        .modal-body { padding: 1.5rem; }

        .attachment-preview {
          width: 100%; height: 200px;
          object-fit: contain; border: 2px solid #e5e7eb;
          border-radius: 8px; margin-bottom: 0.75rem;
          background: #f9fafb; cursor: zoom-in;
        }

        .attachment-placeholder {
          text-align: center; padding: 1.5rem;
          border: 2px dashed #e5e7eb; border-radius: 8px;
          color: #9ca3af; margin-bottom: 0.75rem;
        }

        .modal-actions {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem; margin-top: 1.5rem;
        }

        .modal-btn {
          padding: 0.6rem; border-radius: 8px;
          font-weight: 600; font-size: 0.85rem;
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          gap: 0.5rem;
        }

        .modal-btn-remove { background: #ef4444; color: white; }
        .modal-btn-cancel { background: #6b7280; color: white; }
        .modal-btn-save { background: #8b5cf6; color: white; }

        .fullscreen-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.95);
          display: flex; align-items: center; justify-content: center;
          z-index: 10001; padding: 1rem;
        }

        .fullscreen-content {
          position: relative; max-width: 90vw; max-height: 90vh;
          display: flex; flex-direction: column; align-items: center;
        }

        .fullscreen-image {
          max-width: 90vw; max-height: 75vh;
          object-fit: contain; border-radius: 8px;
        }

        .fullscreen-actions {
          display: flex; gap: 0.75rem; margin-top: 1rem;
        }

        .fullscreen-btn {
          padding: 0.5rem 1rem; border: none; border-radius: 8px;
          font-size: 0.85rem; font-weight: 600; cursor: pointer;
          display: flex; align-items: center; gap: 0.5rem;
        }

        .fullscreen-btn-close { background: #ef4444; color: white; }
        .fullscreen-btn-download { background: #8b5cf6; color: white; }

        .empty-state {
          text-align: center; padding: 3rem;
          background: white; border-radius: 0;
          border: 1px solid #e5e7eb;
          margin-top: 0;
        }
        
        .empty-state-icon { font-size: 3rem; margin-bottom: 1rem; }
        .empty-state-title { font-size: 1.25rem; font-weight: 700; color: #111827; margin: 0 0 0.5rem 0; }
        .empty-state-text { color: #6b7280; margin: 0; }
        
        .file-upload-btn {
          width: 100%;
          padding: 0.75rem;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .file-input {
          display: none;
        }
      `}</style>

      <div className="buying-list-wrapper">
        <div className="main-card-container">
          {/* Header section matching Option A style */}
          <div className="main-card-header">
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "white", margin: 0 }}>
              📋 Purchase History
            </h2>
          </div>
          
          <div className="filter-section-wrapper">
            {/* Top Filters Section */}
            <div className="filter-section">
              <div className="filter-header">
                <h3>Search Filters</h3>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {Object.keys(columnFilters).length > 0 && (
                    <button
                      type="button"
                      style={{ background: "#fee2e2", color: "#ef4444", fontSize: "0.75rem", padding: "0.4rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #fca5a5", cursor: "pointer", fontWeight: "600" }}
                      onClick={() => setColumnFilters({})}
                    >
                      Clear Header Filters
                    </button>
                  )}
                  <button
                    type="button"
                    style={{ background: "#f3f4f6", color: "#1f2937", border: "none", fontSize: "0.75rem", padding: "0.4rem 0.75rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}
                    onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                  >
                    {showAdvancedSearch ? "Hide Advanced Search" : "Advanced Search"}
                  </button>
                </div>
              </div>
              <div className="filter-grid" style={{ marginBottom: "1rem" }}>
                <div style={{ position: "relative" }}>
                  <label className="filter-label">Company</label>
                  <input
                    className="filter-input"
                    placeholder="Search company..."
                    value={filters.companySearch}
                    onChange={(e) => handleFilterChange('companySearch', e.target.value)}
                    onFocus={() => setShowCompanySuggestions(true)}
                  />
                  {showCompanySuggestions && (
                    <div style={{ position: "absolute", zIndex: 999, width: "100%", background: "white", border: "1px solid #e5e7eb", borderRadius: "0.5rem", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", marginTop: "0.25rem", maxHeight: "240px", overflowY: "auto" }}>
                      {companySuggestions.map(company => (
                        <div
                          key={company.id}
                          style={{ padding: "0.5rem", cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}
                          onClick={() => handleCompanySelect(company)}
                        >
                          <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#111827" }}>{company.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>Code: {company.code}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="filter-label">Filter by Items</label>
                  <Select
                    isMulti
                    options={itemOptions}
                    onChange={(selected) => setItemFilters(selected.map(option => option.value))}
                    placeholder="Select specific items..."
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                    styles={{
                      menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                      control: (base) => ({
                        ...base,
                        minHeight: '39px',
                        fontSize: '14px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        '&:hover': { borderColor: '#8b5cf6' },
                        boxShadow: 'none'
                      })
                    }}
                  />
                </div>
              </div>
              {showAdvancedSearch && (
                <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
                  <div className="filter-grid" style={{ marginBottom: "0.75rem" }}>
                    <div>
                      <label className="filter-label">Bill Number</label>
                      <input
                        className="filter-input"
                        placeholder="Enter bill #"
                        value={filters.billNumber}
                        onChange={(e) => handleFilterChange('billNumber', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="filter-label">Company Bill #</label>
                      <input
                        className="filter-input"
                        placeholder="Enter company bill #"
                        value={filters.companyBillNumber}
                        onChange={(e) => handleFilterChange('companyBillNumber', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="filter-label">From Date</label>
                      <input
                        type="date"
                        className="filter-input"
                        value={filters.startDate}
                        onChange={(e) => handleFilterChange('startDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="filter-label">To Date</label>
                      <input
                        type="date"
                        className="filter-input"
                        value={filters.endDate}
                        onChange={(e) => handleFilterChange('endDate', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="filter-grid">
                    <div>
                      <label className="filter-label">Payment Status</label>
                      <select
                        className="filter-input"
                        value={filters.paymentStatus}
                        onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
                      >
                        <option value="all">All Status</option>
                        <option value="Unpaid">Unpaid</option>
                        <option value="Cash">Cash</option>
                        <option value="Paid">Paid</option>
                      </select>
                    </div>
                    <div>
                      <label className="filter-label">Consignment Status</label>
                      <select
                        className="filter-input"
                        value={filters.consignmentStatus}
                        onChange={(e) => handleFilterChange('consignmentStatus', e.target.value)}
                      >
                        <option value="all">All</option>
                        <option value="consignment">تحت صرف (Consignment)</option>
                        <option value="owned">Owned</option>
                      </select>
                    </div>
                    <div>
                      <label className="filter-label">Global Search</label>
                      <input
                        className="filter-input"
                        placeholder="Search by item name or barcode..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Table Container - OUTSIDE of the padded wrapper so it hits the edges */}
          <div className="table-container">
            <div className="table-scroll-wrapper">
              <table className="purchase-table">
                <thead>
                  <tr>
                    <TableHeader title="BILL #" columnKey="billNumber" type="number" />
                    <TableHeader title="COMPANY" columnKey="company" type="string" />
                    <TableHeader title="DATE & TIME" columnKey="date" type="string" />
                    <TableHeader title="STATUS" columnKey="paymentStatus" type="string" />
                    <TableHeader title="CONSIGNMENT" columnKey="consignment" type="string" />
                    <TableHeader title="ATTACHMENT" columnKey="hasAttachment" type="string" />
                    <th style={{ padding: "0.75rem 2rem", borderBottom: "2px solid #cbd5e1", backgroundColor: "#f8fafc", fontWeight: "600" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAndFilteredBills.map(bill => (
                    <React.Fragment key={bill.billNumber}>
                      <tr
                        onClick={() => toggleBillDetails(bill)}
                        className={selectedBill?.billNumber === bill.billNumber ? 'selected-row' : ''}
                      >
                        <td>
                          <span style={{ fontWeight: 600, color: "#8b5cf6" }}>#{bill.billNumber}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{bill.companyName}</div>
                          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>Code: {bill.companyCode}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: "0.85rem", color: "#374151" }}>{bill.formattedDate}</div>
                        </td>
                        <td>
                          <PaymentStatusBadge status={bill.paymentStatus || "Unpaid"} />
                        </td>
                        <td>
                          <ConsignmentBadge isConsignment={bill.isConsignment} />
                        </td>
                        <td>
                          {bill.attachment ? (
                            <button
                              className="btn-icon btn-view"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAttachmentModal(bill);
                              }}
                            >
                              📎 View
                            </button>
                          ) : (
                            <button
                              className="btn-icon btn-attach"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAttachmentModal(bill);
                              }}
                            >
                              ＋ Attach
                            </button>
                          )}
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn-icon btn-edit"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateBill(bill);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-icon btn-delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBill(bill.billNumber);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {selectedBill?.billNumber === bill.billNumber && (
                        <tr>
                          <td colSpan="7" style={{ padding: 0 }}>
                            <div className="details-panel">
                              <div className="details-content">
                                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                                    <h4 style={{ fontWeight: "bold", color: "#6d28d9", fontSize: "1.1rem", margin: 0 }}>
                                      📋 Bill #{bill.billNumber} - Complete Details
                                    </h4>
                                    <div style={{ fontSize: "0.85rem", color: "#4b5563" }}>
                                      Total Items: {bill.items.length} | Currency: {bill.currency || "USD"}
                                    </div>
                                  </div>
                                </div>

                                <div className="info-grid">
                                  <div className="info-item">
                                    <span className="info-label">Company</span>
                                    <span className="info-value company">{bill.companyName} ({bill.companyCode})</span>
                                  </div>
                                  <div className="info-item">
                                    <span className="info-label">Bill Date & Time</span>
                                    <span className="info-value">{bill.formattedDate}</span>
                                  </div>
                                  <div className="info-item">
                                    <span className="info-label">Company Bill #</span>
                                    <span className="info-value">{bill.companyBillNumber || 'N/A'}</span>
                                  </div>
                                  <div className="info-item">
                                    <span className="info-label">Branch</span>
                                    <span className="info-value">{bill.branch || 'Slemany'}</span>
                                  </div>
                                  <div className="info-item">
                                    <span className="info-label">Payment Status</span>
                                    <div><PaymentStatusBadge status={bill.paymentStatus || "Unpaid"} /></div>
                                  </div>
                                  <div className="info-item">
                                    <span className="info-label">Consignment</span>
                                    <div><ConsignmentBadge isConsignment={bill.isConsignment} /></div>
                                  </div>
                                  <div className="info-item">
                                    <span className="info-label">Expense %</span>
                                    <span className="info-value expense">{bill.expensePercentage || 7}%</span>
                                  </div>
                                  <div className="info-item">
                                    <span className="info-label">Transport Fee</span>
                                    <div style={{ fontWeight: 600, color: "#111827" }}>
                                      {bill.currency === "USD" ? `$${formatNumber(bill.totalTransportFeeUSD || 0)}` : `${formatNumber(bill.totalTransportFeeIQD || 0)} IQD`}
                                    </div>
                                  </div>
                                  <div className="info-item">
                                    <span className="info-label">Other Expenses</span>
                                    <div style={{ fontWeight: 600, color: "#111827" }}>
                                      {bill.currency === "USD" ? `$${formatNumber(bill.totalExternalExpenseUSD || 0)}` : `${formatNumber(bill.totalExternalExpenseIQD || 0)} IQD`}
                                    </div>
                                  </div>
                                  <div className="info-item" style={{ gridColumn: '1/-1' }}>
                                    <span className="info-label">Bill Notes</span>
                                    <span className="info-value">{bill.billNote || 'No notes'}</span>
                                  </div>
                                </div>

                                <div className="items-table-container">
                                  <h5 style={{ fontWeight: 600, color: "#374151", fontSize: "0.9rem", padding: "1rem 1rem 0.5rem 1rem", margin: 0 }}>Items List</h5>
                                  <table className="items-table">
                                    <thead>
                                      <tr>
                                        <th>Barcode</th>
                                        <th>Item Name</th>
                                        <th style={{ textAlign: "center" }}>Qty</th>
                                        <th style={{ textAlign: "right" }}>Base Price</th>
                                        <th style={{ textAlign: "right" }}>Net Price</th>
                                        <th style={{ textAlign: "right" }}>Out Price</th>
                                        <th style={{ textAlign: "center" }}>Expire Date</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {bill.items.map((item, index) => {
                                        const expireDate = formatExpireDate(item.expireDate);
                                        const quantity = item.quantity || 0;
                                        const billCurrency = bill.currency || "USD";

                                        const basePrice = getPurchasePrice(item, billCurrency);
                                        const netPrice = getNetPrice(item, billCurrency);
                                        const outPrice = getOutPrice(item, billCurrency);

                                        return (
                                          <tr key={index}>
                                            <td><code className="barcode-cell">{item.barcode}</code></td>
                                            <td>{item.name}</td>
                                            <td style={{ textAlign: "center" }}><span className="quantity-badge">{quantity}</span></td>
                                            <td style={{ textAlign: "right" }}>{billCurrency === "USD" ? `$${formatNumber(basePrice)}` : `${formatNumber(basePrice)} IQD`}</td>
                                            <td style={{ textAlign: "right", color: '#6d28d9', fontWeight: 'bold' }}>{billCurrency === "USD" ? `$${formatNumber(netPrice)}` : `${formatNumber(netPrice)} IQD`}</td>
                                            <td style={{ textAlign: "right", color: '#059669', fontWeight: 'bold' }}>{billCurrency === "USD" ? `$${formatNumber(outPrice)}` : `${formatNumber(outPrice)} IQD`}</td>
                                            <td style={{ textAlign: "center" }}><span style={{ display: "inline-block", background: "#f3f4f6", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.8rem", fontWeight: "600", color: "#374151" }}>{expireDate}</span></td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {sortedAndFilteredBills.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                <h3 className="empty-state-title">No bills found</h3>
                <p className="empty-state-text">Try adjusting your search filters or create a new purchase bill.</p>
              </div>
            )}
          </div>

          {/* Attachment Modal */}
          {attachmentModal && (
            <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeAttachmentModal(); }}>
              <div className="modal-content">
                <div className="modal-header">
                  <h3>Bill #{attachmentModal.billNumber} - Attachment</h3>
                  <button onClick={closeAttachmentModal} className="modal-close"><FiX size={20} /></button>
                </div>
                <div className="modal-body">
                  {attachmentPreview ? (
                    <img
                      src={attachmentPreview}
                      alt="Bill Attachment"
                      className="attachment-preview"
                      onClick={() => openFullScreen(attachmentPreview)}
                      title="Click to zoom in full screen"
                    />
                  ) : (
                    <div className="attachment-placeholder">
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📎</div>
                      <div>No attachment uploaded yet</div>
                    </div>
                  )}

                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="file-input" />
                  <button onClick={triggerFileInput} className="file-upload-btn">
                    <FiImage style={{ display: 'inline', marginRight: '0.5rem' }} /> Choose Image File
                  </button>

                  <button onClick={handleCameraCapture} className="file-upload-btn" style={{ background: '#10b981', color: 'white', border: 'none' }}>
                    <FiCamera style={{ display: 'inline', marginRight: '0.5rem' }} /> Take Photo
                  </button>
                  <input type="file" ref={cameraInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" className="file-input" />

                  <div className="modal-actions">
                    <button onClick={removeAttachment} className="modal-btn modal-btn-remove" disabled={!attachmentModal.attachment && !attachmentPreview}>
                      <FiX size={14} /> Remove
                    </button>
                    <button onClick={closeAttachmentModal} className="modal-btn modal-btn-cancel">Cancel</button>
                    <button onClick={saveAttachment} className="modal-btn modal-btn-save" disabled={!attachmentPreview || attachmentPreview === attachmentModal.attachment}>
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Full Screen Image Modal */}
          {fullScreenImage && (
            <div className="fullscreen-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeFullScreen(); }}>
              <div className="fullscreen-content">
                <img src={fullScreenImage} alt="Full screen attachment" className="fullscreen-image" />
                <div className="fullscreen-actions">
                  <button onClick={closeFullScreen} className="fullscreen-btn fullscreen-btn-close">
                    <FiX size={18} /> Close
                  </button>
                  <button onClick={() => downloadImage(fullScreenImage)} className="fullscreen-btn fullscreen-btn-download">
                    <FiDownload size={18} /> Save to Gallery
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}