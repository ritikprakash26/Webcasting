import './ProgressBar.css';

const ProgressBar = ({ progress = 0, status = '', message = '' }) => {
  return (
    <div className="progress-container">
      <div className="progress-info">
        {status && <span className="progress-status">{status}</span>}
        {message && <span className="progress-message">{message}</span>}
        <span className="progress-percent">{Math.round(progress)}%</span>
      </div>
      <div className="progress-bar-wrapper">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
