import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { 
  FiFileText, 
  FiDownload, 
  FiTrash2, 
  FiPlus, 
  FiSearch, 
  FiFilter, 
  FiX, 
  FiUploadCloud,
  FiBookOpen,
  FiLayers,
  FiChevronDown
} from 'react-icons/fi';
import CustomSelect from '../components/CustomSelect';


const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'notes', label: '📝 Notes' },
  { value: 'paper', label: '📄 Previous Papers' },
  { value: 'assignment', label: '✍️ Assignments' },
  { value: 'book', label: '📚 Books' },
  { value: 'other', label: '🖇️ Other' }
];

const SEMESTERS = [
  { value: 'all', label: 'All Semesters' },
  { value: 1, label: 'Semester 1' },
  { value: 2, label: 'Semester 2' },
  { value: 3, label: 'Semester 3' },
  { value: 4, label: 'Semester 4' },
  { value: 5, label: 'Semester 5' },
  { value: 6, label: 'Semester 6' },
  { value: 7, label: 'Semester 7' },
  { value: 8, label: 'Semester 8' }
];

function Resources() {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Filters
  const [category, setCategory] = useState('all');
  const [semester, setSemester] = useState('all');
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');

  // Form State
  const [form, setForm] = useState({
    title: '',
    description: '',
    subject: '',
    semester: 1,
    category: 'notes'
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchResources();
  }, [category, semester, search, subject]);

  const fetchResources = async () => {
    setLoading(true);
    try {
      let query = [];
      if (category !== 'all') query.push(`category=${category}`);
      if (semester !== 'all') query.push(`semester=${semester}`);
      if (search) query.push(`search=${search}`);
      if (subject) query.push(`subject=${subject}`);
      
      const queryString = query.length > 0 ? `?${query.join('&')}` : '';
      const { data } = await API.get(`/resources${queryString}`);
      setResources(data);
    } catch (err) {
      console.error('Error fetching resources:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return alert('Please select a file');
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('subject', form.subject);
      formData.append('semester', form.semester);
      formData.append('category', form.category);
      formData.append('file', file);

      const { data } = await API.post('/resources', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setResources([data, ...resources]);
      setShowForm(false);
      setForm({ title: '', description: '', subject: '', semester: 1, category: 'notes' });
      setFile(null);
    } catch (err) {
      console.error('Upload failed:', err);
      alert(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (resource) => {
    try {
      // Increment download count on backend
      await API.patch(`/resources/${resource._id}/download`);
      
      // Update local state
      setResources(resources.map(r => 
        r._id === resource._id ? { ...r, downloads: r.downloads + 1 } : r
      ));

      // Trigger actual download
      // Since it's a relative path on the same server, we can build the full URL
      const downloadUrl = `http://localhost:5000${resource.file}`;
      window.open(downloadUrl, '_blank');
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this resource?')) return;
    try {
      await API.delete(`/resources/${id}`);
      setResources(resources.filter(r => r._id !== id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="resources-container page">
      <header className="resources-header">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Resource Library</h1>
          <p>Share and access study materials, notes, and previous year papers</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><FiX /> Cancel</> : <><FiPlus /> Upload Resource</>}
        </button>
      </header>

      {/* Upload Form */}
      {showForm && (
        <form onSubmit={handleUpload} className="glass-card upload-form" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label>Resource Title</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. Computer Networks Chapter 1 Notes"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            
            <div className="input-group">
              <label>Subject</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. Computer Science"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
              />
            </div>

            <div className="input-group">
              <label>Category</label>
              <CustomSelect 
                options={CATEGORIES.filter(c => c.value !== 'all')}
                value={form.category}
                onChange={(val) => setForm({ ...form, category: val })}
              />
            </div>

            <div className="input-group">
              <label>Semester</label>
              <CustomSelect 
                options={SEMESTERS.filter(s => s.value !== 'all')}
                value={form.semester}
                onChange={(val) => setForm({ ...form, semester: val })}
              />
            </div>


            <div className="input-group">
              <label>File (PDF, Doc, ZIP, etc.)</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="file" 
                  id="resource-file" 
                  style={{ display: 'none' }} 
                  onChange={handleFileSelect}
                  required
                />
                <label htmlFor="resource-file" className="btn btn-secondary btn-full" style={{ justifyContent: 'center' }}>
                  <FiUploadCloud style={{ marginRight: 8 }} />
                  {file ? file.name : 'Choose File'}
                </label>
              </div>
            </div>

            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description (Optional)</label>
              <textarea 
                className="input-field" 
                placeholder="Provide a brief description of the contents..."
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Save Resource'}
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div className="glass-card resource-filters" style={{ padding: 16, marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <FiSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by title..." 
            className="input-field" 
            style={{ paddingLeft: 40 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, flex: 1 }}>
          <div className="filter-group" style={{ flex: 1, minWidth: 160 }}>
            <CustomSelect 
              options={CATEGORIES}
              value={category}
              onChange={setCategory}
              icon={FiLayers}
            />
          </div>

          <div className="filter-group" style={{ flex: 1, minWidth: 160 }}>
            <CustomSelect 
              options={SEMESTERS}
              value={semester}
              onChange={setSemester}
              icon={FiBookOpen}
            />
          </div>
        </div>
      </div>


      {/* Content */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading library...</p>
        </div>
      ) : resources.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📚</div>
          <h3>The library is empty</h3>
          <p>No resources found for the selected filters. Be the first to share one!</p>
        </div>
      ) : (
        <div className="resources-grid">
          {resources.map(res => (
            <div key={res._id} className="glass-card resource-card">
              <div className="resource-icon">
                <FiFileText size={32} />
              </div>
              <div className="resource-details">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="resource-category-badge">{res.category}</span>
                    <h3 className="resource-title">{res.title}</h3>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {res.uploader?._id === user?._id && (
                      <button className="btn-icon danger" onClick={() => handleDelete(res._id)}>
                        <FiTrash2 />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="resource-info">
                  <span><FiLayers size={12} /> {res.subject}</span>
                  <span><FiBookOpen size={12} /> Semester {res.semester}</span>
                </div>

                <p className="resource-desc">{res.description || 'No description provided.'}</p>

                <div className="resource-footer">
                  <div className="uploader-info">
                    <div className="avatar avatar-xs">
                      {res.uploader?.avatar ? <img src={res.uploader.avatar} alt="" /> : res.uploader?.name?.[0]}
                    </div>
                    <span>{res.uploader?.name}</span>
                  </div>
                  <div className="resource-stats">
                    <span>{formatFileSize(res.fileSize)}</span>
                    <span className="dot"></span>
                    <span>{res.downloads} downloads</span>
                  </div>
                </div>

                <button className="btn btn-secondary btn-full" onClick={() => handleDownload(res)}>
                  <FiDownload /> Download Resource
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx="true">{`
        .resources-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
        }
        .resources-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .filter-group {
          position: relative;
          display: flex;
          align-items: center;
        }
        .resources-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }
        .resource-card {
          display: flex;
          padding: 20px;
          gap: 16px;
          transition: transform 0.2s;
        }
        .resource-card:hover {
          transform: translateY(-4px);
        }
        .resource-icon {
          width: 50px;
          height: 50px;
          background: var(--gradient-primary);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }
        .resource-details {
          flex: 1;
        }
        .resource-category-badge {
          display: inline-block;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--primary);
          font-weight: 700;
          margin-bottom: 4px;
        }
        .resource-title {
          font-size: 18px;
          margin-bottom: 8px;
          color: var(--text-primary);
        }
        .resource-info {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 10px;
        }
        .resource-info span {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .resource-desc {
          font-size: 13px;
          color: var(--text-muted);
          margin-bottom: 16px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .resource-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .uploader-info {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
        }
        .resource-stats {
          font-size: 11px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dot {
          width: 3px;
          height: 3px;
          background: currentColor;
          border-radius: 50%;
        }
        .btn-full {
          width: 100%;
        }
        .avatar-xs {
          width: 20px;
          height: 20px;
          font-size: 10px;
        }
        .btn-icon.danger:hover {
          background: rgba(255, 71, 87, 0.1);
          color: #ff4757;
        }
      `}</style>
    </div>
  );
}

export default Resources;
