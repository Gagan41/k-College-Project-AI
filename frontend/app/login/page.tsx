"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  ArrowLeft,
  X,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { useAuth, Role } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login, resendOtp } = useAuth();
  
  // Form States
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [selectedRole, setSelectedRole] = useState<Role>("ADMIN");
  const [email, setEmail] = useState("cortinexwebstudio@gmail.com");
  const [password, setPassword] = useState("admin123");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  
  // UX States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Forgot Password Modal States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "reset">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handleRequestResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to dispatch reset code.");
      setForgotSuccess(data.message || "A 6-digit verification code has been dispatched to your email.");
      setForgotStep("reset");
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : "Failed to dispatch reset code.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          otp: forgotOtp.trim(),
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to reset password.");
      setSuccessMsg(data.message || "Password reset successful! Please sign in with your new password.");
      setPassword(newPassword);
      setEmail(forgotEmail);
      setShowForgotModal(false);
      setForgotStep("email");
      setForgotOtp("");
      setNewPassword("");
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleRoleChange = (role: Role) => {
    setError(null);
    if (role === "ADMIN") {
      setSelectedRole("ADMIN");
      setEmail("cortinexwebstudio@gmail.com");
      setPassword("admin123");
    } else if (role === "FACULTY") {
      setSelectedRole("FACULTY");
      setEmail("kushalvr15@gmail.com");
      setPassword("faculty123");
    }
  };

  // Cooldown countdown for resend OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "otp" && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const result = await login(email, password);
      if (result.requires_otp) {
        setStep("otp");
        setSuccessMsg(result.message || "A 6-digit OTP code has been sent to your email.");
        setResendCooldown(60);
        setCanResend(false);
        setTimeout(() => {
          otpInputsRef.current[0]?.focus();
        }, 150);
      } else {
        const dest = result.user?.role === "FACULTY" ? "/teacher" : "/dashboard";
        setSuccessMsg(result.user?.role === "FACULTY" ? "Authenticated! Redirecting to Teacher Portal..." : "Authenticated successfully! Redirecting...");
        setTimeout(() => router.push(dest), 500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pasted = value.slice(0, 6).split("");
      const newOtp = [...otp];
      pasted.forEach((char, i) => {
        if (i < 6) newOtp[i] = char;
      });
      setOtp(newOtp);
      const nextFocus = Math.min(pasted.length, 5);
      otpInputsRef.current[nextFocus]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next box
    if (value && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await login(email, password, otpCode);
      const dest = res.user?.role === "FACULTY" ? "/teacher" : "/dashboard";
      setSuccessMsg(res.user?.role === "FACULTY" ? "Security verified! Redirecting to Teacher Portal..." : "Security verification passed! Redirecting to Dashboard...");
      setTimeout(() => router.push(dest), 600);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setLoading(true);
    setError(null);
    try {
      const ok = await resendOtp(email);
      if (ok) {
        setSuccessMsg("A new verification OTP has been dispatched to your email.");
        setResendCooldown(60);
        setCanResend(false);
        setOtp(["", "", "", "", "", ""]);
        otpInputsRef.current[0]?.focus();
      } else {
        setError("Failed to resend OTP. Please try again.");
      }
    } catch {
      setError("Error while dispatching new OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] w-full flex items-center justify-center p-4 relative overflow-hidden bg-slate-50">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-100/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Logo & Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 mb-2">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Smart CCTV Ledger</h1>
          <p className="text-xs text-slate-500">Multi-Factor Biometric Attendance & Automated Ledger</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl shadow-slate-200/60 border border-slate-200">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: CREDENTIALS */}
          {step === "credentials" && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Select Role Preset</label>
                  <span className="text-[10px] text-blue-600 font-semibold">Faculty & Admin Access</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleRoleChange("ADMIN")}
                    className={`py-1.5 rounded-lg text-xs font-bold transition truncate px-2 ${
                      selectedRole === "ADMIN"
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Administrator
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleChange("FACULTY")}
                    className={`py-1.5 rounded-lg text-xs font-bold transition truncate px-2 ${
                      selectedRole === "FACULTY"
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Faculty
                  </button>
                </div>
              </div>

              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Email Address / ID</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                      placeholder="name@university.edu"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotModal(true);
                        setForgotEmail(email);
                        setForgotStep("email");
                        setForgotError(null);
                        setForgotSuccess(null);
                      }}
                      className="text-[11px] text-blue-600 hover:underline cursor-pointer font-semibold"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <span>Authenticating...</span>
                  ) : (
                    <>
                      <span>Sign In to Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* STEP 2: 2FA OTP VERIFICATION */}
          {step === "otp" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <button
                  onClick={() => {
                    setStep("credentials");
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Account</span>
                </button>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                  2FA Active
                </span>
              </div>

              <div className="text-center space-y-1">
                <div className="inline-flex p-3 rounded-full bg-blue-50 text-blue-600 mb-1 border border-blue-100">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Enter Security Code</h3>
                <p className="text-xs text-slate-500">
                  A 6-digit OTP has been sent to <span className="text-slate-800 font-semibold">{email}</span>
                </p>
              </div>

              <form onSubmit={handleOtpSubmit} className="space-y-5">
                {/* 6 Digit Boxes */}
                <div className="flex justify-center gap-2">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputsRef.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-11 h-12 text-center text-lg font-bold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition font-mono"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.join("").length !== 6}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? (
                    <span>Verifying Code...</span>
                  ) : (
                    <>
                      <span>Verify & Access Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Resend Actions */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <span>Did not receive code?</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={!canResend || loading}
                  className={`font-semibold transition flex items-center gap-1.5 ${
                    canResend
                      ? "text-blue-600 hover:underline cursor-pointer"
                      : "text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                  <span>{canResend ? "Resend Code" : `Resend in ${resendCooldown}s`}</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Note */}
          <div className="pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              TLS Encrypted • 6-Digit Verification • Multi-Factor Protection
            </p>
          </div>
        </div>

        {/* FORGOT PASSWORD MODAL */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Reset Password</h3>
                    <p className="text-[11px] text-slate-500">
                      {forgotStep === "email" ? "Request verification code" : "Set your new password"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {forgotError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{forgotError}</span>
                </div>
              )}

              {forgotSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>{forgotSuccess}</span>
                </div>
              )}

              {forgotStep === "email" ? (
                <form onSubmit={handleRequestResetOtp} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Account Email</label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="e.g. kushalvr15@gmail.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-3.5 py-2 rounded-xl text-slate-600 font-medium hover:bg-slate-100 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading || !forgotEmail.trim()}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {forgotLoading ? "Sending OTP..." : "Send Reset Code"}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">6-Digit Reset Code (OTP)</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.trim())}
                      placeholder="123456"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-center font-mono font-bold tracking-widest text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setForgotStep("email")}
                      className="text-slate-500 hover:text-slate-800 text-[11px] underline cursor-pointer"
                    >
                      &larr; Back
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading || forgotOtp.length !== 6 || newPassword.length < 6}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {forgotLoading ? "Resetting..." : "Set New Password"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
