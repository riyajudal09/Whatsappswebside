import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import useUserStore from '../../store/useUserStore';
import useThemeStore from '../../store/useThemeStore';
import { getAllUser, logoutUser, updateUserProfile } from '../../api/authApi';
import { deleteMessage, getMessages, reactToMessage, sendMessage } from '../../api/chatApi';
import { createStatus, deleteStatus, getStatuses, markStatusViewed } from '../../api/statusApi';
import { disconnectSocket, getSocket } from '../../utils/socket';

const fallbackAvatar = (user) => `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(user?.username || user?._id || 'user')}`;
const avatarOf = (user) => user?.profilepicture || user?.profilePicture || fallbackAvatar(user);
const idOf = (value) => String(value?._id || value || '');

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

function lastSeenText(user) {
  if (user?.isOnline) return 'online';
  if (!user?.lastSeen) return 'offline';
  return `last seen ${new Date(user.lastSeen).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`;
}

function messagePreview(item) {
  const m = item?.conversation?.lastMessage;
  if (!m) return item?.about || 'Start a conversation';
  if (m.deletedForEveryone) return 'Message deleted';
  if (m.contentType === 'image') return '📷 Photo';
  if (m.contentType === 'video') return '🎥 Video';
  return m.content || 'Message';
}

export default function Home() {
  const currentUser = useUserStore((s) => s.user);
  const setCurrentUser = useUserStore((s) => s.setUser);
  const clearUser = useUserStore((s) => s.clearUser);
  const { theme, toggleTheme } = useThemeStore();
  const [activeTab, setActiveTab] = useState('chats');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const selectedUserRef = useRef(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [media, setMedia] = useState(null);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [statusText, setStatusText] = useState('');
  const [statusMedia, setStatusMedia] = useState(null);
  const [openStatus, setOpenStatus] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState(currentUser?.username || '');
  const [profileAbout, setProfileAbout] = useState(currentUser?.about || '');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const messagesEndRef = useRef(null);
  const fileRef = useRef(null);
  const typingTimer = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

  const loadUsers = async () => {
    try {
      const result = await getAllUser();
      const list = result?.data || [];
      setUsers(list);
      const selectedId = idOf(selectedUserRef.current);
      if (selectedId) {
        const fresh = list.find((u) => idOf(u) === selectedId);
        if (fresh) {
          setSelectedUser(fresh);
          selectedUserRef.current = fresh;
        }
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const loadStatuses = async () => {
    try { setStatuses(await getStatuses()); }
    catch (error) { toast.error(error.message); }
  };

  useEffect(() => {
    loadUsers();
    loadStatuses();
    const userInterval = setInterval(loadUsers, 15000);
    return () => clearInterval(userInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentUser?._id) return;
    let mounted = true;
    let socket;

    getSocket().then((s) => {
      if (!mounted) return;
      socket = s;
      socketRef.current = s;
      s.emit('user_connected', currentUser._id);

      const onReceive = (message) => {
        const peer = selectedUserRef.current;
        const peerId = idOf(peer);
        const senderId = idOf(message.sender);
        if (peerId && senderId === peerId) {
          setMessages((prev) => prev.some((m) => idOf(m) === idOf(message)) ? prev : [...prev, message]);
        }
        loadUsers();
      };
      const onUpdated = () => loadUsers();
      const onUserStatus = ({ userId, isOnline, lastSeen }) => {
        setUsers((prev) => prev.map((u) => idOf(u) === String(userId) ? { ...u, isOnline, lastSeen } : u));
        setSelectedUser((prev) => prev && idOf(prev) === String(userId) ? { ...prev, isOnline, lastSeen } : prev);
      };
      const onTyping = ({ userId, isTyping }) => {
        if (idOf(selectedUserRef.current) === String(userId)) setTyping(Boolean(isTyping));
      };
      const onReaction = (updated) => setMessages((prev) => prev.map((m) => idOf(m) === idOf(updated) ? updated : m));
      const onDeleted = ({ messageId }) => setMessages((prev) => prev.map((m) => idOf(m) === String(messageId) ? { ...m, deletedForEveryone: true, content: '', mediaUrl: '', reactions: [] } : m));
      const onStatus = () => loadStatuses();
      const onStatusUpdate = ({ messageIds, messageStatus }) => {
        const set = new Set((messageIds || []).map(String));
        setMessages((prev) => prev.map((m) => set.has(idOf(m)) ? { ...m, messageStatus } : m));
      };

      s.on('receive_message', onReceive);
      s.on('conversation_updated', onUpdated);
      s.on('user_status', onUserStatus);
      s.on('user_typing', onTyping);
      s.on('reaction_update', onReaction);
      s.on('message_deleted', onDeleted);
      s.on('status_updated', onStatus);
      s.on('message_status_update', onStatusUpdate);

      s.__cleanupWhatsapp = () => {
        s.off('receive_message', onReceive);
        s.off('conversation_updated', onUpdated);
        s.off('user_status', onUserStatus);
        s.off('user_typing', onTyping);
        s.off('reaction_update', onReaction);
        s.off('message_deleted', onDeleted);
        s.off('status_updated', onStatus);
        s.off('message_status_update', onStatusUpdate);
      };
    }).catch(() => {
      // REST polling still keeps the app usable if realtime client cannot load.
    });

    return () => {
      mounted = false;
      if (socket?.__cleanupWhatsapp) socket.__cleanupWhatsapp();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  async function selectUser(user) {
    setSelectedUser(user);
    selectedUserRef.current = user;
    setTyping(false);
    const cid = user?.conversation?._id || null;
    setConversationId(cid);
    setMessages([]);
    if (cid) {
      try {
        const data = await getMessages(cid);
        setMessages(data);
        loadUsers();
      } catch (error) { toast.error(error.message); }
    }
  }

  async function handleSend(e) {
    e?.preventDefault();
    if (!selectedUser || (!text.trim() && !media) || sending) return;
    setSending(true);
    try {
      const result = await sendMessage(selectedUser._id, text.trim(), media);
      if (result?.message) setMessages((prev) => prev.some((m) => idOf(m) === idOf(result.message)) ? prev : [...prev, result.message]);
      if (result?.conversationId) setConversationId(String(result.conversationId));
      setText('');
      setMedia(null);
      if (fileRef.current) fileRef.current.value = '';
      socketRef.current?.emit('typing_stop', { receiverId: selectedUser._id, conversationId: result?.conversationId || conversationId });
      loadUsers();
    } catch (error) { toast.error(error.message); }
    finally { setSending(false); }
  }

  function onTypingChange(value) {
    setText(value);
    if (!selectedUser) return;
    socketRef.current?.emit('typing_start', { receiverId: selectedUser._id, conversationId });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socketRef.current?.emit('typing_stop', { receiverId: selectedUser._id, conversationId }), 900);
  }

  async function handleReaction(messageId, emoji) {
    try {
      const updated = await reactToMessage(messageId, emoji);
      setMessages((prev) => prev.map((m) => idOf(m) === idOf(updated) ? updated : m));
    } catch (error) { toast.error(error.message); }
  }

  async function handleDelete(messageId) {
    try {
      await deleteMessage(messageId);
      setMessages((prev) => prev.map((m) => idOf(m) === String(messageId) ? { ...m, deletedForEveryone: true, content: '', mediaUrl: '', reactions: [] } : m));
      loadUsers();
    } catch (error) { toast.error(error.message); }
  }

  async function handleCreateStatus(e) {
    e.preventDefault();
    if (!statusText.trim() && !statusMedia) return;
    try {
      await createStatus(statusText.trim(), statusMedia);
      setStatusText('');
      setStatusMedia(null);
      await loadStatuses();
      toast.success('Status posted');
    } catch (error) { toast.error(error.message); }
  }

  async function viewStatus(status) {
    setOpenStatus(status);
    if (idOf(status.user) !== idOf(currentUser)) await markStatusViewed(status._id);
    loadStatuses();
  }

  async function removeStatus(statusId) {
    try { await deleteStatus(statusId); setOpenStatus(null); loadStatuses(); }
    catch (error) { toast.error(error.message); }
  }

  async function saveProfile(e) {
    e.preventDefault();
    const form = new FormData();
    form.append('username', profileName.trim());
    form.append('about', profileAbout.trim());
    if (profilePhoto) form.append('profilepicture', profilePhoto);
    try {
      const result = await updateUserProfile(form);
      setCurrentUser(result.data);
      setProfileOpen(false);
      setProfilePhoto(null);
      toast.success('Profile updated');
    } catch (error) { toast.error(error.message); }
  }

  async function handleLogout() {
    try { await logoutUser(); } catch (_) {}
    disconnectSocket();
    clearUser();
    window.location.href = '/user-login';
  }

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => !q || `${u.username || ''} ${u.fullPhoneNumber || ''} ${u.about || ''}`.toLowerCase().includes(q));
  }, [users, search]);

  const groupedStatuses = useMemo(() => {
    const map = new Map();
    statuses.forEach((status) => {
      const key = idOf(status.user);
      if (!map.has(key)) map.set(key, { user: status.user, items: [] });
      map.get(key).items.push(status);
    });
    return [...map.values()];
  }, [statuses]);

  return (
    <div className={`whatsapp-shell ${theme === 'dark' ? 'dark' : ''}`}>
      <aside className="icon-rail">
        <button className="profile-icon" onClick={() => setProfileOpen(true)} title="Profile"><img src={avatarOf(currentUser)} alt="Me" /></button>
        <button className={activeTab === 'chats' ? 'rail-active' : ''} onClick={() => setActiveTab('chats')} title="Chats">💬</button>
        <button className={activeTab === 'status' ? 'rail-active' : ''} onClick={() => setActiveTab('status')} title="Status">◉</button>
        <div className="rail-spacer" />
        <button onClick={toggleTheme} title="Theme">{theme === 'dark' ? '☀' : '☾'}</button>
        <button onClick={handleLogout} title="Logout">↪</button>
      </aside>

      <section className={`sidebar-panel ${selectedUser ? 'mobile-hidden' : ''}`}>
        {activeTab === 'chats' ? (
          <>
            <div className="sidebar-header"><h2>Chats</h2><button className="round-button" onClick={loadUsers}>↻</button></div>
            <div className="search-box">⌕<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search or start new chat" /></div>
            <div className="contact-list">
              {filteredUsers.length === 0 && <div className="empty-small">No other verified users yet. Log in with a second number to start chatting.</div>}
              {filteredUsers.map((u) => (
                <button key={u._id} className={`contact-row ${idOf(selectedUser) === idOf(u) ? 'selected' : ''}`} onClick={() => selectUser(u)}>
                  <div className="avatar-wrap"><img src={avatarOf(u)} alt="" />{u.isOnline && <span className="online-dot" />}</div>
                  <div className="contact-main">
                    <div className="contact-top"><strong>{u.username || u.fullPhoneNumber || 'WhatsApp user'}</strong><span>{formatTime(u.conversation?.lastMessage?.createdAt || u.conversation?.updatedAt)}</span></div>
                    <div className="contact-bottom"><span>{messagePreview(u)}</span>{u.unreadCount > 0 && <b>{u.unreadCount}</b>}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="sidebar-header"><h2>Status</h2><button className="round-button" onClick={loadStatuses}>↻</button></div>
            <form className="status-create" onSubmit={handleCreateStatus}>
              <div className="status-me"><img src={avatarOf(currentUser)} alt="Me" /><div><strong>My status</strong><small>Post text, photo or video</small></div></div>
              <textarea value={statusText} onChange={(e) => setStatusText(e.target.value)} placeholder="What's happening?" rows={3} />
              <div className="status-actions"><label className="attach-label">＋ Media<input type="file" accept="image/*,video/*" hidden onChange={(e) => setStatusMedia(e.target.files?.[0] || null)} /></label><button className="primary-mini">Post</button></div>
              {statusMedia && <small className="file-chip">{statusMedia.name}</small>}
            </form>
            <div className="status-list">
              {groupedStatuses.map((group) => (
                <button className="status-row" key={idOf(group.user)} onClick={() => viewStatus(group.items[0])}>
                  <div className="status-ring"><img src={avatarOf(group.user)} alt="" /></div>
                  <div><strong>{idOf(group.user) === idOf(currentUser) ? 'My status' : (group.user?.username || 'User')}</strong><small>{group.items.length} update{group.items.length > 1 ? 's' : ''} · {formatTime(group.items[0].createdAt)}</small></div>
                </button>
              ))}
              {!groupedStatuses.length && <div className="empty-small">No active status updates.</div>}
            </div>
          </>
        )}
      </section>

      <main className={`chat-panel ${selectedUser ? 'mobile-visible' : ''}`}>
        {selectedUser && activeTab === 'chats' ? (
          <>
            <header className="chat-header">
              <button className="mobile-back" onClick={() => setSelectedUser(null)}>←</button>
              <img src={avatarOf(selectedUser)} alt="" />
              <div><strong>{selectedUser.username || selectedUser.fullPhoneNumber}</strong><small>{typing ? 'typing…' : lastSeenText(selectedUser)}</small></div>
              <div className="chat-header-actions"><button title="Search">⌕</button><button title="More">⋮</button></div>
            </header>

            <div className="messages-area">
              <div className="encryption-note">🔒 Messages in this demo are delivered through your own backend and database.</div>
              {messages.map((m) => {
                const mine = idOf(m.sender) === idOf(currentUser);
                const reactions = m.reactions || [];
                return (
                  <div className={`message-line ${mine ? 'mine' : 'theirs'}`} key={m._id}>
                    <div className={`message-bubble ${m.deletedForEveryone ? 'deleted' : ''}`}>
                      {m.deletedForEveryone ? (
                        <em>🚫 This message was deleted</em>
                      ) : (
                        <>
                          {m.contentType === 'image' && m.mediaUrl && <img className="message-media" src={m.mediaUrl} alt="Shared" />}
                          {m.contentType === 'video' && m.mediaUrl && <video className="message-media" src={m.mediaUrl} controls />}
                          {m.content && <div className="message-text">{m.content}</div>}
                        </>
                      )}
                      <div className="message-meta"><span>{formatTime(m.createdAt)}</span>{mine && <span className={m.messageStatus === 'read' ? 'status-read' : ''}>{m.messageStatus === 'sent' ? '✓' : '✓✓'}</span>}</div>
                      {!m.deletedForEveryone && (
                        <div className="message-tools">
                          {['👍', '❤️', '😂'].map((emoji) => <button key={emoji} onClick={() => handleReaction(m._id, emoji)}>{emoji}</button>)}
                          {mine && <button onClick={() => handleDelete(m._id)}>🗑</button>}
                        </div>
                      )}
                      {reactions.length > 0 && <div className="reaction-pill">{reactions.map((r, i) => <span key={`${idOf(r.user)}-${i}`}>{r.emoji}</span>)}</div>}
                    </div>
                  </div>
                );
              })}
              {typing && <div className="typing-bubble"><span /><span /><span /></div>}
              <div ref={messagesEndRef} />
            </div>

            {media && <div className="media-preview-bar"><span>Attachment: {media.name}</span><button onClick={() => setMedia(null)}>×</button></div>}
            <form className="composer" onSubmit={handleSend}>
              <label className="composer-icon" title="Attach photo/video">＋<input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => setMedia(e.target.files?.[0] || null)} /></label>
              <input value={text} onChange={(e) => onTypingChange(e.target.value)} placeholder="Type a message" />
              <button className="send-button" disabled={sending || (!text.trim() && !media)}>{sending ? '…' : '➤'}</button>
            </form>
          </>
        ) : (
          <div className="welcome-pane">
            <div className="welcome-graphic">💬</div>
            <h1>WhatsApp Clone</h1>
            <p>Send and receive messages without keeping your phone connected. Choose a contact to begin.</p>
            <small>🔒 Built as a full-stack learning project.</small>
          </div>
        )}
      </main>

      {openStatus && (
        <div className="modal-backdrop" onClick={() => setOpenStatus(null)}>
          <div className="status-viewer" onClick={(e) => e.stopPropagation()}>
            <div className="status-viewer-head"><div><img src={avatarOf(openStatus.user)} alt="" /><span><strong>{openStatus.user?.username || 'Status'}</strong><small>{formatTime(openStatus.createdAt)}</small></span></div><button onClick={() => setOpenStatus(null)}>×</button></div>
            <div className="status-content">
              {openStatus.contentType === 'image' && <img src={openStatus.mediaUrl} alt="Status" />}
              {openStatus.contentType === 'video' && <video src={openStatus.mediaUrl} controls autoPlay />}
              {openStatus.content && <p>{openStatus.content}</p>}
            </div>
            {idOf(openStatus.user) === idOf(currentUser) && <div className="status-footer"><span>👁 {openStatus.viewers?.length || 0} views</span><button onClick={() => removeStatus(openStatus._id)}>Delete status</button></div>}
          </div>
        </div>
      )}

      {profileOpen && (
        <div className="modal-backdrop" onClick={() => setProfileOpen(false)}>
          <form className="profile-modal" onSubmit={saveProfile} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title"><h3>Profile</h3><button type="button" onClick={() => setProfileOpen(false)}>×</button></div>
            <img className="profile-large" src={profilePhoto ? URL.createObjectURL(profilePhoto) : avatarOf(currentUser)} alt="Profile" />
            <label className="attach-label profile-photo-label">Change photo<input type="file" accept="image/*" hidden onChange={(e) => setProfilePhoto(e.target.files?.[0] || null)} /></label>
            <label>Name<input value={profileName} onChange={(e) => setProfileName(e.target.value)} maxLength={40} /></label>
            <label>About<textarea value={profileAbout} onChange={(e) => setProfileAbout(e.target.value)} maxLength={140} rows={3} /></label>
            <button className="primary-btn">Save profile</button>
          </form>
        </div>
      )}
    </div>
  );
}
