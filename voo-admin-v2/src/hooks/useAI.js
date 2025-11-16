// src/hooks/useAI.js
import { useState } from 'react';
import api from '../services/api';

export default function useAI() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = async (content) => {
    setIsLoading(true);
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content }]);
    try {
      const res = await api.post('/ai/claude', { message: content });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply }]);
      setIsLoading(false);
    } catch (err) {
      setError('AI assistant failed to respond.');
      setIsLoading(false);
    }
  };

  return { messages, isLoading, error, sendMessage };
}
