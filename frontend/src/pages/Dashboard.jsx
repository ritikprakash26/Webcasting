import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { videoAPI } from '../services/api';
import VideoCard from '../components/VideoCard';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { isEditor, isAdmin } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, ready, processing, flagged
  const [search, setSearch] = useState('');
  
  // Check if user can upload (Editor or Admin)
  const canUpload = isEditor() || isAdmin();

  useEffect(() => {
    fetchVideos();
  }, [filter, search]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = {};
      if (filter !== 'all') {
        params.status = filter;
      }
      if (search) {
        params.search = search;
      }

      const response = await videoAPI.getAll(params);
      
      if (response.data.success) {
        setVideos(response.data.data.videos || []);
      }
    } catch (err) {
      console.error('Fetch videos error:', err);
      setError(err.response?.data?.message || 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVideo = async (videoId) => {
    const confirmed = window.confirm('Are you sure you want to delete this video?');
    if (!confirmed) return;

    try {
      setError('');
      await videoAPI.delete(videoId);
      await fetchVideos();
    } catch (err) {
      console.error('Delete video error:', err);
      setError(err.response?.data?.message || 'Failed to delete video');
    }
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };

  const filteredVideos = videos.filter(video => {
    if (filter === 'all') return true;
    return video.status === filter;
  });

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>My Videos</h1>
          {/* Show Upload button only for Editor and Admin */}
          {canUpload && (
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/upload')}
            >
              + Upload Video
            </button>
          )}
        </div>

        {/* Search and Filter */}
        <div className="dashboard-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search videos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            <span className="search-icon">🔍</span>
          </div>

          <div className="filter-buttons">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => handleFilterChange('all')}
            >
              All
            </button>
            <button
              className={`filter-btn ${filter === 'ready' ? 'active' : ''}`}
              onClick={() => handleFilterChange('ready')}
            >
              🟢 Ready
            </button>
            <button
              className={`filter-btn ${filter === 'processing' ? 'active' : ''}`}
              onClick={() => handleFilterChange('processing')}
            >
              🟡 Processing
            </button>
            <button
              className={`filter-btn ${filter === 'flagged' ? 'active' : ''}`}
              onClick={() => handleFilterChange('flagged')}
            >
              🔴 Flagged
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading videos...</p>
          </div>
        ) : (
          <>
            {/* Video Count */}
            <div className="video-count">
              {filteredVideos.length} {filteredVideos.length === 1 ? 'video' : 'videos'} found
            </div>

            {/* Video Grid */}
            {filteredVideos.length > 0 ? (
              <div className="video-grid">
                {filteredVideos.map((video) => (
                  <VideoCard
                    key={video._id || video.id}
                    video={video}
                    canEdit={canUpload}
                    canDelete={isAdmin()}
                    onDelete={handleDeleteVideo}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📹</div>
                <h2>No videos found</h2>
                <p>
                  {filter !== 'all' 
                    ? `No videos with status "${filter}"` 
                    : canUpload 
                      ? 'Upload your first video to get started'
                      : 'No videos available'}
                </p>
                {filter === 'all' && canUpload && (
                  <button 
                    className="btn btn-primary"
                    onClick={() => navigate('/upload')}
                  >
                    Upload Video
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
