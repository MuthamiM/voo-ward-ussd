// src/hooks/useDashboard.js
import { useState, useEffect } from 'react';
import api from '../services/api';

export default function useDashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    api.get('/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(() => setError('Failed to load dashboard stats'))
      .finally(() => setIsLoading(false));
  }, []);

  return { stats, isLoading, error };
}
