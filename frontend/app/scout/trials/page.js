"use client";

import { useState, useEffect } from "react";
import { api, getSocketUrl } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import PlayerInspectModal from "@/components/PlayerInspectModal";
import {
  Calendar, MapPin, Clock, FileText, Plus, Shield, Users, Lock, Glob,
  CheckCircle2, AlertCircle, Search, UserCheck, X, Check, Eye, Sliders, Trash2
} from "lucide-react";
import { SlidingButton } from "@/app/login/components/SlidingButton";

import { io as ioClient } from "socket.io-client";

const AGE_OPTIONS = ["U-13", "U-15", "U-17", "U-19", "U-21", "U-23", "Senior"];
const POSITION_OPTIONS = ["ST", "LW", "RW", "CAM", "CM", "CDM", "LB", "RB", "CB", "GK", "WB"];

const POSITION_WEIGHTS = {
  'ST': { passing: 0.08, shooting: 0.35, dribbling: 0.10, speed: 0.20, defending: 0.02, physical: 0.25 },
  'LW': { passing: 0.20, shooting: 0.20, dribbling: 0.20, speed: 0.25, defending: 0.05, physical: 0.10 },
  'RW': { passing: 0.20, shooting: 0.20, dribbling: 0.20, speed: 0.25, defending: 0.05, physical: 0.10 },
  'CAM': { passing: 0.30, shooting: 0.15, dribbling: 0.30, speed: 0.15, defending: 0.05, physical: 0.05 },
  'CM': { passing: 0.35, shooting: 0.10, dribbling: 0.10, speed: 0.20, defending: 0.15, physical: 0.10 },
  'CDM': { passing: 0.20, shooting: 0.05, dribbling: 0.05, speed: 0.15, defending: 0.35, physical: 0.20 },
  'LB': { passing: 0.15, shooting: 0.05, dribbling: 0.05, speed: 0.25, defending: 0.25, physical: 0.25 },
  'RB': { passing: 0.15, shooting: 0.05, dribbling: 0.05, speed: 0.25, defending: 0.25, physical: 0.25 },
  'WB': { passing: 0.25, shooting: 0.10, dribbling: 0.05, speed: 0.25, defending: 0.15, physical: 0.20 },
  'CB': { passing: 0.10, shooting: 0.03, dribbling: 0.02, speed: 0.20, defending: 0.45, physical: 0.30 },
  'GK': { passing: 0.05, shooting: 0.05, dribbling: 0.05, speed: 0.10, defending: 0.40, physical: 0.35 }
};

function calcLiveScore(attrs, pos = 'ST') {
  const p = (pos || 'ST').toUpperCase();
  const w = POSITION_WEIGHTS[p] || POSITION_WEIGHTS['ST'];
  return Math.round(
    (Number(attrs.passing) || 0) * w.passing +
    (Number(attrs.shooting) || 0) * w.shooting +
    (Number(attrs.dribbling) || 0) * w.dribbling +
    (Number(attrs.speed) || 0) * w.speed +
    (Number(attrs.defending) || 0) * w.defending +
    (Number(attrs.physical) || 0) * w.physical
  );
}

export default function ScoutTrials() {
  const [trials, setTrials] = useState([]);
  const [playersList, setPlayersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");

  const [currentUser, setCurrentUser] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);

  const [inspectingPlayer, setInspectingPlayer] = useState(null);
  const [loadingInspect, setLoadingInspect] = useState(false);

  // Modal state for selected (accepted) trial performance rating
  const [ratingModal, setRatingModal] = useState(null); // { trial, applicant, rawPId }
  const [scoringData, setScoringData] = useState({
    speed: 50,
    passing: 50,
    dribbling: 50,
    shooting: 50,
    defending: 50,
    physical: 50,
    recommendation: "SHORTLIST_FOR_TRIAL",
    scoutingVideo: ""
  });
  const [submittingScore, setSubmittingScore] = useState(false);
  const [scoreSuccessMsg, setScoreSuccessMsg] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    ageCategory: [],
    positionsTarget: [],
    date: "",
    time: "09:00 AM",
    location: "",
    privacy: "public", // 'public' | 'private'
    invitedPlayers: []
  });

  const loadTrialsSilent = () => {
    api.get("/trials")
      .then(res => {
        if (Array.isArray(res)) setTrials(res);
      })
      .catch(err => console.error("Silent trials reload error:", err));
  };

  useEffect(() => {
    let socket;
    let pollInterval;

    if (typeof window !== "undefined") {
      const uStr = localStorage.getItem("user");
      const pStr = localStorage.getItem("profile");
      if (uStr) setCurrentUser(JSON.parse(uStr));
      if (pStr) setCurrentProfile(JSON.parse(pStr));

      try {
        socket = ioClient(getSocketUrl(), {
          transports: ["websocket", "polling"],
          reconnection: true
        });

        socket.on("notification:new", () => {
          loadTrialsSilent();
        });
      } catch (sErr) {
        console.warn("Socket connect notice:", sErr);
      }

      pollInterval = setInterval(() => {
        loadTrialsSilent();
      }, 4000);
    }

    loadTrials();
    loadPlayersList();

    return () => {
      if (socket) socket.disconnect();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  const openTrialRatingModal = async (trial, applicant, rawPId) => {
    setScoreSuccessMsg(null);
    setScoringData({
      speed: 50,
      passing: 50,
      dribbling: 50,
      shooting: 50,
      defending: 50,
      physical: 50,
      recommendation: "SHORTLIST_FOR_TRIAL",
      scoutingVideo: ""
    });
    setRatingModal({ trial, applicant, rawPId });

    try {
      const res = await api.get(`/dashboard/scout/rate/${rawPId}?trialId=${trial._id}`);
      if (res.myRating) {
        setScoringData({
          speed: res.myRating.speed || 50,
          passing: res.myRating.passing || 50,
          dribbling: res.myRating.dribbling || 50,
          shooting: res.myRating.shooting || 50,
          defending: res.myRating.defending || 50,
          physical: res.myRating.physical || 50,
          recommendation: res.myRating.recommendation || "SHORTLIST_FOR_TRIAL",
          scoutingVideo: res.myRating.scoutingVideo || ""
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTrial = async (trialId) => {
    try {
      await api.delete(`/trials/${trialId}`);
      setTrials(prev => prev.filter(t => t._id !== trialId));
    } catch (err) {
      console.error("Error deleting trial:", err);
      try {
        await api.delete(`/dashboard/scout/trials/${trialId}`);
        setTrials(prev => prev.filter(t => t._id !== trialId));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleScoutRateSubmit = async (e) => {
    e.preventDefault();
    if (!ratingModal) return;
    setSubmittingScore(true);
    setScoreSuccessMsg(null);
    try {
      const trialId = ratingModal.trial._id;
      const res = await api.post('/dashboard/scout/rate', {
        playerId: ratingModal.rawPId,
        trialId: trialId,
        ...scoringData
      });
      setScoreSuccessMsg(`Trial Evaluation Saved! Score: ${res.scoutScore}/99.`);
      
      // Optimistic update so UI instantly disables rate button
      setTrials(prev => prev.map(tr => {
        if (tr._id === trialId || tr.id === trialId) {
          return {
            ...tr,
            applicants: (tr.applicants || []).map(applicant => {
              const pId = applicant.player?._id || applicant.player?.id || applicant.player;
              if (String(pId) === String(ratingModal.rawPId)) {
                return {
                  ...applicant,
                  isRated: true,
                  scoutScore: res.scoutScore,
                  ratingData: res
                };
              }
              return applicant;
            })
          };
        }
        return tr;
      }));

      setTimeout(() => {
        setRatingModal(null);
        setScoreSuccessMsg(null);
        loadTrials();
      }, 1000);
    } catch (err) {
      console.error("Scout rate error:", err);
      alert("Failed to submit score: " + err.message);
    } finally {
      setSubmittingScore(false);
    }
  };

  const loadTrials = () => {
    setLoading(true);
    api.get("/trials")
      .then(res => {
        setTrials(res || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  const loadPlayersList = () => {
    api.get("/trials/players-list")
      .then(res => setPlayersList(res || []))
      .catch(err => console.error(err));
  };

  const inspectPlayerProfile = (rawPlayerId) => {
    const pId = typeof rawPlayerId === 'object' ? (rawPlayerId._id || rawPlayerId.id) : rawPlayerId;
    if (!pId) return;
    setLoadingInspect(true);
    api.get(`/dashboard/profile/${pId}`)
      .then(res => {
        setInspectingPlayer(res.profile || res);
        setLoadingInspect(false);
      })
      .catch(err => {
        console.error("Failed to inspect player profile:", err);
        setLoadingInspect(false);
      });
  };

  const toggleAgeGroup = (group) => {
    setFormData(prev => {
      const isSelected = prev.ageCategory.includes(group);
      return {
        ...prev,
        ageCategory: isSelected
          ? prev.ageCategory.filter(g => g !== group)
          : [...prev.ageCategory, group]
      };
    });
  };

  const toggleAllAgeGroups = () => {
    setFormData(prev => ({
      ...prev,
      ageCategory: prev.ageCategory.length === AGE_OPTIONS.length ? [] : [...AGE_OPTIONS]
    }));
  };

  const togglePosition = (pos) => {
    setFormData(prev => {
      const isSelected = prev.positionsTarget.includes(pos);
      return {
        ...prev,
        positionsTarget: isSelected
          ? prev.positionsTarget.filter(p => p !== pos)
          : [...prev.positionsTarget, pos]
      };
    });
  };

  const toggleAllPositions = () => {
    setFormData(prev => ({
      ...prev,
      positionsTarget: prev.positionsTarget.length === POSITION_OPTIONS.length ? [] : [...POSITION_OPTIONS]
    }));
  };

  const toggleInvitedPlayer = (pId) => {
    setFormData(prev => {
      const isInvited = prev.invitedPlayers.includes(pId);
      return {
        ...prev,
        invitedPlayers: isInvited
          ? prev.invitedPlayers.filter(id => id !== pId)
          : [...prev.invitedPlayers, pId]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(null);
    setError(null);

    try {
      if (!formData.title || !formData.date || !formData.time || !formData.location) {
        throw new Error("Title, date, time, and location are required.");
      }

      await api.post("/trials", formData);
      setSuccess("Trial scheduled successfully! Notifications sent to players.");
      setShowModal(false);
      
      // Reset form
      setFormData({
        title: "",
        description: "",
        ageCategory: [],
        positionsTarget: [],
        date: "",
        time: "09:00 AM",
        location: "",
        privacy: "public",
        invitedPlayers: []
      });

      loadTrials();
    } catch (err) {
      setError(err.message || "Failed to schedule trial.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplicantStatus = async (trialId, rawPlayerId, status) => {
    try {
      const playerId = typeof rawPlayerId === 'object' ? (rawPlayerId._id || rawPlayerId.id) : rawPlayerId;
      await api.put(`/trials/${trialId}/applicant`, { playerId, status });
      loadTrials();
    } catch (err) {
      console.error("Error updating applicant status:", err);
    }
  };

  const filteredPlayers = playersList.filter(p => 
    p.name.toLowerCase().includes(playerSearchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(playerSearchQuery.toLowerCase()) ||
    p.preferredPosition.toLowerCase().includes(playerSearchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8 px-4 md:px-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/[0.04] pb-6 pt-10">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              Scouting Trials Manager
            </h2>
            <p className="text-white/50 text-sm mt-1 font-medium">
              Schedule public trials or invite specific players to private evaluations
            </p>
          </div>

          <SlidingButton
            onClick={() => setShowModal(true)}
            className="h-14 px-8 font-black uppercase tracking-widest text-sm"
          >
            + Schedule New Trial
          </SlidingButton>
        </div>

        {success && (
          <div className="p-4 rounded-2xl bg-green-950/40 border border-green-500/50 flex items-center gap-3 text-green-200 text-sm">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* SCHEDULE TRIAL MODAL */}
        {showModal && (
          <div data-lenis-prevent className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
            <div data-lenis-prevent className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 max-w-3xl w-full space-y-6 my-auto max-h-[85vh] overflow-y-auto overscroll-contain shadow-2xl">
              <div className="flex justify-between items-center border-b border-zinc-850 pb-4">
                <div>
                  <h3 className="text-xl font-black uppercase text-white tracking-wider flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-yellow-400" /> Schedule Scouting Trial
                  </h3>
                  <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mt-0.5">
                    Define target age, position specs, location & privacy settings
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/50 flex items-center gap-3 text-red-200 text-sm">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-1">Trial Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. U-19 Open Scouting Trial & Evaluation"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-yellow-400 focus:outline-none rounded-xl p-4 text-white text-sm"
                    />
                  </div>

                  {/* PRIVACY SELECTOR */}
                  <div className="md:col-span-2">
                    <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-2">
                      Trial Type / Privacy Access *
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        onClick={() => setFormData({ ...formData, privacy: "public" })}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                          formData.privacy === "public"
                            ? "bg-yellow-400/10 border-yellow-400 text-yellow-400"
                            : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 text-yellow-400" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs uppercase text-white">PUBLIC TRIAL</h4>
                          <p className="text-[10px] text-zinc-400 mt-0.5">Propagates to all available players on trials board</p>
                        </div>
                      </div>

                      <div
                        onClick={() => setFormData({ ...formData, privacy: "private" })}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                          formData.privacy === "private"
                            ? "bg-amber-500/10 border-amber-500 text-amber-400"
                            : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                          <Lock className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs uppercase text-white">PRIVATE INVITATION</h4>
                          <p className="text-[10px] text-zinc-400 mt-0.5">Restricted to handpicked invited players only</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AGE GROUPS TARGET */}
                  <div className="md:col-span-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold">
                        Age Groups Target
                      </label>
                      <button
                        type="button"
                        onClick={toggleAllAgeGroups}
                        className="text-[10px] font-black uppercase tracking-widest text-yellow-400 hover:underline bg-yellow-400/10 px-2.5 py-1 rounded-lg border border-yellow-400/30"
                      >
                        {formData.ageCategory.length === AGE_OPTIONS.length ? "Clear All" : "Select All"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                      {AGE_OPTIONS.map(group => {
                        const isSelected = formData.ageCategory.includes(group);
                        return (
                          <button
                            key={group}
                            type="button"
                            onClick={() => toggleAgeGroup(group)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border transition-all ${
                              isSelected
                                ? "bg-yellow-400 text-black border-yellow-400"
                                : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white"
                            }`}
                          >
                            {group} {isSelected ? "✓" : "+"}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* POSITIONS TARGET */}
                  <div className="md:col-span-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold">
                        Positions Target
                      </label>
                      <button
                        type="button"
                        onClick={toggleAllPositions}
                        className="text-[10px] font-black uppercase tracking-widest text-amber-400 hover:underline bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/30"
                      >
                        {formData.positionsTarget.length === POSITION_OPTIONS.length ? "Clear All" : "Select All"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                      {POSITION_OPTIONS.map(pos => {
                        const isSelected = formData.positionsTarget.includes(pos);
                        return (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => togglePosition(pos)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border transition-all ${
                              isSelected
                                ? "bg-amber-500 text-black border-amber-500"
                                : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white"
                            }`}
                          >
                            {pos} {isSelected ? "✓" : "+"}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-1">Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-yellow-400 focus:outline-none rounded-xl p-4 text-white text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-1">Time *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 09:00 AM"
                      value={formData.time}
                      onChange={e => setFormData({ ...formData, time: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-yellow-400 focus:outline-none rounded-xl p-4 text-white text-sm"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-1">Location / Venue *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ambedkar Stadium, Gate 3, Delhi"
                      value={formData.location}
                      onChange={e => setFormData({ ...formData, location: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-yellow-400 focus:outline-none rounded-xl p-4 text-white text-sm"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-1">Trial Description & Requirements</label>
                    <textarea
                      rows="3"
                      placeholder="e.g. Please bring full kit, boots, and ID proof. Match play evaluations start at 09:30 AM sharp."
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-yellow-400 focus:outline-none rounded-xl p-4 text-white text-sm"
                    />
                  </div>

                  {/* PRIVATE TRIAL PLAYER INVITATIONS */}
                  {formData.privacy === "private" && (
                    <div className="md:col-span-2 space-y-3 border-t border-zinc-850 pt-4">
                      <label className="block text-xs uppercase tracking-wider text-amber-400 font-bold">
                        Select Players to Invite ({formData.invitedPlayers.length} Selected)
                      </label>
                      <div className="relative">
                        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
                        <input
                          type="text"
                          placeholder="Search players by name or position..."
                          value={playerSearchQuery}
                          onChange={e => setPlayerSearchQuery(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 focus:outline-none rounded-xl pl-9 pr-4 py-2.5 text-xs text-white"
                        />
                      </div>

                      <div data-lenis-prevent className="max-h-48 overflow-y-auto space-y-2 p-2 bg-zinc-900 rounded-xl border border-zinc-800">
                        {filteredPlayers.length === 0 ? (
                          <p className="text-center py-4 text-xs text-zinc-500">No matching players found.</p>
                        ) : (
                          filteredPlayers.map(p => {
                            const isInvited = formData.invitedPlayers.includes(p.userId);
                            return (
                              <div
                                key={p.userId}
                                onClick={() => toggleInvitedPlayer(p.userId)}
                                className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                                  isInvited
                                    ? "bg-amber-500/10 border-amber-500 text-white"
                                    : "bg-zinc-950 border-zinc-800/80 text-zinc-400 hover:text-white"
                                }`}
                              >
                                <div className="flex items-center gap-3 truncate">
                                  <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700 shrink-0">
                                    <img src={p.profilePhoto || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150"} alt="p" className="w-full h-full object-cover" />
                                  </div>
                                  <div className="truncate">
                                    <h5 className="font-bold text-xs truncate text-white">{p.name}</h5>
                                    <span className="text-[9px] uppercase tracking-wider text-zinc-500 block">
                                      {p.preferredPosition} • {p.ageCategory} {p.location && `• ${p.location}`}
                                    </span>
                                  </div>
                                </div>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                                  isInvited ? "bg-amber-500 text-black border-amber-500" : "bg-zinc-900 text-zinc-500 border-zinc-800"
                                }`}>
                                  {isInvited ? "Invited ✓" : "Invite +"}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-zinc-850 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-3 rounded-xl border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black uppercase tracking-wider px-8 py-3 rounded-xl text-xs hover:scale-105 transition-all shadow-lg"
                  >
                    {submitting ? "Scheduling..." : "Broadcast & Schedule Trial"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* INSPECT PLAYER PROFILE MODAL */}
        {inspectingPlayer && (
          <PlayerInspectModal
            player={inspectingPlayer}
            onClose={() => setInspectingPlayer(null)}
            onStartChat={inspectingPlayer.user?._id || inspectingPlayer.user ? () => {
              const uId = inspectingPlayer.user?._id || inspectingPlayer.user;
              api.post("/social/chats/start", { targetUserId: uId })
                .then(chat => router.push(`/scout/messages?chatId=${chat._id}`))
                .catch(err => console.error(err));
            } : null}
          />
        )}

        {/* LIST TRIALS */}
        {loading ? (
          <div className="h-60 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Loading scheduled trials...</span>
          </div>
        ) : trials.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center bg-[#121214] border border-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[32px]">
            <div className="w-14 h-14 bg-white/[0.02] border border-white/[0.05] rounded-full flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-white/20" />
            </div>
            <h4 className="text-sm font-bold text-white/70 mb-1">No Scouting Trials</h4>
            <p className="text-xs font-medium text-white/40 max-w-sm mb-6">No scouting trials scheduled yet.</p>
            <SlidingButton
              onClick={() => setShowModal(true)}
              className="h-12 px-6 font-black uppercase tracking-widest text-[11px]"
            >
              Schedule Your First Trial
            </SlidingButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {trials.map(t => (
              <div key={t._id} className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded border inline-flex items-center gap-1 ${
                        t.privacy === "public"
                          ? "bg-yellow-400/10 text-yellow-400 border-yellow-400/30"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      }`}>
                        {t.privacy === "public" ? <Users className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {t.privacy === "public" ? "PUBLIC TRIAL" : "PRIVATE INVITATION"}
                      </span>
                      <h3 className="text-lg font-bold text-white uppercase mt-2">{t.title}</h3>
                    </div>
                    <button
                      onClick={() => handleDeleteTrial(t._id)}
                      title="Delete Trial Card"
                      className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition-all shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {t.description && (
                    <p className="text-xs text-zinc-400 leading-relaxed">{t.description}</p>
                  )}

                  {/* TARGET TAGS */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {(t.ageCategory || []).map(g => (
                      <span key={g} className="text-[9px] font-bold bg-zinc-950 text-zinc-300 px-2 py-0.5 rounded border border-zinc-800">
                        {g}
                      </span>
                    ))}
                    {(t.positionsTarget || []).map(p => (
                      <span key={p} className="text-[9px] font-bold bg-yellow-400/10 text-yellow-400 px-2 py-0.5 rounded border border-yellow-400/20">
                        {p}
                      </span>
                    ))}
                  </div>

                  <div className="space-y-2 border-t border-zinc-850 pt-4 text-xs text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-zinc-500 shrink-0" />
                      <span>Date: {new Date(t.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
                      <span>Time: {t.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-zinc-500 shrink-0" />
                      <span className="truncate">Venue: {t.location}</span>
                    </div>
                  </div>

                  {/* APPLICANTS LIST */}
                  <div className="border-t border-zinc-850 pt-4 space-y-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex justify-between">
                      <span>Registered Players ({t.applicants?.length || 0})</span>
                    </h4>

                    {(t.applicants || []).length === 0 ? (
                      <p className="text-xs text-zinc-600 italic">No registrations yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {t.applicants.map(app => {
                          const rawPId = app.player?._id || app.player;
                          const isAccepted = app.status === "accepted";
                          const isRejected = app.status === "rejected";

                          return (
                            <div key={app._id || String(rawPId)} className="rounded-2xl bg-zinc-950 border border-zinc-850 overflow-hidden transition-all">
                              <div className="p-3.5 flex justify-between items-center text-xs">
                                <div 
                                  onClick={() => inspectPlayerProfile(rawPId)}
                                  className="flex items-center gap-3 cursor-pointer group truncate"
                                >
                                  <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0 group-hover:border-yellow-400 transition-all">
                                    <img src={app.profilePhoto || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150"} alt="Avatar" className="w-full h-full object-cover" />
                                  </div>
                                  <div className="truncate">
                                    <span className="font-bold text-white block truncate group-hover:text-yellow-400 transition-colors underline-offset-2 group-hover:underline flex items-center gap-1">
                                      {app.playerName} 🔍
                                    </span>
                                    <span className="text-[9px] text-zinc-500 uppercase">{app.preferredPosition} • {app.ageCategory}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {isAccepted ? (
                                    <div className="flex items-center gap-2">
                                      <span className="px-2.5 py-1 rounded-lg bg-green-500/20 text-green-400 border border-green-500/40 text-[9px] font-black uppercase tracking-wider">
                                        ACCEPTED ✓
                                      </span>
                                      {app.isRated ? (
                                        <button
                                          type="button"
                                          disabled
                                          aria-disabled="true"
                                          className="px-3 py-1 rounded-lg bg-zinc-900 border border-green-500/40 text-green-400 font-black uppercase text-[10px] tracking-wider flex items-center gap-1.5 opacity-90 cursor-not-allowed select-none shadow-[inset_0_0_8px_rgba(34,197,94,0.15)]"
                                          title="Evaluation complete: Player has already been rated for this trial"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                                          <span>RATED ({app.scoutScore || 0}/99)</span>
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => openTrialRatingModal(t, app, rawPId)}
                                          className="px-3 py-1 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-black font-black uppercase text-[10px] tracking-wider transition-all flex items-center gap-1 shadow"
                                        >
                                          <Sliders className="w-3 h-3 text-black" />
                                          <span>Rate Scores</span>
                                        </button>
                                      )}
                                    </div>
                                  ) : isRejected ? (
                                    <span className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-black uppercase tracking-wider">
                                      REJECTED ✗
                                    </span>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleApplicantStatus(t._id, rawPId, "accepted")}
                                        className="px-3 py-1.5 rounded-lg bg-green-500 text-black border border-green-500 text-[10px] font-black uppercase tracking-wider hover:bg-green-400 transition-all shadow-md"
                                      >
                                        Accept
                                      </button>
                                      <button
                                        onClick={() => handleApplicantStatus(t._id, rawPId, "rejected")}
                                        className="px-3 py-1.5 rounded-lg bg-zinc-900 text-red-400 border border-red-500/40 text-[10px] font-black uppercase tracking-wider hover:bg-red-500/10 hover:border-red-500 transition-all"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* OFFICIAL TRIAL EVALUATION MODAL */}
        {ratingModal && (
          <div data-lenis-prevent className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <div data-lenis-prevent className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 max-w-xl w-full space-y-6 my-auto shadow-2xl relative text-xs">
              <button
                onClick={() => setRatingModal(null)}
                className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900"
              >
                <X className="w-5 h-5" />
              </button>

              {/* MODAL HEADER */}
              <div className="space-y-1 border-b border-zinc-850 pb-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-xl font-black uppercase text-white tracking-wider">
                    Official Trial Evaluation Form
                  </h3>
                </div>
                <p className="text-zinc-400 text-xs">
                  Evaluate player trial performance on a 0–99 scale with position-weighted formula calculations.
                </p>
              </div>

              {/* AUTOMATICALLY FETCHED READONLY METADATA */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-850 text-[10px]">
                <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-900">
                  <span className="block text-[8px] text-zinc-500 font-bold uppercase">Trial Name</span>
                  <span className="font-bold text-white truncate block">{ratingModal.trial.title}</span>
                </div>
                <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-900">
                  <span className="block text-[8px] text-zinc-500 font-bold uppercase">Scout Name</span>
                  <span className="font-bold text-yellow-400 truncate block">
                    {currentProfile?.name || currentUser?.email?.split('@')[0] || "Scout Evaluator"}
                  </span>
                </div>
                <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-900">
                  <span className="block text-[8px] text-zinc-500 font-bold uppercase">Player Name</span>
                  <span className="font-bold text-white truncate block">{ratingModal.applicant.playerName}</span>
                </div>
                <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-900">
                  <span className="block text-[8px] text-zinc-500 font-bold uppercase">Position & Age</span>
                  <span className="font-bold text-white truncate block">
                    {ratingModal.applicant.preferredPosition || "ST"} • {ratingModal.applicant.ageCategory || "Senior"}
                  </span>
                </div>
              </div>

              {scoreSuccessMsg && (
                <div className="p-3.5 rounded-xl bg-green-950/60 border border-green-500/50 text-green-300 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <span>{scoreSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleScoutRateSubmit} className="space-y-5">
                {/* ATTRIBUTE SLIDERS */}
                <div>
                  <span className="block text-[9px] font-black uppercase text-zinc-400 tracking-wider mb-2">
                    Attribute Scores (Out of 99):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { key: "speed", label: "Pace / Speed" },
                      { key: "passing", label: "Passing" },
                      { key: "dribbling", label: "Dribbling" },
                      { key: "shooting", label: "Shooting" },
                      { key: "defending", label: "Defending" },
                      { key: "physical", label: "Physical" },
                    ].map(({ key, label }) => (
                      <div key={key} className="bg-zinc-900 p-3 rounded-xl border border-zinc-850 space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold text-zinc-400">
                          <span>{label}</span>
                          <span className="text-yellow-400 font-mono font-bold text-xs">{scoringData[key]}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="99"
                          value={scoringData[key]}
                          onChange={(e) => setScoringData(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                          className="w-full accent-yellow-400 bg-zinc-800 h-1.5 rounded cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* OPTIONAL RECOMMENDATION & VIDEO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-850 pt-4">
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-zinc-400 font-bold mb-1">
                      Recommendation (Optional)
                    </label>
                    <select
                      value={scoringData.recommendation || "SHORTLIST_FOR_TRIAL"}
                      onChange={(e) => setScoringData(prev => ({ ...prev, recommendation: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white font-bold"
                    >
                      <option value="SIGN_IMMEDIATELY">🌟 Sign Immediately</option>
                      <option value="SHORTLIST_FOR_TRIAL">📋 Shortlist for Trial</option>
                      <option value="MONITOR_DEVELOPMENT">👁️ Monitor Development</option>
                      <option value="PASS">Pass</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-zinc-400 font-bold mb-1">
                      Scouting Video Link (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://cloudinary.com/video..."
                      value={scoringData.scoutingVideo || ""}
                      onChange={(e) => setScoringData(prev => ({ ...prev, scoutingVideo: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white"
                    />
                  </div>
                </div>

                {/* SCORE CALCULATED PREVIEW & ACTION BUTTONS */}
                <div className="flex justify-between items-center bg-zinc-900 p-4 rounded-2xl border border-yellow-400/30">
                  <div>
                    <span className="block text-[9px] font-bold uppercase text-zinc-500">Calculated Scout Score</span>
                    <span className="text-xl font-black text-yellow-400">
                      {calcLiveScore(scoringData, ratingModal.applicant.preferredPosition || "ST")} / 99
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setRatingModal(null)}
                      className="px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white font-bold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingScore}
                      className="bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black uppercase tracking-wider px-6 py-2.5 rounded-xl text-xs transition-all shadow-lg shrink-0 disabled:opacity-50"
                    >
                      {submittingScore ? "Submitting..." : "Submit Trial Evaluation"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
