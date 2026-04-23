import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

function AdminAccess() {
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await API.post('/admin/verify', { secret });
      if (data.success && data.isAdmin) {
        localStorage.setItem('admin_secret', secret);
        localStorage.setItem('isAdmin', 'true');
        navigate('/admin-dashboard');
      }
    } catch (err) {
      console.error('Verify error:', err);
      setError(err.response?.data?.message || 'Invalid secret key');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'var(--bg-main)'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: 400, padding: 40 }}>
        <h2 style={{ marginBottom: 10, textAlign: 'center' }}>Admin Access</h2>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: 30, fontSize: 14 }}>
          Enter the secret key to access the moderation panel.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Secret Key</label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="••••••••"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
            />
          </div>

          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{error}</div>}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: 30 }}
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Access Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminAccess;
