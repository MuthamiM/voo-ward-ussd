// src/components/Users.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Loader2, Shield, Trash2 } from 'lucide-react';

export default function UsersComponent({ users, onAdd, onRemove, isLoading }) {
  const [newUser, setNewUser] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newUser.trim()) return;
    onAdd(newUser);
    setNewUser('');
  };

  return (
    <div className="p-6 md:p-10">
      <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-2xl font-bold text-blue-900 mb-6 flex items-center gap-2"><Users className="text-green-500" /> Admin Users</motion.h2>
      {/* Add User Form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-8">
        <input
          type="email"
          value={newUser}
          onChange={e => setNewUser(e.target.value)}
          placeholder="Enter new admin email..."
          className="flex-1 px-4 py-3 rounded-2xl border border-green-200 bg-white/60 focus:outline-none focus:ring-2 focus:ring-green-300 text-blue-900"
          disabled={isLoading}
        />
        <button type="submit" className="bg-green-500 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-600 transition-colors disabled:opacity-50" disabled={isLoading || !newUser.trim()}>
          <Plus size={18} /> Add
        </button>
      </form>
      {/* Users List */}
      <div className="space-y-4">
        {users.length === 0 && <div className="text-blue-400 text-sm">No admin users yet.</div>}
        {users.map((user, i) => (
          <motion.div
            key={user._id || i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between bg-white/80 rounded-2xl p-4 shadow border-l-4 border-green-400"
          >
            <div className="flex items-center gap-3">
              <Shield className="text-green-500" />
              <span className="text-blue-900 font-medium">{user.email}</span>
            </div>
            <button onClick={() => onRemove(user._id)} className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-1 hover:bg-red-600 transition-colors disabled:opacity-50" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />} Remove
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
