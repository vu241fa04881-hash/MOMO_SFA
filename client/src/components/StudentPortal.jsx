import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  DoorOpen, 
  User, 
  Hash, 
  Mail, 
  Phone, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles,
  Users,
  LogOut
} from 'lucide-react';

export default function StudentPortal({
  roomCode,
  userName,
  userRollNumber,
  userEmail,
  userMobile,
  onJoinRoom,
  onLeaveRoom,
  isConnected,
  isAdmitted,
  addToast,
  children
}) {
  // Join form state
  const [inputCode, setInputCode] = useState(roomCode || '');
  const [inputName, setInputName] = useState(userName || '');
  const [inputRollNumber, setInputRollNumber] = useState(userRollNumber || '');
  const [inputEmail, setInputEmail] = useState(userEmail || '');
  const [inputMobile, setInputMobile] = useState(userMobile || '');

  useEffect(() => {
    if (roomCode) setInputCode(roomCode);
  }, [roomCode]);

  useEffect(() => {
    if (userName) setInputName(userName);
  }, [userName]);

  useEffect(() => {
    if (userRollNumber) setInputRollNumber(userRollNumber);
  }, [userRollNumber]);

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (!inputCode.trim()) {
      if (addToast) addToast('Please enter a valid room code', 'warning');
      return;
    }
    if (!inputName.trim()) {
      if (addToast) addToast('Please enter your full name', 'warning');
      return;
    }
    if (!inputRollNumber.trim()) {
      if (addToast) addToast('Please enter your Roll Number / Student ID', 'warning');
      return;
    }

    onJoinRoom({
      roomCode: inputCode.trim(),
      peerName: inputName.trim(),
      rollNumber: inputRollNumber.trim().toUpperCase(),
      email: inputEmail.trim(),
      mobile: inputMobile.trim(),
      role: 'student'
    });
  };

  // IF ROOM IS JOINED AND ADMITTED: RENDER CLASSROOM WORKSPACE
  if (roomCode && isAdmitted) {
    return (
      <div className="flex flex-col gap-4 animate-in fade-in">
        {/* Student Active Session Status Bar */}
        <div className="max-w-7xl mx-auto w-full px-4 pt-2">
          <div className="px-4 py-2 rounded-2xl glass-panel border border-cyan-500/20 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{userName || 'Student'}</span>
                  {userRollNumber && (
                    <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono font-bold text-[10px]">
                      {userRollNumber}
                    </span>
                  )}
                  <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-white/5">
                    Student Mode
                  </span>
                </div>
                <span className="text-slate-400">Classroom Code: <strong className="text-cyan-300 font-mono">{roomCode}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onLeaveRoom}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-colors cursor-pointer"
              >
                <LogOut className="w-3 h-3 text-slate-400" />
                <span>Leave Classroom</span>
              </button>
            </div>
          </div>
        </div>

        {/* Classroom Interactive Workspace */}
        <div className="w-full">
          {children}
        </div>
      </div>
    );
  }

  // IF NOT IN A ROOM: SHOW JOIN CLASSROOM FORM
  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 animate-in fade-in">
      <div className="relative w-full max-w-md rounded-3xl glass-panel p-6 sm:p-8 shadow-2xl border border-cyan-500/30 flex flex-col gap-6 ring-1 ring-cyan-500/20">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30 mb-1">
            <GraduationCap className="w-7 h-7" />
          </div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
            Student Classroom Portal
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Join Live Classroom
          </h2>
          <p className="text-xs text-slate-400 max-w-xs">
            Enter your class room code and student details. The faculty host will review and admit you into the session.
          </p>
        </div>

        <form onSubmit={handleJoinSubmit} className="flex flex-col gap-3.5">
          {/* Room Code */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1 flex items-center gap-1">
              <DoorOpen className="w-3 h-3 text-cyan-400" />
              <span>Room Code or Slug *</span>
            </label>
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Enter Room Code (e.g. 123 456)"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono text-base font-bold tracking-wider placeholder:font-sans placeholder:font-normal placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Student Name */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1 flex items-center gap-1">
                <User className="w-3 h-3 text-cyan-400" />
                <span>Full Name *</span>
              </label>
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="Full Name"
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>

            {/* Roll Number */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Hash className="w-3 h-3 text-cyan-400" />
                <span>Roll No / ID *</span>
              </label>
              <input
                type="text"
                value={inputRollNumber}
                onChange={(e) => setInputRollNumber(e.target.value)}
                placeholder="Roll Number / Student ID"
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono uppercase focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Email */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-400" />
                <span>Email ID (Optional)</span>
              </label>
              <input
                type="email"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                placeholder="student@example.com"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>

            {/* Mobile */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>Mobile (Optional)</span>
              </label>
              <input
                type="tel"
                value={inputMobile}
                onChange={(e) => setInputMobile(e.target.value)}
                placeholder="Mobile Number"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Request Admission / Join Class</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="p-3 rounded-2xl bg-cyan-500/5 border border-cyan-500/15 flex items-center gap-2.5 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Your join request will be sent directly to the faculty host. You will enter as soon as they admit you.</span>
        </div>
      </div>
    </div>
  );
}
