import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncUser = async () => {
      const stored = localStorage.getItem('campusconnect_user');
      if (stored) {
        try {
          const localUser = JSON.parse(stored);
          setUser(localUser);
          
          // Sync with server to get fresh profile (including Cloudinary URLs)
          const { data } = await API.get('/users/me');
          // Merge server data with local token
          const merged = { ...localUser, ...data };
          localStorage.setItem('campusconnect_user', JSON.stringify(merged));
          setUser(merged);
        } catch (err) {
          console.error('Session sync failed:', err);
          // If 401, logout
          if (err.response?.status === 401) {
            logout();
          }
        }
      }
      setLoading(false);
    };
    syncUser();
  }, []);

  const login = async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password });
    localStorage.setItem('campusconnect_user', JSON.stringify(data));
    setUser(data);
    return data;
  };

  const signup = async (userData) => {
    const { data } = await API.post('/auth/signup', userData);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('campusconnect_user');
    setUser(null);
  };

  const updateUser = (updatedData) => {
    setUser(prev => {
      const merged = { ...prev, ...updatedData };
      localStorage.setItem('campusconnect_user', JSON.stringify(merged));
      return merged;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
