// src/components/Dashboard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { BarChart2, Users, AlertCircle, Megaphone, Award } from 'lucide-react';

export default function Dashboard({ stats, onSection }) {
  const cards = [
    {
      title: 'Analytics',
      icon: <BarChart2 size={32} />, 
      color: 'from-blue-500 to-purple-500',
      onClick: () => onSection('analytics'),
      desc: 'View usage, growth, and trends.'
    },
    {
      title: 'Users',
      icon: <Users size={32} />, 
      color: 'from-green-500 to-blue-500',
      onClick: () => onSection('users'),
      desc: 'Manage admin users and roles.'
    },
    {
      title: 'Issues',
      icon: <AlertCircle size={32} />, 
      color: 'from-pink-500 to-red-500',
      onClick: () => onSection('issues'),
      desc: 'Track and resolve reported issues.'
    },
    {
      title: 'Announcements',
      icon: <Megaphone size={32} />, 
      color: 'from-yellow-400 to-pink-500',
      onClick: () => onSection('announcements'),
      desc: 'Send updates to all users.'
    },
    {
      title: 'Bursary',
      icon: <Award size={32} />, 
      color: 'from-purple-500 to-blue-400',
      onClick: () => onSection('bursary'),
      desc: 'Manage bursary applications.'
    },
  ];

  return (
    <div className="p-6 md:p-10">
      <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-3xl font-bold text-blue-900 mb-8">Welcome to the Admin Dashboard</motion.h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            whileHover={{ scale: 1.04, boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.2)' }}
            className={`bg-gradient-to-br ${card.color} rounded-3xl p-8 shadow-2xl cursor-pointer flex flex-col items-center text-white hover:shadow-blue-200/40 transition-all`}
            onClick={card.onClick}
          >
            <div className="mb-4">{card.icon}</div>
            <div className="text-xl font-bold mb-2">{card.title}</div>
            <div className="text-white/80 text-sm text-center">{card.desc}</div>
          </motion.div>
        ))}
      </div>
      {/* Stats Section */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats && Object.entries(stats).map(([key, value]) => (
          <motion.div key={key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white/60 backdrop-blur rounded-2xl p-6 shadow text-center">
            <div className="text-2xl font-bold text-blue-900">{value}</div>
            <div className="text-blue-700 text-xs uppercase mt-1 tracking-wider">{key.replace(/_/g, ' ')}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
