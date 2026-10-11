"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import CourseCard from "@/ui/course-design-cards";
import { Trophy, Calendar, ArrowRight, ArrowUpRight, Activity, Shield, MapPin, CheckCircle2, Sparkles, Users, Target, Search, Filter, MoreHorizontal, Video } from "lucide-react";
import gsap from "gsap";
import { SlidingButton } from "@/app/login/components/SlidingButton";
import { IoFootballOutline } from "react-icons/io5";
const LottieIcon = ({ url, className }) => {
  useEffect(() => {
    // Only load the lordicon script once
    if (!document.querySelector('script[src="https://cdn.lordicon.com/lordicon.js"]')) {
      const script = document.createElement("script");
      script.src = "https://cdn.lordicon.com/lordicon.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <div className={className}>
      <lord-icon
        src={url}
        trigger="loop"
        colors="primary:#ffffff,secondary:#facc15"
        style={{ width: '100%', height: '100%' }}
      ></lord-icon>
    </div>
  );
};

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export default function PlayerDashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rankInfo, setRankInfo] = useState(null);

  const pageRef = useRef(null);
  const headerRef = useRef(null);
  const statsRef = useRef(null);
  const leftColRef = useRef(null);
  const rightColRef = useRef(null);

  useEffect(() => {
    loadDashboard();
    api.get("/dashboard/leaderboard")
      .then(res => {
        setRankInfo({
          rank: res.myRank || 1,
          total: res.totalPlayers || 1,
          myData: res.myData
        });
      })
      .catch(err => console.error(err));
  }, []);

  const loadDashboard = () => {
    setLoading(true);
    api.get("/dashboard/player/dashboard")
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || "Failed to load player stats.");
        setLoading(false);
      });
  };

  // GSAP Animations
  useEffect(() => {
    if (!pageRef.current || loading || error || !data) return;

    const ctx = gsap.context(() => {
      const elements = [
        headerRef.current,
        statsRef.current,
        leftColRef.current,
        rightColRef.current
      ].filter(Boolean);

      gsap.set(elements, {
        y: 30,
        opacity: 0
      });

      const tl = gsap.timeline();
      tl.to(elements, {
        y: 0,
        opacity: 1,
        duration: 0.6,
        stagger: 0.15,
        ease: 'power2.out'
      });
    }, pageRef);

    return () => ctx.revert();
  }, [loading, error, data]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
          <div className="w-8 h-8 border-[3px] border-yellow-400 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(250,204,21,0.5)]"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-8 rounded-xl text-center max-w-xl mx-auto mt-20 bg-[#0c0c0e] border border-red-500/20 shadow-2xl">
          <h3 className="text-red-400 font-semibold mb-2 tracking-wide text-sm" style={{ fontFamily: SF }}>Error Loading Dashboard</h3>
          <p className="text-white/60 text-xs" style={{ fontFamily: SF }}>{error}</p>
        </div>
      </DashboardLayout>
    );
  }

  const { profile, videos, analyses, trials, tournaments } = data;
  const recentAnalysis = analyses && analyses[0];

  // Refined Premium SaaS Card matching SlidingButton background
  const FinanciaCard = ({ children, className = "", glowIntensity = "low", padding = "p-5", variant = "default" }) => {
    const intensityMap = {
      none: "transparent",
      low: "rgba(250, 204, 21, 0.1)",
      medium: "rgba(250, 204, 21, 0.2)",
      high: "rgba(250, 204, 21, 0.35)"
    };

    const BOX_SHADOW = {
      default:
        "inset 0 1px 1px 0 rgba(255,255,255,0.08), inset 0 -2px 4px 0 rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.3)",
      outline:
        "inset 0 1px 2px 0 rgba(0,0,0,0.1), inset 0 0 0 1px rgba(255,255,255,0.08)",
    };
    
    return (
      <div 
        className={`relative rounded-2xl bg-[#121214] overflow-hidden transition-all duration-400 hover:-translate-y-1 hover:shadow-2xl ${className}`}
        style={{ boxShadow: BOX_SHADOW[variant] || BOX_SHADOW.default }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />
        <div className={`relative z-10 w-full h-full ${padding} flex flex-col`}>
          {children}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="w-full h-full bg-black" ref={pageRef}>
        <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 space-y-6 lg:space-y-8 relative z-10" style={{ fontFamily: SF }}>
        
        {/* HEADER SECTION */}
        <div ref={headerRef} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 lg:gap-6">
          <div className="flex items-center gap-3">
            <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-white/95 leading-none">
              Dashboard
            </h1>
            <div className="h-5 w-[1px] bg-white/10 hidden md:block" />
            <p className="text-white/50 text-[13px] hidden md:block mt-0.5">
              Welcome back, <span className="text-white/80 font-medium">{profile?.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 lg:gap-3 w-full md:w-auto">
            <div className="relative group flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-yellow-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-full bg-[#0c0c0e]/80 backdrop-blur-md border border-white/[0.06] rounded-lg py-2 pl-9 pr-4 text-[13px] text-white/90 placeholder:text-white/30 focus:outline-none focus:border-yellow-400/40 transition-all shadow-sm"
              />
            </div>
            <button className="shrink-0 w-9 h-9 rounded-lg bg-[#0c0c0e]/80 border border-white/[0.06] hover:border-white/20 hover:bg-white/5 transition-colors flex items-center justify-center text-white/60">
              <Filter className="w-4 h-4" />
            </button>
            <button className="shrink-0 w-9 h-9 rounded-lg bg-yellow-400 hover:bg-yellow-500 transition-colors flex items-center justify-center text-black shadow-[0_4px_12px_rgba(250,204,21,0.25)]">
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* QUICK STATS GRID */}
        <div ref={statsRef} className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <style>{`
            @keyframes football-bounce {
              0%, 100% { transform: translateY(0) rotate(0deg); }
              50% { transform: translateY(-4px) rotate(45deg); }
            }
            .animate-football {
              animation: football-bounce 2.5s ease-in-out infinite;
            }
          `}</style>
          {[
            { label: "Matches", value: profile?.matchesPlayed || 0, trend: "+2", glow: "low", lottieUrl: "https://cdn.lordicon.com/wxnxiano.json" },
            { label: "Goals", value: profile?.goals || 0, trend: "+12%", glow: "low", icon: <IoFootballOutline className="w-6 h-6 text-white opacity-90 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] group-hover:text-yellow-400 transition-colors duration-500 animate-football" /> },
            { label: "Assists", value: profile?.assists || 0, trend: "+4%", glow: "low", lottieUrl: "https://cdn.lordicon.com/bgebyztw.json" },
            { label: "Clean Sheets", value: profile?.cleanSheets || 0, trend: "+1", glow: "low", lottieUrl: "https://cdn.lordicon.com/qwwuyobg.json" },
          ].map((stat, i) => (
            <FinanciaCard key={i} glowIntensity={stat.glow} padding="p-5" className="min-h-[120px] group cursor-pointer flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-white/[0.08] to-transparent border border-white/[0.05] flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] opacity-80 group-hover:opacity-100 group-hover:border-yellow-400/30 group-hover:from-yellow-400/10 group-hover:shadow-[0_0_15px_rgba(250,204,21,0.15)] transition-all duration-300">
                  {stat.lottieUrl ? (
                    <LottieIcon url={stat.lottieUrl} className="w-7 h-7 drop-shadow-md" />
                  ) : (
                    stat.icon
                  )}
                </div>
                {stat.trend && (
                  <span className="text-yellow-400 text-[11px] font-bold bg-yellow-400/10 px-2 py-0.5 rounded-md border border-yellow-400/20 shadow-[0_0_10px_rgba(250,204,21,0.1)] tracking-tight">
                    {stat.trend}
                  </span>
                )}
              </div>
              <div>
                <div className="text-4xl font-bold tracking-tight bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent leading-none mb-1.5">{stat.value}</div>
                <div className="text-xs text-white/50 font-semibold tracking-tight">{stat.label}</div>
              </div>
            </FinanciaCard>
          ))}
        </div>

        {/* MAIN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          
          {/* LEFT COLUMN (2/3 width) */}
          <div ref={leftColRef} className="lg:col-span-2 space-y-4 lg:space-y-6">
            
            {/* PROFILE OVERVIEW */}
            <FinanciaCard glowIntensity="medium" padding="p-0" className="overflow-hidden">
              <div className="p-5 lg:p-6 flex flex-col md:flex-row items-center md:items-start gap-6">
                <div className="relative w-24 h-24 lg:w-28 lg:h-28 rounded-full overflow-hidden border-2 border-white/10 bg-zinc-900 shrink-0 shadow-xl ring-2 ring-black/50">
                  {profile?.profilePhoto ? (
                    <img src={profile.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-semibold text-white/40 bg-gradient-to-br from-zinc-800 to-[#0c0c0e]">
                      {profile?.name ? profile.name.charAt(0) : "U"}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 text-center md:text-left flex flex-col justify-center">
                  <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                    <h2 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent tracking-tight">{profile?.name}</h2>
                    {profile?.verifiedBadge && (
                      <div className="mx-auto md:mx-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                      </div>
                    )}
                  </div>
                  
                  <p className="text-[14px] text-white/60 mb-6 flex items-center justify-center md:justify-start gap-2.5 font-medium">
                    <span className="text-white font-semibold px-2 py-0.5 bg-white/10 rounded-md text-[11px] uppercase tracking-wider">{profile?.preferredPosition || 'CAM'}</span>
                    <span className="opacity-30">•</span>
                    <span>{profile?.currentClub || profile?.organization || profile?.agency || 'Free Agent'}</span>
                  </p>
                  
                  <div className="grid grid-cols-3 gap-4 border border-white/[0.06] bg-white/[0.02] rounded-xl p-5 shadow-inner mt-2">
                    <div className="flex flex-col items-center md:items-start border-r border-white/5">
                      <span className="text-sm text-white/50 font-medium mb-1">Overall Score</span>
                      <span className="text-3xl font-bold bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent leading-none">{rankInfo?.myData ? rankInfo.myData.overallScore : (profile?.skills?.overallScore || 0)}</span>
                    </div>
                    <div className="flex flex-col items-center md:items-start border-r border-white/5 pl-5">
                      <span className="text-sm text-white/50 font-medium mb-1">No of Reports</span>
                      <span className="text-3xl font-bold bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent leading-none">
                        {profile?.skills?.reportsCount ?? profile?.skills?.scoutReportsCount ?? profile?.skills?.scoutRatingsCount ?? 0}
                      </span>
                    </div>
                    <div className="flex flex-col items-center md:items-start pl-5">
                      <span className="text-sm text-white/50 font-medium mb-1">Global Rank</span>
                      <span className="text-3xl font-bold bg-gradient-to-br from-yellow-300 to-yellow-600 bg-clip-text text-transparent leading-none drop-shadow-sm">#{rankInfo?.rank || 1}</span>
                    </div>
                  </div>
                </div>
                
                <div className="shrink-0 hidden md:block">
                  <button onClick={() => router.push("/player/profile")} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="border-t border-white/[0.04] bg-[#0c0c0e]/60 px-5 lg:px-6 py-4 flex justify-between items-center backdrop-blur-md">
                <span className="text-[13px] text-white/60 font-medium">Top <span className="text-white font-bold">{Math.max(1, Math.round(((rankInfo?.rank || 1) / (rankInfo?.total || 14)) * 100))}%</span> of all players globally</span>
                <SlidingButton onClick={() => router.push("/player/profile")} className="h-9 px-4 text-xs">
                  Full Profile
                </SlidingButton>
              </div>
            </FinanciaCard>

            {/* ONGOING PROGRAMS / TRIALS (Course Design Cards) */}
            <div className="pt-2">
              <div className="flex justify-between items-end mb-6 px-1">
                <div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent tracking-tight">Active Programs</h3>
                  <p className="text-sm text-white/50 mt-1 font-medium">Track your ongoing training and trials</p>
                </div>
                <button onClick={() => router.push('/player/tournaments')} className="flex items-center gap-1.5 text-[11px] font-bold text-white/60 hover:text-white transition-colors bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-4 py-2 rounded-lg">
                  FILTER <Filter className="w-3.5 h-3.5" />
                </button>
              </div>

              {trials && trials.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                  {trials.map((trial, index) => {
                    const isCompleted = trial.isCompleted || trial.isRated || trial.myStatus === "completed" || (trial.scoutScore !== undefined && trial.scoutScore !== null) || (trial.myStatus === "accepted" && new Date(trial.date) < new Date());
                    const isAccepted = trial.myStatus === "accepted";
                    const isRegistered = trial.isRegistered;
                    const colors = ['yellow', 'green', 'blue', 'orange', 'red'];
                    
                    const cardData = {
                      id: trial._id,
                      colorClass: isCompleted ? 'green' : colors[index % colors.length],
                      date: new Date(trial.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                      title: trial.title || "Elite Trial",
                      description: trial.location,
                      progressPercent: (isCompleted || isAccepted) ? '100%' : isRegistered ? '50%' : '0%',
                      progressValue: isCompleted ? 'Completed' : isAccepted ? 'Confirmed' : isRegistered ? 'Pending' : 'Not Applied',
                      imgSrc1: 'https://cdn.21st.dev/assets/mirror/7f/7fd6c9c03ca80e37fe8b9d2c0a7bbcb0cfc0efb7ddfee804eae550721823b005.jpg',
                      imgAlt1: 'User 1',
                      imgSrc2: 'https://cdn.21st.dev/assets/mirror/fa/fa7717cc596a4e9f046857063a32bf2b02e92641715dee729e2193845a3c96c3.jpg',
                      imgAlt2: 'User 2',
                      countdownText: isCompleted ? (trial.scoutScore ? `Score: ${trial.scoutScore}/99` : 'Completed') : trial.time,
                    };
                    
                    return <CourseCard key={trial._id} data={cardData} />;
                  })}
                </div>
              ) : (
                <div className="relative overflow-hidden py-10 flex flex-col items-center justify-center bg-[#121214] rounded-2xl border border-white/[0.04] shadow-inner group">
                  
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-white/[0.06] to-transparent border border-white/[0.05] flex items-center justify-center mb-5 transition-transform duration-300 group-hover:-translate-y-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                    <LottieIcon url="https://cdn.lordicon.com/qfbuijil.json" className="w-8 h-8 opacity-70 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                  </div>
                  
                  <div className="text-center relative z-10 px-4">
                    <h4 className="text-lg font-bold text-white mb-1.5">No Active Programs</h4>
                    <p className="text-sm text-white/50 mb-6 max-w-xs mx-auto leading-relaxed">
                      You aren't enrolled in any training programs or elite trials yet.
                    </p>
                    
                    <div className="flex justify-center">
                      <SlidingButton onClick={() => router.push('/player/tournaments')} className="mx-auto">
                        DISCOVER PROGRAMS
                      </SlidingButton>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN (1/3 width) */}
          <div ref={rightColRef} className="space-y-4 lg:space-y-6 flex flex-col">
            
            {/* AI INSIGHTS CARD */}
            <FinanciaCard glowIntensity="high" padding="p-5" className="flex-1">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 flex items-center justify-center opacity-90 drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]">
                    <LottieIcon url="https://cdn.lordicon.com/kthelypq.json" className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-semibold text-white/90">Coaching Insight</h3>
                </div>
                <button className="w-7 h-7 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-center text-white/40 hover:text-white transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 flex flex-col justify-center py-4">
                {recentAnalysis ? (
                  <>
                    <div className="text-[64px] font-bold bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent leading-none text-center mb-1 drop-shadow-sm">
                      12<span className="text-3xl text-white/40 font-medium">%</span>
                    </div>
                    <div className="text-base text-yellow-400/90 font-medium text-center mb-6">Reaction Growth</div>
                    
                    <p className="text-sm text-white/60 leading-relaxed text-center px-2 font-medium">
                      Your <span className="text-white/90 font-semibold">{recentAnalysis.drillType}</span> drill shows positive growth. Keep focusing on footwork consistency to maximize acceleration.
                    </p>
                  </>
                ) : (
                  <div className="text-center px-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-white/[0.06] to-transparent border border-white/[0.05] flex items-center justify-center mx-auto mb-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                      <LottieIcon url="https://cdn.lordicon.com/msoeawqm.json" className="w-8 h-8 opacity-60 drop-shadow-lg" />
                    </div>
                    <p className="text-[15px] font-bold text-white leading-relaxed mb-2">
                      No recent analysis
                    </p>
                    <p className="text-[13px] text-white/50 font-medium">
                      Upload a training video to generate your biomechanical assessment.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="mt-8 pt-5 border-t border-white/[0.06] flex justify-center">
                <SlidingButton onClick={() => router.push("/player/coach")} className="w-full flex justify-center py-4">
                  OPEN AI TERMINAL
                </SlidingButton>
              </div>
            </FinanciaCard>

            {/* ACTIVE LEAGUES */}
            <FinanciaCard glowIntensity="none" padding="p-5">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-base font-semibold text-white/90">Active Leagues</h3>
                <button onClick={() => router.push('/player/tournaments')} className="w-6 h-6 rounded-md bg-white/[0.02] border border-white/[0.04] flex items-center justify-center text-white/40 hover:text-white transition-colors">
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              
              <div className="space-y-2">
                {tournaments && tournaments.slice(0, 3).map((t) => (
                  <div key={t._id} className="group cursor-pointer flex justify-between items-center p-2.5 -mx-2.5 rounded-lg hover:bg-white/[0.02] transition-colors" onClick={() => router.push("/player/tournaments")}>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-white/20 group-hover:bg-yellow-400 transition-colors duration-300" />
                      <div>
                        <h4 className="text-[14px] font-semibold text-white/80 leading-none mb-1 group-hover:text-white transition-colors">{t.name}</h4>
                        <span className="text-[12px] text-white/40 block">{t.location}</span>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                ))}
                {(!tournaments || tournaments.length === 0) && (
                   <div className="flex flex-col items-center justify-center py-8 px-4 text-center border border-white/[0.04] bg-white/[0.01] rounded-xl relative overflow-hidden group">
                     <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-white/[0.06] to-transparent border border-white/[0.05] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                       <LottieIcon url="https://cdn.lordicon.com/mrdiiocb.json" className="w-7 h-7 opacity-50 group-hover:opacity-80 transition-opacity drop-shadow-md" />
                     </div>
                     <span className="text-sm font-bold text-white mb-1">No Active Leagues</span>
                     <span className="text-xs text-white/50">Join a league to start competing.</span>
                   </div>
                )}
              </div>
            </FinanciaCard>

          </div>
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
}
