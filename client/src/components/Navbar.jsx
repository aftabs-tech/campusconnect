import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiHome, FiMessageCircle, FiCalendar, FiUser, FiLogOut, FiSun, FiMoon, FiBell, FiBookOpen, FiUsers } from 'react-icons/fi';

import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import API, { BASE_URL } from '../api/axios';

const SOCKET_URL = BASE_URL;

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('campusconnect_theme') || 'dark';
  });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Init socket
      socketRef.current = io(SOCKET_URL);
      socketRef.current.emit('joinUser', user._id);

      socketRef.current.on('newNotification', (notification) => {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
      });

      return () => {
        socketRef.current?.disconnect();
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const { data } = await API.get('/notifications?limit=10');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const markAsRead = async (id) => {
    try {
      await API.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await API.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('campusconnect_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>CampusConnect</h1>
        <span>Junior × Senior Network</span>
      </div>

      <nav className="nav-links">
        <NavLink to="/feed" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FiHome className="icon" />
          <span>Feed</span>
        </NavLink>
        <NavLink to="/chat" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FiMessageCircle className="icon" />
          <span>Chat</span>
        </NavLink>
        <NavLink to="/events" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FiCalendar className="icon" />
          <span>Events</span>
        </NavLink>
        <NavLink to="/resources" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FiBookOpen className="icon" />
          <span>Resources</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FiUser className="icon" />
          <span>Profile</span>
        </NavLink>

        <div className="nav-link notification-trigger" 
          onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) fetchNotifications(); }}
          style={{ cursor: 'pointer', position: 'relative' }}>
          <FiBell className="icon" />
          <span>Notifications</span>
          {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
          
          {showNotifications && (
            <div className="notification-dropdown glass-card" onClick={(e) => e.stopPropagation()}>
              <div className="dropdown-header">
                <h3>Notifications</h3>
                {unreadCount > 0 && <button onClick={markAllAsRead}>Mark all as read</button>}
              </div>
              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="empty-notif">No notifications yet</div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif._id} 
                      className={`notification-item ${!notif.read ? 'unread' : ''}`}
                      onClick={() => {
                        if (!notif.read) markAsRead(notif._id);
                        if (notif.link) {
                          navigate(notif.link);
                          setShowNotifications(false);
                        }
                      }}
                    >
                      <div className="avatar avatar-sm">
                        {notif.sender?.avatar ? <img src={notif.sender.avatar} alt="" /> : notif.sender?.name?.[0]}
                      </div>
                      <div className="notif-content">
                        <p>{notif.message}</p>
                        <span className="notif-time">
                          {new Date(notif.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {!notif.read && <div className="unread-dot"></div>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <NavLink to="/people" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FiUsers className="icon" />
          <span>People</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        {/* Theme Toggle */}
        <button className={`theme-toggle ${theme}`} onClick={toggleTheme}>
          {theme === 'dark' ? <FiMoon style={{ fontSize: 16 }} /> : <FiSun style={{ fontSize: 16 }} />}
          <span>{theme === 'dark' ? 'Dark' : 'Light'} Mode</span>
          <div className="toggle-track">
            <div className="toggle-thumb"></div>
          </div>
        </button>

        <div className="sidebar-user" onClick={() => navigate('/profile')}>
          <div className="avatar avatar-sm">
            {user?.avatar ? <img src={user.avatar} alt={user.name} /> : getInitials(user?.name)}
          </div>
          <div className="sidebar-user-info">
            <div className="name">{user?.name}</div>
            <div className="role">{user?.role}</div>
          </div>
          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleLogout(); }} title="Logout"
            style={{ width: 32, height: 32, fontSize: 14 }}>
            <FiLogOut />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Navbar;
