"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function LoginPage() {
  const { user, login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Authenticate using AuthContext
      await login(email, password);

      // 2. Fetch user data from Firestore and save role to localStorage
      if (auth.currentUser) {
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          localStorage.setItem("userRole", userData.role);
        }
      }
    } catch (err) {
      setPassword("");
      setError(err.message || "Invalid email or password");
      
      // Trigger error shake animation
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nm-wrapper">
      <style>{neumorphicStyles}</style>

      <div className={`nm-card ${isShaking ? "nm-shake" : ""}`}>
        {/* Aran Logo Extrusion */}
        <div className="nm-avatar-container">
          <div className="">
            <img
              src="/Aranlogo.png"
              alt="Aran Med Store"
              className=""
              width={"250px"}
 
            />
          </div>
        </div>

        {/* Header */}
        <div className="nm-header">
      
          <p className="nm-subtitle">Please sign in to continue</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="nm-error-box">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="nm-form">
          {/* Email Input */}
          <div className="nm-input-wrapper">
            <Mail
              size={18}
              className={`nm-input-icon ${error ? "nm-icon-error" : ""}`}
            />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              disabled={loading}
              required
              className={`nm-input ${error ? "nm-input-error" : ""}`}
            />
          </div>

          {/* Password Input */}
          <div className="nm-input-wrapper">
            <Lock
              size={18}
              className={`nm-input-icon ${error ? "nm-icon-error" : ""}`}
            />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              disabled={loading}
              required
              className={`nm-input ${error ? "nm-input-error" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="nm-toggle-btn"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff size={18} className="nm-icon-muted" />
              ) : (
                <Eye size={18} className="nm-icon-muted" />
              )}
            </button>
          </div>

          {/* Utilities: Remember Me */}
          <div className="nm-utility-row">
            <label className="nm-checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="nm-checkbox-input"
              />
              <span className="nm-checkbox-custom">
                {rememberMe && <span className="nm-checkbox-dot" />}
              </span>
              <span>Remember me</span>
            </label>
          </div>

          {/* Primary Action Button */}
          <button type="submit" disabled={loading} className="nm-btn-primary">
            {loading ? (
              <span className="nm-loading-row">
                <span className="nm-spinner" />
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="nm-divider-container">
          <div className="nm-divider-line" />
        </div>

        {/* Footer */}
        <div className="nm-footer">
          <p>
            Copyright &copy; {new Date().getFullYear()} Aran Med Store. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

const neumorphicStyles = `
  :root {
    --nm-bg: #e6ebf1;
    --nm-light-shadow: #ffffff;
    --nm-dark-shadow: #c8d0da;
    --nm-text-main: #2d3748;
    --nm-text-muted: #8c9ba5;
    --nm-error: #ef4444;
    --nm-error-bg: #fee2e2;
  }

  .nm-wrapper {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--nm-bg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    padding: 24px 16px;
    box-sizing: border-box;
  }

  .nm-card {
    background: var(--nm-bg);
    width: 100%;
    max-width: 380px;
    border-radius: 36px;
    padding: 40px 32px 36px;
    box-shadow: 14px 14px 28px var(--nm-dark-shadow),
                -14px -14px 28px var(--nm-light-shadow);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    transition: transform 0.2s ease;
  }

  /* Smooth Error Shake */
  .nm-shake {
    animation: nm-shake-anim 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }

  @keyframes nm-shake-anim {
    10%, 90% { transform: translate3d(-2px, 0, 0); }
    20%, 80% { transform: translate3d(3px, 0, 0); }
    30%, 50%, 70% { transform: translate3d(-5px, 0, 0); }
    40%, 60% { transform: translate3d(5px, 0, 0); }
  }

  .nm-avatar-container {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
  }

  .nm-avatar-circle {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--nm-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 8px;
    box-sizing: border-box;
    box-shadow: 6px 6px 12px var(--nm-dark-shadow),
                -6px -6px 12px var(--nm-light-shadow);
  }

  .nm-logo-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .nm-header {
    text-align: center;
    margin-bottom: 24px;
  }

  .nm-title {
    color: var(--nm-text-main);
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 6px;
    letter-spacing: -0.3px;
  }

  .nm-subtitle {
    color: var(--nm-text-muted);
    font-size: 13px;
    margin: 0;
    font-weight: 400;
  }

  .nm-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .nm-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .nm-input-icon {
    position: absolute;
    left: 16px;
    color: var(--nm-text-muted);
    pointer-events: none;
    transition: color 0.2s ease;
  }

  .nm-icon-error {
    color: var(--nm-error) !important;
  }

  .nm-input {
    width: 100%;
    height: 52px;
    padding: 0 44px 0 46px;
    background: var(--nm-bg);
    border: 1.5px solid transparent;
    outline: none;
    border-radius: 14px;
    font-size: 14px;
    color: var(--nm-text-main);
    box-shadow: inset 4px 4px 8px var(--nm-dark-shadow),
                inset -4px -4px 8px var(--nm-light-shadow);
    transition: all 0.25s ease;
    box-sizing: border-box;
  }

  .nm-input::placeholder {
    color: var(--nm-text-muted);
  }

  .nm-input:focus {
    box-shadow: inset 5px 5px 10px var(--nm-dark-shadow),
                inset -5px -5px 10px var(--nm-light-shadow);
  }

  /* Red Border & Inner Shadow on Error */
  .nm-input-error {
    border-color: rgba(239, 68, 68, 0.6) !important;
    box-shadow: inset 3px 3px 6px var(--nm-dark-shadow),
                inset -3px -3px 6px var(--nm-light-shadow),
                0 0 0 1px rgba(239, 68, 68, 0.2) !important;
  }

  .nm-toggle-btn {
    position: absolute;
    right: 14px;
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
  }

  .nm-icon-muted {
    color: var(--nm-text-muted);
  }

  .nm-utility-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    padding: 2px 2px;
  }

  .nm-checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--nm-text-muted);
    cursor: pointer;
    user-select: none;
  }

  .nm-checkbox-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .nm-checkbox-custom {
    width: 18px;
    height: 18px;
    border-radius: 5px;
    background: var(--nm-bg);
    box-shadow: inset 2px 2px 4px var(--nm-dark-shadow),
                inset -2px -2px 4px var(--nm-light-shadow);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nm-checkbox-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background-color: var(--nm-text-main);
  }

  .nm-btn-primary {
    height: 50px;
    margin-top: 8px;
    background: var(--nm-bg);
    border: none;
    border-radius: 14px;
    font-size: 15px;
    font-weight: 700;
    color: var(--nm-text-main);
    cursor: pointer;
    box-shadow: 5px 5px 10px var(--nm-dark-shadow),
                -5px -5px 10px var(--nm-light-shadow);
    transition: all 0.15s ease-in-out;
  }

  .nm-btn-primary:active {
    box-shadow: inset 3px 3px 6px var(--nm-dark-shadow),
                inset -3px -3px 6px var(--nm-light-shadow);
  }

  .nm-btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .nm-divider-container {
    display: flex;
    align-items: center;
    margin: 24px 0 16px;
  }

  .nm-divider-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--nm-dark-shadow), transparent);
  }

  .nm-footer {
    text-align: center;
    font-size: 12px;
    color: var(--nm-text-muted);
  }

  .nm-footer p {
    margin: 0;
  }

  .nm-error-box {
    background: var(--nm-error-bg);
    color: var(--nm-error);
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 13px;
    margin-bottom: 14px;
    text-align: center;
    font-weight: 500;
  }

  .nm-loading-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .nm-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--nm-text-muted);
    border-top: 2px solid var(--nm-text-main);
    border-radius: 50%;
    animation: nm-spin 0.8s linear infinite;
  }

  @keyframes nm-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;