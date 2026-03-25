import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { 
  FiPlus, 
  FiSearch, 
  FiShoppingBag, 
  FiTag, 
  FiX, 
  FiLayers
} from 'react-icons/fi';
import CustomSelect from '../components/CustomSelect';
import CreateListingModal from '../components/marketplace/CreateListingModal';
import ListingCard from '../components/marketplace/ListingCard';

const CATEGORIES = [
  { value: 'All', label: '🛍️ All Items' },
  { value: 'Books', label: '📚 Books' },
  { value: 'Cycles', label: '🚲 Cycles' },
  { value: 'Lab Kits', label: '🔬 Lab Kits' },
  { value: 'Electronics', label: '💻 Electronics' },
  { value: 'Others', label: '🖇️ Others' }
];

function Marketplace() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState('');
  const searchTimer = useRef(null);

  useEffect(() => {
    fetchListings();
  }, [category]);

  const fetchListings = async (query = search) => {
    try {
      setLoading(true);
      const queryString = query ? `?category=${category}&search=${encodeURIComponent(query)}` : `?category=${category}`;
      const { data } = await API.get(`/listings${queryString}`);
      setListings(data);
    } catch (err) {
      setError('Failed to fetch listings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchListings(val);
    }, 400);
  };

  return (
    <div className="resources-container page">
      <header className="resources-header">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="flex items-center gap-2">
            <FiShoppingBag className="text-primary-500" />
            Campus Marketplace
          </h1>
          <p>Buy and sell items within the campus community</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <FiPlus /> Post an Item
        </button>
      </header>

      {/* Filter Bar - Matching Resources UI */}
      <div className="glass-card resource-filters" style={{ padding: 16, marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <FiSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search for books, cycles, electronics..." 
            className="input-field" 
            style={{ paddingLeft: 40 }}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            id="marketplace-search"
          />
        </div>

        <div className="filter-group" style={{ width: 220 }}>
          <CustomSelect 
            options={CATEGORIES}
            value={category}
            onChange={setCategory}
            icon={FiLayers}
          />
        </div>
      </div>

      <div className="marketplace-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading items...</p>
          </div>
        ) : listings.length === 0 ? (
          <div className="empty-state glass-card">
            <div className="icon">🛍️</div>
            <h3>No items found</h3>
            <p>Be the first to list something in this category!</p>
          </div>
        ) : (
          <div className="resources-grid">
            {listings.map(listing => (
              <ListingCard key={listing._id} listing={listing} />
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateListingModal 
          isOpen={showCreateModal} 
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchListings}
        />
      )}
    </div>
  );
}

export default Marketplace;
