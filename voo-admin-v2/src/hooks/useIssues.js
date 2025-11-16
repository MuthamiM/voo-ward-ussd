// src/hooks/useIssues.js
import { useState, useEffect } from 'react';
import api from '../services/api';

export default function useIssues() {
  const [issues, setIssues] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchIssues = () => {
    setIsLoading(true);
    api.get('/issues')
      .then(res => setIssues(res.data))
      .catch(() => setError('Failed to load issues'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const createIssue = async (description) => {
    setIsLoading(true);
    try {
      await api.post('/issues', { description });
      fetchIssues();
    } catch {
      setError('Failed to create issue');
    } finally {
      setIsLoading(false);
    }
  };

  const resolveIssue = async (id) => {
    setIsLoading(true);
    try {
      await api.patch(`/issues/${id}/resolve`);
      fetchIssues();
    } catch {
      setError('Failed to resolve issue');
    } finally {
      setIsLoading(false);
    }
  };

  return { issues, isLoading, error, createIssue, resolveIssue };
}
