"use client";

import { useState, useEffect, useMemo } from "react";
import * as XLSX from 'xlsx';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Download,
  AlertCircle,
  Building2,
  Hash,
  Phone,
  MapPin,
  X,
  CheckCircle2,
  Loader2
} from "lucide-react";
import {
  getPharmacies,
  addPharmacy,
  updatePharmacy,
  deletePharmacy
} from "@/lib/data";

// FIX: Define InputWrapper OUTSIDE the main component so it doesn't unmount on every keystroke
const InputWrapper = ({ label, icon: Icon, children, errorMsg }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
    <label style={{ 
      fontSize: "0.9rem", 
      color: "#475569", 
      display: "flex", 
      alignItems: "center", 
      gap: "0.4rem",
      fontFamily: "var(--font-nrt-bd)" // NRT Bold font
    }}>
      <Icon size={16} color="#64748b" /> {label}
    </label>
    {children}
    {errorMsg && (
      <span style={{ color: "#ef4444", fontSize: "0.8rem", fontFamily: "var(--font-nrt-reg)" }}>
        {errorMsg}
      </span>
    )}
  </div>
);

export default function PharmaciesPage() {
  const [pharmacies, setPharmacies] = useState([]);
  const [filteredPharmacies, setFilteredPharmacies] = useState([]);
  const [editingPharmacy, setEditingPharmacy] = useState(null);
  
  const [newPharmacy, setNewPharmacy] = useState({
    name: "",
    code: "",
    phone: "",
    phone2: "",
    city: "سلێمانی"
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [codeError, setCodeError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState({
    name: "",
    code: "",
    city: ""
  });
  
  const [sortConfig, setSortConfig] = useState({
    key: "code",
    direction: "desc"
  });

  const cities = [
    "سلێمانی",
    "هەولێر",
    "دهۆک",
    "کەرکوک",
    "کەلار",
    "بەغداد",
    "هەڵەبجە"
  ];

  // Helper: Automatically generate the next available code
  const generateNextCode = (pharmaciesList) => {
    if (!pharmaciesList || pharmaciesList.length === 0) return "1";
    let max = 0;
    pharmaciesList.forEach(p => {
      const num = parseInt((p.code || "").toString().replace(/\D/g, ''));
      if (!isNaN(num) && num > max) max = num;
    });
    return (max + 1).toString();
  };

  const resetForm = (list = pharmacies) => {
    setEditingPharmacy(null);
    setNewPharmacy({ 
      name: "", 
      code: generateNextCode(list), 
      phone: "", 
      phone2: "", 
      city: "سلێمانی" 
    });
    setCodeError("");
  };

  useEffect(() => {
    const fetchPharmacies = async () => {
      try {
        setIsLoading(true);
        const data = await getPharmacies();
        setPharmacies(data);
        setFilteredPharmacies(data);
        
        // Auto-assign code if we are not editing
        if (!editingPharmacy) {
          setNewPharmacy(prev => ({ ...prev, code: generateNextCode(data) }));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPharmacies();
  }, [refreshTrigger]);

  // Master Filter & Sort Effect
  useEffect(() => {
    let filtered = pharmacies.filter(pharmacy => {
      return (
        (pharmacy.name || "").toLowerCase().includes(searchQuery.name.toLowerCase()) &&
        (pharmacy.code || "").toLowerCase().includes(searchQuery.code.toLowerCase()) &&
        (pharmacy.city || "").toLowerCase().includes(searchQuery.city.toLowerCase())
      );
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key] || "";
        let bValue = b[sortConfig.key] || "";
        
        if (sortConfig.key === "code") {
          const aNum = parseFloat(aValue.toString().replace(/[^\d.-]/g, ''));
          const bNum = parseFloat(bValue.toString().replace(/[^\d.-]/g, ''));
          
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
          }
          if (!isNaN(aNum) && isNaN(bNum)) return -1;
          if (isNaN(aNum) && !isNaN(bNum)) return 1;
        }
        
        aValue = aValue.toString().toLowerCase();
        bValue = bValue.toString().toLowerCase();
        
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    setFilteredPharmacies(filtered);
  }, [searchQuery, pharmacies, sortConfig]);

  // Validation Helper
  const checkDuplicateCode = (code, currentId = null) => {
    return pharmacies.some(p => p.code.toString().toLowerCase() === code.toString().toLowerCase() && p.id !== currentId);
  };

  const handleAddPharmacy = async () => {
    if (!newPharmacy.name || !newPharmacy.code) {
      setError("تکایە ناو و کۆد پڕبکەرەوە.");
      return;
    }
    if (checkDuplicateCode(newPharmacy.code)) {
      setCodeError("ئەم کۆدە پێشتر بەکارهاتووە! تکایە کۆدێکی تر بنووسە.");
      return;
    }
    
    try {
      await addPharmacy(newPharmacy);
      setRefreshTrigger(!refreshTrigger);
      resetForm(pharmacies);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdatePharmacy = async () => {
    if (!editingPharmacy || !editingPharmacy.id) return;
    if (!editingPharmacy.name || !editingPharmacy.code) {
      setError("تکایە ناو و کۆد پڕبکەرەوە.");
      return;
    }
    if (checkDuplicateCode(editingPharmacy.code, editingPharmacy.id)) {
      setCodeError("ئەم کۆدە پێشتر بۆ دەرمانخانەیەکی تر بەکارهاتووە!");
      return;
    }
    
    try {
      await updatePharmacy(editingPharmacy);
      setRefreshTrigger(!refreshTrigger);
      resetForm(pharmacies);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (pharmacy) => {
    setEditingPharmacy({ ...pharmacy });
    setCodeError("");
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm("دڵنیایت دەتەوێت ئەم دەرمانخانەیە بسڕیتەوە؟")) {
      try {
        await deletePharmacy(id);
        setRefreshTrigger(!refreshTrigger);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    setSearchQuery(prev => ({ ...prev, [name]: value }));
  };

  const handleFormChange = (e, isEditing) => {
    const { name, value } = e.target;
    
    if (isEditing) {
      setEditingPharmacy(prev => ({ ...prev, [name]: value }));
      if (name === 'code') {
        setCodeError(checkDuplicateCode(value, editingPharmacy.id) ? "ئەم کۆدە پێشتر بەکارهاتووە!" : "");
      }
    } else {
      setNewPharmacy(prev => ({ ...prev, [name]: value }));
      if (name === 'code') {
        setCodeError(checkDuplicateCode(value) ? "ئەم کۆدە پێشتر بەکارهاتووە!" : "");
      }
    }
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleWhatsApp = (phone) => {
    if (!phone) return alert("ژمارەی مۆبایل بۆ ئەم دەرمانخانەیە نییە");
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('964') ? cleanPhone : `964${cleanPhone.replace(/^0+/, '')}`;
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  const exportToExcel = () => {
    try {
      const exportData = filteredPharmacies.map((pharmacy, index) => ({
        'ژمارە': index + 1,
        'ناو': pharmacy.name,
        'کۆد': pharmacy.code,
        'ژمارەی مۆبایل (کڕین)': pharmacy.phone || '---',
        'ژمارەی مۆبایل (ئەژمێردار)': pharmacy.phone2 || '---',
        'شار': pharmacy.city || '---',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws, 'دەرمانخانەکان');
      XLSX.writeFile(wb, `دەرمانخانەکان_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
    } catch (err) {
      setError('Export failed: ' + err.message);
    }
  };

  const activeForm = editingPharmacy || newPharmacy;

  return (
    <div dir="rtl" style={{ fontFamily: "var(--font-nrt-reg)", width: "100%", minHeight: "100vh", padding: 0, margin: 0, boxSizing: "border-box", overflowX: "hidden" }}>
      
      {/* CSS For Enhanced Inputs & Transitions */}
      <style dangerouslySetInnerHTML={{__html: `
        *, *::before, *::after { box-sizing: border-box; }
        .nice-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.5rem;
          outline: none;
          font-size: 0.95rem;
          font-family: var(--font-nrt-reg);
          background-color: #f8fafc;
          transition: all 0.2s ease-in-out;
          color: #0f172a;
          box-sizing: border-box;
        }
        .nice-input:focus {
          border-color: #3b82f6;
          background-color: #ffffff;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
        }
        .nice-input::placeholder {
          color: #94a3b8;
        }
        .error-input {
          border-color: #ef4444 !important;
          background-color: #fef2f2 !important;
        }
        .error-input:focus {
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.15) !important;
        }
      `}} />

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem", padding: "1.5rem 1.5rem 0 1.5rem", width: "100%", boxSizing: "border-box" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontFamily: "var(--font-nrt-bd)", color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Building2 size={28} color="#2563eb" /> دەرمانخانەکان
          </h1>
          <p style={{ margin: "0.25rem 0 0 0", color: "#64748b", fontSize: "0.95rem" }}>بەڕێوەبردن و تۆمارکردنی لیستی دەرمانخانەکان</p>
        </div>
        <button
          onClick={exportToExcel}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", backgroundColor: "#10b981", color: "white", border: "none", borderRadius: "0.5rem", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", transition: "background 0.2s", boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.2)" }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = "#059669"}
          onMouseOut={e => e.currentTarget.style.backgroundColor = "#10b981"}
        >
          <Download size={18} /> export to excel 
        </button>
      </div>

      {/* ERROR MESSAGE */}
      <div style={{ padding: "0 1.5rem", width: "100%", boxSizing: "border-box" }}>
        {error && (
          <div style={{ padding: "1rem", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "0.5rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #fca5a5", width: "100%", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "var(--font-nrt-bd)" }}>
              <AlertCircle size={20} /> {error}
            </div>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer" }}><X size={20} /></button>
          </div>
        )}
      </div>

      {/* CREATE / EDIT FORM */}
      <div style={{ backgroundColor: "white", borderRadius: 0, borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", boxShadow: "none", padding: "1.5rem", marginBottom: "1.5rem", width: "100%", boxSizing: "border-box" }}>
        <h2 style={{ fontSize: "1.25rem", fontFamily: "var(--font-nrt-bd)", color: "#1e293b", marginBottom: "1.5rem", borderBottom: "2px solid #f1f5f9", paddingBottom: "0.75rem" }}>
          {editingPharmacy ? "گۆڕانکاری لە دەرمانخانە" : "تۆمارکردنی دەرمانخانەی نوێ"}
        </h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem", width: "100%", boxSizing: "border-box" }}>
          <InputWrapper label="ناوی دەرمانخانە" icon={Building2}>
            <input
              type="text"
              name="name"
              className="nice-input"
              value={activeForm.name}
              onChange={(e) => handleFormChange(e, !!editingPharmacy)}
            />
          </InputWrapper>

          <InputWrapper label="کۆدی دەرمانخانە " icon={Hash} errorMsg={codeError}>
            <input
              type="text"
              name="code"
              className={`nice-input ${codeError ? 'error-input' : ''}`}
              value={activeForm.code}
              onChange={(e) => handleFormChange(e, !!editingPharmacy)}
            />
          </InputWrapper>

          <InputWrapper label="ژمارەی مۆبایل (بەرپرسی کڕین)" icon={Phone}>
            <input
              type="text"
              name="phone"
              className="nice-input"
              placeholder="07XX XXX XXXX"
              value={activeForm.phone}
              onChange={(e) => handleFormChange(e, !!editingPharmacy)}
              style={{ direction: "ltr", textAlign: "right" }}
            />
          </InputWrapper>

          <InputWrapper label="ژمارەی مۆبایل (محاسب)" icon={Phone}>
            <input
              type="text"
              name="phone2"
              className="nice-input"
              placeholder="07XX XXX XXXX"
              value={activeForm.phone2}
              onChange={(e) => handleFormChange(e, !!editingPharmacy)}
              style={{ direction: "ltr", textAlign: "right" }}
            />
          </InputWrapper>

          <InputWrapper label="شار" icon={MapPin}>
            <select
              name="city"
              className="nice-input"
              value={activeForm.city}
              onChange={(e) => handleFormChange(e, !!editingPharmacy)}
              style={{ cursor: "pointer" }}
            >
              {cities.map(city => <option key={city} value={city}>{city}</option>)}
            </select>
          </InputWrapper>
        </div>

        <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", width: "100%", boxSizing: "border-box" }}>
          <button
            onClick={editingPharmacy ? handleUpdatePharmacy : handleAddPharmacy}
            disabled={!!codeError}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", backgroundColor: codeError ? "#94a3b8" : "#2563eb", color: "white", border: "none", borderRadius: "0.5rem", fontFamily: "var(--font-nrt-bd)", cursor: codeError ? "not-allowed" : "pointer", transition: "background 0.2s" }}
          >
            {editingPharmacy ? <><CheckCircle2 size={18} /> پاشەکەوتکردنی گۆڕانکاری</> : <><Plus size={18} /> زیادکردنی دەرمانخانە</>}
          </button>
          
          {(editingPharmacy || newPharmacy.name || newPharmacy.phone) && (
            <button
              onClick={() => resetForm(pharmacies)}
              style={{ padding: "0.75rem 1.5rem", backgroundColor: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "0.5rem", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", transition: "all 0.2s" }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = "#e2e8f0"}
              onMouseOut={e => e.currentTarget.style.backgroundColor = "#f1f5f9"}
            >
              پاشگەزبوونەوە / پاککردنەوە
            </button>
          )}
        </div>
      </div>

      {/* SEARCH AND FILTER SECTION */}
      <div style={{ backgroundColor: "white", borderRadius: 0, borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", boxShadow: "none", overflow: "hidden", width: "100%", boxSizing: "border-box" }}>
        
        <div style={{ backgroundColor: "#f8fafc", padding: "1.5rem", borderBottom: "1px solid #e2e8f0", width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", color: "#0f172a", fontFamily: "var(--font-nrt-bd)" }}>
            <Search size={20} color="#64748b" /> گەڕانی پێشکەوتوو
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", width: "100%", boxSizing: "border-box" }}>
            <input
              type="text"
              name="name"
              className="nice-input"
              placeholder="گەڕان بەپێی ناو..."
              value={searchQuery.name}
              onChange={handleSearchChange}
            />
            <input
              type="text"
              name="code"
              className="nice-input"
              placeholder="گەڕان بەپێی کۆد..."
              value={searchQuery.code}
              onChange={handleSearchChange}
            />
            <input
              type="text"
              name="city"
              className="nice-input"
              placeholder="گەڕان بەپێی شار..."
              value={searchQuery.city}
              onChange={handleSearchChange}
            />
          </div>
        </div>

        <div style={{ padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", borderBottom: "1px solid #e2e8f0", width: "100%", boxSizing: "border-box" }}>
          <span style={{ color: "#475569", fontFamily: "var(--font-nrt-bd)" }}>
            کۆی گشتی دۆزراوەکان: <span style={{ color: "#2563eb", fontWeight: 800 }}>{filteredPharmacies.length}</span> دەرمانخانە
          </span>
        </div>

        {/* TABLE */}
        <div style={{ overflowX: "auto", width: "100%", boxSizing: "border-box" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px", textAlign: "right", margin: 0 }}>
            <thead style={{ backgroundColor: "#f8fafc", color: "#334155", fontFamily: "var(--font-nrt-bd)" }}>
              <tr>
                <th onClick={() => handleSort("name")} style={{ padding: "1rem", cursor: "pointer", borderBottom: "2px solid #e2e8f0" }}>
                  ناو {sortConfig.key === "name" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSort("code")} style={{ padding: "1rem", cursor: "pointer", borderBottom: "2px solid #e2e8f0" }}>
                  کۆد {sortConfig.key === "code" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th style={{ padding: "1rem", borderBottom: "2px solid #e2e8f0" }}>ژ.مۆبایل (کڕین)</th>
                <th style={{ padding: "1rem", borderBottom: "2px solid #e2e8f0" }}>ژ.مۆبایل (محاسب)</th>
                <th style={{ padding: "1rem", borderBottom: "2px solid #e2e8f0" }}>شار</th>
                <th style={{ padding: "1rem", borderBottom: "2px solid #e2e8f0", textAlign: "center" }}>کردارەکان</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
                    <Loader2 size={32} style={{ animation: "spin 1s linear infinite", margin: "0 auto 1rem", color: "#2563eb" }} />
                    زانیارییەکان باردەکرێن...
                  </td>
                </tr>
              ) : filteredPharmacies.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: "3rem", textAlign: "center", color: "#94a3b8", fontFamily: "var(--font-nrt-bd)" }}>
                    هیچ دەرمانخانەیەک نەدۆزرایەوە بەم زانیاریانە.
                  </td>
                </tr>
              ) : (
                filteredPharmacies.map((pharmacy) => (
                  <tr key={pharmacy.id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                    <td style={{ padding: "1rem", fontFamily: "var(--font-nrt-bd)", color: "#0f172a" }}>{pharmacy.name}</td>
                    <td style={{ padding: "1rem", color: "#475569" }}>
                      <span style={{ backgroundColor: "#e2e8f0", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", fontSize: "0.85rem", fontFamily: "var(--font-nrt-bd)" }}>{pharmacy.code}</span>
                    </td>
                    <td style={{ padding: "1rem", color: "#475569", direction: "ltr", textAlign: "right" }}>
                      {pharmacy.phone ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
                          {pharmacy.phone}
                          <button onClick={() => handleWhatsApp(pharmacy.phone)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }} title="ناردنی وەتسئەپ">
                            <img src="/whatsappicon.png" alt="WA" style={{ width: "22px", transition: "transform 0.2s" }} onMouseOver={e => e.currentTarget.style.transform="scale(1.1)"} onMouseOut={e => e.currentTarget.style.transform="scale(1)"} />    
                          </button>
                        </div>
                      ) : "---"}
                    </td>
                    <td style={{ padding: "1rem", color: "#475569", direction: "ltr", textAlign: "right" }}>
                      {pharmacy.phone2 ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
                          {pharmacy.phone2}
                          <button onClick={() => handleWhatsApp(pharmacy.phone2)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }} title="ناردنی وەتسئەپ">
                            <img src="/whatsappicon.png" alt="WA" style={{ width: "22px", transition: "transform 0.2s" }} onMouseOver={e => e.currentTarget.style.transform="scale(1.1)"} onMouseOut={e => e.currentTarget.style.transform="scale(1)"} />    
                          </button>
                        </div>
                      ) : "---"}
                    </td>
                    <td style={{ padding: "1rem", color: "#475569" }}>{pharmacy.city || "---"}</td>
                    <td style={{ padding: "1rem", display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                      <button
                        onClick={() => handleEdit(pharmacy)}
                        style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.5rem 0.75rem", backgroundColor: "#eff6ff", color: "#2563eb", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontFamily: "var(--font-nrt-bd)", fontSize: "0.85rem", transition: "background 0.2s" }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = "#dbeafe"}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = "#eff6ff"}
                      >
                        <Edit3 size={16} /> دەستکاری
                      </button>
                      <button
                        onClick={() => handleDelete(pharmacy.id)}
                        style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.5rem 0.75rem", backgroundColor: "#fef2f2", color: "#dc2626", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontFamily: "var(--font-nrt-bd)", fontSize: "0.85rem", transition: "background 0.2s" }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = "#fee2e2"}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = "#fef2f2"}
                      >
                        <Trash2 size={16} /> سڕینەوە
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}