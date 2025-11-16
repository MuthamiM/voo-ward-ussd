// src/utils/formatDate.js
export default function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
