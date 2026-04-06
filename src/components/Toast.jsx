import './Toast.css';

export default function Toast({ message, type = 'info' }) {
  return (
    <div className={`toast toast-${type}`}>
      <p>{message}</p>
    </div>
  );
}
