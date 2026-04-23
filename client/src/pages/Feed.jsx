import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import API, { getImageUrl } from '../api/axios';
import { FiMessageCircle, FiSend, FiTrash2, FiImage, FiSearch, FiBarChart2, FiPlus, FiX, FiCheck, FiBookmark } from 'react-icons/fi';
import CommentSection from '../components/CommentSection';


const REACTION_EMOJIS = ['❤️', '🔥', '😂', '👏', '😮', '💡'];

// Skeleton component
function PostSkeleton() {
  return (
    <div className="glass-card skeleton-card">
      <div className="skeleton-header">
        <div className="skeleton skeleton-avatar"></div>
        <div className="skeleton-text-block">
          <div className="skeleton skeleton-line short"></div>
          <div className="skeleton skeleton-line" style={{ width: '30%', height: 10 }}></div>
        </div>
      </div>
      <div className="skeleton skeleton-line long"></div>
      <div className="skeleton skeleton-line medium"></div>
      <div className="skeleton skeleton-image"></div>
    </div>
  );
}

function Feed() {
  const { user, updateUser } = useAuth();
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [commentTexts, setCommentTexts] = useState({});
  const [showComments, setShowComments] = useState({});
  const [showPicker, setShowPicker] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isPoll, setIsPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const searchTimer = useRef(null);
  const observer = useRef();


  const lastPostElementRef = useCallback(node => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  useEffect(() => {
    fetchPosts(page, searchQuery);
    
    // Auto-read notifications if post ID is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const postFromUrl = urlParams.get('post');
    if (postFromUrl) {
      setShowComments(prev => ({ ...prev, [postFromUrl]: true }));
      API.put(`/notifications/read-post/${postFromUrl}`).then(() => {
        window.dispatchEvent(new Event('notifications-updated'));
      }).catch(() => {});
    }
  }, [page]);

  const fetchPosts = async (currentPage, search = '') => {
    if (currentPage === 1) setLoading(true);
    else setLoadingMore(true);
    
    try {
      const { data } = await API.get(`/posts?page=${currentPage}&search=${encodeURIComponent(search)}`);
      if (currentPage === 1) {
        setPosts(data.posts || []);
      } else {
        setPosts(prev => [...prev, ...data.posts]);
      }
      setHasMore(data.page < data.pages);
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
    setPage(1); // Reset to first page
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchPosts(1, value);
    }, 400);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview('');
  };

  const handlePost = async (e) => {
    e.preventDefault();
    // Allow posting if there's content, an image, or it's a poll with a question/options
    if (!content.trim() && !imageFile && (!isPoll || (!pollQuestion.trim() && !pollOptions[0].trim()))) return;
    
    setPosting(true);
    try {
      const formData = new FormData();
      // If content is empty but it's a poll, use the poll question as the post content
      const finalContent = content.trim() || (isPoll ? pollQuestion.trim() || 'Poll' : '');
      formData.append('content', finalContent);
      
      if (imageFile) formData.append('image', imageFile);

      if (isPoll) {
        formData.append('isPoll', 'true');
        formData.append('pollQuestion', pollQuestion.trim() || finalContent);
        formData.append('pollOptions', JSON.stringify(pollOptions.filter(opt => opt.trim())));
      }

      const { data } = await API.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPosts([data, ...posts]);
      setContent('');
      setImageFile(null);
      setImagePreview('');
      setIsPoll(false);
      setPollQuestion('');
      setPollOptions(['', '']);
    } catch (err) {

      console.error('Error creating post:', err);
    } finally {
      setPosting(false);
    }
  };

  const handleReaction = async (postId, emoji) => {
    try {
      const { data } = await API.put(`/posts/${postId}/react`, { emoji });
      setPosts(posts.map(p =>
        p._id === postId ? { ...p, reactions: data.reactions } : p
      ));
      setShowPicker({ ...showPicker, [postId]: false });
    } catch (err) {
      console.error('Error reacting:', err);
    }
  };

  const updatePostCommentCount = (postId, count) => {
    setPosts(prevPosts => prevPosts.map(p => 
      p._id === postId ? { ...p, localCommentCount: count } : p
    ));
  };

  const toggleComments = async (postId) => {
    const isOpening = !showComments[postId];
    setShowComments({ ...showComments, [postId]: isOpening });
    
    if (isOpening) {
      try {
        await API.put(`/notifications/read-post/${postId}`);
        window.dispatchEvent(new Event('notifications-updated'));
      } catch (err) {
        console.error('Error marking notifications as read:', err);
      }
    }
  };

  const handleVote = async (postId, optionIndex) => {
    try {
      const { data } = await API.put(`/posts/${postId}/vote`, { optionIndex });
      setPosts(posts.map(p =>
        p._id === postId ? { ...p, pollData: data } : p
      ));
    } catch (err) {
      console.error('Error voting:', err);
    }
  };

  const handleDelete = async (postId) => {
    try {
      await API.delete(`/posts/${postId}`);
      setPosts(posts.filter(p => p._id !== postId));
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  const handleSave = async (postId) => {
    try {
      const { data } = await API.post(`/posts/${postId}/save`);
      updateUser({ savedPosts: data });
    } catch (err) {
      console.error('Error saving post:', err);
    }
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?';

  const renderAvatar = (u, sizeClass = 'avatar-sm') => {
    if (u?.avatar) {
      return <div className={`avatar ${sizeClass}`}><img src={getImageUrl(u.avatar)} alt={u.name} /></div>;
    }
    return <div className={`avatar ${sizeClass}`}>{getInitials(u?.name)}</div>;
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

  const getReactionCount = (reactions) => {
    if (!reactions) return 0;
    return REACTION_EMOJIS.reduce((sum, e) => sum + (reactions[e]?.length || 0), 0);
  };

  const getUserReaction = (reactions) => {
    if (!reactions) return null;
    for (const e of REACTION_EMOJIS) {
      if (reactions[e]?.includes(user?._id)) return e;
    }
    return null;
  };

  return (
    <div className="feed-container">
      <div className="page-header">
        <h1>Feed</h1>
        <p>Share your thoughts with the campus community</p>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <FiSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search posts..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          id="feed-search"
        />
      </div>

      {/* Create Post */}
      <form onSubmit={handlePost} className="glass-card create-post">
        <div className="create-post-input">
          {renderAvatar(user)}
          <textarea
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="input-field"
            style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}
            id="post-content-input"
          />
        </div>

        {isPoll && (
          <div className="poll-creation-area glass-card" style={{ marginTop: 12, padding: 16 }}>
            <input 
              type="text" 
              placeholder="Poll Question (optional, will use post content if empty)"
              className="input-field"
              style={{ marginBottom: 12 }}
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pollOptions.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <input 
                    type="text" 
                    placeholder={`Option ${i+1}`}
                    className="input-field"
                    style={{ flex: 1 }}
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...pollOptions];
                      newOpts[i] = e.target.value;
                      setPollOptions(newOpts);
                    }}
                  />
                  {pollOptions.length > 2 && (
                    <button type="button" onClick={() => {
                      const newOpts = pollOptions.filter((_, idx) => idx !== i);
                      setPollOptions(newOpts);
                    }} className="btn-icon" style={{ width: 32, height: 32 }}><FiX /></button>
                  )}
                </div>
              ))}
              {pollOptions.length < 5 && (
                <button type="button" onClick={() => setPollOptions([...pollOptions, ''])} 
                  className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
                  <FiPlus /> Add Option
                </button>
              )}
            </div>
          </div>
        )}

        {imagePreview && (
          <div style={{ position: 'relative', marginTop: 12, borderRadius: 12, overflow: 'hidden', maxHeight: 200 }}>
            <img src={imagePreview} alt="Preview" style={{ width: '100%', objectFit: 'cover', maxHeight: 200 }} />
            <button type="button" onClick={removeImage} style={{
              position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>✕</button>
          </div>
        )}
        <div className="create-post-actions">
          <div style={{ display: 'flex', gap: 8 }}>
            <label htmlFor="post-image-upload" style={{ cursor: 'pointer' }}>
              <div className="btn btn-secondary btn-sm" style={{ pointerEvents: 'none' }}>
                <FiImage /> Photo
              </div>
            </label>
            <input type="file" id="post-image-upload" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
            
            <button type="button" onClick={() => setIsPoll(!isPoll)} 
              className={`btn btn-sm ${isPoll ? 'btn-primary' : 'btn-secondary'}`}>
              <FiBarChart2 /> Poll
            </button>
          </div>

          <button type="submit" className="btn btn-primary btn-sm" disabled={posting || (!content.trim() && !imageFile && (!isPoll || !pollOptions[0]))} id="post-submit" style={{ marginLeft: 8 }}>
            <FiSend /> {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>


      {/* Skeleton Loading */}
      {loading ? (
        <>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📝</div>
          <h3>{searchQuery ? 'No posts found' : 'No posts yet'}</h3>
          <p>{searchQuery ? 'Try a different search' : 'Be the first to share something!'}</p>
        </div>
      ) : (
        <>
          {posts.map((post, index) => {
            const userReaction = getUserReaction(post.reactions);
            const isLast = (index === posts.length - 1);

            return (
              <div key={post._id} ref={isLast ? lastPostElementRef : null} className="glass-card post-card">
                <div className="post-header">
                {renderAvatar(post.author)}
                <div className="post-author-info">
                  <div className="name">
                    {post.author?.name}
                    <span className={`badge badge-${post.author?.role}`}>{post.author?.role}</span>
                  </div>
                  <div className="meta">{post.author?.college} · {timeAgo(post.createdAt)}</div>
                </div>
                {post.author?._id === user?._id && (
                  <button className="btn-icon" onClick={() => handleDelete(post._id)} title="Delete post"
                    style={{ width: 32, height: 32, fontSize: 14 }}><FiTrash2 /></button>
                )}
              </div>

              <div className="post-content">{post.content}</div>

              {post.isPoll && post.pollData && (
                <div className="post-poll">
                  {post.pollData.question && <h4 className="poll-question">{post.pollData.question}</h4>}
                  <div className="poll-options">
                    {(() => {
                      const totalVotes = post.pollData.options.reduce((acc, opt) => acc + (opt.votes?.length || 0), 0);
                      const userHasVoted = post.pollData.options.some(opt => opt.votes?.includes(user?._id));

                      return post.pollData.options.map((option, i) => {
                        const votes = option.votes?.length || 0;
                        const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                        const isVotedByMe = option.votes?.includes(user?._id);

                        return (
                          <div 
                            key={i} 
                            className={`poll-option-container ${userHasVoted ? 'voted' : ''} ${isVotedByMe ? 'selected' : ''}`}
                            onClick={() => handleVote(post._id, i)}
                          >
                            <div className="poll-option-bg" style={{ width: `${percentage}%` }}></div>
                            <div className="poll-option-content">
                              <span>{option.text}</span>
                              {userHasVoted && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {isVotedByMe && <FiCheck className="voted-check" />}
                                  <span className="percentage">{percentage}%</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="poll-footer">
                    {post.pollData.options.reduce((acc, opt) => acc + (opt.votes?.length || 0), 0)} votes
                  </div>
                </div>
              )}

              {post.image && (
                <div className="post-image"><img src={getImageUrl(post.image)} alt="Post" /></div>
              )}


              {/* Emoji Reactions */}
              <div className="post-actions">
                <div style={{ position: 'relative' }}>
                  <button
                    className={`post-action-btn ${userReaction ? 'liked' : ''}`}
                    onClick={() => setShowPicker({ ...showPicker, [post._id]: !showPicker[post._id] })}
                  >
                    <span style={{ fontSize: 16 }}>{userReaction || '😀'}</span>
                    {getReactionCount(post.reactions) > 0 && getReactionCount(post.reactions)}
                  </button>

                  {showPicker[post._id] && (
                    <div className="reaction-picker" style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 8, zIndex: 10 }}>
                      {REACTION_EMOJIS.map(emoji => (
                        <button key={emoji} onClick={() => handleReaction(post._id, emoji)}
                          style={{ outline: emoji === userReaction ? '2px solid var(--primary)' : 'none' }}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button className="post-action-btn"
                  onClick={() => toggleComments(post._id)}>
                  <FiMessageCircle className="icon" /> {post.localCommentCount !== undefined ? post.localCommentCount : (post.commentCount || 0)}
                </button>

                <button 
                  className={`post-action-btn ${user?.savedPosts?.includes(post._id) ? 'liked' : ''}`}
                  onClick={() => handleSave(post._id)}
                  title={user?.savedPosts?.includes(post._id) ? 'Unsave Post' : 'Save Post'}
                >
                  <FiBookmark className="icon" style={{ fill: user?.savedPosts?.includes(post._id) ? 'var(--primary)' : 'none' }} />
                </button>
              </div>

              {/* Reaction summary */}
              {getReactionCount(post.reactions) > 0 && (
                <div className="reactions-bar">
                  {REACTION_EMOJIS.map(emoji => {
                    const count = post.reactions?.[emoji]?.length || 0;
                    if (count === 0) return null;
                    const isActive = post.reactions?.[emoji]?.includes(user?._id);
                    return (
                      <button key={emoji} className={`reaction-btn ${isActive ? 'active' : ''}`}
                        onClick={() => handleReaction(post._id, emoji)}>
                        {emoji} <span className="count">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Comments */}
              {showComments[post._id] && (
                <CommentSection 
                  postId={post._id} 
                  onCommentCountChange={(count) => updatePostCommentCount(post._id, count)} 
                />
              )}
            </div>
          );
          })}
          {loadingMore && (
            <div className="loader">
              <div className="spinner" style={{ width: 24, height: 24 }}></div>
            </div>
          )}
          {!hasMore && posts.length > 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              You've reached the end of the feed ✨
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Feed;
