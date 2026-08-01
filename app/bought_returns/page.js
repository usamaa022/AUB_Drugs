"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import React from "react";
import { 
  getReturnsForCompany, 
  getCompanies, 
  getBoughtBills, 
  returnItemsToStore, 
  deleteBoughtReturn, 
  createBoughtReturn,
  getPayments,
  deleteBoughtReturnItem,
  updateBoughtReturnBill,
  generateBoughtReturnBillNumberForBill,
  getStoreItems   
} from "@/lib/data";
import { useRouter } from "next/navigation";
import Select from "react-select";
import * as XLSX from 'xlsx';
import { Filter, Search } from "lucide-react";

// --- Advanced Filter Operators ---
const STRING_OPERATORS = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "startsWith", label: "Starts with" },
  { value: "endsWith", label: "Ends with" }
];

const NUMBER_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "greaterThan", label: "> Greater than" },
  { value: "lessThan", label: "< Less than" }
];

export default function BoughtReturnHistory() {
  const [returns, setReturns] = useState([]);
  const [allReturns, setAllReturns] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [boughtBills, setBoughtBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [storeItems, setStoreItems] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [editingReturn, setEditingReturn] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [editNote, setEditNote] = useState("");
  const [maxEditQty, setMaxEditQty] = useState(0);
  
  const [filters, setFilters] = useState({
    paymentStatus: "all",
    startDate: "",
    endDate: ""
  });
  
  const [returnItems, setReturnItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemFilters, setItemFilters] = useState([]);
  const [companySelectValue, setCompanySelectValue] = useState(null);
  const [returnNote, setReturnNote] = useState("");
  
  // --- Return History Table States ---
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);

  // --- Bought Bills Table States (New) ---
  const [billSearchText, setBillSearchText] = useState("");
  const [billSortConfig, setBillSortConfig] = useState({ key: null, direction: 'asc' });
  const [billColumnFilters, setBillColumnFilters] = useState({});
  const [activeBillFilterDropdown, setActiveBillFilterDropdown] = useState(null);

  const router = useRouter();

  // Handle outside click for filter dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.filter-dropdown-container')) {
        setActiveFilterDropdown(null);
        setActiveBillFilterDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Currency formatting function
  const formatCurrency = (amount, currency = "USD") => {
    if (currency === "IQD") {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount || 0);
    }
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const getCurrencySymbol = (currency) => currency === "IQD" ? "IQD" : "$";
  const getCurrencyColor = (currency) => currency === "IQD" ? "#f59e0b" : "#3b82f6";

  const styles = {
    container: {
      minHeight: "100vh",
      width: "100%",
      margin: 0,
      padding: 0,
      boxSizing: "border-box",
      background: "linear-gradient(135deg, #f0f4ff 0%, #e8ecf1 100%)",
    },
    wrapper: {
      width: "100%",
      margin: "0",
      padding: "1rem 0rem",
      boxSizing: "border-box",
    },
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
    headerTitle: {
      color: "white",
      fontSize: "1.8rem",
      fontWeight: "700",
      margin: 0,
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
    },
    headerSubtitle: {
      color: "rgba(255,255,255,0.7)",
      fontSize: "0.9rem",
      margin: "0.25rem 0 0 0",
    },
    mainCard: {
      width: "100%",
      background: "white",
      borderRadius: "20px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      overflow: "hidden",
      marginBottom: "0.5rem",
      boxSizing: "border-box",
    },
    cardHeader: {
      padding: "1.25rem 1.5rem",
      background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
      borderBottom: "2px solid #e2e8f0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "0.75rem",
    },
    cardHeaderTitle: {
      fontSize: "1.25rem",
      fontWeight: "600",
      color: "#1e293b",
      margin: 0,
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    },
    cardBody: {
      padding: "0.5rem",
      width: "100%",
      boxSizing: "border-box",
    },
    filterGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
      gap: "1rem",
      marginBottom: "0.5rem",
      width: "100%",
    },
    filterItem: {
      display: "flex",
      flexDirection: "column",
    },
    label: {
      fontSize: "0.8rem",
      fontWeight: "600",
      color: "#475569",
      marginBottom: "0.35rem",
      textTransform: "uppercase",
      letterSpacing: "0.03em",
    },
    input: {
      padding: "0.6rem 0.75rem",
      border: "2px solid #e2e8f0",
      borderRadius: "10px",
      fontSize: "0.9rem",
      transition: "all 0.2s ease",
      outline: "none",
      width: "100%",
      background: "white",
      color: "#1e293b",
      boxSizing: "border-box",
    },
    inputFocus: {
      borderColor: "#6366f1",
      boxShadow: "0 0 0 3px rgba(99, 102, 241, 0.15)",
    },
    filterBox: {
      width: "100%",
      background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
      borderRadius: "14px",
      padding: "1.25rem",
      marginBottom: "1.5rem",
      border: "1px solid #e2e8f0",
      boxSizing: "border-box",
    },
    tableContainer: {
      width: "100%",
      overflowX: "auto",
      borderRadius: "12px",
      border: "1px solid #e2e8f0",
      marginBottom: "1.5rem",
      background: "white",
    },
table: {
      width: "100%",
      minWidth: "100%", // Forces it to fill the entire container on wide screens
      borderCollapse: "collapse",
      fontSize: "0.9rem",
      tableLayout: "auto", // Allows columns to distribute space dynamically
    },
    th: {
      padding: "0.75rem 1rem",
      textAlign: "left",
      fontSize: "0.75rem",
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      color: "#475569",
      background: "#f8fafc",
      borderBottom: "2px solid #e2e8f0",
      cursor: "pointer",
      userSelect: "none",
      whiteSpace: "nowrap",
      position: "sticky",
      top: 0,
      zIndex: 5,
    },
    td: {
      padding: "0.75rem 1rem",
      borderBottom: "1px solid #f1f5f9",
      fontSize: "0.85rem",
      color: "#1e293b",
    },
    badge: {
      padding: "0.2rem 0.65rem",
      borderRadius: "20px",
      fontSize: "0.75rem",
      fontWeight: "600",
      display: "inline-block",
    },
    badgePaid: {
      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      color: "white",
    },
    badgeUnpaid: {
      background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
      color: "white",
    },
    badgeProcessed: {
      background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
      color: "white",
    },
    buttonPrimary: {
      background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
      color: "white",
      border: "none",
      padding: "0.4rem 1rem",
      borderRadius: "8px",
      fontSize: "0.8rem",
      fontWeight: "500",
      cursor: "pointer",
      transition: "all 0.2s ease",
      boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
      display: "inline-flex",
      alignItems: "center",
      gap: "0.4rem",
    },
    buttonDanger: {
      background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      color: "white",
      border: "none",
      padding: "0.4rem 1rem",
      borderRadius: "8px",
      fontSize: "0.8rem",
      fontWeight: "500",
      cursor: "pointer",
      transition: "all 0.2s ease",
      boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)",
      display: "inline-flex",
      alignItems: "center",
      gap: "0.4rem",
    },
    buttonSuccess: {
      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      color: "white",
      border: "none",
      padding: "0.6rem 1.5rem",
      borderRadius: "10px",
      fontSize: "0.9rem",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.2s ease",
      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
      display: "inline-flex",
      alignItems: "center",
      gap: "0.5rem",
    },
    buttonSuccessDisabled: {
      opacity: 0.6,
      cursor: "not-allowed",
    },
    buttonExport: {
      background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
      color: "white",
      border: "none",
      padding: "0.4rem 1rem",
      borderRadius: "8px",
      fontSize: "0.8rem",
      fontWeight: "500",
      cursor: "pointer",
      transition: "all 0.2s ease",
      boxShadow: "0 2px 8px rgba(139, 92, 246, 0.3)",
      display: "inline-flex",
      alignItems: "center",
      gap: "0.4rem",
    },
    modal: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "1rem",
      zIndex: 100,
      backdropFilter: "blur(4px)",
    },
    modalContent: {
      background: "white",
      borderRadius: "20px",
      maxWidth: "600px",
      width: "100%",
      maxHeight: "90vh",
      overflow: "auto",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    },
    modalHeader: {
      padding: "1.25rem 1.5rem",
      borderBottom: "2px solid #e2e8f0",
      background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
      borderRadius: "20px 20px 0 0",
    },
    modalBody: {
      padding: "1.5rem",
    },
    modalFooter: {
      padding: "1.25rem 1.5rem",
      borderTop: "2px solid #e2e8f0",
      display: "flex",
      justifyContent: "flex-end",
      gap: "0.75rem",
    },
    createSection: {
      background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
      borderRadius: "16px",
      padding: "1.5rem",
      marginTop: "1.5rem",
      border: "1px solid #e2e8f0",
      width: "100%",
      boxSizing: "border-box",
    },
    quantityBadge: {
      background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
      color: "white",
      padding: "0.2rem 0.6rem",
      borderRadius: "12px",
      fontSize: "0.8rem",
      fontWeight: "600",
    },
    companyCode: {
      fontSize: "0.7rem",
      color: "#94a3b8",
    },
    returnNumber: {
      color: "#6366f1",
      fontWeight: "600",
    },
    alertError: {
      padding: "0.75rem 1rem",
      background: "#fef2f2",
      borderLeft: "4px solid #ef4444",
      borderRadius: "8px",
      color: "#991b1b",
      marginBottom: "1rem",
      fontSize: "0.9rem",
      width: "100%",
      boxSizing: "border-box",
    },
    alertSuccess: {
      padding: "0.75rem 1rem",
      background: "#f0fdf4",
      borderLeft: "4px solid #10b981",
      borderRadius: "8px",
      color: "#065f46",
      marginBottom: "1rem",
      fontSize: "0.9rem",
      width: "100%",
      boxSizing: "border-box",
    },
    emptyState: {
      textAlign: "center",
      padding: "3rem 1.5rem",
      color: "#94a3b8",
    },
    emptyStateIcon: {
      fontSize: "3rem",
      marginBottom: "1rem",
    },
    loadingSpinner: {
      display: "inline-block",
      width: "20px",
      height: "20px",
      border: "3px solid rgba(255,255,255,0.3)",
      borderTopColor: "white",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    },
    sectionTitle: {
      fontSize: "1.1rem",
      fontWeight: "600",
      color: "#1e293b",
      marginBottom: "1rem",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      width: "100%",
    },
    billSelectRow: {
      cursor: "pointer",
      transition: "all 0.15s ease",
    },
    detailsPanel: {
      padding: "1.5rem",
      background: "#eef2ff",
      borderTop: "2px solid #6366f1",
      borderBottom: "2px solid #6366f1",
      width: "100%",
      boxSizing: "border-box",
    },
    inputSmall: {
      width: "70px",
      padding: "0.4rem 0.5rem",
      textAlign: "center",
      border: "2px solid #fde68a",
      borderRadius: "8px",
      fontSize: "0.85rem",
      background: "white",
    },
    inputPrice: {
      width: "100px",
      padding: "0.4rem 0.5rem",
      textAlign: "center",
      border: "2px solid #bfdbfe",
      borderRadius: "8px",
      fontSize: "0.85rem",
      background: "white",
    },
    flexBetween: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "0.5rem",
    }
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      let dateObj;
      if (date && typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date && date.seconds) {
        dateObj = new Date(date.seconds * 1000);
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        if (date.includes('-')) {
          const [year, month, day] = date.split('-');
          dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
        } else if (date.includes('/')) {
          const [day, month, year] = date.split('/');
          dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
        } else {
          dateObj = new Date(date);
        }
      } else {
        return "N/A";
      }
      
      if (!dateObj || isNaN(dateObj.getTime())) return "N/A";
      
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      return "N/A";
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const fetchAllReturns = async () => {
    try {
      const allCompanies = await getCompanies();
      const allPayments = await getPayments();
      
      const paidReturnIds = new Set();
      allPayments.forEach(payment => {
        if (payment.selectedBoughtReturns && Array.isArray(payment.selectedBoughtReturns)) {
          payment.selectedBoughtReturns.forEach(returnId => paidReturnIds.add(returnId));
        }
      });
      
      let allReturnsData = [];
      for (const company of allCompanies) {
        if (company && company.id) {
          const returnsData = await getReturnsForCompany(company.id);
          
          const processedReturns = returnsData.map(returnItem => {
            const itemCurrency = returnItem.currency || "USD";
            const returnPrice = itemCurrency === "IQD" 
              ? (returnItem.returnPriceIQD || returnItem.returnPrice || 0) 
              : (returnItem.returnPriceUSD || returnItem.returnPrice || 0);
            const returnTotal = returnPrice * (returnItem.returnQuantity || 0);
            
            return {
              ...returnItem,
              companyName: company.name,
              companyCode: company.code,
              companyId: company.id,
              returnTotal: returnTotal,
              returnDate: returnItem.returnDate || returnItem.date || new Date(),
              returnNote: returnItem.returnNote || "",
              isPaid: paidReturnIds.has(returnItem.id),
              paymentStatus: paidReturnIds.has(returnItem.id) ? "Paid" : "Unpaid",
              expireDate: returnItem.expireDate ? formatDate(returnItem.expireDate) : 'N/A',
              currency: itemCurrency,
              returnPriceUSD: returnItem.returnPriceUSD || 0,
              returnPriceIQD: returnItem.returnPriceIQD || 0
            };
          });
          
          allReturnsData = [...allReturnsData, ...processedReturns];
        }
      }
      
      setAllReturns(allReturnsData);
      setReturns(allReturnsData);
    } catch (error) {
      console.error("Error fetching all returns:", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [companiesData, boughtBillsData, paymentsData, storeItemsData] = await Promise.all([
          getCompanies(),
          getBoughtBills(),
          getPayments(),
          getStoreItems(true)
        ]);
        
        const validCompanies = companiesData.filter(company => company && company.id);
        setCompanies(validCompanies);
        
        const validBoughtBills = boughtBillsData.filter(bill => bill && bill.id);
        setBoughtBills(validBoughtBills);
        
        setPayments(paymentsData);
        setStoreItems(storeItemsData);

        const items = new Set();
        validBoughtBills.forEach((bill) => {
          if (bill.items && Array.isArray(bill.items)) {
            bill.items.forEach((item) => {
              if (item && item.name) items.add(item.name);
            });
          }
        });
        setAvailableItems(Array.from(items));

        await fetchAllReturns();
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to fetch data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCompany?.id) {
      const fetchReturns = async () => {
        try {
          setIsLoading(true);
          const returnsData = await getReturnsForCompany(selectedCompany.id);
          const allPayments = await getPayments();
          
          const paidReturnIds = new Set();
          allPayments.forEach(payment => {
            if (payment.selectedBoughtReturns && Array.isArray(payment.selectedBoughtReturns)) {
              payment.selectedBoughtReturns.forEach(returnId => paidReturnIds.add(returnId));
            }
          });
          
          const processedReturns = returnsData.map(returnItem => {
            const itemCurrency = returnItem.currency || "USD";
            const returnPrice = itemCurrency === "IQD" 
              ? (returnItem.returnPriceIQD || returnItem.returnPrice || 0) 
              : (returnItem.returnPriceUSD || returnItem.returnPrice || 0);
            const returnTotal = returnPrice * (returnItem.returnQuantity || 0);
            
            return {
              ...returnItem,
              companyName: selectedCompany.name,
              companyCode: selectedCompany.code,
              companyId: selectedCompany.id,
              returnTotal: returnTotal,
              returnDate: returnItem.returnDate || returnItem.date || new Date(),
              returnNote: returnItem.returnNote || "",
              isPaid: paidReturnIds.has(returnItem.id),
              paymentStatus: paidReturnIds.has(returnItem.id) ? "Paid" : "Unpaid",
              expireDate: returnItem.expireDate ? formatDate(returnItem.expireDate) : 'N/A',
              currency: itemCurrency,
              returnPriceUSD: returnItem.returnPriceUSD || 0,
              returnPriceIQD: returnItem.returnPriceIQD || 0
            };
          });
          
          setReturns(processedReturns);
        } catch (error) {
          console.error("Error fetching returns:", error);
          setError("Failed to fetch returns. Please try again.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchReturns();
    } else {
      setReturns(allReturns);
    }
  }, [selectedCompany, allReturns]);

  const handleCompanySelect = (selectedOption) => {
    if (!selectedOption) {
      setSelectedCompany(null);
      setCompanySelectValue(null);
      setSelectedBill(null);
      setSelectedReturn(null);
      setEditingReturn(null);
      setError(null);
      setBillSearchText("");
      setBillColumnFilters({});
      return;
    }
    
    setSelectedCompany(selectedOption.value);
    setCompanySelectValue(selectedOption);
    setSelectedBill(null);
    setSelectedReturn(null);
    setEditingReturn(null);
    setError(null);
    setBillSearchText("");
    setBillColumnFilters({});
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleBillSelect = (bill) => {
    if (selectedBill?.id === bill.id) {
      setSelectedBill(null);
      setReturnItems([]);
      setReturnNote("");
      return;
    }

    if (!bill || !bill.items || !Array.isArray(bill.items)) {
      setError("Invalid bill selected");
      return;
    }

    setSelectedBill(bill);
    setReturnNote("");

    try {
      const existingReturns = allReturns.filter(item =>
        item && String(item.billNumber) === String(bill.billNumber)
      );

      const validReturnItems = bill.items
        .filter(item => item && item.barcode)
        .map((item) => {
          const originalQuantity = item.quantity || 0;

          const actualReturned = existingReturns
            .filter(r => r && String(r.barcode) === String(item.barcode))
            .reduce((sum, r) => sum + (r.returnQuantity || 0), 0);

          const matchingStoreItems = storeItems.filter(si =>
            String(si.barcode) === String(item.barcode) &&
            String(si.boughtBillNumber) === String(bill.billNumber)
          );
          const availableQuantity = matchingStoreItems.reduce(
            (sum, si) => sum + (Number(si.quantity) || 0), 0
          );

          const soldQuantity = Math.max(0, originalQuantity - availableQuantity - actualReturned);

          let basePrice = 0;
          if (bill.currency === "IQD") {
            basePrice = item.basePriceIQD || item.netPriceIQD || item.netPrice || item.outPriceIQD || 0;
          } else {
            basePrice = item.basePriceUSD || item.netPriceUSD || item.netPrice || item.outPriceUSD || 0;
          }

          return {
            id: item.barcode,
            barcode: item.barcode,
            name: item.name,
            returnQuantity: 0,
            returnPrice: basePrice,
            returnPriceUSD: item.outPriceUSD || 0,
            returnPriceIQD: item.outPriceIQD || 0,
            availableQuantity: Math.max(0, availableQuantity),
            originalQuantity,
            previouslyReturned: actualReturned, 
            soldQuantity, 
            netPrice: item.netPrice || 0,
            outPrice: item.outPrice || 0,
            basePriceUSD: item.basePriceUSD || 0,
            basePriceIQD: item.basePriceIQD || 0,
            isConsignment: item.isConsignment || false,
            consignmentOwnerId: item.consignmentOwnerId || null,
            expireDate: item.expireDate ? formatDate(item.expireDate) : 'N/A',
            currency: bill.currency || "USD",
            branch: item.branch || "Slemany",
          };
        });

      setReturnItems(validReturnItems);
    } catch (err) {
      console.error("Error calculating stock for return:", err);
      setError("Failed to load available quantities");
    }
  };

  const handleReturnQuantityChange = (index, value) => {
    const newReturnItems = [...returnItems];
    if (!newReturnItems[index]) return;
    
    const maxQty = newReturnItems[index].availableQuantity || 0;
    const inputQty = Math.min(Math.max(0, parseInt(value) || 0), maxQty);
    newReturnItems[index].returnQuantity = inputQty;
    setReturnItems(newReturnItems);
  };

  const handleReturnPriceChange = (index, value) => {
    const newReturnItems = [...returnItems];
    if (!newReturnItems[index]) return;
    
    const priceValue = parseFloat(value) || 0;
    const billCurrency = selectedBill?.currency || "USD";
    const exchangeRate = selectedBill?.exchangeRate || 1500;
    
    if (billCurrency === "IQD") {
      newReturnItems[index].returnPrice = priceValue;
      newReturnItems[index].returnPriceIQD = priceValue;
      newReturnItems[index].returnPriceUSD = priceValue / exchangeRate;
    } else {
      newReturnItems[index].returnPrice = priceValue;
      newReturnItems[index].returnPriceUSD = priceValue;
      newReturnItems[index].returnPriceIQD = priceValue * exchangeRate;
    }
    
    setReturnItems(newReturnItems);
  };

  const handleEditReturn = (returnItem) => {
    if (returnItem.isPaid) {
      alert("Cannot edit a return that has already been paid.");
      return;
    }
    
    try {
      const matchingStore = storeItems.filter(si => 
        String(si.barcode) === String(returnItem.barcode) && 
        String(si.boughtBillNumber) === String(returnItem.billNumber)
      );
      const currentAvail = matchingStore.reduce((sum, si) => sum + (Number(si.quantity) || 0), 0);
      const calculatedMax = currentAvail + (Number(returnItem.returnQuantity) || 0);
      setMaxEditQty(calculatedMax);

      let returnPriceValue = 0;
      if (returnItem.currency === "IQD") {
        returnPriceValue = returnItem.returnPriceIQD || returnItem.returnPrice || 0;
      } else {
        returnPriceValue = returnItem.returnPriceUSD || returnItem.returnPrice || 0;
      }
      
      setEditingReturn(returnItem);
      setEditItems([{ 
        ...returnItem,
        returnPriceValue: returnPriceValue,
        originalCurrency: returnItem.currency,
        originalQuantity: returnItem.returnQuantity
      }]);
      setEditNote(returnItem.returnNote || "");
    } catch (err) {
      console.error(err);
      alert("Failed to setup edit interface.");
    }
  };

  const handleEditQuantityChange = (value) => {
    const newItems = [...editItems];
    if (!newItems[0]) return;
    const newQuantity = Math.min(Math.max(0, parseInt(value) || 0), maxEditQty);
    
    const updatedItem = { 
      ...newItems[0],
      returnQuantity: newQuantity
    };
    
    newItems[0] = updatedItem;
    setEditItems(newItems);
  };

  const handleEditPriceChange = (value) => {
    const newItems = [...editItems];
    if (!newItems[0]) return;
    const priceValue = parseFloat(value) || 0;
    
    const updatedItem = { 
      ...newItems[0],
      returnPriceValue: priceValue
    };
    
    newItems[0] = updatedItem;
    setEditItems(newItems);
  };

  const handleCancelEdit = () => {
    setEditingReturn(null);
    setEditItems([]);
    setEditNote("");
  };

  const handleSubmitEdit = async () => {
    if (!editingReturn || !editingReturn.id) {
      alert("Invalid return item: missing ID");
      return;
    }

    const editedItem = editItems[0];
    if (!editedItem) {
      alert("No item data found");
      return;
    }

    if (editedItem.returnQuantity <= 0) {
      alert("Return quantity must be greater than 0");
      return;
    }

    const priceValue = editedItem.returnPriceValue || 0;
    if (priceValue <= 0) {
      alert("Return price must be greater than 0");
      return;
    }

    try {
      const currency = editingReturn.currency || "USD";
      const exchangeRate = editingReturn.exchangeRate || 1500;

      let returnPriceUSD = 0;
      let returnPriceIQD = 0;
      if (currency === "USD") {
        returnPriceUSD = priceValue;
        returnPriceIQD = priceValue * exchangeRate;
      } else if (currency === "IQD") {
        returnPriceIQD = priceValue;
        returnPriceUSD = priceValue / exchangeRate;
      }

      const allItemsInReturn = allReturns.filter(r =>
        r && String(r.returnNumber) === String(editingReturn.returnNumber)
      );

      const updatedItems = allItemsInReturn.map(item => {
        if (String(item.barcode) === String(editingReturn.barcode)) {
          return {
            ...item, 
            returnQuantity: Number(editedItem.returnQuantity),
            returnPrice: priceValue,
            returnPriceUSD,
            returnPriceIQD,
            returnNote: editNote,
          };
        }
        return item;
      });

      await updateBoughtReturnBill(editingReturn.id, updatedItems, editNote);

      setSuccessMessage("Return updated successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
      handleCancelEdit();
      await fetchAllReturns();
      getStoreItems(true).then(setStoreItems); 
    } catch (error) {
      console.error("Error updating return:", error);
      setError(`Failed to update return: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteReturnItem = async (returnItem) => {
    if (!returnItem || !returnItem.id) {
      alert("Invalid return item");
      return;
    }
    if (returnItem.isPaid) {
      alert("Cannot delete a return that has already been paid.");
      return;
    }
    if (confirm(`Are you sure you want to delete return for "${returnItem.name}"? This will restore ${returnItem.returnQuantity} items to store.`)) {
      try {
        await deleteBoughtReturnItem(returnItem.id, returnItem.barcode, returnItem.returnQuantity, returnItem);

        const matchesRow = (r) =>
          r.id === returnItem.id &&
          String(r.barcode) === String(returnItem.barcode) &&
          String(r.billNumber) === String(returnItem.billNumber);

        setAllReturns(prev => prev.filter(r => !matchesRow(r)));
        setReturns(prev => prev.filter(r => !matchesRow(r)));
        
        setSuccessMessage(`Return for "${returnItem.name}" deleted successfully!`);
        setTimeout(() => setSuccessMessage(null), 3000);
        getStoreItems(true).then(setStoreItems);
      } catch (error) {
        console.error("Error deleting return:", error);
        setError(`Failed to delete return: ${error.message}`);
        setTimeout(() => setError(null), 5000);
      }
    }
  };

  const calculateItemTotal = (item) => {
    const price = item.returnPrice || item.returnPriceUSD || 0;
    return price * (item.returnQuantity || 0);
  };

  const getItemCurrency = (item) => {
    return item.currency || selectedBill?.currency || "USD";
  };

  const calculateGrandTotal = () => {
    return returnItems.reduce((sum, item) => {
      const price = item.returnPrice || item.returnPriceUSD || 0;
      return sum + (price * (item.returnQuantity || 0));
    }, 0);
  };

  const getGrandTotalCurrency = () => {
    if (returnItems.length > 0 && returnItems[0].currency) {
      return returnItems[0].currency;
    }
    return selectedBill?.currency || "USD";
  };

  const handleSubmitReturn = async () => {
    if (isSubmitting) return;
    
    if (!selectedCompany?.id || !selectedBill) {
      setError("Please select a company and bill");
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    const itemsToReturn = returnItems.filter((item) => item && item.returnQuantity > 0);
    if (itemsToReturn.length === 0) {
      alert("Please select at least one item to return.");
      return;
    }
    
    for (const item of itemsToReturn) {
      if (item.returnQuantity > item.availableQuantity) {
        alert(`Cannot return more than ${item.availableQuantity} of ${item.name}.`);
        return;
      }
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const billCurrency = selectedBill.currency || "USD";
      const exchangeRate = selectedBill.exchangeRate || 1500;
      const returnBillNumber = await generateBoughtReturnBillNumberForBill(selectedBill.billNumber);
      
      const preparedItems = itemsToReturn.map(item => {
        const returnQuantity = Number(item.returnQuantity) || 0;
        let basePrice = Number(item.returnPrice) || 0;
        let returnPriceUSD = 0;
        let returnPriceIQD = 0;
        
        if (billCurrency === "IQD") {
          returnPriceIQD = basePrice;
          returnPriceUSD = basePrice / exchangeRate;
        } else {
          returnPriceUSD = basePrice;
          returnPriceIQD = basePrice * exchangeRate;
        }
        
        return {
          barcode: String(item.barcode),
          name: String(item.name),
          billNumber: String(selectedBill.billNumber),
          quantity: Number(item.originalQuantity) || 0,
          returnQuantity: returnQuantity,
          returnPrice: basePrice,
          returnPriceUSD: returnPriceUSD,
          returnPriceIQD: returnPriceIQD,
          returnNote: returnNote,
          originalPrice: basePrice,
          netPrice: Number(item.netPrice) || 0,
          outPrice: Number(item.outPrice) || 0,
          expireDate: item.expireDate === 'N/A' ? null : item.expireDate,
          isConsignment: item.isConsignment || false,
          consignmentOwnerId: item.consignmentOwnerId || null,
          currency: billCurrency,
          exchangeRateAtReturn: exchangeRate,
          companyId: selectedCompany.id,
          companyName: selectedCompany.name,
          branch: item.branch || "Slemany",
          basePriceUSD: billCurrency === "USD" ? basePrice : 0,
          basePriceIQD: billCurrency === "IQD" ? basePrice : 0,
        };
      });
      
      const result = await createBoughtReturn(
        selectedCompany.id, 
        preparedItems, 
        returnNote,
        returnBillNumber
      );

      const newRows = result.items.map(item => {
        const itemCurrency = item.currency || "USD";
        const returnPrice = itemCurrency === "IQD" ? item.returnPriceIQD : item.returnPriceUSD;
        return {
          id: result.id,
          returnNumber: result.returnBillNumber,
          returnDate: new Date(),
          returnNote: returnNote || "",
          companyId: selectedCompany.id,
          companyName: selectedCompany.name,
          companyCode: selectedCompany.code,
          billNumber: item.billNumber,
          barcode: item.barcode,
          name: item.name,
          returnQuantity: item.returnQuantity,
          returnPrice: returnPrice,
          returnPriceUSD: item.returnPriceUSD,
          returnPriceIQD: item.returnPriceIQD,
          quantity: item.quantity,
          netPrice: item.netPrice,
          outPrice: item.outPrice,
          expireDate: item.expireDate ? formatDate(item.expireDate) : 'N/A',
          isConsignment: item.isConsignment,
          consignmentOwnerId: item.consignmentOwnerId,
          currency: itemCurrency,
          returnTotal: returnPrice * item.returnQuantity,
          isPaid: false,
          paymentStatus: "Unpaid",
        };
      });

      setAllReturns(prev => [...newRows, ...prev]);
      setReturns(prev => [...newRows, ...prev]);

      setSuccessMessage(`Return #${result.returnBillNumber} processed successfully!`);
      setTimeout(() => setSuccessMessage(null), 4000);
      
      setSelectedBill(null);
      setReturnItems([]);
      setReturnNote("");
      await fetchAllReturns();
      getStoreItems(true).then(setStoreItems); 
      
    } catch (error) {
      console.error("Error processing return:", error);
      setError(`Failed to process return: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Core Evaluate Filter Function ---
  const evaluateFilter = (itemValue, filterData, type = "string") => {
    if (!filterData) return true;
    const { operator, textValue, selectedValues } = filterData;
    
    if (selectedValues && selectedValues.length > 0) {
      if (!selectedValues.includes(String(itemValue))) return false;
    }

    if (operator && textValue !== "") {
      const valStr = String(itemValue || '').toLowerCase();
      const searchStr = String(textValue).toLowerCase();
      const valNum = Number(itemValue);
      const searchNum = Number(textValue);

      switch (operator) {
        case 'contains': return valStr.includes(searchStr);
        case 'equals': return type === 'number' ? valNum === searchNum : valStr === searchStr;
        case 'startsWith': return valStr.startsWith(searchStr);
        case 'endsWith': return valStr.endsWith(searchStr);
        case 'greaterThan': return valNum > searchNum;
        case 'lessThan': return valNum < searchNum;
        default: return true;
      }
    }
    return true;
  };

  // ==========================================
  // --- Return History Table Filters Logic ---
  // ==========================================
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

  const filteredSortedReturns = useMemo(() => {
    let filtered = returns.filter((returnItem) => {
      if (!returnItem) return false;
      
      if (filters.startDate && returnItem.returnDate) {
        if (new Date(returnItem.returnDate) < new Date(filters.startDate)) return false;
      }
      if (filters.endDate && returnItem.returnDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59);
        if (new Date(returnItem.returnDate) > endDate) return false;
      }
      if (filters.paymentStatus !== "all" && returnItem.paymentStatus !== filters.paymentStatus) return false;
      if (itemFilters.length > 0 && returnItem.name && !itemFilters.includes(returnItem.name)) return false;
      
      for (const [columnKey, filterData] of Object.entries(columnFilters)) {
        let itemValue = "";
        if (columnKey === 'companyName') itemValue = returnItem.companyName;
        if (columnKey === 'returnNumber') itemValue = returnItem.returnNumber || returnItem.id?.slice(-6);
        if (columnKey === 'returnDate') itemValue = formatDate(returnItem.returnDate);
        if (columnKey === 'billNumber') itemValue = returnItem.billNumber;
        if (columnKey === 'name') itemValue = returnItem.name;
        if (columnKey === 'barcode') itemValue = returnItem.barcode;
        if (columnKey === 'returnQuantity') itemValue = returnItem.returnQuantity;
        if (columnKey === 'currency') itemValue = returnItem.currency;
        if (columnKey === 'returnPrice') itemValue = returnItem.currency === "IQD" ? (returnItem.returnPriceIQD || returnItem.returnPrice || 0) : (returnItem.returnPriceUSD || returnItem.returnPrice || 0);
        if (columnKey === 'returnTotal') itemValue = (returnItem.currency === "IQD" ? (returnItem.returnPriceIQD || returnItem.returnPrice || 0) : (returnItem.returnPriceUSD || returnItem.returnPrice || 0)) * (returnItem.returnQuantity || 0);
        if (columnKey === 'expireDate') itemValue = returnItem.expireDate;
        if (columnKey === 'paymentStatus') itemValue = returnItem.paymentStatus;

        const isNum = ['returnQuantity', 'returnPrice', 'returnTotal'].includes(columnKey);
        if (!evaluateFilter(itemValue, filterData, isNum ? "number" : "string")) return false;
      }
      return true;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        if (sortConfig.key === 'returnTotal' || sortConfig.key === 'returnQuantity') {
          aVal = Number(aVal) || 0; bVal = Number(bVal) || 0;
        } else if (sortConfig.key === 'returnDate') {
          aVal = new Date(aVal); bVal = new Date(bVal);
        } else if (typeof aVal === 'string') {
          aVal = (aVal || '').toLowerCase(); bVal = (bVal || '').toLowerCase();
        }
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [returns, filters, itemFilters, columnFilters, sortConfig]);


  // ==========================================
  // --- Bought Bills Table Filters Logic ---
  // ==========================================
  const handleUpdateBillColumnFilter = (columnKey, updates) => {
    setBillColumnFilters(prev => {
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

  const handleBillSort = (key) => {
    let direction = 'asc';
    if (billSortConfig.key === key && billSortConfig.direction === 'asc') direction = 'desc';
    setBillSortConfig({ key, direction });
  };

  const getBillSortIcon = (key) => {
    if (billSortConfig.key !== key) return '↕';
    return billSortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Pre-process bills to calculate totals once for filtering and sorting
  const processedBoughtBills = useMemo(() => {
    return boughtBills.map(bill => {
      const billTotal = bill.currency === "IQD"
        ? (bill.items ? bill.items.reduce((sum, item) => sum + ((item.basePriceIQD || 0) * (item.quantity || 0)), 0) : 0)
        : (bill.items ? bill.items.reduce((sum, item) => sum + ((item.basePriceUSD || 0) * (item.quantity || 0)), 0) : 0);
      return { ...bill, billTotal };
    });
  }, [boughtBills]);

  const filteredSortedBills = useMemo(() => {
    let filtered = processedBoughtBills.filter((bill) => {
      if (!selectedCompany?.id || !bill) return false;
      if (bill.companyId !== selectedCompany.id) return false;

      // Multi-item search box filter
      if (billSearchText.trim()) {
        const searchTerms = billSearchText.split(',').map(term => term.trim().toLowerCase()).filter(Boolean);
        if (searchTerms.length > 0) {
          const billItems = bill.items || [];
          const hasMatchingItem = billItems.some(item => {
            const itemName = (item.name || "").toLowerCase();
            return searchTerms.some(term => itemName.includes(term));
          });
          if (!hasMatchingItem) return false;
        }
      }

      // Column Filters
      for (const [columnKey, filterData] of Object.entries(billColumnFilters)) {
        let itemValue = "";
        if (columnKey === 'billNumber') itemValue = bill.billNumber;
        if (columnKey === 'date') itemValue = formatDate(bill.date);
        if (columnKey === 'billTotal') itemValue = bill.billTotal;
        if (columnKey === 'currency') itemValue = bill.currency;
        if (columnKey === 'billNote') itemValue = bill.billNote;

        const isNum = ['billTotal'].includes(columnKey);
        if (!evaluateFilter(itemValue, filterData, isNum ? "number" : "string")) return false;
      }
      return true;
    });

    if (billSortConfig.key) {
      filtered.sort((a, b) => {
        let aVal = a[billSortConfig.key];
        let bVal = b[billSortConfig.key];
        
        if (billSortConfig.key === 'billTotal') {
          aVal = Number(aVal) || 0; bVal = Number(bVal) || 0;
        } else if (billSortConfig.key === 'date') {
          aVal = new Date(a.date); bVal = new Date(b.date);
        } else if (typeof aVal === 'string') {
          aVal = (aVal || '').toLowerCase(); bVal = (bVal || '').toLowerCase();
        }
        
        if (aVal < bVal) return billSortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return billSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [processedBoughtBills, selectedCompany, billSearchText, billColumnFilters, billSortConfig]);


  const exportToExcel = () => {
    const exportData = filteredSortedReturns.map(returnItem => ({
      'Company': returnItem.companyName || 'N/A',
      'Return #': returnItem.returnNumber || returnItem.id?.slice(-6) || 'N/A',
      'Return Date': formatDate(returnItem.returnDate),
      'Bill #': returnItem.billNumber || 'N/A',
      'Item Name': returnItem.name || 'N/A',
      'Barcode': returnItem.barcode || 'N/A',
      'Return Quantity': returnItem.returnQuantity || 0,
      'Currency': returnItem.currency || 'USD',
      'Return Price': `${getCurrencySymbol(returnItem.currency)} ${formatCurrency(returnItem.currency === "IQD" ? (returnItem.returnPriceIQD || returnItem.returnPrice || 0) : (returnItem.returnPriceUSD || returnItem.returnPrice || 0), returnItem.currency)}`,
      'Total': `${getCurrencySymbol(returnItem.currency)} ${formatCurrency((returnItem.currency === "IQD" ? (returnItem.returnPriceIQD || returnItem.returnPrice || 0) : (returnItem.returnPriceUSD || returnItem.returnPrice || 0)) * (returnItem.returnQuantity || 0), returnItem.currency)}`,
      'Expire Date': returnItem.expireDate || 'N/A',
      'Note': returnItem.returnNote || '-',
      'Payment Status': returnItem.paymentStatus
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bought Returns');
    XLSX.writeFile(wb, `bought_returns_${formatDate(new Date())}.xlsx`);
  };

  const handleInputFocus = (e) => e.target.select();


  // ==========================================
  // --- UI Filter Components ---
  // ==========================================
  const ExcelFilterDropdown = ({ columnKey, type = "string" }) => {
    const [search, setSearch] = useState("");
    const isOpen = activeFilterDropdown === columnKey;
    const operators = type === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;
    
    const filterState = columnFilters[columnKey] || { operator: operators[0].value, textValue: '', selectedValues: [] };
    const { operator, textValue, selectedValues } = filterState;

    const uniqueValues = useMemo(() => {
      const vals = new Set();
      returns.forEach(returnItem => {
        let val = "";
        if (columnKey === 'companyName') val = returnItem.companyName;
        if (columnKey === 'returnNumber') val = returnItem.returnNumber || returnItem.id?.slice(-6);
        if (columnKey === 'returnDate') val = formatDate(returnItem.returnDate);
        if (columnKey === 'billNumber') val = returnItem.billNumber;
        if (columnKey === 'name') val = returnItem.name;
        if (columnKey === 'barcode') val = returnItem.barcode;
        if (columnKey === 'returnQuantity') val = returnItem.returnQuantity;
        if (columnKey === 'currency') val = returnItem.currency;
        if (columnKey === 'returnPrice') val = returnItem.currency === "IQD" ? (returnItem.returnPriceIQD || returnItem.returnPrice || 0) : (returnItem.returnPriceUSD || returnItem.returnPrice || 0);
        if (columnKey === 'returnTotal') val = (returnItem.currency === "IQD" ? (returnItem.returnPriceIQD || returnItem.returnPrice || 0) : (returnItem.returnPriceUSD || returnItem.returnPrice || 0)) * (returnItem.returnQuantity || 0);
        if (columnKey === 'expireDate') val = returnItem.expireDate;
        if (columnKey === 'paymentStatus') val = returnItem.paymentStatus;
        vals.add(String(val || ""));
      });
      return Array.from(vals).sort();
    }, [returns, columnKey]);

    const displayValues = uniqueValues.filter(v => v.toLowerCase().includes(search.toLowerCase()));
    const isActive = !!(textValue || (selectedValues && selectedValues.length > 0));

    return (
      <div className="filter-dropdown-container" style={{ position: "relative", display: "inline-block" }}>
        <div 
          onClick={(e) => { e.stopPropagation(); setActiveFilterDropdown(isOpen ? null : columnKey); setActiveBillFilterDropdown(null); }}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "0.25rem", borderRadius: "0.375rem", background: isActive ? "#dbeafe" : "transparent", color: isActive ? "#2563eb" : "#94a3b8" }}
        >
          <Filter size={14} />
        </div>

        {isOpen && (
          <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "0.5rem", background: "white", border: "1px solid #cbd5e1", borderRadius: "0.5rem", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)", zIndex: 9999, width: "240px", display: "flex", flexDirection: "column", cursor: "default", overflow: "hidden", color: "#2c3e50" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>Condition</p>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <select 
                  value={operator || operators[0].value} 
                  onChange={(e) => handleUpdateColumnFilter(columnKey, { operator: e.target.value })}
                  style={{ width: "100%", padding: "0.4rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.875rem", outline: "none", background: "white" }}
                >
                  {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                {operator !== 'isEmpty' && operator !== 'isNotEmpty' && (
                  <input 
                    type={type === "number" ? "number" : "text"} 
                    placeholder="Value..." 
                    value={textValue || ""} 
                    onChange={(e) => handleUpdateColumnFilter(columnKey, { textValue: e.target.value })}
                    style={{ width: "100%", padding: "0.4rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.875rem", outline: "none", boxSizing: "border-box", marginTop: "0.5rem" }}
                  />
                )}
              </div>
            </div>
            
            <div style={{ padding: "0.75rem", flex: 1 }}>
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>Values</p>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: "0.375rem", padding: "0.25rem 0.5rem", marginBottom: "0.5rem" }}>
                <Search size={14} color="#94a3b8" />
                <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ border: "none", outline: "none", width: "100%", fontSize: "0.875rem", marginLeft: "0.5rem" }} />
              </div>
              <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", padding: "0.25rem", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                  <input type="checkbox" checked={selectedValues.length === uniqueValues.length && uniqueValues.length > 0} onChange={(e) => handleUpdateColumnFilter(columnKey, { selectedValues: e.target.checked ? [...uniqueValues] : [] })} style={{ cursor: "pointer", width: "1rem", height: "1rem", accentColor: "#2563eb" }}/>
                  <span>(Select All)</span>
                </label>
                {displayValues.map(val => (
                  <label key={val} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", padding: "0.25rem", cursor: "pointer", color: "#1e293b" }}>
                    <input type="checkbox" checked={selectedValues.includes(val)} onChange={(e) => {
                      const updated = e.target.checked ? [...selectedValues, val] : selectedValues.filter(v => v !== val);
                      handleUpdateColumnFilter(columnKey, { selectedValues: updated });
                    }} style={{ cursor: "pointer", width: "1rem", height: "1rem", accentColor: "#2563eb" }}/>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val === "" ? "(Blank)" : val}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", padding: "0.75rem", backgroundColor: "#f8fafc" }}>
              <button onClick={() => { const u = {...columnFilters}; delete u[columnKey]; setColumnFilters(u); }} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: "0.875rem", cursor: "pointer", fontWeight: 600 }}>Clear</button>
              <button onClick={() => setActiveFilterDropdown(null)} style={{ background: "#2563eb", border: "none", color: "white", fontSize: "0.875rem", padding: "0.4rem 1rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600 }}>Apply</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const TableHeader = ({ title, columnKey, type = "string" }) => (
    <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "#475569", background: "#f8fafc", borderBottom: "2px solid #e2e8f0", borderRight: "1px solid #e2e8f0", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 5 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
        <div onClick={() => handleSort(columnKey)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", flex: 1 }}>
          {title} <span style={{ fontSize: "11px", color: "#94a3b8" }}>{getSortIcon(columnKey)}</span>
        </div>
        <ExcelFilterDropdown columnKey={columnKey} type={type} />
      </div>
    </th>
  );

  // Filter component specifically for the "Create New Bought Return" table
  const BillExcelFilterDropdown = ({ columnKey, type = "string" }) => {
    const [search, setSearch] = useState("");
    const isOpen = activeBillFilterDropdown === columnKey;
    const operators = type === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;
    
    const filterState = billColumnFilters[columnKey] || { operator: operators[0].value, textValue: '', selectedValues: [] };
    const { operator, textValue, selectedValues } = filterState;

    const uniqueValues = useMemo(() => {
      const vals = new Set();
      // Only process unique values for the currently selected company
      processedBoughtBills.filter(b => b.companyId === selectedCompany?.id).forEach(bill => {
        let val = "";
        if (columnKey === 'billNumber') val = bill.billNumber;
        if (columnKey === 'date') val = formatDate(bill.date);
        if (columnKey === 'billTotal') val = bill.billTotal;
        if (columnKey === 'currency') val = bill.currency;
        if (columnKey === 'billNote') val = bill.billNote;
        vals.add(String(val || ""));
      });
      return Array.from(vals).sort();
    }, [processedBoughtBills, selectedCompany, columnKey]);

    const displayValues = uniqueValues.filter(v => v.toLowerCase().includes(search.toLowerCase()));
    const isActive = !!(textValue || (selectedValues && selectedValues.length > 0));

    return (
      <div className="filter-dropdown-container" style={{ position: "relative", display: "inline-block" }}>
        <div 
          onClick={(e) => { e.stopPropagation(); setActiveBillFilterDropdown(isOpen ? null : columnKey); setActiveFilterDropdown(null); }}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "0.25rem", borderRadius: "0.375rem", background: isActive ? "#dbeafe" : "transparent", color: isActive ? "#2563eb" : "#94a3b8" }}
        >
          <Filter size={14} />
        </div>

        {isOpen && (
          <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "0.5rem", background: "white", border: "1px solid #cbd5e1", borderRadius: "0.5rem", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)", zIndex: 9999, width: "240px", display: "flex", flexDirection: "column", cursor: "default", overflow: "hidden", color: "#2c3e50" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>Condition</p>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <select 
                  value={operator || operators[0].value} 
                  onChange={(e) => handleUpdateBillColumnFilter(columnKey, { operator: e.target.value })}
                  style={{ width: "100%", padding: "0.4rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.875rem", outline: "none", background: "white" }}
                >
                  {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                {operator !== 'isEmpty' && operator !== 'isNotEmpty' && (
                  <input 
                    type={type === "number" ? "number" : "text"} 
                    placeholder="Value..." 
                    value={textValue || ""} 
                    onChange={(e) => handleUpdateBillColumnFilter(columnKey, { textValue: e.target.value })}
                    style={{ width: "100%", padding: "0.4rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.875rem", outline: "none", boxSizing: "border-box", marginTop: "0.5rem" }}
                  />
                )}
              </div>
            </div>
            
            <div style={{ padding: "0.75rem", flex: 1 }}>
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>Values</p>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: "0.375rem", padding: "0.25rem 0.5rem", marginBottom: "0.5rem" }}>
                <Search size={14} color="#94a3b8" />
                <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ border: "none", outline: "none", width: "100%", fontSize: "0.875rem", marginLeft: "0.5rem" }} />
              </div>
              <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", padding: "0.25rem", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                  <input type="checkbox" checked={selectedValues.length === uniqueValues.length && uniqueValues.length > 0} onChange={(e) => handleUpdateBillColumnFilter(columnKey, { selectedValues: e.target.checked ? [...uniqueValues] : [] })} style={{ cursor: "pointer", width: "1rem", height: "1rem", accentColor: "#2563eb" }}/>
                  <span>(Select All)</span>
                </label>
                {displayValues.map(val => (
                  <label key={val} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", padding: "0.25rem", cursor: "pointer", color: "#1e293b" }}>
                    <input type="checkbox" checked={selectedValues.includes(val)} onChange={(e) => {
                      const updated = e.target.checked ? [...selectedValues, val] : selectedValues.filter(v => v !== val);
                      handleUpdateBillColumnFilter(columnKey, { selectedValues: updated });
                    }} style={{ cursor: "pointer", width: "1rem", height: "1rem", accentColor: "#2563eb" }}/>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val === "" ? "(Blank)" : val}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", padding: "0.75rem", backgroundColor: "#f8fafc" }}>
              <button onClick={() => { const u = {...billColumnFilters}; delete u[columnKey]; setBillColumnFilters(u); }} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: "0.875rem", cursor: "pointer", fontWeight: 600 }}>Clear</button>
              <button onClick={() => setActiveBillFilterDropdown(null)} style={{ background: "#2563eb", border: "none", color: "white", fontSize: "0.875rem", padding: "0.4rem 1rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600 }}>Apply</button>
            </div>
          </div>
        )}
      </div>
    );
  };

const BillTableHeader = ({ title, columnKey, type = "string", width }) => (
    <th style={{ 
      padding: "0.75rem 1rem", 
      textAlign: "left", 
      fontSize: "0.75rem", 
      fontWeight: "600", 
      textTransform: "uppercase", 
      letterSpacing: "0.05em", 
      color: "#475569", 
      background: "#f8fafc", 
      borderBottom: "2px solid #e2e8f0", 
      borderRight: "1px solid #e2e8f0", 
      whiteSpace: "nowrap",
      width: width || "auto" // <--- ADD THIS LINE
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
        <div onClick={() => handleBillSort(columnKey)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", flex: 1 }}>
          {title} <span style={{ fontSize: "11px", color: "#94a3b8" }}>{getBillSortIcon(columnKey)}</span>
        </div>
        <BillExcelFilterDropdown columnKey={columnKey} type={type} />
      </div>
    </th>
  );

  const PaymentStatusBadge = ({ status }) => {
    let style = {};
    if (status === "Paid") style = styles.badgePaid;
    else if (status === "Unpaid") style = styles.badgeUnpaid;
    else style = styles.badgeProcessed;
    return (
      <span style={{ ...styles.badge, ...style }}>
        {status === "Paid" ? "✓" : status === "Unpaid" ? "⏳" : "🔄"} {status}
      </span>
    );
  };

  const itemOptions = availableItems.map((item) => ({
    value: item,
    label: item,
  }));

  if (isLoading && returns.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.wrapper}>
          <div style={styles.header}>
            <div>
              <h1 style={styles.headerTitle}>📦 Bought Return History</h1>
              <p style={styles.headerSubtitle}>Manage product returns from suppliers</p>
            </div>
          </div>
          <div style={{...styles.mainCard, textAlign: "center", padding: "3rem"}}>
            <div style={{ display: "inline-block", width: "48px", height: "48px", border: "3px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
            <p style={{ marginTop: "1rem", color: "#64748b" }}>Loading return history...</p>
          </div>
        </div>
        <style dangerouslySetInnerHTML={{__html: `@keyframes spin { to { transform: rotate(360deg); } }`}} />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.3s ease-out; }
        .hover-row:hover { background: #f8fafc !important; }
        .hover-button:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0,0,0,0.15) !important; }
        .hover-button:active { transform: translateY(0px); }
        .input-focus:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15) !important; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        .scrollable-table { overflow-x: auto; border-radius: 12px; width: 100%; box-sizing: border-box; }
        .scrollable-table::-webkit-scrollbar { height: 8px; }
        .scrollable-table::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .scrollable-table::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .scrollable-table::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />

      <div style={styles.wrapper}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.headerTitle}>📦 Bought Return History</h1>
            <p style={styles.headerSubtitle}>Manage product returns from suppliers</p>
          </div>
          <button onClick={exportToExcel} style={styles.buttonExport} className="hover-button">
            📊 Export to Excel
          </button>
        </div>

        {error && <div style={styles.alertError} className="fade-in">⚠️ {error}</div>}
        {successMessage && <div style={styles.alertSuccess} className="fade-in">✅ {successMessage}</div>}

        <div style={styles.mainCard}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardHeaderTitle}>🔍 Filter Returns</h3>
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
              Total: {filteredSortedReturns.length} {filteredSortedReturns.length === 1 ? 'return' : 'returns'}
            </span>
          </div>
          <div style={styles.cardBody}>
            <div style={styles.filterGrid}>
              <div style={styles.filterItem}>
                <label style={styles.label}>Company</label>
                <Select
                  options={companies.map((c) => ({ value: c, label: c.name }))}
                  onChange={handleCompanySelect}
                  value={companySelectValue}
                  placeholder="All Companies"
                  isSearchable
                  isClearable
                  styles={{ control: (base) => ({ ...base, borderRadius: '10px', borderColor: '#e2e8f0', boxShadow: 'none', '&:hover': { borderColor: '#6366f1' }}) }}
                />
              </div>

              <div style={styles.filterItem}>
                <label style={styles.label}>Payment Status</label>
                <select style={styles.input} value={filters.paymentStatus} onChange={(e) => handleFilterChange("paymentStatus", e.target.value)} className="input-focus">
                  <option value="all">All Status</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </div>

              <div style={styles.filterItem}>
                <label style={styles.label}>Start Date</label>
                <input type="date" style={styles.input} value={filters.startDate} onChange={(e) => handleFilterChange("startDate", e.target.value)} className="input-focus" />
              </div>

              <div style={styles.filterItem}>
                <label style={styles.label}>End Date</label>
                <input type="date" style={styles.input} value={filters.endDate} onChange={(e) => handleFilterChange("endDate", e.target.value)} className="input-focus" />
              </div>
            </div>

            <div style={styles.filterBox}>
              <div style={styles.flexBetween}>
                <span style={{ fontWeight: "600", color: "#1e293b" }}>🏷️ Filter by Items:</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Applies to both history and new return sections</span>
              </div>
              <Select
                isMulti
                options={itemOptions}
                onChange={(selected) => setItemFilters(selected ? selected.map((option) => option.value) : [])}
                placeholder="Select items to filter..."
                styles={{ control: (base) => ({ ...base, borderRadius: '10px', borderColor: '#e2e8f0', marginTop: '0.5rem' }) }}
              />
            </div>

            <div style={styles.sectionTitle}>
              📋 Return History
              <span style={{ marginLeft: "auto", fontSize: "0.85rem", color: "#94a3b8" }}>Click column headers to sort</span>
            </div>

            <div style={styles.tableContainer}>
              <div className="scrollable-table" style={{ minHeight: "450px", maxHeight: "60vh", overflowY: "auto", overflowX: "auto" }}>
                <table style={styles.table}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                    <tr>
                      <TableHeader title="Company" columnKey="companyName" />
                      <TableHeader title="Return #" columnKey="returnNumber" />
                      <TableHeader title="Date" columnKey="returnDate" />
                      <TableHeader title="Bill #" columnKey="billNumber" />
                      <TableHeader title="Item" columnKey="name" />
                      <TableHeader title="Barcode" columnKey="barcode" />
                      <TableHeader title="Qty" columnKey="returnQuantity" type="number" />
                      <TableHeader title="Currency" columnKey="currency" />
                      <TableHeader title="Price" columnKey="returnPrice" type="number" />
                      <TableHeader title="Total" columnKey="returnTotal" type="number" />
                      <TableHeader title="Expiry" columnKey="expireDate" />
                      <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", color: "#475569", background: "#f8fafc", borderBottom: "2px solid #e2e8f0", borderRight: "1px solid #e2e8f0", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 5 }}>Note</th>
                      <TableHeader title="Status" columnKey="paymentStatus" />
                      <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", color: "#475569", background: "#f8fafc", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 5 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSortedReturns.length > 0 ? (
                      filteredSortedReturns.map((returnItem, index) => {
                        const returnPriceValue = returnItem.currency === "IQD" 
                          ? (returnItem.returnPriceIQD || returnItem.returnPrice || 0)
                          : (returnItem.returnPriceUSD || returnItem.returnPrice || 0);
                        const itemTotal = returnPriceValue * (returnItem.returnQuantity || 0);
                        
                        return (
                          <tr key={`${returnItem.id}-${index}`} className="hover-row" style={{ background: index % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                            <td style={styles.td}>
                              <div style={{ fontWeight: "600", color: "#1e293b" }}>{returnItem.companyName || 'N/A'}</div>
                              <div style={styles.companyCode}>Code: {returnItem.companyCode || 'N/A'}</div>
                            </td>
                            <td style={{...styles.td, ...styles.returnNumber}}>{returnItem.returnNumber || returnItem.id?.slice(-6) || 'N/A'}</td>
                            <td style={styles.td}>{formatDate(returnItem.returnDate)}</td>
                            <td style={styles.td}>
                              <span style={{ background: "#f1f5f9", padding: "0.2rem 0.6rem", borderRadius: "6px", fontSize: "0.8rem" }}>
                                {returnItem.billNumber || 'N/A'}
                              </span>
                            </td>
                            <td style={{...styles.td, fontWeight: "500", whiteSpace: "normal", wordBreak: "break-word"}}>{returnItem.name || 'N/A'}</td>
                            <td style={styles.td}>
                              <code style={{ background: "#f1f5f9", padding: "0.2rem 0.4rem", borderRadius: "4px", fontSize: "0.75rem" }}>
                                {returnItem.barcode || 'N/A'}
                              </code>
                            </td>
                            <td style={styles.td}>
                              <span style={styles.quantityBadge}>{returnItem.returnQuantity || 0}</span>
                            </td>
                            <td style={styles.td}>
                              <span style={{ background: returnItem.currency === "IQD" ? "#fef3c7" : "#dbeafe", padding: "0.2rem 0.6rem", borderRadius: "12px", fontSize: "0.75rem", color: returnItem.currency === "IQD" ? "#d97706" : "#2563eb" }}>
                                {returnItem.currency || "USD"}
                              </span>
                            </td>
                            <td style={{...styles.td, color: getCurrencyColor(returnItem.currency), fontWeight: "600"}}>
                              {getCurrencySymbol(returnItem.currency)}{formatCurrency(returnPriceValue, returnItem.currency)}
                            </td>
                            <td style={{...styles.td, color: getCurrencyColor(returnItem.currency), fontWeight: "700"}}>
                              {getCurrencySymbol(returnItem.currency)}{formatCurrency(itemTotal, returnItem.currency)}
                            </td>
                            <td style={styles.td}>
                              <span style={{ background: returnItem.expireDate === 'N/A' ? '#f1f5f9' : '#fef9c3', padding: "0.2rem 0.6rem", borderRadius: "12px", fontSize: "0.75rem", color: returnItem.expireDate === 'N/A' ? '#94a3b8' : '#854d0e' }}>
                                {returnItem.expireDate || 'N/A'}
                              </span>
                            </td>
                            <td style={{...styles.td, maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                              <span title={returnItem.returnNote}>
                                {returnItem.returnNote ? returnItem.returnNote.substring(0, 30) + (returnItem.returnNote.length > 30 ? '...' : '') : '-'}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <PaymentStatusBadge status={returnItem.paymentStatus} />
                            </td>
                            <td style={styles.td}>
                              {returnItem.paymentStatus === "Unpaid" ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                  <button style={styles.buttonPrimary} className="hover-button" onClick={() => handleEditReturn(returnItem)}>✏️ Edit</button>
                                  <button style={styles.buttonDanger} className="hover-button" onClick={() => handleDeleteReturnItem(returnItem)}>🗑️ Delete</button>
                                </div>
                              ) : <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "0.8rem" }}>Locked</span>}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="14" style={styles.emptyState}>
                          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📦</div>
                          <p style={{ fontSize: "1.1rem", fontWeight: "500", color: "#64748b" }}>No returns found</p>
                          <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginTop: "0.25rem" }}>Try adjusting your filters</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Edit Modal */}
            {editingReturn && (
              <div style={styles.modal} onClick={(e) => { if (e.target === e.currentTarget) handleCancelEdit(); }}>
                <div style={styles.modalContent} className="fade-in">
                  <div style={styles.modalHeader}>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                      ✏️ Edit Return Item
                    </h3>
                    <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                      Return #{editingReturn.returnNumber || editingReturn.id?.slice(-6)}
                    </p>
                  </div>
                  <div style={styles.modalBody}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div>
                        <label style={styles.label}>Barcode</label>
                        <input type="text" value={editingReturn.barcode || ''} disabled style={{...styles.input, background: "#f1f5f9"}} />
                      </div>
                      <div>
                        <label style={styles.label}>Item Name</label>
                        <input type="text" value={editingReturn.name || ''} disabled style={{...styles.input, background: "#f1f5f9"}} />
                      </div>
                      <div>
                        <label style={styles.label}>Return Quantity</label>
                        <input 
                          type="number" min="1" max={maxEditQty} inputMode="numeric" pattern="[0-9]*"
                          value={editItems[0]?.returnQuantity || 0} 
                          onChange={(e) => handleEditQuantityChange(e.target.value)} 
                          style={styles.input} className="input-focus" onFocus={handleInputFocus}
                        />
                        <span style={{ fontSize: "0.75rem", color: "#e74c3c", display: "block", marginTop: "4px" }}>Max Allowed: {maxEditQty}</span>
                      </div>
                      <div>
                        <label style={styles.label}>Return Price ({getCurrencySymbol(editingReturn.currency)})</label>
                        <input 
                          type="number" min="0.01" step={editingReturn.currency === "IQD" ? "100" : "0.01"} inputMode="decimal"
                          value={editItems[0]?.returnPriceValue || 0} 
                          onChange={(e) => handleEditPriceChange(e.target.value)} 
                          style={styles.input} className="input-focus" onFocus={handleInputFocus}
                        />
                      </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <label style={styles.label}>Return Note</label>
                        <textarea 
                          value={editNote} onChange={(e) => setEditNote(e.target.value)} rows="2" 
                          style={{...styles.input, resize: "vertical"}} className="input-focus" placeholder="Add a note..." 
                        />
                      </div>
                    </div>
                    {editingReturn.currency === "IQD" && (
                      <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", background: "#fef3c7", borderRadius: "8px", color: "#d97706", fontSize: "0.8rem" }}>
                        ⚠️ Price is in Iraqi Dinar (IQD)
                      </div>
                    )}
                  </div>
                  <div style={styles.modalFooter}>
                    <button onClick={handleCancelEdit} style={{...styles.buttonPrimary, background: "#94a3b8", boxShadow: "none"}} className="hover-button">Cancel</button>
                    <button onClick={handleSubmitEdit} style={styles.buttonSuccess} className="hover-button">✅ Update Return</button>
                  </div>
                </div>
              </div>
            )}

            {/* Create New Return Section */}
            {selectedCompany?.id && (
              <div style={styles.createSection}>
                <div style={styles.sectionTitle}>
                  ➕ Create New Bought Return
                  <span style={{ marginLeft: "auto", fontSize: "0.85rem", color: "#64748b" }}>
                    {selectedCompany.name}
                  </span>
                </div>

                <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem", alignItems: "center" }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                    <input 
                      type="text" 
                      placeholder="Search by item name"
                      value={billSearchText}
                      onChange={(e) => setBillSearchText(e.target.value)}
                      style={{
                        ...styles.input,
                        paddingLeft: "36px",
                        background: "white"
                      }}
                      className="input-focus"
                    />
                  </div>
                </div>

                <div style={styles.tableContainer}>
                  <div className="scrollable-table" style={{ maxHeight: "400px", overflowY: "auto" }}>
                    <table style={styles.table}>
                      <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                        <tr>
                          <BillTableHeader title="Bill #" columnKey="billNumber" />
                          <BillTableHeader title="Date" columnKey="date" />
                          <BillTableHeader title="Total Amount" columnKey="billTotal" type="number" />
                          <BillTableHeader title="Currency" columnKey="currency" />
                          <BillTableHeader title="Bill Note" columnKey="billNote" />
                          <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", color: "#475569", background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSortedBills.length > 0 ? (
                          filteredSortedBills.map((bill) => {
                            return (
                              <React.Fragment key={bill.id || bill.billNumber}>
                                <tr 
                                  className="hover-row" 
                                  style={{ 
                                    ...styles.billSelectRow,
                                    background: selectedBill?.id === bill.id ? '#eef2ff' : '#ffffff',
                                    borderLeft: selectedBill?.id === bill.id ? '4px solid #6366f1' : '4px solid transparent',
                                  }}
                                  onClick={() => handleBillSelect(bill)}
                                >
                                  <td style={{...styles.td, fontWeight: "600", color: "#6366f1"}}>
                                    #{bill.billNumber || 'N/A'}
                                  </td>
                                  <td style={styles.td}>{formatDate(bill.date)}</td>
                                  <td style={{...styles.td, color: getCurrencyColor(bill.currency), fontWeight: "600"}}>
                                    {getCurrencySymbol(bill.currency)}{formatCurrency(bill.billTotal, bill.currency)}
                                  </td>
                                  <td style={styles.td}>
                                    <span style={{ background: bill.currency === "IQD" ? "#fef3c7" : "#dbeafe", padding: "0.2rem 0.6rem", borderRadius: "12px", fontSize: "0.75rem", color: bill.currency === "IQD" ? "#d97706" : "#2563eb" }}>
                                      {bill.currency || "USD"}
                                    </span>
                                  </td>
                                  <td style={styles.td}>{bill.billNote || 'No notes'}</td>
                                  <td style={styles.td}>
                                    <button 
                                      style={{
                                        ...styles.buttonPrimary,
                                        ...(selectedBill?.id === bill.id ? { background: "#94a3b8" } : {})
                                      }}
                                      className="hover-button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleBillSelect(bill);
                                      }}
                                    >
                                      {selectedBill?.id === bill.id ? 'Close' : 'Select'}
                                    </button>
                                  </td>
                                </tr>

                                {selectedBill?.id === bill.id && (
                                  <tr>
                                    <td colSpan="6" style={{ padding: 0 }}>
                                      <div style={styles.detailsPanel} className="fade-in">
                                        <div style={{ marginBottom: "0.75rem" }}>
                                          <label style={styles.label}>Return Note (Optional)</label>
                                          <textarea 
                                            value={returnNote} 
                                            onChange={(e) => setReturnNote(e.target.value)} 
                                            style={{...styles.input, resize: "vertical"}} 
                                            rows="2" 
                                            className="input-focus"
                                            placeholder="Add a note for this return..."
                                          />
                                        </div>

                                        <div style={{ overflowX: "auto" }}>
                                          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "100%" }}>
                                            <thead style={{ background: "#dbeafe" }}>
                                              <tr>
                                                <th style={{ padding: "0.5rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "left" }}>Item</th>
                                                <th style={{ padding: "0.5rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Original</th>
                                                <th style={{ padding: "0.5rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Returned</th>
                                                <th style={{ padding: "0.5rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Sold</th>
                                                <th style={{ padding: "0.5rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Available</th>
                                                <th style={{ padding: "0.5rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Return Qty</th>
                                                <th style={{ padding: "0.5rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Price ({getCurrencySymbol(bill.currency)})</th>
                                                <th style={{ padding: "0.5rem", fontSize: "0.75rem", fontWeight: "600", color: "#1e3a8a", textAlign: "center" }}>Total</th>
                                              </tr>
                                            </thead>
                                            <tbody style={{ background: "#ffffff" }}>
                                              {returnItems.map((item, index) => {
                                                const itemTotal = calculateItemTotal(item);
                                                const itemCurrency = getItemCurrency(item);
                                                
                                                return (
                                                  <tr key={index} className="hover-row">
                                                    <td style={{ padding: "0.5rem", fontSize: "0.85rem" }}>
                                                      <div style={{ fontWeight: "500" }}>{item.name || 'N/A'}</div>
                                                      <code style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{item.barcode}</code>
                                                    </td>
                                                    <td style={{ padding: "0.5rem", textAlign: "center" }}>
                                                      <span style={{ background: "#e0f2fe", padding: "0.2rem 0.6rem", borderRadius: "12px", fontSize: "0.8rem" }}>
                                                        {item.originalQuantity || 0}
                                                      </span>
                                                    </td>
                                                    <td style={{ padding: "0.5rem", textAlign: "center" }}>
                                                      <span style={{ background: "#fee2e2", padding: "0.2rem 0.6rem", borderRadius: "12px", fontSize: "0.8rem", color: "#b91c1c" }}>
                                                        {item.previouslyReturned || 0}
                                                      </span>
                                                    </td>
                                                    <td style={{ padding: "0.5rem", textAlign: "center" }}>
                                                      <span style={{ background: "#ede9fe", padding: "0.2rem 0.6rem", borderRadius: "12px", fontSize: "0.8rem", color: "#6d28d9" }}>
                                                        {item.soldQuantity || 0}
                                                      </span>
                                                    </td>
                                                    <td style={{ padding: "0.5rem", textAlign: "center" }}>
                                                      <span style={{ background: "#dcfce7", padding: "0.2rem 0.6rem", borderRadius: "12px", fontSize: "0.8rem", color: "#166534", fontWeight: "600" }}>
                                                        {item.availableQuantity || 0}
                                                      </span>
                                                    </td>
                                                    <td style={{ padding: "0.5rem", textAlign: "center" }}>
                                                      <input 
                                                        type="number" 
                                                        min="0" 
                                                        max={item.availableQuantity || 0} 
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        value={item.returnQuantity || 0} 
                                                        onChange={(e) => handleReturnQuantityChange(index, e.target.value)} 
                                                        style={styles.inputSmall} 
                                                        className="input-focus"
                                                        onFocus={handleInputFocus}
                                                      />
                                                    </td>
                                                    <td style={{ padding: "0.5rem", textAlign: "center" }}>
                                                      <input 
                                                        type="number" 
                                                        min="0.01" 
                                                        step={itemCurrency === "IQD" ? "100" : "0.01"} 
                                                        inputMode="decimal"
                                                        value={item.returnPrice || 0} 
                                                        onChange={(e) => handleReturnPriceChange(index, e.target.value)} 
                                                        style={styles.inputPrice} 
                                                        className="input-focus"
                                                        onFocus={handleInputFocus}
                                                      />
                                                    </td>
                                                    <td style={{ padding: "0.5rem", textAlign: "center", fontWeight: "700", color: getCurrencyColor(itemCurrency) }}>
                                                      {getCurrencySymbol(itemCurrency)}{formatCurrency(itemTotal, itemCurrency)}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                            <tfoot style={{ background: "#dbeafe", fontWeight: "bold" }}>
                                              <tr>
                                                <td colSpan="7" style={{ padding: "0.5rem", textAlign: "right", fontSize: "0.9rem" }}>
                                                  Grand Total ({getCurrencySymbol(getGrandTotalCurrency())}):
                                                </td>
                                                <td style={{ padding: "0.5rem", textAlign: "center", fontSize: "1rem", color: getCurrencyColor(getGrandTotalCurrency()) }}>
                                                  {getCurrencySymbol(getGrandTotalCurrency())}{formatCurrency(calculateGrandTotal(), getGrandTotalCurrency())}
                                                </td>
                                              </tr>
                                            </tfoot>
                                          </table>
                                        </div>

                                        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
                                          <button 
                                            style={{
                                              ...styles.buttonSuccess,
                                              ...(isSubmitting ? styles.buttonSuccessDisabled : {})
                                            }}
                                            className="hover-button" 
                                            onClick={handleSubmitReturn}
                                            disabled={isSubmitting || returnItems.filter(i => i.returnQuantity > 0).length === 0}
                                          >
                                            {isSubmitting ? (
                                              <>
                                                <span style={styles.loadingSpinner} />
                                                Processing...
                                              </>
                                            ) : (
                                              `✅ Submit Return (${getCurrencySymbol(getGrandTotalCurrency())}${formatCurrency(calculateGrandTotal(), getGrandTotalCurrency())})`
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="6" style={styles.emptyState}>
                              <div style={styles.emptyStateIcon}>💳</div>
                              <p style={{ fontSize: "1rem", fontWeight: "500", color: "#64748b" }}>No bills found for this company</p>
                              <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                                {selectedCompany ? `No purchase bills available for ${selectedCompany.name}` : 'Please select a company'}
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}