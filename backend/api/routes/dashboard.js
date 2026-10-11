const express = require('express');
const router = express.Router();
const { User, Profile, Video, Analysis, Trial, Tournament, ScoutRating, ScoutReport, Notification } = require('../models');

// AUTHENTICATION MIDDLEWARE FOR SECURE ROUTES
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required.' });

  const JWT_SECRET = process.env.JWT_SECRET || 'mission2k38_jwt_secret_key_998877_super_secure';
  require('jsonwebtoken').verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    req.userId = user?.userId || user?.id;
    next();
  });
};

// POSITION WEIGHTS MATRIX TABLE ACCORDING TO SPECIFICATION
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

function getPositionWeights(position = 'ST') {
  const pos = (position || 'ST').toUpperCase();
  return POSITION_WEIGHTS[pos] || POSITION_WEIGHTS['ST'];
}

function calculateScoutScore(attrs, position = 'ST') {
  const w = getPositionWeights(position);
  const score = (
    (Number(attrs.passing) || 0) * w.passing +
    (Number(attrs.shooting) || 0) * w.shooting +
    (Number(attrs.dribbling) || 0) * w.dribbling +
    (Number(attrs.speed) || 0) * w.speed +
    (Number(attrs.defending) || 0) * w.defending +
    (Number(attrs.physical) || 0) * w.physical
  );
  return Math.round(score);
}

async function recalculatePlayerRatings(playerUserId) {
  const ratings = await ScoutRating.find({ player: playerUserId });
  const profile = await Profile.findOne({ user: playerUserId });

  if (!profile) return null;

  if (ratings.length === 0) {
    profile.skills = {
      speed: 0,
      passing: 0,
      dribbling: 0,
      finishing: 0,
      shooting: 0,
      defending: 0,
      physical: 0,
      vision: 0,
      stamina: 0,
      aiScore: 0,
      scoutScore: 0,
      potential: 0,
      scoutRatingsCount: 0
    };
  } else {
    const N = ratings.length;
    let sumSpeed = 0, sumPassing = 0, sumDribbling = 0, sumShooting = 0, sumDefending = 0, sumPhysical = 0, sumScoutScore = 0;

    for (const r of ratings) {
      sumSpeed += (r.speed || 0);
      sumPassing += (r.passing || 0);
      sumDribbling += (r.dribbling || 0);
      sumShooting += (r.shooting || 0);
      sumDefending += (r.defending || 0);
      sumPhysical += (r.physical || 0);
      sumScoutScore += (r.scoutScore || 0);
    }

    const avgSpeed = Math.round(sumSpeed / N);
    const avgPassing = Math.round(sumPassing / N);
    const avgDribbling = Math.round(sumDribbling / N);
    const avgShooting = Math.round(sumShooting / N);
    const avgDefending = Math.round(sumDefending / N);
    const avgPhysical = Math.round(sumPhysical / N);
    const avgScoutScore = Math.round(sumScoutScore / N);

    profile.skills = {
      speed: avgSpeed,
      passing: avgPassing,
      dribbling: avgDribbling,
      finishing: avgShooting,
      shooting: avgShooting,
      defending: avgDefending,
      physical: avgPhysical,
      vision: avgPassing,
      stamina: avgPhysical,
      aiScore: avgScoutScore,
      scoutScore: avgScoutScore,
      potential: Math.min(99, avgScoutScore + 7),
      scoutRatingsCount: N
    };
  }

  await profile.save();
  return profile;
}

async function formatProfileSkills(profile) {
  if (!profile) return profile;
  const pObj = profile.toObject ? profile.toObject() : profile;
  if (pObj.user && (pObj.user.role === 'player' || !pObj.user.role)) {
    const pUserId = pObj.user._id || pObj.user;
    const ratingsCount = await ScoutRating.countDocuments({ player: pUserId });
    const reportsCount = await ScoutReport.countDocuments({ player: pUserId });
    const totalReports = Math.max(ratingsCount, reportsCount);
    pObj.skills = pObj.skills || {};
    pObj.skills.scoutRatingsCount = ratingsCount;
    pObj.skills.scoutReportsCount = totalReports;
    pObj.skills.reportsCount = totalReports;

    if (ratingsCount === 0) {
      pObj.skills.scoutScore = 0;
      pObj.skills.overallScore = 0;
      pObj.skills.speed = 0;
      pObj.skills.passing = 0;
      pObj.skills.dribbling = 0;
      pObj.skills.finishing = 0;
      pObj.skills.shooting = 0;
      pObj.skills.defending = 0;
      pObj.skills.physical = 0;
      pObj.skills.vision = 0;
      pObj.skills.stamina = 0;
      pObj.skills.potential = 0;
    } else {
      const pos = pObj.preferredPosition || 'ST';
      let score = Number(pObj.skills.scoutScore) || Number(pObj.skills.aiScore) || calculateScoutScore(pObj.skills, pos);
      pObj.skills.scoutScore = score;
      pObj.skills.overallScore = score;
    }
  }
  return pObj;
}

// 1. GET CURRENT USER PROFILE
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    let profile = await Profile.findOne({ user: req.user.userId }).populate('user', 'email role');
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });
    profile = await formatProfileSkills(profile);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET TARGET USER PROFILE BY ID
router.get('/profile/:userId', async (req, res) => {
  try {
    let profile = await Profile.findOne({ user: req.params.userId }).populate('user', 'email role');
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });

    // Fetch player videos if it's a player profile
    let videos = [];
    if (profile.user.role === 'player') {
      videos = await Video.find({ user: profile.user._id });
    }

    profile = await formatProfileSkills(profile);
    res.json({ profile, videos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. UPDATE CURRENT USER PROFILE
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user.userId });
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });

    const updateData = { ...req.body };

    // Protect role/user linking
    delete updateData.user;
    delete updateData._id;

    // Handle nested emergencyContact if passed as flat fields
    if (updateData.emergencyContactName !== undefined || updateData.emergencyContactPhone !== undefined || updateData.emergencyContactRelation !== undefined) {
      updateData.emergencyContact = {
        name: updateData.emergencyContactName ?? profile.emergencyContact?.name ?? '',
        phone: updateData.emergencyContactPhone ?? profile.emergencyContact?.phone ?? '',
        relation: updateData.emergencyContactRelation ?? profile.emergencyContact?.relation ?? ''
      };
      delete updateData.emergencyContactName;
      delete updateData.emergencyContactPhone;
      delete updateData.emergencyContactRelation;
    }

    // Handle nested socials if passed as flat fields
    if (updateData.instagram !== undefined || updateData.facebook !== undefined || updateData.youtube !== undefined) {
      updateData.socials = {
        instagram: updateData.instagram ?? profile.socials?.instagram ?? '',
        facebook: updateData.facebook ?? profile.socials?.facebook ?? '',
        youtube: updateData.youtube ?? profile.socials?.youtube ?? ''
      };
      delete updateData.instagram;
      delete updateData.facebook;
      delete updateData.youtube;
    }

    // If DOB provided, calculate age
    if (updateData.dob) {
      const birthDate = new Date(updateData.dob);
      if (!isNaN(birthDate.getTime())) {
        const difference = Date.now() - birthDate.getTime();
        updateData.age = Math.floor(difference / (1000 * 60 * 60 * 24 * 365.25));
      }
    }

    // Direct object assign
    Object.assign(profile, updateData);

    await profile.save();
    const updatedProfile = await Profile.findById(profile._id).populate('user', 'email role');
    const formattedProfile = await formatProfileSkills(updatedProfile);

    res.json({ message: 'Profile updated successfully!', profile: formattedProfile });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. GLOBAL PLAYER RANKINGS LEADERBOARD
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const currentUserId = (req.user?.userId || req.user?.id || req.userId)?.toString();

    // Fetch all profiles populated with user role
    const profiles = await Profile.find({}).populate('user', 'role email');

    // Filter player profiles safely (exclude scouts, coaches, admins)
    const playerProfiles = profiles.filter(p => {
      if (!p.user) return false;
      const role = typeof p.user === 'object' ? p.user.role : null;
      if (role === 'scout' || role === 'coach' || role === 'admin') return false;
      return true;
    });

    // Format profiles and calculate ratings
    const rankedPlayers = await Promise.all(playerProfiles.map(async p => {
      const formatted = await formatProfileSkills(p);
      const attrs = formatted.skills || {};
      const pos = formatted.preferredPosition || 'ST';
      const ratingsCount = attrs.scoutRatingsCount || 0;

      // Unscouted players (0 ratings) have overall score 0
      const overall = ratingsCount > 0 ? (Number(attrs.scoutScore) || Number(attrs.overallScore) || 0) : 0;

      return {
        _id: formatted._id,
        user: formatted.user._id || formatted.user,
        name: formatted.name || 'Anonymous Player',
        email: formatted.user?.email || '',
        preferredPosition: pos,
        ageCategory: formatted.ageCategory || 'Senior',
        city: formatted.city || 'India',
        state: formatted.state || '',
        currentClub: formatted.currentClub || 'Grassroots FC',
        profilePhoto: formatted.profilePhoto || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150',
        overallScore: overall,
        scoutRatingsCount: ratingsCount,
        skills: {
          speed: attrs.speed || 0,
          passing: attrs.passing || 0,
          dribbling: attrs.dribbling || 0,
          shooting: attrs.shooting || attrs.finishing || 0,
          defending: attrs.defending || 0,
          physical: attrs.physical || attrs.stamina || 0
        },
        verifiedBadge: !!formatted.verifiedBadge
      };
    }));

    // Sort strictly descending by overallScore (highest scouted score at top)
    rankedPlayers.sort((a, b) => b.overallScore - a.overallScore);

    // Assign 1-indexed global rank
    let myRank = null;
    let myData = null;

    rankedPlayers.forEach((player, index) => {
      player.rank = index + 1;
      if (currentUserId && player.user.toString() === currentUserId) {
        myRank = player.rank;
        myData = player;
      }
    });

    const top10 = rankedPlayers.slice(0, 10);
    const totalPlayers = rankedPlayers.length;

    res.json({
      top10,
      myRank: myRank || (totalPlayers ? totalPlayers : 1),
      myData,
      totalPlayers
    });
  } catch (err) {
    console.error('Leaderboard fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// HELPER TO SAFELY MATCH PLAYER IDS ACROSS POPULATED AND UNPOPULATED OBJECTS
const isPlayerMatch = (applicantPlayer, targetUserId) => {
  if (!applicantPlayer || !targetUserId) return false;
  const targetStr = targetUserId.toString();

  if (typeof applicantPlayer === 'string') return applicantPlayer === targetStr;
  if (applicantPlayer._id) return applicantPlayer._id.toString() === targetStr;
  if (applicantPlayer.id) return applicantPlayer.id.toString() === targetStr;
  if (typeof applicantPlayer.toString === 'function') return applicantPlayer.toString() === targetStr;
  return String(applicantPlayer) === targetStr;
};

// 5. PLAYER DASHBOARD DATA
router.get('/player/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id || req.user.userId;
    const profile = await Profile.findOne({ user: userId });
    const videos = await Video.find({ user: userId }).sort({ createdAt: -1 });
    const analyses = await Analysis.find({ user: userId }).sort({ createdAt: -1 });

    const pAge = profile?.ageCategory || 'Senior';
    const pPos = profile?.preferredPosition || 'ST';

    // Fetch public trials, private invitations, and applied trials
    const allTrials = await Trial.find({
      $or: [
        { privacy: 'public' },
        { privacy: 'private', invitedPlayers: userId },
        { 'applicants.player': userId }
      ]
    }).populate('scout', 'email').sort({ createdAt: -1 });

    const activeTrials = allTrials.filter(t => {
      const myApp = (t.applicants || []).find(a => isPlayerMatch(a.player, userId));

      // Remove rejected/declined trials completely
      if (myApp && myApp.status === 'rejected') {
        return false;
      }

      // Keep accepted or pending registered trials
      if (myApp) {
        return true;
      }

      // Keep new unresponded private invitations or matching public trials
      if (t.privacy === 'private') return true;
      const matchesAge = (!t.ageCategory || t.ageCategory.length === 0 || t.ageCategory.includes(pAge));
      const matchesPos = (!t.positionsTarget || t.positionsTarget.length === 0 || t.positionsTarget.includes(pPos));
      return matchesAge && matchesPos;
    });

    // Fetch scout profiles for clean scoutName resolution
    const scoutUserIds = Array.from(new Set(activeTrials.map(t => {
      if (!t.scout) return null;
      return t.scout._id ? t.scout._id.toString() : t.scout.toString();
    }).filter(Boolean)));

    const scoutProfiles = await Profile.find({ user: { $in: scoutUserIds } }).populate('user', 'email');
    const scoutProfileMap = {};
    scoutProfiles.forEach(sp => {
      const uId = sp.user?._id?.toString() || sp.user?.toString();
      if (uId) scoutProfileMap[uId] = sp;
    });

    // Fetch all ratings for this player (trials & direct)
    const playerRatings = await ScoutRating.find({ player: userId });
    const trialRatingMap = {};
    playerRatings.forEach(r => {
      const tId = r.trial?._id?.toString() || r.trial?.id?.toString() || r.trial?.toString();
      if (tId) {
        trialRatingMap[tId] = r;
      }
    });

    // Format trials with player's application status, completion status, score & scout name
    const formattedTrials = activeTrials.map(t => {
      const tObj = typeof t.toObject === 'function' ? t.toObject() : t;
      const trialIdStr = tObj._id?.toString() || tObj.id?.toString();
      const myApp = (tObj.applicants || []).find(a => isPlayerMatch(a.player, userId));
      tObj.isRegistered = !!myApp;

      const myRating = trialRatingMap[trialIdStr];
      const isPastDate = tObj.date ? new Date(tObj.date) < new Date() : false;
      const isTrialCompleted = tObj.status === 'completed' || !!myRating || (isPastDate && myApp?.status === 'accepted');

      tObj.isCompleted = isTrialCompleted;
      tObj.isRated = !!myRating;
      tObj.scoutScore = myRating ? myRating.scoutScore : null;
      tObj.ratingData = myRating || null;

      if (isTrialCompleted && myApp?.status === 'accepted') {
        tObj.myStatus = 'completed';
      } else {
        tObj.myStatus = myApp ? myApp.status : null;
      }

      const sId = t.scout?._id?.toString() || t.scout?.toString();
      const sProfile = scoutProfileMap[sId];

      let resolvedName = sProfile?.name;
      if (!resolvedName && t.scout?.email) {
        resolvedName = t.scout.email.split('@')[0];
      }
      if (!resolvedName && sProfile?.user?.email) {
        resolvedName = sProfile.user.email.split('@')[0];
      }

      tObj.scoutName = resolvedName || 'Scout Organizer';
      tObj.scoutOrganization = sProfile?.organization || sProfile?.clubRepresenting || '';
      return tObj;
    });

    const tournaments = await Tournament.find({ status: 'upcoming' }).limit(5);
    const formattedProfile = await formatProfileSkills(profile);

    res.json({
      profile: formattedProfile,
      videos,
      analyses,
      trials: formattedTrials,
      tournaments
    });
  } catch (err) {
    console.error('Error fetching player dashboard:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. SCOUT ADVANCED SEARCH
router.post('/scout/search', authenticateToken, async (req, res) => {
  try {
    const {
      state,
      position,
      minHeight,
      maxHeight,
      minAge,
      maxAge,
      minSpeed,
      minDribbling,
      minPassing,
      minAiScore,
      verifiedOnly,
      queryText
    } = req.body;

    // Filter build
    const filter = {};

    // We only search for player profiles
    const playerUsers = await User.find({ role: 'player' }).select('_id');
    const playerUserIds = playerUsers.map(u => u._id);
    filter.user = { $in: playerUserIds };

    if (state) filter.state = new RegExp(state, 'i');
    if (position) {
      filter.$or = [
        { preferredPosition: new RegExp(position, 'i') },
        { secondaryPosition: new RegExp(position, 'i') }
      ];
    }

    if (minHeight || maxHeight) {
      filter.height = {};
      if (minHeight) filter.height.$gte = Number(minHeight);
      if (maxHeight) filter.height.$lte = Number(maxHeight);
    }

    if (minAge || maxAge) {
      filter.age = {};
      if (minAge) filter.age.$gte = Number(minAge);
      if (maxAge) filter.age.$lte = Number(maxAge);
    }

    if (minSpeed) filter['skills.speed'] = { $gte: Number(minSpeed) };
    if (minDribbling) filter['skills.dribbling'] = { $gte: Number(minDribbling) };
    if (minPassing) filter['skills.passing'] = { $gte: Number(minPassing) };
    if (minAiScore) filter['skills.aiScore'] = { $gte: Number(minAiScore) };
    if (verifiedOnly) filter.verifiedBadge = true;

    if (queryText) {
      filter.name = new RegExp(queryText, 'i');
    }

    let players = await Profile.find(filter).populate('user', 'email role');
    players = await Promise.all(players.map(p => formatProfileSkills(p)));
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6.6 GET SCOUT REPORTS
router.get('/scout/reports', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id || req.userId || req.user._id;
    const user = await User.findById(userId);

    let reportFilter = {};
    let ratingFilter = {};

    if (user && user.role === 'player') {
      const pProfile = await Profile.findOne({ user: userId });
      const pIds = [userId];
      if (pProfile) pIds.push(pProfile._id);

      reportFilter = { player: { $in: pIds } };
      ratingFilter = { player: { $in: pIds } };
    } else {
      reportFilter = { scout: userId };
      ratingFilter = { scout: userId };
    }

    const [reports, ratings, trials] = await Promise.all([
      ScoutReport.find(reportFilter).sort({ createdAt: -1 }).populate('player', 'email').populate('scout', 'email'),
      ScoutRating.find(ratingFilter).sort({ createdAt: -1 }).populate('player', 'email').populate('scout', 'email').populate('trial'),
      Trial.find({})
    ]);

    // Build Trial Map for trial titles & locations
    const trialMap = {};
    trials.forEach(t => { trialMap[t._id.toString()] = t; });

    // Map existing ScoutReports and ScoutRatings to prevent duplicate card rendering
    const rawReports = reports.map(r => typeof r.toObject === 'function' ? r.toObject() : r);
    const seenEvaluationKeys = new Set();
    const combinedReports = [];

    // 1. Add primary ScoutReports
    for (const rep of rawReports) {
      const sId = (rep.scout?._id || rep.scout || '').toString();
      const pId = (rep.player?._id || rep.player || '').toString();
      const event = (rep.matchEvent || '').trim().toLowerCase();
      const score = rep.overallScore || 0;

      const key = `${sId}_${pId}_${event}`;
      const scoreKey = `${sId}_${pId}_${score}`;

      if (!seenEvaluationKeys.has(key) && !seenEvaluationKeys.has(scoreKey)) {
        seenEvaluationKeys.add(key);
        seenEvaluationKeys.add(scoreKey);
        combinedReports.push(rep);
      }
    }

    // 2. Add ScoutRatings only if no matching ScoutReport exists for this trial/rating
    for (const r of ratings) {
      const trialDoc = r.trial ? (trialMap[r.trial._id?.toString() || r.trial?.toString()]) : null;
      const matchTitle = trialDoc?.title || 'Scouting Trial Match';
      const sId = (r.scout?._id || r.scout || '').toString();
      const pId = (r.player?._id || r.player || '').toString();
      const score = r.scoutScore || 0;
      const event = matchTitle.trim().toLowerCase();

      const key = `${sId}_${pId}_${event}`;
      const scoreKey = `${sId}_${pId}_${score}`;

      if (!seenEvaluationKeys.has(key) && !seenEvaluationKeys.has(scoreKey)) {
        seenEvaluationKeys.add(key);
        seenEvaluationKeys.add(scoreKey);
        combinedReports.push({
          _id: r._id,
          scout: r.scout,
          player: r.player,
          playerName: r.player?.email?.split('@')[0] || 'Player',
          matchEvent: matchTitle,
          date: r.updatedAt || r.createdAt,
          location: trialDoc?.location || 'Scouting Ground',
          tacticalRole: 'ST',
          overallScore: score,
          recommendation: r.recommendation || 'SHORTLIST_FOR_TRIAL',
          strengths: `Pace/Speed: ${r.speed || 0}, Passing: ${r.passing || 0}, Dribbling: ${r.dribbling || 0}, Shooting: ${r.shooting || 0}, Defending: ${r.defending || 0}, Physical: ${r.physical || 0}`,
          verdict: `Official Trial Performance Rating of ${score}/99 filed by Scout.`,
          scoutingVideo: r.scoutingVideo || '',
          createdAt: r.createdAt
        });
      }
    }

    // Enrich scout details from Profile (Name, Organization, Avatar)
    const scoutUserIds = Array.from(new Set(combinedReports.map(r => r.scout?._id?.toString() || r.scout?.toString()).filter(Boolean)));
    const scoutProfiles = await Profile.find({ user: { $in: scoutUserIds } });
    const profileMap = {};
    scoutProfiles.forEach(p => { profileMap[p.user.toString()] = p; });

    const playerUserIds = Array.from(new Set(combinedReports.map(r => r.player?._id?.toString() || r.player?.toString()).filter(Boolean)));
    const playerProfiles = await Profile.find({ user: { $in: playerUserIds } });
    const playerProfileMap = {};
    playerProfiles.forEach(p => { playerProfileMap[p.user.toString()] = p; });

    const formattedReports = combinedReports.map(r => {
      const sProf = profileMap[r.scout?._id?.toString() || r.scout?.toString()];
      const pProf = playerProfileMap[r.player?._id?.toString() || r.player?.toString()];

      r.scoutName = sProf?.name || r.scout?.email?.split('@')[0] || 'Official Scout';
      r.scoutOrganization = sProf?.organization || sProf?.clubRepresenting || 'Mission 2K38 Scout';
      r.scoutAvatar = sProf?.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
      if (pProf?.name) r.playerName = pProf.name;
      if (pProf?.preferredPosition) r.tacticalRole = pProf.preferredPosition;
      return r;
    });

    formattedReports.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    res.json(formattedReports);
  } catch (err) {
    console.error('Error fetching scout reports:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6.7 CREATE SCOUT REPORT
router.post('/scout/reports', authenticateToken, async (req, res) => {
  try {
    const scoutUserId = req.user.userId || req.user.id || req.userId;
    const { playerId, matchEvent, location, tacticalRole, recommendation, strengths, weaknesses, verdict } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required.' });
    }

    const playerProfile = await Profile.findOne({ $or: [{ user: playerId }, { _id: playerId }] });
    if (!playerProfile) {
      return res.status(404).json({ error: 'Player profile not found.' });
    }

    const targetUser = playerProfile.user;

    const report = new ScoutReport({
      scout: scoutUserId,
      player: targetUser,
      playerName: playerProfile.name || 'Player',
      matchEvent: matchEvent || 'Scouting Trial Match',
      location: location || 'Main Field',
      tacticalRole: tacticalRole || playerProfile.preferredPosition || 'ST',
      overallScore: playerProfile.skills?.aiScore || playerProfile.skills?.scoutScore || 0,
      recommendation: recommendation || 'SHORTLIST_FOR_TRIAL',
      strengths: strengths || '',
      weaknesses: weaknesses || '',
      verdict: verdict || ''
    });

    await report.save();
    res.json({ message: 'Scout report created successfully!', report });
  } catch (err) {
    console.error('Error creating scout report:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6.8 DELETE SCOUT REPORT
router.delete('/scout/reports/:id', authenticateToken, async (req, res) => {
  try {
    const reportId = req.params.id;
    await ScoutReport.findByIdAndDelete(reportId);
    res.json({ message: 'Scout report deleted successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post('/scout/rate', authenticateToken, async (req, res) => {
  try {
    const { playerId, trialId, speed, passing, dribbling, shooting, defending, physical, recommendation, scoutingVideo } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required.' });
    }

    const playerProfile = await Profile.findOne({ $or: [{ user: playerId }, { _id: playerId }] });
    if (!playerProfile) {
      return res.status(404).json({ error: 'Player profile not found.' });
    }

    const targetUser = playerProfile.user;
    const scoutUser = req.user.userId || req.user.id || req.userId;

    const attrs = {
      speed: Math.min(99, Math.max(0, Number(speed) || 0)),
      passing: Math.min(99, Math.max(0, Number(passing) || 0)),
      dribbling: Math.min(99, Math.max(0, Number(dribbling) || 0)),
      shooting: Math.min(99, Math.max(0, Number(shooting) || 0)),
      defending: Math.min(99, Math.max(0, Number(defending) || 0)),
      physical: Math.min(99, Math.max(0, Number(physical) || 0))
    };

    const position = playerProfile.preferredPosition || 'ST';
    const scoutScore = calculateScoutScore(attrs, position);

    const query = trialId 
      ? { player: targetUser, scout: scoutUser, trial: trialId }
      : { player: targetUser, scout: scoutUser, $or: [{ trial: null }, { trial: { $exists: false } }] };

    const updateFields = {
      ...attrs,
      scoutScore,
      player: targetUser,
      scout: scoutUser,
      recommendation: recommendation || 'SHORTLIST_FOR_TRIAL',
      scoutingVideo: scoutingVideo || ''
    };
    if (trialId) {
      updateFields.trial = trialId;
    } else {
      updateFields.trial = null;
    }

    let ratingDoc;
    try {
      ratingDoc = await ScoutRating.findOneAndUpdate(
        query,
        updateFields,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (dbErr) {
      if (dbErr.code === 11000 || (dbErr.message && dbErr.message.includes('E11000'))) {
        console.warn('[DB] Handled E11000 duplicate index error. Auto-repairing ScoutRating collection indexes.');
        await ScoutRating.collection.dropIndex('player_1_scout_1').catch(() => {});
        await ScoutRating.collection.dropIndex('player_1_scout_1_trial_1').catch(() => {});
        await ScoutRating.collection.createIndex({ player: 1, scout: 1, trial: 1 }, { unique: true }).catch(() => {});

        ratingDoc = await ScoutRating.findOneAndUpdate(
          query,
          updateFields,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).catch(async () => {
          const existing = await ScoutRating.findOne({ player: targetUser, scout: scoutUser, trial: trialId || null });
          if (existing) {
            Object.assign(existing, updateFields);
            return await existing.save();
          }
          return await ScoutRating.create(updateFields);
        });
      } else {
        throw dbErr;
      }
    }

    const updatedProfile = await recalculatePlayerRatings(targetUser);

    // Propagate Scout Report to player profile
    let trialTitle = 'Scouting Trial Match';
    let trialLocation = 'Scouting Ground';
    if (trialId) {
      const trialDoc = await Trial.findById(trialId);
      if (trialDoc) {
        trialTitle = trialDoc.title || trialTitle;
        trialLocation = trialDoc.location || trialLocation;
      }
    }

    const reportQuery = trialId
      ? { scout: scoutUser, player: targetUser, matchEvent: trialTitle }
      : { scout: scoutUser, player: targetUser };

    const reportDoc = await ScoutReport.findOneAndUpdate(
      reportQuery,
      {
        scout: scoutUser,
        player: targetUser,
        playerName: playerProfile.name || 'Player',
        matchEvent: trialTitle,
        location: trialLocation,
        tacticalRole: position,
        overallScore: scoutScore,
        recommendation: recommendation || 'SHORTLIST_FOR_TRIAL',
        strengths: `Pace/Speed: ${attrs.speed}, Passing: ${attrs.passing}, Dribbling: ${attrs.dribbling}, Shooting: ${attrs.shooting}, Defending: ${attrs.defending}, Physical: ${attrs.physical}`,
        verdict: `Official Trial Performance Rating of ${scoutScore}/99 filed by Scout.`,
        scoutingVideo: scoutingVideo || '',
        scores: attrs
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Send Notification to player (safely caught)
    try {
      const scoutProfile = await Profile.findOne({ user: scoutUser });
      const scoutName = scoutProfile?.name || 'A Verified Scout';

      await Notification.create({
        user: targetUser,
        type: 'report',
        title: '📋 New Official Scout Report!',
        message: `${scoutName} has evaluated your trial performance in "${trialTitle}" with a Scout Rating of ${scoutScore}/99.`,
        data: { reportId: reportDoc._id, scoutScore }
      });
    } catch (notifErr) {
      console.warn('[Notification Warning] Could not dispatch player report notification:', notifErr.message);
    }

    res.json({
      message: 'Scout rating saved and report propagated successfully!',
      scoutScore,
      rating: ratingDoc,
      report: reportDoc,
      skills: updatedProfile ? updatedProfile.skills : {}
    });
  } catch (err) {
    console.error('Error submitting scout rating:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET SCOUT RATING DETAILS FOR PLAYER
router.get('/scout/rate/:playerId', authenticateToken, async (req, res) => {
  try {
    const pId = req.params.playerId;
    const trialId = req.query.trialId;
    const playerProfile = await Profile.findOne({ $or: [{ user: pId }, { _id: pId }] });
    if (!playerProfile) {
      return res.status(404).json({ error: 'Player profile not found.' });
    }

    const scoutUser = req.user.userId || req.user.id || req.userId;
    const myQuery = trialId
      ? { player: playerProfile.user, scout: scoutUser, trial: trialId }
      : { player: playerProfile.user, scout: scoutUser };

    const myRating = await ScoutRating.findOne(myQuery);
    const allRatings = await ScoutRating.find({ player: playerProfile.user });

    const formatted = await formatProfileSkills(playerProfile);

    res.json({
      myRating,
      totalRatings: allRatings.length,
      position: playerProfile.preferredPosition || 'ST',
      weights: getPositionWeights(playerProfile.preferredPosition || 'ST'),
      skills: formatted.skills || {}
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ALL SUBMITTED SCOUT RATINGS (PREVIOUS RATINGS)
router.get('/scout/ratings', authenticateToken, async (req, res) => {
  try {
    const scoutUserId = req.user.userId || req.user.id || req.userId;
    const ratings = await ScoutRating.find({ scout: scoutUserId }).sort({ updatedAt: -1, createdAt: -1 });

    // Fetch player profiles
    const playerUserIds = Array.from(new Set(ratings.map(r => r.player?.toString()).filter(Boolean)));
    const playerProfiles = await Profile.find({ user: { $in: playerUserIds } });
    const profileMap = {};
    playerProfiles.forEach(p => { 
      if (p.user) profileMap[p.user.toString()] = p; 
      profileMap[p._id.toString()] = p;
    });

    // Fetch trials
    const trialIds = Array.from(new Set(ratings.map(r => r.trial?.toString()).filter(Boolean)));
    const trials = await Trial.find({ _id: { $in: trialIds } });
    const trialMap = {};
    trials.forEach(t => { 
      const tId = t._id?.toString() || t.id?.toString();
      if (tId) trialMap[tId] = t; 
    });

    const enriched = ratings.map(r => {
      const rObj = typeof r.toObject === 'function' ? r.toObject() : { ...r };
      const pIdStr = r.player?.toString();
      const pProfile = profileMap[pIdStr];
      const trialDoc = r.trial ? trialMap[r.trial?.toString()] : null;

      return {
        ...rObj,
        player: {
          _id: r.player,
          profileId: pProfile?._id,
          name: pProfile?.name || 'Prospect Player',
          profilePhoto: pProfile?.profilePhoto || '',
          preferredPosition: pProfile?.preferredPosition || 'ST',
          ageCategory: pProfile?.ageCategory || 'Senior',
          club: pProfile?.club || 'Free Agent',
          country: pProfile?.country || 'India',
          city: pProfile?.city || '',
          state: pProfile?.state || '',
          height: pProfile?.height,
          weight: pProfile?.weight,
          skills: pProfile?.skills || {}
        },
        trial: trialDoc ? {
          _id: trialDoc._id,
          title: trialDoc.title,
          location: trialDoc.location,
          date: trialDoc.date,
          time: trialDoc.time,
          positionsTarget: trialDoc.positionsTarget
        } : null
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('Error fetching scout ratings:', err);
    res.status(500).json({ error: 'Failed to fetch scout ratings.' });
  }
});

// DELETE A SCOUT RATING (PREVIOUS RATING REMOVAL)
router.delete('/scout/ratings/:id', authenticateToken, async (req, res) => {
  try {
    const scoutUserId = req.user.userId || req.user.id || req.userId;
    const ratingId = req.params.id;

    const ratingDoc = await ScoutRating.findOne({ _id: ratingId, scout: scoutUserId });
    if (!ratingDoc) {
      return res.status(404).json({ error: 'Rating not found or unauthorized.' });
    }

    const playerId = ratingDoc.player;
    await ScoutRating.deleteOne({ _id: ratingId });

    // Recalculate player ratings without this scout's rating
    await recalculatePlayerRatings(playerId);

    res.json({ message: 'Rating removed successfully.' });
  } catch (err) {
    console.error('Error deleting scout rating:', err);
    res.status(500).json({ error: 'Failed to delete rating.' });
  }
});


// 7. SCOUT SAVE PLAYER
router.post('/scout/save', authenticateToken, async (req, res) => {
  try {
    const { playerId } = req.body;
    const scoutUserId = req.user._id || req.user.id || req.user.userId;
    const scoutProfile = await Profile.findOne({ user: scoutUserId });
    if (!scoutProfile) return res.status(404).json({ error: 'Scout profile not found.' });

    if (!scoutProfile.savedPlayers) {
      scoutProfile.savedPlayers = [];
    }

    const targetIdStr = (typeof playerId === 'object' && playerId) ? (playerId._id || playerId.id) : String(playerId);

    let playerUserId = targetIdStr;
    const foundProfile = await Profile.findOne({ $or: [{ _id: targetIdStr }, { user: targetIdStr }] });
    if (foundProfile && foundProfile.user) {
      playerUserId = foundProfile.user.toString();
    }

    const existingStrList = scoutProfile.savedPlayers.map(id => id.toString());
    const idx = existingStrList.indexOf(playerUserId);

    let saved = false;
    if (idx === -1) {
      scoutProfile.savedPlayers.push(playerUserId);
      saved = true;
    } else {
      scoutProfile.savedPlayers.splice(idx, 1);
    }

    await scoutProfile.save();
    res.json({ message: saved ? 'Player prospect saved!' : 'Player prospect removed from saved list.', saved, savedPlayers: scoutProfile.savedPlayers });
  } catch (err) {
    console.error('Error toggling saved player:', err);
    res.status(500).json({ error: err.message });
  }
});

// 8. SCOUT SCHEDULE TRIAL
router.post('/scout/trial', authenticateToken, async (req, res) => {
  try {
    const { playerId, date, time, location, notes } = req.body;

    const trial = new Trial({
      scout: req.user.userId,
      player: playerId,
      date,
      time,
      location,
      notes
    });

    await trial.save();

    // Add trial to notification for player
    const { Notification } = require('../models');
    const scoutProfile = await Profile.findOne({ user: req.user.userId });
    const notification = new Notification({
      user: playerId,
      type: 'trial',
      title: 'New Trial Invite',
      message: `${scoutProfile ? scoutProfile.name : 'A Scout'} has invited you for a trial at ${location} on ${new Date(date).toLocaleDateString()}`,
      data: { trialId: trial._id }
    });
    await notification.save();

    res.status(201).json({ message: 'Trial scheduled successfully!', trial });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE SCOUT TRIAL
router.delete('/scout/trials/:id', authenticateToken, async (req, res) => {
  try {
    const trialId = req.params.id;
    const scoutUserId = req.user.userId || req.user.id || req.userId;
    await Trial.findOneAndDelete({ _id: trialId, scout: scoutUserId });
    res.json({ message: 'Trial card deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. SCOUT GET TRIALS AND SAVED PLAYERS
router.get('/scout/dashboard', authenticateToken, async (req, res) => {
  try {
    const scoutUserId = req.user._id || req.user.id || req.user.userId;
    const scoutProfile = await Profile.findOne({ user: scoutUserId });
    if (!scoutProfile) return res.status(404).json({ error: 'Scout profile not found.' });

    const trials = await Trial.find({ scout: scoutUserId })
      .populate('invitedPlayers', 'email')
      .populate('applicants.player', 'email')
      .sort({ date: 1 });

    let acceptedCount = 0;
    trials.forEach(t => {
      if (t.applicants) {
        acceptedCount += t.applicants.filter(a => a.status === 'accepted').length;
      }
    });

    const savedPlayerProfiles = await Profile.find({
      user: { $in: scoutProfile.savedPlayers || [] }
    }).populate('user', 'email');

    res.json({
      profile: scoutProfile,
      trials,
      savedPlayers: savedPlayerProfiles,
      acceptedCount
    });
  } catch (err) {
    console.error('Error loading scout dashboard:', err);
    res.status(500).json({ error: err.message });
  }
});

// 10. COACH GET SQUAD & TRIALS
router.get('/coach/dashboard', authenticateToken, async (req, res) => {
  try {
    const coachProfile = await Profile.findOne({ user: req.user.userId });
    if (!coachProfile) return res.status(404).json({ error: 'Coach profile not found.' });

    // Fetch players that are in same club or state
    const teamPlayers = await Profile.find({
      $or: [
        { currentClub: coachProfile.clubRepresenting || 'None' },
        { state: coachProfile.state }
      ]
    }).populate('user', 'email');

    res.json({
      profile: coachProfile,
      team: teamPlayers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. ADMIN DASHBOARD
router.get('/admin/dashboard', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Administrators only.' });
    }

    const totalUsers = await User.countDocuments();
    const totalPlayers = await User.countDocuments({ role: 'player' });
    const totalScouts = await User.countDocuments({ role: 'scout' });
    const totalCoaches = await User.countDocuments({ role: 'coach' });
    const totalVideos = await Video.countDocuments();
    const totalAnalyses = await Analysis.countDocuments();

    const pendingScouts = await Profile.find({
      user: { $in: await User.find({ role: 'scout' }).select('_id') },
      verifiedBadge: false
    }).populate('user', 'email');

    const pendingCoaches = await Profile.find({
      user: { $in: await User.find({ role: 'coach' }).select('_id') },
      verifiedBadge: false
    }).populate('user', 'email');

    const recentVideos = await Video.find()
      .populate({
        path: 'user',
        select: 'email',
      })
      .sort({ createdAt: -1 })
      .limit(10);

    const recentVideoProfiles = [];
    for (let v of recentVideos) {
      const p = await Profile.findOne({ user: v.user._id });
      recentVideoProfiles.push({
        ...v.toObject(),
        playerName: p ? p.name : 'Unknown Player'
      });
    }

    res.json({
      stats: {
        totalUsers,
        totalPlayers,
        totalScouts,
        totalCoaches,
        totalVideos,
        totalAnalyses
      },
      pendingScouts,
      pendingCoaches,
      recentVideos: recentVideoProfiles
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. ADMIN APPROVE VERIFICATION (Scout/Coach)
router.post('/admin/verify', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const { targetUserId, verify } = req.body;
    const profile = await Profile.findOne({ user: targetUserId });
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });

    profile.verifiedBadge = !!verify;
    await profile.save();

    // Create notification
    const { Notification } = require('../models');
    const notification = new Notification({
      user: targetUserId,
      type: 'alert',
      title: verify ? 'Account Verified!' : 'Account Verification Revoked',
      message: verify ? 'Your scout/coach verification documents have been reviewed and approved.' : 'Your verification status has been updated by the admin.'
    });
    await notification.save();

    res.json({ message: 'User verification updated successfully!', profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
