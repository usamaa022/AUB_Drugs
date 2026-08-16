"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getTransports, receiveTransport, getUsers, formatDate } from "@/lib/data";
import { motion, AnimatePresence } from "framer-motion";

// Helper function to format prices with currency
const formatCurrency = (amount, currency) => {
  const num = Number(amount) || 0;
  const curr = currency || "IQD";
  
  if (String(curr).toUpperCase() === "IQD") {
    return `${num.toLocaleString('en-US', { maximumFractionDigits: 0 })} IQD`;
  } else {
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
};

// Helper function to format date as DD/MM/YYYY
const formatDateDisplay = (date) => {
  if (!date) return "N/A";
  try {
    let dateObj = null;
    if (typeof date === 'object') {
      if ('toDate' in date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date.seconds !== undefined) {
        dateObj = new Date(date.seconds * 1000);
      } else if (date instanceof Date) {
        dateObj = date;
      }
    }
    if (typeof date === 'string') {
      dateObj = new Date(date);
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

export default function ReceiveTransportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [transports, setTransports] = useState([]);
  const [selectedTransport, setSelectedTransport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [branchFilter, setBranchFilter] = useState(user?.branch || "all");
  const [notes, setNotes] = useState("");
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [adjustedQuantities, setAdjustedQuantities] = useState({});

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [transportsData, usersData] = await Promise.all([
          getTransports(user.role === "superAdmin" ? branchFilter : user.branch, user.role),
          getUsers(),
        ]);
        
        const pendingTransports = transportsData.filter(
          (t) =>
            t.toBranch === (user.role === "superAdmin" ? branchFilter : user.branch) &&
            t.status === "pending"
        );
        
        setTransports(pendingTransports);
        setUsers(usersData);
        
        const initialQuantities = {};
        pendingTransports.forEach(transport => {
          transport.items.forEach((item, index) => {
            const key = `${transport.id}-${index}`;
            initialQuantities[key] = item.quantity;
          });
        });
        setAdjustedQuantities(initialQuantities);
      } catch (error) {
        console.error("Error fetching transports:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, branchFilter, router]);

  const handleQuantityChange = (transportId, itemIndex, newQuantity) => {
    const key = `${transportId}-${itemIndex}`;
    setAdjustedQuantities(prev => ({
      ...prev,
      [key]: Math.max(0, parseInt(newQuantity) || 0)
    }));
  };

  const handleReceive = async (status) => {
    if (!selectedTransport) return;
    
    try {
      setProcessing(true);
      setError(null);
      
      const receivedItems = selectedTransport.items.map((item, index) => {
        const key = `${selectedTransport.id}-${index}`;
        const adjustedQty = adjustedQuantities[key] !== undefined ? adjustedQuantities[key] : item.quantity;
        
        return {
          id: item.id || null,
          storeDocId: item.storeDocId || item.id || null,
          barcode: item.barcode,
          name: item.name,
          quantity: item.quantity,
          adjustedQuantity: adjustedQty,
          boughtBillNumber: item.boughtBillNumber || selectedTransport.boughtBillNumber || "N/A",
          batchId: item.batchId || item.id || null,
          netPrice: item.netPrice,
          outPrice: item.outPrice,
          expireDate: item.expireDate,
          isConsignment: item.isConsignment || false,
          consignmentOwnerId: item.consignmentOwnerId || null,
          currency: item.currency || "IQD",
          originalCurrency: item.originalCurrency || item.currency || "IQD",
          netPriceUSD: item.netPriceUSD || 0,
          netPriceIQD: item.netPriceIQD || 0,
          outPriceUSD: item.outPriceUSD || 0,
          outPriceIQD: item.outPriceIQD || 0,
          fromBranch: selectedTransport.fromBranch,
          toBranch: selectedTransport.toBranch,
        };
      });
      
      await receiveTransport(selectedTransport.id, user.uid, status, notes, receivedItems);
      
      const data = await getTransports(
        user.role === "superAdmin" ? branchFilter : user.branch,
        user.role
      );
      const pendingTransports = data.filter(
        (t) =>
          t.toBranch === (user.role === "superAdmin" ? branchFilter : user.branch) &&
          t.status === "pending"
      );
      setTransports(pendingTransports);
      setSelectedTransport(null);
      setNotes("");
      setAdjustedQuantities({});
    } catch (error) {
      console.error("Error receiving transport:", error);
      setError(`Error: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      pending: "var(--warning)",
      received: "var(--secondary)", 
      rejected: "var(--danger)"
    };
    
    return (
      <span style={{
        padding: "4px 8px",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: "600",
        backgroundColor: statusColors[status] || "var(--gray)",
        color: "white"
      }}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getDirectionBadge = (transport) => {
    const isIncoming = transport.toBranch === (user.role === "superAdmin" ? branchFilter : user.branch);
    
    if (isIncoming) {
      return (
        <span style={{
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: "600",
          backgroundColor: "var(--purple)",
          color: "white"
        }}>
          Incoming from {transport.fromBranch}
        </span>
      );
    } else {
      return (
        <span style={{
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: "600",
          backgroundColor: "var(--primary)",
          color: "white"
        }}>
          Outgoing to {transport.toBranch}
        </span>
      );
    }
  };

  const getUserName = (userId) => {
    if (!userId) return "Unknown User";
    const userObj = users.find(u => u.uid === userId);
    return userObj ? (userObj.displayName || userObj.name || userObj.email || "Unknown User") : "Unknown User";
  };

  const getUserEmail = (userId) => {
    if (!userId) return "";
    const userObj = users.find(u => u.uid === userId);
    return userObj ? userObj.email || "" : "";
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '256px' }}>
          <div style={{ 
            animation: 'spin 1s linear infinite', 
            borderRadius: '9999px', 
            height: '40px', 
            width: '40px', 
            borderTop: '2px solid var(--primary)', 
            borderBottom: '2px solid var(--primary)' 
          }}></div>
          <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--gray)' }}>Loading transports...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '1rem' }}>
      <div className="page-header">
        <h1>Receive Transports</h1>
        <p>Manage incoming item transports - Adjust quantities if needed</p>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 'var(--rounded-lg)',
          color: 'var(--danger)'
        }}>
          {error}
        </div>
      )}

      {user.role === "superAdmin" && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '8px' }}>
            Branch Filter
          </label>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="input"
          >
            <option value="all">All Branches</option>
            <option value="Slemany">Slemany</option>
            <option value="Erbil">Erbil</option>
          </select>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="card">
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--dark)' }}>
            {transports.length} Pending Transport{transports.length !== 1 ? "s" : ""}
          </h2>
          <p style={{ marginTop: '8px', color: 'var(--gray)', fontSize: '14px' }}>
            Adjust quantities if items arrived in different amounts than sent
          </p>
        </div>

        {transports.length === 0 ? (
          <div className="empty-state">
            <div style={{ 
              margin: '0 auto 16px', 
              height: '48px', 
              width: '48px', 
              borderRadius: '9999px', 
              backgroundColor: 'rgba(16, 185, 129, 0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <svg style={{ height: '24px', width: '24px', color: 'var(--secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 style={{ marginBottom: '8px', fontSize: '18px', fontWeight: '600', color: 'var(--dark)' }}>All caught up!</h3>
            <p style={{ color: 'var(--gray)' }}>No pending transports found.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {transports.map((transport) => (
              <div key={transport.id} className="card fade-in" style={{ 
                borderLeft: '4px solid var(--purple)',
                transition: 'box-shadow 0.2s ease',
                width: '100%',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--dark)' }}>Transport #{transport.id.slice(-6)}</h3>
                    <div style={{ 
                      fontSize: '13px', 
                      color: 'var(--gray)', 
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>📤 Sent by: <strong>{getUserName(transport.senderId)}</strong></span>
                      {getUserEmail(transport.senderId) && (
                        <span style={{ fontSize: '12px', color: 'var(--gray-light)' }}>
                          ({getUserEmail(transport.senderId)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {getDirectionBadge(transport)}
                    {getStatusBadge(transport.status)}
                  </div>
                </div>

                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    minWidth: '600px'
                  }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px 12px', fontSize: '14px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left', whiteSpace: 'nowrap' }}>From</th>
                        <th style={{ padding: '8px 12px', fontSize: '14px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left', whiteSpace: 'nowrap' }}>To</th>
                        <th style={{ padding: '8px 12px', fontSize: '14px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left', whiteSpace: 'nowrap' }}>Sent Date</th>
                        <th style={{ padding: '8px 12px', fontSize: '14px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left', whiteSpace: 'nowrap' }}>Sender</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--dark)' }}>
                          {transport.fromBranch}
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--dark)' }}>
                          {transport.toBranch}
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--dark)' }}>
                          {transport.sentAt ? formatDateDisplay(transport.sentAt) : "N/A"}
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--dark)' }}>
                          {getUserName(transport.senderId)}
                          {getUserEmail(transport.senderId) && (
                            <div style={{ fontSize: '12px', color: 'var(--gray)' }}>
                              {getUserEmail(transport.senderId)}
                            </div>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <AnimatePresence>
                  {selectedTransport?.id === transport.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden', marginTop: '1rem' }}
                    >
                      <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: 'var(--rounded-lg)' }}>
                        <div style={{ overflowX: 'auto', width: '100%', borderRadius: 'var(--rounded-lg)', border: '1px solid var(--border)' }}>
                          <table style={{ 
                            width: '100%', 
                            borderCollapse: 'collapse',
                            minWidth: '950px'
                          }}>
                            <thead>
                              <tr>
                                <th style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left', whiteSpace: 'nowrap' }}>Item Name</th>
                                <th style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left', whiteSpace: 'nowrap' }}>Barcode</th>
                                <th style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left', whiteSpace: 'nowrap' }}>Bought Bill #</th>
                                <th style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: 'var(--gray)', textAlign: 'center', whiteSpace: 'nowrap' }}>Sent</th>
                                <th style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: 'var(--gray)', textAlign: 'center', whiteSpace: 'nowrap' }}>Received</th>
                                <th style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: 'var(--gray)', textAlign: 'center', whiteSpace: 'nowrap' }}>Diff</th>
                                <th style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: 'var(--gray)', textAlign: 'right', whiteSpace: 'nowrap' }}>Net Price</th>
                                <th style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: 'var(--gray)', textAlign: 'right', whiteSpace: 'nowrap' }}>Out Price</th>
                                <th style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', color: 'var(--gray)', textAlign: 'left', whiteSpace: 'nowrap' }}>Expire Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {transport.items.map((item, index) => {
                                const key = `${transport.id}-${index}`;
                                const adjustedQty = adjustedQuantities[key] !== undefined ? adjustedQuantities[key] : item.quantity;
                                const difference = adjustedQty - item.quantity;
                                const currency = item.currency || item.originalCurrency || "IQD";
                                
                                return (
                                  <tr key={index} style={{ transition: 'background-color 0.2s' }}>
                                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--dark)' }}>{item.name}</td>
                                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--gray)' }}>{item.barcode}</td>
                                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--dark)', fontFamily: 'monospace' }}>
                                      {item.boughtBillNumber && item.boughtBillNumber !== "N/A" ? (
                                        <span style={{ backgroundColor: '#e5e7eb', padding: '2px 6px', borderRadius: '4px' }}>
                                          #{item.boughtBillNumber}
                                        </span>
                                      ) : (
                                        <span style={{ color: '#9ca3af' }}>N/A</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '14px', color: 'var(--gray)', textAlign: 'center' }}>
                                      {item.quantity}
                                    </td>
                                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                      <input
                                        type="number"
                                        value={adjustedQty}
                                        onChange={(e) => handleQuantityChange(transport.id, index, e.target.value)}
                                        min="0"
                                        max={item.quantity}
                                        style={{
                                          width: '70px',
                                          padding: '4px 6px',
                                          border: '1px solid var(--border)',
                                          borderRadius: 'var(--rounded-md)',
                                          fontSize: '14px',
                                          textAlign: 'center',
                                          backgroundColor: difference !== 0 ? 'rgba(245, 158, 11, 0.1)' : 'white'
                                        }}
                                      />
                                    </td>
                                    <td style={{ 
                                      padding: '10px 14px', 
                                      whiteSpace: 'nowrap', 
                                      fontSize: '14px', 
                                      textAlign: 'center',
                                      color: difference < 0 ? 'var(--danger)' : difference > 0 ? 'var(--warning)' : 'var(--gray)',
                                      fontWeight: difference !== 0 ? '600' : 'normal'
                                    }}>
                                      {difference === 0 ? "—" : difference > 0 ? `+${difference}` : difference}
                                    </td>
                                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--gray)', textAlign: 'right' }}>
                                      {formatCurrency(item.netPrice, currency)}
                                      <div style={{ fontSize: '10px', color: 'var(--gray)', opacity: 0.7 }}>
                                        {currency}
                                      </div>
                                    </td>
                                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--gray)', textAlign: 'right' }}>
                                      {formatCurrency(item.outPrice, currency)}
                                      <div style={{ fontSize: '10px', color: 'var(--gray)', opacity: 0.7 }}>
                                        {currency}
                                      </div>
                                    </td>
                                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--gray)', textAlign: 'left' }}>
                                      {item.expireDate ? formatDateDisplay(item.expireDate) : "N/A"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {transport.notes && (
                          <div style={{ 
                            marginTop: '1rem', 
                            padding: '12px', 
                            backgroundColor: 'rgba(245, 158, 11, 0.1)', 
                            borderRadius: 'var(--rounded-lg)',
                            borderLeft: '4px solid var(--warning)'
                          }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '4px' }}>Sender Notes</h4>
                            <p style={{ color: 'var(--dark)' }}>{transport.notes}</p>
                          </div>
                        )}

                        <div style={{ marginTop: '1rem' }}>
                          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--dark)', marginBottom: '8px' }}>
                            Your Notes
                            <span style={{ fontSize: '12px', color: 'var(--gray)', marginLeft: '8px' }}>
                              (Explain any quantity differences if needed)
                            </span>
                          </label>
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="input"
                            placeholder="Add any notes for this transport, especially if quantities differ from what was sent..."
                          />
                        </div>

                        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                          <button
                            onClick={() => handleReceive("rejected")}
                            className="btn btn-danger"
                            disabled={processing}
                          >
                            {processing ? (
                              <>
                                <div style={{ 
                                  animation: 'spin 1s linear infinite', 
                                  borderRadius: '9999px', 
                                  height: '16px', 
                                  width: '16px', 
                                  borderTop: '2px solid white', 
                                  borderBottom: '2px solid white', 
                                  marginRight: '8px' 
                                }}></div>
                                Processing...
                              </>
                            ) : (
                              "Reject"
                            )}
                          </button>
                          <button
                            onClick={() => handleReceive("received")}
                            className="btn btn-secondary"
                            disabled={processing}
                          >
                            {processing ? (
                              <>
                                <div style={{ 
                                  animation: 'spin 1s linear infinite', 
                                  borderRadius: '9999px', 
                                  height: '16px', 
                                  width: '16px', 
                                  borderTop: '2px solid white', 
                                  borderBottom: '2px solid white', 
                                  marginRight: '8px' 
                                }}></div>
                                Processing...
                              </>
                            ) : (
                              "Accept with Adjustments"
                            )}
                          </button>
                        </div>
                        
                        <div style={{ 
                          marginTop: '1rem', 
                          padding: '12px', 
                          backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                          borderRadius: 'var(--rounded-md)',
                          fontSize: '14px',
                          color: 'var(--dark)'
                        }}>
                          <strong>Note:</strong> When you adjust quantities, missing items will be moved to the Missing Items tracking list rather than creating duplicate store rows with missing bill numbers.
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={() => setSelectedTransport(selectedTransport?.id === transport.id ? null : transport)}
                  style={{
                    marginTop: '1rem',
                    width: '100%',
                    fontSize: '14px',
                    color: 'var(--primary)',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px'
                  }}
                >
                  {selectedTransport?.id === transport.id ? "Hide Details" : "Show Details & Adjust Quantities"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}