"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  createBoughtPayment,
  getCompanies,
  getCompanyBoughtBills,
  getReturnsForCompany,
  getBoughtPaymentDetails,
  updateBoughtPayment,
  getBoughtPayments,
  getBoughtBills,
} from "@/lib/data";
import Select from "react-select";

export default function BoughtPaymentManagementPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [boughtBills, setBoughtBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [selectedBoughtBills, setSelectedBoughtBills] = useState([]);
  const [selectedBoughtReturns, setSelectedBoughtReturns] = useState([]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [hardcopyBillNumber, setHardcopyBillNumber] = useState("");
  const [hardcopyBillError, setHardcopyBillError] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editPaymentId, setEditPaymentId] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  
  // ✅ FIXED: Restored missing filters state
  const [filters, setFilters] = useState({
    paymentStatus: "all",
    startDate: "",
    endDate: ""
  });

  const [advancedSearch, setAdvancedSearch] = useState({
    companyName: "",
    hardcopyBillNumber: "",
    boughtBillNumber: "",
    returnBillNumber: "",
    paymentNumber: "",
    dateFrom: "",
    dateTo: "",
    amountMinUSD: "",
    amountMaxUSD: "",
    amountMinIQD: "",
    amountMaxIQD: "",
  });
  
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // IMAGE STATE
  const [billImageData, setBillImageData] = useState(null);
  const [originalImageData, setOriginalImageData] = useState(null);
  const [imageHasChanged, setImageHasChanged] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [currencyTotals, setCurrencyTotals] = useState({ boughtUSD: 0, boughtIQD: 0, returnUSD: 0, returnIQD: 0, netUSD: 0, netIQD: 0 });
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [printLoading, setPrintLoading] = useState(false);
  const [consignmentWarnings, setConsignmentWarnings] = useState([]);

  const hardcopyBillNumberRef = useRef(null);
  const companyDropdownRef = useRef(null);

  const colorScheme = {
    primary: "#8B5CF6",
    secondary: "#06B6D4",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    dark: "#7C3AED",
    light: "#A78BFA",
    background: "#F8FAFC",
    card: "#FFFFFF",
    text: "#1F2937",
    textLight: "#6B7280",
  };

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else {
      setIsLoading(false);
    }
  }, [user, router]);

  const formatDateToDMY = (date) => {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateToYMD = (date) => {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  };

  // ✅ FIXED: Restored missing handleFilterChange function
  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const generateSequentialPaymentNumber = async () => {
    const currentYear = new Date().getFullYear();
    const allPayments = await getBoughtPayments();
    
    const currentYearPayments = allPayments.filter(payment => {
      const paymentNumber = payment.paymentNumber || '';
      return paymentNumber.startsWith(`BPAY-${currentYear}-`);
    });
    
    let maxNumber = 0;
    currentYearPayments.forEach(payment => {
      const match = payment.paymentNumber?.match(new RegExp(`BPAY-${currentYear}-(\\d+)`));
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    });
    
    const newNumber = maxNumber + 1;
    return `BPAY-${currentYear}-${newNumber}`;
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || amount === 0) return "0 IQD";
    return new Intl.NumberFormat("en-US").format(Math.round(amount)) + " IQD";
  };

  const formatUSD = (amount) => {
    if (amount === undefined || amount === null || amount === 0) return "$0.00";
    return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const getDisplayAmount = (amountUSD, amountIQD) => {
    const parts = [];
    if (amountUSD && amountUSD > 0) parts.push(formatUSD(amountUSD));
    if (amountIQD && amountIQD > 0) parts.push(formatCurrency(amountIQD));
    if (parts.length === 0) return "0 IQD";
    return parts.join(" + ");
  };

  const getFirstName = (fullName) => {
    if (!fullName) return "User";
    const namePart = fullName.split("@")[0];
    return namePart.split(" ")[0];
  };

  const processImageFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    setImageProcessing(true);
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        let width = img.width;
        let height = img.height;
        const maxWidth = 800;
        if (width > maxWidth) {
          height = Math.round((maxWidth / width) * height);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
        
        const base64 = canvas.toDataURL("image/jpeg", 0.7);
        setBillImageData(base64);
        setImageHasChanged(true);
        setImageProcessing(false);
      };
      img.onerror = () => {
        setError("Failed to load image. Please try another file.");
        setImageProcessing(false);
      };
      img.src = readerEvent.target.result;
    };
    reader.onerror = () => {
      setError("Failed to read file. Please try again.");
      setImageProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e) => processImageFile(e.target.files[0]);
  const handleCameraChange = (e) => processImageFile(e.target.files[0]);
  const triggerFileInput = () => fileInputRef.current?.click();
  const triggerCameraInput = () => cameraInputRef.current?.click();

  const removeImage = () => {
    setBillImageData(null);
    setImageHasChanged(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const normalizeForSearch = (str) => {
    if (!str) return "";
    return str.toString().toLowerCase()
      .replace(/ي/g, "ی")
      .replace(/ك/g, "ک")
      .replace(/ه/g, "ە")
      .trim();
  };

  const filteredCompanies = companies.filter((company) => {
    const search = normalizeForSearch(companySearchTerm);
    if (!search) return true; 
    return (
      normalizeForSearch(company.name).includes(search) ||
      normalizeForSearch(company.code).includes(search)
    );
  });

  const handleSelectCompany = (company) => {
    if (!company) {
      setSelectedCompany("");
      setCompanySearchTerm("");
      setSelectedBoughtBills([]);
      setSelectedBoughtReturns([]);
      setBoughtBills([]);
      setReturns([]);
      setError(null);
      if (!isEditMode) {
        setHardcopyBillNumber("");
        setBillImageData(null);
        setOriginalImageData(null);
        setImageHasChanged(false);
      }
      return;
    }
    
    setSelectedCompany(company.id);
    setCompanySearchTerm(company.name);
    setShowCompanyDropdown(false);
  };

  const handleCompanyInputChange = (e) => {
    setCompanySearchTerm(e.target.value);
    setShowCompanyDropdown(true);
    if (e.target.value === "") {
      setSelectedCompany("");
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(event.target)) {
        setShowCompanyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const refreshPayments = async () => {
    try {
      setHistoryLoading(true);
      const paymentsData = await getBoughtPayments();
      paymentsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      setPaymentHistory(paymentsData);
    } catch (err) {
      console.error("Error refreshing payments:", err);
      setError("Failed to refresh payment history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const loadInitialData = async () => {
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get("edit");
        if (editId) { setIsEditMode(true); setEditPaymentId(editId); }
      }
      await refreshPayments();
      await loadCompanies();
    };
    loadInitialData();
  }, [user]);

  const loadCompanies = async () => {
    try {
      const companiesData = await getCompanies();
      setCompanies(companiesData.filter(c => c && c.id));
    } catch (err) {
      console.error("Error loading companies:", err);
      setError("Failed to load companies");
    }
  };

  useEffect(() => {
    const loadPaymentForEdit = async () => {
      if (!isEditMode || !editPaymentId || companies.length === 0) return;
      try {
        setLoading(true);
        setError(null);
        const paymentToEdit = await getBoughtPaymentDetails(editPaymentId);
        if (paymentToEdit) {
          setSelectedCompany(paymentToEdit.companyId);
          const company = companies.find((c) => c.id === paymentToEdit.companyId);
          setCompanySearchTerm(company?.name || "");
          setHardcopyBillNumber(paymentToEdit.hardcopyBillNumber);

          const existingImage = paymentToEdit.billImageBase64 || paymentToEdit.billImageUrl || null;
          setBillImageData(existingImage);
          setOriginalImageData(existingImage);
          setImageHasChanged(false);
          
          if (fileInputRef.current) fileInputRef.current.value = "";
          if (cameraInputRef.current) cameraInputRef.current.value = "";

          if (paymentToEdit.paymentDate) {
            setPaymentDate(formatDateToYMD(paymentToEdit.paymentDate));
          } else {
            setPaymentDate(new Date().toISOString().split("T")[0]);
          }
          setNotes(paymentToEdit.notes || "");
          setSelectedBoughtBills(paymentToEdit.selectedBoughtBills || []);
          setSelectedBoughtReturns(paymentToEdit.selectedBoughtReturns || []);
        }
      } catch (err) {
        console.error("Error loading payment for edit:", err);
        setError("Failed to load payment for editing");
      } finally {
        setLoading(false);
        setInitialLoadComplete(true);
      }
    };
    loadPaymentForEdit();
  }, [isEditMode, editPaymentId, companies]);

  useEffect(() => {
    if (!selectedCompany) {
      setBoughtBills([]);
      setReturns([]);
      return;
    }
    const loadCompanyData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [allBoughtBills, allReturns] = await Promise.all([
          getCompanyBoughtBills(selectedCompany, isEditMode ? selectedBoughtBills : []),
          getReturnsForCompany(selectedCompany, isEditMode ? selectedBoughtReturns : []),
        ]);
        setBoughtBills(allBoughtBills);
        const uniqueReturnsMap = new Map();
        allReturns.forEach((returnItem) => {
          if (!uniqueReturnsMap.has(returnItem.id)) {
            uniqueReturnsMap.set(returnItem.id, {
              ...returnItem,
              items: returnItem.items ? [...returnItem.items] : [{
                name: returnItem.name, barcode: returnItem.barcode,
                returnQuantity: returnItem.returnQuantity, returnPrice: returnItem.returnPrice,
                returnPriceUSD: returnItem.returnPriceUSD, returnPriceIQD: returnItem.returnPriceIQD,
                returnNote: returnItem.returnNote || "",
              }],
              totalReturnUSD: returnItem.totalReturnUSD || 0,
              totalReturnIQD: returnItem.totalReturnIQD || 0,
              totalReturn: returnItem.totalReturn || (returnItem.returnPrice || 0) * (returnItem.returnQuantity || 0),
              returnNote: returnItem.returnNote || "",
            });
          } else {
            const existing = uniqueReturnsMap.get(returnItem.id);
            if (returnItem.name && !existing.items.some((i) => i.barcode === returnItem.barcode)) {
              existing.items.push({
                name: returnItem.name, barcode: returnItem.barcode,
                returnQuantity: returnItem.returnQuantity, returnPrice: returnItem.returnPrice,
                returnPriceUSD: returnItem.returnPriceUSD, returnPriceIQD: returnItem.returnPriceIQD,
                returnNote: returnItem.returnNote || "",
              });
              existing.totalReturnUSD += returnItem.totalReturnUSD || 0;
              existing.totalReturnIQD += returnItem.totalReturnIQD || 0;
              existing.totalReturn += (returnItem.returnPrice || 0) * (returnItem.returnQuantity || 0);
            }
          }
        });
        setReturns(Array.from(uniqueReturnsMap.values()));
      } catch (err) {
        console.error("Error loading company data:", err);
        setError("Failed to load company data");
      } finally {
        setLoading(false);
      }
    };
    loadCompanyData();
  }, [selectedCompany, isEditMode, initialLoadComplete]);

  useEffect(() => {
    let boughtUSD = 0, boughtIQD = 0, returnUSD = 0, returnIQD = 0;
    selectedBoughtBills.forEach((billId) => {
      const bill = boughtBills.find((b) => b.id === billId);
      if (bill) {
        if ((bill.currency || "USD") === "USD") boughtUSD += bill.totalAmountUSD || bill.totalAmount || 0;
        else boughtIQD += bill.totalAmountIQD || bill.totalAmount || 0;
      }
    });
    selectedBoughtReturns.forEach((returnId) => {
      const returnBill = returns.find((r) => r.id === returnId);
      if (returnBill) {
        if (returnBill.items && returnBill.items.length > 0) {
          returnBill.items.forEach((item) => {
            const itemCurrency = item.currency || returnBill.currency || "USD";
            const itemTotal = (item.returnPrice || 0) * (item.returnQuantity || 0);
            if (itemCurrency === "USD") returnUSD += itemTotal;
            else returnIQD += itemTotal;
          });
        } else {
          const returnCurrency = returnBill.currency || "USD";
          const returnTotal = (returnBill.returnPrice || 0) * (returnBill.returnQuantity || 0);
          if (returnCurrency === "USD") returnUSD += returnTotal;
          else returnIQD += returnTotal;
        }
      }
    });
    setCurrencyTotals({ boughtUSD, boughtIQD, returnUSD, returnIQD, netUSD: boughtUSD - returnUSD, netIQD: boughtIQD - returnIQD });
  }, [selectedBoughtBills, selectedBoughtReturns, boughtBills, returns]);

  useEffect(() => {
    const warnings = [];
    selectedBoughtBills.forEach((billId) => {
      const bill = boughtBills.find((b) => b.id === billId);
      if (bill && bill.isConsignment) {
        warnings.push({
          billId,
          billNumber: bill.billNumber,
          message: `Bill #${bill.billNumber} contains consigned items. Items may still be in the store — please verify before paying.`,
        });
      }
    });
    setConsignmentWarnings(warnings);
  }, [selectedBoughtBills, boughtBills]);

  const toggleBoughtBill = (billId) => setSelectedBoughtBills((prev) => prev.includes(billId) ? prev.filter((id) => id !== billId) : [...prev, billId]);
  const toggleBoughtReturn = (returnId) => setSelectedBoughtReturns((prev) => prev.includes(returnId) ? prev.filter((id) => id !== returnId) : [...prev, returnId]);
  const selectAllBoughtBills = () => setSelectedBoughtBills(selectedBoughtBills.length === boughtBills.length ? [] : boughtBills.map((b) => b.id));
  const selectAllBoughtReturns = () => setSelectedBoughtReturns(selectedBoughtReturns.length === returns.length ? [] : returns.map((r) => r.id));

  const resetForm = () => {
    setSelectedBoughtBills([]);
    setSelectedBoughtReturns([]);
    setHardcopyBillNumber("");
    setNotes("");
    setBillImageData(null);
    setOriginalImageData(null);
    setImageHasChanged(false);
    setSelectedCompany("");
    setCompanySearchTerm("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setPaymentDate(new Date().toISOString().split("T")[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setHardcopyBillError(false);

    let hasError = false;
    if (!selectedCompany) {
      setError("Please select a company");
      hasError = true;
    }
    if (!hardcopyBillNumber.trim()) {
      setHardcopyBillError(true);
      if (!hasError) {
        hardcopyBillNumberRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => hardcopyBillNumberRef.current?.focus(), 400);
      }
      hasError = true;
    }
    if (selectedBoughtBills.length === 0 && selectedBoughtReturns.length === 0) {
      if (!hasError) setError("Please select at least one bill or return to process");
      hasError = true;
    }
    if (hasError) return;

    if (imageProcessing) {
      setError("Image is still processing. Please wait a moment.");
      return;
    }

    try {
      setSubmitting(true);

      const selectedCompanyData = companies.find((c) => c.id === selectedCompany);
      const userDisplayName = user?.name || user?.email || "Unknown User";
      
      let paymentNumber;
      if (isEditMode) {
        const existingPayment = paymentHistory.find(p => p.id === editPaymentId);
        paymentNumber = existingPayment?.paymentNumber || await generateSequentialPaymentNumber();
      } else {
        paymentNumber = await generateSequentialPaymentNumber();
      }

      let imageToSave = isEditMode ? (imageHasChanged ? (billImageData || null) : (originalImageData || null)) : (billImageData || null);

      const paymentData = {
        paymentNumber,
        companyId: selectedCompany,
        companyName: selectedCompanyData?.name || "Unknown Company",
        selectedBoughtBills,
        selectedBoughtReturns,
        boughtTotalUSD: currencyTotals.boughtUSD,
        boughtTotalIQD: currencyTotals.boughtIQD,
        returnTotalUSD: currencyTotals.returnUSD,
        returnTotalIQD: currencyTotals.returnIQD,
        netAmountUSD: currencyTotals.netUSD,
        netAmountIQD: currencyTotals.netIQD,
        netAmount: currencyTotals.netUSD + currencyTotals.netIQD,
        boughtTotal: currencyTotals.boughtUSD + currencyTotals.boughtIQD,
        returnTotal: currencyTotals.returnUSD + currencyTotals.returnIQD,
        paymentDate: new Date(paymentDate),
        hardcopyBillNumber: hardcopyBillNumber.trim(),
        notes,
        billImageBase64: imageToSave,
        billImageUrl: imageToSave,
        createdBy: user.uid,
        createdByName: userDisplayName,
        paymentType: "bought",
      };

      if (isEditMode) {
        await updateBoughtPayment(editPaymentId, paymentData);
        setSuccess("Bought Payment updated successfully!");
        setIsEditMode(false);
        setEditPaymentId(null);
      } else {
        const result = await createBoughtPayment(paymentData);
        if (!result || !result.id) throw new Error("Payment creation failed: No payment ID returned.");
        setSuccess("Bought Payment created successfully!");
      }

      resetForm();
      await refreshPayments();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error creating/updating payment:", err);
      setError(err.message || "Failed to process payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditPaymentId(null);
    setSelectedBoughtBills([]);
    setSelectedBoughtReturns([]);
    setHardcopyBillNumber("");
    setHardcopyBillError(false);
    setNotes("");
    setBillImageData(null);
    setOriginalImageData(null);
    setImageHasChanged(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setSelectedCompany("");
    setCompanySearchTerm("");
    window.history.replaceState({}, "", "/bought-payments");
  };

  const handleUpdatePayment = (payment) => {
    setIsEditMode(true);
    setEditPaymentId(payment.id);
    setSelectedCompany(payment.companyId);
    const company = companies.find((c) => c.id === payment.companyId);
    setCompanySearchTerm(company?.name || "");
    setHardcopyBillNumber(payment.hardcopyBillNumber);
    setHardcopyBillError(false);

    const existingImage = payment.billImageBase64 || payment.billImageUrl || null;
    setBillImageData(existingImage);
    setOriginalImageData(existingImage);
    setImageHasChanged(false);
    
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";

    if (payment.paymentDate) {
      setPaymentDate(formatDateToYMD(payment.paymentDate));
    } else {
      setPaymentDate(new Date().toISOString().split("T")[0]);
    }
    setNotes(payment.notes || "");
    setSelectedBoughtBills(payment.selectedBoughtBills || []);
    setSelectedBoughtReturns(payment.selectedBoughtReturns || []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleViewPayment = async (payment) => {
    setSelectedPayment(payment);
    await loadPaymentDetails(payment.id);
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => { setShowPaymentModal(false); setSelectedPayment(null); };
  const handleViewImage = (imageData) => { setSelectedImageUrl(imageData); setShowImageModal(true); };
  const closeImageModal = () => { setShowImageModal(false); setSelectedImageUrl(""); };

  const handlePrintPayment = async (payment) => {
    setPrintLoading(true);
    try {
      const allBoughtBills = await getBoughtBills();
      const allReturnsRaw = await getReturnsForCompany(payment.companyId);
      const boughtDetails = allBoughtBills.filter((bill) => payment.selectedBoughtBills?.includes(bill.id));
      const returnDetailsMap = new Map();
      allReturnsRaw.forEach((r) => {
        if (!payment.selectedBoughtReturns?.includes(r.id)) return;
        if (!returnDetailsMap.has(r.id)) returnDetailsMap.set(r.id, { ...r, allItems: [] });
        returnDetailsMap.get(r.id).allItems.push(r);
      });
      const returnDetails = Array.from(returnDetailsMap.values());
      const printWindow = window.open("", "_blank");
      printWindow.document.write(generatePrintHTML(payment, boughtDetails, returnDetails));
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    } catch (err) {
      console.error("Error generating print:", err);
      setError("Failed to generate print preview");
    } finally {
      setPrintLoading(false);
    }
  };

  const generatePrintHTML = (payment, boughtBillsList, returnsList) => {
    let totalBoughtUSD = 0, totalBoughtIQD = 0, totalReturnUSD = 0, totalReturnIQD = 0;
    const boughtItemsRows = [];
    const returnItemsRows = [];

    if (boughtBillsList && boughtBillsList.length > 0) {
      boughtBillsList.forEach((bill) => {
        const currency = bill.currency || "USD";
        let billTotal = 0;
        if (bill.items && Array.isArray(bill.items) && bill.items.length > 0) {
          bill.items.forEach((item) => { billTotal += (item.basePrice || item.price || 0) * (item.quantity || 1); });
        } else if (bill.totalAmountUSD || bill.totalAmountIQD) {
          billTotal = currency === "USD" ? bill.totalAmountUSD || 0 : bill.totalAmountIQD || 0;
        } else {
          billTotal = bill.totalAmount || bill.amount || 0;
        }
        if (currency === "USD") totalBoughtUSD += billTotal;
        else totalBoughtIQD += billTotal;
        const displayAmount = currency === "USD" ? formatUSD(billTotal) : formatCurrency(billTotal);
        const billNote = bill.billNote || bill.note || "";
        boughtItemsRows.push(`<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${bill.billNumber || bill.id}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${formatDateToDMY(bill.date)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:10px;">${billNote || "—"}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold;color:${currency === "USD" ? "#059669" : "#2563eb"};">+${displayAmount}</td>
        </tr>`);
      });
    }

    if (returnsList && returnsList.length > 0) {
      const displayedReturnNumbers = new Set();
      returnsList.forEach((ret) => {
        const returnNumberDisplay = ret.returnBillNumber || ret.returnNumber || `RET-${ret.id?.slice(-6)}`;
        const currency = ret.currency || "USD";
        let returnTotal = 0;
        if (ret.items && Array.isArray(ret.items) && ret.items.length > 0) {
          ret.items.forEach((item) => { returnTotal += (item.returnPrice || 0) * (item.returnQuantity || 0); });
        } else if (ret.allItems && ret.allItems.length > 0) {
          ret.allItems.forEach((item) => { returnTotal += (item.returnPrice || 0) * (item.returnQuantity || 0); });
        } else {
          returnTotal = (ret.returnPrice || 0) * (ret.returnQuantity || 0);
          if (returnTotal === 0) returnTotal = ret.totalReturnUSD || ret.totalReturnIQD || ret.totalReturn || 0;
        }
        if (currency === "USD") totalReturnUSD += returnTotal;
        else totalReturnIQD += returnTotal;
        const displayAmount = currency === "USD" ? formatUSD(returnTotal) : formatCurrency(returnTotal);
        const rowKey = `${returnNumberDisplay}_${currency}`;
        const retNote = ret.returnNote || ret.note || "";
        if (!displayedReturnNumbers.has(rowKey)) {
          displayedReturnNumbers.add(rowKey);
          returnItemsRows.push(`<tr>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${returnNumberDisplay}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${formatDateToDMY(ret.returnDate || ret.date)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:10px;">${retNote || "—"}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold;color:${currency === "USD" ? "#dc2626" : "#b91c1c"};">-${displayAmount}</td>
          </tr>`);
        }
      });
    }

    const finalReturnUSD = totalReturnUSD || payment.returnTotalUSD || 0;
    const finalReturnIQD = totalReturnIQD || payment.returnTotalIQD || 0;
    const finalBoughtUSD = totalBoughtUSD || payment.boughtTotalUSD || 0;
    const finalBoughtIQD = totalBoughtIQD || payment.boughtTotalIQD || 0;
    const paidUSD = payment.netAmountUSD !== undefined && payment.netAmountUSD !== null ? payment.netAmountUSD : finalBoughtUSD - finalReturnUSD;
    const paidIQD = payment.netAmountIQD !== undefined && payment.netAmountIQD !== null ? payment.netAmountIQD : finalBoughtIQD - finalReturnIQD;
    const logoUrl = typeof window !== "undefined" ? `${window.location.origin}/Aranlogo.png` : "/Aranlogo.png";

    return `<!DOCTYPE html>
<html>
  <head>
    <title>Payment Receipt - ${payment.paymentNumber}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#111;background:white;padding:15px;}
      .receipt{max-width:900px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:20px;background:white;}
      .header{text-align:center;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #8B5CF6;}
      .logo{max-height:70px;max-width:220px;object-fit:contain;margin-bottom:8px;}
      .header h1{font-size:18px;font-weight:bold;margin-bottom:4px;color:#8B5CF6;}
      .header p{font-size:11px;color:#6b7280;}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;padding:12px;background:#f8fafc;border-radius:8px;}
      .info-item{margin-bottom:6px;}
      .info-label{font-weight:bold;color:#6b7280;font-size:9px;text-transform:uppercase;margin-bottom:2px;}
      .info-value{font-size:12px;font-weight:600;color:#1f2937;}
      .totals-row{display:flex;justify-content:space-between;gap:12px;margin-bottom:20px;}
      .total-card{flex:1;padding:10px;border-radius:8px;text-align:center;}
      .total-card.bought{background:#d1fae5;border:1px solid #10b981;}
      .total-card.return{background:#fee2e2;border:1px solid #ef4444;}
      .total-card.paid{background:#e9d5ff;border:1px solid #8b5cf6;}
      .total-label{font-size:9px;text-transform:uppercase;font-weight:600;color:#4b5563;margin-bottom:4px;}
      .total-amount{font-size:13px;font-weight:bold;}
      .section{margin-bottom:20px;}
      .section-title{font-size:12px;font-weight:bold;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid #e5e7eb;}
      table{width:100%;border-collapse:collapse;}
      th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #e5e7eb;}
      th{background:#f3f4f6;font-weight:600;font-size:10px;}
      th:last-child,td:last-child{text-align:right;}
      .notes-box{margin-top:15px;padding:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:10px;}
      .footer{margin-top:15px;padding-top:10px;border-top:1px solid #e5e7eb;text-align:center;font-size:8px;color:#9ca3af;}
      @media print{body{padding:0;margin:0;}.receipt{border:none;padding:10px;}}
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="header">
        <img src="${logoUrl}" alt="Aran Logo" class="logo" onerror="this.style.display='none'" />
        <h1>BOUGHT PAYMENT RECEIPT</h1>
        <p><strong>${payment.paymentNumber}</strong> | ${formatDateToDMY(payment.paymentDate)}</p>
      </div>
      <div class="info-grid">
        <div>
          <div class="info-item"><div class="info-label">Company</div><div class="info-value">${payment.companyName || ""}</div></div>
          <div class="info-item"><div class="info-label">Hardcopy Bill</div><div class="info-value">${payment.hardcopyBillNumber || ""}</div></div>
        </div>
        <div>
          <div class="info-item"><div class="info-label">Created By</div><div class="info-value">${getFirstName(payment.createdByName)}</div></div>
          <div class="info-item"><div class="info-label">Payment Date</div><div class="info-value">${formatDateToDMY(payment.paymentDate)}</div></div>
        </div>
      </div>
      <div class="totals-row">
        <div class="total-card bought">
          <div class="total-label">TOTAL BOUGHT</div>
          ${finalBoughtUSD > 0 ? `<div class="total-amount" style="color:#059669;">+${formatUSD(finalBoughtUSD)}</div>` : ""}
          ${finalBoughtIQD > 0 ? `<div class="total-amount" style="color:#2563eb;">+${formatCurrency(finalBoughtIQD)}</div>` : ""}
          ${finalBoughtUSD === 0 && finalBoughtIQD === 0 ? `<div class="total-amount" style="color:#6b7280;">$0.00</div>` : ""}
        </div>
        <div class="total-card return">
          <div class="total-label">TOTAL RETURN</div>
          ${finalReturnUSD > 0 ? `<div class="total-amount" style="color:#dc2626;">-${formatUSD(finalReturnUSD)}</div>` : ""}
          ${finalReturnIQD > 0 ? `<div class="total-amount" style="color:#b91c1c;">-${formatCurrency(finalReturnIQD)}</div>` : ""}
          ${finalReturnUSD === 0 && finalReturnIQD === 0 ? `<div class="total-amount" style="color:#6b7280;">$0.00</div>` : ""}
        </div>
        <div class="total-card paid">
          <div class="total-label">TOTAL PAID</div>
          ${paidUSD !== 0 ? `<div class="total-amount" style="color:${paidUSD >= 0 ? "#059669" : "#dc2626"};">${paidUSD >= 0 ? "+" : ""}${formatUSD(paidUSD)}</div>` : ""}
          ${paidIQD !== 0 ? `<div class="total-amount" style="color:${paidIQD >= 0 ? "#2563eb" : "#b91c1c"};">${paidIQD >= 0 ? "+" : ""}${formatCurrency(paidIQD)}</div>` : ""}
          ${paidUSD === 0 && paidIQD === 0 ? `<div class="total-amount" style="color:#6b7280;">$0.00</div>` : ""}
        </div>
      </div>
      ${boughtItemsRows.length > 0 ? `<div class="section"><div class="section-title">📦 BOUGHT BILLS</div><table><thead><tr><th>Bill Number</th><th>Date</th><th>Note</th><th>Amount</th></tr></thead><tbody>${boughtItemsRows.join("")}</tbody></table></div>` : ""}
      ${returnItemsRows.length > 0 ? `<div class="section"><div class="section-title">🔄 RETURNS</div><tr><thead><tr><th>Return Number</th><th>Date</th><th>Note</th><th>Amount</th></tr></thead><tbody>${returnItemsRows.join("")}</tbody></table></div>` : ""}
      ${payment.notes ? `<div class="notes-box"><strong>Payment Notes:</strong><br/>${payment.notes}</div>` : ""}
  
      <div class="footer"><p>Generated on ${formatDateToDMY(new Date())}</p></div>
    </div>
  </body>
</html>`;
  };

  const loadPaymentDetails = async (paymentId) => {
    try {
      const payment = paymentHistory.find((p) => p.id === paymentId);
      if (!payment) return;
      const allBoughtBills = await getBoughtBills();
      const allReturnsRaw = await getReturnsForCompany(payment.companyId);
      const boughtDetails = allBoughtBills
        .filter((bill) => payment.selectedBoughtBills?.includes(bill.id))
        .map((bill) => ({
          ...bill,
          displayAmount: getDisplayAmount(bill.totalAmountUSD || 0, bill.totalAmountIQD || 0),
          billNote: bill.billNote || bill.note || "",
        }));

      const returnGroupMap = new Map();
      allReturnsRaw.forEach((r) => {
        if (!payment.selectedBoughtReturns?.includes(r.id)) return;
        if (!returnGroupMap.has(r.id)) {
          returnGroupMap.set(r.id, { ...r, displayAmount: getDisplayAmount(r.totalReturnUSD || 0, r.totalReturnIQD || 0), returnNote: r.returnNote || r.note || "" });
        }
      });
      setPaymentDetails((prev) => ({ ...prev, [paymentId]: { boughtBills: boughtDetails, returns: Array.from(returnGroupMap.values()) } }));
    } catch (err) {
      console.error("Error loading payment details:", err);
    }
  };

  const resetAdvancedSearch = () =>
    setAdvancedSearch({ companyName: "", hardcopyBillNumber: "", boughtBillNumber: "", returnBillNumber: "", paymentNumber: "", dateFrom: "", dateTo: "", amountMinUSD: "", amountMaxUSD: "", amountMinIQD: "", amountMaxIQD: "" });

  const filteredPayments = paymentHistory.filter((payment) => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const basicMatch =
        payment.paymentNumber?.toLowerCase().includes(s) ||
        payment.companyName?.toLowerCase().includes(s) ||
        getFirstName(payment.createdByName).toLowerCase().includes(s) ||
        payment.hardcopyBillNumber?.toLowerCase().includes(s) ||
        payment.notes?.toLowerCase().includes(s) ||
        String(payment.netAmountUSD || "").includes(s) ||
        String(payment.netAmountIQD || "").includes(s);
      if (!basicMatch) return false;
    }
    if (!showAdvancedSearch) {
        // Quick Filters check (only when advanced search is hidden)
        if (filters.startDate) {
            const start = new Date(filters.startDate);
            start.setHours(0, 0, 0, 0);
            const pDate = payment.paymentDate?.toDate ? payment.paymentDate.toDate() : new Date(payment.paymentDate);
            if (pDate < start) return false;
        }
        if (filters.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            const pDate = payment.paymentDate?.toDate ? payment.paymentDate.toDate() : new Date(payment.paymentDate);
            if (pDate > end) return false;
        }
        return true;
    }
    
    // Advanced search logic
    if (advancedSearch.companyName && !payment.companyName?.toLowerCase().includes(advancedSearch.companyName.toLowerCase())) return false;
    if (advancedSearch.hardcopyBillNumber && !payment.hardcopyBillNumber?.toLowerCase().includes(advancedSearch.hardcopyBillNumber.toLowerCase())) return false;
    if (advancedSearch.paymentNumber && !payment.paymentNumber?.toLowerCase().includes(advancedSearch.paymentNumber.toLowerCase())) return false;
    if (advancedSearch.boughtBillNumber) {
      const searchBill = advancedSearch.boughtBillNumber.toLowerCase();
      if (!payment.selectedBoughtBills?.some((billId) => billId.toLowerCase().includes(searchBill))) return false;
    }
    if (advancedSearch.returnBillNumber) {
      const searchRet = advancedSearch.returnBillNumber.toLowerCase();
      if (!payment.selectedBoughtReturns?.some((retId) => retId.toLowerCase().includes(searchRet))) return false;
    }
    if (advancedSearch.dateFrom || advancedSearch.dateTo) {
      let paymentDateObj;
      if (payment.paymentDate?.toDate) paymentDateObj = payment.paymentDate.toDate();
      else if (payment.paymentDate instanceof Date) paymentDateObj = payment.paymentDate;
      else paymentDateObj = new Date(payment.paymentDate);
      if (advancedSearch.dateFrom) {
        const fromDate = new Date(advancedSearch.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (paymentDateObj < fromDate) return false;
      }
      if (advancedSearch.dateTo) {
        const toDate = new Date(advancedSearch.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (paymentDateObj > toDate) return false;
      }
    }
    if (advancedSearch.amountMinUSD !== "" && !isNaN(advancedSearch.amountMinUSD) && (payment.netAmountUSD || 0) < Number(advancedSearch.amountMinUSD)) return false;
    if (advancedSearch.amountMaxUSD !== "" && !isNaN(advancedSearch.amountMaxUSD) && (payment.netAmountUSD || 0) > Number(advancedSearch.amountMaxUSD)) return false;
    if (advancedSearch.amountMinIQD !== "" && !isNaN(advancedSearch.amountMinIQD) && (payment.netAmountIQD || 0) < Number(advancedSearch.amountMinIQD)) return false;
    if (advancedSearch.amountMaxIQD !== "" && !isNaN(advancedSearch.amountMaxIQD) && (payment.netAmountIQD || 0) > Number(advancedSearch.amountMaxIQD)) return false;
    return true;
  });

  const formatPaymentNumber = (payment) => {
    if (!payment.paymentNumber) return `BPAY-${formatDateToYMD(new Date()).replace(/-/g, "")}-${payment.id?.slice(-6)}`;
    return payment.paymentNumber;
  };

  const inputStyle = { width: "100%", padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.75rem", fontSize: "0.875rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box", transition: "all 0.2s" };
  const labelStyle = { display: "block", fontSize: "0.8rem", fontWeight: "600", marginBottom: "0.4rem", color: colorScheme.text };

  const getPaymentImage = (payment) => payment.billImageBase64 || payment.billImageUrl || null;

  if (!user || isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)" }}>
        <div className="modern-spinner"></div>
        <p style={{ marginTop: "1.5rem", color: "#64748b", fontSize: "1.1rem", fontWeight: "500", letterSpacing: "0.5px" }}>Loading data...</p>
        <style dangerouslySetInnerHTML={{__html: `
          .modern-spinner { width: 48px; height: 48px; border-radius: 50%; border: 4px solid #E5E7EB; border-top-color: #8B5CF6; animation: spin 1s linear infinite; }
          @keyframes spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }
        `}} />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", padding: "1rem", background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)", fontFamily: "var(--font-nrt-reg)", boxSizing: "border-box", overflowX: "hidden" }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }
        @keyframes shake { 0%,100%{transform:translateX(0);} 20%,60%{transform:translateX(-6px);} 40%,80%{transform:translateX(6px);} }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }
        .modern-spinner-small { width: 32px; height: 32px; border-radius: 50%; border: 3px solid #E5E7EB; border-top-color: #8B5CF6; animation: spin 1s linear infinite; margin: 0 auto; }
        .hardcopy-error-shake { animation: shake 0.4s ease; }
        input:focus, textarea:focus, select:focus { outline: 2px solid #8B5CF6; outline-offset: 1px; }
        .adv-input { width:100%; padding:0.6rem 0.75rem; border:1px solid #D1D5DB; border-radius:0.6rem; font-size:0.8rem; font-family:inherit; box-sizing:border-box; }
        .adv-input:focus { outline:2px solid #8B5CF6; }
        .img-btn-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        @media (max-width: 480px) { .img-btn-row { flex-direction: column; } }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: "0.25rem", fontFamily: "var(--font-nrt-bd)" }}>
          {isEditMode ? "✏️ Update Bought Payment" : "💼 Bought Payment Management"}
        </h1>
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#FEF2F2", border: `1px solid ${colorScheme.danger}`, borderRadius: "0.75rem", marginBottom: "1rem" }}>
          <p style={{ color: colorScheme.danger, margin: 0, fontWeight: "500" }}>❌ {error}</p>
        </div>
      )}
      {success && (
        <div style={{ padding: "1rem", backgroundColor: "#F0FDF4", border: `1px solid ${colorScheme.success}`, borderRadius: "0.75rem", marginBottom: "1rem" }}>
          <p style={{ color: colorScheme.success, margin: 0, fontWeight: "500" }}>✅ {success}</p>
        </div>
      )}

      {/* Consignment Warning Banner */}
      {consignmentWarnings.length > 0 && (
        <div style={{ padding: "1rem", backgroundColor: "#FFF7ED", border: "2px solid #F59E0B", borderRadius: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.2rem" }}>⚠️</span>
            <div>
              <div style={{ fontWeight: "600", color: "#92400E", marginBottom: "0.5rem", fontSize: "0.9rem" }}>Consignment Warning — Optional but important!</div>
              {consignmentWarnings.map((w, i) => (
                <div key={i} style={{ color: "#B45309", fontSize: "0.85rem", marginBottom: "0.25rem" }}>• {w.message}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "2rem" }}>

        {/* Company Information */}
        <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", padding: "1.5rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "1.25rem", paddingBottom: "0.6rem", borderBottom: `2px solid ${colorScheme.primary}`, color: colorScheme.text }}>
            🏢 Company Information
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem" }}>
            
            {/* ✅ React Select Dropdown Component */}
            <div style={{ position: "relative", zIndex: 50 }}>
              <label style={labelStyle}>Select Company *</label>
              <Select
                options={companies.map(c => ({ value: c.id, label: `${c.name} ${c.code ? `(${c.code})` : ''}`, company: c }))}
                onChange={(selected) => handleSelectCompany(selected ? selected.company : null)}
                value={selectedCompany ? { value: selectedCompany, label: companySearchTerm } : null}
                placeholder="Search company..."
                isClearable
                isSearchable
                styles={{
                  control: (base, state) => ({
                    ...base,
                    borderRadius: '0.75rem',
                    padding: '0.2rem',
                    borderColor: state.isFocused ? colorScheme.primary : '#D1D5DB',
                    boxShadow: state.isFocused ? `0 0 0 3px ${colorScheme.primary}20` : 'none',
                    '&:hover': { borderColor: colorScheme.primary }
                  })
                }}
              />
            </div>

            {/* Hardcopy Bill Number */}
            <div>
              <label style={labelStyle}>Hardcopy Bill Number *</label>
              <input ref={hardcopyBillNumberRef} type="text" value={hardcopyBillNumber}
                onChange={(e) => { setHardcopyBillNumber(e.target.value); if (e.target.value.trim()) setHardcopyBillError(false); }}
                className={hardcopyBillError ? "hardcopy-error-shake" : ""}
                style={{ ...inputStyle, border: hardcopyBillError ? "2px solid #EF4444" : "1px solid #D1D5DB", boxShadow: hardcopyBillError ? "0 0 0 3px rgba(239,68,68,0.15)" : undefined }}
                placeholder="Enter hardcopy bill number" />
              {hardcopyBillError && (
                <div style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.75rem", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "0.5rem", fontSize: "0.78rem", color: "#DC2626", fontWeight: "600" }}>
                  ⚠️ Hardcopy Bill Number is required.
                </div>
              )}
            </div>

            {/* Payment Date */}
            <div>
              <label style={labelStyle}>Payment Date</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Bill Image Section */}
        <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", padding: "1.5rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "1.25rem", paddingBottom: "0.6rem", borderBottom: `2px solid ${colorScheme.primary}`, color: colorScheme.text }}>
            📷 Bill Image
          </h2>

          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
          <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" onChange={handleCameraChange} style={{ display: "none" }} />

          <div style={{ display: "grid", gridTemplateColumns: billImageData ? "1fr auto" : "1fr", gap: "1.5rem", alignItems: "start" }}>
            <div>
              <label style={labelStyle}>Upload Bill Image (Optional)</label>

              <div className="img-btn-row">
                <button type="button" onClick={triggerFileInput} disabled={imageProcessing}
                  style={{ flex: 1, padding: "0.75rem", backgroundColor: "#F3F4F6", color: "#374151", border: "1px solid #D1D5DB", borderRadius: "0.75rem", fontSize: "0.85rem", fontWeight: "600", cursor: imageProcessing ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "background 0.2s", textAlign: "center" }}
                  onMouseEnter={e => { if (!imageProcessing) e.currentTarget.style.background = "#E5E7EB"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#F3F4F6"; }}>
                  {imageProcessing ? "⏳ Processing..." : "📁 Choose from Gallery"}
                </button>
                
                <button type="button" onClick={triggerCameraInput} disabled={imageProcessing}
                  style={{ flex: 1, padding: "0.75rem", backgroundColor: "#EDE9FE", color: "#5B21B6", border: "1px solid #C4B5FD", borderRadius: "0.75rem", fontSize: "0.85rem", fontWeight: "600", cursor: imageProcessing ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "background 0.2s", textAlign: "center" }}
                  onMouseEnter={e => { if (!imageProcessing) e.currentTarget.style.background = "#DDD6FE"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#EDE9FE"; }}>
                  📷 Take Photo
                </button>
              </div>

              {imageProcessing && (
                <div style={{ marginTop: "0.6rem", padding: "0.6rem 0.75rem", backgroundColor: "#EDE9FE", border: "1px solid #C4B5FD", borderRadius: "0.5rem", fontSize: "0.8rem", color: "#5B21B6", fontWeight: "600", animation: "pulse 1.5s infinite" }}>
                  ⚙️ Converting to grayscale...
                </div>
              )}

              {billImageData && !imageProcessing && (
                <div style={{ marginTop: "0.6rem", padding: "0.5rem 0.75rem", backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "0.5rem", fontSize: "0.78rem", color: "#166534", fontWeight: "600" }}>
                  ✅ Image ready — will be saved with payment
                </div>
              )}

              {!billImageData && !imageProcessing && isEditMode && (
                <div style={{ marginTop: "0.6rem", padding: "0.5rem 0.75rem", backgroundColor: imageHasChanged ? "#FEF3C7" : "#F3F4F6", border: `1px solid ${imageHasChanged ? "#FDE68A" : "#E5E7EB"}`, borderRadius: "0.5rem", fontSize: "0.78rem", color: imageHasChanged ? "#92400E" : colorScheme.textLight, fontWeight: "600" }}>
                  {imageHasChanged ? "ℹ️ Image removed — will be cleared on save" : "ℹ️ Keeping original image (upload new or take photo to replace)"}
                </div>
              )}
            </div>

            {billImageData && !imageProcessing && (
              <div style={{ textAlign: "center", padding: "0.5rem", border: "1px dashed #D1D5DB", borderRadius: "0.75rem", background: "#F9FAFB" }}>
                <p style={{ fontSize: "0.7rem", color: colorScheme.textLight, marginBottom: "0.4rem", fontWeight: "600", textTransform: "uppercase" }}>Preview</p>
                <img src={billImageData} alt="Bill Preview" style={{ width: "90px", height: "90px", objectFit: "cover", borderRadius: "0.5rem", border: "1px solid #E5E7EB", cursor: "pointer", filter: "grayscale(100%)", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }} onClick={() => handleViewImage(billImageData)} />
                <button type="button" onClick={removeImage} style={{ display: "block", margin: "0.5rem auto 0", padding: "0.3rem 0.6rem", fontSize: "0.7rem", color: "white", background: "#EF4444", border: "none", borderRadius: "0.25rem", cursor: "pointer", fontFamily: "inherit", fontWeight: "600" }}>✕ Remove</button>
              </div>
            )}
          </div>
        </div>

        {/* Bills & Returns Sections */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* Bought Bills */}
          <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
            <div style={{ background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`, padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <h2 style={{ fontSize: "1rem", fontWeight: "bold", color: "white", margin: 0 }}>📦 Bought Bills ({boughtBills.length})</h2>
                {!isEditMode && boughtBills.length > 0 && (
                  <button onClick={selectAllBoughtBills} style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white", padding: "0.4rem 0.9rem", borderRadius: "0.6rem", border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit", fontWeight: "600" }}>
                    {selectedBoughtBills.length === boughtBills.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
              {selectedBoughtBills.length > 0 && <div style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "#DDD6FE", fontWeight: "600" }}>{selectedBoughtBills.length} selected</div>}
            </div>
            <div style={{ padding: "1rem", maxHeight: "500px", overflowY: "auto", background: "#F8FAFC" }}>
              {loading ? (
                <div style={{ padding: "3rem", textAlign: "center" }}>
                   <div className="modern-spinner-small"></div>
                   <p style={{ marginTop: "1rem", color: "#94a3b8", fontSize: "0.9rem" }}>Fetching records...</p>
                </div>
              ) : boughtBills.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>{selectedCompany ? "No unpaid bills available" : "Select a company first"}</div>
              ) : (
                boughtBills.map((bill) => {
                  const billCurrency = bill.currency || "USD";
                  const isSelected = selectedBoughtBills.includes(bill.id);
                  const billAmount = billCurrency === "USD" ? bill.totalAmountUSD || 0 : bill.totalAmountIQD || 0;
                  const billNote = bill.billNote || bill.note || "";
                  const isConsignment = bill.isConsignment;
                  return (
                    <div key={bill.id} onClick={() => toggleBoughtBill(bill.id)}
                      style={{ padding: "0.85rem", marginBottom: "0.6rem", border: isSelected ? `2px solid ${colorScheme.primary}` : isConsignment ? "1px dashed #F59E0B" : "1px solid #E5E7EB", backgroundColor: isSelected ? "#F5F3FF" : isConsignment ? "#FFFBEB" : "white", borderRadius: "0.75rem", cursor: "pointer", transition: "all 0.2s ease", boxShadow: isSelected ? "0 4px 6px -1px rgba(139, 92, 246, 0.1)" : "0 1px 2px rgba(0,0,0,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: "600", fontSize: "0.875rem", color: isSelected ? colorScheme.dark : colorScheme.text }}>Bill #{bill.billNumber}</span>
                            {isConsignment && <span style={{ backgroundColor: "#FEF3C7", color: "#92400E", fontSize: "0.65rem", fontWeight: "700", padding: "2px 6px", borderRadius: "999px", border: "1px solid #FCD34D", whiteSpace: "nowrap" }}>⚠️ CONSIGNED</span>}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: colorScheme.textLight, marginTop: "0.3rem" }}>
                            {formatDateToDMY(bill.date)}
                            {bill.items?.length > 0 && <span style={{ marginLeft: "0.5rem" }}>• {bill.items.length} item{bill.items.length !== 1 ? "s" : ""}</span>}
                          </div>
                          {billNote && <div style={{ fontSize: "0.7rem", color: "#6B7280", marginTop: "0.3rem", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📝 {billNote}</div>}
                        </div>
                        <div style={{ fontWeight: "bold", color: billCurrency === "USD" ? "#059669" : "#2563eb", fontSize: "0.95rem", textAlign: "right", whiteSpace: "nowrap", marginLeft: "0.5rem", padding: "0.25rem 0.5rem", background: billCurrency === "USD" ? "#ECFDF5" : "#DBEAFE", borderRadius: "0.5rem" }}>
                          {billCurrency === "USD" ? formatUSD(billAmount) : formatCurrency(billAmount)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Returns */}
          <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
            <div style={{ background: `linear-gradient(135deg, ${colorScheme.secondary} 0%, #0891B2 100%)`, padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <h2 style={{ fontSize: "1rem", fontWeight: "bold", color: "white", margin: 0 }}>🔄 Returns ({returns.length})</h2>
                {!isEditMode && returns.length > 0 && (
                  <button onClick={selectAllBoughtReturns} style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white", padding: "0.4rem 0.9rem", borderRadius: "0.6rem", border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit", fontWeight: "600" }}>
                    {selectedBoughtReturns.length === returns.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
              {selectedBoughtReturns.length > 0 && <div style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "#CFFAFE", fontWeight: "600" }}>{selectedBoughtReturns.length} selected</div>}
            </div>
            <div style={{ padding: "1rem", maxHeight: "500px", overflowY: "auto", background: "#F8FAFC" }}>
              {loading ? (
                <div style={{ padding: "3rem", textAlign: "center" }}>
                   <div className="modern-spinner-small"></div>
                   <p style={{ marginTop: "1rem", color: "#94a3b8", fontSize: "0.9rem" }}>Fetching records...</p>
                </div>
              ) : returns.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>{selectedCompany ? "No unprocessed returns available" : "Select a company first"}</div>
              ) : (
                returns.map((returnBill) => {
                  const isSelected = selectedBoughtReturns.includes(returnBill.id);
                  const returnCurrency = returnBill.currency || "USD";
                  let returnTotal = 0;
                  if (returnBill.items && returnBill.items.length > 0) {
                    returnBill.items.forEach((item) => { returnTotal += (item.returnPrice || 0) * (item.returnQuantity || 0); });
                  } else {
                    returnTotal = (returnBill.returnPrice || 0) * (returnBill.returnQuantity || 0);
                  }
                  const retNote = returnBill.returnNote || returnBill.note || "";
                  return (
                    <div key={returnBill.id} onClick={() => toggleBoughtReturn(returnBill.id)}
                      style={{ padding: "0.85rem", marginBottom: "0.6rem", border: isSelected ? `2px solid ${colorScheme.secondary}` : "1px solid #E5E7EB", backgroundColor: isSelected ? "#ECFEFF" : "white", borderRadius: "0.75rem", cursor: "pointer", transition: "all 0.2s ease", boxShadow: isSelected ? "0 4px 6px -1px rgba(6, 182, 212, 0.1)" : "0 1px 2px rgba(0,0,0,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: "600", fontSize: "0.875rem", color: isSelected ? "#0891B2" : colorScheme.text }}>Return #{returnBill.returnBillNumber || returnBill.id?.slice(-6)}</div>
                          <div style={{ fontSize: "0.75rem", color: colorScheme.textLight, marginTop: "0.3rem" }}>
                            {formatDateToDMY(returnBill.returnDate || returnBill.date)}
                            {returnBill.items?.length > 0 && <span style={{ marginLeft: "0.5rem" }}>• {returnBill.items.length} item{returnBill.items.length !== 1 ? "s" : ""}</span>}
                          </div>
                          {retNote && <div style={{ fontSize: "0.7rem", color: "#6B7280", marginTop: "0.3rem", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📝 {retNote}</div>}
                        </div>
                        <div style={{ fontWeight: "bold", color: returnCurrency === "USD" ? "#dc2626" : "#b91c1c", fontSize: "0.95rem", textAlign: "right", whiteSpace: "nowrap", marginLeft: "0.5rem", padding: "0.25rem 0.5rem", background: returnCurrency === "USD" ? "#FEF2F2" : "#FEF2F2", borderRadius: "0.5rem" }}>
                          -{returnCurrency === "USD" ? formatUSD(returnTotal) : formatCurrency(returnTotal)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ✅ BEAUTIFUL PAYMENT SUMMARY SECTION - REFINED FONT SIZES */}
        <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", padding: "1.5rem", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: `2px solid ${colorScheme.secondary}`, color: colorScheme.text, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>💰</span> Payment Summary
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.25rem", alignItems: "stretch" }}>
            
            {/* Total Bought Card */}
            <div style={{ padding: "1rem", backgroundColor: "white", borderRadius: "1rem", border: "1px solid #A7F3D0", boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div style={{ background: "#D1FAE5", padding: "0.4rem", borderRadius: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: "1rem" }}>📦</span></div>
                <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "#059669", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Bought</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                {currencyTotals.boughtUSD > 0 && <div style={{ color: "#059669", fontWeight: "700", fontSize: "1.15rem" }}>+{formatUSD(currencyTotals.boughtUSD)}</div>}
                {currencyTotals.boughtIQD > 0 && <div style={{ color: "#2563eb", fontWeight: "700", fontSize: "1.15rem" }}>+{formatCurrency(currencyTotals.boughtIQD)}</div>}
                {currencyTotals.boughtUSD === 0 && currencyTotals.boughtIQD === 0 && <div style={{ color: "#9CA3AF", fontSize: "1.1rem", fontWeight: "600" }}>$0.00</div>}
              </div>
            </div>
            
            {/* Total Return Card */}
            <div style={{ padding: "1rem", backgroundColor: "white", borderRadius: "1rem", border: "1px solid #FECACA", boxShadow: "0 4px 6px -1px rgba(239, 68, 68, 0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div style={{ background: "#FEE2E2", padding: "0.4rem", borderRadius: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: "1rem" }}>🔄</span></div>
                <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Return</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                {currencyTotals.returnUSD > 0 && <div style={{ color: "#dc2626", fontWeight: "700", fontSize: "1.15rem" }}>−{formatUSD(currencyTotals.returnUSD)}</div>}
                {currencyTotals.returnIQD > 0 && <div style={{ color: "#b91c1c", fontWeight: "700", fontSize: "1.15rem" }}>−{formatCurrency(currencyTotals.returnIQD)}</div>}
                {currencyTotals.returnUSD === 0 && currencyTotals.returnIQD === 0 && <div style={{ color: "#9CA3AF", fontSize: "1.1rem", fontWeight: "600" }}>$0.00</div>}
              </div>
            </div>
            
            {/* Net Amount Card */}
            <div style={{ padding: "1rem", background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)", borderRadius: "1rem", border: "none", boxShadow: "0 10px 15px -3px rgba(124, 58, 237, 0.3)", color: "white", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div style={{ background: "rgba(255,255,255,0.2)", padding: "0.4rem", borderRadius: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: "1rem" }}>💰</span></div>
                <div style={{ fontSize: "0.8rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "#E0E7FF" }}>Net Amount</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                {currencyTotals.netUSD !== 0 && <div style={{ fontWeight: "700", fontSize: "1.25rem", color: "white" }}>{currencyTotals.netUSD > 0 ? "+" : ""}{formatUSD(currencyTotals.netUSD)}</div>}
                {currencyTotals.netIQD !== 0 && <div style={{ fontWeight: "700", fontSize: "1.25rem", color: "#FDE047" }}>{currencyTotals.netIQD > 0 ? "+" : ""}{formatCurrency(currencyTotals.netIQD)}</div>}
                {currencyTotals.netUSD === 0 && currencyTotals.netIQD === 0 && <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "1.25rem", fontWeight: "600" }}>$0.00</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", padding: "1.25rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: `2px solid ${colorScheme.light}`, color: colorScheme.text }}>📝 Payment Notes</h2>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }} placeholder="Add notes about this payment..." />
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {isEditMode && (
            <button onClick={handleCancelEdit} disabled={submitting}
              style={{ flex: "1 1 120px", padding: "0.8rem", backgroundColor: colorScheme.textLight, color: "white", border: "none", borderRadius: "0.75rem", cursor: "pointer", fontFamily: "inherit", fontSize: "0.95rem", fontWeight: "600", transition: "background 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#4B5563"}
              onMouseLeave={e => e.currentTarget.style.background = colorScheme.textLight}
            >
              ✕ Cancel
            </button>
          )}
          <button onClick={handleSubmit} disabled={submitting || imageProcessing}
            style={{ flex: "2 1 200px", padding: "0.8rem", background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`, color: "white", border: "none", borderRadius: "0.75rem", cursor: submitting || imageProcessing ? "not-allowed" : "pointer", opacity: submitting || imageProcessing ? 0.8 : 1, fontFamily: "inherit", fontSize: "0.95rem", fontWeight: "700", boxShadow: "0 4px 14px rgba(124, 58, 237, 0.4)", transition: "transform 0.1s" }}
            onMouseDown={e => { if(!submitting && !imageProcessing) e.currentTarget.style.transform = "scale(0.98)" }}
            onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            {imageProcessing ? "⚙️ Processing image..." : submitting ? "⏳ Saving..." : isEditMode ? (imageHasChanged ? "✏️ Update Payment (Image Changed)" : "✏️ Update Payment") : "✅ Confirm & Save Payment"}
          </button>
        </div>
      </div>

      {/* Payment History section */}
      <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", overflow: "hidden" }}>
        <div style={{ background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`, padding: "1.25rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "white", margin: 0 }}>📋 Bought Payment History</h2>
        </div>

        <div style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
            
            <div style={{ flex: "1 1 200px", position: "relative" }}>
               <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }}>🔍</span>
               <input type="text" placeholder="Search payments..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                 style={{ ...inputStyle, paddingLeft: "35px" }} />
            </div>

            <div style={{ flex: "1 1 150px" }}>
              <select style={inputStyle} value={filters.paymentStatus} onChange={(e) => handleFilterChange("paymentStatus", e.target.value)} className="input-focus">
                <option value="all">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>

            <div style={{ flex: "1 1 150px" }}>
              <input type="date" style={inputStyle} value={filters.startDate} onChange={(e) => handleFilterChange("startDate", e.target.value)} className="input-focus" />
            </div>

            <div style={{ flex: "1 1 150px" }}>
              <input type="date" style={inputStyle} value={filters.endDate} onChange={(e) => handleFilterChange("endDate", e.target.value)} className="input-focus" />
            </div>
            
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={() => setShowAdvancedSearch(!showAdvancedSearch)} style={{ padding: "0.75rem 1.25rem", height: "42px", backgroundColor: showAdvancedSearch ? colorScheme.primary : colorScheme.textLight, color: "white", border: "none", borderRadius: "0.75rem", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: "600", whiteSpace: "nowrap" }}>
                 {showAdvancedSearch ? "▲ Hide" : "▼ Filters"}
              </button>
              <button onClick={() => setFilters({ paymentStatus: "all", startDate: "", endDate: "" })} style={{ padding: "0.75rem 1rem", height: "42px", backgroundColor: "#E5E7EB", color: "#374151", border: "none", borderRadius: "0.75rem", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: "600", whiteSpace: "nowrap" }}>
                ✕ Clear
              </button>
            </div>
          </div>

          {showAdvancedSearch && (
            <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <span style={{ fontWeight: "700", fontSize: "0.9rem", color: colorScheme.text }}>🔍 Advanced Search Filters</span>
                <button onClick={resetAdvancedSearch} style={{ padding: "0.35rem 0.9rem", backgroundColor: "#E5E7EB", color: "#374151", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: "600" }}>✕ Clear Advanced</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>🏢 Company Name</label>
                  <input className="adv-input" type="text" placeholder="e.g. Aran" value={advancedSearch.companyName} onChange={e => setAdvancedSearch(p => ({ ...p, companyName: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>🔖 Payment Number</label>
                  <input className="adv-input" type="text" placeholder="e.g. BPAY-2024-..." value={advancedSearch.paymentNumber} onChange={e => setAdvancedSearch(p => ({ ...p, paymentNumber: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>📋 Hardcopy Bill Number</label>
                  <input className="adv-input" type="text" placeholder="Hardcopy bill #" value={advancedSearch.hardcopyBillNumber} onChange={e => setAdvancedSearch(p => ({ ...p, hardcopyBillNumber: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>📦 Bought Bill Number (ID)</label>
                  <input className="adv-input" type="text" placeholder="Bill ID fragment" value={advancedSearch.boughtBillNumber} onChange={e => setAdvancedSearch(p => ({ ...p, boughtBillNumber: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>🔄 Return Bill Number (ID)</label>
                  <input className="adv-input" type="text" placeholder="Return ID fragment" value={advancedSearch.returnBillNumber} onChange={e => setAdvancedSearch(p => ({ ...p, returnBillNumber: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>💵 Net Amount USD — Range</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#059669", fontWeight: "700", fontSize: "0.85rem" }}>$</span>
                      <input className="adv-input" type="number" placeholder="Min USD" style={{ paddingLeft: "1.5rem" }} value={advancedSearch.amountMinUSD} onChange={e => setAdvancedSearch(p => ({ ...p, amountMinUSD: e.target.value }))} />
                    </div>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#059669", fontWeight: "700", fontSize: "0.85rem" }}>$</span>
                      <input className="adv-input" type="number" placeholder="Max USD" style={{ paddingLeft: "1.5rem" }} value={advancedSearch.amountMaxUSD} onChange={e => setAdvancedSearch(p => ({ ...p, amountMaxUSD: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>🇮🇶 Net Amount IQD — Range</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#2563eb", fontWeight: "600", fontSize: "0.7rem" }}>IQD</span>
                      <input className="adv-input" type="number" placeholder="Min IQD" style={{ paddingRight: "3rem" }} value={advancedSearch.amountMinIQD} onChange={e => setAdvancedSearch(p => ({ ...p, amountMinIQD: e.target.value }))} />
                    </div>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#2563eb", fontWeight: "600", fontSize: "0.7rem" }}>IQD</span>
                      <input className="adv-input" type="number" placeholder="Max IQD" style={{ paddingRight: "3rem" }} value={advancedSearch.amountMaxIQD} onChange={e => setAdvancedSearch(p => ({ ...p, amountMaxIQD: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>
              {Object.values(advancedSearch).some(v => v !== "") && (
                <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", backgroundColor: "#EDE9FE", borderRadius: "0.5rem", fontSize: "0.78rem", color: colorScheme.dark, fontWeight: "600" }}>
                  ✓ {Object.values(advancedSearch).filter(v => v !== "").length} filter{Object.values(advancedSearch).filter(v => v !== "").length !== 1 ? "s" : ""} active — {filteredPayments.length} result{filteredPayments.length !== 1 ? "s" : ""} found
                </div>
              )}
            </div>
          )}

          {historyLoading ? (
            <div style={{ textAlign: "center", padding: "4rem" }}>
              <div className="modern-spinner-small"></div>
              <p style={{ marginTop: "1rem", color: colorScheme.textLight, fontSize: "0.9rem" }}>Loading payment history...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem", color: colorScheme.textLight }}>{paymentHistory.length === 0 ? "No payments yet" : "No payments match your search"}</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "1.25rem" }}>
              {filteredPayments.map((payment) => {
                const displayNumber = formatPaymentNumber(payment);
                const paymentImage = getPaymentImage(payment);
                return (
                  <div key={payment.id} style={{ border: "1px solid #E5E7EB", borderRadius: "1rem", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div style={{ background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`, padding: "0.9rem 1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: "bold", color: "white", fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayNumber}</div>
                          <div style={{ fontSize: "0.78rem", color: "#DDD6FE", marginTop: "0.1rem" }}>{payment.companyName}</div>
                          <div style={{ fontSize: "0.72rem", color: "#C4B5FD", marginTop: "0.1rem" }}>{formatDateToDMY(payment.paymentDate)}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "0.5rem" }}>
                          {(payment.netAmountIQD || 0) !== 0 && <div style={{ fontWeight: "bold", color: (payment.netAmountIQD || 0) >= 0 ? "white" : "#FCA5A5", fontSize: "0.85rem" }}>{(payment.netAmountIQD || 0) >= 0 ? "+" : ""}{formatCurrency(payment.netAmountIQD || 0)}</div>}
                          {(payment.netAmountUSD || 0) !== 0 && <div style={{ fontWeight: "bold", color: (payment.netAmountUSD || 0) >= 0 ? "#DDD6FE" : "#FCA5A5", fontSize: "0.8rem" }}>{(payment.netAmountUSD || 0) >= 0 ? "+" : ""}{formatUSD(payment.netAmountUSD || 0)}</div>}
                          {(payment.netAmountIQD || 0) === 0 && (payment.netAmountUSD || 0) === 0 && <div style={{ color: "#DDD6FE", fontSize: "0.8rem" }}>$0.00</div>}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: "0.9rem 1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem", fontSize: "0.8rem", color: colorScheme.textLight, flexWrap: "wrap", gap: "0.25rem" }}>
                        <span>📦 Bills: <strong>{payment.selectedBoughtBills?.length || 0}</strong></span>
                        <span>🔄 Returns: <strong>{payment.selectedBoughtReturns?.length || 0}</strong></span>
                        <span>👤 <strong>{getFirstName(payment.createdByName)}</strong></span>
                      </div>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        <button onClick={() => handleViewPayment(payment)}
                          style={{ flex: "1 1 40px", padding: "0.45rem 0.3rem", backgroundColor: "#6B7280", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.75rem", fontFamily: "inherit" }}>
                          👁️ View
                        </button>
                        <button onClick={() => handlePrintPayment(payment)}
                          style={{ flex: "1 1 40px", padding: "0.45rem 0.3rem", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.75rem", fontFamily: "inherit" }}>
                          🖨️ Print
                        </button>
                        {paymentImage ? (
                          <button onClick={() => handleViewImage(paymentImage)}
                            style={{ flex: "1 1 40px", padding: "0.45rem 0.3rem", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.75rem", fontFamily: "inherit" }}>
                            🖼️ Image
                          </button>
                        ) : (
                          <button disabled style={{ flex: "1 1 40px", padding: "0.45rem 0.3rem", backgroundColor: "#E5E7EB", color: "#9CA3AF", border: "none", borderRadius: "0.5rem", cursor: "not-allowed", fontWeight: "600", fontSize: "0.75rem" }}>🖼️ —</button>
                        )}
                        <button onClick={() => handleUpdatePayment(payment)}
                          style={{ flex: "1 1 40px", padding: "0.45rem 0.3rem", backgroundColor: "#06B6D4", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.75rem", fontFamily: "inherit" }}>
                          ✏️ Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ✅ BEAUTIFUL STATEMENT MODAL - REFINED FONTS & LAYOUT */}
      {showPaymentModal && selectedPayment && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", overflowY: "auto", backdropFilter: "blur(4px)" }} onClick={closePaymentModal}>
          <div style={{ width: "100%", maxWidth: "850px", maxHeight: "90vh", display: "flex", flexDirection: "column", background: "white", borderRadius: "1.25rem", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`, padding: "1.25rem 1.5rem", borderRadius: "1.25rem 1.25rem 0 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <h2 style={{ color: "white", margin: 0, fontSize: "1.2rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>📑</span> Payment Statement
                </h2>
                <div style={{ color: "#E0E7FF", fontSize: "0.85rem", marginTop: "0.2rem", fontWeight: "500", letterSpacing: "0.05em" }}>{formatPaymentNumber(selectedPayment)}</div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={() => handlePrintPayment(selectedPayment)} style={{ background: "white", border: "none", color: colorScheme.dark, fontSize: "0.8rem", cursor: "pointer", borderRadius: "0.5rem", padding: "0.4rem 1rem", fontWeight: "700", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>🖨️ Print</button>
                <button onClick={closePaymentModal} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", fontSize: "1.25rem", cursor: "pointer", borderRadius: "0.5rem", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.3)"} onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,0.2)"}>✕</button>
              </div>
            </div>

            {/* Modal Body (Scrollable) */}
            <div style={{ padding: "1.5rem", overflowY: "auto", flex: 1 }}>
              
              {/* Top Info Header */}
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem", paddingBottom: "1.25rem", borderBottom: "1px solid #E5E7EB" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Bill To</div>
                  <div style={{ fontSize: "1.05rem", fontWeight: "700", color: colorScheme.text }}>{selectedPayment.companyName}</div>
                  <div style={{ fontSize: "0.8rem", color: colorScheme.textLight, marginTop: "0.25rem" }}>Hardcopy: <span style={{ fontWeight: "600", color: colorScheme.text }}>{selectedPayment.hardcopyBillNumber}</span></div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Payment Details</div>
                  <div style={{ fontSize: "0.9rem", fontWeight: "600", color: colorScheme.text }}>{formatDateToDMY(selectedPayment.paymentDate)}</div>
                  <div style={{ fontSize: "0.8rem", color: colorScheme.textLight, marginTop: "0.25rem" }}>Processed by: {getFirstName(selectedPayment.createdByName)}</div>
                </div>
              </div>

              {/* Summary Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                {/* Bought */}
                <div style={{ background: "#F0FDF4", border: "1px solid #A7F3D0", borderRadius: "1rem", padding: "1rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#059669", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>📦 Total Bought</div>
                  {(() => {
                    const bUSD = selectedPayment.boughtTotalUSD || 0;
                    const bIQD = selectedPayment.boughtTotalIQD || 0;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        {bUSD > 0 && <div style={{ color: "#059669", fontWeight: "700", fontSize: "1.1rem" }}>+{formatUSD(bUSD)}</div>}
                        {bIQD > 0 && <div style={{ color: "#2563eb", fontWeight: "700", fontSize: "1.1rem" }}>+{formatCurrency(bIQD)}</div>}
                        {bUSD === 0 && bIQD === 0 && <div style={{ color: "#9CA3AF", fontSize: "1.1rem", fontWeight: "600" }}>$0.00</div>}
                      </div>
                    );
                  })()}
                </div>
                {/* Return */}
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "1rem", padding: "1rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>🔄 Total Return</div>
                  {(() => {
                    const rUSD = selectedPayment.returnTotalUSD || 0;
                    const rIQD = selectedPayment.returnTotalIQD || 0;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        {rUSD > 0 && <div style={{ color: "#dc2626", fontWeight: "700", fontSize: "1.1rem" }}>−{formatUSD(rUSD)}</div>}
                        {rIQD > 0 && <div style={{ color: "#b91c1c", fontWeight: "700", fontSize: "1.1rem" }}>−{formatCurrency(rIQD)}</div>}
                        {rUSD === 0 && rIQD === 0 && <div style={{ color: "#9CA3AF", fontSize: "1.1rem", fontWeight: "600" }}>$0.00</div>}
                      </div>
                    );
                  })()}
                </div>
                {/* Net */}
                <div style={{ background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)", border: "1px solid #C7D2FE", borderRadius: "1rem", padding: "1rem", boxShadow: "0 4px 6px -1px rgba(79, 70, 229, 0.1)" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>💰 Net Amount Paid</div>
                  {(() => {
                    const nUSD = selectedPayment.netAmountUSD || 0;
                    const nIQD = selectedPayment.netAmountIQD || 0;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        {nUSD !== 0 && <div style={{ color: nUSD > 0 ? "#059669" : "#DC2626", fontWeight: "700", fontSize: "1.15rem" }}>{nUSD > 0 ? "+" : ""}{formatUSD(nUSD)}</div>}
                        {nIQD !== 0 && <div style={{ color: nIQD > 0 ? "#2563eb" : "#B91C1C", fontWeight: "700", fontSize: "1.15rem" }}>{nIQD > 0 ? "+" : ""}{formatCurrency(nIQD)}</div>}
                        {nUSD === 0 && nIQD === 0 && <div style={{ color: "#9CA3AF", fontSize: "1.15rem", fontWeight: "600" }}>$0.00</div>}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Bought Bills Table */}
              {paymentDetails[selectedPayment.id]?.boughtBills?.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: "700", marginBottom: "0.75rem", color: colorScheme.text, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{background: "#D1FAE5", padding: "4px", borderRadius: "6px"}}>📦</span> Bought Bills
                  </h3>
                  <div style={{ overflowX: "auto", border: "1px solid #E5E7EB", borderRadius: "0.75rem" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                      <thead>
                        <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", fontSize: "0.7rem" }}>Bill #</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", fontSize: "0.7rem" }}>Date</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", fontSize: "0.7rem" }}>Note</th>
                          <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", fontSize: "0.7rem" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentDetails[selectedPayment.id].boughtBills.map((bill, i) => (
                          <tr key={bill.id} style={{ borderBottom: i === paymentDetails[selectedPayment.id].boughtBills.length - 1 ? "none" : "1px solid #F3F4F6", background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                            <td style={{ padding: "10px 12px", fontWeight: "600", color: colorScheme.text }}>#{bill.billNumber || bill.id}</td>
                            <td style={{ padding: "10px 12px", color: colorScheme.textLight }}>{formatDateToDMY(bill.date)}</td>
                            <td style={{ padding: "10px 12px", color: colorScheme.textLight, fontStyle: "italic", fontSize: "0.8rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bill.billNote || "—"}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "600", color: "#059669" }}>
                              +{getDisplayAmount(bill.totalAmountUSD || 0, bill.totalAmountIQD || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Returns Table */}
              {paymentDetails[selectedPayment.id]?.returns?.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: "700", marginBottom: "0.75rem", color: colorScheme.text, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{background: "#FEE2E2", padding: "4px", borderRadius: "6px"}}>🔄</span> Returns
                  </h3>
                  <div style={{ overflowX: "auto", border: "1px solid #E5E7EB", borderRadius: "0.75rem" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                      <thead>
                        <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", fontSize: "0.7rem" }}>Return #</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", fontSize: "0.7rem" }}>Date</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", fontSize: "0.7rem" }}>Note</th>
                          <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", fontSize: "0.7rem" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentDetails[selectedPayment.id].returns.map((ret, i) => (
                          <tr key={ret.id} style={{ borderBottom: i === paymentDetails[selectedPayment.id].returns.length - 1 ? "none" : "1px solid #F3F4F6", background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                            <td style={{ padding: "10px 12px", fontWeight: "600", color: colorScheme.text }}>#{ret.returnBillNumber || ret.id?.slice(-6)}</td>
                            <td style={{ padding: "10px 12px", color: colorScheme.textLight }}>{formatDateToDMY(ret.returnDate || ret.date)}</td>
                            <td style={{ padding: "10px 12px", color: colorScheme.textLight, fontStyle: "italic", fontSize: "0.8rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ret.returnNote || "—"}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "600", color: "#DC2626" }}>
                              -{getDisplayAmount(ret.totalReturnUSD || 0, ret.totalReturnIQD || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Payment Notes */}
              {selectedPayment.notes && (
                <div style={{ padding: "1rem", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "0.75rem", fontSize: "0.85rem" }}>
                  <div style={{ fontWeight: "700", color: "#B45309", marginBottom: "0.25rem" }}>📝 Payment Notes</div>
                  <div style={{ color: colorScheme.text }}>{selectedPayment.notes}</div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && selectedImageUrl && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" }}
          onClick={closeImageModal}>
          <div style={{ maxWidth: "90vw", maxHeight: "90vh", background: "white", borderRadius: "0.75rem", padding: "0.75rem" }} onClick={(e) => e.stopPropagation()}>
            <img src={selectedImageUrl} alt="Full Bill" style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", display: "block", filter: "grayscale(100%)" }} />
            <div style={{ textAlign: "center", marginTop: "0.6rem" }}>
              <button onClick={closeImageModal} style={{ padding: "0.5rem 1.5rem", backgroundColor: colorScheme.primary, color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontFamily: "inherit", fontWeight: "600" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}