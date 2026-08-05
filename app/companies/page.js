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
  Map,
  X,
  CheckCircle2,
  Loader2
} from "lucide-react";
import {
  getCompanies,
  addCompany,
  updateCompany,
  deleteCompany
} from "@/lib/data";

// Define InputWrapper OUTSIDE the main component to prevent focus loss on typing
const InputWrapper = ({ label, icon: Icon, children, errorMsg }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
    <label style={{ 
      fontSize: "0.9rem", 
      color: "#475569", 
      display: "flex", 
      alignItems: "center", 
      gap: "0.4rem",
      fontFamily: "var(--font-nrt-bd)"
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

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [editingCompany, setEditingCompany] = useState(null);
  
  const [newCompany, setNewCompany] = useState({
    name: "",
    code: "",
    phone: "",
    city: "سلێمانی", // Set default city
    location: ""
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [codeError, setCodeError] = useState(""); // Warning for duplicate codes
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState({
    name: "",
    code: "",
    phone: "",
    city: "",
    location: ""
  });
  
  const [sortConfig, setSortConfig] = useState({
    key: "code",
    direction: "desc"
  });

  // Array of cities for the combo box
  const cities = [
    "ئێران",
    "تورکیا",
    "سلێمانی",
    "هەولێر",
    "دهۆک",
    "بەغداد",
    "ئەڵمانیا",
    "سین",

  ];

  // Helper: Automatically generate the next available code
  const generateNextCode = (companiesList) => {
    if (!companiesList || companiesList.length === 0) return "1";
    let max = 0;
    companiesList.forEach(c => {
      const num = parseInt((c.code || "").toString().replace(/\D/g, ''));
      if (!isNaN(num) && num > max) max = num;
    });
    return (max + 1).toString();
  };

  const resetForm = (list = companies) => {
    setEditingCompany(null);
    setNewCompany({ 
      name: "", 
      code: generateNextCode(list), 
      phone: "", 
      city: "سلێمانی", 
      location: "" 
    });
    setCodeError("");
  };

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setIsLoading(true);
        const data = await getCompanies();
        setCompanies(data);
        setFilteredCompanies(data);
        
        // Auto-assign code if we are not editing
        if (!editingCompany) {
          setNewCompany(prev => ({ ...prev, code: generateNextCode(data) }));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCompanies();
  }, [refreshTrigger]);

  // Master Filter & Sort Effect
  useEffect(() => {
    let filtered = companies.filter(company => {
      return (
        (company.name || "").toLowerCase().includes(searchQuery.name.toLowerCase()) &&
        (company.code || "").toLowerCase().includes(searchQuery.code.toLowerCase()) &&
        (company.phone || "").toLowerCase().includes(searchQuery.phone.toLowerCase()) &&
        (company.city || "").toLowerCase().includes(searchQuery.city.toLowerCase()) &&
        (company.location || "").toLowerCase().includes(searchQuery.location.toLowerCase())
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

    setFilteredCompanies(filtered);
  }, [searchQuery, companies, sortConfig]);

  // Validation Helper
  const checkDuplicateCode = (code, currentId = null) => {
    return companies.some(c => c.code.toString().toLowerCase() === code.toString().toLowerCase() && c.id !== currentId);
  };

  const handleAddCompany = async () => {
    if (!newCompany.name || !newCompany.code) {
      setError("تکایە ناو و کۆد پڕبکەرەوە.");
      setSuccess(null);
      return;
    }
    if (checkDuplicateCode(newCompany.code)) {
      setCodeError("ئەم کۆدە پێشتر بەکارهاتووە! تکایە کۆدێکی تر بنووسە.");
      return;
    }
    
    try {
      await addCompany(newCompany);
      setSuccess("کۆمپانیا بە سەرکەوتوویی زیادکرا!");
      setRefreshTrigger(!refreshTrigger);
      resetForm(companies);
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
      setSuccess(null);
    }
  };

  const handleUpdateCompany = async () => {
    if (!editingCompany || !editingCompany.id) return;
    if (!editingCompany.name || !editingCompany.code) {
      setError("تکایە ناو و کۆد پڕبکەرەوە.");
      setSuccess(null);
      return;
    }
    if (checkDuplicateCode(editingCompany.code, editingCompany.id)) {
      setCodeError("ئەم کۆدە پێشتر بۆ کۆمپانیایەکی تر بەکارهاتووە!");
      return;
    }
    
    try {
      await updateCompany(editingCompany.id, editingCompany);
      setSuccess("کۆمپانیا بە سەرکەوتوویی نوێکرایەوە!");
      setRefreshTrigger(!refreshTrigger);
      resetForm(companies);
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
      setSuccess(null);
    }
  };

  const handleEdit = (company) => {
    setEditingCompany({ ...company });
    setCodeError("");
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm("دڵنیایت دەتەوێت ئەم کۆمپانیایە بسڕیتەوە؟")) {
      try {
        await deleteCompany(id);
        setSuccess("کۆمپانیا بە سەرکەوتوویی سڕایەوە!");
        setRefreshTrigger(!refreshTrigger);
        setTimeout(() => setSuccess(null), 3000);
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
      setEditingCompany(prev => ({ ...prev, [name]: value }));
      if (name === 'code') {
        setCodeError(checkDuplicateCode(value, editingCompany.id) ? "ئەم کۆدە پێشتر بەکارهاتووە!" : "");
      }
    } else {
      setNewCompany(prev => ({ ...prev, [name]: value }));
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
    if (!phone) return alert("ژمارەی تەلەفون بۆ ئەم کۆمپانیایە نییە");
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('964') ? cleanPhone : `964${cleanPhone.replace(/^0+/, '')}`;
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  const exportToExcel = () => {
    try {
      const exportData = filteredCompanies.map((company, index) => ({
        'ژمارە': index + 1,
        'ناو': company.name,
        'کۆد': company.code,
        'ژمارەی تەلەفون': company.phone || '---',
        'شار': company.city || '---',
        'ناونیشان': company.location || '---',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, ws, 'کۆمپانیاکان');
      XLSX.writeFile(wb, `کۆمپانیاکان_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
    } catch (err) {
      setError('Export failed: ' + err.message);
    }
  };

  const activeForm = editingCompany || newCompany;

  return (
    <div dir="rtl" style={{ fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: "1500px", margin: "0 auto", padding: "24px" }}>
      
      {/* CSS For Enhanced Inputs & Transitions */}
      <style dangerouslySetInnerHTML={{__html: `
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontFamily: "var(--font-nrt-bd)", color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Building2 size={28} color="#2563eb" /> کۆمپانیاکان
          </h1>
          <p style={{ margin: "0.25rem 0 0 0", color: "#64748b", fontSize: "0.95rem", fontFamily: "var(--font-nrt-reg)" }}>بەڕێوەبردن و تۆمارکردنی لیستی کۆمپانیاکان</p>
        </div>
        <button
          onClick={exportToExcel}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", backgroundColor: "#10b981", color: "white", border: "none", borderRadius: "0.5rem", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", transition: "background 0.2s", boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.2)" }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = "#059669"}
          onMouseOut={e => e.currentTarget.style.backgroundColor = "#10b981"}
        >
          <Download size={18} />  export to excel
        </button>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "0.5rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #fca5a5" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "var(--font-nrt-bd)" }}>
            <AlertCircle size={20} /> {error}
          </div>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer" }}><X size={20} /></button>
        </div>
      )}

      {/* SUCCESS MESSAGE */}
      {success && (
        <div style={{ padding: "1rem", backgroundColor: "#f0fdf4", color: "#15803d", borderRadius: "0.5rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #bbf7d0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "var(--font-nrt-bd)" }}>
            <CheckCircle2 size={20} /> {success}
          </div>
          <button onClick={() => setSuccess(null)} style={{ background: "none", border: "none", color: "#15803d", cursor: "pointer" }}><X size={20} /></button>
        </div>
      )}

      {/* CREATE / EDIT FORM */}
      <div style={{ backgroundColor: "white", borderRadius: "1rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", padding: "1.5rem", marginBottom: "2rem", border: "1px solid #e2e8f0" }}>
        <h2 style={{ fontSize: "1.25rem", fontFamily: "var(--font-nrt-bd)", color: "#1e293b", marginBottom: "1.5rem", borderBottom: "2px solid #f1f5f9", paddingBottom: "0.75rem" }}>
          {editingCompany ? "گۆڕانکاری لە کۆمپانیا" : "تۆمارکردنی کۆمپانیای نوێ"}
        </h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem" }}>
          <InputWrapper label="ناوی کۆمپانیا" icon={Building2}>
            <input
              type="text"
              name="name"
              className="nice-input"
            
              value={activeForm.name}
              onChange={(e) => handleFormChange(e, !!editingCompany)}
            />
          </InputWrapper>

          <InputWrapper label="کۆدی کۆمپانیا (خۆکارانە یان دەستی)" icon={Hash} errorMsg={codeError}>
            <input
              type="text"
              name="code"
              className={`nice-input ${codeError ? 'error-input' : ''}`}
              value={activeForm.code}
              onChange={(e) => handleFormChange(e, !!editingCompany)}
            />
          </InputWrapper>

          <InputWrapper label="ژمارەی تەلەفون" icon={Phone}>
            <input
              type="text"
              name="phone"
              className="nice-input"
              placeholder="07XX XXX XXXX"
              value={activeForm.phone}
              onChange={(e) => handleFormChange(e, !!editingCompany)}
              style={{ direction: "ltr", textAlign: "right" }}
            />
          </InputWrapper>

          {/* COMBO BOX FOR CITY IN FORM */}
          <InputWrapper label="شار" icon={Map}>
            <select
              name="city"
              className="nice-input"
              value={activeForm.city}
              onChange={(e) => handleFormChange(e, !!editingCompany)}
              style={{ cursor: "pointer" }}
            >
              {cities.map(city => <option key={city} value={city}>{city}</option>)}
            </select>
          </InputWrapper>

          <div style={{ gridColumn: "1 / -1" }}>
            <InputWrapper label="ناونیشانی تەواو" icon={MapPin}>
              <input
                type="text"
                name="location"
                className="nice-input"
                placeholder="ناونیشانی تەواوی کۆمپانیا..."
                value={activeForm.location}
                onChange={(e) => handleFormChange(e, !!editingCompany)}
              />
            </InputWrapper>
          </div>
        </div>

        <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
          <button
            onClick={editingCompany ? handleUpdateCompany : handleAddCompany}
            disabled={!!codeError}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", backgroundColor: codeError ? "#94a3b8" : "#2563eb", color: "white", border: "none", borderRadius: "0.5rem", fontFamily: "var(--font-nrt-bd)", cursor: codeError ? "not-allowed" : "pointer", transition: "background 0.2s" }}
          >
            {editingCompany ? <><CheckCircle2 size={18} /> پاشەکەوتکردنی گۆڕانکاری</> : <><Plus size={18} /> زیادکردنی کۆمپانیا</>}
          </button>
          
          {(editingCompany || newCompany.name || newCompany.phone || newCompany.location) && (
            <button
              onClick={() => resetForm(companies)}
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
      <div style={{ backgroundColor: "white", borderRadius: "1rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        
        <div style={{ backgroundColor: "#f8fafc", padding: "1.5rem", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", color: "#0f172a", fontFamily: "var(--font-nrt-bd)" }}>
            <Search size={20} color="#64748b" /> گەڕانی پێشکەوتوو
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
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
              name="phone"
              className="nice-input"
              placeholder="گەڕان بەپێی تەلەفون..."
              value={searchQuery.phone}
              onChange={handleSearchChange}
            />

            {/* COMBO BOX FOR CITY IN SEARCH */}
            <select
              name="city"
              className="nice-input"
              value={searchQuery.city}
              onChange={handleSearchChange}
              style={{ cursor: "pointer" }}
            >
              <option value="">هەموو شارەکان (گەڕان بەپێی شار)</option>
              {cities.map(city => <option key={city} value={city}>{city}</option>)}
            </select>

            <input
              type="text"
              name="location"
              className="nice-input"
              placeholder="گەڕان بەپێی ناونیشان..."
              value={searchQuery.location}
              onChange={handleSearchChange}
            />
          </div>
        </div>

        <div style={{ padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", borderBottom: "1px solid #e2e8f0" }}>
          <span style={{ color: "#475569", fontFamily: "var(--font-nrt-bd)" }}>
            کۆی گشتی دۆزراوەکان: <span style={{ color: "#2563eb", fontWeight: 800 }}>{filteredCompanies.length}</span> کۆمپانیا
          </span>
        </div>

        {/* TABLE */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px", textAlign: "right" }}>
            <thead style={{ backgroundColor: "#f8fafc", color: "#334155", fontFamily: "var(--font-nrt-bd)" }}>
              <tr>
                <th onClick={() => handleSort("name")} style={{ padding: "1rem", cursor: "pointer", borderBottom: "2px solid #e2e8f0" }}>
                  ناو {sortConfig.key === "name" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSort("code")} style={{ padding: "1rem", cursor: "pointer", borderBottom: "2px solid #e2e8f0" }}>
                  کۆد {sortConfig.key === "code" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th style={{ padding: "1rem", borderBottom: "2px solid #e2e8f0" }}>ژ.تەلەفون</th>
                <th style={{ padding: "1rem", borderBottom: "2px solid #e2e8f0" }}>شار</th>
                <th style={{ padding: "1rem", borderBottom: "2px solid #e2e8f0" }}>ناونیشان</th>
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
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: "3rem", textAlign: "center", color: "#94a3b8", fontFamily: "var(--font-nrt-bd)" }}>
                    هیچ کۆمپانیایەک نەدۆزرایەوە بەم زانیاریانە.
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr key={company.id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                    <td style={{ padding: "1rem", fontFamily: "var(--font-nrt-bd)", color: "#0f172a" }}>{company.name}</td>
                    <td style={{ padding: "1rem", color: "#475569" }}>
                      <span style={{ backgroundColor: "#e2e8f0", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", fontSize: "0.85rem", fontFamily: "var(--font-nrt-bd)" }}>{company.code}</span>
                    </td>
                    <td style={{ padding: "1rem", color: "#475569", direction: "ltr", textAlign: "right" }}>
                      {company.phone ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
                          {company.phone}
                          <button onClick={() => handleWhatsApp(company.phone)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }} title="ناردنی وەتسئەپ">
                            <img src="/whatsappicon.png" alt="WA" style={{ width: "22px", transition: "transform 0.2s" }} onMouseOver={e => e.currentTarget.style.transform="scale(1.1)"} onMouseOut={e => e.currentTarget.style.transform="scale(1)"} />    
                          </button>
                        </div>
                      ) : "---"}
                    </td>
                    <td style={{ padding: "1rem", color: "#475569", fontFamily: "var(--font-nrt-reg)" }}>{company.city || "---"}</td>
                    <td style={{ padding: "1rem", color: "#475569", fontFamily: "var(--font-nrt-reg)" }}>{company.location || "---"}</td>
                    <td style={{ padding: "1rem", display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                      <button
                        onClick={() => handleEdit(company)}
                        style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.5rem 0.75rem", backgroundColor: "#eff6ff", color: "#2563eb", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontFamily: "var(--font-nrt-bd)", fontSize: "0.85rem", transition: "background 0.2s" }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = "#dbeafe"}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = "#eff6ff"}
                      >
                        <Edit3 size={16} /> دەستکاری
                      </button>
                      <button
                        onClick={() => handleDelete(company.id)}
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