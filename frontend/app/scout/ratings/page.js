"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import PlayerInspectModal from "@/components/PlayerInspectModal";
import { 
  Award, Search, Star, Calendar, MapPin, Sliders, 
  Trash2, MessageSquare, ExternalLink, ShieldCheck, 
  TrendingUp, Activity, CheckCircle2, Filter, ArrowUpDown, 
  ChevronRight, Sparkles, User, RefreshCw
} from "lucide-react";
import { SlidingButton } from "@/app/login/components/SlidingButton";

export default function ScoutPreviousRatingsPage() {
  const router = useRouter();
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inspectingPlayer, setInspectingPlayer] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("ALL");
  const [sortBy, setSortBy] = useState("newest"); // "newest", "score_desc", "score_asc", "name"
  const [deletingId, setDeletingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    loadRatings();
  }, []);

  const loadRatings = async () => {
    setLoading(true);
    try {
      const res = await api.get("/dashboard/scout/ratings");
      setRatings(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Error loading scout ratings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRating = async (ratingId) => {
    setDeletingId(ratingId);
    try {
      await api.delete(`/dashboard/scout/ratings/${ratingId}`);
      setRatings(prev => prev.filter(r => r._id !== ratingId && r.id !== ratingId));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Error deleting rating:", err);
      alert("Failed to delete rating: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartChat = async (targetUserId) => {
    try {
      const chat = await api.post("/social/chats/start", { targetUserId });
      router.push(`/scout/messages?chatId=${chat._id}`);
    } catch (e) {
      console.error("Chat error:", e);
    }
  };

  // Inspect player profile details
  const handleInspect = async (playerObj) => {
    const rawId = playerObj?._id || playerObj?.id || playerObj?.profileId;
    if (!rawId) return;
    try {
      const res = await api.get(`/dashboard/profile/${rawId}`);
      setInspectingPlayer(res.profile || res);
    } catch (err) {
      console.error("Failed to inspect profile:", err);
    }
  };

  // Derived filtered & sorted ratings
  const filteredRatings = useMemo(() => {
    return ratings
      .filter(item => {
        const playerName = item.player?.name || "";
        const trialTitle = item.trial?.title || "";
        const query = searchQuery.toLowerCase().trim();
        const matchesQuery = !query || playerName.toLowerCase().includes(query) || trialTitle.toLowerCase().includes(query);

        const position = (item.player?.preferredPosition || "").toUpperCase();
        const matchesPos = selectedPosition === "ALL" || position === selectedPosition;

        return matchesQuery && matchesPos;
      })
      .sort((a, b) => {
        if (sortBy === "score_desc") return (b.scoutScore || 0) - (a.scoutScore || 0);
        if (sortBy === "score_asc") return (a.scoutScore || 0) - (b.scoutScore || 0);
        if (sortBy === "name") return (a.player?.name || "").localeCompare(b.player?.name || "");
        // newest default
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      });
  }, [ratings, searchQuery, selectedPosition, sortBy]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (!ratings.length) return { total: 0, avgScore: 0, highestScore: 0, trialCount: 0 };
    const total = ratings.length;
    const sum = ratings.reduce((acc, cur) => acc + (cur.scoutScore || 0), 0);
    const avgScore = Math.round(sum / total);
    const highestScore = Math.max(...ratings.map(r => r.scoutScore || 0));
    const trialCount = ratings.filter(r => !!r.trial).length;
    return { total, avgScore, highestScore, trialCount };
  }, [ratings]);

  const getRecommendationBadge = (rec) => {
    switch (rec) {
      case "SIGN_IMMEDIATELY":
        return (
          <span className="bg-amber-500/20 text-yellow-400 border border-yellow-400/40 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-yellow-400" /> Sign Immediately
          </span>
        );
      case "SHORTLIST_FOR_TRIAL":
        return (
          <span className="bg-sky-500/20 text-sky-400 border border-sky-500/40 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-sky-400" /> Shortlist for Trial
          </span>
        );
      case "MONITOR_DEVELOPMENT":
        return (
          <span className="bg-purple-500/20 text-purple-400 border border-purple-500/40 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-purple-400" /> Monitor Development
          </span>
        );
      case "REJECT":
        return (
          <span className="bg-red-500/20 text-red-400 border border-red-500/40 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
            ✕ Reject / Pass
          </span>
        );
      default:
        return (
          <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
            {rec || "Evaluated"}
          </span>
        );
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
    if (score >= 80) return "text-yellow-400 border-yellow-400/40 bg-yellow-400/10";
    if (score >= 70) return "text-sky-400 border-sky-400/40 bg-sky-400/10";
    return "text-zinc-400 border-zinc-700 bg-zinc-800/40";
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 px-4 md:px-0 py-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/[0.06] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 flex items-center gap-1">
                <Award className="w-3 h-3" /> Scout Intelligence
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-[11px] font-semibold text-zinc-400">Official Evaluation Archive</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              Previous Player Ratings
            </h1>
            <p className="text-white/50 text-sm mt-1 font-medium">
              Review, inspect, and analyze all talent evaluations and trial performance scores you have submitted.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadRatings}
              className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-yellow-400/50 text-zinc-400 hover:text-white transition-all"
              title="Refresh Ratings"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-yellow-400' : ''}`} />
            </button>
            <SlidingButton
              onClick={() => router.push("/scout/trials")}
              className="h-12 px-6 font-black uppercase tracking-widest text-xs"
            >
              Go to Trials Calendar →
            </SlidingButton>
          </div>
        </div>

        {/* Aggregate Metrics Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#121214] border border-white/[0.04] p-5 rounded-[24px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] relative overflow-hidden group">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">
              <span>Total Evaluations</span>
              <Award className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="text-3xl font-black text-white">{stats.total}</div>
            <span className="text-[10px] text-zinc-500 font-medium">Prospects reviewed</span>
          </div>

          <div className="bg-[#121214] border border-white/[0.04] p-5 rounded-[24px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] relative overflow-hidden group">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">
              <span>Average Scout Score</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-yellow-400">
              {stats.avgScore > 0 ? `${stats.avgScore}` : "—"}
              <span className="text-sm text-zinc-500 font-bold ml-1">/ 99</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-medium">Across all profiles</span>
          </div>

          <div className="bg-[#121214] border border-white/[0.04] p-5 rounded-[24px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] relative overflow-hidden group">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">
              <span>Highest Score</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-black text-emerald-400">
              {stats.highestScore > 0 ? `${stats.highestScore}` : "—"}
              <span className="text-sm text-zinc-500 font-bold ml-1">/ 99</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-medium">Top prospect score</span>
          </div>

          <div className="bg-[#121214] border border-white/[0.04] p-5 rounded-[24px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] relative overflow-hidden group">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">
              <span>Trial Ratings</span>
              <Calendar className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-3xl font-black text-white">{stats.trialCount}</div>
            <span className="text-[10px] text-zinc-500 font-medium">Official trial matches</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-[#121214] border border-white/[0.04] p-4 rounded-[24px] flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search player or trial..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-white pl-10 pr-4 py-2.5 rounded-xl text-xs focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {/* Position filter */}
            <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-850 p-1 rounded-xl shrink-0">
              {["ALL", "ST", "CAM", "CM", "CB", "GK"].map((pos) => (
                <button
                  key={pos}
                  onClick={() => setSelectedPosition(pos)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all uppercase ${
                    selectedPosition === pos
                      ? "bg-yellow-400 text-black shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>

            {/* Sort selector */}
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-850 px-3 py-2 rounded-xl text-xs text-zinc-400 shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-white text-[11px] font-medium outline-none cursor-pointer"
              >
                <option value="newest" className="bg-zinc-900 text-white">Newest First</option>
                <option value="score_desc" className="bg-zinc-900 text-white">Highest Score</option>
                <option value="score_asc" className="bg-zinc-900 text-white">Lowest Score</option>
                <option value="name" className="bg-zinc-900 text-white">Player Name</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ratings List / Cards */}
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Loading Previous Ratings...</span>
          </div>
        ) : filteredRatings.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center bg-[#121214] border border-white/[0.04] rounded-[32px] px-6">
            <div className="w-16 h-16 bg-white/[0.02] border border-white/[0.05] rounded-full flex items-center justify-center mb-4">
              <Award className="w-7 h-7 text-white/20" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              {ratings.length === 0 ? "No Previous Ratings Yet" : "No Matching Evaluations"}
            </h3>
            <p className="text-xs text-white/40 max-w-md mb-6 leading-relaxed">
              {ratings.length === 0
                ? "When you evaluate players in scouting trials or prospect search, your calculated scout scores and attribute cards will be archived here permanently."
                : "No rated players match your current search and filter criteria. Try clearing filters or searching for another prospect."}
            </p>
            {ratings.length === 0 ? (
              <SlidingButton
                onClick={() => router.push("/scout/trials")}
                className="h-12 px-6 font-black uppercase tracking-widest text-xs"
              >
                Evaluate Players in Trials Calendar
              </SlidingButton>
            ) : (
              <button
                onClick={() => { setSearchQuery(""); setSelectedPosition("ALL"); }}
                className="px-4 py-2 rounded-xl bg-zinc-900 text-yellow-400 border border-yellow-400/30 text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {filteredRatings.map((rating) => {
              const p = rating.player || {};
              const tr = rating.trial;
              const dateStr = rating.updatedAt || rating.createdAt
                ? new Date(rating.updatedAt || rating.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "Recent";

              return (
                <div
                  key={rating._id}
                  className="bg-[#121214] border border-white/[0.05] hover:border-yellow-400/40 rounded-[28px] p-6 transition-all duration-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] relative overflow-hidden group"
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    
                    {/* Player Info Left Section */}
                    <div className="flex items-center gap-4 min-w-[280px]">
                      <div 
                        onClick={() => handleInspect(p)}
                        className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-700/80 overflow-hidden shrink-0 cursor-pointer group-hover:border-yellow-400 transition-colors relative shadow-md"
                      >
                        <img
                          src={p.profilePhoto || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150"}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[8px] font-black text-yellow-400 border border-yellow-400/30">
                          {p.preferredPosition || "ST"}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 
                            onClick={() => handleInspect(p)}
                            className="text-lg font-bold text-white hover:text-yellow-400 cursor-pointer transition-colors"
                          >
                            {p.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            {p.ageCategory || "Senior"}
                          </span>
                        </div>

                        <div className="text-xs text-zinc-400 flex items-center gap-3 font-medium">
                          <span>{p.club || "Free Agent"}</span>
                          {p.city && (
                            <>
                              <span className="text-zinc-600">•</span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-zinc-500" />
                                {p.city}{p.country ? `, ${p.country}` : ""}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Associated Trial Badge */}
                        {tr ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-yellow-400/90 font-medium pt-1">
                            <Calendar className="w-3.5 h-3.5 text-yellow-400" />
                            <span className="truncate max-w-[280px] font-semibold">{tr.title}</span>
                            {tr.location && <span className="text-zinc-500">(@ {tr.location})</span>}
                          </div>
                        ) : (
                          <div className="text-[11px] text-zinc-500 font-medium pt-1">
                            Direct Scout Prospect Rating
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Overall Score & Recommendation Middle Section */}
                    <div className="flex flex-wrap items-center gap-4 lg:gap-6 bg-zinc-950/80 border border-zinc-850 px-5 py-3 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center ${getScoreColor(rating.scoutScore)}`}>
                          <span className="text-xl font-black leading-none">{rating.scoutScore || 0}</span>
                          <span className="text-[8px] font-bold tracking-widest uppercase opacity-70">SCOUT</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">Overall Rating</span>
                          <span className="text-xs text-white font-semibold">Weighted for {p.preferredPosition || "ST"}</span>
                        </div>
                      </div>

                      <div className="h-8 w-[1px] bg-zinc-800 hidden sm:block" />

                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Verdict</span>
                        {getRecommendationBadge(rating.recommendation)}
                      </div>
                    </div>

                    {/* Six Attribute Meters */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full lg:w-auto">
                      {[
                        { label: "PAC", val: rating.speed, color: "text-amber-400" },
                        { label: "SHO", val: rating.shooting, color: "text-red-400" },
                        { label: "PAS", val: rating.passing, color: "text-blue-400" },
                        { label: "DRI", val: rating.dribbling, color: "text-purple-400" },
                        { label: "DEF", val: rating.defending, color: "text-emerald-400" },
                        { label: "PHY", val: rating.physical, color: "text-orange-400" },
                      ].map((attr) => (
                        <div key={attr.label} className="bg-zinc-950 border border-zinc-850 px-2.5 py-1.5 rounded-xl text-center min-w-[48px]">
                          <span className="text-[9px] font-bold text-zinc-500 block uppercase">{attr.label}</span>
                          <span className={`text-sm font-black ${attr.color}`}>{attr.val || 50}</span>
                        </div>
                      ))}
                    </div>

                    {/* Actions Right Section */}
                    <div className="flex items-center gap-2 w-full lg:w-auto justify-end border-t lg:border-t-0 border-zinc-800/80 pt-3 lg:pt-0">
                      <button
                        onClick={() => handleInspect(p)}
                        className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs font-bold transition-all flex items-center gap-1.5"
                        title="View Full Profile"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>

                      {p._id && (
                        <button
                          onClick={() => handleStartChat(p._id)}
                          className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-yellow-400 border border-yellow-400/30 text-xs font-bold transition-all flex items-center gap-1.5"
                          title="Message Player"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat</span>
                        </button>
                      )}

                      {deleteConfirmId === rating._id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteRating(rating._id)}
                            disabled={deletingId === rating._id}
                            className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-[10px] font-bold uppercase hover:bg-red-500 transition-colors"
                          >
                            {deletingId === rating._id ? "..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase hover:bg-zinc-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(rating._id)}
                          className="p-2 rounded-xl bg-zinc-900/60 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 border border-transparent hover:border-red-500/30 transition-all"
                          title="Delete Rating Evaluation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                  </div>

                  {/* Footer metadata */}
                  <div className="mt-4 pt-3 border-t border-zinc-850/60 flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Official Scout Evaluation recorded on {dateStr}
                    </span>
                    {rating.scoutingVideo && (
                      <a 
                        href={rating.scoutingVideo} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-yellow-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <ExternalLink className="w-3 h-3" /> Scouting Video Attached
                      </a>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Profile Inspect Modal */}
      {inspectingPlayer && (
        <PlayerInspectModal
          player={inspectingPlayer}
          onClose={() => setInspectingPlayer(null)}
          onStartChat={handleStartChat}
        />
      )}
    </DashboardLayout>
  );
}
