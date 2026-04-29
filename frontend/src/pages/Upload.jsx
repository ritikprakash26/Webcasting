import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { videoAPI } from '../services/api';
import ProgressBar from '../components/ProgressBar';
import './Upload.css';

const Upload = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['video/mp4', 'video/x-matroska', 'video/x-msvideo'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please select a valid video file (MP4, MKV, or AVI)');
        return;
      }

      // Validate file size (200MB)
      const maxSize = 200 * 1024 * 1024; // 200MB
      if (file.size > maxSize) {
        setError('File size must be less than 200MB');
        return;
      }

      setSelectedFile(file);
      setTitle(file.name.replace(/\.[^/.]+$/, '')); // Remove extension
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      setError('Please select a video file');
      return;
    }

    setIsUploading(true);
    setError('');
    setUploadProgress(0);
    setUploadStatus('uploading');
    setUploadMessage('Uploading video...');

    try {
      const formData = new FormData();
      formData.append('video', selectedFile);
      if (title) formData.append('title', title);
      if (description) formData.append('description', description);

      const response = await videoAPI.upload(formData, (progress) => {
        setUploadProgress(progress);
        setUploadMessage(`Uploading... ${progress}%`);
      });

      if (response.data.success) {
        setUploadProgress(100);
        setUploadStatus('success');
        setUploadMessage('Video uploaded successfully! Processing started...');
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || 'Failed to upload video');
      setUploadStatus('error');
      setUploadMessage('Upload failed');
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setTitle('');
    setDescription('');
    setUploadProgress(0);
    setUploadStatus('');
    setUploadMessage('');
    setError('');
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="upload-page">
      <div className="upload-container">
        <h1>Upload Video</h1>

        <form onSubmit={handleSubmit} className="upload-form">
          {/* File Input */}
          <div className="form-group">
            <label htmlFor="video-file" className="file-label">
              <div className="file-input-wrapper">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="video-file"
                  accept="video/mp4,video/x-matroska,video/x-msvideo"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="file-input"
                />
                <div className="file-input-display">
                  {selectedFile ? (
                    <div className="file-selected">
                      <span className="file-icon">📹</span>
                      <div className="file-info">
                        <p className="file-name">{selectedFile.name}</p>
                        <p className="file-size">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="file-placeholder">
                      <span className="file-icon">📁</span>
                      <p>Click to select video file</p>
                      <p className="file-hint">MP4, MKV, or AVI (Max 200MB)</p>
                    </div>
                  )}
                </div>
              </div>
            </label>
          </div>

          {/* Title Input */}
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isUploading}
              placeholder="Enter video title"
              className="form-input"
            />
          </div>

          {/* Description Input */}
          <div className="form-group">
            <label htmlFor="description">Description (Optional)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUploading}
              placeholder="Enter video description"
              className="form-textarea"
              rows="4"
            />
          </div>

          {/* Progress Bar */}
          {isUploading && (
            <ProgressBar
              progress={uploadProgress}
              status={uploadStatus}
              message={uploadMessage}
            />
          )}

          {/* Error Message */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Success Message */}
          {uploadStatus === 'success' && (
            <div className="success-message">
              Video uploaded successfully! Redirecting...
            </div>
          )}

          {/* Action Buttons */}
          <div className="form-actions">
            <button
              type="button"
              onClick={handleReset}
              disabled={isUploading}
              className="btn btn-secondary"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="btn btn-primary"
            >
              {isUploading ? 'Uploading...' : 'Upload Video'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Upload;
