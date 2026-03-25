import { useNavigate } from 'react-router-dom';
import { FiMessageCircle, FiTag, FiUser, FiInfo } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

function ListingCard({ listing }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?._id === listing.seller?._id;

  const handleContactSeller = (e) => {
    e.stopPropagation();
    if (isOwner) return;
    navigate(`/chat?userId=${listing.seller._id}&message=Hi, I'm interested in your "${listing.title}" on the Marketplace!`);
  };

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="glass-card resource-card marketplace-card" onClick={() => navigate(`/marketplace/${listing._id}`)} style={{ cursor: 'pointer' }}>
      <div className="resource-icon marketplace-thumb" style={{ width: 100, height: 100, overflow: 'hidden', position: 'relative' }}>
        <img src={listing.images[0]} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <span style={{ 
          position: 'absolute', bottom: 0, left: 0, right: 0, 
          background: 'rgba(108, 99, 255, 0.9)', color: 'white', 
          fontSize: '10px', fontWeight: 'bold', textAlign: 'center', padding: '2px 0' 
        }}>
          ₹{listing.price}
        </span>
      </div>
      
      <div className="resource-details" style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className="resource-category-badge">{listing.category} · {listing.condition}</span>
            <h3 className="resource-title" style={{ fontSize: '16px', margin: '4px 0' }}>{listing.title}</h3>
          </div>
          {isOwner && <span style={{ fontSize: '10px', background: 'var(--primary-glow)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>Your Listing</span>}
        </div>
        
        <p className="resource-desc" style={{ fontSize: '12px', margin: '4px 0 12px' }}>{listing.description.substring(0, 100)}{listing.description.length > 100 ? '...' : ''}</p>
        
        <div className="resource-footer" style={{ marginBottom: 12 }}>
          <div className="uploader-info">
            <div className="avatar avatar-xs" style={{ width: 22, height: 22 }}>
              {listing.seller?.avatar ? <img src={listing.seller.avatar} alt="" /> : <span>{listing.seller?.name?.[0]}</span>}
            </div>
            <span style={{ fontSize: '12px' }}>{listing.seller?.name}</span>
          </div>
          <div className="resource-stats">
            <span style={{ fontSize: '11px' }}>{timeAgo(listing.createdAt)}</span>
          </div>
        </div>

        {!isOwner && (
          <button className="btn btn-secondary btn-full btn-sm" onClick={handleContactSeller} style={{ padding: '6px' }}>
            <FiMessageCircle size={14} /> Contact Seller
          </button>
        )}
      </div>
    </div>
  );
}

export default ListingCard;
