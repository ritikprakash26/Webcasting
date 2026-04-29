Frontend Socket.io Integration Guide

Connection Setup

# 1. Install Socket.io Client

```bash
npm install socket.io-client
```

# 2. Connect to Socket.io Server

```javascript
import { io } from 'socket.io-client';

// Connect with authentication token
const socket = io('http://localhost:5000/progress', {
  auth: {
    token: 'your-jwt-token-here' // Get from login response
  },
  transports: ['websocket', 'polling']
});

// Connection event handlers
socket.on('connect', () => {
  console.log('Connected to progress server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from progress server');
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

Listening for Progress Updates

# Basic Progress Listener

```javascript
socket.on('progress', (data) => {
  console.log('Progress update:', data);
  updateUI(data);
});


function updateUI(data) {
  const progressBar = document.getElementById('progress-bar');
  if (progressBar) {
    progressBar.style.width = `${data.percent}%`;
    progressBar.textContent = `${data.percent}%`;
  }
  
  // Update status text
  const statusText = document.getElementById('status-text');
  if (statusText) {
    statusText.textContent = data.message || data.status;
  }
  
  // Update status badge
  const statusBadge = document.getElementById('status-badge');
  if (statusBadge) {
    statusBadge.className = `status-badge ${data.status}`;
    statusBadge.textContent = data.status;
  }
}
```

React Example

```jsx
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

function VideoProgress({ videoId, token }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('uploaded');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Connect to Socket.io
    const socket = io('http://localhost:5000/progress', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    // Listen for progress updates
    socket.on('progress', (data) => {
      if (data.videoId === videoId) {
        setProgress(data.percent);
        setStatus(data.status);
        setMessage(data.message);
      }
    });

    // Optional: Join specific video room
    socket.emit('join-video-room', videoId);

    // Cleanup on unmount
    return () => {
      socket.emit('leave-video-room', videoId);
      socket.disconnect();
    };
  }, [videoId, token]);

  return (
    <div className="video-progress">
      <div className="progress-bar-container">
        <div 
          className="progress-bar" 
          style={{ width: `${progress}%` }}
        >
          {progress}%
        </div>
      </div>
      <div className="status">{status}</div>
      <div className="message">{message}</div>
    </div>
  );
}
```

Status Values

The `status` field can have the following values:

- `uploaded` - Video uploaded successfully
- `processing` - Video is being processed
- `safe` - Content verified as safe
- `flagged` - Content flagged for review
- `ready` - Video is ready for viewing
- `failed` - Processing failed

Complete Example with Error Handling

```javascript
import { io } from 'socket.io-client';

class VideoProgressManager {
  constructor(token) {
    this.socket = io('http://localhost:5000/progress', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to progress server');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    // Progress updates
    this.socket.on('progress', (data) => {
      this.handleProgress(data);
    });

    // Video status (when joining room)
    this.socket.on('video-status', (data) => {
      this.handleProgress(data);
    });

    // Error events
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.handleError(error);
    });
  }

  handleProgress(data) {
    // Update UI with progress data
    const { videoId, percent, status, message } = data;
    
    // Dispatch custom event or update state
    window.dispatchEvent(new CustomEvent('video-progress', {
      detail: { videoId, percent, status, message }
    }));
  }

  handleError(error) {
    // Handle errors
    console.error('Progress error:', error);
  }

  joinVideoRoom(videoId) {
    this.socket.emit('join-video-room', videoId);
  }

  leaveVideoRoom(videoId) {
    this.socket.emit('leave-video-room', videoId);
  }

  disconnect() {
    this.socket.disconnect();
  }
}

// Usage
const progressManager = new VideoProgressManager(userToken);

// Listen for progress updates
window.addEventListener('video-progress', (event) => {
  const { videoId, percent, status, message } = event.detail;
  updateUI(videoId, percent, status, message);
});

// Join video room
progressManager.joinVideoRoom(videoId);
```

Environment Configuration

Update the Socket.io server URL based on your environment:

```javascript
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000/progress';
// or
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000/progress';
```

Notes

1. Authentication: Always include the JWT token in the connection auth
2. Reconnection: Socket.io automatically handles reconnection
3. Multiple Videos: You can listen to multiple videos by joining multiple video rooms
4. User-Specific: Progress is automatically sent to the user who uploaded the video
5. Video Rooms: Optionally join video-specific rooms for additional updates



