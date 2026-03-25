import { useState, useRef } from 'react';
import API from '../../api/axios';
import { FiX, FiPlus, FiShoppingBag, FiTag, FiDollarSign, FiType, FiLayers, FiInfo } from 'react-icons/fi';
import CustomSelect from '../CustomSelect';

const MARKETPLACE_CATEGORIES = [
  { value: 'Books', label: '📚 Books' },
  { value: 'Cycles', label: '🚲 Cycles' },
  { value: 'Lab Kits', label: '🔬 Lab Kits' },
  { value: 'Electronics', label: '💻 Electronics' },
  { value: 'Others', label: '🖇️ Others' }
];

const CONDITIONS = [
  { value: 'New', label: '✨ New' },
  { value: 'Used - Like New', label: '💎 Like New' },
  { value: 'Used - Good', label: '👍 Good' },
  { value: 'Used - Fair', label: '🩹 Fair' }
];

function CreateListingModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: 'Books',
    condition: 'Used - Good'
  });
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const fileInputRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (images.length === 0) {
      setError('Please upload at least one image');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('description', formData.description);
      data.append('price', formData.price);
      data.append('category', formData.category);
      data.append('condition', formData.condition);
      
      images.forEach(image => {
        data.append('images', image);
      });

      await API.post('/listings', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Listing creation error:', err.response?.data || err);
      const msg = err.response?.data?.message || err.message || 'Error creating listing';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content marketplace-modal animate-scale-in" style={{ maxHeight: '95vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className="modal-icon-container">
              <FiShoppingBag className="modal-icon" />
            </div>
            <div>
              <h3>List an Item</h3>
              <p className="text-muted text-sm">Fill in the details for your listing</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><FiX /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body p-6">
          {error && <div className="error-banner mb-6">{error}</div>}

          <div className="listing-form-grid">
            <div className="form-group mb-4">
              <label><FiType className="input-icon" /> Item Title</label>
              <input
                type="text"
                name="title"
                className="input-field"
                placeholder="e.g. Hero Cycle for sale"
                value={formData.title}
                onChange={handleInputChange}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label><FiDollarSign className="input-icon" /> Price (₹)</label>
                <input
                  type="number"
                  name="price"
                  className="input-field"
                  placeholder="500"
                  value={formData.price}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label><FiLayers className="input-icon" /> Category</label>
                <CustomSelect 
                  options={MARKETPLACE_CATEGORIES}
                  value={formData.category}
                  onChange={(val) => setFormData({...formData, category: val})}
                />
              </div>
            </div>

            <div className="form-group mb-4">
              <label><FiInfo className="input-icon" /> Condition</label>
              <CustomSelect 
                options={CONDITIONS}
                value={formData.condition}
                onChange={(val) => setFormData({...formData, condition: val})}
              />
            </div>

            <div className="form-group mb-4">
              <label>Description</label>
              <textarea
                name="description"
                className="input-field"
                style={{ minHeight: 80 }}
                placeholder="Details about your item..."
                value={formData.description}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="image-upload-section">
              <label>Images (up to 5)</label>
              <div className="image-grid">
                {previews.map((p, i) => (
                  <div key={i} className="image-preview" style={{ width: 80, height: 80 }}>
                    <img src={p} alt="" />
                    <button type="button" className="remove-preview-btn" onClick={() => {
                      setImages(images.filter((_, idx) => idx !== i));
                      setPreviews(previews.filter((_, idx) => idx !== i));
                    }}><FiX /></button>
                  </div>
                ))}
                {previews.length < 5 && (
                  <button type="button" className="add-image-btn" style={{ width: 80, height: 80 }} onClick={() => fileInputRef.current.click()}>
                    <FiPlus />
                  </button>
                )}
              </div>
              <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => {
                const files = Array.from(e.target.files);
                setImages([...images, ...files].slice(0, 5));
                const newPreviews = files.map(f => URL.createObjectURL(f));
                setPreviews([...previews, ...newPreviews].slice(0, 5));
              }} />
            </div>
          </div>

          <div className="modal-footer mt-8">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Posting...' : 'List Item Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateListingModal;
