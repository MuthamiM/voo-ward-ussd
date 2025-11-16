// src/components/Announcements.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Plus, Loader2 } from 'lucide-react';

export default function Announcements({ announcements, onCreate, isLoading }) {
  const [newAnnouncement, setNewAnnouncement] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newAnnouncement.trim()) return;
    onCreate(newAnnouncement);
    setNewAnnouncement('');
  };

  return (
    <div className="p-6 md:p-10">
      <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-2xl font-bold text-blue-900 mb-6 flex items-center gap-2"><Megaphone className="text-yellow-500" /> Announcements</motion.h2>
      {/* New Announcement Form */}
      <form onSubmit={handleCreate} className="flex gap-2 mb-8">
        <input
          type="text"
          value={newAnnouncement}
          onChange={e => setNewAnnouncement(e.target.value)}
          placeholder="Write a new announcement..."
          className="flex-1 px-4 py-3 rounded-2xl border border-yellow-200 bg-white/60 focus:outline-none focus:ring-2 focus:ring-yellow-300 text-blue-900"
          disabled={isLoading}
        />
        <button type="submit" className="bg-yellow-500 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-yellow-600 transition-colors disabled:opacity-50" disabled={isLoading || !newAnnouncement.trim()}>
          <Plus size={18} /> Add
        </button>
      </form>
      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.length === 0 && <div className="text-blue-400 text-sm">No announcements yet.</div>}
        {announcements.map((announcement, i) => (
          <motion.div
            key={announcement._id || i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between bg-white/80 rounded-2xl p-4 shadow border-l-4 border-yellow-400"
          >
            <div className="flex items-center gap-3">
              <Megaphone className="text-yellow-500" />
              <span className="text-blue-900">{announcement.text}</span>
            </div>
            <span className="text-xs text-blue-400">{announcement.date ? new Date(announcement.date).toLocaleString() : ''}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
