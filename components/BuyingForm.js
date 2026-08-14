"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getCompanies, searchInitializedItems, createBoughtBill, updateBoughtBill, getBoughtBills } from "@/lib/data";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FiPlus, FiTrash2, FiSearch, FiPercent, FiDollarSign, FiFileText,
  FiPackage, FiUser, FiCalendar, FiCreditCard, FiTruck,
  FiAlertTriangle, FiX, FiRefreshCw, FiShoppingCart, FiCheckCircle,
  FiArrowRight, FiInfo, FiTag, FiCornerDownLeft, FiClock, FiEye
} from "react-icons/fi";

// ============================================================
// Date Formatting & Parsing Helpers (dd/mm/yyyy)
// ============================================================

const formatNumber = (number) => {
  if (!number && number !== 0) return '0';
  const num = typeof number === 'string' ? parseFloat(number.replace(/,/g, '')) : number;
  if (isNaN(num)) return '0';

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(num);
};

// Formats a string to add commas but keep trailing decimals while typing
const formatForInput = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  const str = String(val).replace(/,/g, '');
  const parts = str.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join('.');
};

const parseFormattedNumber = (formattedValue) => {
  if (!formattedValue) return '';
  return formattedValue.toString().replace(/,/g, '');
};

// Formats ANY date representation to dd/mm/yyyy
const formatDateToDDMMYYYY = (date) => {
  if (!date) return '';
  let d = null;

  if (date?.toDate && typeof date.toDate === 'function') {
    d = date.toDate();
  } else if (date?.seconds) {
    d = new Date(date.seconds * 1000);
  } else if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'string') {
    if (date === 'N/A' || !date.trim()) return '';
    if (date.includes('/')) {
      const [day, month, year] = date.split('/');
      d = new Date(year, month - 1, day);
    } else if (date.includes('-')) {
      const [year, month, day] = date.split('-');
      d = new Date(year, month - 1, day);
    } else {
      d = new Date(date);
    }
  }

  if (!d || isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Parses a dd/mm/yyyy string into a JavaScript Date object preserving the current real time
const parseDateString = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const str = dateStr.trim();
  if (!str || str === 'N/A') return null;

  const now = new Date();

  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);

      const parsed = new Date(year, month, day, now.getHours(), now.getMinutes(), now.getSeconds());
      if (!isNaN(parsed.getTime())) return parsed;
    }
  } else if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);

      const parsed = new Date(year, month, day, now.getHours(), now.getMinutes(), now.getSeconds());
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
};

const selectOnFocus = (e) => {
  const target = e.target;
  requestAnimationFrame(() => {
    try { target.select(); } catch (_) {}
  });
};

export default function BuyingForm({ onBillCreated }) {
  const [companyId, setCompanyId] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [companyBillNumber, setCompanyBillNumber] = useState("");
  const [billDate, setBillDate] = useState(formatDateToDDMMYYYY(new Date()));
  const [branch, setBranch] = useState("Slemany");
  const [paymentStatus, setPaymentStatus] = useState("Unpaid");
  const [isConsignment, setIsConsignment] = useState(false);
  const [expensePercentage, setExpensePercentage] = useState("7");
  const [billNote, setBillNote] = useState("");
  const [billItems, setBillItems] = useState([]);
  const [transportFee, setTransportFee] = useState("0");
  const [externalExpense, setExternalExpense] = useState("0");
  const [currency, setCurrency] = useState(""); 
  const [suggestions, setSuggestions] = useState([]);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [allCompanies, setAllCompanies] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [currencyError, setCurrencyError] = useState(false);

  // Item Purchase History State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState(null);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const searchInputRef = useRef(null);
  const companySearchRef = useRef(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Refs for keyboard navigation
  const itemInputRefs = useRef({});
  const transportFeeRef = useRef(null);
  const externalExpenseRef = useRef(null);
  const expensePercentageRef = useRef(null);
  const billNoteRef = useRef(null);
  const submitButtonRef = useRef(null);

  const createEmptyItem = () => ({
    barcode: "",
    name: "",
    quantity: "1",
    price: "",
    outPrice: "",
    expireDate: ""
  });

  const calculateNetPrice = (item, totalQuantity, transportFeeVal, externalExpenseVal, expensePercentageVal) => {
    const basePrice = parseFloat(parseFormattedNumber(item.price)) || 0;
    const quantity = parseFloat(item.quantity) || 1;
    if (totalQuantity === 0) return basePrice;

    const itemShare = quantity / totalQuantity;
    const transportPerItem = (transportFeeVal * itemShare) / quantity;
    const expensePerItem = (externalExpenseVal * itemShare) / quantity;
    const expenseAmount = basePrice * (expensePercentageVal / 100);
    const netPrice = basePrice + transportPerItem + expensePerItem + expenseAmount;
    return parseFloat(netPrice.toFixed(2));
  };

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const companiesData = await getCompanies();
        setAllCompanies(companiesData);
      } catch (error) {
        console.error('Error loading companies:', error);
      }
    };
    loadCompanies();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (companySearch.trim() === '') {
        setCompanySuggestions(allCompanies);
      } else {
        const searchLower = companySearch.toLowerCase().trim();
        const filtered = allCompanies.filter(company => 
          company.name.toLowerCase().includes(searchLower) ||
          (company.code && company.code.toString().toLowerCase().includes(searchLower))
        );
        setCompanySuggestions(filtered);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [companySearch, allCompanies]);

  const handleCompanyFocus = () => {
    setShowCompanySuggestions(true);
    setCompanySuggestions(allCompanies);
  };

  const handleCompanyBlur = () => {
    setTimeout(() => {
      setShowCompanySuggestions(false);
    }, 200);
  };

  const initializeFormWithBillData = (billData) => {
    setCompanyId(billData.companyId);
    setCompanySearch(billData.companyName || billData.companySearch || "");
    setCompanyCode(billData.companyCode || "");
    setCompanyBillNumber(billData.companyBillNumber || "");
    setBillDate(formatDateToDDMMYYYY(billData.billDate || billData.date));
    setBranch(billData.branch || "Slemany");
    setPaymentStatus(billData.paymentStatus || "Unpaid");
    setIsConsignment(billData.isConsignment || false);
    setExpensePercentage(String(billData.expensePercentage || 7));
    setBillNote(billData.billNote || "");
    setCurrency(billData.currency || "USD");
    setTransportFee(String(billData.totalTransportFeeUSD || 0));
    setExternalExpense(String(billData.totalExternalExpenseUSD || 0));

    if (billData.items && billData.items.length > 0) {
      const initializedItems = billData.items.map(item => {
        let price = 0;
        let outPrice = 0;
        if (billData.currency === "USD") {
          price = item.basePriceUSD || item.basePrice || 0;
          outPrice = item.outPriceUSD || item.outPrice || 0;
        } else {
          price = item.basePriceIQD || item.basePrice || 0;
          outPrice = item.outPriceIQD || item.outPrice || 0;
        }

        return {
          barcode: item.barcode || "",
          name: item.name || "",
          quantity: String(item.quantity || 1),
          price: String(price),
          outPrice: String(outPrice),
          expireDate: formatDateToDDMMYYYY(item.expireDate),
          netPrice: item.netPrice || 0
        };
      });
      setBillItems(initializedItems);
    }
  };

  useEffect(() => {
    const editParam = searchParams.get('edit');
    if (editParam === 'true') {
      const storedBill = localStorage.getItem('editingBill');
      if (storedBill) {
        try {
          const billData = JSON.parse(storedBill);
          setIsEditing(true);
          setEditingBill(billData);
          initializeFormWithBillData(billData);
        } catch (error) {
          console.error("Error parsing editing bill:", error);
          setError("Failed to load bill for editing. Please try again.");
        }
      }
    } else {
      if (billItems.length === 0) {
        setBillItems([createEmptyItem()]);
      }
    }
  }, [searchParams]);

  // Deduplicated Item Suggestions
  useEffect(() => {
    const fetchItems = async () => {
      if (searchQuery.length > 0) {
        try {
          const results = await searchInitializedItems(searchQuery, "both");
          const searchLower = searchQuery.toLowerCase().trim();

          const filteredResults = results.filter(item => 
            item.name?.toLowerCase().includes(searchLower) || 
            item.barcode?.toLowerCase().includes(searchLower)
          );

          // Deduplicate by normalized barcode and name
          const seen = new Set();
          const uniqueResults = [];

          for (const item of filteredResults) {
            const uniqueKey = `${(item.barcode || '').trim().toLowerCase()}_${(item.name || '').trim().toLowerCase()}`;
            if (!seen.has(uniqueKey)) {
              seen.add(uniqueKey);
              uniqueResults.push(item);
            }
          }

          setSuggestions(uniqueResults);
          setShowSuggestions(uniqueResults.length > 0);
        } catch (error) {
          console.error("Error fetching items:", error);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };
    const timer = setTimeout(fetchItems, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch previous purchase history for a specific product
  const handleViewHistory = async (e, item) => {
    e.stopPropagation();
    setHistoryItem(item);
    setHistoryModalOpen(true);
    setIsHistoryLoading(true);
    setHistoryRecords([]);

    try {
      const boughtBills = await getBoughtBills();
      const records = [];

      boughtBills.forEach((bill) => {
        if (bill.items && Array.isArray(bill.items)) {
          bill.items.forEach((bi) => {
            if (
              (bi.barcode && item.barcode && String(bi.barcode) === String(item.barcode)) ||
              (bi.name && item.name && bi.name.toLowerCase() === item.name.toLowerCase())
            ) {
              const billCurr = bi.originalCurrency || bill.currency || "USD";
              const buyPrice = billCurr === "USD" ? (bi.basePriceUSD || bi.price || 0) : (bi.basePriceIQD || bi.price || 0);
              const outPrice = billCurr === "USD" ? (bi.outPriceUSD || 0) : (bi.outPriceIQD || 0);

              records.push({
                billNumber: bill.billNumber,
                companyBillNumber: bill.companyBillNumber || "-",
                companyName: bill.companyName || "Unknown Company",
                date: bill.date,
                quantity: bi.quantity || 0,
                buyPrice: buyPrice,
                outPrice: outPrice,
                currency: billCurr,
                branch: bi.branch || bill.branch || "—",
                expireDate: bi.expireDate || "—"
              });
            }
          });
        }
      });

      records.sort((a, b) => new Date(b.date) - new Date(a.date));
      setHistoryRecords(records);
    } catch (err) {
      console.error("Failed to load item purchase history:", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleCompanySelect = useCallback((company) => {
    setCompanyId(company.id);
    setCompanySearch(company.name);
    setCompanyCode(company.code);
    setShowCompanySuggestions(false);
    setError(null);

    if (company.currency) {
      setCurrency(company.currency);
      setCurrencyError(false);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else if (!currency) {
      setCurrencyError(true);
      const currencyToggle = document.querySelector('.bf-currency-toggle');
      if (currencyToggle) {
        currencyToggle.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [currency]);

  const handleItemSelect = useCallback((item) => {
    if (!currency) {
      setCurrencyError(true);
      const currencyToggle = document.querySelector('.bf-currency-toggle');
      if (currencyToggle) {
        currencyToggle.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const newItem = {
      ...createEmptyItem(),
      barcode: item.barcode,
      name: item.name,
      outPrice: item.outPrice ? String(item.outPrice) : "",
      expireDate: formatDateToDDMMYYYY(item.expireDate),
    };

    setBillItems(prev => {
      const filtered = prev.filter(i => i.barcode || i.name);
      const newIndex = filtered.length;
      const updated = [...filtered, newItem];

      setTimeout(() => {
        const qtyInput = itemInputRefs.current[`${newIndex}-quantity`];
        if (qtyInput) {
          qtyInput.focus();
          qtyInput.select();
        }
      }, 80);

      return updated;
    });

    setShowSuggestions(false);
    setSearchQuery("");
    setCurrencyError(false);
  }, [currency]);

  const handleItemChange = useCallback((index, field, value) => {
    setBillItems(prev => {
      const updatedItems = [...prev];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      return updatedItems;
    });
  }, []);

  const resetForm = useCallback(() => {
    setCompanyId("");
    setCompanySearch("");
    setCompanyCode("");
    setCompanyBillNumber("");
    setBillDate(formatDateToDDMMYYYY(new Date()));
    setBranch("Slemany");
    setPaymentStatus("Unpaid");
    setIsConsignment(false);
    setExpensePercentage("7");
    setBillNote("");
    setCurrency("");
    setTransportFee("0");
    setExternalExpense("0");
    setBillItems([createEmptyItem()]);
    setError(null);
    setSuccessMessage(null);
    setIsEditing(false);
    setEditingBill(null);
    setCurrencyError(false);
    localStorage.removeItem('editingBill');
  }, []);

  const handleCancel = () => {
    resetForm();
    router.push('/buying');
  };

  const handleKeyDown = (e, index, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      const navigationOrder = [
        { type: 'item', field: 'barcode', index: index },
        { type: 'item', field: 'name', index: index },
        { type: 'item', field: 'quantity', index: index },
        { type: 'item', field: 'price', index: index },
        { type: 'item', field: 'outPrice', index: index },
        { type: 'item', field: 'expireDate', index: index },
        { type: 'global', field: 'transportFee' },
        { type: 'global', field: 'externalExpense' },
        { type: 'global', field: 'expensePercentage' },
        { type: 'global', field: 'billNote' },
        { type: 'global', field: 'submit' },
      ];

      let currentPos = -1;
      for (let i = 0; i < navigationOrder.length; i++) {
        const item = navigationOrder[i];
        if (item.type === 'item' && item.index === index && item.field === field) {
          currentPos = i;
          break;
        } else if (item.type === 'global' && item.field === field) {
          currentPos = i;
          break;
        }
      }

      if (currentPos !== -1 && currentPos + 1 < navigationOrder.length) {
        const next = navigationOrder[currentPos + 1];

        if (next.type === 'item') {
          const nextInput = itemInputRefs.current[`${next.index}-${next.field}`];
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          }
        } else if (next.type === 'global') {
          if (next.field === 'transportFee' && transportFeeRef.current) {
            transportFeeRef.current.focus();
            transportFeeRef.current.select();
          } else if (next.field === 'externalExpense' && externalExpenseRef.current) {
            externalExpenseRef.current.focus();
            externalExpenseRef.current.select();
          } else if (next.field === 'expensePercentage' && expensePercentageRef.current) {
            expensePercentageRef.current.focus();
            expensePercentageRef.current.select();
          } else if (next.field === 'billNote' && billNoteRef.current) {
            billNoteRef.current.focus();
          } else if (next.field === 'submit' && submitButtonRef.current) {
            submitButtonRef.current.focus();
            submitButtonRef.current.click();
          }
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currency) {
      setCurrencyError(true);
      setError("Please select a currency before submitting.");
      const currencyToggle = document.querySelector('.bf-currency-toggle');
      if (currencyToggle) {
        currencyToggle.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!companyId) {
        setError("Please select a company.");
        setIsLoading(false);
        return;
      }

      const validItems = billItems.filter(item =>
        item.barcode && item.name && parseFloat(item.quantity) > 0 && item.price
      );

      if (validItems.length === 0) {
        setError("Please add at least one valid item with a price.");
        setIsLoading(false);
        return;
      }

      const totalQuantity = validItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
      const transportFeeValue = parseFloat(parseFormattedNumber(transportFee)) || 0;
      const externalExpenseValue = parseFloat(parseFormattedNumber(externalExpense)) || 0;
      const expensePercentageValue = parseFloat(parseFormattedNumber(expensePercentage)) || 0;

      const itemsWithNetPrices = validItems.map(item => {
        const expireDateValue = parseDateString(item.expireDate);

        const netPrice = calculateNetPrice(
          item, totalQuantity, transportFeeValue, externalExpenseValue, expensePercentageValue
        );

        const priceValue = parseFloat(parseFormattedNumber(item.price)) || 0;
        const outPriceValue = parseFloat(parseFormattedNumber(item.outPrice)) || (priceValue * 1.5);

        const itemData = {
          barcode: item.barcode,
          name: item.name,
          quantity: parseInt(item.quantity) || 1,
          expireDate: expireDateValue,
          branch: branch,
          isConsignment: isConsignment,
          consignmentOwnerId: isConsignment ? companyId : null,
          netPrice: netPrice,
          price: priceValue,
          outPrice: outPriceValue,
          currency: currency,
        };

        if (currency === "USD") {
          itemData.basePriceUSD = priceValue;
          itemData.basePriceIQD = 0;
          itemData.netPriceUSD = netPrice;
          itemData.netPriceIQD = 0;
          itemData.outPriceUSD = outPriceValue;
          itemData.outPriceIQD = 0;
        } else {
          itemData.basePriceIQD = priceValue;
          itemData.basePriceUSD = 0;
          itemData.netPriceIQD = netPrice;
          itemData.netPriceUSD = 0;
          itemData.outPriceIQD = outPriceValue;
          itemData.outPriceUSD = 0;
        }

        return itemData;
      });

      const parsedBillDate = parseDateString(billDate) || new Date();

      const additionalData = {
        expensePercentage: expensePercentageValue,
        billNote: billNote || "",
        currency: currency,
        transportFee: transportFeeValue,
        externalExpense: externalExpenseValue,
        totalTransportFeeUSD: currency === "USD" ? transportFeeValue : 0,
        totalTransportFeeIQD: currency === "IQD" ? transportFeeValue : 0,
        totalExternalExpenseUSD: currency === "USD" ? externalExpenseValue : 0,
        totalExternalExpenseIQD: currency === "IQD" ? externalExpenseValue : 0,
        billDate: parsedBillDate,
        exchangeRate: 1,
      };

      if (isEditing) {
        await updateBoughtBill(editingBill.billNumber, {
          companyId,
          companyBillNumber,
          date: parsedBillDate,
          paymentStatus,
          isConsignment,
          items: itemsWithNetPrices,
          ...additionalData,
          branch
        });
        setSuccessMessage(`Bill #${editingBill.billNumber} updated successfully!`);
        setTimeout(() => {
          resetForm();
          router.push('/buying');
        }, 1500);
      } else {
        const bill = await createBoughtBill(
          companyId, itemsWithNetPrices, null, paymentStatus, companyBillNumber, isConsignment, additionalData
        );
        if (onBillCreated) onBillCreated(bill);
        setSuccessMessage(`Bill #${bill.billNumber} created successfully!`);
        setTimeout(() => {
          resetForm();
        }, 1500);
      }
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      setError(error.message || `Failed to ${isEditing ? 'update' : 'create'} bill. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const removeItem = useCallback((index) => {
    setBillItems(prev => {
      const updatedItems = [...prev];
      updatedItems.splice(index, 1);
      if (updatedItems.length === 0) {
        return [createEmptyItem()];
      }
      return updatedItems;
    });
  }, []);

  const totalBasePrice = billItems.reduce((sum, item) =>
    sum + ((parseFloat(parseFormattedNumber(item.price)) || 0) * (parseFloat(item.quantity) || 0)), 0);

  const totalQuantity = billItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const validItemsCount = billItems.filter(item => item.barcode || item.name).length;

  return (
    <div className="bf-root style-reset">
      <style jsx global>{`
        .style-reset * {
          box-sizing: border-box;
        }

        .bf-root {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          background: #f1f5f9;
          min-height: 100vh;
          padding: 0.5rem;
          color: #0f172a;
          width: 100%;
          overflow-x: hidden;
          margin: 0;
        }

        .bf-card {
          width: 100%;
          max-width: 100%;
          margin: 0;
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 15px -5px rgba(15, 23, 42, 0.08);
          overflow: visible;
          border: 1px solid #e2e8f0;
        }

        .bf-header {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          padding: 1.25rem 1.5rem;
          color: #ffffff;
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #334155;
        }

        .bf-header-badge {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #38bdf8;
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
        }

        .bf-section {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 0.5rem;
          margin-bottom: 1rem;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.02);
          position: relative;
        }

        .bf-section-company {
          z-index: 50;
        }

        .bf-section-items {
          z-index: 40;
        }

        .bf-section-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #f1f5f9;
        }

        .bf-grid-3 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
        }

        .bf-form-group {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
          position: relative;
        }

        .bf-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #475569;
        }

        .bf-label-required {
          color: #ef4444;
          margin-left: 0.25rem;
        }

        .bf-input, .bf-select, .bf-textarea {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 0.875rem;
          color: #0f172a;
          background: #ffffff;
          transition: all 0.2s ease;
          outline: none;
        }

        .bf-input:focus, .bf-select:focus, .bf-textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }

        .bf-input-error {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15) !important;
        }

        .bf-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          max-height: 260px;
          overflow-y: auto;
          z-index: 1000;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
        }

        .bf-dropdown-item {
          padding: 0.625rem 0.875rem;
          cursor: pointer;
          border-bottom: 1px solid #f1f5f9;
          font-size: 0.8125rem;
          transition: background 0.15s ease;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
        }

        .bf-dropdown-item:hover {
          background: #eff6ff;
        }

        .bf-history-pill-btn {
          background: #e0f2fe;
          color: #0369a1;
          border: 1px solid #bae6fd;
          border-radius: 6px;
          padding: 0.25rem 0.6rem;
          font-size: 0.75rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .bf-history-pill-btn:hover {
          background: #0284c7;
          color: #ffffff;
          border-color: #0284c7;
        }

        .bf-currency-toggle {
          display: inline-flex;
          background: #f1f5f9;
          padding: 0.25rem;
          border-radius: 10px;
          border: 2px solid #e2e8f0;
          gap: 0.25rem;
          transition: all 0.3s ease;
        }

        .bf-currency-toggle-error {
          border: 2px solid #ef4444 !important;
          animation: pulse-border 1.5s ease-in-out infinite;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);
        }

        @keyframes pulse-border {
          0%, 100% { border-color: #ef4444; }
          50% { border-color: #fca5a5; }
        }

        .bf-currency-btn {
          padding: 0.5rem 1.25rem;
          border-radius: 8px;
          font-size: 0.8125rem;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
          color: #64748b;
          background: transparent;
        }

        .bf-currency-btn.active-usd {
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        }

        .bf-currency-btn.active-iqd {
          background: #059669;
          color: #ffffff;
          box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);
        }

        .bf-currency-error-text {
          color: #ef4444;
          font-size: 0.75rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          margin-top: 0.25rem;
        }

        .bf-table-container {
          overflow-x: auto;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          width: 100%;
        }

        .bf-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8125rem;
          text-align: left;
        }

        .bf-table th {
          background: #f8fafc;
          padding: 0.75rem 0.625rem;
          font-weight: 700;
          color: #475569;
          border-bottom: 2px solid #e2e8f0;
          text-transform: uppercase;
          font-size: 0.75rem;
          white-space: nowrap;
        }

        .bf-table td {
          padding: 0.5rem 0.625rem;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }

        .bf-table tr:hover {
          background: #f8fafc;
        }

        .bf-table-input {
          padding: 0.375rem 0.5rem;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 0.8125rem;
          width: 100%;
          outline: none;
        }

        .bf-table-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }

        .bf-summary-bar {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 1rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .bf-summary-item {
          display: flex;
          flex-direction: column;
        }

        .bf-summary-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }

        .bf-summary-value {
          font-size: 1.25rem;
          font-weight: 800;
          color: #0f172a;
        }

        .bf-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid #e2e8f0;
        }

        .bf-btn {
          padding: 0.625rem 1.25rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.15s ease;
        }

        .bf-btn-primary {
          background: #10b981;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
        }

        .bf-btn-primary:hover:not(:disabled) {
          background: #059669;
          transform: translateY(-1px);
        }

        .bf-btn-secondary {
          background: #ffffff;
          color: #475569;
          border: 1px solid #cbd5e1;
        }

        .bf-btn-secondary:hover {
          background: #f1f5f9;
        }

        .bf-btn-danger {
          background: #ef4444;
          color: #ffffff;
        }

        .bf-btn-danger:hover {
          background: #dc2626;
        }

        .bf-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none !important;
        }

        /* History Modal Overlay */
        .bf-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          padding: 1rem;
        }

        .bf-modal-content {
          background: #ffffff;
          border-radius: 12px;
          width: 100%;
          max-width: 860px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }

        .bf-modal-header {
          background: #1e293b;
          color: #ffffff;
          padding: 1rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .bf-modal-body {
          padding: 1.25rem;
          overflow-y: auto;
          flex: 1;
        }
      `}</style>

      <div className="bf-card">
        {/* Header */}
        <div className="bf-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <div style={{ background: "rgba(255,255,255,0.1)", padding: "0.5rem", borderRadius: "8px", display: "flex" }}>
              <FiShoppingCart size={22} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                {isEditing ? `Edit Purchase Bill #${editingBill?.billNumber}` : "New Purchase Entry"}
              </h1>
              <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                {isEditing ? "Modifying existing document records" : "Record inventory acquisition & supplier costs"}
              </span>
            </div>
          </div>
          <div className="bf-header-badge">
            <FiInfo size={13} />
            <span>{isEditing ? "EDIT MODE" : "NEW DRAFT"}</span>
          </div>
        </div>

        <div style={{ padding: "0.75rem" }}>
          {/* Notifications */}
          {successMessage && (
            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "0.875rem 1rem", borderRadius: "8px", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", fontWeight: 500 }}>
              <FiCheckCircle size={18} />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "0.875rem 1rem", borderRadius: "8px", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", fontWeight: 500 }}>
              <FiAlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Section 1: Currency & Supplier Information */}
            <div className="bf-section bf-section-company">
              <div className="bf-section-title">
                <FiUser size={16} />
                <span>1. Supplier & Currency Setup</span>
              </div>

              <div className="bf-grid-3" style={{ marginBottom: "1rem" }}>
                <div className="bf-form-group">
                  <label className="bf-label">
                    Operating Currency <span className="bf-label-required">*</span>
                  </label>
                  <div className={`bf-currency-toggle ${currencyError ? 'bf-currency-toggle-error' : ''}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrency("USD");
                        setCurrencyError(false);
                      }}
                      className={`bf-currency-btn ${currency === "USD" ? "active-usd" : ""}`}
                    >
                      USD ($)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrency("IQD");
                        setCurrencyError(false);
                      }}
                      className={`bf-currency-btn ${currency === "IQD" ? "active-iqd" : ""}`}
                    >
                      IQD (د.ع)
                    </button>
                  </div>
                  {currencyError && (
                    <div className="bf-currency-error-text">
                      <FiAlertTriangle size={14} />
                      Please select a currency before adding items
                    </div>
                  )}
                </div>

                <div className="bf-form-group" style={{ gridColumn: "span 2" }}>
                  <label className="bf-label">Supplier Company *</label>
                  <div style={{ position: "relative" }}>
                    <input
                      ref={companySearchRef}
                      type="text"
                      className="bf-input"
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      onFocus={handleCompanyFocus}
                      onBlur={handleCompanyBlur}
                      placeholder="Search company by code or name..."
                      required
                    />
                    {showCompanySuggestions && companySuggestions.length > 0 && (
                      <div className="bf-dropdown">
                        {companySuggestions.map((company) => (
                          <div
                            key={company.id}
                            className="bf-dropdown-item"
                            onClick={() => handleCompanySelect(company)}
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <div>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{company.name}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                Code: {company.code} {company.currency && `• Default Currency: ${company.currency}`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bf-grid-3">
                <div className="bf-form-group">
                  <label className="bf-label">Bill Date (dd/mm/yyyy) *</label>
                  <input
                    type="text"
                    className="bf-input"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    placeholder="dd/mm/yyyy"
                    required
                  />
                </div>

                <div className="bf-form-group">
                  <label className="bf-label">Supplier Reference / Invoice #</label>
                  <input
                    type="text"
                    className="bf-input"
                    value={companyBillNumber}
                    onChange={(e) => setCompanyBillNumber(e.target.value)}
                    onFocus={selectOnFocus}
                    placeholder="e.g. INV-2026-001"
                  />
                </div>

                <div className="bf-form-group">
                  <label className="bf-label">Payment Terms</label>
                  <select
                    className="bf-select"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                  >
                    <option value="Unpaid">Unpaid</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div className="bf-form-group">
                  <label className="bf-label">Destination Branch</label>
                  <select
                    className="bf-select"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  >
                    <option value="Slemany">Slemany Branch</option>
                    <option value="Erbil">Erbil Branch</option>
                  </select>
                </div>

                <div className="bf-form-group" style={{ justifyContent: "center" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginTop: "1.25rem", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={isConsignment}
                      onChange={(e) => setIsConsignment(e.target.checked)}
                      style={{ width: "1.125rem", height: "1.125rem", accentColor: "#2563eb", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Consignment Item (تحت صرف)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Section 2: Items Search & Table Entry */}
            <div className="bf-section bf-section-items">
              <div className="bf-section-title">
                <FiPackage size={16} />
                <span>2. Line Items ({validItemsCount})</span>
              </div>

              {/* Master Search Input with Suggestion Item History Buttons */}
              <div className="bf-form-group" style={{ marginBottom: "1rem" }}>
                <label className="bf-label">Quick Search Catalog & Add Item</label>
                <div style={{ position: "relative" }}>
                  <FiSearch style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} size={16} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    className={`bf-input ${currencyError ? 'bf-input-error' : ''}`}
                    style={{ paddingLeft: "2.25rem", background: "#fffbeb", borderColor: currencyError ? "#ef4444" : "#fde68a" }}
                    value={searchQuery}
                    onChange={(e) => {
                      if (!currency) return;
                      setSearchQuery(e.target.value);
                    }}
                    onFocus={(e) => {
                      if (!currency) {
                        e.preventDefault();
                        e.target.blur();
                        setCurrencyError(true);
                        const currencyToggle = document.querySelector('.bf-currency-toggle');
                        if (currencyToggle) {
                          currencyToggle.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                        return;
                      }
                      e.target.style.borderColor = '#4299e1';
                      e.target.style.boxShadow = '0 0 0 4px rgba(66, 153, 225, 0.15)';
                      e.target.style.backgroundColor = '#fff5df';
                      e.target.select();
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#fde68a';
                      e.target.style.boxShadow = 'none';
                      if (!e.target.value) {
                        e.target.style.backgroundColor = '#fffbeb';
                      }
                    }}
                    placeholder={currency ? "Type barcode or product name to auto-fill..." : "⚠️ Please select a currency first..."}
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="bf-dropdown">
                      {suggestions.map((item) => (
                        <div
                          key={item.id}
                          className="bf-dropdown-item"
                          onClick={() => handleItemSelect(item)}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>{item.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                              Barcode: {item.barcode} {item.expireDate && item.expireDate !== 'N/A' && `| Expires: ${formatDateToDDMMYYYY(item.expireDate)}`}
                            </div>
                          </div>

                          {/* View Purchase History Button in Suggestions */}
                          <button
                            type="button"
                            className="bf-history-pill-btn"
                            onClick={(e) => handleViewHistory(e, item)}
                            title="View past purchase history for this item"
                          >
                            <FiClock size={12} />
                            <span>History</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Item Table Grid */}
              <div className="bf-table-container">
                <table className="bf-table">
                  <thead>
                    <tr>
                      <th style={{ width: "15%" }}>Barcode</th>
                      <th style={{ width: "25%" }}>Product Description</th>
                      <th style={{ width: "8%", textAlign: "center" }}>Qty</th>
                      <th style={{ width: "13%", textAlign: "right" }}>Buy Price ({currency || '?'})</th>
                      <th style={{ width: "13%", textAlign: "right" }}>Selling Price ({currency || '?'})</th>
                      <th style={{ width: "13%", textAlign: "right" }}>Net Cost ({currency || '?'})</th>
                      <th style={{ width: "10%" }}>Expire Date</th>
                      <th style={{ width: "3%", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {billItems.map((item, index) => {
                      const netPrice = calculateNetPrice(
                        item,
                        totalQuantity || 1,
                        parseFloat(parseFormattedNumber(transportFee)) || 0,
                        parseFloat(parseFormattedNumber(externalExpense)) || 0,
                        parseFloat(parseFormattedNumber(expensePercentage)) || 0
                      );

                      return (
                        <tr key={index}>
                          <td>
                            <input
                              ref={(el) => itemInputRefs.current[`${index}-barcode`] = el}
                              type="text"
                              className="bf-table-input"
                              value={item.barcode || ''}
                              onChange={(e) => handleItemChange(index, "barcode", e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, 'barcode')}
                              onFocus={selectOnFocus}
                              placeholder="Barcode"
                            />
                          </td>
                          <td>
                            <input
                              ref={(el) => itemInputRefs.current[`${index}-name`] = el}
                              type="text"
                              className="bf-table-input"
                              value={item.name || ''}
                              onChange={(e) => handleItemChange(index, "name", e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, 'name')}
                              onFocus={selectOnFocus}
                              placeholder="Product name"
                            />
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <input
                              ref={(el) => itemInputRefs.current[`${index}-quantity`] = el}
                              type="number"
                              min="0"
                              step="1"
                              className="bf-table-input"
                              style={{ textAlign: "center", fontWeight: 600 }}
                              value={item.quantity || ''}
                              onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, 'quantity')}
                              onFocus={selectOnFocus}
                            />
                          </td>
                          <td>
                            <input
                              ref={(el) => itemInputRefs.current[`${index}-price`] = el}
                              type="text"
                              inputMode="decimal"
                              className="bf-table-input"
                              style={{ textAlign: "right" }}
                              value={formatForInput(item.price)}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/,/g, '');
                                const clean = raw.replace(/[^0-9.]/g, '');
                                const dotCount = (clean.match(/\./g) || []).length;
                                if (dotCount > 1) return;

                                handleItemChange(index, "price", clean);

                                const rawPrice = parseFloat(clean);
                                if (!isNaN(rawPrice) && rawPrice > 0 && (!item.outPrice || item.outPrice === '')) {
                                  const autoOutPrice = rawPrice * 1.5;
                                  handleItemChange(index, "outPrice", autoOutPrice.toFixed(2));
                                }
                              }}
                              onKeyDown={(e) => handleKeyDown(e, index, 'price')}
                              onFocus={selectOnFocus}
                              placeholder="0.00"
                            />
                          </td>
                          <td>
                            <input
                              ref={(el) => itemInputRefs.current[`${index}-outPrice`] = el}
                              type="text"
                              inputMode="decimal"
                              className="bf-table-input"
                              style={{ textAlign: "right", background: "#fffbeb", borderColor: "#fde68a" }}
                              value={formatForInput(item.outPrice)}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/,/g, '');
                                const clean = raw.replace(/[^0-9.]/g, '');
                                const dotCount = (clean.match(/\./g) || []).length;
                                if (dotCount > 1) return;

                                handleItemChange(index, "outPrice", clean);
                              }}
                              onKeyDown={(e) => handleKeyDown(e, index, 'outPrice')}
                              onFocus={selectOnFocus}
                              placeholder="0.00"
                            />
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#2563eb" }}>
                            {formatNumber(netPrice)}
                          </td>
                          <td>
                            <input
                              ref={(el) => itemInputRefs.current[`${index}-expireDate`] = el}
                              type="text"
                              className="bf-table-input"
                              placeholder="dd/mm/yyyy"
                              value={item.expireDate || ''}
                              onChange={(e) => handleItemChange(index, "expireDate", e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, 'expireDate')}
                            />
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              style={{ background: "#fef2f2", border: "none", color: "#ef4444", padding: "0.375rem", borderRadius: "6px", cursor: "pointer", display: "inline-flex" }}
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: Overhead & Notes */}
            <div className="bf-section">
              <div className="bf-section-title">
                <FiTruck size={16} />
                <span>3. Additional Expenses & Notes</span>
              </div>

              <div className="bf-grid-3" style={{ marginBottom: "1rem" }}>
                <div className="bf-form-group">
                  <label className="bf-label">Transport Costs ({currency || '?'})</label>
                  <input
                    ref={transportFeeRef}
                    type="text"
                    inputMode="decimal"
                    className="bf-input"
                    value={formatForInput(transportFee)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, '');
                      const clean = raw.replace(/[^0-9.]/g, '');
                      const dotCount = (clean.match(/\./g) || []).length;
                      if (dotCount > 1) return;
                      setTransportFee(clean);
                    }}
                    onKeyDown={(e) => handleKeyDown(e, null, 'transportFee')}
                    onFocus={selectOnFocus}
                    placeholder="0.00"
                  />
                </div>

                <div className="bf-form-group">
                  <label className="bf-label">Other Overhead / Customs ({currency || '?'})</label>
                  <input
                    ref={externalExpenseRef}
                    type="text"
                    inputMode="decimal"
                    className="bf-input"
                    value={formatForInput(externalExpense)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, '');
                      const clean = raw.replace(/[^0-9.]/g, '');
                      const dotCount = (clean.match(/\./g) || []).length;
                      if (dotCount > 1) return;
                      setExternalExpense(clean);
                    }}
                    onKeyDown={(e) => handleKeyDown(e, null, 'externalExpense')}
                    onFocus={selectOnFocus}
                    placeholder="0.00"
                  />
                </div>

                <div className="bf-form-group">
                  <label className="bf-label">Expense Margin (%)</label>
                  <input
                    ref={expensePercentageRef}
                    type="text"
                    inputMode="decimal"
                    className="bf-input"
                    value={formatForInput(expensePercentage)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, '');
                      const clean = raw.replace(/[^0-9.]/g, '');
                      const dotCount = (clean.match(/\./g) || []).length;
                      if (dotCount > 1) return;
                      setExpensePercentage(clean);
                    }}
                    onKeyDown={(e) => handleKeyDown(e, null, 'expensePercentage')}
                    onFocus={selectOnFocus}
                    placeholder="7"
                  />
                </div>
              </div>

              <div className="bf-form-group">
                <label className="bf-label">Internal Notes / Memo</label>
                <textarea
                  ref={billNoteRef}
                  className="bf-textarea"
                  style={{ minHeight: "70px", resize: "vertical" }}
                  value={billNote}
                  onChange={(e) => setBillNote(e.target.value)}
                  placeholder="Enter invoice notes or purchase remarks..."
                />
              </div>
            </div>

            {/* Summary Footer */}
            <div className="bf-summary-bar">
              <div className="bf-summary-item">
                <span className="bf-summary-label">Total Units</span>
                <span className="bf-summary-value">{totalQuantity}</span>
              </div>
              <div className="bf-summary-item">
                <span className="bf-summary-label">Total Base Subtotal</span>
                <span className="bf-summary-value" style={{ color: "#2563eb" }}>
                  {formatNumber(totalBasePrice)} {currency || '?'}
                </span>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="bf-actions">
              <button type="button" onClick={resetForm} className="bf-btn bf-btn-secondary">
                <FiRefreshCw size={14} /> Clear Form
              </button>

              {isEditing && (
                <button type="button" onClick={handleCancel} className="bf-btn bf-btn-danger">
                  <FiX size={14} /> Cancel Edit
                </button>
              )}

              <button
                ref={submitButtonRef}
                type="submit"
                disabled={isLoading}
                className="bf-btn bf-btn-primary"
              >
                {isLoading ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <FiCheckCircle size={16} />
                    <span>{isEditing ? "Save & Update Bill" : "Finalize & Save Bill"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ============================================================ */}
      {/* Product Purchase History Modal                               */}
      {/* ============================================================ */}
      {historyModalOpen && (
        <div className="bf-modal-overlay" onClick={() => setHistoryModalOpen(false)}>
          <div className="bf-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="bf-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <FiClock size={18} color="#38bdf8" />
                <div>
                  <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                    Purchase History: {historyItem?.name}
                  </h3>
                  <span style={{ fontSize: "0.75rem", opacity: 0.75 }}>
                    Barcode: {historyItem?.barcode}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "#ffffff", cursor: "pointer", display: "flex" }}
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="bf-modal-body">
              {isHistoryLoading ? (
                <div style={{ padding: "2.5rem", textAlign: "center", color: "#64748b" }}>
                  <FiRefreshCw className="animate-spin" size={24} style={{ margin: "0 auto 0.5rem" }} />
                  <p style={{ margin: 0, fontSize: "0.875rem" }}>Loading purchase records...</p>
                </div>
              ) : historyRecords.length === 0 ? (
                <div style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8" }}>
                  <FiPackage size={36} style={{ margin: "0 auto 0.5rem", opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, color: "#64748b" }}>
                    No Previous Purchase History Found
                  </p>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem" }}>
                    This item has not been recorded in any previous bought bills yet.
                  </p>
                </div>
              ) : (
                <div className="bf-table-container">
                  <table className="bf-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Supplier / Company</th>
                        <th>Bill #</th>
                        <th style={{ textAlign: "center" }}>Qty</th>
                        <th style={{ textAlign: "right" }}>Buy Price</th>
                        <th style={{ textAlign: "right" }}>Selling Price</th>
                        <th>Branch</th>
                        <th>Expiry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRecords.map((rec, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                            {formatDateToDDMMYYYY(rec.date)}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: "#1e293b" }}>{rec.companyName}</div>
                            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Company Bill #: {rec.companyBillNumber}</div>
                          </td>
                          <td style={{ fontWeight: 600, color: "#2563eb" }}>
                            #{rec.billNumber}
                          </td>
                          <td style={{ textAlign: "center", fontWeight: 700 }}>
                            {rec.quantity}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#059669" }}>
                            {rec.currency === "USD" ? `$${formatNumber(rec.buyPrice)}` : `${formatNumber(rec.buyPrice)} IQD`}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 600, color: "#2563eb" }}>
                            {rec.currency === "USD" ? `$${formatNumber(rec.outPrice)}` : `${formatNumber(rec.outPrice)} IQD`}
                          </td>
                          <td>
                            <span style={{ background: "#f1f5f9", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                              {rec.branch}
                            </span>
                          </td>
                          <td style={{ color: "#64748b", fontSize: "0.75rem" }}>
                            {formatDateToDDMMYYYY(rec.expireDate) || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}