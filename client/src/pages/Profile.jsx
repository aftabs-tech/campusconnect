import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API, { getImageUrl } from '../api/axios';
import { FiEdit2, FiMessageCircle, FiMapPin, FiCamera, FiUserPlus, FiUserCheck, FiUserX, FiClock, FiCheck, FiX, FiBookmark } from 'react-icons/fi';

function Profile() {
  const { id } = useParams();
  const { user: authUser, updateUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [savedPosts, setSavedPosts] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const isOwnProfile = !id || id === authUser?._id;

  useEffect(() => {
    fetchProfile();
  }, [id, authUser?._id]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      let profileData;
      if (isOwnProfile) {
        const { data } = await API.get('/users/me');
        profileData = data;
      } else {
        const { data } = await API.get(`/users/${id}`);
        profileData = data;
      }
      setProfile(profileData);
      setEditForm({
        name: profileData.name || '',
        bio: profileData.bio || '',
        college: profileData.college || '',
        year: profileData.year || 1,
        skills: profileData.skills?.join(', ') || ''
      });
      setAvatarPreview(profileData.avatar || '');

      // Fetch user's posts
      const userId = isOwnProfile ? authUser?._id : id;
      const { data: postsData } = await API.get(`/posts/user/${userId}`);
      setPosts(postsData);
      
      // If own profile, fetch saved posts too
      if (isOwnProfile) {
        fetchSavedPosts();
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedPosts = async () => {
    setLoadingSaved(true);
    try {
      const { data } = await API.get('/posts/saved');
      setSavedPosts(data);
    } catch (err) {
      console.error('Error fetching saved posts:', err);
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      await API.post(`/users/${id}/connect`);
      // Update local state
      setProfile({
        ...profile,
        incomingRequests: [...(profile.incomingRequests || []), authUser._id]
      });
    } catch (err) {
      console.error('Error connecting:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      await API.put(`/users/${id}/accept-request`);
      // Refresh profile to update connections
      fetchProfile();
    } catch (err) {
      console.error('Error accepting:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      await API.put(`/users/${id}/reject-request`);
      setProfile({
        ...profile,
        sentRequests: (profile.sentRequests || []).filter(rid => rid !== authUser._id)
      });
    } catch (err) {
      console.error('Error rejecting:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await API.delete(`/users/${id}/cancel-request`);
      setProfile({
        ...profile,
        incomingRequests: (profile.incomingRequests || []).filter(rid => rid !== authUser._id)
      });
    } catch (err) {
      console.error('Error cancelling:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect?')) return;
    setActionLoading(true);
    try {
      await API.delete(`/users/${id}/disconnect`);
      fetchProfile();
    } catch (err) {
      console.error('Error disconnecting:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', editForm.name);
      formData.append('bio', editForm.bio || '');
      formData.append('college', editForm.college);
      formData.append('year', editForm.year);
      
      const skillsArray = editForm.skills 
        ? editForm.skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      formData.append('skills', JSON.stringify(skillsArray));

      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const { data } = await API.put('/users/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setProfile(data);
      if (isOwnProfile) {
        updateUser(data);
      }
      setAvatarFile(null);
      setEditing(false);
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Error updating profile:', err);
      const errMsg = err.response?.data?.message || err.message;
      alert(`Failed to save changes: ${errMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const startChat = async () => {
    try {
      await API.post('/chats', { userId: id });
      navigate('/chat');
    } catch (err) {
      console.error('Error starting chat:', err);
    }
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?';

  const renderAvatar = (u, sizeClass = 'avatar-xl') => {
    const imgSrc = getImageUrl(u?.avatar);
    if (imgSrc) {
      return (
        <div className={`avatar ${sizeClass}`} style={{ margin: '0 auto' }}>
          <img src={imgSrc} alt={u.name} />
        </div>
      );
    }
    return <div className={`avatar ${sizeClass}`} style={{ margin: '0 auto' }}>{getInitials(u?.name)}</div>;
  };

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Connection State Logic
  const isConnected = profile?.connections?.some(c => (c._id || c) === authUser?._id);
  const isRequestSentByMe = profile?.incomingRequests?.includes(authUser?._id);
  const isRequestReceivedByMe = profile?.sentRequests?.includes(authUser?._id);

  const renderConnectionButton = () => {
    if (isOwnProfile) {
      return (
        <button className="btn btn-secondary" onClick={() => setEditing(true)} id="edit-profile-btn">
          <FiEdit2 /> Edit Profile
        </button>
      );
    }

    if (isConnected) {
      return (
        <button className="btn btn-secondary" onClick={handleDisconnect} disabled={actionLoading}>
          <FiUserCheck /> Connected
        </button>
      );
    }

    if (isRequestSentByMe) {
      return (
        <button className="btn btn-secondary" onClick={handleCancel} disabled={actionLoading}>
          <FiClock /> Pending (Cancel)
        </button>
      );
    }

    if (isRequestReceivedByMe) {
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={handleAccept} disabled={actionLoading} style={{ background: 'var(--success)' }}>
            <FiCheck /> Accept
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleReject} disabled={actionLoading} style={{ color: 'var(--danger)' }}>
            <FiX /> Reject
          </button>
        </div>
      );
    }

    return (
      <button className="btn btn-primary" onClick={handleConnect} disabled={actionLoading}>
        <FiUserPlus /> Connect
      </button>
    );
  };

  if (loading) return (
    <div className="profile-container">
      <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
        <div className="skeleton skeleton-avatar" style={{ width: 100, height: 100, margin: '0 auto' }}></div>
        <div className="skeleton skeleton-line medium" style={{ margin: '16px auto 8px', maxWidth: 200 }}></div>
        <div className="skeleton skeleton-line short" style={{ margin: '0 auto', maxWidth: 150 }}></div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 30, marginTop: 24 }}>
          <div className="skeleton" style={{ width: 60, height: 40, borderRadius: 8 }}></div>
          <div className="skeleton" style={{ width: 60, height: 40, borderRadius: 8 }}></div>
        </div>
      </div>
    </div>
  );
  if (!profile) return <div className="empty-state"><h3>User not found</h3></div>;

  return (
    <div className="profile-container">
      {/* Profile Header */}
      <div className="glass-card profile-header-card">
        <div className="profile-header-content">
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {renderAvatar(profile)}
            {isOwnProfile && (
              <label htmlFor="profile-avatar-upload" style={{
                position: 'absolute', bottom: 4, right: 4, width: 32, height: 32,
                borderRadius: '50%', background: 'var(--primary)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                border: '3px solid var(--bg-secondary)', color: 'white', fontSize: 14
              }}>
                <FiCamera />
                <input
                  type="file"
                  id="profile-avatar-upload"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </div>
          <h2 className="profile-name">{profile.name}</h2>
          {/* Dynamic Seniority Badge */}
          {!isOwnProfile && authUser && profile.year && (
            <div style={{ marginBottom: 12 }}>
              {profile.year > authUser.year ? (
                <span className="badge badge-senior">Senior</span>
              ) : profile.year < authUser.year ? (
                <span className="badge badge-junior">Junior</span>
              ) : (
                <span className="badge badge-peer">Peer</span>
              )}
            </div>
          )}
          {isOwnProfile && <span className="badge badge-peer" style={{ marginBottom: 12 }}>You</span>}
          <p className="profile-college">
            <FiMapPin style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {profile.college}
            {profile.year && <> · Year {profile.year}</>}
          </p>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}

          {profile.skills?.length > 0 && (
            <div className="profile-skills">
              {profile.skills.map((skill, i) => (
                <span key={i} className="skill-tag">{skill}</span>
              ))}
            </div>
          )}

          <div className="profile-stats">
            <div className="profile-stat">
              <div className="number">{posts.length}</div>
              <div className="label">Posts</div>
            </div>
            <div className="profile-stat">
              <div className="number">{profile.connections?.length || 0}</div>
              <div className="label">Connections</div>
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
            {renderConnectionButton()}
            {isConnected && !isOwnProfile && (
              <button className="btn btn-secondary" onClick={startChat}>
                <FiMessageCircle /> Send Message
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      {isOwnProfile && (
        <div style={{ display: 'flex', gap: 20, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
          <button 
            onClick={() => setActiveTab('posts')}
            style={{ 
              padding: '10px 20px', background: 'none', border: 'none', 
              color: activeTab === 'posts' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'posts' ? '2px solid var(--primary)' : 'none',
              fontWeight: 600, cursor: 'pointer'
            }}
          >
            My Posts
          </button>
          <button 
            onClick={() => setActiveTab('saved')}
            style={{ 
              padding: '10px 20px', background: 'none', border: 'none', 
              color: activeTab === 'saved' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'saved' ? '2px solid var(--primary)' : 'none',
              fontWeight: 600, cursor: 'pointer'
            }}
          >
            Saved Posts
          </button>
        </div>
      )}

      {/* User's Posts / Saved Posts */}
      <div className="profile-section">
        {activeTab === 'posts' ? (
          <>
            <h3>Posts</h3>
            {posts.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}>
                <p>No posts yet</p>
              </div>
            ) : (
              posts.map(post => (
                <div key={post._id} className="glass-card post-card" style={{ marginBottom: 16 }}>
                  <div className="post-content">{post.content}</div>
                  {post.image && (
                    <div className="post-image" style={{ marginTop: 12 }}>
                      <img src={getImageUrl(post.image)} alt="Post" />
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    {timeAgo(post.createdAt)} · ❤️ {post.likes?.length || 0} · 💬 {post.comments?.length || 0}
                  </div>
                </div>
              ))
            )}
          </>
        ) : (
          <>
            <h3>Saved Posts</h3>
            {loadingSaved ? (
              <div className="loader"><div className="spinner"></div></div>
            ) : savedPosts.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}>
                <FiBookmark style={{ fontSize: 40, opacity: 0.3, marginBottom: 10 }} />
                <p>No saved posts yet</p>
              </div>
            ) : (
              savedPosts.map(post => {
                if (!post) return null; // Handle potential broken refs
                return (
                  <div key={post._id} className="glass-card post-card" style={{ marginBottom: 16, borderLeft: '4px solid var(--primary)' }}>
                     <div className="post-header" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar avatar-sm" style={{ width: 32, height: 32 }}>
                          {post.author?.avatar ? <img src={getImageUrl(post.author.avatar)} alt="" /> : getInitials(post.author?.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{post.author?.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{post.author?.college}</div>
                        </div>
                     </div>
                    <div className="post-content">{post.content}</div>
                    {post.image && (
                      <div className="post-image" style={{ marginTop: 12 }}>
                        <img src={getImageUrl(post.image)} alt="Post" />
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{timeAgo(post.createdAt)} · ❤️ {post.likes?.length || 0} · 💬 {post.comments?.length || 0}</span>
                      <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <FiBookmark style={{ fill: 'var(--primary)' }} /> Saved
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Edit Profile Modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Profile</h2>

            {/* Avatar Upload in Modal */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                {avatarPreview ? (
                  <div className="avatar avatar-lg" style={{ margin: '0 auto' }}>
                    <img src={avatarPreview} alt="Avatar preview" />
                  </div>
                ) : (
                  <div className="avatar avatar-lg" style={{ margin: '0 auto' }}>
                    {getInitials(editForm.name)}
                  </div>
                )}
                <label htmlFor="edit-avatar-upload" style={{
                  position: 'absolute', bottom: 0, right: 0, width: 28, height: 28,
                  borderRadius: '50%', background: 'var(--primary)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  border: '2px solid var(--bg-secondary)', color: 'white', fontSize: 12
                }}>
                  <FiCamera />
                  <input
                    type="file"
                    id="edit-avatar-upload"
                    accept="image/*"
                    onChange={handleAvatarSelect}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Click camera to change photo</p>
            </div>

            <div className="input-group">
              <label>Name</label>
              <input
                type="text"
                className="input-field"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>Bio</label>
              <textarea
                className="input-field"
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                placeholder="Tell others about yourself..."
                rows={3}
              />
            </div>

            <div className="input-group">
              <label>College</label>
              <input
                type="text"
                className="input-field"
                value={editForm.college}
                onChange={(e) => setEditForm({ ...editForm, college: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>Year</label>
              <select
                className="input-field"
                value={editForm.year}
                onChange={(e) => setEditForm({ ...editForm, year: parseInt(e.target.value) })}
              >
                <option value={1}>1st Year</option>
                <option value={2}>2nd Year</option>
                <option value={3}>3rd Year</option>
                <option value={4}>4th Year</option>
              </select>
            </div>

            <div className="input-group">
              <label>Skills (comma separated)</label>
              <input
                type="text"
                className="input-field"
                value={editForm.skills}
                onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
                placeholder="React, Node.js, Python..."
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setEditing(false); setAvatarFile(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
