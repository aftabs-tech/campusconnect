import { useState, useEffect, useRef } from 'react';
import API, { getImageUrl } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { FiSend, FiTrash2, FiHeart } from 'react-icons/fi';
import socket from '../api/socket';

const CommentItem = ({ comment, user, onUpdate, onDelete, onLike, getTimeAgo, renderAvatar }) => {
  const [showReplies, setShowReplies] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const replyInputRef = useRef(null);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    try {
      const { data } = await API.post(`/comments/${comment._id}/reply`, { text: replyText });
      onUpdate(data);
      setReplyText('');
      setIsReplying(false);
      setShowReplies(true);
    } catch (err) {
      console.error('Error replying:', err);
    }
  };

  useEffect(() => {
    if (isReplying) replyInputRef.current?.focus();
  }, [isReplying]);

  const isLiked = comment.likes?.includes(user?._id);

  return (
    <div className="comment-item-container">
      <div className="comment-item">
        <div className="comment-avatar">
          {renderAvatar(comment.userId)}
        </div>
        <div className="comment-main">
          <div className="comment-text-row">
            <span className="comment-username">{comment.userId?.name}</span>
            {comment.text}
          </div>
          <div className="comment-actions-row">
            <span>{getTimeAgo(comment.createdAt)}</span>
            {comment.likes?.length > 0 && <span>{comment.likes.length} likes</span>}
            <button className="comment-action-btn" onClick={() => setIsReplying(!isReplying)}>Reply</button>
            {comment.userId?._id === user?._id && (
              <button className="comment-action-btn" onClick={() => onDelete(comment._id)}>Delete</button>
            )}
          </div>
        </div>
        <button className={`comment-like-btn ${isLiked ? 'liked' : ''}`} onClick={() => onLike(comment._id)}>
          <FiHeart fill={isLiked ? 'currentColor' : 'none'} />
        </button>
      </div>

      {isReplying && (
        <div className="reply-input-wrapper">
          <input 
            ref={replyInputRef}
            placeholder={`Reply to ${comment.userId?.name}...`}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleReply()}
          />
          <button className="comment-action-btn" onClick={handleReply} disabled={!replyText.trim()} style={{ color: 'var(--primary)' }}>
            Post
          </button>
        </div>
      )}

      {comment.replies?.length > 0 && (
        <>
          {!showReplies ? (
            <button className="view-replies-btn" onClick={() => setShowReplies(true)}>
              View replies ({comment.replies.length})
            </button>
          ) : (
            <div className="replies-container">
              <button className="view-replies-btn" onClick={() => setShowReplies(false)} style={{ marginBottom: 8 }}>
                Hide replies
              </button>
              {comment.replies.map((reply, i) => (
                <div key={i} className="comment-item">
                  <div className="comment-avatar" style={{ width: 24, height: 24 }}>
                    {renderAvatar(reply.userId)}
                  </div>
                  <div className="comment-main">
                    <div className="comment-text-row" style={{ fontSize: 13 }}>
                      <span className="comment-username">{reply.userId?.name}</span>
                      {reply.text}
                    </div>
                    <div className="comment-actions-row">
                      <span>{getTimeAgo(reply.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const CommentSection = ({ postId, onCommentCountChange }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();

    // Socket real-time integration
    if (!socket.connected) socket.connect();
    socket.emit('joinPost', postId);

    const handleNewComment = (newComment) => {
      const incomingPostId = (newComment.postId?._id || newComment.postId)?.toString();
      if (incomingPostId !== postId.toString()) return;

      setComments((prev) => {
        if (prev.some(c => c._id === newComment._id)) return prev;
        const updated = [newComment, ...prev];
        if (onCommentCountChange) onCommentCountChange(updated.length);
        return updated;
      });
    };

    socket.on('newComment', handleNewComment);

    return () => {
      socket.emit('leavePost', postId);
      socket.off('newComment', handleNewComment);
    };
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
    setText('');
    setSubmitting(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticComment = {
      _id: tempId,
      text: newCommentText,
      userId: user,
      createdAt: new Date().toISOString(),
      likes: [],
      isOptimistic: true,
      replies: []
    };

    setComments(prev => [optimisticComment, ...prev]);

    try {
      const { data } = await API.post('/comments', { postId, text: newCommentText });
      setComments(prevComments => {
        const filtered = prevComments.filter(c => c._id !== tempId);
        if (filtered.some(c => c._id === data._id)) return filtered;
        const updatedComments = [data, ...filtered];
        if (onCommentCountChange) onCommentCountChange(updatedComments.length);
        return updatedComments;
      });
    } catch (err) {
      console.error('Error adding comment:', err);
      setComments(prev => prev.filter(c => c._id !== tempId));
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
      setComments(prev => prev.map(c => 
        c._id === commentId ? { ...c, likes: data } : c
      ));
    } catch (err) {
      console.error('Error liking comment:', err);
    }
  };

  const updateCommentLocally = (updatedComment) => {
    setComments(prev => prev.map(c => 
      c._id === updatedComment._id ? updatedComment : c
    ));
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?';

  const renderAvatar = (u) => {
    if (u?.avatar) {
      return <img src={getImageUrl(u.avatar)} alt={u.name} />;
    }
    return <div className="avatar-placeholder">{getInitials(u?.name)}</div>;
  };

  return (
    <div className="comments-section">
      <div className="comment-input">
        <div className="comment-avatar">
          {renderAvatar(user)}
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Add a comment..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
            disabled={submitting}
          />
          <button 
            className="comment-action-btn" 
            onClick={handleAddComment}
            disabled={submitting || !text.trim()}
            style={{ color: 'var(--primary)', padding: '0 8px' }}
          >
            Post
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div className="spinner" style={{ width: 20, height: 20, margin: '0 auto' }}></div>
        </div>
      ) : (
        <div className="comment-list">
          {comments.map((comment) => (
            <CommentItem 
              key={comment._id}
              comment={comment}
              user={user}
              onUpdate={updateCommentLocally}
              onDelete={handleDeleteComment}
              onLike={handleLikeComment}
              getTimeAgo={getTimeAgo}
              renderAvatar={renderAvatar}
            />
          ))}
          {comments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
               No comments yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
