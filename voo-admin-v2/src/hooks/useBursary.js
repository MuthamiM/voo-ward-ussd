// src/hooks/useBursary.js
import { useState, useEffect } from 'react';
import api from '../services/api';

export default function useBursary() {
  const [bursaries, setBursaries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBursaries = () => {
    setIsLoading(true);
    api.get('/bursary')
      .then(res => setBursaries(res.data))
      .catch(() => setError('Failed to load bursaries'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchBursaries();
  }, []);

  const createBursary = async (name) => {
    setIsLoading(true);
    try {
      await api.post('/bursary', { name });
      fetchBursaries();
    } catch {
      setError('Failed to create bursary');
    } finally {
      setIsLoading(false);
    }
  };

  const approveBursary = async (id) => {
    setIsLoading(true);
    try {
      await api.patch(`/bursary/${id}/approve`);
      fetchBursaries();
    } catch {
      setError('Failed to approve bursary');
    } finally {
      setIsLoading(false);
    }
  };

  return { bursaries, isLoading, error, createBursary, approveBursary };
}
