"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import { Save, AlertCircle, CheckCircle2 } from "lucide-react";

export default function ScoutSettings() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    bio: "",
    profilePhoto: "",
    organization: "",
    clubRepresenting: "",
    designation: "",
    license: "",
    areasOfInterest: "",
    ageGroupsCovered: "",
    positionsInterested: ""
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("Avatar image size must be less than 10MB.");
      return;
    }

    setUploadingAvatar(true);
    setError(null);

    try {
      const uploadData = new FormData();
      uploadData.append("image", file);
      const res = await api.upload("/upload/image", uploadData);
      if (res && (res.secure_url || res.url)) {
        const cloudinaryUrl = res.secure_url || res.url;
        setFormData((prev) => ({ ...prev, profilePhoto: cloudinaryUrl }));
      } else {
        throw new Error("Failed to retrieve Cloudinary URL");
      }
    } catch (err) {
      console.error("Avatar Cloudinary upload error:", err);
      setError("Cloudinary Avatar Upload Failed: " + (err.message || "Ensure Cloudinary is configured in .env"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    api.get("/dashboard/profile")
      .then(res => {
        setFormData({
          name: res.name || "",
          phone: res.phone || "",
          bio: res.bio || "",
          profilePhoto: res.profilePhoto || "",
          organization: res.organization || "",
          clubRepresenting: res.clubRepresenting || "",
          designation: res.designation || "",
          license: res.license || "",
          areasOfInterest: Array.isArray(res.areasOfInterest) ? res.areasOfInterest.join(", ") : "",
          ageGroupsCovered: Array.isArray(res.ageGroupsCovered) ? res.ageGroupsCovered.join(", ") : "",
          positionsInterested: Array.isArray(res.positionsInterested) ? res.positionsInterested.join(", ") : ""
        });
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || "Failed to load scout settings.");
        setLoading(false);
      });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError(null);

    try {
      const payload = {
        ...formData,
        areasOfInterest: formData.areasOfInterest.split(",").map(s => s.trim()).filter(Boolean),
        ageGroupsCovered: formData.ageGroupsCovered.split(",").map(s => s.trim()).filter(Boolean),
        positionsInterested: formData.positionsInterested.split(",").map(s => s.trim()).filter(Boolean)
      };

      const res = await api.put("/dashboard/profile", payload);
      setSuccess(true);
      if (res && (res.profile || res)) {
        const updated = res.profile || res;
        localStorage.setItem("profile", JSON.stringify(updated));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("profile-updated"));
        }
      }
    } catch (err) {
      setError(err.message || "Failed to update scout settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="h-96 flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-500 text-sm tracking-widest font-bold uppercase font-sans">Accessing Settings...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h2 className="text-3xl font-black uppercase text-white tracking-wider">Scout Profile Settings</h2>
          <p className="text-zinc-400 text-xs mt-1 uppercase tracking-widest font-bold font-sans">
            Maintain your club details and targets
          </p>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 backdrop-blur-xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/50 flex items-center gap-3 text-red-200 text-sm">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-xl bg-green-950/40 border border-green-500/50 flex items-center gap-3 text-green-200 text-sm">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              <span>Settings updated successfully!</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <h3 className="text-sm font-bold text-yellow-400 uppercase tracking-widest border-b border-zinc-805 pb-2 mb-4">
                Personal Credentials
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-500 font-bold mb-1">Full Name</label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-yellow-400 focus:outline-none rounded-xl p-4 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-500 font-bold mb-1">Contact Phone</label>
                  <input type="text" name="phone" value={formData.phone} onChange={handleChange}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-yellow-400 focus:outline-none rounded-xl p-4 text-white text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs uppercase tracking-wider text-zinc-400 font-bold mb-2">
                    Profile Avatar (Stored Exclusively in Cloudinary)
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-zinc-950/60 p-4 border border-zinc-800 rounded-2xl">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-yellow-400/40 shrink-0 bg-zinc-900">
                      <img
                        src={formData.profilePhoto || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150"}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <div className="flex items-center gap-3">
                        <label className={`cursor-pointer inline-flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-yellow-400 text-xs uppercase tracking-wider font-bold px-4 py-2.5 rounded-xl border border-zinc-700 transition-all ${uploadingAvatar ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          {uploadingAvatar ? "Uploading to Cloudinary..." : "Upload Avatar Image"}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            disabled={uploadingAvatar}
                            className="hidden"
                          />
                        </label>
                        {formData.profilePhoto && formData.profilePhoto.includes("cloudinary") && (
                          <span className="text-[10px] text-green-400 uppercase tracking-widest font-mono font-bold bg-green-950/40 border border-green-800 px-2 py-1 rounded-md">
                            ✓ Cloudinary Secured
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        name="profilePhoto"
                        value={formData.profilePhoto}
                        onChange={handleChange}
                        placeholder="https://res.cloudinary.com/..."
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-yellow-400 focus:outline-none rounded-xl p-3 text-white text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-yellow-400 uppercase tracking-widest border-b border-zinc-805 pb-2 mb-4">
                Scouting Scope
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-500 font-bold mb-1">Organization / Agency</label>
                  <input type="text" name="organization" value={formData.organization} onChange={handleChange}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-yellow-400 focus:outline-none rounded-xl p-4 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-500 font-bold mb-1">Club Representing</label>
                  <input type="text" name="clubRepresenting" value={formData.clubRepresenting} onChange={handleChange}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-yellow-400 focus:outline-none rounded-xl p-4 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-500 font-bold mb-1">Designation</label>
                  <input type="text" name="designation" value={formData.designation} onChange={handleChange}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-yellow-400 focus:outline-none rounded-xl p-4 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-zinc-500 font-bold mb-1">Scouting License</label>
                  <input type="text" name="license" value={formData.license} onChange={handleChange}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-yellow-400 focus:outline-none rounded-xl p-4 text-white text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs uppercase tracking-wider text-zinc-500 font-bold mb-1">Areas of Interest (comma-separated)</label>
                  <input type="text" name="areasOfInterest" value={formData.areasOfInterest} onChange={handleChange}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-yellow-400 focus:outline-none rounded-xl p-4 text-white text-sm" />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 font-bold">
                      Age Groups Covered (Select Multiple)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const allGroups = ["U-13", "U-15", "U-17", "U-19", "U-21", "U-23", "Senior"];
                        const currentList = Array.isArray(formData.ageGroupsCovered)
                          ? formData.ageGroupsCovered
                          : (formData.ageGroupsCovered ? formData.ageGroupsCovered.split(",").map(s => s.trim()).filter(Boolean) : []);
                        const isAllSelected = allGroups.every(g => currentList.includes(g));
                        setFormData(prev => ({ ...prev, ageGroupsCovered: isAllSelected ? "" : allGroups.join(", ") }));
                      }}
                      className="text-[10px] font-black uppercase tracking-widest text-yellow-400 hover:underline bg-yellow-400/10 px-2.5 py-1 rounded-lg border border-yellow-400/30 transition-all"
                    >
                      {(() => {
                        const allGroups = ["U-13", "U-15", "U-17", "U-19", "U-21", "U-23", "Senior"];
                        const currentList = Array.isArray(formData.ageGroupsCovered)
                          ? formData.ageGroupsCovered
                          : (formData.ageGroupsCovered ? formData.ageGroupsCovered.split(",").map(s => s.trim()).filter(Boolean) : []);
                        return allGroups.every(g => currentList.includes(g)) ? "Clear All" : "Select All";
                      })()}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
                    {["U-13", "U-15", "U-17", "U-19", "U-21", "U-23", "Senior"].map((group) => {
                      const currentList = Array.isArray(formData.ageGroupsCovered)
                        ? formData.ageGroupsCovered
                        : (formData.ageGroupsCovered ? formData.ageGroupsCovered.split(",").map(s => s.trim()).filter(Boolean) : []);
                      const isSelected = currentList.includes(group);

                      return (
                        <button
                          key={group}
                          type="button"
                          onClick={() => {
                            const updated = isSelected
                              ? currentList.filter(g => g !== group)
                              : [...currentList, group];
                            setFormData(prev => ({ ...prev, ageGroupsCovered: updated.join(", ") }));
                          }}
                          className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${
                            isSelected
                              ? "bg-yellow-400 text-black border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.3)]"
                              : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white"
                          }`}
                        >
                          {group} {isSelected ? "✓" : "+"}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs uppercase tracking-wider text-zinc-500 font-bold">
                      Positions Target (Select Multiple)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const allPos = ["ST", "LW", "RW", "CAM", "CM", "CDM", "LB", "RB", "CB", "GK", "WB"];
                        const currentList = Array.isArray(formData.positionsInterested)
                          ? formData.positionsInterested
                          : (formData.positionsInterested ? formData.positionsInterested.split(",").map(s => s.trim()).filter(Boolean) : []);
                        const isAllSelected = allPos.every(p => currentList.includes(p));
                        setFormData(prev => ({ ...prev, positionsInterested: isAllSelected ? "" : allPos.join(", ") }));
                      }}
                      className="text-[10px] font-black uppercase tracking-widest text-amber-400 hover:underline bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/30 transition-all"
                    >
                      {(() => {
                        const allPos = ["ST", "LW", "RW", "CAM", "CM", "CDM", "LB", "RB", "CB", "GK", "WB"];
                        const currentList = Array.isArray(formData.positionsInterested)
                          ? formData.positionsInterested
                          : (formData.positionsInterested ? formData.positionsInterested.split(",").map(s => s.trim()).filter(Boolean) : []);
                        return allPos.every(p => currentList.includes(p)) ? "Clear All" : "Select All";
                      })()}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
                    {["ST", "LW", "RW", "CAM", "CM", "CDM", "LB", "RB", "CB", "GK", "WB"].map((pos) => {
                      const currentList = Array.isArray(formData.positionsInterested)
                        ? formData.positionsInterested
                        : (formData.positionsInterested ? formData.positionsInterested.split(",").map(s => s.trim()).filter(Boolean) : []);
                      const isSelected = currentList.includes(pos);

                      return (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => {
                            const updated = isSelected
                              ? currentList.filter(p => p !== pos)
                              : [...currentList, pos];
                            setFormData(prev => ({ ...prev, positionsInterested: updated.join(", ") }));
                          }}
                          className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${
                            isSelected
                              ? "bg-amber-500 text-black border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                              : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white"
                          }`}
                        >
                          {pos} {isSelected ? "✓" : "+"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-500 font-bold mb-1">Biography</label>
              <textarea name="bio" rows="4" value={formData.bio} onChange={handleChange}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-yellow-400 focus:outline-none rounded-xl p-4 text-white text-sm" />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black uppercase tracking-wider py-4 rounded-xl shadow-lg hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4 text-black" />
              <span>{saving ? "Saving Changes..." : "Save Configuration"}</span>
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
