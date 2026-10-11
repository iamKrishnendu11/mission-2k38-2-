"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api, getSocketUrl } from "@/lib/api";
import {
  Home, User, Video, TrendingUp, Trophy, Users,
  MessageSquare, Bell, Settings, LogOut, Search, BookOpen, ShieldAlert, FileText, Award,
  Menu, PanelLeft, PanelLeftClose, ChevronDown, ChevronLeft, ChevronRight, Activity, Cpu, Network, Check
} from "lucide-react";
import Image from "next/image";
import { gsap } from "gsap";
import { io as ioClient } from "socket.io-client";

// Reusable Avatar component
function Avatar({ size = "sm", text = "U", img = null }) {
  const sizeMap = { sm: "w-8 h-8 text-sm", md: "w-11 h-11 text-xl", lg: "w-16 h-16 text-2xl" };
  const s = sizeMap[size] || sizeMap.sm;
  return (
    <div className={`relative ${s} rounded-full overflow-hidden flex items-center justify-center border border-yellow-400/20 bg-zinc-900 shrink-0 shadow-[inset_0_0_10px_rgba(250,204,21,0.1)]`}>
      {img ? (
        <img src={img} alt="Avatar" className="w-full h-full object-cover" />
      ) : (
        <span className="font-black uppercase text-yellow-400">{text}</span>
      )}
    </div>
  );
}

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, sans-serif';

function Sidebar({
  collapsed, setCollapsed, navLinks, pathname, router, user, profile, unreadCount, onLogout
}) {
  const sidebarRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!sidebarRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(sidebarRef.current, { width: collapsed ? 72 : 260, duration: 0.3, ease: "power3.inOut" });
    });
    return () => ctx.revert();
  }, [collapsed]);

  useEffect(() => {
    if (contentRef.current) {
      gsap.to(contentRef.current, {
        opacity: collapsed ? 0 : 1,
        duration: 0.3,
        delay: collapsed ? 0 : 0.2,
        display: collapsed ? "none" : "block",
        ease: "power2.out"
      });
    }
  }, [collapsed]);

  const userInitial = (profile?.name || user?.email || "U").charAt(0).toUpperCase();
  const mainLinks = navLinks.slice(0, Math.ceil(navLinks.length / 2));
  const secondaryLinks = navLinks.slice(Math.ceil(navLinks.length / 2));

  return (
    <div
      ref={sidebarRef}
      className={`absolute md:relative h-full flex flex-col shrink-0 overflow-hidden z-[100] transition-all duration-300 ${collapsed ? 'max-md:!w-0 max-md:!border-r-0 max-md:!opacity-0' : 'max-md:!w-[260px]'}`}
      style={{
        width: 260,
        background: "rgba(5,5,7,0.95)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Header */}
      <div
        className="sb-item flex items-center justify-between px-3 shrink-0"
        style={{ height: 56, borderBottom: collapsed ? "none" : "1px solid rgba(255,255,255,0.06)" }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5 pl-2">
            <Avatar size="sm" img={profile?.profilePhoto} text={userInitial} />
            <div className="flex flex-col justify-center -space-y-0.5">
              <span className="text-[14px] font-black tracking-widest text-white leading-none">
                MISSION <span className="text-yellow-400">2K38</span>
              </span>
              <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold">
                Elite Football AI
              </span>
            </div>
          </div>
        )}

        {!collapsed ? (
          <button
            onClick={() => setCollapsed(true)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 transition-all duration-150"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-full flex justify-center pt-2">
            <button onClick={() => setCollapsed(false)} className="group relative outline-none flex items-center justify-center w-8 h-8 rounded-md bg-white/5 hover:bg-white/10 transition-colors">
              <Menu className="w-4 h-4 text-white/50 group-hover:text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Collapsed icons */}
      {collapsed && (
        <div data-lenis-prevent="true" className="flex-1 flex flex-col items-center gap-4 py-4 overflow-y-auto w-[72px] mx-auto mt-2" style={{ scrollbarWidth: "none" }}>
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <button
                key={link.name}
                onClick={() => { setCollapsed(false); router.push(link.href); }}
                className={`relative overflow-hidden w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 group ${
                  isActive 
                    ? "text-white bg-black/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),inset_0_-4px_20px_-4px_rgba(255,255,255,0.12)]" 
                    : "text-white/50 hover:text-white bg-black/20 hover:bg-black/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),inset_0_-4px_20px_-4px_rgba(255,255,255,0.05)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),inset_0_-4px_20px_-4px_rgba(255,255,255,0.15)]"
                }`}
                title={link.name}
              >
                {isActive && (
                  <>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[1px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-80 pointer-events-none" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40%] h-[3px] bg-yellow-400 blur-[2px] opacity-60 pointer-events-none" />
                  </>
                )}
                {!isActive && (
                  <>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[1px] bg-gradient-to-r from-transparent via-[#A1A1AA] to-transparent opacity-60 group-hover:opacity-100 pointer-events-none transition-opacity duration-200" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40%] h-[3px] bg-[#A1A1AA] blur-sm opacity-30 group-hover:opacity-60 pointer-events-none transition-opacity duration-200" />
                  </>
                )}
                <Icon className={`relative z-10 w-[22px] h-[22px] transition-colors duration-200 ${isActive ? 'text-yellow-400' : ''}`} />
                {link.name === "Messages" && unreadCount > 0 && (
                   <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
            )
          })}
          
          <div className="mt-auto mb-6 flex flex-col gap-5 items-center shrink-0 w-full">
            <button onClick={onLogout} className="relative overflow-hidden w-12 h-12 rounded-xl flex items-center justify-center text-red-400/50 hover:text-red-400 bg-black/20 hover:bg-black/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] hover:shadow-[inset_0_0_0_1px_rgba(239,68,68,0.3)] transition-all duration-200 group" title="Log Out">
              <LogOut className="relative z-10 w-[22px] h-[22px] transition-colors duration-200" />
            </button>
          </div>
        </div>
      )}

      {/* Expanded Content */}
      {!collapsed && (
        <div ref={contentRef} data-lenis-prevent="true" className="flex-1 overflow-y-auto overflow-x-hidden pb-36" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
          
          <div className="px-3 space-y-5 mt-4">
            {/* Workspace Links */}
            <div className="sb-item">
              <div className="w-full flex items-center justify-between px-2 mb-2 group">
                <span className="text-xs font-semibold text-white/30 uppercase tracking-wider" style={{ fontFamily: SF }}>
                  Workspace
                </span>
              </div>
              <div className="relative overflow-hidden rounded-2xl p-1.5" style={{ background: "rgba(0,0,0,0.6)", boxShadow: "0 8px 32px -8px rgba(255, 255, 255, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 -4px 20px -4px rgba(255, 255, 255, 0.12)", backdropFilter: "blur(24px)" }}>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[1px] bg-gradient-to-r from-transparent via-[#A1A1AA] to-transparent opacity-60 pointer-events-none" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40%] h-[3px] bg-[#A1A1AA] blur-sm opacity-30 pointer-events-none" />
                
                <div className="space-y-0.5 relative z-10 pb-0.5">
                  {mainLinks.map((link) => {
                    const isActive = pathname === link.href;
                    const Icon = link.icon;
                    return (
                      <button key={link.name} onClick={() => router.push(link.href)} className={`relative overflow-hidden w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 group ${isActive ? "text-white bg-black/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),inset_0_-4px_20px_-4px_rgba(255,255,255,0.12)]" : "text-white/50 hover:text-white hover:bg-black/40 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),inset_0_-4px_20px_-4px_rgba(255,255,255,0.08)]"}`} style={{ fontFamily: SF }}>
                        <div className="flex items-center gap-3 w-full text-left overflow-hidden">
                          <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[1px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent pointer-events-none transition-opacity duration-200 ${isActive ? 'opacity-80' : 'opacity-0'}`} />
                          <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[40%] h-[3px] bg-yellow-400 blur-sm pointer-events-none transition-opacity duration-200 ${isActive ? 'opacity-60' : 'opacity-0'}`} />
                          {!isActive && (
                            <>
                              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[1px] bg-gradient-to-r from-transparent via-[#A1A1AA] to-transparent opacity-0 group-hover:opacity-70 pointer-events-none transition-opacity duration-200" />
                              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40%] h-[3px] bg-[#A1A1AA] blur-sm opacity-0 group-hover:opacity-30 pointer-events-none transition-opacity duration-200" />
                            </>
                          )}
                          <Icon className={`relative z-10 w-[16px] h-[16px] shrink-0 transition-colors duration-200 ${isActive ? "text-yellow-400" : "text-white/30 group-hover:text-white/80"}`} />
                          <span className="relative z-10 truncate">{link.name}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Network & System Links */}
            <div className="sb-item">
              <div className="w-full flex items-center justify-between px-2 mb-2 group mt-4">
                <span className="text-xs font-semibold text-white/30 uppercase tracking-wider" style={{ fontFamily: SF }}>
                  Network
                </span>
              </div>
              <div className="relative overflow-hidden rounded-2xl p-1.5" style={{ background: "rgba(0,0,0,0.6)", boxShadow: "0 8px 32px -8px rgba(255, 255, 255, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 -4px 20px -4px rgba(255, 255, 255, 0.12)", backdropFilter: "blur(24px)" }}>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[1px] bg-gradient-to-r from-transparent via-[#A1A1AA] to-transparent opacity-60 pointer-events-none" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40%] h-[3px] bg-[#A1A1AA] blur-sm opacity-30 pointer-events-none" />
                
                <div className="space-y-0.5 relative z-10 pb-0.5">
                  {secondaryLinks.map((link) => {
                    const isActive = pathname === link.href;
                    const Icon = link.icon;
                    return (
                      <button key={link.name} onClick={() => router.push(link.href)} className={`relative overflow-hidden w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 group ${isActive ? "text-white bg-black/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),inset_0_-4px_20px_-4px_rgba(255,255,255,0.12)]" : "text-white/50 hover:text-white hover:bg-black/40 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),inset_0_-4px_20px_-4px_rgba(255,255,255,0.08)]"}`} style={{ fontFamily: SF }}>
                        <div className="flex items-center gap-3 w-full text-left overflow-hidden">
                          <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[1px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent pointer-events-none transition-opacity duration-200 ${isActive ? 'opacity-80' : 'opacity-0'}`} />
                          <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[40%] h-[3px] bg-yellow-400 blur-sm pointer-events-none transition-opacity duration-200 ${isActive ? 'opacity-60' : 'opacity-0'}`} />
                          {!isActive && (
                            <>
                              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[1px] bg-gradient-to-r from-transparent via-[#A1A1AA] to-transparent opacity-0 group-hover:opacity-70 pointer-events-none transition-opacity duration-200" />
                              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40%] h-[3px] bg-[#A1A1AA] blur-sm opacity-0 group-hover:opacity-30 pointer-events-none transition-opacity duration-200" />
                            </>
                          )}
                          <Icon className={`relative z-10 w-[16px] h-[16px] shrink-0 transition-colors duration-200 ${isActive ? "text-yellow-400" : "text-white/30 group-hover:text-white/80"}`} />
                          <span className="relative z-10 truncate">{link.name}</span>
                        </div>
                        {link.name === "Messages" && unreadCount > 0 && (
                          <span className="relative z-10 bg-yellow-400 text-black px-1.5 py-0.5 rounded text-[10px] font-bold">{unreadCount}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* User footer — fixed at bottom */}
      {!collapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#050507] via-[#050507]/90 to-transparent z-10 pointer-events-none h-32"></div>
      )}
      {!collapsed && (
        <div className="sb-item absolute bottom-4 left-3 right-3 z-20">
          <div
            className="relative flex items-center justify-between gap-3 px-3 py-3 rounded-2xl bg-black/60 backdrop-blur-xl w-full group cursor-pointer transition-colors hover:bg-black/80"
            style={{
              boxShadow: '0 4px 24px -6px rgba(250, 204, 21, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 -4px 12px -2px rgba(250, 204, 21, 0.2)'
            }}
          >
            {/* The Badge UI Glowing Bottom Borders */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[1px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-80" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40%] h-[3px] bg-yellow-400 blur-sm opacity-60" />

            <div className="relative shrink-0">
              <Avatar size="sm" img={profile?.profilePhoto} text={userInitial} />
            </div>

            <div className="flex-1 flex flex-col justify-center min-w-0 pr-1">
              <div className="text-[13px] font-semibold text-white/95 truncate tracking-tight" style={{ fontFamily: SF }}>
                {profile?.name || user?.email?.split('@')[0]}
              </div>
              <div className="text-[10px] text-white/50 mt-1" style={{ fontFamily: "Geist Mono, 'SF Mono', monospace", lineHeight: "1.3" }}>
                <div className="truncate" title={(profile?.organization && String(profile.organization).trim()) || (profile?.agency && String(profile.agency).trim()) || (profile?.clubRepresenting && String(profile.clubRepresenting).trim()) || (profile?.currentClub && String(profile.currentClub).trim()) || (profile?.club && String(profile.club).trim()) || (user?.role === "scout" ? "Independent Scout" : user?.role === "coach" ? "Independent Coach" : user?.role === "admin" ? "Mission 2K38 HQ" : "Free Agent")}>
                  <span className="text-yellow-400 font-semibold uppercase">{user?.role}</span> <span className="opacity-50">·</span> {(profile?.organization && String(profile.organization).trim()) || (profile?.agency && String(profile.agency).trim()) || (profile?.clubRepresenting && String(profile.clubRepresenting).trim()) || (profile?.currentClub && String(profile.currentClub).trim()) || (profile?.club && String(profile.club).trim()) || (user?.role === "scout" ? "Independent Scout" : user?.role === "coach" ? "Independent Coach" : user?.role === "admin" ? "Mission 2K38 HQ" : "Free Agent")}
                </div>
                <span className="text-white/30 text-[9px]">Secured Access</span>
              </div>
            </div>
            
            <button onClick={onLogout} className="text-white/30 hover:text-red-400 transition-colors shrink-0">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Topbar({ onToggleSidebar, sidebarCollapsed, notifications = [], unreadNotifsCount = 0, onMarkAllRead, router }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      className="flex items-center justify-between px-3 md:px-6 shrink-0 relative z-50 w-full"
      style={{
        height: 64,
        background: "rgba(0,0,0,0.6)",
        boxShadow: "inset 0 -1px 0 rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(24px)",
      }}
    >
      <div className="flex items-center gap-2 md:gap-3 relative z-10">
        <button
          onClick={onToggleSidebar}
          className={`text-white/50 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 ${!sidebarCollapsed ? 'md:hidden' : ''}`}
          title="Toggle Sidebar"
        >
          <Menu className="w-4 h-4 transition-colors duration-200 md:hidden" />
          <PanelLeft className="w-4 h-4 transition-colors duration-200 hidden md:block" />
        </button>
      </div>

      <div className="flex items-center gap-3 relative" ref={dropdownRef}>
        {/* Network / Status Badges */}
        <div className="hidden sm:flex items-center gap-1.5 mr-1">
          <div className="relative overflow-hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] text-yellow-400 bg-yellow-400/5 shadow-[inset_0_0_0_1px_rgba(250,204,21,0.2)]">
            <Activity className="w-3 h-3" />
            <span className="font-mono uppercase tracking-wider font-bold">SYSTEM ACTIVE</span>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[1px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50" />
          </div>
        </div>

        {/* Notifications Bell */}
        <button
          onClick={() => setShowDropdown(prev => !prev)}
          className="relative w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadNotifsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400 text-black text-[9px] font-black flex items-center justify-center shadow-md animate-pulse">
              {unreadNotifsCount}
            </span>
          )}
        </button>

        {/* Notifications Dropdown */}
        {showDropdown && (
          <div className="absolute right-0 top-12 w-80 md:w-96 rounded-2xl bg-[#0c0c0e] border border-white/10 shadow-2xl p-4 z-50 text-left space-y-3 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Notifications</span>
                {unreadNotifsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 text-[9px] font-bold">
                    {unreadNotifsCount} new
                  </span>
                )}
              </div>
              {unreadNotifsCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="text-[10px] text-yellow-400 hover:underline font-bold"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: 'thin' }}>
              {notifications.length === 0 ? (
                <div className="py-6 text-center text-xs text-white/40">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n._id}
                    onClick={() => {
                      if (n.data?.trialId) router.push('/player/tournaments');
                      else if (n.data?.reportId) router.push('/scout/reports');
                      setShowDropdown(false);
                    }}
                    className={`p-3 rounded-xl border text-xs transition-colors cursor-pointer ${
                      n.read 
                        ? 'bg-white/[0.02] border-white/[0.04] text-white/50 hover:bg-white/[0.04]' 
                        : 'bg-white/[0.06] border-yellow-400/30 text-white shadow-sm hover:border-yellow-400/50'
                    }`}
                  >
                    <div className="font-bold text-white mb-0.5 flex items-center justify-between">
                      <span className="truncate">{n.title}</span>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0 ml-2" />}
                    </div>
                    <div className="text-[11px] text-white/60 leading-snug">{n.message}</div>
                    <div className="text-[9px] text-white/30 mt-1.5">
                      {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : 'Recent'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [currentUser, setCurrentUser] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Background GSAP Refs
  const bgRef = useRef(null);

  useEffect(() => {
    let socket;
    let pollInterval;

    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("user");
      if (!userStr) {
        router.push("/login");
        return;
      }

      const parsedUser = JSON.parse(userStr);
      setCurrentUser(parsedUser);
      const rawUserId = parsedUser.id || parsedUser._id || parsedUser.userId || (parsedUser.user ? parsedUser.user.id || parsedUser.user._id : null);
      const cleanUserId = typeof rawUserId === "object" ? (rawUserId._id || rawUserId.id)?.toString() : rawUserId?.toString();

      // Immediately hydrate cached profile to prevent UI flicker
      const cachedProfileStr = localStorage.getItem("profile");
      if (cachedProfileStr) {
        try {
          const cachedProfile = JSON.parse(cachedProfileStr);
          if (cachedProfile) setCurrentProfile(cachedProfile);
        } catch (_) {}
      }

      const syncProfile = () => {
        api.get("/dashboard/profile")
          .then(res => {
            const freshProfile = res?.profile || res;
            if (freshProfile) {
              setCurrentProfile(freshProfile);
              localStorage.setItem("profile", JSON.stringify(freshProfile));
            }
          })
          .catch(err => console.error("Profile auto-sync notice:", err));
      };

      syncProfile();
      window.addEventListener("profile-updated", syncProfile);

      const loadNotifications = () => {
        api.get("/social/notifications")
          .then(data => {
            if (Array.isArray(data)) {
              setNotifications(data);
              setUnreadNotifsCount(data.filter(n => !n.read).length);
            }
          })
          .catch(err => console.error("Error loading notifications:", err));
      };

      const loadUnreadMessages = () => {
        api.get("/social/chats/unread-count")
          .then(res => {
            setUnreadMessagesCount(Number(res?.unreadCount) || 0);
          })
          .catch(() => {
            api.get("/social/chats")
              .then(chats => {
                if (Array.isArray(chats)) {
                  const total = chats.reduce((acc, c) => acc + (Number(c.unreadCount) || 0), 0);
                  setUnreadMessagesCount(total);
                } else {
                  setUnreadMessagesCount(0);
                }
              })
              .catch(() => setUnreadMessagesCount(0));
          });
      };

      loadNotifications();
      loadUnreadMessages();

      try {
        socket = ioClient(getSocketUrl(), {
          transports: ["websocket", "polling"],
          reconnection: true
        });

        if (cleanUserId) {
          socket.emit("join", cleanUserId);
        }

        socket.on("notification:new", (newNotif) => {
          setNotifications(prev => [newNotif, ...prev.filter(n => n._id !== newNotif._id)]);
          setUnreadNotifsCount(prev => prev + 1);
        });

        socket.on("receive_message", () => {
          loadUnreadMessages();
        });

        socket.on("chat_list_update", () => {
          loadUnreadMessages();
        });
      } catch (sErr) {
        console.warn("Socket.io connect notice:", sErr);
      }

      pollInterval = setInterval(() => {
        loadNotifications();
        loadUnreadMessages();
      }, 5000);

      return () => {
        if (socket) socket.disconnect();
        if (pollInterval) clearInterval(pollInterval);
        window.removeEventListener("profile-updated", syncProfile);
      };
    }
  }, [router]);

  useEffect(() => {
    // Initial background fade-in removed for seamless navigation
  }, []);

  const handleSignOut = () => {
    api.clearTokens();
    router.push("/login");
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      await api.post("/social/notifications/mark-all-read");
      setUnreadNotifsCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050507]">
        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(250,204,21,0.5)]"></div>
      </div>
    );
  }

  const getNavLinks = () => {
    const role = currentUser.role;
    if (role === "player") {
      return [
        { name: "Home", href: "/player", icon: Home },
        { name: "My Card", href: "/player/profile", icon: User },
        { name: "AI Coach", href: "/player/coach", icon: Video },
        { name: "Analytics", href: "/player/analytics", icon: TrendingUp },
        { name: "Upload Video", href: "/player/upload", icon: Video },
        { name: "Tournaments", href: "/player/tournaments", icon: Trophy },
        { name: "Scout Reports", href: "/scout/reports", icon: FileText },
        { name: "Community", href: "/player/community", icon: Users },
        { name: "Messages", href: "/player/messages", icon: MessageSquare },
        { name: "Profile", href: "/player/settings", icon: Settings },
      ];
    } else if (role === "scout") {
      return [
        { name: "Dashboard", href: "/scout", icon: Home },
        { name: "Search Players", href: "/scout/search", icon: Search },
        { name: "Trials Calendar", href: "/scout/trials", icon: Trophy },
        { name: "Previous Ratings", href: "/scout/ratings", icon: Award },
        { name: "Saved Players", href: "/scout/saved", icon: BookOpen },
        { name: "Scout Reports", href: "/scout/reports", icon: FileText },
        { name: "Messages", href: "/scout/messages", icon: MessageSquare },
        { name: "Settings", href: "/scout/settings", icon: Settings },
      ];
    } else if (role === "coach") {
      return [
        { name: "Dashboard", href: "/coach", icon: Home },
        { name: "Squad Board", href: "/coach/squad", icon: Users },
        { name: "Tournaments", href: "/coach/tournaments", icon: Trophy },
        { name: "Scout Reports", href: "/scout/reports", icon: FileText },
        { name: "Messages", href: "/coach/messages", icon: MessageSquare },
        { name: "Settings", href: "/coach/settings", icon: Settings },
      ];
    } else if (role === "admin") {
      return [
        { name: "Admin Panel", href: "/admin", icon: ShieldAlert },
        { name: "Scout Reports", href: "/scout/reports", icon: FileText },
        { name: "Settings", href: "/admin/settings", icon: Settings },
      ];
    }
    return [];
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#09090b] text-white" style={{ fontFamily: SF }}>

      {/* Mobile Overlay */}
      {!sidebarCollapsed && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        navLinks={getNavLinks()}
        pathname={pathname}
        router={router}
        user={currentUser}
        profile={currentProfile}
        unreadCount={unreadMessagesCount}
        onLogout={handleSignOut}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        <Topbar 
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} 
          sidebarCollapsed={sidebarCollapsed}
          notifications={notifications}
          unreadNotifsCount={unreadNotifsCount}
          onMarkAllRead={handleMarkAllNotifsRead}
          router={router}
        />

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
          <main className="min-h-full p-4 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
