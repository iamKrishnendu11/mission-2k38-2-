const express = require('express');
const router = express.Router();
const { Trial, User, Profile, Notification, ScoutRating } = require('../models');
const authenticateToken = require('../../middleware/auth');

// HELPER TO CLEAN USER ID
const getCleanUserId = (userObj) => {
  if (!userObj) return null;
  if (typeof userObj === 'string') return userObj;
  if (userObj._id) return userObj._id.toString();
  if (userObj.id) return userObj.id.toString();
  return userObj.toString();
};

// HELPER FOR REALTIME NOTIFICATIONS
const emitRealtimeNotification = (req, targetUserId, notificationData) => {
  try {
    const io = req.app.get('io');
    const cleanId = getCleanUserId(targetUserId);
    if (io && cleanId) {
      console.log(`[Socket.io Notify] Emitting real-time notification to room: user_${cleanId}`);
      io.to(`user_${cleanId}`).emit('notification:new', notificationData);
    }
  } catch (err) {
    console.error('[Socket.io Notify Error]:', err.message);
  }
};

// 1. GET ALL PLAYERS FOR INVITATION SELECT
router.get('/players-list', authenticateToken, async (req, res) => {
  try {
    const players = await User.find({ role: 'player' }).select('email _id');
    const playerIds = players.map(p => p._id);
    const profiles = await Profile.find({ user: { $in: playerIds } }).populate('user', 'email role');

    const result = profiles.map(p => ({
      userId: p.user._id,
      email: p.user.email,
      name: p.name,
      ageCategory: p.ageCategory || 'Senior',
      preferredPosition: p.preferredPosition || 'ST',
      profilePhoto: p.profilePhoto || '',
      location: [p.city, p.state].filter(Boolean).join(', ')
    }));

    res.json(result);
  } catch (err) {
    console.error('Error fetching players list:', err);
    res.status(500).json({ error: 'Failed to fetch players list.' });
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

// 2. GET TRIALS (ROLES-AWARE & TARGETING FILTERED)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id || req.user.userId;
    const userRole = req.user.role;

    let trials = [];

    if (userRole === 'player') {
      const playerProfile = await Profile.findOne({ user: userId });
      const pAge = playerProfile?.ageCategory || 'Senior';
      const pPos = playerProfile?.preferredPosition || 'ST';

      // Player sees:
      // 1. Private trials where they are in invitedPlayers
      // 2. Public trials matching their ageCategory & preferredPosition
      // 3. Any trial where they have registered/applied
      const allTrials = await Trial.find({
        $or: [
          { privacy: 'public' },
          { privacy: 'private', invitedPlayers: userId },
          { 'applicants.player': userId }
        ]
      })
      .populate('scout', 'email')
      .populate('invitedPlayers', 'email')
      .populate('applicants.player', 'email')
      .sort({ date: 1 });

      trials = allTrials.filter(t => {
        const isApplicant = t.applicants && t.applicants.some(a => isPlayerMatch(a.player, userId));
        if (isApplicant) return true; // Keep applied trials so player can see them in My Upcoming Trials

        if (t.privacy === 'private') return true; // Direct unresponded invitation
        const matchesAge = (!t.ageCategory || t.ageCategory.length === 0 || t.ageCategory.includes(pAge));
        const matchesPos = (!t.positionsTarget || t.positionsTarget.length === 0 || t.positionsTarget.includes(pPos));
        return matchesAge && matchesPos;
      });
    } else {
      // Scout/Coach/Admin sees trials created by them
      trials = await Trial.find({ scout: userId })
        .populate('scout', 'email')
        .populate('invitedPlayers', 'email')
        .populate('applicants.player', 'email')
        .sort({ date: 1 });
    }

    // Populate profile names for applicants & invited players
    const userIdsToFetch = new Set();
    trials.forEach(t => {
      if (t.scout?._id) userIdsToFetch.add(t.scout._id.toString());
      (t.invitedPlayers || []).forEach(p => p?._id && userIdsToFetch.add(p._id.toString()));
      (t.applicants || []).forEach(a => {
        const pId = a.player?._id?.toString() || a.player?.toString();
        if (pId) userIdsToFetch.add(pId);
      });
    });

    const profiles = await Profile.find({ user: { $in: Array.from(userIdsToFetch) } });
    const profileMap = {};
    profiles.forEach(p => {
      profileMap[p.user.toString()] = p;
    });

    // Fetch all scout ratings submitted for trials (either scout or player)
    const ratings = await ScoutRating.find({ $or: [{ scout: userId }, { player: userId }], trial: { $ne: null } });
    const trialRatingMap = {};
    ratings.forEach(r => {
      const tId = r.trial?._id?.toString() || r.trial?.id?.toString() || r.trial?.toString();
      const pId = r.player?._id?.toString() || r.player?.id?.toString() || r.player?.toString();
      if (tId && pId) {
        trialRatingMap[`${tId}_${pId}`] = r;
      }
    });

    const enrichedTrials = trials.map(t => {
      const tObj = typeof t.toObject === 'function' ? t.toObject() : t;
      const trialIdStr = tObj._id?.toString() || tObj.id?.toString();
      const scoutProfile = profileMap[t.scout?._id?.toString() || t.scout?.toString()];
      let resolvedScoutName = scoutProfile?.name;
      if (!resolvedScoutName && t.scout?.email) {
        resolvedScoutName = t.scout.email.split('@')[0];
      }
      tObj.scoutName = resolvedScoutName || 'Scout Organizer';
      tObj.scoutOrganization = scoutProfile?.organization || scoutProfile?.clubRepresenting || 'Mission 2K38';

      const myApp = (tObj.applicants || []).find(a => isPlayerMatch(a.player, userId));
      tObj.isRegistered = !!myApp;

      const myRating = trialRatingMap[`${trialIdStr}_${userId}`];
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

      tObj.applicants = (tObj.applicants || []).map(app => {
        const pId = app.player?._id?.toString() || app.player?.id?.toString() || app.player?.toString();
        const pProfile = profileMap[pId];
        const rating = trialRatingMap[`${trialIdStr}_${pId}`];

        return {
          ...app,
          playerName: pProfile?.name || 'Player',
          preferredPosition: pProfile?.preferredPosition || 'ST',
          ageCategory: pProfile?.ageCategory || 'Senior',
          profilePhoto: pProfile?.profilePhoto || '',
          isRated: !!rating,
          scoutScore: rating ? rating.scoutScore : null,
          ratingData: rating || null
        };
      });

      return tObj;
    });

    res.json(enrichedTrials);
  } catch (err) {
    console.error('Error fetching trials:', err);
    res.status(500).json({ error: 'Failed to load trials calendar.' });
  }
});

// 3. CREATE / SCHEDULE NEW TRIAL (STRICT AGE & POSITION TARGETING)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id || req.user.userId;

    const {
      title,
      description,
      ageCategory,
      positionsTarget,
      date,
      time,
      location,
      privacy,
      invitedPlayers
    } = req.body;

    if (!title || !date || !time || !location) {
      return res.status(400).json({ error: 'Title, date, time, and location are required.' });
    }

    // Process ageCategory & positionsTarget arrays
    const formattedAgeCategory = Array.isArray(ageCategory)
      ? ageCategory
      : (ageCategory ? String(ageCategory).split(',').map(s => s.trim()).filter(Boolean) : []);

    const formattedPositions = Array.isArray(positionsTarget)
      ? positionsTarget
      : (positionsTarget ? String(positionsTarget).split(',').map(s => s.trim()).filter(Boolean) : []);

    const trial = new Trial({
      scout: userId,
      title,
      description: description || '',
      ageCategory: formattedAgeCategory,
      positionsTarget: formattedPositions,
      date: new Date(date),
      time,
      location,
      privacy: privacy === 'private' ? 'private' : 'public',
      invitedPlayers: Array.isArray(invitedPlayers) ? invitedPlayers : [],
      applicants: [],
      status: 'scheduled'
    });

    await trial.save();

    // NOTIFICATIONS DISPATCH
    const scoutProfile = await Profile.findOne({ user: userId });
    const organizerName = scoutProfile?.name || 'A Scout/Club';

    if (trial.privacy === 'public') {
      // Build profile match query for target ageCategory & preferredPosition ONLY
      const profileFilter = {};

      if (formattedAgeCategory.length > 0) {
        profileFilter.ageCategory = { $in: formattedAgeCategory };
      }

      if (formattedPositions.length > 0) {
        profileFilter.preferredPosition = { $in: formattedPositions };
      }

      // Find matching player profiles strictly
      const matchingProfiles = await Profile.find(profileFilter).select('user');
      const playerIds = matchingProfiles
        .map(p => (typeof p.user === 'object' && p.user ? p.user._id || p.user.id : p.user))
        .filter(Boolean);

      // Create notifications strictly for players with selected age & position
      const notifications = playerIds.map(pId => ({
        user: pId,
        type: 'trial',
        title: `🔥 Scouting Trial Callout: ${title}`,
        message: `${organizerName} scheduled a trial for your position/age on ${new Date(date).toLocaleDateString()} at ${location}. Tap to register!`,
        data: { trialId: trial._id }
      }));

      if (notifications.length > 0) {
        const savedNotifs = await Notification.insertMany(notifications);
        savedNotifs.forEach(n => emitRealtimeNotification(req, n.user, n));
      }
    } else if (trial.privacy === 'private' && trial.invitedPlayers.length > 0) {
      // Dispatch direct invitations to invited players
      const notifications = trial.invitedPlayers
        .map(p => (typeof p === 'object' && p ? p._id || p.id : p))
        .filter(Boolean)
        .map(pId => ({
        user: pId,
        type: 'trial',
        title: `📩 Private Scouting Trial Invitation: ${title}`,
        message: `${organizerName} has personally invited you to a private scouting trial on ${new Date(date).toLocaleDateString()} at ${location}.`,
        data: { trialId: trial._id }
      }));

      const savedNotifs = await Notification.insertMany(notifications);
      savedNotifs.forEach(n => emitRealtimeNotification(req, n.user, n));
    }

    res.status(201).json({ message: 'Trial scheduled successfully.', trial });
  } catch (err) {
    console.error('Error creating trial:', err);
    res.status(500).json({ error: 'Failed to schedule trial: ' + err.message });
  }
});

// 4. PLAYER APPLY / ACCEPT INVITATION FOR TRIAL
router.post('/:id/apply', authenticateToken, async (req, res) => {
  try {
    const trialId = req.params.id;
    const userId = getCleanUserId(req.user);

    const trial = await Trial.findById(trialId);
    if (!trial) {
      return res.status(404).json({ error: 'Trial not found.' });
    }

    if (!Array.isArray(trial.applicants)) {
      trial.applicants = [];
    }

    // Check if already applied
    const existingApplicant = trial.applicants.find(a => isPlayerMatch(a.player, userId));
    if (existingApplicant) {
      return res.json({ message: 'You have already registered for this trial.', trial });
    }

    trial.applicants.push({
      player: userId,
      status: 'pending',
      appliedAt: new Date()
    });

    await trial.save();

    // Send notification to trial organizer
    const playerProfile = await Profile.findOne({ user: userId });
    const organizerId = typeof trial.scout === 'object' && trial.scout ? (trial.scout._id || trial.scout.id) : trial.scout;
    if (organizerId) {
      const notif1 = await Notification.create({
        user: organizerId,
        type: 'trial',
        title: '🎯 New Trial Applicant',
        message: `${playerProfile?.name || 'A player'} has registered for your trial: "${trial.title}".`,
        data: { trialId: trial._id, playerId: userId }
      });
      emitRealtimeNotification(req, organizerId, notif1);
    }

    res.json({ message: 'Successfully registered for trial!', trial });
  } catch (err) {
    console.error('Error applying for trial:', err);
    res.status(500).json({ error: 'Failed to register for trial: ' + err.message });
  }
});

// 5. UPDATE APPLICANT STATUS (SCOUT / ORGANIZER)
router.put('/:id/applicant', authenticateToken, async (req, res) => {
  try {
    const trialId = req.params.id;
    const userId = getCleanUserId(req.user);
    const { playerId, status } = req.body; // 'pending', 'accepted', 'rejected', 'attended'

    const targetPlayerId = typeof playerId === 'object' ? (playerId?._id || playerId?.id || playerId) : playerId;

    const trial = await Trial.findOne({ _id: trialId, scout: userId });
    if (!trial) {
      return res.status(404).json({ error: 'Trial not found or unauthorized.' });
    }

    if (!Array.isArray(trial.applicants)) {
      trial.applicants = [];
    }

    const applicant = trial.applicants.find(a => isPlayerMatch(a.player, targetPlayerId));
    if (!applicant) {
      return res.status(404).json({ error: 'Applicant not found.' });
    }

    applicant.status = status;
    await trial.save();

    // Notify player of decision
    if (targetPlayerId) {
      const notif2 = await Notification.create({
        user: targetPlayerId,
        type: 'trial',
        title: `Trial Registration Updated (${status.toUpperCase()})`,
        message: `Your status for "${trial.title}" has been updated to: ${status.toUpperCase()}.`,
        data: { trialId: trial._id }
      });
      emitRealtimeNotification(req, targetPlayerId, notif2);
    }

    res.json({ message: `Applicant status updated to ${status}.`, trial });
  } catch (err) {
    console.error('Error updating applicant status:', err);
    res.status(500).json({ error: 'Failed to update applicant status: ' + err.message });
  }
});

// 6. PLAYER DECLINE / REJECT TRIAL INVITATION
router.post('/:id/decline', authenticateToken, async (req, res) => {
  try {
    const trialId = req.params.id;
    const userId = getCleanUserId(req.user);

    const trial = await Trial.findById(trialId);
    if (!trial) {
      return res.status(404).json({ error: 'Trial not found.' });
    }

    if (!Array.isArray(trial.applicants)) {
      trial.applicants = [];
    }

    const existingApplicant = trial.applicants.find(a => isPlayerMatch(a.player, userId));
    if (existingApplicant) {
      existingApplicant.status = 'rejected';
    } else {
      trial.applicants.push({
        player: userId,
        status: 'rejected',
        appliedAt: new Date()
      });
    }

    await trial.save();

    // Notify organizer of declined invitation
    const organizerId = typeof trial.scout === 'object' && trial.scout ? (trial.scout._id || trial.scout.id) : trial.scout;
    if (organizerId) {
      const notif3 = await Notification.create({
        user: organizerId,
        type: 'trial',
        title: 'Invitation Declined',
        message: `A player has declined your invitation for trial: "${trial.title}".`,
        data: { trialId: trial._id, playerId: userId }
      });
      emitRealtimeNotification(req, organizerId, notif3);
    }

    res.json({ message: 'Trial invitation declined.', trial });
  } catch (err) {
    console.error('Error declining trial:', err);
    res.status(500).json({ error: 'Failed to decline trial: ' + err.message });
  }
});

// DELETE TRIAL
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const trialId = req.params.id;
    const userId = req.user.userId || req.user.id || req.userId;

    await Trial.findOneAndDelete({ _id: trialId, scout: userId });
    res.json({ message: 'Trial card deleted successfully.' });
  } catch (err) {
    console.error('Error deleting trial:', err);
    res.status(500).json({ error: 'Failed to delete trial.' });
  }
});

module.exports = router;
