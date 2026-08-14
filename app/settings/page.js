"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Shield, 
  Users, 
  Lock, 
  Search, 
  ShoppingCart, 
  Package, 
  Truck, 
  CreditCard, 
  Building2, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  FolderLock
} from "lucide-react";

// --- Grouped Modules Configuration Exactly Matching Your Navbar ---
const NAVIGATION_GROUPS = [
  {
    groupId: "buying",
    groupLabel: "Buying Module",
    icon: ShoppingCart,
    description: "Purchase bills, purchase histories, bought returns, and statements",
    pages: [
      { key: "buying_form", label: "Buying Form", path: "/buying", description: "Create new purchase invoices" },
      { key: "buying_history", label: "Buying History", path: "/bought", description: "View purchase bill records" },
      { key: "bought_returns", label: "Bought Returns", path: "/bought_returns", description: "Return items back to suppliers" },
      { key: "bought_statement", label: "Bought Statement", path: "/Bought_Statement", description: "Company purchase statements" }
    ]
  },
  {
    groupId: "sales",
    groupLabel: "Sales Module",
    icon: ShoppingCart,
    description: "Sales invoices, sales histories, returns, detailed reports, and statements",
    pages: [
      { key: "create_sale", label: "Create Sale", path: "/selling", description: "Create sales invoices for pharmacies" },
      { key: "sales_history", label: "Sales History", path: "/sold", description: "View previous sales bills" },
      { key: "detailed_report", label: "Detailed Report", path: "/sold/detailed-report", description: "Detailed item-by-item sales metrics" },
      { key: "sales_returns", label: "Returns", path: "/return", description: "Process sales return invoices" },
      { key: "sales_statements", label: "Statements", path: "/statements", description: "Customer financial statement report" }
    ]
  },
  {
    groupId: "inventory",
    groupLabel: "Inventory Module",
    icon: Package,
    description: "Item catalog list, store stock management, and stock card ledger",
    pages: [
      { key: "inventory_items", label: "Items List", path: "/items", description: "Product initialization list" },
      { key: "inventory_store", label: "Store", path: "/store", description: "Real-time branch inventory and stocks" },
      { key: "inventory_ledger", label: "Stock Ledger", path: "/inventory_ledger", description: "Full chronological stock cards" }
    ]
  },
  {
    groupId: "payments",
    groupLabel: "Payments Module",
    icon: CreditCard,
    description: "Sales payment collections, supplier buy payments, and sales ledgers",
    pages: [
      { key: "sales_payment", label: "Sales Payment", path: "/payments/create", description: "Record payments from pharmacies" },
      { key: "buy_payment", label: "Buy Payment", path: "/bought_payments/", description: "Record payments made to suppliers" },
      { key: "sales_ledger", label: "Sales Ledger", path: "/sales_ledger/", description: "Pharmacy ledger balance statements" }
    ]
  },
  {
    groupId: "transport",
    groupLabel: "Transport Module",
    icon: Truck,
    description: "Transfer items and stock batches across regional branches",
    pages: [
      { key: "transport_send", label: "Send Transport", path: "/transport/send", description: "Dispatch items to another branch" },
      { key: "transport_receive", label: "Receive Transport", path: "/transport/receive", description: "Confirm receipt of incoming inventory" },
      { key: "transport_history", label: "Transport History", path: "/transport/transportHistory", description: "View transport shipment history" }
    ]
  },
  {
    groupId: "accounts",
    groupLabel: "Accounts & Directory",
    icon: Building2,
    description: "Manage pharmacy client accounts and supplier company accounts",
    pages: [
      { key: "accounts_pharmacies", label: "Pharmacies", path: "/pharmacies", description: "Customer pharmacy profiles & codes" },
      { key: "accounts_companies", label: "Companies", path: "/companies", description: "Supplier company profiles & codes" }
    ]
  }
];

export default function SettingsAccessControlPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Validate superAdmin role
  const isCurrentUserSuperAdmin = user?.role === "superAdmin" || (user?.role || "").toLowerCase() === "superadmin";

  useEffect(() => {
    if (user && !isCurrentUserSuperAdmin) {
      router.push("/");
    }
  }, [user, isCurrentUserSuperAdmin, router]);

  // Load all users in real-time
  useEffect(() => {
    if (!user || !isCurrentUserSuperAdmin) return;

    setIsLoading(true);
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const userList = [];
      snapshot.forEach((docSnap) => {
        userList.push({ uid: docSnap.id, ...docSnap.data() });
      });

      userList.sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));
      setUsers(userList);

      if (selectedUser) {
        const refreshed = userList.find((u) => u.uid === selectedUser.uid);
        if (refreshed) {
          setSelectedUser(refreshed);
          setUserPermissions(refreshed.permissions || {});
        }
      } else if (userList.length > 0) {
        setSelectedUser(userList[0]);
        setUserPermissions(userList[0].permissions || {});
      }

      setIsLoading(false);
    }, (err) => {
      console.error("Error loading users:", err);
      setErrorMessage("Failed to load user accounts from database.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, isCurrentUserSuperAdmin]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u => 
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q)) ||
      (u.branch && u.branch.toLowerCase().includes(q))
    );
  }, [users, searchQuery]);

  const handleSelectUser = (targetUser) => {
    setSelectedUser(targetUser);
    setUserPermissions(targetUser.permissions || {});
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // Toggle single sub-page
  const handleToggleSubPage = (pageKey) => {
    setUserPermissions(prev => ({
      ...prev,
      [pageKey]: !prev[pageKey]
    }));
  };

  // Toggle entire category/group
  const handleToggleGroup = (group) => {
    const isGroupActive = isGroupFullyEnabled(group);
    const updated = { ...userPermissions };

    group.pages.forEach(p => {
      updated[p.key] = !isGroupActive;
    });

    setUserPermissions(updated);
  };

  // Check if all subpages in a group are enabled
  const isGroupFullyEnabled = (group) => {
    return group.pages.every(p => !!userPermissions[p.key]);
  };

  // Check if at least one subpage is enabled
  const isGroupPartiallyEnabled = (group) => {
    return group.pages.some(p => !!userPermissions[p.key]) && !isGroupFullyEnabled(group);
  };

  // Global actions
  const handleGrantAll = () => {
    const allGranted = {};
    NAVIGATION_GROUPS.forEach(g => {
      g.pages.forEach(p => {
        allGranted[p.key] = true;
      });
    });
    setUserPermissions(allGranted);
  };

  const handleRevokeAll = () => {
    const allRevoked = {};
    NAVIGATION_GROUPS.forEach(g => {
      g.pages.forEach(p => {
        allRevoked[p.key] = false;
      });
    });
    setUserPermissions(allRevoked);
  };

  // Save changes
  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const userRef = doc(db, "users", selectedUser.uid);
      await updateDoc(userRef, {
        permissions: userPermissions,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || "superAdmin"
      });

      setSuccessMessage(`Permissions successfully saved for ${selectedUser.displayName || selectedUser.email}!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error("Failed to update permissions:", err);
      setErrorMessage(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" }}>
        <div style={{ width: "40px", height: "40px", border: "3px solid #cbd5e1", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <style jsx>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#f1f5f9", padding: "1.5rem", boxSizing: "border-box", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Shield size={26} color="#3b82f6" />
            Control Center & Permissions
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>
            Enable or disable navigation menu groups and pages per user
          </p>
        </div>

        {selectedUser && (
          <button
            onClick={handleSavePermissions}
            disabled={isSaving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.625rem 1.25rem",
              backgroundColor: isSaving ? "#94a3b8" : "#10b981",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.875rem",
              cursor: isSaving ? "not-allowed" : "pointer",
              boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.3)",
              transition: "all 0.2s"
            }}
          >
            <Save size={16} />
            {isSaving ? "Saving Settings..." : "Save User Permissions"}
          </button>
        )}
      </div>

      {/* Messages */}
      {successMessage && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.875rem 1rem", backgroundColor: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", borderRadius: "8px", marginBottom: "1.5rem", fontSize: "0.875rem", fontWeight: 600 }}>
          <CheckCircle2 size={18} />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.875rem 1rem", backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "8px", marginBottom: "1.5rem", fontSize: "0.875rem", fontWeight: 600 }}>
          <AlertCircle size={18} />
          {errorMessage}
        </div>
      )}

      {/* Main Layout Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "1.5rem", alignItems: "start" }}>
        
        {/* Left: User Directory */}
        <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "1rem", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <Users size={16} color="#475569" />
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Staff Accounts ({users.length})</span>
            </div>
            
            <div style={{ position: "relative" }}>
              <Search size={14} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.5rem 0.5rem 2rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.8125rem", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
            {filteredUsers.map((u) => {
              const isSelected = selectedUser?.uid === u.uid;
              const isSuper = u.role === "superAdmin" || (u.role || "").toLowerCase() === "superadmin";

              return (
                <div
                  key={u.uid}
                  onClick={() => handleSelectUser(u)}
                  style={{
                    padding: "0.875rem 1rem",
                    borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer",
                    backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
                    borderLeft: isSelected ? "4px solid #3b82f6" : "4px solid transparent",
                    transition: "all 0.15s"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.875rem", color: isSelected ? "#1d4ed8" : "#1e293b" }}>
                      {u.displayName || u.email?.split("@")[0]}
                    </span>
                    <span style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      padding: "0.15rem 0.45rem",
                      borderRadius: "4px",
                      backgroundColor: isSuper ? "#f3e8ff" : "#f1f5f9",
                      color: isSuper ? "#7c3aed" : "#475569",
                      textTransform: "uppercase"
                    }}>
                      {u.role || "user"}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: "0.75rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.email}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                    Branch: {u.branch || "Slemany"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Grouped Permissions List */}
        {selectedUser ? (
          <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            
            {/* Header for Selected User */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "1.25rem", borderBottom: "1px solid #e2e8f0", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>
                  Permissions for: <span style={{ color: "#2563eb" }}>{selectedUser.displayName || selectedUser.email}</span>
                </h2>
                <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                  Role: <strong>{selectedUser.role || "User"}</strong> | Branch: <strong>{selectedUser.branch || "Slemany"}</strong>
                </span>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={handleGrantAll}
                  style={{ padding: "0.4rem 0.75rem", backgroundColor: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                >
                  Grant All
                </button>
                <button
                  onClick={handleRevokeAll}
                  style={{ padding: "0.4rem 0.75rem", backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                >
                  Revoke All
                </button>
              </div>
            </div>

            {/* Navigation Groups with Master & Sub-Item Toggles */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {NAVIGATION_GROUPS.map((group) => {
                const GroupIcon = group.icon;
                const isGroupOn = isGroupFullyEnabled(group);
                const isGroupPartial = isGroupPartiallyEnabled(group);

                return (
                  <div
                    key={group.groupId}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      overflow: "hidden",
                      backgroundColor: "#ffffff"
                    }}
                  >
                    {/* Master Group Header with Master Switch */}
                    <div
                      style={{
                        padding: "0.875rem 1.25rem",
                        backgroundColor: isGroupOn ? "#f0fdf4" : isGroupPartial ? "#eff6ff" : "#f8fafc",
                        borderBottom: "1px solid #e2e8f0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          backgroundColor: isGroupOn ? "#dcfce7" : "#e2e8f0",
                          color: isGroupOn ? "#166534" : "#475569",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>
                          <GroupIcon size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: isGroupOn ? "#166534" : "#1e293b" }}>
                            {group.groupLabel}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                            {group.description}
                          </div>
                        </div>
                      </div>

                      {/* Master Group Switch */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: isGroupOn ? "#166534" : "#64748b" }}>
                          {isGroupOn ? "ALL ON" : isGroupPartial ? "PARTIAL" : "OFF"}
                        </span>
                        <label style={{ position: "relative", display: "inline-block", width: "48px", height: "26px", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={isGroupOn}
                            onChange={() => handleToggleGroup(group)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                          />
                          <span style={{
                            position: "absolute",
                            inset: 0,
                            backgroundColor: isGroupOn ? "#10b981" : isGroupPartial ? "#3b82f6" : "#cbd5e1",
                            borderRadius: "26px",
                            transition: "0.2s"
                          }}>
                            <span style={{
                              position: "absolute",
                              height: "20px",
                              width: "20px",
                              left: isGroupOn ? "24px" : "3px",
                              bottom: "3px",
                              backgroundColor: "#ffffff",
                              borderRadius: "50%",
                              transition: "0.2s",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                            }} />
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Subpages List */}
                    <div style={{ padding: "0.5rem 1.25rem", display: "flex", flexDirection: "column" }}>
                      {group.pages.map((page, idx) => {
                        const isSubOn = !!userPermissions[page.key];

                        return (
                          <div
                            key={page.key}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "0.625rem 0",
                              borderBottom: idx === group.pages.length - 1 ? "none" : "1px solid #f1f5f9"
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "0.875rem", color: isSubOn ? "#0f172a" : "#64748b" }}>
                                {page.label} <code style={{ fontSize: "0.75rem", color: "#94a3b8", marginLeft: "6px" }}>{page.path}</code>
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                                {page.description}
                              </div>
                            </div>

                            {/* Subpage Switch */}
                            <label style={{ position: "relative", display: "inline-block", width: "40px", height: "22px", cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={isSubOn}
                                onChange={() => handleToggleSubPage(page.key)}
                                style={{ opacity: 0, width: 0, height: 0 }}
                              />
                              <span style={{
                                position: "absolute",
                                inset: 0,
                                backgroundColor: isSubOn ? "#10b981" : "#e2e8f0",
                                borderRadius: "22px",
                                transition: "0.2s"
                              }}>
                                <span style={{
                                  position: "absolute",
                                  height: "16px",
                                  width: "16px",
                                  left: isSubOn ? "20px" : "3px",
                                  bottom: "3px",
                                  backgroundColor: "#ffffff",
                                  borderRadius: "50%",
                                  transition: "0.2s",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                                }} />
                              </span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ padding: "4rem", textAlign: "center", color: "#94a3b8", backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            Select a user account from the left directory to manage permissions.
          </div>
        )}

      </div>
    </div>
  );
}