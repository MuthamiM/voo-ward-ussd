// src/components/Issues.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Plus, Loader2 } from 'lucide-react';

export default function Issues({ issues, onResolve, onCreate, isLoading }) {
  const [newIssue, setNewIssue] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newIssue.trim()) return;
    onCreate(newIssue);
    setNewIssue('');
  };

  return (
    <div className="p-6 md:p-10">
      <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-2xl font-bold text-blue-900 mb-6 flex items-center gap-2"><AlertCircle className="text-pink-500" /> Issues</motion.h2>
      {/* New Issue Form */}
      <form onSubmit={handleCreate} className="flex gap-2 mb-8">
        <input
          type="text"
          value={newIssue}
          onChange={e => setNewIssue(e.target.value)}
          placeholder="Describe a new issue..."
          className="flex-1 px-4 py-3 rounded-2xl border border-pink-200 bg-white/60 focus:outline-none focus:ring-2 focus:ring-pink-300 text-blue-900"
          disabled={isLoading}
        />
        <button type="submit" className="bg-pink-500 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-pink-600 transition-colors disabled:opacity-50" disabled={isLoading || !newIssue.trim()}>
          <Plus size={18} /> Add
        </button>
      </form>
      {/* Issues List */}
      <div className="space-y-4">
        {issues.length === 0 && <div className="text-blue-400 text-sm">No issues reported yet.</div>}
        {issues.map((issue, i) => (
          <motion.div
            key={issue._id || i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center justify-between bg-white/80 rounded-2xl p-4 shadow border-l-4 ${issue.resolved ? 'border-green-400' : 'border-pink-400'}`}
          >
            <div className="flex items-center gap-3">
              {issue.resolved ? <CheckCircle className="text-green-500" /> : <AlertCircle className="text-pink-500" />}
              <span className={`text-blue-900 ${issue.resolved ? 'line-through opacity-60' : ''}`}>{issue.description}</span>
            </div>
            {!issue.resolved && (
              <button onClick={() => onResolve(issue._id)} className="bg-green-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-1 hover:bg-green-600 transition-colors disabled:opacity-50" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />} Resolve
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
