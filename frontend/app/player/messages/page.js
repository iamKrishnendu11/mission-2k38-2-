"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api, getSocketUrl } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import io from "socket.io-client";
import {
  Send, User, MessageSquare, ShieldCheck, Loader, Paperclip, Image as ImageIcon,
  Video as VideoIcon, X, Search, Plus, Play, Check, CheckCheck, Eye
} from "lucide-react";

function PlayerMessagesContent() {
  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessageText, setNewMessageText] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState("");

  // Media Attachment State
  const [selectedFile, setSelectedFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null); // 'image' | 'video'
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef(null);

  // Fullscreen Preview Modal
  const [previewMediaModal, setPreviewMediaModal] = useState(null); // { url, type }

  // User Discovery Modal
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // 'all' | 'player' | 'scout' | 'coach'
  const [searchResults, setSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const socketRef = useRef(null);
  const messageEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const searchParams = useSearchParams();
  const queryChatId = searchParams ? searchParams.get("chatId") : null;

  const currentUserIdStr = currentUser?.id || currentUser?._id || currentUser?.userId;

  // Initialize socket and load active chat lists
  useEffect(() => {
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const parsed = JSON.parse(userStr);
        setCurrentUser(parsed);
        const userId = parsed.id || parsed._id || parsed.userId;

        // Connect to Socket.io backend
        const SOCKET_URL = getSocketUrl();
        socketRef.current = io(SOCKET_URL, {
          transports: ["websocket", "polling"],
          reconnection: true
        });

        // Join personal user notification channel
        socketRef.current.emit("join_user", userId);
        socketRef.current.emit("join", userId);

        // Listen for chats list updates
        socketRef.current.on("chat_list_update", () => {
          loadChatThreads();
        });

        // Listen for typing notifications
        socketRef.current.on("typing_status", (data) => {
          if (data.isTyping) {
            setPartnerTyping(`${data.userName || "Someone"} is typing...`);
          } else {
            setPartnerTyping("");
          }
        });
      }
    }

    loadChatThreads();

    const interval = setInterval(() => {
      loadChatThreadsSilent();
    }, 4000);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      clearInterval(interval);
    };
  }, []);

  // Handle message receiving from selected chat room
  useEffect(() => {
    if (!socketRef.current || !selectedChat) return;

    socketRef.current.emit("join_chat", selectedChat._id);

    socketRef.current.on("receive_message", (msg) => {
      if (msg.chat === selectedChat._id) {
        setMessages(prev => {
          if (prev.some(m => String(m._id) === String(msg._id))) return prev;
          const matchingOptimisticIdx = prev.findIndex(m =>
            m.isOptimistic &&
            String(m.sender) === String(msg.sender) &&
            m.text === msg.text
          );
          if (matchingOptimisticIdx !== -1) {
            const next = [...prev];
            next[matchingOptimisticIdx] = msg;
            return next;
          }
          return [...prev, msg];
        });
        scrollToBottom();

        socketRef.current.emit("mark_seen", {
          chatId: selectedChat._id,
          userId: currentUserIdStr
        });
      }

      // Update conversations sidebar live
      setChats(prev => prev.map(ch => {
        if (ch._id === msg.chat) {
          const isSelected = selectedChat?._id === msg.chat;
          const snippet = msg.text || (msg.mediaType === 'video' ? '📹 Video Attachment' : '📷 Image Attachment');
          return {
            ...ch,
            lastMessage: snippet,
            lastMessageAt: msg.createdAt || new Date(),
            unreadCount: isSelected ? 0 : (ch.unreadCount || 0) + 1
          };
        }
        return ch;
      }));
    });

    socketRef.current.on("marked_seen_status", (data) => {
      if (data.chatId === selectedChat._id) {
        setMessages(prev => prev.map(m => m.sender !== currentUserIdStr ? { ...m, seen: true } : m));
      }
    });

    return () => {
      socketRef.current.off("receive_message");
      socketRef.current.off("marked_seen_status");
    };
  }, [selectedChat, currentUserIdStr]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatThreads = async () => {
    setLoadingChats(true);
    try {
      const res = await api.get("/social/chats");
      const list = Array.isArray(res) ? res : [];
      setChats(list);
      setLoadingChats(false);
      if (queryChatId && !selectedChat) {
        const found = list.find(c => String(c._id) === String(queryChatId));
        if (found) {
          handleSelectChat(found);
        }
      }
      return list;
    } catch (err) {
      console.error("Failed to load chat threads:", err);
      setLoadingChats(false);
      return [];
    }
  };

  const loadChatThreadsSilent = () => {
    api.get("/social/chats")
      .then(res => {
        if (Array.isArray(res)) setChats(res);
      })
      .catch(err => console.error(err));
  };

  // Search users in Discovery Modal
  useEffect(() => {
    if (!showSearchModal) return;
    setSearchingUsers(true);
    api.get(`/social/users/search?q=${encodeURIComponent(searchQuery)}&role=${roleFilter}`)
      .then(res => {
        setSearchResults(res || []);
        setSearchingUsers(false);
      })
      .catch(err => {
        console.error(err);
        setSearchingUsers(false);
      });
  }, [searchQuery, roleFilter, showSearchModal]);

  const handleStartChatWithUser = async (targetUserId) => {
    try {
      const chat = await api.post("/social/chats/start", { targetUserId });
      setShowSearchModal(false);
      const updatedList = await loadChatThreads();
      
      // Auto-select chat
      const fullChat = updatedList.find(c => c._id === chat._id) || chat;
      handleSelectChat(fullChat);
    } catch (err) {
      console.error("Error starting chat:", err);
      alert("Failed to start chat: " + err.message);
    }
  };

  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);
    setLoadingMessages(true);
    setMessages([]);
    setPartnerTyping("");

    // Clear unread badge locally for this chat
    setChats(prev => prev.map(ch => ch._id === chat._id ? { ...ch, unreadCount: 0 } : ch));

    if (socketRef.current) {
      socketRef.current.emit("join_chat", chat._id);
      socketRef.current.emit("mark_seen", {
        chatId: chat._id,
        userId: currentUserIdStr
      });
    }

    try {
      const msgs = await api.get(`/social/chats/${chat._id}/messages`);
      setMessages(msgs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Handle File Selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isImage && !isVideo) {
      alert("Please select an image (JPG/PNG/WEBP) or a video (MP4/MOV/WEBM).");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert("File size exceeds maximum 50MB limit.");
      return;
    }

    setSelectedFile(file);
    setMediaType(isVideo ? "video" : "image");
    setMediaPreviewUrl(URL.createObjectURL(file));
  };

  const handleClearSelectedFile = () => {
    setSelectedFile(null);
    setMediaPreviewUrl(null);
    setMediaType(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if ((!newMessageText.trim() && !selectedFile) || !selectedChat || uploadingMedia) return;

    let uploadedMediaUrl = "";
    let uploadedMediaType = mediaType;

    // If file is attached, upload it first
    if (selectedFile) {
      setUploadingMedia(true);
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const uploadRes = await api.upload("/social/upload-media", formData);
        uploadedMediaUrl = uploadRes.mediaUrl;
        uploadedMediaType = uploadRes.mediaType;
      } catch (uErr) {
        console.error("Media upload error:", uErr);
        alert("Failed to upload media: " + uErr.message);
        setUploadingMedia(false);
        return;
      } finally {
        setUploadingMedia(false);
      }
    }

    const payload = {
      chatId: selectedChat._id,
      senderId: currentUserIdStr,
      text: newMessageText.trim(),
      mediaUrl: uploadedMediaUrl,
      mediaType: uploadedMediaType
    };

    // Stop typing indicator on send
    if (socketRef.current) {
      socketRef.current.emit("typing", {
        chatId: selectedChat._id,
        userId: currentUserIdStr,
        userName: currentUser?.name || "Someone",
        isTyping: false
      });
    }

    const textToSend = newMessageText.trim();
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const optimisticMsg = {
      _id: tempId,
      chat: selectedChat._id,
      sender: currentUserIdStr,
      text: textToSend,
      mediaUrl: uploadedMediaUrl,
      mediaType: uploadedMediaType,
      createdAt: new Date().toISOString(),
      isOptimistic: true
    };

    // 1. Instantly show message in the chat window (0ms perceived latency)
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom(), 20);

    // 2. Instantly clear input field and media preview
    setNewMessageText("");
    handleClearSelectedFile();
    setIsTyping(false);

    // 3. Instantly update sidebar thread snippet
    const snippet = textToSend || (uploadedMediaType === 'video' ? '📹 Video Attachment' : '📷 Image Attachment');
    setChats(prev => prev.map(ch => {
      if (ch._id === selectedChat._id) {
        return {
          ...ch,
          lastMessage: snippet,
          lastMessageAt: new Date()
        };
      }
      return ch;
    }));

    // 4. Persist via backend API in background
    api.post(`/social/chats/${selectedChat._id}/messages`, {
      text: textToSend,
      mediaUrl: uploadedMediaUrl,
      mediaType: uploadedMediaType
    })
      .then(sentMsg => {
        if (sentMsg) {
          setMessages(prev => {
            if (prev.some(m => String(m._id) === String(sentMsg._id))) {
              return prev.filter(m => m._id !== tempId);
            }
            return prev.map(m => (m._id === tempId ? sentMsg : m));
          });
        }
      })
      .catch(pErr => {
        console.error("Failed to persist message:", pErr);
        setMessages(prev => prev.map(m => (m._id === tempId ? { ...m, failed: true } : m)));
      });
  };

  const handleTyping = (e) => {
    setNewMessageText(e.target.value);
    if (!isTyping && socketRef.current && selectedChat) {
      setIsTyping(true);
      socketRef.current.emit("typing", {
        chatId: selectedChat._id,
        userId: currentUserIdStr,
        userName: currentUser?.name || "Someone",
        isTyping: true
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (socketRef.current && selectedChat) {
        socketRef.current.emit("typing", {
          chatId: selectedChat._id,
          userId: currentUserIdStr,
          userName: currentUser?.name || "Someone",
          isTyping: false
        });
      }
    }, 2000);
  };

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto h-[78vh] flex gap-6 md:gap-8">
        
        {/* CONVERSATIONS SIDEBAR */}
        <div className="w-80 bg-[#121214] border border-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-3xl p-5 flex flex-col justify-between shrink-0 shadow-xl">
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            
            <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
              <h3 className="text-xs font-bold text-sm tracking-tight text-white/70">
                Conversations
              </h3>
              <button
                onClick={() => setShowSearchModal(true)}
                className="bg-yellow-400 hover:bg-yellow-500 text-black p-2 rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-[0_0_15px_rgba(250,204,21,0.25)]"
                title="Start New Chat"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>New</span>
              </button>
            </div>

            {loadingChats ? (
              <div className="text-center py-10 space-y-3">
                <Loader className="w-5 h-5 animate-spin text-yellow-400 mx-auto" />
                <span className="text-[10px] text-white/40 font-bold text-sm tracking-tight block">Loading Messages...</span>
              </div>
            ) : chats.length === 0 ? (
              <div className="text-center py-10 text-white/40 text-xs space-y-3">
                <MessageSquare className="w-8 h-8 text-zinc-700 mx-auto stroke-1" />
                <p>No active conversations yet.</p>
                <button
                  onClick={() => setShowSearchModal(true)}
                  className="text-yellow-400 font-bold hover:underline text-xs"
                >
                  + Start a Chat with Player or Scout
                </button>
              </div>
            ) : (
              <div data-lenis-prevent className="space-y-2 overflow-y-auto flex-1 pr-1">
                {chats.map((c) => {
                  const otherProfile = c.otherProfile || {};
                  const otherUser = c.otherUser || {};
                  const active = selectedChat?._id === c._id;
                  const hasUnread = (c.unreadCount || 0) > 0;
                  
                  return (
                    <div
                      key={c._id}
                      onClick={() => handleSelectChat(c)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center space-x-3 ${
                        active
                          ? "bg-yellow-400/10 border-yellow-400/80 text-yellow-400 shadow-md"
                          : hasUnread
                          ? "bg-emerald-950/30 border-emerald-500/80 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                          : "bg-zinc-950/40 border-white/[0.04]/80 text-white/50 hover:text-white hover:border-zinc-700"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700 shrink-0">
                        <img 
                          src={otherProfile.profilePhoto || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150"} 
                          alt="Avatar" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div className="truncate flex-1">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-xs truncate text-white flex items-center gap-1">
                            {otherProfile.name || otherUser.email?.split('@')[0] || "User"}
                            {otherProfile.verifiedBadge && <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />}
                          </h4>
                          <div className="flex items-center gap-1.5">
                            {otherUser.role && (
                              <span className="text-[8px] font-bold text-sm tracking-tight px-1.5 py-0.5 rounded bg-zinc-900 text-white/40 border border-white/[0.04]">
                                {otherUser.role}
                              </span>
                            )}
                            {hasUnread && (
                              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-black font-black text-[10px] flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse shrink-0">
                                {c.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className={`text-[10px] truncate mt-1 ${hasUnread ? "text-emerald-400 font-bold" : "text-white/40 font-medium"}`}>
                          {c.lastMessage || "No messages yet"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* MESSAGING BOX */}
        <div className="flex-1 bg-[#0a0a0c] border border-white/[0.02] rounded-3xl flex flex-col justify-between overflow-hidden shadow-2xl relative">
          {selectedChat ? (
            <>
              {/* Header */}
              <div className="flex justify-between items-center bg-zinc-900/30 px-6 py-4 border-b border-white/[0.04]">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-zinc-700 bg-zinc-900">
                    <img 
                      src={selectedChat.otherProfile?.profilePhoto || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150"} 
                      alt="Avatar" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      {selectedChat.otherProfile?.name || selectedChat.otherUser?.email?.split('@')[0] || "User"}
                      {selectedChat.otherProfile?.verifiedBadge && <ShieldCheck className="w-4 h-4 text-blue-400" />}
                    </h4>
                    <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block mt-0.5">
                      {selectedChat.otherUser?.role || 'Member'} {partnerTyping && `• ${partnerTyping}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Message History */}
              <div data-lenis-prevent className="flex-1 p-6 overflow-y-auto space-y-4 bg-zinc-950/40 scrollbar-thin">
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600 text-xs space-y-2">
                    <MessageSquare className="w-10 h-10 text-zinc-700 stroke-1" />
                    <p>No messages in this chat yet. Send a greeting or share video highlights!</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const senderId = typeof m.sender === 'object' ? (m.sender?._id || m.sender?.id) : m.sender;
                    const isOwn = String(senderId) === String(currentUserIdStr);

                    const resolveMedia = (msg) => {
                      if (!msg || !msg.mediaUrl) return null;
                      let url = msg.mediaUrl;
                      if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("data:")) {
                        const sUrl = getSocketUrl();
                        url = `${sUrl}${url.startsWith("/") ? "" : "/"}${url}`;
                      }
                      const isVideo = msg.mediaType === "video" || !!url.match(/\.(mp4|mov|webm|avi|mkv)(\?.*)?$/i);
                      return {
                        url,
                        type: isVideo ? "video" : "image"
                      };
                    };

                    const media = resolveMedia(m);

                    return (
                      <div key={m._id || Math.random()} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed space-y-2 shadow-md ${
                          isOwn 
                            ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-semibold rounded-tr-none" 
                            : "bg-zinc-900 border border-white/[0.04] text-zinc-200 rounded-tl-none"
                        }`}>
                          
                          {/* Image Attachment Rendering */}
                          {media && media.type === "image" && (
                            <div 
                              onClick={() => setPreviewMediaModal({ url: media.url, type: "image" })}
                              className="rounded-xl overflow-hidden cursor-pointer border border-black/10 hover:opacity-95 transition-all max-w-sm"
                            >
                              <img 
                                src={media.url} 
                                alt="Attached Media" 
                                className="w-full h-auto max-h-64 object-cover rounded-xl"
                                onError={(e) => {
                                  if (!e.target.dataset.retried) {
                                    e.target.dataset.retried = "true";
                                    e.target.src = `${media.url}?t=${Date.now()}`;
                                  }
                                }}
                              />
                            </div>
                          )}

                          {/* Video Attachment Rendering */}
                          {media && media.type === "video" && (
                            <div className="rounded-xl overflow-hidden border border-black/20 bg-black max-w-sm">
                              <video 
                                src={media.url} 
                                controls 
                                className="w-full h-auto max-h-64 rounded-xl"
                              />
                            </div>
                          )}

                          {/* Text Message */}
                          {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}

                          <div className={`flex items-center justify-end gap-1 text-[8px] font-black uppercase mt-1 ${isOwn ? "text-black/70" : "text-white/40"}`}>
                            <span>{new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isOwn && (
                              <span>{m.failed ? "⚠️ Failed" : m.isOptimistic ? "🕒" : m.seen ? "✓✓" : "✓"}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messageEndRef} />
              </div>

              {/* MEDIA PREVIEW CONTAINER BEFORE SENDING */}
              {selectedFile && (
                <div className="px-6 py-3 bg-zinc-900 border-t border-white/[0.04] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {mediaType === "image" ? (
                      <img src={mediaPreviewUrl} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-zinc-700" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-zinc-950 border border-zinc-700 flex items-center justify-center">
                        <VideoIcon className="w-6 h-6 text-yellow-400" />
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-white font-bold block truncate max-w-xs">{selectedFile.name}</span>
                      <span className="text-[9px] uppercase tracking-wider text-yellow-400 font-bold">
                        {mediaType === "image" ? "📷 Image Attachment" : "📹 Video Attachment"} ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSelectedFile}
                    className="p-1.5 text-white/50 hover:text-white rounded-lg hover:bg-zinc-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* CHAT INPUT FORM */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-white/[0.04] bg-zinc-900/20 flex items-center gap-3">
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,video/*"
                  className="hidden"
                />

                {/* File Attachment Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-3.5 rounded-xl border transition-all ${
                    selectedFile
                      ? "bg-yellow-400/20 border-yellow-400 text-yellow-400"
                      : "bg-zinc-950 border-white/[0.04] text-white/50 hover:text-white hover:border-zinc-700"
                  }`}
                  title="Attach Image or Video"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                {/* Text Message Field */}
                <input
                  type="text"
                  placeholder={selectedFile ? "Add a caption for your media..." : "Type your message..."}
                  value={newMessageText}
                  onChange={handleTyping}
                  className="flex-1 bg-zinc-950 border border-white/[0.04] focus:border-yellow-400 focus:outline-none rounded-xl p-4 text-xs text-white"
                />

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={uploadingMedia}
                  className="p-4 bg-gradient-to-r from-yellow-400 to-amber-500 hover:scale-105 rounded-xl text-black transition-all shadow-md font-bold disabled:opacity-50"
                >
                  {uploadingMedia ? (
                    <Loader className="w-4 h-4 animate-spin text-black" />
                  ) : (
                    <Send className="w-4 h-4 stroke-[2.5]" />
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-zinc-600 text-center space-y-4">
              <MessageSquare className="w-16 h-16 stroke-1 text-zinc-700" />
              <div>
                <h4 className="text-white font-bold text-sm uppercase tracking-wider">Select or Start a Conversation</h4>
                <p className="text-white/40 text-xs mt-1 max-w-sm mx-auto">
                  Players, Scouts, and Coaches can directly send text messages, image clips, and video highlights.
                </p>
                <button
                  onClick={() => setShowSearchModal(true)}
                  className="mt-4 bg-yellow-400 hover:bg-yellow-500 text-black px-6 py-2.5 rounded-xl text-xs font-bold text-sm tracking-tight shadow-lg transition-all"
                >
                  + Start New Chat
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* USER DISCOVERY & NEW CHAT MODAL */}
      {showSearchModal && (
        <div data-lenis-prevent className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div data-lenis-prevent className="bg-[#0a0a0c] border border-white/[0.02] rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative my-auto max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
              <div>
                <h3 className="text-base font-black uppercase text-white tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-yellow-400" /> Discover Players & Scouts
                </h3>
                <p className="text-[10px] text-white/40 font-bold text-sm tracking-tight mt-0.5">
                  Select anyone to initiate a direct conversation
                </p>
              </div>
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-1.5 text-white/50 hover:text-white rounded-lg hover:bg-zinc-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Search by name, position, or club..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-white/[0.04] focus:border-yellow-400 focus:outline-none rounded-xl pl-10 pr-4 py-3 text-xs text-white"
              />
            </div>

            {/* Role Filter Tabs */}
            <div className="flex gap-2 border-b border-white/[0.04] pb-3">
              {['all', 'player', 'scout', 'coach'].map(r => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold text-sm tracking-tight transition-all ${
                    roleFilter === r
                      ? "bg-yellow-400 text-black"
                      : "bg-zinc-900 text-white/50 hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* User Search Results List */}
            <div data-lenis-prevent className="overflow-y-auto space-y-2 flex-1 pr-1 max-h-64">
              {searchingUsers ? (
                <div className="text-center py-8">
                  <Loader className="w-5 h-5 animate-spin text-yellow-400 mx-auto" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-xs">
                  No matching players or scouts found.
                </div>
              ) : (
                searchResults.map(u => (
                  <div
                    key={u.userId}
                    onClick={() => handleStartChatWithUser(u.userId)}
                    className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/[0.04] hover:border-yellow-400/80 hover:bg-zinc-900 flex items-center justify-between cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0 group-hover:border-yellow-400">
                        <img src={u.profilePhoto || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150"} alt="User" className="w-full h-full object-cover" />
                      </div>
                      <div className="truncate">
                        <h4 className="font-bold text-xs text-white group-hover:text-yellow-400 transition-colors flex items-center gap-1.5 truncate">
                          {u.name}
                        </h4>
                        <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold block">
                          {u.role} {u.preferredPosition && `• ${u.preferredPosition}`} {u.city && `• ${u.city}`}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-sm tracking-tight px-3 py-1 rounded-xl bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 group-hover:bg-yellow-400 group-hover:text-black transition-all">
                      Chat →
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN MEDIA PREVIEW MODAL */}
      {previewMediaModal && (
        <div 
          onClick={() => setPreviewMediaModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl">
            <button
              onClick={() => setPreviewMediaModal(null)}
              className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={previewMediaModal.url} alt="Fullscreen Preview" className="w-full h-auto max-h-[85vh] object-contain rounded-2xl" />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function PlayerMessages() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading Messages inbox...</div>}>
      <PlayerMessagesContent />
    </Suspense>
  );
}
