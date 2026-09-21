import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  UserCheck, 
  DoorOpen, 
  Share2, 
  Copy, 
  QrCode, 
  Bell, 
  Lock, 
  Unlock, 
  FileSpreadsheet, 
  ExternalLink, 
  LogOut, 
  Sparkles, 
  Users, 
  Check, 
  X, 
  Play, 
  ArrowLeft,
  BookOpen,
  Crown
} from 'lucide-react';
import { copyToClipboard } from '../utils/helpers';
import { playCopySound } from '../utils/audio';

export default function FacultyPortal({
  facultyUser,
  onFacultyLogin,
  onFacultyLogout,
  onLaunchClassroom,
  onViewRoomAttendance,
  currentRoomCode,
  isHost,
  pendingRequestsCount,
  onOpenRequestsModal,
  onOpenAttendanceModal,
  isRoomLocked,
  onToggleLockRoom,
  addToast,
  children // Active classroom workspace when launched
}) {
  // Login form state
  const [facultyId, setFacultyId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Assigned rooms list
  const [assignedRooms, setAssignedRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  // Load fresh assigned rooms for faculty
  const loadFacultyRooms = async () => {
    if (!facultyUser?.facultyId) return;
    setIsLoadingRooms(true);
    try {
      const res = await fetch(`/api/faculty/${facultyUser.facultyId}/rooms`);
      const data = await res.json();
      if (data.success) {
        setAssignedRooms(data.rooms || []);
      }
    } catch (err) {
      console.error('Failed to load faculty rooms:', err);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (facultyUser) {
      loadFacultyRooms();
    }
  }, [facultyUser]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/faculty/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facultyId, password })
      });
      const data = await res.json();

      if (data.success) {
        onFacultyLogin(data.faculty, data.token);
        if (addToast) addToast(`Welcome back, ${data.faculty.name}!`, 'success');
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch {
      setLoginError('Server connection error. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCopyLink = async (code) => {
    const directUrl = `${window.location.origin}/#code=${code}`;
    await copyToClipboard(directUrl);
    playCopySound();
    if (addToast) addToast(`Student invite link copied for Room ${code}!`, 'success');
  };

  // IF NOT LOGGED IN: SHOW FACULTY LOGIN FORM
  if (!facultyUser) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6">
        <div className="relative w-full max-w-md rounded-3xl glass-panel p-6 sm:p-8 shadow-2xl border border-indigo-500/30 flex flex-col gap-6 ring-1 ring-indigo-500/20">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 mb-1">
              <Briefcase className="w-7 h-7" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              Faculty / Semi-Admin Access
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Faculty Portal
            </h2>
            <p className="text-xs text-slate-400 max-w-xs">
              Log in with credentials provided by the Main Admin to host assigned classrooms and admit students.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold text-center">
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-300 mb-1.5">
                Faculty ID / Username
              </label>
              <input
                type="text"
                value={facultyId}
                onChange={(e) => setFacultyId(e.target.value)}
                placeholder="Faculty ID"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-sm font-mono uppercase focus:outline-none focus:border-indigo-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-300 mb-1.5">
                Faculty Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-400 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isLoggingIn ? 'Authenticating...' : 'Sign In as Faculty'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // IF FACULTY IS CURRENTLY IN AN ACTIVE CLASSROOM SESSION:
  if (currentRoomCode) {
    return (
      <div className="flex flex-col gap-4 animate-in fade-in">
        {/* Semi-Admin Classroom Control Header */}
        <div className="max-w-7xl mx-auto w-full px-4 pt-3">
          <div className="p-3 sm:p-4 rounded-2xl glass-panel border border-indigo-500/30 shadow-lg flex flex-wrap items-center justify-between gap-3">
            {/* Left: Faculty Identity & Role */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onLaunchClassroom('')}
                title="Return to Faculty Dashboard"
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                {facultyUser.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white">{facultyUser.name}</span>
                  <span className="px-2 py-0.2 rounded-full bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-wider flex items-center gap-1">
                    <Crown className="w-2.5 h-2.5" />
                    <span>Host / Semi-Admin</span>
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Room: {currentRoomCode} • {facultyUser.department}
                </span>
              </div>
            </div>

            {/* Right: Semi-Admin Controls (Knocks, Attendance, Lock) */}
            <div className="flex items-center gap-2">
              {/* Student Knock Alert button */}
              {pendingRequestsCount > 0 ? (
                <button
                  onClick={onOpenRequestsModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30 animate-pulse transition-all active:scale-95 cursor-pointer"
                >
                  <Bell className="w-4 h-4 fill-slate-950" />
                  <span>{pendingRequestsCount} Student{pendingRequestsCount > 1 ? 's' : ''} Waiting</span>
                </button>
              ) : (
                <button
                  onClick={onOpenRequestsModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>0 Waiting</span>
                </button>
              )}

              {/* Attendance Log button */}
              <button
                onClick={onOpenAttendanceModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold shadow-inner transition-all active:scale-95 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Attendance Log</span>
              </button>

              {/* Toggle Room Lock button */}
              {onToggleLockRoom && (
                <button
                  onClick={onToggleLockRoom}
                  title={isRoomLocked ? 'Unlock room to accept new students' : 'Lock room to prevent new entries'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isRoomLocked 
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                      : 'bg-slate-900 border border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  {isRoomLocked ? <Lock className="w-3.5 h-3.5 text-rose-400" /> : <Unlock className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{isRoomLocked ? 'Locked' : 'Unlocked'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* The active collaborative transfer workspace */}
        <div className="w-full">
          {children}
        </div>
      </div>
    );
  }

  // FACULTY DASHBOARD: LIST OF ASSIGNED ROOMS
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6 animate-in fade-in">
      {/* Faculty Profile Hero */}
      <div className="rounded-3xl glass-panel p-6 border border-white/10 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-indigo-500/25 shrink-0">
            {facultyUser.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {facultyUser.name}
              </h2>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                Faculty Semi-Admin
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
              <span className="font-mono text-cyan-300 font-bold">ID: {facultyUser.facultyId}</span>
              <span>•</span>
              <span>{facultyUser.department || 'Academic Department'}</span>
              {facultyUser.email && (
                <>
                  <span>•</span>
                  <span>{facultyUser.email}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onFacultyLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Assigned Classrooms Hub */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <DoorOpen className="w-5 h-5 text-indigo-400" />
              <span>Your Authorized Classrooms</span>
            </h3>
            <p className="text-xs text-slate-400">
              Assigned by Main Admin. Click "Launch Classroom" to host the session and approve students.
            </p>
          </div>
        </div>

        {assignedRooms.length === 0 ? (
          <div className="rounded-3xl glass-panel p-10 border border-white/10 text-center flex flex-col items-center gap-2 text-slate-400">
            <DoorOpen className="w-10 h-10 text-slate-600 mb-1" />
            <span className="text-sm font-semibold text-white">No rooms assigned yet</span>
            <p className="text-xs text-slate-500 max-w-xs">
              Contact the Main Admin to assign a classroom space to your faculty account ({facultyUser.facultyId}).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {assignedRooms.map((room) => (
              <div
                key={room.code}
                className="rounded-3xl glass-panel p-5 border border-white/10 hover:border-indigo-500/40 transition-all flex flex-col gap-4 shadow-xl shadow-slate-950/20 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] uppercase font-bold tracking-wider text-indigo-400 block">
                      Classroom Space
                    </span>
                    <h4 className="text-base font-black text-white mt-0.5 group-hover:text-indigo-200 transition-colors">
                      {room.roomName}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-white/10 text-[11px] font-mono text-slate-300">
                    <Users className="w-3 h-3 text-cyan-400" />
                    <span>{room.activeStudents || 0} students</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block">Room Code</span>
                    <span className="text-lg font-black font-mono tracking-wider text-white select-all">
                      {room.formattedCode || room.code}
                    </span>
                  </div>
                  {room.slug && (
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Room Slug</span>
                      <span className="text-xs font-mono text-cyan-300 font-medium">{room.slug}</span>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleCopyLink(room.code)}
                    className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Copy Student Invite Link"
                  >
                    <Copy className="w-3 h-3 text-cyan-400" />
                    <span className="hidden sm:inline">Link</span>
                  </button>

                  <button
                    onClick={() => onViewRoomAttendance && onViewRoomAttendance(room.code)}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="View and manage student attendance logs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Attendance</span>
                  </button>

                  <button
                    onClick={() => onLaunchClassroom(room.code)}
                    className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Launch</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
