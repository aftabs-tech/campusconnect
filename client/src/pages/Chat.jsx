import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import API, { BASE_URL, getImageUrl } from '../api/axios';
import { io } from 'socket.io-client';
import { FiSend, FiMessageCircle, FiSearch, FiCheck } from 'react-icons/fi';

const SOCKET_URL = BASE_URL;

// Skeleton
function ChatSkeleton() {
  return (
    <div className="chat-layout">
      <div className="chat-sidebar">
        <div className="chat-sidebar-header"><h2>Conversations</h2></div>
        <div style={{ padding: 12 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: 14, alignItems: 'center' }}>
              <div className="skeleton skeleton-avatar"></div>
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-line short"></div>
                <div className="skeleton skeleton-line" style={{ width: '50%', height: 10 }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="chat-main">
        <div className="chat-empty"><FiMessageCircle className="icon" /><p>Select a conversation</p></div>
      </div>
    </div>
  );
}

function Chat() {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const activeChatRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isCurrentlyTypingRef = useRef(false);

  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  // Socket init
  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    fetchChats();

    socketRef.current.on('newMessage', (message) => {
      const currentChat = activeChatRef.current;
      if (!currentChat) return;
      const msgChatId = message.chat?._id || message.chat;
      if (msgChatId !== currentChat._id) return;
      const senderId = message.sender?._id || message.sender;
      if (senderId !== user?._id) {
        setMessages(prev => [...prev, message]);
        // Auto mark as read
        API.put(`/chats/${currentChat._id}/read`).catch(() => {});
      }
    });

    socketRef.current.on('typing', ({ chatId, userName }) => {
      const currentChat = activeChatRef.current;
      if (currentChat && chatId === currentChat._id) {
        setIsTyping(true);
        setTypingUser(userName);
      }
    });

    socketRef.current.on('stopTyping', ({ chatId }) => {
      const currentChat = activeChatRef.current;
      if (currentChat && chatId === currentChat._id) {
        setIsTyping(false);
        setTypingUser('');
      }
    });

    socketRef.current.on('messagesRead', ({ chatId, userId }) => {
      const currentChat = activeChatRef.current;
      if (currentChat && chatId === currentChat._id && userId !== user?._id) {
        setMessages(prev => prev.map(msg => {
          const senderId = msg.sender?._id || msg.sender;
          if (senderId === user?._id) {
            const readBy = msg.readBy || [];
            if (!readBy.includes(userId)) {
              return { ...msg, readBy: [...readBy, userId] };
            }
          }
          return msg;
        }));
      }
    });

    return () => { socketRef.current?.disconnect(); };
  }, []);

  // Join/leave chat
  useEffect(() => {
    if (activeChat) {
      socketRef.current?.emit('joinChat', activeChat._id);
      fetchMessages(activeChat._id);
      setIsTyping(false);
      // Auto-mark message notifications as read for this chat
      API.put(`/notifications/read-chat/${activeChat._id}`).then(() => {
        // Notify Navbar to refresh notification count
        window.dispatchEvent(new Event('notifications-updated'));
      }).catch(() => {});
    }
    return () => {
      if (activeChat) socketRef.current?.emit('leaveChat', activeChat._id);
    };
  }, [activeChat]);

  // Scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const t = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(t);
  }, [messages, scrollToBottom]);


  const fetchChats = async () => {
    try {
      const { data } = await API.get('/chats');
      setChats(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchMessages = async (chatId) => {
    try {
      const { data } = await API.get(`/chats/${chatId}/messages`);
      setMessages(data);
    } catch (err) { console.error(err); }
  };

  const searchUsers = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) { setUsers([]); return; }
    try {
      const { data } = await API.get(`/users?search=${query}`);
      // Only show users who are connected to the current user
      const connections = data.filter(u => 
        u.connections?.some(cid => (cid._id || cid) === user?._id)
      );
      setUsers(connections);
    } catch (err) { console.error(err); }
  };

  const startChat = async (userId) => {
    try {
      const { data } = await API.post('/chats', { userId });
      setActiveChat(data);
      setShowUserSearch(false);
      setSearchQuery('');
      setUsers([]);
      if (!chats.find(c => c._id === data._id)) setChats([data, ...chats]);
    } catch (err) { console.error(err); }
  };

  const toggleUserSelection = (u) => {
    if (selectedUsers.find(curr => curr._id === u._id)) {
      setSelectedUsers(selectedUsers.filter(curr => curr._id !== u._id));
    } else {
      setSelectedUsers([...selectedUsers, u]);
    }
  };

  const createGroupChat = async () => {
    if (!groupName.trim() || selectedUsers.length < 2) return;
    try {
      const { data } = await API.post('/chats/group', {
        name: groupName,
        users: selectedUsers.map(u => u._id)
      });
      setChats([data, ...chats]);
      setActiveChat(data);
      setShowGroupModal(false);
      setGroupName('');
      setSelectedUsers([]);
    } catch (err) { console.error('Error creating group chat:', err); }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (!activeChat) return;

    if (!isCurrentlyTypingRef.current) {
      isCurrentlyTypingRef.current = true;
      socketRef.current?.emit('typing', { chatId: activeChat._id, userName: user?.name });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('stopTyping', { chatId: activeChat._id });
      isCurrentlyTypingRef.current = false;
    }, 1500);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    socketRef.current?.emit('stopTyping', { chatId: activeChat._id });
    isCurrentlyTypingRef.current = false;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    const msgContent = newMessage;
    setNewMessage('');
    try {
      const { data } = await API.post(`/chats/${activeChat._id}/messages`, { content: msgContent });
      setMessages(prev => [...prev, data]);
    } catch (err) {
      console.error(err);
      setNewMessage(msgContent);
    }
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?';
  const getOtherUser = (chat) => chat?.participants?.find(p => p._id !== user?._id);

  const renderAvatar = (u, sizeClass = 'avatar-sm') => {
    if (u?.avatar) return <div className={`avatar ${sizeClass}`}><img src={getImageUrl(u.avatar)} alt={u.name} /></div>;
    return <div className={`avatar ${sizeClass}`}>{getInitials(u?.name)}</div>;
  };

  const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isMessageRead = (msg) => {
    if (!msg.readBy) return false;
    const senderId = msg.sender?._id || msg.sender;
    if (senderId !== user?._id) return false;
    return msg.readBy.length > 1; // >1 because sender is already in readBy
  };

  if (loading) return <ChatSkeleton />;

  const otherUser = activeChat ? getOtherUser(activeChat) : null;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1>Chat</h1><p>Connect with juniors & seniors</p></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowGroupModal(true)} id="new-group-btn">
             Groups
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowUserSearch(!showUserSearch)} id="new-chat-btn">
            <FiMessageCircle /> New Chat
          </button>
        </div>
      </div>

      {showGroupModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={() => setShowGroupModal(false)}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 460, padding: 30 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 20 }}>Create Group Chat</h2>
            <div className="input-group">
              <label>Group Name</label>
              <input type="text" className="input-field" placeholder="Awesome Group"
                value={groupName} onChange={e => setGroupName(e.target.value)} />
            </div>
            
            <div className="input-group" style={{ marginTop: 20 }}>
              <label>Add Members (Search below)</label>
              <div style={{ position: 'relative' }}>
                <FiSearch style={{ position: 'absolute', left: 14, top: 13, color: 'var(--text-muted)' }} />
                <input type="text" className="input-field" placeholder="Search users..."
                  onChange={e => searchUsers(e.target.value)} style={{ paddingLeft: 40 }} />
              </div>
              
              {selectedUsers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {selectedUsers.map(u => (
                    <div key={u._id} className="badge badge-senior" style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 8 }}>
                      {u.name}
                      <span onClick={() => toggleUserSelection(u)} style={{ cursor: 'pointer', fontSize: 14 }}>×</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ maxHeight: 150, overflowY: 'auto', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {users.map(u => {
                  const isSelected = selectedUsers.find(curr => curr._id === u._id);
                  return (
                    <div key={u._id} className={`chat-list-item ${isSelected ? 'active' : ''}`} 
                      onClick={() => toggleUserSelection(u)} style={{ cursor: 'pointer', padding: '8px 12px' }}>
                      {renderAvatar(u, 'avatar-sm')}
                      <div className="info" style={{ marginLeft: 8 }}>
                        <div className="name" style={{ fontSize: 13 }}>{u.name}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 30 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowGroupModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} 
                disabled={!groupName.trim() || selectedUsers.length < 2} onClick={createGroupChat}>
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {showUserSearch && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: 14, top: 13, color: 'var(--text-muted)' }} />
            <input type="text" className="input-field" placeholder="Search users to start a chat..."
              value={searchQuery} onChange={(e) => searchUsers(e.target.value)} style={{ paddingLeft: 40 }} id="user-search-input" />
          </div>
          {users.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {users.map(u => (
                <div key={u._id} className="chat-list-item" onClick={() => startChat(u._id)} style={{ cursor: 'pointer' }}>
                  {renderAvatar(u)}
                  <div className="info">
                    <div className="name">{u.name}</div>
                    <div className="preview">{u.college} · <span className={`badge badge-${u.role}`} style={{ fontSize: 10 }}>{u.role}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="chat-layout">
        <div className="chat-sidebar">
          <div className="chat-sidebar-header"><h2>Conversations</h2></div>
          <div className="chat-list">
            {chats.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}><p style={{ fontSize: 13 }}>No conversations yet</p></div>
            ) : (
              chats.map(chat => {
                if (chat.isGroup) {
                  return (
                    <div key={chat._id} className={`chat-list-item ${activeChat?._id === chat._id ? 'active' : ''}`}
                      onClick={() => setActiveChat(chat)}>
                      <div className="avatar avatar-sm" style={{ background: 'var(--accent)' }}>
                        {chat.groupName[0]}
                      </div>
                      <div className="info">
                        <div className="name">{chat.groupName}</div>
                        <div className="preview">{chat.participants?.length} members</div>
                      </div>
                    </div>
                  );
                }
                const other = getOtherUser(chat);
                return (
                  <div key={chat._id} className={`chat-list-item ${activeChat?._id === chat._id ? 'active' : ''}`}
                    onClick={() => setActiveChat(chat)}>
                    {renderAvatar(other)}
                    <div className="info">
                      <div className="name">{other?.name || 'Unknown'}</div>
                      <div className="preview">{other?.role} · {other?.college}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="chat-main">
          {activeChat ? (
            <>
              <div className="chat-main-header">
                {activeChat.isGroup ? (
                   <div className="avatar avatar-sm" style={{ background: 'var(--accent)', width: 42, height: 42, fontSize: 18 }}>
                    {activeChat.groupName[0]}
                  </div>
                ) : (
                  renderAvatar(otherUser)
                )}
                <div className="info">
                  <div className="name" style={{ fontSize: 17, fontWeight: 700 }}>
                    {activeChat.isGroup ? activeChat.groupName : otherUser?.name}
                    {!activeChat.isGroup && <span className={`badge badge-${otherUser?.role}`} style={{ marginLeft: 8, fontSize: 10 }}>{otherUser?.role}</span>}
                  </div>
                  <div className="status">
                    {activeChat.isGroup ? `${activeChat.participants?.length} members` : otherUser?.college}
                  </div>
                </div>
              </div>

              <div className="chat-messages">
                {messages.map((msg, i) => {
                  const senderId = msg.sender?._id || msg.sender;
                  const isSent = senderId === user?._id;
                  const senderName = msg.sender?.name || (isSent ? user?.name : otherUser?.name);

                  return (
                    <div key={msg._id || i} className={`message ${isSent ? 'sent' : 'received'}`}>
                      <div>
                        {!isSent && (
                          <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 2, fontWeight: 600 }}>{senderName}</div>
                        )}
                        <div className="message-bubble">{msg.content}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: isSent ? 'flex-end' : 'flex-start' }}>
                          <div className="message-time">{formatTime(msg.createdAt)}</div>
                          {isSent && (
                            <div className="message-status">
                              {isMessageRead(msg) ? (
                                <span className="read" title="Read">
                                  <FiCheck style={{ fontSize: 11 }} /><FiCheck style={{ fontSize: 11, marginLeft: -6 }} />
                                </span>
                              ) : (
                                <span className="delivered" title="Delivered">
                                  <FiCheck style={{ fontSize: 11 }} />
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing Indicator */}
                {isTyping && (
                  <div className="typing-indicator">
                    <div className="typing-dots"><span></span><span></span><span></span></div>
                    {typingUser} is typing...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={sendMessage} className="chat-input">
                <input type="text" placeholder="Type a message..." value={newMessage}
                  onChange={handleTyping} id="chat-message-input" />
                <button type="submit" className="btn btn-primary" id="chat-send-btn"><FiSend /></button>
              </form>
            </>
          ) : (
            <div className="chat-empty"><FiMessageCircle className="icon" /><p>Select a conversation or start a new chat</p></div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Chat;
