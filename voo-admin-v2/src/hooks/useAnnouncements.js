// src/hooks/useAnnouncements.js
import { useState, useEffect } from 'react';
import api from '../services/api';

export default function useAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnnouncements = () => {
    setIsLoading(true);
    api.get('/announcements')
      .then(res => setAnnouncements(res.data))
      .catch(() => setError('Failed to load announcements'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const createAnnouncement = async (text) => {
    setIsLoading(true);
    try {
      await api.post('/announcements', { text });
      fetchAnnouncements();
    } catch {
      setError('Failed to create announcement');
    } finally {
      setIsLoading(false);
    }
  };

  return { announcements, isLoading, error, createAnnouncement };
}
