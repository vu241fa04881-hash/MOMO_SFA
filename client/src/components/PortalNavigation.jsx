import React from 'react';
import { 
  GraduationCap, 
  Briefcase, 
  ShieldAlert, 
  LogOut, 
  Volume2, 
  VolumeX, 
  Sun, 
  Moon,
  Crown,
  UserCheck
} from 'lucide-react';

export default function PortalNavigation({
  activePortal, // 'student' | 'faculty' | 'admin'
  adminUser,
  onAdminLogout,
  facultyUser,
  onFacultyLogout,
  isDark,
  onToggleTheme,
  isMuted,
  onToggleMute
}) {
  return (
    <header className="w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-xl px-4 py-2.5 transition-all sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Role-Isolated Portal Branding (Zero cross-portal switching tabs) */}
        <div className="flex items-center gap-3">
          {/* Logo & Portal Branding */}
          <div className="flex items-center gap-2.5 select-none">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-md ${
              activePortal === 'admin'
                ? 'bg-gradient-to-tr from-amber-500 to-rose-600 shadow-amber-500/25'
                : activePortal === 'faculty'
                ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-indigo-500/25'
                : 'bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-cyan-500/25'
            }`}>
              {activePortal === 'admin' ? (
                <ShieldAlert className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              ) : activePortal === 'faculty' ? (
                <Briefcase className="w-4 h-4 text-white stroke-[2.5]" />
              ) : (
                <GraduationCap className="w-4 h-4 text-white stroke-[2.5]" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-white tracking-wider">MOMO</span>
              <span className="text-[10px] text-slate-400 -mt-1 hidden sm:inline">Classroom Space</span>
            </div>
          </div>

          {/* Portal Identifier Badge (Non-interactive indicator of current portal) */}
          {activePortal === 'student' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>Student Portal</span>
            </div>
          )}

          {activePortal === 'faculty' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
              <span>Faculty Portal</span>
              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-full bg-purple-400/20 text-purple-300 border border-purple-400/30 ml-1 font-extrabold">
                Semi-Admin
              </span>
            </div>
          )}

          {activePortal === 'admin' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>Main Admin Portal</span>
              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 ml-1 font-extrabold">
                Super Admin
              </span>
            </div>
          )}
        </div>

        {/* Right: Active Identity Info & Quick Utilities */}
        <div className="flex items-center gap-2">
          {/* Main Admin badge & logout */}
          {adminUser && activePortal === 'admin' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold hidden sm:inline">{adminUser.name || 'Main Admin'}</span>
              <button
                onClick={onAdminLogout}
                title="Logout from Admin Portal"
                className="p-1 hover:bg-amber-500/20 rounded text-amber-300 hover:text-white transition-colors cursor-pointer ml-0.5"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Faculty badge & logout */}
          {facultyUser && activePortal === 'faculty' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-semibold truncate max-w-[130px] hidden sm:inline">{facultyUser.name}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 font-bold">
                {facultyUser.facultyId}
              </span>
              <button
                onClick={onFacultyLogout}
                title="Logout from Faculty Portal"
                className="p-1 hover:bg-indigo-500/20 rounded text-indigo-300 hover:text-white transition-colors cursor-pointer ml-0.5"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Audio toggle */}
          {onToggleMute && (
            <button
              onClick={onToggleMute}
              title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
              className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-300 hover:text-white text-xs transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
            </button>
          )}

          {/* Theme toggle */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={isDark ? 'Light mode' : 'Dark mode'}
              className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-300 hover:text-white text-xs transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-400" />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
