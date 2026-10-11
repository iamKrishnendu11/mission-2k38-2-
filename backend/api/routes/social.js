const express = require('express');
const router = express.Router();
const { Post, Comment, Follower, Chat, Message, Notification, Profile, User } = require('../models');

// AUTHENTICATION MIDDLEWARE
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required.' });

  const JWT_SECRET = process.env.JWT_SECRET || 'mission2k38_jwt_secret_key_998877_super_secure';
  require('jsonwebtoken').verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token.' });
    req.user = user;
    const uid = (user?.userId || user?.id || user?._id)?.toString();
    req.userId = uid;
    if (req.user) {
      req.user.userId = uid;
      req.user._id = uid;
      req.user.id = uid;
    }
    next();
  });
};

// 1. GET ALL POSTS (SOCIAL FEED)
router.get('/posts', async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('user', 'email role')
      .sort({ createdAt: -1 });

    const populatedPosts = [];
    for (let post of posts) {
      const profile = await Profile.findOne({ user: post.user._id });
      populatedPosts.push({
        ...post.toObject(),
        authorProfile: profile
      });
    }

    res.json(populatedPosts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. CREATE POST
router.post('/posts', authenticateToken, async (req, res) => {
  try {
    const { text, mediaUrl, mediaType } = req.body;
    const post = new Post({
      user: req.user.userId,
      text,
      mediaUrl,
      mediaType
    });

    await post.save();
    
    // Auto-populate author profile before response
    const profile = await Profile.findOne({ user: req.user.userId });
    res.status(201).json({
      ...post.toObject(),
      authorProfile: profile
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. LIKE / UNLIKE POST
router.post('/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const idx = post.likes.indexOf(req.user.userId);
    let liked = false;
    if (idx === -1) {
      post.likes.push(req.user.userId);
      liked = true;

      // Send notification to post author
      if (post.user.toString() !== req.user.userId) {
        const likerProfile = await Profile.findOne({ user: req.user.userId });
        const notification = new Notification({
          user: post.user,
          type: 'like',
          title: 'Post Liked',
          message: `${likerProfile ? likerProfile.name : 'Someone'} liked your post.`,
          data: { postId: post._id }
        });
        await notification.save();
      }
    } else {
      post.likes.splice(idx, 1);
    }

    await post.save();
    res.json({ likesCount: post.likes.length, liked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. ADD COMMENT
router.post('/posts/:id/comment', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const comment = new Comment({
      post: post._id,
      user: req.user.userId,
      text
    });

    await comment.save();

    post.commentsCount = (post.commentsCount || 0) + 1;
    await post.save();

    const profile = await Profile.findOne({ user: req.user.userId });

    // Notify post author
    if (post.user.toString() !== req.user.userId) {
      const commenterProfile = await Profile.findOne({ user: req.user.userId });
      const notification = new Notification({
        user: post.user,
        type: 'comment',
        title: 'New Comment',
        message: `${commenterProfile ? commenterProfile.name : 'Someone'} commented: "${text.substring(0, 30)}..."`,
        data: { postId: post._id }
      });
      await notification.save();
    }

    res.status(201).json({
      ...comment.toObject(),
      authorProfile: profile
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. GET POST COMMENTS
router.get('/posts/:id/comments', async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.id }).sort({ createdAt: 1 });
    const populatedComments = [];
    for (let c of comments) {
      const profile = await Profile.findOne({ user: c.user });
      populatedComments.push({
        ...c.toObject(),
        authorProfile: profile
      });
    }
    res.json(populatedComments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. FOLLOW / UNFOLLOW USER
router.post('/users/:id/follow', authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    if (targetUserId === req.user.userId) {
      return res.status(400).json({ error: "You cannot follow yourself." });
    }

    const existingFollow = await Follower.findOne({
      user: targetUserId,
      follower: req.user.userId
    });

    let following = false;
    if (!existingFollow) {
      const newFollow = new Follower({
        user: targetUserId,
        follower: req.user.userId
      });
      await newFollow.save();
      following = true;

      // Notify followed user
      const followerProfile = await Profile.findOne({ user: req.user.userId });
      const notification = new Notification({
        user: targetUserId,
        type: 'follow',
        title: 'New Follower',
        message: `${followerProfile ? followerProfile.name : 'Someone'} started following you.`,
        data: { followerId: req.user.userId }
      });
      await notification.save();
    } else {
      await Follower.deleteOne({ _id: existingFollow._id });
    }

    res.json({ following });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. GET CHATS HISTORY
router.get('/chats', authenticateToken, async (req, res) => {
  try {
    const currentUserId = (req.user?.userId || req.user?._id || req.user?.id || req.userId)?.toString();
    const chats = await Chat.find({
      participants: currentUserId
    }).sort({ lastMessageAt: -1 });

    const populatedChats = [];
    for (let chat of chats) {
      const otherParticipantId = (chat.participants || []).map(p => (p?._id || p?.id || p)?.toString()).find(p => p !== currentUserId);
      const otherUser = otherParticipantId ? await User.findById(otherParticipantId).select('email role') : null;
      const otherProfile = otherParticipantId ? await Profile.findOne({ user: otherParticipantId }) : null;
      
      const unreadCount = await Message.countDocuments({
        chat: chat._id,
        sender: { $ne: currentUserId },
        seen: { $ne: true }
      });

      populatedChats.push({
        _id: chat._id,
        lastMessage: chat.lastMessage,
        lastMessageAt: chat.lastMessageAt,
        otherUser,
        otherProfile,
        unreadCount
      });
    }

    res.json(populatedChats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET UNREAD CHATS COUNT
router.get('/chats/unread-count', authenticateToken, async (req, res) => {
  try {
    const currentUserId = (req.user?.userId || req.user?._id || req.user?.id || req.userId)?.toString();
    const chats = await Chat.find({ participants: currentUserId });
    if (!chats.length) {
      return res.json({ unreadCount: 0 });
    }
    const chatIds = chats.map(c => c._id);
    const count = await Message.countDocuments({
      chat: { $in: chatIds },
      sender: { $ne: currentUserId },
      seen: { $ne: true }
    });
    res.json({ unreadCount: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. START CHAT WITH USER
router.post('/chats/start', authenticateToken, async (req, res) => {
  try {
    const currentUserId = (req.user?.userId || req.user?._id || req.user?.id || req.userId)?.toString();
    const targetUserId = req.body.targetUserId ? String(req.body.targetUserId._id || req.body.targetUserId.id || req.body.targetUserId) : null;

    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required.' });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: 'Cannot start chat with yourself.' });
    }

    // Check if chat already exists
    let chat = await Chat.findOne({
      participants: { $all: [currentUserId, targetUserId] }
    });

    if (!chat) {
      chat = new Chat({
        participants: [currentUserId, targetUserId],
        lastMessage: 'Chat initialized.',
        lastMessageAt: new Date()
      });
      await chat.save();
    }

    res.status(201).json(chat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. GET MESSAGES IN CHAT
router.get('/chats/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const currentUserId = (req.user?.userId || req.user?._id || req.user?.id || req.userId)?.toString();

    const chat = await Chat.findOne({
      _id: req.params.chatId,
      participants: currentUserId
    });

    if (!chat) {
      return res.status(403).json({ error: 'Unauthorized chat access.' });
    }

    const messages = await Message.find({ chat: chat._id }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. GET NOTIFICATIONS
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.userId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. MARK NOTIFICATIONS AS READ
router.post('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, user: req.user.userId });
    if (!notification) return res.status(404).json({ error: 'Notification not found.' });

    notification.read = true;
    await notification.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MARK ALL NOTIFICATIONS AS READ
router.post('/notifications/mark-all-read', authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.userId, read: false },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. UPLOAD CHAT MEDIA TO CLOUDINARY (IMAGE / VIDEO)
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../../config/cloudinary');

const memStorage = multer.memoryStorage();
const memoryUpload = multer({
  storage: memStorage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.post('/upload-media', authenticateToken, memoryUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No media file provided.' });
    }

    const isVideo = req.file.mimetype.startsWith('video/');
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;

    if (cloudName && apiKey && !cloudName.includes('placeholder') && cloudName !== 'your_cloudinary_cloud_name') {
      if (cloudinary.configureCloudinary) {
        cloudinary.configureCloudinary();
      }

      const streamUpload = () => new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'mission2k38/chat_media',
            resource_type: isVideo ? 'video' : 'auto'
          },
          (error, result) => {
            if (error || !result) {
              reject(error || new Error('Cloudinary upload stream failed'));
            } else {
              resolve(result);
            }
          }
        );
        stream.end(req.file.buffer);
      });

      const cloudResult = await streamUpload();
      if (cloudResult && cloudResult.secure_url) {
        console.log('[Cloudinary Chat Media Upload Success]:', cloudResult.secure_url);
        return res.json({
          mediaUrl: cloudResult.secure_url,
          mediaType: isVideo ? 'video' : 'image'
        });
      }
    }

    // Fallback local storage if Cloudinary unconfigured
    const uploadDir = path.join(__dirname, '../../public/uploads/chat');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const ext = path.extname(req.file.originalname) || (isVideo ? '.mp4' : '.jpg');
    const localFilename = `chat_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
    const localPath = path.join(uploadDir, localFilename);
    fs.writeFileSync(localPath, req.file.buffer);

    const serverPort = process.env.PORT || 5000;
    const localMediaUrl = `http://localhost:${serverPort}/uploads/chat/${localFilename}`;

    return res.json({
      mediaUrl: localMediaUrl,
      mediaType: isVideo ? 'video' : 'image'
    });
  } catch (err) {
    console.error('Chat media upload error:', err);
    res.status(500).json({ error: 'Failed to upload chat media: ' + err.message });
  }
});

// 13. SEARCH USERS FOR DISCOVERY (PLAYERS, SCOUTS, COACHES)
router.get('/users/search', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const { q = '', role } = req.query;

    const userFilter = { _id: { $ne: currentUserId } };
    if (role && role !== 'all') {
      userFilter.role = role;
    }

    const users = await User.find(userFilter).select('email role _id');
    const userIds = users.map(u => u._id);

    let profileFilter = { user: { $in: userIds } };
    if (q.trim()) {
      profileFilter.$or = [
        { name: { $regex: q.trim(), $options: 'i' } },
        { preferredPosition: { $regex: q.trim(), $options: 'i' } },
        { city: { $regex: q.trim(), $options: 'i' } },
        { clubRepresenting: { $regex: q.trim(), $options: 'i' } }
      ];
    }

    const profiles = await Profile.find(profileFilter).populate('user', 'email role _id');

    const result = profiles.map(p => ({
      userId: p.user._id,
      email: p.user.email,
      role: p.user.role,
      name: p.name,
      preferredPosition: p.preferredPosition || '',
      ageCategory: p.ageCategory || '',
      profilePhoto: p.profilePhoto || '',
      city: p.city || '',
      state: p.state || ''
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 14. SEND MESSAGE VIA POST HTTP (WITH TEXT, IMAGE, OR VIDEO)
router.post('/chats/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const currentUserId = (req.user?.userId || req.user?._id || req.user?.id || req.userId)?.toString();
    const { text = '', mediaUrl, mediaType } = req.body;
    const chatId = req.params.chatId;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: currentUserId
    });

    if (!chat) {
      return res.status(403).json({ error: 'Unauthorized chat access.' });
    }

    let finalMediaType = mediaType;
    if (mediaUrl && !finalMediaType) {
      finalMediaType = mediaUrl.match(/\.(mp4|mov|webm|avi|mkv)(\?.*)?$/i) ? 'video' : 'image';
    }

    const message = new Message({
      chat: chatId,
      sender: currentUserId,
      text,
      mediaUrl: mediaUrl || '',
      mediaType: finalMediaType || undefined
    });
    await message.save();

    let snippet = text || (mediaType === 'video' ? '📹 Video Attachment' : '📷 Image Attachment');
    chat.lastMessage = snippet;
    chat.lastMessageAt = new Date();
    await chat.save();

    // Respond immediately to client so sending message does not block
    res.status(201).json(message);

    const receiverId = (chat.participants || []).map(p => (p?._id || p?.id || p)?.toString()).find(p => p !== currentUserId);
    if (receiverId) {
      // Process notification & socket broadcast asynchronously in background
      (async () => {
        try {
          const senderProfile = await Profile.findOne({ user: currentUserId });
          const notif = new Notification({
            user: receiverId,
            type: 'message',
            title: `💬 New message from ${senderProfile?.name || 'Someone'}`,
            message: snippet,
            data: { chatId: chat._id }
          });
          await notif.save();

          const io = req.app.get('io');
          if (io) {
            io.to(`chat_${chat._id}`).emit('receive_message', message);
            io.to(`user_${receiverId.toString()}`).emit('notification:new', notif);
            io.to(`user_${receiverId.toString()}`).emit('chat_list_update', { chatId: chat._id });
          }
        } catch (bErr) {
          console.error('[Background message notification error]:', bErr.message);
        }
      })();
    }
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;
