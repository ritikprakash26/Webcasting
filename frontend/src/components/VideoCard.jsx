import { useNavigate } from 'react-router-dom';
import './VideoCard.css';

const VideoCard = ({ video, canEdit = false, canDelete = false, onDelete }) => {
  const navigate = useNavigate();

  const getStatusBadge = (status) => {
    const badges = {
      safe: { emoji: '🟢', label: 'Safe', className: 'status-safe' },
      flagged: { emoji: '🔴', label: 'Flagged', className: 'status-flagged' },
      processing: { emoji: '🟡', label: 'Processing', className: 'status-processing' },
      uploaded: { emoji: '⚪', label: 'Uploaded', className: 'status-uploaded' },
      ready: { emoji: '🟢', label: 'Ready', className: 'status-ready' },
      failed: { emoji: '🔴', label: 'Failed', className: 'status-failed' }
    };

    const badge = badges[status] || badges.uploaded;
    return (
      <span className={`status-badge ${badge.className}`}>
        <span className="status-emoji">{badge.emoji}</span>
        <span className="status-label">{badge.label}</span>
      </span>
    );
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleClick = () => {
    if (video.status === 'ready' || video.status === 'safe' || video.status === 'flagged' || video.status === 'failed') {
      navigate(`/player/${video._id || video.id}`);
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(video._id || video.id);
    }
  };

  return (
    <div 
      className={`video-card ${
        video.status === 'ready' || video.status === 'safe' || video.status === 'flagged' || video.status === 'failed'
          ? 'clickable'
          : ''
      }`}
      onClick={handleClick}
    >
      <div className="video-card-header">
        <h3 className="video-title">{video.title}</h3>
        {getStatusBadge(video.status)}
      </div>

      {video.description && (
        <p className="video-description">{video.description}</p>
      )}

      <div className="video-thumbnail">
        {video.thumbnailPath ? (
          <img 
            src={`http://localhost:5000${video.thumbnailPath}`} 
            alt={video.title}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div className="video-thumbnail-placeholder" style={{ display: video.thumbnailPath ? 'none' : 'flex' }}>
          <span className="thumbnail-icon">🎬</span>
        </div>
        {video.status === 'processing' && (
          <div className="processing-overlay">
            <div className="processing-spinner"></div>
            <span>{video.processingProgress || 0}%</span>
          </div>
        )}
      </div>

      <div className="video-meta">
        <div className="meta-item">
          <span className="meta-label">Duration:</span>
          <span className="meta-value">{formatDuration(video.duration)}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Size:</span>
          <span className="meta-value">{formatFileSize(video.fileSize)}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Uploaded:</span>
          <span className="meta-value">{formatDate(video.createdAt)}</span>
        </div>
      </div>

      {video.sensitivityLevel && (
        <div className="video-sensitivity">
          <span className="sensitivity-label">Sensitivity:</span>
          <span className={`sensitivity-level sensitivity-${video.sensitivityLevel}`}>
            {video.sensitivityLevel}
          </span>
        </div>
      )}

      {(canEdit || canDelete) && (
        <div className="video-actions">
          {/* For now, only delete is wired; edit can go to a future edit page */}
          {canDelete && (
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={handleDeleteClick}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoCard;
