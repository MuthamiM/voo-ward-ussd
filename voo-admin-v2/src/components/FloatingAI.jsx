// src/components/FloatingAI.jsx
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Loader2, MessageSquare, Mic, MicOff } from 'lucide-react';

const assistantName = 'Claude';

export default function FloatingAI({ onSend, isLoading, messages, error }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom on new message
  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Speech recognition (browser API)
  useEffect(() => {
    let recognition;
    if (!('webkitSpeechRecognition' in window)) return;
    if (!listening) return;
    recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      setInput(event.results[0][0].transcript);
      setListening(false);
      inputRef.current && inputRef.current.focus();
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    return () => recognition && recognition.abort();
  }, [listening]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        className="fixed bottom-8 right-8 z-50 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white rounded-full shadow-2xl p-4 flex items-center justify-center hover:scale-105 focus:outline-none"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.08 }}
        onClick={() => setOpen(true)}
        style={{ display: open ? 'none' : 'flex' }}
        aria-label="Open AI Assistant"
      >
        <Bot size={28} />
      </motion.button>
      {/* Chat Window */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed bottom-8 right-8 z-50 w-[350px] max-w-[90vw] bg-white/20 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/30 flex flex-col overflow-hidden"
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-br from-blue-500/60 to-pink-500/60 border-b border-white/20">
              <div className="flex items-center space-x-2">
                <Bot size={22} className="text-white" />
                <span className="font-bold text-white text-lg">{assistantName}</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-white/10" style={{ minHeight: 220, maxHeight: 320 }}>
              {messages.length === 0 && (
                <div className="text-blue-200 text-sm text-center mt-8">How can I help you today?</div>
              )}
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`rounded-2xl px-4 py-2 max-w-[80%] text-sm shadow ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white/80 text-blue-900'}`}>{msg.content}</div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex items-center space-x-2 text-blue-400 text-xs"><Loader2 className="animate-spin" size={16} /> <span>Thinking...</span></div>
              )}
              {error && (
                <div className="text-red-500 text-xs mt-2">{error}</div>
              )}
              <div ref={messagesEndRef} />
            </div>
            {/* Input */}
            <form
              className="flex items-center gap-2 px-4 py-3 bg-white/20 border-t border-white/20"
              onSubmit={e => { e.preventDefault(); handleSend(); }}
            >
              <button type="button" onClick={() => setListening(l => !l)} className={`p-2 rounded-full ${listening ? 'bg-blue-500 text-white' : 'bg-white/40 text-blue-500'} transition-colors`} title="Voice input">
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 bg-transparent outline-none text-blue-900 placeholder-blue-400 px-2 py-2 text-sm"
                disabled={isLoading}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <button type="submit" className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50" disabled={isLoading || !input.trim()} title="Send">
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
