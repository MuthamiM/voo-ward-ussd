// src/hooks/useUsers.js
import { useState, useEffect } from 'react';
import api from '../services/api';

export default function useUsers() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUsers = () => {
    setIsLoading(true);
    api.get('/users')
      .then(res => setUsers(res.data))
      .catch(() => setError('Failed to load users'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const addUser = async (email) => {
    setIsLoading(true);
    try {
      await api.post('/users', { email });
      fetchUsers();
    } catch {
      setError('Failed to add user');
    } finally {
      setIsLoading(false);
    }
  };

  const removeUser = async (id) => {
    setIsLoading(true);
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
    } catch {
      setError('Failed to remove user');
    } finally {
      setIsLoading(false);
    }
  };

  return { users, isLoading, error, addUser, removeUser };
}
