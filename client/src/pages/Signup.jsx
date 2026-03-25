import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Signup() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    college: '',
    role: '',
    year: 1
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.role) {
      setError('Please select your role (Junior or Senior)');
      return;
    }

    setLoading(true);
    try {
      const res = await signup(form);
      if (res?.otp) {
        console.log(`>>> DEVELOPMENT OTP BYPASS: ${res.otp} <<<`);
      }
      navigate(`/verify-otp?email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed. Please try again.');
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
            <p>Join the Campus Network</p>
          </div>

          <h2>Create Account</h2>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Full Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="John Doe"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                id="signup-name"
              />
            </div>

            <div className="input-group">
              <label>Email Address</label>
              <input
                type="email"
                className="input-field"
                placeholder="you@example.com"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                id="signup-email"
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Min. 6 characters"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                id="signup-password"
              />
            </div>

            <div className="input-group">
              <label>College</label>
              <input
                type="text"
                className="input-field"
                placeholder="Your College Name"
                name="college"
                value={form.college}
                onChange={handleChange}
                required
                id="signup-college"
              />
            </div>

            <div className="input-group">
              <label>Year</label>
              <select
                className="input-field"
                name="year"
                value={form.year}
                onChange={handleChange}
                id="signup-year"
              >
                <option value={1}>1st Year</option>
                <option value={2}>2nd Year</option>
                <option value={3}>3rd Year</option>
                <option value={4}>4th Year</option>
              </select>
            </div>

            <div className="input-group">
              <label>I am a</label>
              <div className="role-selector">
                <div
                  className={`role-option ${form.role === 'junior' ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, role: 'junior' })}
                  id="role-junior"
                >
                  <div className="icon">🎓</div>
                  <div className="label">Junior</div>
                  <div className="desc">Learning & growing</div>
                </div>
                <div
                  className={`role-option ${form.role === 'senior' ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, role: 'senior' })}
                  id="role-senior"
                >
                  <div className="icon">🌟</div>
                  <div className="label">Senior</div>
                  <div className="desc">Mentoring & guiding</div>
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} id="signup-submit">
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="auth-link">
            Already have an account?
            <Link to="/login">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;
