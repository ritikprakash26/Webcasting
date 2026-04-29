import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { videoAPI } from '../services/api';
import './Player.css';

const Player = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [streamUrl, setStreamUrl] = useState('');

  useEffect(() => {
    fetchVideo();
  }, [id]);

  const fetchVideo = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await videoAPI.getById(id);
      
      if (response.data.success) {
        const videoData = response.data.data.video;
        setVideo(videoData);
        
        // Build stream URL with authentication token
        // Token is passed as query parameter for video element compatibility
        const token = localStorage.getItem('token');
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const url = `${baseUrl}/videos/stream/${id}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
        setStreamUrl(url);
      }
    } catch (err) {
      console.error('Fetch video error:', err);
      setError(err.response?.data?.message || 'Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="player-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading video...</p>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="player-page">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error || 'Video not found'}</p>
          <button className="btn btn-primary" onClick={handleBack}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Check if video is ready for streaming
  // Allow playback for any status except while still uploading/processing
  if (video.status === 'uploaded' || video.status === 'processing') {
    return (
      <div className="player-page">
        <div className="error-container">
          <h2>Video Not Ready</h2>
          <p>This video is still processing. Status: {video.status}</p>
          {video.status === 'processing' && (
            <p>Progress: {video.processingProgress || 0}%</p>
          )}
          <button className="btn btn-primary" onClick={handleBack}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="player-page">
      <div className="player-container">
        {/* Header */}
        <div className="player-header">
          <button className="back-button" onClick={handleBack}>
            ← Back
          </button>
          <h1>{video.title}</h1>
        </div>

        {/* Video Player */}
        <div className="video-player-wrapper">
          <video
            ref={videoRef}
            controls
            src={streamUrl}
            className="video-player"
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Video Info */}
        <div className="video-info">
          <div className="info-section">
            <h2>Description</h2>
            <p>{video.description || 'No description available'}</p>
          </div>

          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Status:</span>
              <span className={`status-badge status-${video.status}`}>
                {video.status === 'safe' && '🟢 Safe'}
                {video.status === 'flagged' && '🔴 Flagged'}
                {video.status === 'ready' && '🟢 Ready'}
              </span>
            </div>

            {video.duration && (
              <div className="info-item">
                <span className="info-label">Duration:</span>
                <span className="info-value">
                  {Math.floor(video.duration / 60)}:
                  {(video.duration % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}

            {video.fileSize && (
              <div className="info-item">
                <span className="info-label">File Size:</span>
                <span className="info-value">
                  {(video.fileSize / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            )}

            {video.sensitivityLevel && (
              <div className="info-item">
                <span className="info-label">Sensitivity:</span>
                <span className={`sensitivity-badge sensitivity-${video.sensitivityLevel}`}>
                  {video.sensitivityLevel}
                </span>
              </div>
            )}

            {video.createdAt && (
              <div className="info-item">
                <span className="info-label">Uploaded:</span>
                <span className="info-value">
                  {new Date(video.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Player;
