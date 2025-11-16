// src/components/Analytics.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { BarChart2 } from 'lucide-react';

export default function Analytics({ data }) {
  // Example: data = { users: 120, issues: 8, bursaries: 15, announcements: 5 }
  return (
    <div className="p-6 md:p-10">
      <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-2xl font-bold text-blue-900 mb-6 flex items-center gap-2"><BarChart2 className="text-blue-500" /> Analytics</motion.h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
        {data && Object.entries(data).map(([key, value]) => (
          <motion.div key={key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white/80 rounded-2xl p-6 shadow text-center">
            <div className="text-2xl font-bold text-blue-900">{value}</div>
            <div className="text-blue-700 text-xs uppercase mt-1 tracking-wider">{key.replace(/_/g, ' ')}</div>
          </motion.div>
        ))}
      </div>
      {/* Placeholder for future charts/graphs */}
      <div className="bg-white/60 rounded-2xl p-8 shadow text-center text-blue-400 text-sm">
        <span>Charts and visualizations coming soon...</span>
      </div>
    </div>
  );
}
