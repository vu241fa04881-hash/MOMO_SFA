import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  ShieldAlert, 
  X, 
  User, 
  Mail,
  Phone,
  Check, 
  ArrowRight, 
  Sparkles, 
  RefreshCw,
  Lock,
  DoorOpen,
  Edit3
} from 'lucide-react';

export default function WaitingRoomOverlay({
  isOpen,
  status, // 'waiting' | 'denied'
  roomCode,
  roomSlug,
  formattedCode,
  hostName,
  userName,
  userRollNumber = '',
  userEmail = '',
  userMobile = '',
  deniedMessage,
  onUpdateProfile,
  onCancelRequest,
  onRequestAgain
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(userName || '');
  const [rollNumber, setRollNumber] = useState(userRollNumber || '');
  const [email, setEmail] = useState(userEmail || '');
  const [mobile, setMobile] = useState(userMobile || '');

  useEffect(() => {
    setName(userName || '');
    setRollNumber(userRollNumber || '');
    setEmail(userEmail || '');
    setMobile(userMobile || '');
  }, [userName, userRollNumber, userEmail, userMobile]);

  if (!isOpen) return null;

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (name.trim()) {
      if (onUpdateProfile) {
        onUpdateProfile({
          name: name.trim(),
          rollNumber: rollNumber.trim(),
          email: email.trim(),
          mobile: mobile.trim()
        });
      }
      setIsEditing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-in fade-in">
      {/* Ambient background glow */}
      <div className="absolute w-72 h-72 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none -top-10 -left-10 animate-pulse" />
      <div className="absolute w-72 h-72 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none -bottom-10 -right-10 animate-pulse" />

      <div className="relative w-full max-w-md rounded-3xl glass-panel p-6 sm:p-8 shadow-2xl border border-white/10 flex flex-col items-center text-center gap-6 z-10">
        {status === 'waiting' ? (
          <>
            {/* Animated Radar Pulse Icon */}
            <div className="relative flex items-center justify-center">
              <div className="absolute w-20 h-20 rounded-full bg-cyan-500/20 animate-ping opacity-75" />
              <div className="absolute w-16 h-16 rounded-full bg-cyan-500/30 animate-pulse" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
                <DoorOpen className="w-7 h-7" />
              </div>
            </div>

            {/* Title & Description */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase font-bold tracking-wider text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20 mx-auto">
                Waiting Room
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                Asking to join...
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
                Waiting for the host <strong className="text-white font-semibold">{hostName || 'User 1'}</strong> to let you into this transfer session.
              </p>
            </div>

            {/* Room target info card */}
            <div className="w-full bg-slate-900/80 p-3.5 rounded-2xl border border-white/5 flex items-center justify-between text-xs">
              <div className="text-left">
                <span className="text-slate-400 block text-[10px] uppercase font-medium tracking-wider">Room Code</span>
                <span className="font-mono font-bold text-white text-sm sm:text-base tracking-wider">{formattedCode || roomCode}</span>
              </div>
              {roomSlug && (
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-medium tracking-wider">Slug</span>
                  <span className="font-mono text-cyan-300 font-medium">{roomSlug}</span>
                </div>
              )}
            </div>

            {/* Profile identification section (Name, Email, Mobile) */}
            <div className="w-full bg-slate-900/70 p-3.5 rounded-2xl border border-white/10 flex flex-col gap-2.5 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Participant Details</span>
                </span>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-cyan-400 hover:text-cyan-300 font-medium text-[11px] flex items-center gap-1 hover:underline"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit Info</span>
                  </button>
                ) : null}
              </div>

              {isEditing ? (
                <form onSubmit={handleSaveProfile} className="flex flex-col gap-2 mt-1">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Student Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Doe"
                      required
                      autoFocus
                      maxLength={35}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Roll Number / Student ID *</label>
                    <input
                      type="text"
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      placeholder="e.g. CS2024-042"
                      required
                      maxLength={25}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Email ID</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. john@example.com"
                      maxLength={50}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      maxLength={20}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition-colors text-center"
                    >
                      Update Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white truncate text-sm">
                      {name || 'Student'}
                    </span>
                    {rollNumber && (
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold">
                        {rollNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-cyan-400" />
                      <span>{email && email !== 'N/A' ? email : 'No email entered'}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-400" />
                      <span>{mobile && mobile !== 'N/A' ? mobile : 'No mobile entered'}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Cancel / Leave button */}
            <div className="w-full pt-1">
              <button
                type="button"
                onClick={onCancelRequest}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-all active:scale-95"
              >
                <X className="w-4 h-4" />
                <span>Cancel Request</span>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Denied State */}
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-1">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase font-bold tracking-wider text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 mx-auto">
                Access Denied
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                Request Declined
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
                {deniedMessage || `The host ${hostName || 'User 1'} declined your request to join this session.`}
              </p>
            </div>

            {/* Actions */}
            <div className="w-full flex flex-col gap-2.5 mt-2">
              <button
                type="button"
                onClick={onRequestAgain}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Ask to Join Again</span>
              </button>

              <button
                type="button"
                onClick={onCancelRequest}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium border border-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-400" />
                <span>Return to Join Screen</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
