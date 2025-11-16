// src/components/Bursary.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Award, CheckCircle, Loader2, Plus } from 'lucide-react';

export default function Bursary({ bursaries, onApprove, onCreate, isLoading }) {
  const [newBursary, setNewBursary] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newBursary.trim()) return;
    onCreate(newBursary);
    setNewBursary('');
  };

  return (
    <div className="p-6 md:p-10">
      <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-2xl font-bold text-blue-900 mb-6 flex items-center gap-2"><Award className="text-purple-500" /> Bursary Applications</motion.h2>
      {/* New Bursary Form */}
      <form onSubmit={handleCreate} className="flex gap-2 mb-8">
        <input
          type="text"
          value={newBursary}
          onChange={e => setNewBursary(e.target.value)}
          placeholder="Enter applicant name..."
          className="flex-1 px-4 py-3 rounded-2xl border border-purple-200 bg-white/60 focus:outline-none focus:ring-2 focus:ring-purple-300 text-blue-900"
          disabled={isLoading}
        />
        <button type="submit" className="bg-purple-500 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-purple-600 transition-colors disabled:opacity-50" disabled={isLoading || !newBursary.trim()}>
          <Plus size={18} /> Add
        </button>
      </form>
      {/* Bursary List */}
      <div className="space-y-4">
        {bursaries.length === 0 && <div className="text-blue-400 text-sm">No bursary applications yet.</div>}
        {bursaries.map((bursary, i) => (
          <motion.div
            key={bursary._id || i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center justify-between bg-white/80 rounded-2xl p-4 shadow border-l-4 ${bursary.approved ? 'border-green-400' : 'border-purple-400'}`}
          >
            <div className="flex items-center gap-3">
              {bursary.approved ? <CheckCircle className="text-green-500" /> : <Award className="text-purple-500" />}
              <span className={`text-blue-900 ${bursary.approved ? 'line-through opacity-60' : ''}`}>{bursary.name}</span>
            </div>
            {!bursary.approved && (
              <button onClick={() => onApprove(bursary._id)} className="bg-green-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-1 hover:bg-green-600 transition-colors disabled:opacity-50" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />} Approve
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
