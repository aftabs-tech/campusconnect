import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API, { getImageUrl } from '../api/axios';
import { FiCalendar, FiMapPin, FiUsers, FiPlus, FiCheck, FiX, FiImage } from 'react-icons/fi';

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'tech', label: '💻 Tech' },
  { value: 'cultural', label: '🎭 Cultural' },
  { value: 'sports', label: '⚽ Sports' },
  { value: 'workshop', label: '🔧 Workshop' },
  { value: 'seminar', label: '📚 Seminar' },
  { value: 'other', label: '📌 Other' }
];

const CATEGORY_EMOJIS = {
  tech: '💻',
  cultural: '🎭',
  sports: '⚽',
  workshop: '🔧',
  seminar: '📚',
  other: '📌'
};

function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    college: '',
    category: 'other'
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [filter]);

  const fetchEvents = async () => {
    try {
      const params = filter !== 'all' ? `?category=${filter}` : '';
      const { data } = await API.get(`/events${params}`);
      setEvents(data);
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('date', form.date);
      formData.append('location', form.location);
      formData.append('college', form.college || user?.college);
      formData.append('category', form.category);
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const { data } = await API.post('/events', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setEvents([data, ...events]);
      setShowForm(false);
      setForm({ title: '', description: '', date: '', location: '', college: '', category: 'other' });
      setImageFile(null);
      setImagePreview('');
    } catch (err) {
      console.error('Error creating event:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleAttend = async (eventId) => {
    try {
      const { data } = await API.put(`/events/${eventId}/attend`);
      setEvents(events.map(e =>
        e._id === eventId ? { ...e, attendees: data.attendees } : e
      ));
    } catch (err) {
      console.error('Error toggling attendance:', err);
    }
  };

  const handleDelete = async (eventId) => {
    try {
      await API.delete(`/events/${eventId}`);
      setEvents(events.filter(e => e._id !== eventId));
    } catch (err) {
      console.error('Error deleting event:', err);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return (
    <div className="events-container">
      <div className="page-header"><h1>Events</h1><p>Discover campus events hosted by juniors & seniors</p></div>
      <div className="events-grid">
        {[1,2,3,4].map(i => (
          <div key={i} className="glass-card" style={{ overflow: 'hidden' }}>
            <div className="skeleton" style={{ height: 140, borderRadius: 0 }}></div>
            <div style={{ padding: 20 }}>
              <div className="skeleton skeleton-line medium"></div>
              <div className="skeleton skeleton-line long"></div>
              <div className="skeleton skeleton-line short"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="events-container">
      <div className="events-header">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Events</h1>
          <p>Discover campus events hosted by juniors & seniors</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} id="create-event-btn">
          {showForm ? <><FiX /> Cancel</> : <><FiPlus /> Create Event</>}
        </button>
      </div>

      {/* Create Event Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label>Event Title</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Hackathon 2024"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                id="event-title-input"
              />
            </div>

            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <textarea
                className="input-field"
                placeholder="Describe your event..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                rows={3}
                id="event-description-input"
              />
            </div>

            <div className="input-group">
              <label>Date & Time</label>
              <input
                type="datetime-local"
                className="input-field"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                min={new Date().toISOString().slice(0, 16)}
                required
                id="event-date-input"
              />
            </div>

            <div className="input-group">
              <label>Category</label>
              <select
                className="input-field"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                id="event-category-input"
              >
                {CATEGORIES.filter(c => c.value !== 'all').map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Location</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Main Auditorium"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
                id="event-location-input"
              />
            </div>

            <div className="input-group">
              <label>College</label>
              <input
                type="text"
                className="input-field"
                placeholder={user?.college || 'College name'}
                value={form.college}
                onChange={(e) => setForm({ ...form, college: e.target.value })}
                id="event-college-input"
              />
            </div>

            {/* Image Upload */}
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label>Event Poster / Image</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <label htmlFor="event-image-upload" style={{ cursor: 'pointer', flexShrink: 0 }}>
                  <div className="btn btn-secondary" style={{ pointerEvents: 'none' }}>
                    <FiImage /> {imageFile ? 'Change Image' : 'Upload Image'}
                  </div>
                </label>
                <input
                  type="file"
                  id="event-image-upload"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
                {imagePreview && (
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', maxHeight: 120, flex: 1 }}>
                    <img src={imagePreview} alt="Event preview" style={{ width: '100%', objectFit: 'cover', maxHeight: 120 }} />
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(''); }}
                      style={{
                        position: 'absolute', top: 6, right: 6, width: 24, height: 24,
                        borderRadius: '50%', background: 'rgba(0,0,0,0.7)', color: '#fff',
                        border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex',
                        alignItems: 'center', justifyContent: 'center'
                      }}
                    >✕</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={creating} id="event-submit">
              {creating ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="events-filters" style={{ marginBottom: 24 }}>
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            className={`filter-btn ${filter === c.value ? 'active' : ''}`}
            onClick={() => setFilter(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Events Grid */}
      {events.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📅</div>
          <h3>No events found</h3>
          <p>Be the first to create one!</p>
        </div>
      ) : (
        <div className="events-grid">
          {events.map(event => {
            const isAttending = event.attendees?.includes(user?._id);
            const isOrganizer = event.organizer?._id === user?._id;
            const isPast = new Date(event.date) < new Date();

            return (
              <div key={event._id} className="glass-card event-card">
                <div className="event-card-image" style={{
                  background: event.image ? 'none' : (isPast
                    ? 'linear-gradient(135deg, #333 0%, #555 100%)'
                    : 'var(--gradient-primary)'),
                  opacity: isPast ? 0.7 : 1
                }}>
                  {event.image ? (
                    <img src={getImageUrl(event.image)} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 48 }}>{CATEGORY_EMOJIS[event.category] || '📌'}</span>
                  )}
                  <span className="badge badge-category category-label">{event.category}</span>
                </div>

                <div className="event-card-body">
                  <h3>{event.title}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {event.description}
                  </p>

                  <div className="event-meta">
                    <div className="event-meta-item">
                      <FiCalendar className="icon" />
                      {formatDate(event.date)}
                    </div>
                    <div className="event-meta-item">
                      <FiMapPin className="icon" />
                      {event.location}
                    </div>
                    <div className="event-meta-item">
                      <FiUsers className="icon" />
                      {event.attendees?.length || 0} attending
                    </div>
                  </div>

                  <div className="event-card-footer">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      By {event.organizer?.name}
                      <span className={`badge badge-${event.organizer?.role}`} style={{ marginLeft: 6, fontSize: 9 }}>
                        {event.organizer?.role}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isOrganizer && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(event._id)}>
                          <FiX />
                        </button>
                      )}
                      {!isPast && (
                        <button
                          className={`btn btn-sm ${isAttending ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={() => handleAttend(event._id)}
                        >
                          <FiCheck /> {isAttending ? 'Going' : 'Attend'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Events;
