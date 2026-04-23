import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API, { getImageUrl } from '../api/axios';
import { FiTrash2, FiUser, FiFileText, FiFolder, FiCalendar, FiLogOut } from 'react-icons/fi';

function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ posts: [], resources: [], events: [], folders: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const navigate = useNavigate();
  
  const adminSecret = localStorage.getItem('admin_secret');
  const isAdmin = localStorage.getItem('isAdmin');

  const getHeaders = useCallback(() => {
    return { headers: { 'x-admin-secret': adminSecret } };
  }, [adminSecret]);

  useEffect(() => {
    if (!isAdmin || !adminSecret) {
      navigate('/admin-access');
      return;
    }
    fetchData();
  }, [adminSecret, isAdmin, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('Admin: Fetching data...');
      const [usersRes, statsRes] = await Promise.all([
        API.get('/admin/users', getHeaders()),
        API.get('/admin/stats', getHeaders())
      ]);
      
      setUsers(usersRes.data);
      setStats(statsRes.data);
      console.log('Admin: Data fetch success', { 
        users: usersRes.data.length, 
        stats: Object.keys(statsRes.data).map(k => `${k}: ${statsRes.data[k].length}`) 
      });
    } catch (err) {
      console.error('Admin: Fetch data failed', err);
      if (err.response?.status === 403) {
        localStorage.removeItem('admin_secret');
        localStorage.removeItem('isAdmin');
        navigate('/admin-access');
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (type, id) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;
    try {
      await API.delete(`/admin/${type}s/${id}`, getHeaders());
      if (type === 'user') setUsers(users.filter(u => u._id !== id));
      else if (type === 'post') setStats({ ...stats, posts: stats.posts.filter(p => p._id !== id) });
      else if (type === 'resource') setStats({ ...stats, resources: stats.resources.filter(r => r._id !== id) });
      else if (type === 'event') setStats({ ...stats, events: stats.events.filter(e => e._id !== id) });
      else if (type === 'folder') setStats({ ...stats, folders: stats.folders.filter(f => f._id !== id) });
    } catch (err) {
      console.error(`Admin: Delete ${type} failed`, err);
      alert('Delete failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_secret');
    localStorage.removeItem('isAdmin');
    navigate('/admin-access');
  };

  if (loading) {
    return (
      <div className="loader" style={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: 20, color: 'var(--text-muted)' }}>Loading administrative data...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 20px', maxWidth: 1210, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
        <div>
          <h1 style={{ fontSize: 32 }}>Admin Dashboard</h1>
          <p style={{ color: 'var(--text-muted)' }}>Global Moderation Panel for CampusConnect</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
           <button className="btn btn-secondary" onClick={fetchData}>Refresh Data</button>
           <button className="btn btn-secondary" onClick={handleLogout}>
            <FiLogOut /> Logout
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 30, flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('users')}>
          <FiUser /> Users ({users.length})
        </button>
        <button className={`btn btn-sm ${activeTab === 'posts' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('posts')}>
          <FiFileText /> Posts ({stats.posts?.length || 0})
        </button>
        <button className={`btn btn-sm ${activeTab === 'events' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('events')}>
          <FiCalendar /> Events ({stats.events?.length || 0})
        </button>
        <button className={`btn btn-sm ${activeTab === 'folders' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('folders')}>
          <FiFolder /> Folders ({stats.folders?.length || 0})
        </button>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: 13, textTransform: 'uppercase' }}>
            <tr>
              <th style={{ padding: '15px 20px' }}>Details</th>
              {activeTab === 'users' ? (
                <>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                </>
              ) : activeTab === 'folders' ? (
                <>
                  <th>Subject</th>
                  <th>Year/Sem</th>
                  <th>Actions</th>
                </>
              ) : (
                <>
                  <th>Creator/Author</th>
                  <th>Created</th>
                </>
              )}
              <th style={{ padding: '15px 20px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeTab === 'users' && users.map(u => (
              <tr key={u._id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '15px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="avatar avatar-sm">
                      {u.avatar ? <img src={getImageUrl(u.avatar)} alt="" /> : u.name?.[0]}
                    </div>
                    <span style={{ fontWeight: 600 }}>{u.name}</span>
                  </div>
                </td>
                <td>{u.email}</td>
                <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                  <button className="btn-icon" onClick={() => deleteItem('user', u._id)} style={{ color: 'var(--danger)' }}><FiTrash2 /></button>
                </td>
              </tr>
            ))}

            {activeTab === 'posts' && stats.posts?.map(p => (
              <tr key={p._id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '15px 20px' }}>
                  <div style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.content}
                  </div>
                </td>
                <td>{p.author?.name}</td>
                <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                  <button className="btn-icon" onClick={() => deleteItem('post', p._id)} style={{ color: 'var(--danger)' }}><FiTrash2 /></button>
                </td>
              </tr>
            ))}

            {activeTab === 'events' && stats.events?.map(e => (
              <tr key={e._id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '15px 20px' }}>
                  <div style={{ fontWeight: 600 }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(e.date).toDateString()}</div>
                </td>
                <td>{e.organizer?.name}</td>
                <td>{new Date(e.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                  <button className="btn-icon" onClick={() => deleteItem('event', e._id)} style={{ color: 'var(--danger)' }}><FiTrash2 /></button>
                </td>
              </tr>
            ))}

            {activeTab === 'folders' && stats.folders?.map(f => (
              <tr key={f._id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '15px 20px' }}>
                  <div style={{ fontWeight: 600 }}>{f.name || f.subject}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.course}</div>
                </td>
                <td>{f.subject}</td>
                <td>{f.year} Year / {f.semester} Sem</td>
                <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                  <button className="btn-icon" onClick={() => deleteItem('folder', f._id)} style={{ color: 'var(--danger)' }}><FiTrash2 /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {((activeTab === 'users' ? users : stats[activeTab])?.length || 0) === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No {activeTab} found.
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
