import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

function VerifyOTP() {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  const { updateUser } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      setEmail(emailParam);
    } else {
      navigate('/signup');
    }
  }, [location, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter a 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await API.post('/auth/verify-otp', { email, otp });
      // Update local storage and auth context
      localStorage.setItem('campusconnect_user', JSON.stringify(data));
      // Auth context update
      if (updateUser) {
        updateUser(data);
      }
      navigate('/feed');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setLoading(true);
      const { data } = await API.post('/auth/resend-otp', { email });
      setError('');
      alert(data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Error resending code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="logo">
            <h1>CampusConnect</h1>
            <p>Verification Required</p>
          </div>

          <h2>Verify Your Email</h2>
          <p style={{ textAlign: 'center', marginBottom: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
            We've sent a 6-digit code to <br /> <strong>{email}</strong>
          </p>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Enter 6-digit OTP</label>
              <input
                type="text"
                className="input-field"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 'bold' }}
                required
                id="otp-input"
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading || otp.length !== 6} id="verify-submit">
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </form>

          <div className="auth-link">
            Didn't receive a code? 
            <button onClick={handleResend} disabled={loading} style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontWeight: 600, padding: 0, marginLeft: 5 }}>
              Resend
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyOTP;
