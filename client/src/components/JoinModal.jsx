import React, { useState, useEffect } from 'react';
import { X, ArrowRight, KeyRound, Sparkles, User, Mail, Phone } from 'lucide-react';

export default function JoinModal({ 
  isOpen, 
  onClose, 
  onJoinRoom, 
  onGenerateNewRoom,
  userName = '',
  userEmail = '',
  userMobile = '',
  isStudent = false
}) {
  const [inputCode, setInputCode] = useState('');
  const [name, setName] = useState(userName || '');
  const [email, setEmail] = useState(userEmail || '');
  const [mobile, setMobile] = useState(userMobile || '');

  useEffect(() => {
    setName(userName || '');
    setEmail(userEmail || '');
    setMobile(userMobile || '');
  }, [userName, userEmail, userMobile, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    onJoinRoom(inputCode.trim(), {
      name: name.trim() || userName,
      email: email.trim() || userEmail,
      mobile: mobile.trim() || userMobile
    });
    setInputCode('');
    onClose();
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl glass-panel p-6 sm:p-7 shadow-2xl border border-white/10 flex flex-col gap-5"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex flex-col gap-1">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-1">
            <KeyRound className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold text-white">Join Transfer Session</h3>
          <p className="text-xs text-slate-400">
            Enter the 6-digit code or 3-word slug displayed on the host device.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Room Code or Slug *
            </label>
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="e.g. 549 201 or fast-blue-falcon"
              required
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 flex flex-col gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Your Credentials (For Room Attendance)
            </span>

            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Your Name</label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full pl-8.5 pr-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Email ID</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. john@email.com"
                    className="w-full pl-8.5 pr-2.5 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Mobile Number</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full pl-8.5 pr-2.5 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!inputCode.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-40 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
          >
            <span>Request Access & Connect</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {!isStudent && onGenerateNewRoom && (
          <>
            <div className="relative flex py-0.5 items-center">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink mx-4 text-xs uppercase font-semibold text-slate-500">Or</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            {/* Generate New */}
            <button
              onClick={() => {
                onGenerateNewRoom();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium border border-white/10 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Generate Fresh Session Code</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
