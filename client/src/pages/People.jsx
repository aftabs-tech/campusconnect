import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API, { getImageUrl } from '../api/axios';
import { FiSearch, FiUserPlus, FiUserCheck, FiClock, FiCheck, FiX, FiMessageCircle } from 'react-icons/fi';

function People() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    fetchUsers();
  }, [authUser?._id]);

  const fetchUsers = async () => {
    try {
      const { data } = await API.get('/users');
      // For each user, we need to know their relationship with us.
      // The /api/users route in the backend doesn't currently populate connections/requests for everyone.
      // But we can check our own user data if we had it, or the server can return relationship status.
      // Let's assume the /api/users returns the current relationship if we modify the backend.
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (targetId) => {
    setActionLoading(prev => ({ ...prev, [targetId]: true }));
    try {
      await API.post(`/users/${targetId}/connect`);
      // Most reliable way to sync state across relationship arrays
      fetchUsers();
    } catch (err) {
      console.error('Error connecting:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [targetId]: false }));
    }
  };

  const handleAccept = async (targetId) => {
    setActionLoading(prev => ({ ...prev, [targetId]: true }));
    try {
      await API.put(`/users/${targetId}/accept-request`);
      // Refresh to get updated connection lists
      fetchUsers();
    } catch (err) {
      console.error('Error accepting:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [targetId]: false }));
    }
  };

  const handleReject = async (targetId) => {
    setActionLoading(prev => ({ ...prev, [targetId]: true }));
    try {
      await API.put(`/users/${targetId}/reject-request`);
      setUsers(users.map(u => 
        u._id === targetId ? { ...u, sentRequests: (u.sentRequests || []).filter(rid => rid !== authUser._id) } : u
      ));
    } catch (err) {
      console.error('Error rejecting:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [targetId]: false }));
    }
  };

  const startChat = async (targetId) => {
    try {
      await API.post('/chats', { userId: targetId });
      navigate('/chat');
    } catch (err) {
      console.error('Error starting chat:', err);
      alert(err.response?.data?.message || 'Chat failed');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.college.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?';

  const renderConnectionButton = (user) => {
    const isConnected = user.connections?.some(c => (c._id || c).toString() === authUser?._id);
    const isRequestSentByMe = user.incomingRequests?.some(rid => (rid._id || rid).toString() === authUser?._id);
    const isRequestReceivedByMe = user.sentRequests?.some(rid => (rid._id || rid).toString() === authUser?._id);
    const isLoading = actionLoading[user._id];

    if (isConnected) {
      return (
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} disabled>
            <FiUserCheck /> Connected
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => startChat(user._id)}>
            <FiMessageCircle />
          </button>
        </div>
      );
    }

    if (isRequestSentByMe) {
      return (
        <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} disabled>
          <FiClock /> Pending
        </button>
      );
    }

    if (isRequestReceivedByMe) {
      return (
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1, background: 'var(--success)' }} 
            onClick={() => handleAccept(user._id)} disabled={isLoading}>
            <FiCheck /> Accept
          </button>
          <button className="btn btn-secondary btn-sm" style={{ flex: 1, color: 'var(--danger)' }} 
            onClick={() => handleReject(user._id)} disabled={isLoading}>
            <FiX />
          </button>
        </div>
      );
    }

    return (
      <button className="btn btn-primary btn-sm" style={{ width: '100%' }} 
        onClick={() => handleConnect(user._id)} disabled={isLoading}>
        <FiUserPlus /> Connect
      </button>
    );
  };

  return (
    <div className="people-container">
      <div className="page-header">
        <h1>Connect with People</h1>
        <p>Expand your college network and find mentors or peers</p>
      </div>

      <div className="search-bar">
        <FiSearch className="search-icon" />
        <input 
          type="text" 
          placeholder="Search by name or college..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="users-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="glass-card user-card">
              <div className="skeleton skeleton-avatar" style={{ margin: '0 auto 12px' }}></div>
              <div className="skeleton skeleton-line short" style={{ margin: '0 auto 8px' }}></div>
              <div className="skeleton skeleton-line medium" style={{ margin: '0 auto' }}></div>
            </div>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="empty-state">
          <div className="icon">👥</div>
          <h3>No people found</h3>
          <p>Try a different search term</p>
        </div>
      ) : (
        <div className="users-grid">
          {filteredUsers.map(user => (
            <div key={user._id} className="glass-card user-card">
              <div className="avatar avatar-lg" style={{ margin: '0 auto 12px', cursor: 'pointer' }} 
                onClick={() => navigate(`/profile/${user._id}`)}>
                {user.avatar ? <img src={getImageUrl(user.avatar)} alt={user.name} /> : getInitials(user.name)}
              </div>
              <div className="name" onClick={() => navigate(`/profile/${user._id}`)} style={{ cursor: 'pointer' }}>
                {user.name}
              </div>
              <div className="college">{user.college}</div>
              <span className={`badge badge-${user.role}`} style={{ marginBottom: 16 }}>{user.role}</span>
              
              <div className="user-card-actions" style={{ marginTop: 'auto', width: '100%' }}>
                {renderConnectionButton(user)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default People;
