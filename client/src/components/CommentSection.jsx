import { useState, useEffect } from 'react';
import API, { getImageUrl } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { FiSend, FiTrash2, FiHeart } from 'react-icons/fi';

const CommentSection = ({ postId, onCommentCountChange }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    try {
      const { data } = await API.get(`/comments/${postId}`);
      setComments(data);
      if (onCommentCountChange) onCommentCountChange(data.length);
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;

    const newCommentText = text.trim();
    setText(''); // Clear input immediately
    setSubmitting(true);

    try {
      const { data } = await API.post('/comments', { postId, text: newCommentText });
      
      // Update local comments state using functional update to avoid stale closure
      setComments(prevComments => {
        const updatedComments = [data, ...prevComments];
        // Sync the count with parent immediately
        if (onCommentCountChange) onCommentCountChange(updatedComments.length);
        return updatedComments;
      });
    } catch (err) {
      console.error('Error adding comment:', err);
      // Optionally restore text if failed
      setText(newCommentText);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await API.delete(`/comments/${commentId}`);
      setComments(prevComments => {
        const updatedComments = prevComments.filter(c => c._id !== commentId);
        if (onCommentCountChange) onCommentCountChange(updatedComments.length);
        return updatedComments;
      });
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const handleLikeComment = async (commentId) => {
    try {
      const { data } = await API.put(`/comments/${commentId}/like`);
      setComments(comments.map(c => 
        c._id === commentId ? { ...c, likes: data } : c
      ));
    } catch (err) {
      console.error('Error liking comment:', err);
    }
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?';

  const renderAvatar = (u) => {
    if (u?.avatar) {
      return <div className="avatar avatar-sm"><img src={getImageUrl(u.avatar)} alt={u.name} /></div>;
    }
    return <div className="avatar avatar-sm">{getInitials(u?.name)}</div>;
  };

  return (
    <div className="comments-section">
      <div className="comment-input">
        {renderAvatar(user)}
        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Write a comment..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
            disabled={submitting}
          />
          <button 
            className="btn btn-primary btn-sm" 
            onClick={handleAddComment}
            disabled={submitting || !text.trim()}
          >
            <FiSend />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div className="spinner" style={{ width: 20, height: 20, margin: '0 auto' }}></div>
        </div>
      ) : (
        <div className="comment-list" style={{ marginTop: 16 }}>
          {comments.map((comment) => (
            <div key={comment._id} className="comment-item">
              {renderAvatar(comment.userId)}
              <div className="comment-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="name">
                    {comment.userId?.name}
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8, fontWeight: 'normal' }}>
                      {getTimeAgo(comment.createdAt)}
                    </span>
                  </div>
                  {comment.userId?._id === user?._id && (
                    <button 
                      className="btn-icon" 
                      onClick={() => handleDeleteComment(comment._id)}
                      style={{ width: 24, height: 24, fontSize: 12, border: 'none', background: 'transparent' }}
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </div>
                <div className="text">{comment.text}</div>
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
                   <button 
                    onClick={() => handleLikeComment(comment._id)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 4, 
                      fontSize: 11, 
                      color: comment.likes?.includes(user?._id) ? 'var(--danger)' : 'var(--text-muted)',
                      background: 'none'
                    }}
                   >
                     <FiHeart style={{ fill: comment.likes?.includes(user?._id) ? 'currentColor' : 'none' }} />
                     {comment.likes?.length > 0 && comment.likes.length}
                   </button>
                </div>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--text-muted)', fontSize: 12 }}>
              No comments yet. Be the first to comment!
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
