"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  CalendarCheck,
  CalendarDays,
  Video,
  LogOut,
  Shield,
  School,
  UserPlus,
  BookOpen,
  Clock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  count?: number | string;
  badgeType?: "number" | "tag" | "highlight";
}

const adminNavItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Live CCTV Feeds", href: "/cctv", icon: Video, badgeType: "highlight", count: "LIVE" },
  { name: "Academic Management", href: "/academic", icon: School },
  { name: "Add Student", href: "/academic?tab=enrollment", icon: UserPlus, badgeType: "tag", count: "ENROLL" },
  { name: "Faculty Management", href: "/faculty", icon: GraduationCap },
  { name: "Timetable", href: "/timetable", icon: CalendarDays },
  { name: "Attendance & Analytics", href: "/attendance", icon: CalendarCheck },
];

const teacherNavItems: NavItem[] = [
  { name: "Live Attendance", href: "/teacher?tab=live_attendance", icon: CalendarCheck, badgeType: "highlight", count: "LIVE" },
  { name: "My Timetable", href: "/teacher?tab=weekly_timetable", icon: CalendarDays },
  { name: "My Subject Matrix", href: "/teacher?tab=subject_matrix", icon: BookOpen },
  { name: "Today's Schedule", href: "/teacher?tab=today_timeline", icon: Clock },
];

function checkIsItemActive(itemHref: string, pathname: string, currentTab: string | null): boolean {
  const [itemPath, itemQuery] = itemHref.split("?");
  const itemParams = new URLSearchParams(itemQuery || "");
  const itemTab = itemParams.get("tab");

  // Teacher portal items
  if (itemPath === "/teacher") {
    if (pathname !== "/teacher") return false;
    const effectiveTab = currentTab || "live_attendance";
    if (itemTab === "live_attendance") {
      return effectiveTab === "live_attendance" || effectiveTab === "class_teacher_ledger";
    }
    return effectiveTab === itemTab;
  }

  // Admin portal: Add Student vs Academic Management
  if (itemHref === "/academic?tab=enrollment") {
    return (pathname === "/academic" && currentTab === "enrollment") || pathname === "/enrollment";
  }

  if (itemHref === "/academic") {
    if (pathname === "/academic") {
      return currentTab !== "enrollment";
    }
    return pathname === "/classroom" || pathname === "/subjects" || pathname === "/students";
  }

  // Dashboard
  if (itemHref === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/";
  }

  // CCTV
  if (itemHref === "/cctv") {
    return pathname.startsWith("/cctv");
  }

  // Faculty
  if (itemHref === "/faculty") {
    return pathname.startsWith("/faculty");
  }

  // Timetable
  if (itemHref === "/timetable") {
    return pathname.startsWith("/timetable");
  }

  // Attendance
  if (itemHref === "/attendance") {
    return pathname.startsWith("/attendance") || pathname.startsWith("/sessions");
  }

  return pathname === itemHref;
}

function SidebarNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams ? searchParams.get("tab") : null;
  const { user } = useAuth();
  const isFaculty = user?.role === "FACULTY" || pathname.startsWith("/teacher");
  const navItems = isFaculty ? teacherNavItems : adminNavItems;

  return (
    <div>
      <div className="px-3 mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {isFaculty ? "Faculty Portal" : "Admin Navigation"}
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = checkIsItemActive(item.href, pathname, currentTab);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                isActive
                  ? "bg-blue-50/90 text-blue-600 font-bold border border-blue-100 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                  }`}
                />
                <span>{item.name}</span>
              </div>

              <div className="flex items-center gap-2">
                {item.count !== undefined && (
                  <span
                    className={`text-[10px] font-semibold flex items-center justify-center ${
                      isActive || item.badgeType === "highlight"
                        ? "bg-blue-600 text-white px-1.5 py-0.2 rounded-full"
                        : item.badgeType === "tag"
                        ? "bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-mono font-bold"
                        : "bg-slate-100 text-slate-600 w-5 h-5 rounded-full"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
      setIsLoggingOut(false);
    }
  };

  return (
    <aside className="w-64 shrink-0 border-r border-slate-100 bg-white hidden md:flex flex-col justify-between p-4 shadow-[1px_0_4px_0_rgba(0,0,0,0.01)] sticky top-[61px] h-[calc(100vh-61px)]">
      {/* Top navigation area */}
      <div className="space-y-6 overflow-y-auto pr-1">
        <Suspense fallback={<div className="p-4 text-xs text-slate-400">Loading navigation...</div>}>
          <SidebarNavContent />
        </Suspense>

        {/* System & AI Engine Status Badge */}
        <div className="px-3 py-3 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700">AI Core Engine</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed font-mono">
            YuNet (640) + SFace (128-D) Active
          </p>
        </div>
      </div>

      {/* Bottom user profile card */}
      <div className="pt-4 border-t border-slate-100">
        <div className="p-2.5 rounded-2xl bg-slate-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
              {user?.full_name ? user.full_name[0].toUpperCase() : "A"}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {user?.full_name || "System Admin"}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Shield className="w-2.5 h-2.5 text-blue-500" />
                <span className="capitalize">{user?.role || "ADMIN"}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            title="Log Out"
            className="p-1.5 rounded-xl hover:bg-white text-slate-400 hover:text-rose-600 transition shadow-xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
