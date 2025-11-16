// src/components/Login.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Shield, Eye, Info, RefreshCw, ChevronRight } from 'lucide-react';

export default function Login({ onLogin, isLoading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) return;
    onLogin(email, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600">
        {/* Animated Orbs */}
        {[{ delay: 0, duration: 8, x: [0, 30, 0], y: [0, -40, 0], left: '10%', top: '10%' }, { delay: 2, duration: 10, x: [0, -30, 0], y: [0, 40, 0], right: '10%', top: '20%' }, { delay: 4, duration: 12, x: [0, 20, 0], y: [0, -30, 0], left: '50%', bottom: '10%' }].map((orb, i) => (
          <motion.div
            key={i}
            animate={{ x: orb.x, y: orb.y }}
            transition={{ duration: orb.duration, repeat: Infinity, ease: "easeInOut", delay: orb.delay }}
            className="absolute w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-70"
            style={{ left: orb.left, right: orb.right, top: orb.top, bottom: orb.bottom, background: i === 0 ? '#60A5FA' : i === 1 ? '#A78BFA' : '#F472B6' }}
          />
        ))}
      </div>
      {/* Login Card */}
      <motion.form
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="bg-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 md:p-12 w-full max-w-md relative z-10 border border-white/20"
        onSubmit={handleSubmit}
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
          className="flex justify-center mb-8"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-white/30 to-white/10 backdrop-blur rounded-3xl flex items-center justify-center shadow-2xl border border-white/30">
            <Shield className="text-white" size={52} />
          </div>
        </motion.div>
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">VOO Ward</h1>
          <p className="text-blue-100 text-base">Kyamatu Ward Admin Portal</p>
          <p className="text-blue-200 text-sm mt-1">Kitui County, Kenya 🇰🇪</p>
        </motion.div>
        {/* Form */}
        <div className="space-y-5">
          {/* Email Input */}
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
            <label className="block text-white text-sm font-semibold mb-2">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/60 group-focus-within:text-white transition-colors" size={20} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSubmit(e)} placeholder="your.email@kyamatu.go.ke" className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur border border-white/30 rounded-2xl text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all" />
            </div>
          </motion.div>
          {/* Password Input */}
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
            <label className="block text-white text-sm font-semibold mb-2">Password</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/60 group-focus-within:text-white transition-colors" size={20} />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSubmit(e)} placeholder="Enter your password" className="w-full pl-12 pr-12 py-4 bg-white/10 backdrop-blur border border-white/30 rounded-2xl text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors"><Eye size={20} /></button>
            </div>
          </motion.div>
          {/* Remember Me & Forgot Password */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex items-center justify-between text-sm">
            <label className="flex items-center space-x-2 text-white cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-white/30 bg-white/10 checked:bg-white" />
              <span>Remember me</span>
            </label>
            <button type="button" className="text-blue-100 hover:text-white transition-colors font-medium">Forgot password?</button>
          </motion.div>
          {/* Login Button */}
          <motion.button type="submit" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} disabled={isLoading} className="w-full py-4 bg-white text-blue-600 font-bold rounded-2xl shadow-2xl hover:shadow-white/20 transition-all text-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? (<><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw size={20} /></motion.div><span>Signing in...</span></>) : (<><span>Sign In</span><ChevronRight size={20} /></>)}
          </motion.button>
          {/* Demo Credentials */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/20">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-8 h-8 bg-amber-500/20 backdrop-blur rounded-lg flex items-center justify-center">
                <Info className="text-amber-300" size={18} />
              </div>
              <p className="text-white text-sm font-bold">Demo Credentials</p>
            </div>
            <div className="space-y-2 text-xs text-blue-100">
              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer" onClick={() => { setEmail('mca@kyamatu.go.ke'); setPassword('mca123'); }}>
                <span>🎭 MCA (Full Access)</span>
                <span className="font-mono text-blue-200">mca@kyamatu.go.ke</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer" onClick={() => { setEmail('pa@kyamatu.go.ke'); setPassword('pa123'); }}>
                <span>👤 PA (Limited)</span>
                <span className="font-mono text-blue-200">pa@kyamatu.go.ke</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer" onClick={() => { setEmail('clerk@kyamatu.go.ke'); setPassword('clerk123'); }}>
                <span>📋 Clerk (Limited)</span>
                <span className="font-mono text-blue-200">clerk@kyamatu.go.ke</span>
              </div>
            </div>
          </motion.div>
          {/* Footer */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="text-center text-xs text-blue-100 pt-4">
            <p>Secured by SSL encryption • Protected by 2FA</p>
            <p className="mt-1">© 2025 Kyamatu Ward. All rights reserved.</p>
          </motion.div>
        </div>
      </motion.form>
    </div>
  );
}
