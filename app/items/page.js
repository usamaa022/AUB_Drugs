"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { getInitializedItems, addInitializedItem, updateInitializedItem, deleteInitializedItem, searchInitializedItems } from "@/lib/data";
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

export default function ItemsPage() {
  const [formData, setFormData] = useState({
    barcode: "",
    name: "",
  });
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [barcodeMode, setBarcodeMode] = useState("auto");
  const [nextBarcode, setNextBarcode] = useState("ar1000");
  const [barcodeError, setBarcodeError] = useState("");

  // --- Advanced Filter & Sort States ---
  const [sortConfig, setSortConfig] = useState({ key: '', direction: '' });
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);

  // --- Advanced Suggestions State ---
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef(null);

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (items.length > 0 && barcodeMode === "auto") {
      generateNextBarcode();
    } else if (items.length === 0 && barcodeMode === "auto") {
      setNextBarcode("ar1000");
    }
  }, [items, barcodeMode]);

  // Sync the calculated nextBarcode into the input box on load and after submits
  useEffect(() => {
    if (barcodeMode === "auto" && !editingItem) {
      setFormData((prev) => ({ ...prev, barcode: nextBarcode }));
    }
  }, [nextBarcode, barcodeMode, editingItem]);

  // Handle outside clicks for filter dropdowns and name suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.filter-dropdown-container')) {
        setActiveFilterDropdown(null);
      }
      if (suggestionRef.current && !suggestionRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const fetchItems = async () => {
    try {
      const fetchedItems = await getInitializedItems();
      setItems(fetchedItems);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const searchItems = async () => {
      if (searchQuery.trim() === "") {
        fetchItems();
      } else {
        const results = await searchInitializedItems(searchQuery);
        setItems(results);
      }
    };
    searchItems();
  }, [searchQuery]);

  const generateNextBarcode = () => {
    if (items.length === 0) {
      setNextBarcode("ar1000");
      return;
    }

    const barcodeNumbers = items
      .map(item => item.barcode)
      .filter(barcode => barcode && barcode.toLowerCase().startsWith('ar'))
      .map(barcode => {
        const number = parseInt(barcode.substring(2));
        return isNaN(number) ? 0 : number;
      })
      .filter(num => num > 0);

    if (barcodeNumbers.length === 0) {
      setNextBarcode("ar1000");
      return;
    }

    const maxNumber = Math.max(...barcodeNumbers);
    const nextNumber = maxNumber + 1;
    setNextBarcode(`ar${nextNumber}`);
  };

  const checkBarcodeExists = (barcode, excludeId = null) => {
    return items.some(item => 
      item.barcode.toLowerCase() === barcode.toLowerCase() && 
      (!excludeId || item.id !== excludeId)
    );
  };

  const handleBarcodeModeChange = (mode) => {
    setBarcodeMode(mode);
    setBarcodeError("");
    
    if (mode === "auto") {
      generateNextBarcode();
      setFormData({ ...formData, barcode: nextBarcode });
    } else {
      setFormData({ ...formData, barcode: "" });
    }
  };

  const handleManualBarcodeChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, barcode: value });
    
    if (value && checkBarcodeExists(value, editingItem?.id)) {
      const existingItem = items.find(item => 
        item.barcode.toLowerCase() === value.toLowerCase() && 
        (!editingItem || item.id !== editingItem.id)
      );
      setBarcodeError(`This barcode refers to "${existingItem?.name}" and cannot be reused`);
    } else {
      setBarcodeError("");
    }
  };

  // --- Advanced Name Suggestions Computation ---
  const filteredSuggestions = useMemo(() => {
    const query = formData.name.trim().toLowerCase();
    if (!query) return [];
    
    const uniqueNames = Array.from(new Set(items.map(item => item.name)))
      .filter(name => name && name.toLowerCase().includes(query));
    
    return uniqueNames;
  }, [formData.name, items]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setBarcodeError("");
    
    if (!formData.barcode.trim()) {
      setBarcodeError("Barcode is required");
      return;
    }

    if (!formData.name.trim()) {
      setError("Item name is required");
      return;
    }

    if (checkBarcodeExists(formData.barcode, editingItem?.id)) {
      const existingItem = items.find(item => 
        item.barcode.toLowerCase() === formData.barcode.toLowerCase() && 
        (!editingItem || item.id !== editingItem.id)
      );
      setBarcodeError(`This barcode refers to "${existingItem?.name}" and cannot be reused`);
      return;
    }
    
    try {
      const itemData = {
        barcode: formData.barcode,
        name: formData.name,
      };

      if (editingItem) {
        await updateInitializedItem({ ...itemData, id: editingItem.id });
        setSuccess("Item updated successfully!");
      } else {
        await addInitializedItem(itemData);
        setSuccess("Item added successfully!");
      }
      
      await fetchItems();
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setBarcodeMode("manual");
    setFormData({
      barcode: item.barcode,
      name: item.name,
    });
    setBarcodeError("");
  };

  const handleDelete = async (itemId) => {
    if (confirm("Are you sure you want to delete this item?")) {
      try {
        await deleteInitializedItem(itemId);
        await fetchItems();
        setSuccess("Item deleted successfully!");
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      barcode: barcodeMode === "auto" ? nextBarcode : "",
      name: "",
    });
    setEditingItem(null);
    setBarcodeError("");
    setShowSuggestions(false);
  };

  const handleCancel = () => {
    resetForm();
    setBarcodeMode("auto"); 
  };

  // --- Sorting & Filtering Logic ---
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
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

  const evaluateFilter = (itemValue, filterData) => {
    if (!filterData) return true;
    const { operator, textValue, selectedValues } = filterData;
    
    if (selectedValues && selectedValues.length > 0) {
      if (!selectedValues.includes(String(itemValue))) return false;
    }

    if (operator && (textValue !== "" || ['isEmpty', 'isNotEmpty'].includes(operator))) {
      const valStr = String(itemValue || '').toLowerCase();
      const searchStr = String(textValue).toLowerCase();

      switch (operator) {
        case 'contains': return valStr.includes(searchStr);
        case 'equals': return valStr === searchStr;
        case 'startsWith': return valStr.startsWith(searchStr);
        case 'endsWith': return valStr.endsWith(searchStr);
        case 'isEmpty': return !itemValue || itemValue === "N/A" || itemValue === "-";
        case 'isNotEmpty': return !!itemValue && itemValue !== "N/A" && itemValue !== "-";
        default: return true;
      }
    }
    return true;
  };

  const filteredItems = useMemo(() => {
    let result = [...items];

    for (const [columnKey, filterData] of Object.entries(columnFilters)) {
      result = result.filter(item => {
        let itemValue = "";
        if (columnKey === 'barcode') itemValue = item.barcode;
        if (columnKey === 'name') itemValue = item.name;
        return evaluateFilter(itemValue, filterData);
      });
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key] || "";
        let bVal = b[sortConfig.key] || "";
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [items, columnFilters, sortConfig]);

  // --- Standalone Filter Dropdown Component to Prevent Focus Loss ---
  const ExcelFilterDropdown = ({ columnKey }) => {
    const isOpen = activeFilterDropdown === columnKey;
    const operators = STRING_OPERATORS;
    
    const filterState = columnFilters[columnKey] || { operator: operators[0].value, textValue: '', selectedValues: [] };
    const { operator, textValue, selectedValues } = filterState;

    const [search, setSearch] = useState("");
    const [localTextValue, setLocalTextValue] = useState(textValue || "");

    // Keep local text value synced if parent resets filters
    useEffect(() => {
      setLocalTextValue(textValue || "");
    }, [textValue]);

    const uniqueValues = useMemo(() => {
      const vals = new Set();
      items.forEach(item => {
        let val = "";
        if (columnKey === 'barcode') val = item.barcode;
        if (columnKey === 'name') val = item.name;
        vals.add(String(val || ""));
      });
      return Array.from(vals).sort();
    }, [items, columnKey]);

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
          style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "0.25rem", borderRadius: "0.375rem", background: isActive ? "#dbeafe" : "transparent", color: isActive ? "#2563eb" : "#94a3b8" }}
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
                    type="text" 
                    placeholder="Value..." 
                    value={localTextValue} 
                    onChange={(e) => {
                      setLocalTextValue(e.target.value);
                      handleUpdateColumnFilter(columnKey, { textValue: e.target.value });
                    }}
                    style={{ width: "100%", boxSizing: "border-box", padding: "0.4rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.875rem", outline: "none" }}
                    autoFocus
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
                setLocalTextValue("");
              }} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: "0.875rem", cursor: "pointer", fontWeight: 600 }}>Clear</button>
              <button onClick={() => setActiveFilterDropdown(null)} style={{ background: "#2563eb", border: "none", color: "white", fontSize: "0.875rem", padding: "0.4rem 1rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600 }}>Apply</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const TableHeader = ({ title, columnKey }) => (
    <th style={{ 
      padding: '0.75rem 1rem', 
      textAlign: 'left', 
      fontSize: '0.9rem', 
      fontWeight: '600', 
      color: '#475569',
      position: 'sticky',
      top: 0,
      backgroundColor: '#f8fafc',
      zIndex: 10
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
        <div onClick={() => handleSort(columnKey)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", flex: 1, userSelect: "none" }}>
          {title}
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            {sortConfig.key === columnKey ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕️'}
          </span>
        </div>
        <ExcelFilterDropdown columnKey={columnKey} />
      </div>
    </th>
  );

  // --- Rendering ---
  if (loading) return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid #e0e7ff',
          borderTopColor: '#667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem'
        }} />
        <p style={{ color: '#4a5568' }}>Loading...</p>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '10px',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '100%',
        margin: '0'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.5rem' }}>
            Item Management
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
            Add and manage items with barcodes
          </p>
        </div>

        {/* Add/Edit Item Card */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{
              fontSize: '1.35rem',
              fontWeight: '600',
              color: '#1e293b'
            }}>
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </h2>
            {!editingItem && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => handleBarcodeModeChange("auto")}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    background: barcodeMode === "auto" ? '#3b82f6' : 'white',
                    borderColor: barcodeMode === "auto" ? '#3b82f6' : '#e2e8f0',
                    color: barcodeMode === "auto" ? 'white' : '#64748b',
                    transition: 'all 0.2s'
                  }}
                >
                  Auto Barcode
                </button>
                <button
                  onClick={() => handleBarcodeModeChange("manual")}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    background: barcodeMode === "manual" ? '#3b82f6' : 'white',
                    borderColor: barcodeMode === "manual" ? '#3b82f6' : '#e2e8f0',
                    color: barcodeMode === "manual" ? 'white' : '#64748b',
                    transition: 'all 0.2s'
                  }}
                >
                  Manual Barcode
                </button>
              </div>
            )}
          </div>

          {/* Alerts */}
          {error && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '6px', color: '#dc2626', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '6px', color: '#16a34a', fontSize: '0.9rem' }}>
              {success}
            </div>
          )}

          {barcodeError && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', color: '#b45309', fontSize: '0.9rem' }}>
              {barcodeError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              {/* Barcode Field */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#475569', marginBottom: '0.25rem' }}>
                  Barcode <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: `1px solid ${barcodeError ? '#f59e0b' : '#e2e8f0'}`,
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    background: barcodeError ? '#fffbeb' : 'white',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                  placeholder={barcodeMode === "auto" ? "Auto-generated" : "Enter barcode"}
                  value={formData.barcode}
                  onChange={handleManualBarcodeChange}
                  readOnly={(barcodeMode === "auto" && !editingItem) || (editingItem && barcodeMode === "auto")}
                  required
                />
                {barcodeMode === "auto" && !editingItem && (
                  <p style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: '#3b82f6' }}>
                    Next: {nextBarcode}
                  </p>
                )}
              </div>

              {/* Item Name Field with Advanced Suggestions */}
              <div style={{ position: 'relative' }} ref={suggestionRef}>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#475569', marginBottom: '0.25rem' }}>
                  Item Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter item name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  required
                />
                
                {/* Suggestions Dropdown */}
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <ul style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    margin: '4px 0 0 0',
                    padding: 0,
                    listStyle: 'none',
                    zIndex: 99
                  }}>
                    {filteredSuggestions.map((suggestion, idx) => (
                      <li
                        key={idx}
                        onClick={() => {
                          setFormData({ ...formData, name: suggestion });
                          setShowSuggestions(false);
                        }}
                        style={{
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.9rem',
                          color: '#1e293b',
                          cursor: 'pointer',
                          borderBottom: idx < filteredSuggestions.length - 1 ? '1px solid #f1f5f9' : 'none'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              {editingItem && (
                <button
                  type="button"
                  onClick={handleCancel}
                  style={{
                    padding: '0.625rem 1.25rem',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.target.style.background = '#e2e8f0'; }}
                  onMouseLeave={(e) => { e.target.style.background = '#f1f5f9'; }}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                style={{
                  padding: '0.625rem 1.5rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.target.style.background = '#2563eb'; }}
                onMouseLeave={(e) => { e.target.style.background = '#3b82f6'; }}
              >
                {editingItem ? "Update Item" : "Add Item"}
              </button>
            </div>
          </form>
        </div>

        {/* Item List Card */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          {/* Search Header */}
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ color: '#64748b' }}>
              Total Items: <strong style={{ color: '#1e293b' }}>{filteredItems.length}</strong>
              {Object.keys(columnFilters).length > 0 && (
                 <span style={{ marginLeft: "10px", fontSize: "0.85rem", color: "#ef4444", cursor: "pointer" }} onClick={() => setColumnFilters({})}>
                   Clear Filters
                 </span>
              )}
            </div>
            <input
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '0.9rem',
                width: '250px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              placeholder="Global Search (Name/Barcode)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Table */}
          <div style={{ 
            overflowX: 'auto', 
            overflowY: 'auto',
            height: 'calc(100vh - 350px)',
            minHeight: '500px'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: '500px'
            }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ 
                    padding: '0.75rem 1rem', 
                    textAlign: 'left', 
                    fontSize: '0.9rem', 
                    fontWeight: '600', 
                    color: '#475569', 
                    width: '60px',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#f8fafc',
                    zIndex: 10
                  }}>#</th>
                  <TableHeader title="Barcode" columnKey="barcode" />
                  <TableHeader title="Item Name" columnKey="name" />
                  <th style={{ 
                    padding: '0.75rem 1rem', 
                    textAlign: 'center', 
                    fontSize: '0.9rem', 
                    fontWeight: '600', 
                    color: '#475569', 
                    width: '120px',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#f8fafc',
                    zIndex: 10
                  }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => (
                  <tr 
                    key={item.id} 
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.9rem' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        background: '#f1f5f9',
                        color: '#334155',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        fontFamily: 'monospace'
                      }}>
                        {item.barcode}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#1e293b', fontWeight: '500', fontSize: '0.9rem' }}>
                      {item.name}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleEdit(item)}
                          style={{
                            padding: '0.375rem',
                            background: 'none',
                            border: 'none',
                            color: '#3b82f6',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => { e.target.style.background = '#eff6ff'; e.target.style.transform = 'scale(1.1)'; }}
                          onMouseLeave={(e) => { e.target.style.background = 'none'; e.target.style.transform = 'scale(1)'; }}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          style={{
                            padding: '0.375rem',
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => { e.target.style.background = '#fef2f2'; e.target.style.transform = 'scale(1.1)'; }}
                          onMouseLeave={(e) => { e.target.style.background = 'none'; e.target.style.transform = 'scale(1)'; }}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                <p style={{ marginBottom: '0.5rem', fontWeight: "600" }}>No items found</p>
                <p style={{ fontSize: '0.9rem' }}>
                  {searchQuery || Object.keys(columnFilters).length > 0 ? "Try adjusting your filters or search query" : "Add your first item above"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}