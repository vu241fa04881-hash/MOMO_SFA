import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  Crown, 
  Users, 
  DoorOpen, 
  FileSpreadsheet, 
  Plus, 
  Key, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  Check, 
  Trash2, 
  RefreshCw, 
  Search, 
  ExternalLink, 
  Copy, 
  BookOpen, 
  UserCheck, 
  Activity, 
  LogOut,
  Mail,
  Phone,
  Layers,
  Sparkles,
  Settings,
  ShieldCheck,
  Briefcase,
  GraduationCap,
  Pencil,
  Edit3
} from 'lucide-react';
import { copyToClipboard } from '../utils/helpers';
import { playCopySound } from '../utils/audio';

export default function AdminPortal({
  adminUser,
  onAdminLogin,
  onAdminLogout,
  addToast,
  onLaunchRoom
}) {
  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Admin Dashboard state
  const [activeTab, setActiveTab] = useState('faculty'); // 'faculty' | 'rooms' | 'attendance' | 'admins'
  const [stats, setStats] = useState(null);
  const [faculties, setFaculties] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [globalAttendance, setGlobalAttendance] = useState([]);
  const facultyAttendance = useMemo(() => {
    return (globalAttendance || []).filter(item => item.isHost || item.role?.includes('Faculty') || item.role === 'Faculty (Host)');
  }, [globalAttendance]);
  const [superAdmins, setSuperAdmins] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [clearingFacultyLogs, setClearingFacultyLogs] = useState(false);

  // Modals
  const [isAddFacultyOpen, setIsAddFacultyOpen] = useState(false);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isEditRoomOpen, setIsEditRoomOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [editRoomCode, setEditRoomCode] = useState('');
  const [editRoomName, setEditRoomName] = useState('');
  const [editRoomFacultyId, setEditRoomFacultyId] = useState('');
  const [isUpdatingRoom, setIsUpdatingRoom] = useState(false);
  const [editRoomError, setEditRoomError] = useState('');

  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [showProfilePass, setShowProfilePass] = useState({ current: false, next: false, confirm: false });

  // New Faculty Form State
  const [newFacId, setNewFacId] = useState('');
  const [newFacName, setNewFacName] = useState('');
  const [newFacPass, setNewFacPass] = useState('');
  const [newFacEmail, setNewFacEmail] = useState('');
  const [newFacDept, setNewFacDept] = useState('');
  const [newFacRoomName, setNewFacRoomName] = useState('');
  const [newFacRoomCode, setNewFacRoomCode] = useState('');

  // New Room Form State
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomFacultyId, setNewRoomFacultyId] = useState('');

  // New Super Admin Form State
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  // Profile Edit Form State
  const [profileName, setProfileName] = useState(adminUser?.name || '');
  const [profileUsername, setProfileUsername] = useState(adminUser?.username || '');
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (adminUser) {
      setProfileName(adminUser.name || '');
      setProfileUsername(adminUser.username || '');
    }
  }, [adminUser]);

  // Load Admin Data when authenticated
  const loadAdminData = async () => {
    if (!adminUser) return;
    setIsLoadingData(true);
    try {
      const [statsRes, facRes, roomsRes, attRes, adminRes] = await Promise.all([
        fetch('/api/admin/system-stats').then(r => r.json()),
        fetch('/api/admin/faculties').then(r => r.json()),
        fetch('/api/admin/rooms').then(r => r.json()),
        fetch('/api/admin/global-attendance').then(r => r.json()),
        fetch('/api/admin/super-admins').then(r => r.json())
      ]);

      if (statsRes) setStats(statsRes);
      if (facRes.success) setFaculties(facRes.faculties || []);
      if (roomsRes.success) setRoomsList(roomsRes.rooms || []);
      if (attRes.success) setGlobalAttendance(attRes.attendance || []);
      if (adminRes?.success) setSuperAdmins(adminRes.superAdmins || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      if (addToast) addToast('Failed to sync admin records', 'error');
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (adminUser) {
      loadAdminData();
    }
  }, [adminUser]);

  // Handle Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        onAdminLogin(data.user, data.token);
        if (addToast) addToast('Welcome, Master System Administrator!', 'success');
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch {
      setLoginError('Server connection error. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Toggle Password Visibility
  const togglePasswordVisibility = (facId) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [facId]: !prev[facId]
    }));
  };

  // Handle Create Faculty
  const handleCreateFaculty = async (e) => {
    e.preventDefault();
    if (!newFacId.trim() || !newFacName.trim() || !newFacPass.trim()) {
      if (addToast) addToast('Please fill in required fields', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/admin/faculty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facultyId: newFacId.trim(),
          password: newFacPass.trim(),
          name: newFacName.trim(),
          email: newFacEmail.trim(),
          department: newFacDept.trim(),
          roomName: newFacRoomName.trim(),
          assignedRoomCode: newFacRoomCode.trim()
        })
      });
      const data = await res.json();

      if (data.success) {
        if (addToast) addToast(`Faculty ${data.faculty.name} (${data.faculty.facultyId}) created successfully!`, 'success');
        setIsAddFacultyOpen(false);
        // Reset form
        setNewFacId('');
        setNewFacName('');
        setNewFacPass('');
        setNewFacEmail('');
        setNewFacDept('');
        setNewFacRoomName('');
        setNewFacRoomCode('');
        loadAdminData();
      } else {
        if (addToast) addToast(data.error || 'Failed to create faculty', 'error');
      }
    } catch {
      if (addToast) addToast('Network error while creating faculty', 'error');
    }
  };

  // Handle Delete Faculty
  const handleDeleteFaculty = async (facultyId, name) => {
    if (!window.confirm(`Are you sure you want to delete faculty ${name} (${facultyId})?`)) return;

    try {
      const res = await fetch(`/api/admin/faculty/${facultyId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        if (addToast) addToast(`Faculty ${facultyId} deleted`, 'info');
        loadAdminData();
      } else {
        if (addToast) addToast(data.error || 'Delete failed', 'error');
      }
    } catch {
      if (addToast) addToast('Network error', 'error');
    }
  };

  // Handle Toggle Faculty Status
  const handleToggleFacultyActive = async (faculty) => {
    try {
      const res = await fetch(`/api/admin/faculty/${faculty.facultyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !faculty.isActive })
      });
      const data = await res.json();
      if (data.success) {
        if (addToast) addToast(`Faculty ${faculty.name} is now ${!faculty.isActive ? 'Active' : 'Deactivated'}`, 'info');
        loadAdminData();
      }
    } catch {
      if (addToast) addToast('Failed to update faculty status', 'error');
    }
  };

  // Handle Create Room
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: newRoomName.trim() || 'New Classroom',
          assignedFacultyId: newRoomFacultyId || null
        })
      });
      const data = await res.json();
      if (data.success) {
        if (addToast) addToast(`Room ${data.room.formattedCode} created!`, 'success');
        setIsCreateRoomOpen(false);
        setNewRoomName('');
        setNewRoomFacultyId('');
        loadAdminData();
      }
    } catch {
      if (addToast) addToast('Failed to create room', 'error');
    }
  };

  // Handle Open Edit Room
  const handleOpenEditRoom = (room) => {
    setEditingRoom(room);
    setEditRoomCode(room.code || '');
    setEditRoomName(room.roomName || '');
    setEditRoomFacultyId(room.assignedFacultyId || '');
    setEditRoomError('');
    setIsEditRoomOpen(true);
  };

  // Handle Save Edit Room
  const handleSaveEditRoom = async (e) => {
    e.preventDefault();
    if (!editingRoom) return;
    if (!editRoomCode.trim()) {
      setEditRoomError('Room code cannot be empty');
      return;
    }
    setIsUpdatingRoom(true);
    setEditRoomError('');
    try {
      const res = await fetch(`/api/admin/rooms/${editingRoom.code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newRoomCode: editRoomCode.trim(),
          roomName: editRoomName.trim(),
          assignedFacultyId: editRoomFacultyId || null
        })
      });
      const data = await res.json();
      if (data.success) {
        if (addToast) addToast(`Classroom ${data.room?.formattedCode || editRoomCode} updated successfully!`, 'success');
        setIsEditRoomOpen(false);
        setEditingRoom(null);
        loadAdminData();
      } else {
        setEditRoomError(data.error || 'Failed to update classroom');
      }
    } catch {
      setEditRoomError('Server error updating classroom. Please try again.');
    } finally {
      setIsUpdatingRoom(false);
    }
  };

  // Handle Delete Room
  const handleDeleteRoom = async (roomCode, roomName) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete classroom "${roomName || roomCode}" (${roomCode})?\n\nThis will remove the allotment, disconnect all active students and faculty, and purge room items.`
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/rooms/${roomCode}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        if (addToast) addToast(`Classroom ${roomCode} deleted successfully!`, 'success');
        loadAdminData();
      } else {
        if (addToast) addToast(data.error || 'Failed to delete room', 'error');
      }
    } catch {
      if (addToast) addToast('Server error deleting classroom', 'error');
    }
  };

  // Handle Delete Single Attendance Record (Faculty Login Log)
  const handleDeleteAttendanceRecord = async (id, facultyName, roomCode) => {
    // Optimistically update UI immediately
    setGlobalAttendance(prev => prev.filter(item => item.id !== id));
    if (addToast) addToast(`Login record deleted (${facultyName || 'Faculty'})`, 'success');

    try {
      const res = await fetch(`/api/attendance/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!data.success) {
        if (addToast) addToast(data.error || 'Failed to delete record', 'error');
        loadAdminData(); // re-sync if failed
      }
    } catch {
      if (addToast) addToast('Server error deleting login record', 'error');
      loadAdminData();
    }
  };

  // Handle Clear All Faculty Attendance Records (Inline 2-step confirmation)
  const handleClearAllFacultyAttendance = async () => {
    if (!clearingFacultyLogs) {
      setClearingFacultyLogs(true);
      setTimeout(() => setClearingFacultyLogs(false), 4000);
      return;
    }
    setClearingFacultyLogs(false);

    // Optimistically clear UI immediately
    setGlobalAttendance([]);
    if (addToast) addToast('All faculty login logs cleared successfully', 'success');

    try {
      const res = await fetch('/api/admin/attendance', {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!data.success) {
        if (addToast) addToast(data.error || 'Failed to clear logs', 'error');
        loadAdminData();
      }
    } catch {
      if (addToast) addToast('Server error clearing login logs', 'error');
      loadAdminData();
    }
  };

  const handleCopyLink = async (code) => {
    const directUrl = `${window.location.origin}/#code=${code}`;
    await copyToClipboard(directUrl);
    playCopySound();
    if (addToast) addToast(`Room invite link copied: ${code}`, 'success');
  };

  // Handle Create Super Admin
  const handleCreateSuperAdmin = async (e) => {
    e.preventDefault();
    if (!newAdminUsername.trim() || !newAdminPassword.trim() || !newAdminName.trim()) {
      if (addToast) addToast('Please fill in all required fields', 'warning');
      return;
    }
    setIsCreatingAdmin(true);
    try {
      const res = await fetch('/api/admin/super-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAdminName.trim(),
          username: newAdminUsername.trim(),
          password: newAdminPassword.trim(),
          email: newAdminEmail.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        if (addToast) addToast(`Super Admin "${data.superAdmin.name}" added successfully!`, 'success');
        setIsAddAdminOpen(false);
        setNewAdminName('');
        setNewAdminUsername('');
        setNewAdminPassword('');
        setNewAdminEmail('');
        loadAdminData();
      } else {
        if (addToast) addToast(data.error || 'Failed to add Super Admin', 'error');
      }
    } catch {
      if (addToast) addToast('Server connection error creating Super Admin', 'error');
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  // Handle Delete Super Admin
  const handleDeleteSuperAdmin = async (adminId, adminUsername, adminName) => {
    if (!window.confirm(`Are you sure you want to remove Super Admin "${adminName}" (@${adminUsername})?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/super-admins/${adminId}`, {
        method: 'DELETE',
        headers: {
          'x-admin-username': adminUser?.username || ''
        }
      });
      const data = await res.json();
      if (data.success) {
        if (addToast) addToast(data.message || 'Super Admin removed', 'info');
        loadAdminData();
      } else {
        if (addToast) addToast(data.error || 'Failed to remove Super Admin', 'error');
      }
    } catch {
      if (addToast) addToast('Server error deleting Super Admin', 'error');
    }
  };

  // Handle Update Profile / Credentials
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError('');

    if (profileNewPassword && profileNewPassword !== profileConfirmPassword) {
      setProfileError('New passwords do not match');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUsername: adminUser?.username,
          currentPassword: profileCurrentPassword,
          newUsername: profileUsername.trim() || undefined,
          newPassword: profileNewPassword.trim() || undefined,
          name: profileName.trim() || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        if (addToast) addToast('Credentials & profile updated successfully!', 'success');
        onAdminLogin(data.user, localStorage.getItem('momo_admin_token') || 'admin_token');
        setIsProfileOpen(false);
        setProfileCurrentPassword('');
        setProfileNewPassword('');
        setProfileConfirmPassword('');
        loadAdminData();
      } else {
        setProfileError(data.error || 'Failed to update credentials');
      }
    } catch {
      setProfileError('Server connection error. Please try again.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // IF NOT AUTHENTICATED: SHOW ADMIN LOGIN CARD
  if (!adminUser) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 animate-in fade-in">
        <div className="relative w-full max-w-md rounded-3xl glass-panel p-6 sm:p-8 shadow-2xl border border-amber-500/30 flex flex-col gap-6 ring-1 ring-amber-500/20">
          {/* Header */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/30 mb-1">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              Super Admin Authentication
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Main Admin Portal
            </h2>
            <p className="text-xs text-slate-400 max-w-xs">
              Manage faculty credentials, generate classrooms, assign room access & monitor institutional attendance.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold text-center">
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-300 mb-1.5">
                Admin Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Admin Username"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-300 mb-1.5">
                Admin Master Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isLoggingIn ? 'Verifying Credentials...' : 'Sign In as Main Admin'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // AUTHENTICATED MAIN ADMIN DASHBOARD
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 sm:py-6 flex flex-col gap-6 animate-in fade-in">
      {/* Top Banner & Stats Overview */}
      <div className="rounded-3xl glass-panel p-6 border border-white/10 shadow-xl flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 shrink-0">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Main System Administration
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full">
                  Super Admin
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                Logged in as <strong className="text-amber-300">{adminUser?.name || 'Administrator'}</strong> (<span className="font-mono text-slate-300">@{adminUser?.username}</span>) &bull; Institutional administration, room authority & access control.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setProfileName(adminUser?.name || '');
                setProfileUsername(adminUser?.username || '');
                setProfileCurrentPassword('');
                setProfileNewPassword('');
                setProfileConfirmPassword('');
                setProfileError('');
                setIsProfileOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              title="Change Username & Password"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Account & Password</span>
            </button>
            <button
              onClick={loadAdminData}
              disabled={isLoadingData}
              className="p-2.5 rounded-xl bg-slate-900 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onAdminLogout}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 flex flex-col gap-1">
            <span className="text-[11px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Faculty Accounts</span>
            </span>
            <span className="text-2xl font-black text-white font-mono">
              {stats?.totalFaculties ?? faculties.length}
            </span>
            <span className="text-[11px] text-slate-500">Authorized semi-admins</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 flex flex-col gap-1">
            <span className="text-[11px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <DoorOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>Classrooms / Rooms</span>
            </span>
            <span className="text-2xl font-black text-white font-mono">
              {stats?.totalRooms ?? roomsList.length}
            </span>
            <span className="text-[11px] text-slate-500">Active peer-to-peer spaces</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 flex flex-col gap-1">
            <span className="text-[11px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Live Students</span>
            </span>
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {stats?.totalStudentsLive ?? 0}
            </span>
            <span className="text-[11px] text-slate-500">Connected in sessions now</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 flex flex-col gap-1">
            <span className="text-[11px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Super Admins</span>
            </span>
            <span className="text-2xl font-black text-amber-300 font-mono">
              {superAdmins.length}
            </span>
            <span className="text-[11px] text-slate-500">System administrators</span>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center p-1 bg-slate-900/90 rounded-2xl border border-white/10 shadow-inner gap-1">
          <button
            onClick={() => setActiveTab('faculty')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'faculty'
                ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white light-tab-inactive'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Faculty Credentials ({faculties.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('rooms')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'rooms'
                ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white light-tab-inactive'
            }`}
          >
            <DoorOpen className="w-4 h-4" />
            <span>Room Access & Spaces ({roomsList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white light-tab-inactive'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Faculty Attendance ({facultyAttendance.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('admins')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'admins'
                ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white light-tab-inactive'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Super Admins ({superAdmins.length})</span>
          </button>
        </div>

        {/* Tab Actions */}
        <div className="flex items-center gap-2">
          {activeTab === 'faculty' && (
            <button
              onClick={() => setIsAddFacultyOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Faculty</span>
            </button>
          )}

          {activeTab === 'rooms' && (
            <button
              onClick={() => setIsCreateRoomOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Generate Room</span>
            </button>
          )}

          {activeTab === 'admins' && (
            <button
              onClick={() => setIsAddAdminOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Super Admin</span>
            </button>
          )}

          {activeTab === 'attendance' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearAllFacultyAttendance}
                disabled={facultyAttendance.length === 0}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                  clearingFacultyLogs
                    ? 'bg-rose-600 text-white border border-rose-500 animate-pulse shadow-lg shadow-rose-500/30'
                    : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 disabled:opacity-40'
                }`}
                title={clearingFacultyLogs ? 'Click again to confirm clearing all logs' : 'Delete all faculty login logs'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{clearingFacultyLogs ? 'Confirm Clear All?' : 'Clear All Logs'}</span>
              </button>

              <a
                href="/api/admin/global-attendance/excel"
                download
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs shadow-inner transition-all active:scale-95"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Export Faculty Attendance (.xlsx)</span>
              </a>
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: FACULTY CREDENTIAL MANAGEMENT */}
      {activeTab === 'faculty' && (
        <div className="rounded-3xl glass-panel p-5 sm:p-6 border border-white/10 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Faculty Accounts & Login Credentials
              </h3>
              <p className="text-xs text-slate-400">
                Main admin generates and gives these credentials to faculty. Faculty log in to act as Semi-Admin Hosts.
              </p>
            </div>
          </div>

          {/* Faculty Table */}
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-slate-900/90 text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3 px-4">Faculty Member</th>
                  <th className="py-3 px-4">Faculty ID / Login</th>
                  <th className="py-3 px-4">Password</th>
                  <th className="py-3 px-4">Assigned Room(s)</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {faculties.map((fac) => {
                  const isPassVisible = Boolean(visiblePasswords[fac.facultyId]);
                  return (
                    <tr key={fac.facultyId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-xs shrink-0">
                            {fac.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-white block">{fac.name}</span>
                            <span className="text-[11px] text-slate-400">{fac.department || 'Faculty'}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 text-xs">
                          {fac.facultyId}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-300">
                            {isPassVisible ? fac.password : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(fac.facultyId)}
                            title={isPassVisible ? 'Hide Password' : 'Show Credentials to Give to Faculty'}
                            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {fac.assignedRooms && fac.assignedRooms.length > 0 ? (
                            fac.assignedRooms.map((code) => (
                              <button
                                key={code}
                                onClick={() => handleCopyLink(code)}
                                title="Click to copy student invite link"
                                className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-lg bg-slate-800 text-slate-200 border border-white/5 hover:border-cyan-500/40 transition-colors cursor-pointer"
                              >
                                <span>{code}</span>
                                <Copy className="w-2.5 h-2.5 text-slate-400" />
                              </button>
                            ))
                          ) : (
                            <span className="text-slate-500 italic text-xs">No rooms assigned</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-3.5 text-center">
                        <button
                          onClick={() => handleToggleFacultyActive(fac)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                            fac.isActive
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                          }`}
                        >
                          <span>{fac.isActive ? 'Active' : 'Disabled'}</span>
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteFaculty(fac.facultyId, fac.name)}
                          title="Delete Faculty Account"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ROOM ACCESS & SPACES */}
      {activeTab === 'rooms' && (() => {
        // Collect all room codes assigned to any faculty in the faculties state
        const facultyAssignedCodes = new Set();
        const facultyByCode = new Map();
        faculties.forEach(fac => {
          (fac.assignedRooms || []).forEach(code => {
            const clean = String(code).replace(/[\s-]/g, '').toLowerCase();
            facultyAssignedCodes.add(clean);
            facultyByCode.set(clean, fac);
          });
        });

        // Combine live rooms from roomsList with assigned faculty records
        const allClassrooms = roomsList.map(r => {
          const cleanCode = String(r.code || '').replace(/[\s-]/g, '').toLowerCase();
          const cleanSlug = String(r.slug || '').replace(/[\s-]/g, '').toLowerCase();
          const matchedFac = facultyByCode.get(cleanCode) || facultyByCode.get(cleanSlug);
          return {
            ...r,
            isFacultyAssigned: Boolean(r.isFacultyAssigned || matchedFac),
            roomCategory: 'faculty',
            assignedFacultyId: r.assignedFacultyId || (matchedFac ? matchedFac.facultyId : null),
            assignedFacultyName: r.assignedFacultyName || (matchedFac ? matchedFac.name : 'Unassigned (Admin Space)')
          };
        });

        // Add any faculty assigned rooms from faculties that aren't yet active in roomsList
        faculties.forEach(fac => {
          (fac.assignedRooms || []).forEach(code => {
            const clean = String(code).replace(/[\s-]/g, '').toLowerCase();
            const exists = allClassrooms.some(r => String(r.code).replace(/[\s-]/g, '').toLowerCase() === clean);
            if (!exists && code) {
              const formattedCode = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
              allClassrooms.push({
                code: String(code),
                formattedCode,
                roomName: `${fac.department || 'Classroom'} - ${fac.name}`,
                roomCategory: 'faculty',
                isFacultyAssigned: true,
                assignedFacultyId: fac.facultyId,
                assignedFacultyName: fac.name,
                hostName: fac.name,
                isLocked: false,
                activePeersCount: 0,
                activeStudentsCount: 0,
                waitingCount: 0,
                itemsCount: 0,
                ttlMinutes: 15
              });
            }
          });
        });

        return (
          <div className="rounded-3xl glass-panel p-5 sm:p-6 border border-white/10 flex flex-col gap-6 shadow-xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>Allotted Classrooms & Spaces</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {allClassrooms.length} Total Classrooms
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Institutional lecture spaces allotted to faculty members or managed directly by admin.
                </p>
              </div>
            </div>

            {allClassrooms.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900/50 border border-dashed border-indigo-500/20 text-center flex flex-col items-center justify-center gap-2">
                <DoorOpen className="w-8 h-8 text-indigo-400/50" />
                <p className="text-xs text-slate-400">No allotted classrooms active yet.</p>
                <button
                  onClick={() => setIsCreateRoomOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold cursor-pointer"
                >
                  + Generate Classroom
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allClassrooms.map((room) => (
                  <div
                    key={room.code}
                    className="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/30 hover:border-indigo-400/60 transition-all flex flex-col gap-3 shadow-md shadow-indigo-950/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                            <Briefcase className="w-2.5 h-2.5" />
                            <span>{room.isFacultyAssigned ? 'Faculty Allotted' : 'Institutional'}</span>
                          </span>
                          {room.isLocked && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Locked
                            </span>
                          )}
                        </div>
                        <h5 className="font-bold text-white text-sm">
                          {room.roomName}
                        </h5>
                        <span className="font-mono text-indigo-300 font-bold text-base block mt-0.5">
                          {room.formattedCode || room.code}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        room.activePeersCount > 0
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {room.activePeersCount > 0 ? `${room.activePeersCount} Live` : 'Idle'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 flex flex-col gap-1 border-t border-white/5 pt-2">
                      <div className="flex justify-between">
                        <span>Faculty Host:</span>
                        <span className="text-indigo-300 font-medium">
                          {room.assignedFacultyName || 'Unassigned'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Live Students:</span>
                        <span className="text-emerald-400 font-bold">{room.activeStudentsCount || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Waiting in Knock Queue:</span>
                        <span className="text-amber-400 font-bold">{room.waitingCount || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                      <button
                        onClick={() => handleCopyLink(room.code)}
                        title="Copy student invite link"
                        className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3 text-indigo-400" />
                        <span>Invite</span>
                      </button>

                      <button
                        onClick={() => onLaunchRoom(room.code)}
                        title="Inspect classroom session"
                        className="py-1.5 px-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>Inspect</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>

                      <button
                        onClick={() => handleOpenEditRoom(room)}
                        title="Change Allotted Room (Name & Faculty Reassignment)"
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-white/10 transition-colors flex items-center justify-center cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteRoom(room.code, room.roomName)}
                        title="Delete Allotted Room"
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-white/10 transition-colors flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 3: FACULTY ATTENDANCE LOG */}
      {activeTab === 'attendance' && (
        <div className="rounded-3xl glass-panel p-5 sm:p-6 border border-white/10 flex flex-col gap-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Faculty Attendance Log
              </h3>
              <p className="text-xs text-slate-400">
                Consolidated faculty login & exit timestamps, classroom sessions, and durations across all faculty rooms.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search faculty ID, name, room..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 max-h-[55vh]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-slate-900/90 sticky top-0 text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3 px-3.5 text-center w-10">#</th>
                  <th className="py-3 px-3.5">Room</th>
                  <th className="py-3 px-4">Faculty Member</th>
                  <th className="py-3 px-3.5">Faculty ID</th>
                  <th className="py-3 px-3.5">Role</th>
                  <th className="py-3 px-4">Login Time</th>
                  <th className="py-3 px-4">Exit Time</th>
                  <th className="py-3 px-3.5">Duration</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {facultyAttendance
                  .filter(item => {
                    if (!searchTerm.trim()) return true;
                    const term = searchTerm.toLowerCase();
                    return (
                      (item.name && item.name.toLowerCase().includes(term)) ||
                      (item.rollNumber && item.rollNumber.toLowerCase().includes(term)) ||
                      (item.roomCode && item.roomCode.toLowerCase().includes(term)) ||
                      (item.hostName && item.hostName.toLowerCase().includes(term))
                    );
                  })
                  .map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3.5 text-center font-mono text-slate-500 text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-cyan-300">
                        {item.roomCode}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {item.name || 'Faculty Host'}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-xs">
                        {item.rollNumber && item.rollNumber !== 'N/A' ? (
                          <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                            {item.rollNumber}
                          </span>
                        ) : (
                          <span className="text-slate-500">FACULTY</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                          {item.role || 'Faculty (Host)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(item.joinedAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {item.exitedAt ? (
                          <span className="text-slate-300">{new Date(item.exitedAt).toLocaleString()}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Active Now
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-cyan-300 font-bold">
                        {item.duration || 'Live'}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'Active'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {item.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <button
                          onClick={() => handleDeleteAttendanceRecord(item.id, item.name, item.roomCode)}
                          title="Delete this login log"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                {facultyAttendance.length === 0 && (
                  <tr>
                    <td colSpan="10" className="py-10 text-center text-slate-500">
                      No faculty attendance records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SUPER ADMINISTRATORS */}
      {activeTab === 'admins' && (
        <div className="rounded-3xl glass-panel p-5 sm:p-6 border border-white/10 flex flex-col gap-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Institutional Super Administrators</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {superAdmins.length} Active
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Super Admins hold authority to create faculty, assign rooms, export attendance, and add further administrators.
              </p>
            </div>

            <button
              onClick={() => setIsAddAdminOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Super Admin</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 border-b border-white/5 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Super Admin</th>
                  <th className="py-3 px-4 font-mono">Username</th>
                  <th className="py-3 px-4">Role & Privileges</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {superAdmins.map((admin) => {
                  const isCurrent = adminUser?.username?.toLowerCase() === admin.username?.toLowerCase();
                  return (
                    <tr key={admin.id || admin.username} className={`hover:bg-white/[0.02] transition-colors ${isCurrent ? 'bg-amber-500/[0.04]' : ''}`}>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            admin.isRoot
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}>
                            <Crown className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-white">
                              <span>{admin.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">{admin.email || 'No email specified'}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-amber-300 font-semibold">
                        @{admin.username}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          admin.isRoot
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                            : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        }`}>
                          <ShieldCheck className="w-3 h-3" />
                          <span>{admin.isRoot ? 'Primary Super Admin' : 'Super Admin'}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : 'Initial'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {isCurrent ? (
                          <button
                            onClick={() => {
                              setProfileName(adminUser?.name || '');
                              setProfileUsername(adminUser?.username || '');
                              setProfileCurrentPassword('');
                              setProfileNewPassword('');
                              setProfileConfirmPassword('');
                              setProfileError('');
                              setIsProfileOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            <Key className="w-3 h-3" />
                            <span>Edit Password</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeleteSuperAdmin(admin.id, admin.username, admin.name)}
                            disabled={superAdmins.length <= 1}
                            title={superAdmins.length <= 1 ? 'Cannot delete the only Super Admin' : 'Remove Super Admin Account'}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW FACULTY */}
      {isAddFacultyOpen && (
        <div 
          onClick={() => setIsAddFacultyOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl glass-panel p-6 shadow-2xl border border-indigo-500/30 flex flex-col gap-5 ring-1 ring-indigo-500/20"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add New Faculty (Semi-Admin)</h3>
                  <p className="text-xs text-slate-400">Create login credentials and grant classroom access</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddFacultyOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFaculty} className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Faculty ID *</label>
                  <input
                    type="text"
                    value={newFacId}
                    onChange={(e) => setNewFacId(e.target.value)}
                    placeholder="Faculty ID"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono uppercase focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Password *</label>
                  <input
                    type="text"
                    value={newFacPass}
                    onChange={(e) => setNewFacPass(e.target.value)}
                    placeholder="Password"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Full Name & Title *</label>
                <input
                  type="text"
                  value={newFacName}
                  onChange={(e) => setNewFacName(e.target.value)}
                  placeholder="Faculty Name & Title"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Department</label>
                  <input
                    type="text"
                    value={newFacDept}
                    onChange={(e) => setNewFacDept(e.target.value)}
                    placeholder="Department"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Email ID</label>
                  <input
                    type="email"
                    value={newFacEmail}
                    onChange={(e) => setNewFacEmail(e.target.value)}
                    placeholder="Email Address"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col gap-2">
                <span className="text-[11px] font-bold text-indigo-300">Classroom Space Assignment</span>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Classroom / Subject Name</label>
                  <input
                    type="text"
                    value={newFacRoomName}
                    onChange={(e) => setNewFacRoomName(e.target.value)}
                    placeholder="Classroom Name (e.g. Operating Systems)"
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Custom Room Code (Optional, leave blank to auto-generate)</label>
                  <input
                    type="text"
                    value={newFacRoomCode}
                    onChange={(e) => setNewFacRoomCode(e.target.value)}
                    placeholder="Leave blank to auto-generate"
                    maxLength={10}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-500/20 cursor-pointer"
                >
                  Create Faculty & Assign Room
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddFacultyOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE ROOM */}
      {isCreateRoomOpen && (
        <div 
          onClick={() => setIsCreateRoomOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl glass-panel p-6 shadow-2xl border border-cyan-500/30 flex flex-col gap-4 ring-1 ring-cyan-500/20"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Generate Classroom Space</h3>
              <button 
                onClick={() => setIsCreateRoomOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="flex flex-col gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Classroom Name *</label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. CS401: Cloud Computing"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Assign to Faculty</label>
                <select
                  value={newRoomFacultyId}
                  onChange={(e) => setNewRoomFacultyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                >
                  <option value="">-- Leave Unassigned --</option>
                  {faculties.map((f) => (
                    <option key={f.facultyId} value={f.facultyId}>
                      {f.name} ({f.facultyId}) - {f.department}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  Create Classroom
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateRoomOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT / REASSIGN ALLOTTED ROOM */}
      {isEditRoomOpen && editingRoom && (
        <div 
          onClick={() => setIsEditRoomOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl glass-panel p-6 shadow-2xl border border-indigo-500/30 flex flex-col gap-4 ring-1 ring-indigo-500/20"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Change Allotted Classroom</h3>
                  <p className="text-xs text-slate-400">Update room code, classroom title, or reassign faculty</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditRoomOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditRoom} className="flex flex-col gap-3.5">
              {editRoomError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold text-center">
                  {editRoomError}
                </div>
              )}

              {/* Editable Room Code */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Classroom Room Code *</label>
                  <span className="text-[10px] text-slate-500 font-mono">3–12 alphanumeric chars</span>
                </div>
                <input
                  type="text"
                  value={editRoomCode}
                  onChange={(e) => setEditRoomCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                  placeholder="e.g. 123456 or CS401"
                  required
                  maxLength={12}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-cyan-300 font-mono text-base tracking-widest font-black focus:outline-none focus:border-indigo-400 transition-colors uppercase"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Students join using this code. Changing it updates the invite link and session immediately.
                </p>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Classroom Name / Title *</label>
                <input
                  type="text"
                  value={editRoomName}
                  onChange={(e) => setEditRoomName(e.target.value)}
                  placeholder="e.g. CS401: Cloud Computing"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Allotted Faculty Host</label>
                <select
                  value={editRoomFacultyId}
                  onChange={(e) => setEditRoomFacultyId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400 transition-colors"
                >
                  <option value="">-- Unassigned (No Faculty) --</option>
                  {faculties.map((f) => (
                    <option key={f.facultyId} value={f.facultyId}>
                      {f.name} ({f.facultyId}) — {f.department}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Changing allotment transfers hosting authority and moves this classroom to the selected faculty's portal.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingRoom}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingRoom ? 'Saving Changes...' : 'Save Allotment'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditRoomOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SUPER ADMIN */}
      {isAddAdminOpen && (
        <div 
          onClick={() => setIsAddAdminOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl glass-panel p-6 shadow-2xl border border-amber-500/30 flex flex-col gap-4 ring-1 ring-amber-500/20"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add New Super Admin</h3>
                  <p className="text-xs text-slate-400">Grant full master administration privileges</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddAdminOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSuperAdmin} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="e.g. Administrator Name"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Username *</label>
                <input
                  type="text"
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  placeholder="e.g. admin_partner"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Master Password *</label>
                <input
                  type="text"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Secure master password"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin@institution.edu"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isCreatingAdmin}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isCreatingAdmin ? 'Creating Super Admin...' : 'Create Super Admin'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddAdminOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ACCOUNT SETTINGS / CHANGE USERNAME & PASSWORD */}
      {isProfileOpen && (
        <div 
          onClick={() => setIsProfileOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl glass-panel p-6 shadow-2xl border border-amber-500/30 flex flex-col gap-4 ring-1 ring-amber-500/20"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Admin Account & Credentials</h3>
                  <p className="text-xs text-slate-400">Change your username and master password</p>
                </div>
              </div>
              <button 
                onClick={() => setIsProfileOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="flex flex-col gap-3.5">
              {profileError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold text-center">
                  {profileError}
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Main System Administrator"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Username</label>
                <input
                  type="text"
                  value={profileUsername}
                  onChange={(e) => setProfileUsername(e.target.value)}
                  placeholder="Admin username"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-3">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Update Password (Optional)</span>
                </span>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showProfilePass.next ? 'text' : 'password'}
                      value={profileNewPassword}
                      onChange={(e) => setProfileNewPassword(e.target.value)}
                      placeholder="Enter new password (or leave blank to keep current)"
                      className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowProfilePass(p => ({ ...p, next: !p.next }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showProfilePass.next ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {profileNewPassword && (
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showProfilePass.confirm ? 'text' : 'password'}
                        value={profileConfirmPassword}
                        onChange={(e) => setProfileConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        required={Boolean(profileNewPassword)}
                        className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowProfilePass(p => ({ ...p, confirm: !p.confirm }))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      >
                        {showProfilePass.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <label className="block text-[10px] uppercase font-bold text-amber-300 mb-1">
                  Current Password (Optional if currently active session)
                </label>
                <div className="relative">
                  <input
                    type={showProfilePass.current ? 'text' : 'password'}
                    value={profileCurrentPassword}
                    onChange={(e) => setProfileCurrentPassword(e.target.value)}
                    placeholder="Enter current password if known"
                    className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-900 border border-amber-500/30 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowProfilePass(p => ({ ...p, current: !p.current }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showProfilePass.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingProfile ? 'Saving Changes...' : 'Save Credentials'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
