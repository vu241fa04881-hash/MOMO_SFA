import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  Search, 
  Users, 
  UserCheck, 
  Clock, 
  Crown, 
  Mail, 
  Phone, 
  ShieldCheck,
  Calendar,
  CheckCircle2,
  LogOut,
  RefreshCw,
  Trash2,
  UserMinus
} from 'lucide-react';

export default function AttendanceModal({
  isOpen,
  onClose,
  attendance = [],
  roomCode,
  roomSlug,
  addToast,
  onDeleteRecord,
  onClearRecords,
  isFaculty = true,
  admissions = [],
  defaultDurationHours = 72,
  onModifyAdmissionExpiry,
  onModifyRoomDefaultExpiry,
  onRevokeAdmission,
  onRefreshAdmissions,
  onKickStudent
}) {
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'admissions'
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [deletedIds, setDeletedIds] = useState(() => new Set());
  const [clearingRoomLogs, setClearingRoomLogs] = useState(false);

  // Expiration modification state
  const [selectedDefaultExpiry, setSelectedDefaultExpiry] = useState(defaultDurationHours || 72);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [isUpdatingDefault, setIsUpdatingDefault] = useState(false);
  const [customHoursModal, setCustomHoursModal] = useState(null); // { rollNumber, studentName }
  const [customHoursInput, setCustomHoursInput] = useState('72');
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  useEffect(() => {
    if (defaultDurationHours) {
      setSelectedDefaultExpiry(defaultDurationHours);
    }
  }, [defaultDurationHours]);

  useEffect(() => {
    if (isOpen && onRefreshAdmissions) {
      onRefreshAdmissions();
    }
  }, [isOpen, onRefreshAdmissions]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (customHoursModal) {
          setCustomHoursModal(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, customHoursModal]);

  // Reset deleted IDs when room changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setDeletedIds(new Set());
    }
  }, [isOpen, roomCode]);

  const studentAttendance = useMemo(() => {
    return (attendance || [])
      .filter(item => !item.isHost && !item.role?.includes('Faculty'))
      .filter(item => !deletedIds.has(item.id));
  }, [attendance, deletedIds]);

  const handleDeleteStudentLog = async (id, studentName) => {
    // Optimistically update UI immediately
    setDeletedIds(prev => new Set([...prev, id]));
    if (onDeleteRecord) onDeleteRecord(id);
    if (addToast) addToast(`Attendance log for ${studentName || 'student'} deleted`, 'success');

    try {
      const cleanCode = (roomCode || '').toString().trim().replace(/\s+/g, '');
      const url = cleanCode ? `/api/room/${cleanCode}/attendance/${id}` : `/api/attendance/${id}`;
      const res = await fetch(url, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!data.success) {
        if (addToast) addToast(data.error || 'Failed to delete record', 'error');
      }
    } catch {
      if (addToast) addToast('Server error deleting record', 'error');
    }
  };

  const handleClearRoomAttendance = async () => {
    const cleanCode = (roomCode || '').toString().trim().replace(/\s+/g, '');
    if (!clearingRoomLogs) {
      setClearingRoomLogs(true);
      setTimeout(() => setClearingRoomLogs(false), 4000);
      return;
    }
    setClearingRoomLogs(false);

    // Optimistically clear UI immediately
    setDeletedIds(new Set(studentAttendance.map(item => item.id)));
    if (onClearRecords) onClearRecords();
    if (addToast) addToast(`All student logs cleared for Room ${cleanCode || roomCode}`, 'success');

    try {
      const res = await fetch(`/api/room/${cleanCode}/attendance`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!data.success) {
        if (addToast) addToast(data.error || 'Failed to clear logs', 'error');
      }
    } catch {
      if (addToast) addToast('Server error clearing attendance logs', 'error');
    }
  };

  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return studentAttendance;
    const term = searchTerm.toLowerCase();
    return studentAttendance.filter((item) => 
      (item.name && item.name.toLowerCase().includes(term)) ||
      (item.rollNumber && item.rollNumber.toLowerCase().includes(term)) ||
      (item.email && item.email.toLowerCase().includes(term)) ||
      (item.mobile && item.mobile.toLowerCase().includes(term)) ||
      (item.role && item.role.toLowerCase().includes(term))
    );
  }, [studentAttendance, searchTerm]);

  const filteredAdmissions = useMemo(() => {
    if (!searchTerm.trim()) return admissions;
    const term = searchTerm.toLowerCase();
    return admissions.filter((item) =>
      (item.peerName && item.peerName.toLowerCase().includes(term)) ||
      (item.rollNumber && item.rollNumber.toLowerCase().includes(term)) ||
      (item.senderId && item.senderId.toLowerCase().includes(term))
    );
  }, [admissions, searchTerm]);

  const activeCount = useMemo(() => {
    return studentAttendance.filter(item => item.status === 'Active').length;
  }, [studentAttendance]);

  const exitedCount = useMemo(() => {
    return studentAttendance.filter(item => item.status === 'Exited').length;
  }, [studentAttendance]);

  const formatCountdown = (expiresAt) => {
    const diff = Number(expiresAt) - Date.now();
    if (diff <= 0) return { label: 'Expired', isExpired: true };
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return { label: `${days}d ${remHours}h direct access`, isExpired: false };
    }
    return { label: `${hours}h ${mins}m direct access`, isExpired: false };
  };

  const handleSaveDefaultExpiry = () => {
    setIsUpdatingDefault(true);
    if (onModifyRoomDefaultExpiry) {
      onModifyRoomDefaultExpiry({
        durationHours: Number(selectedDefaultExpiry),
        applyToExisting
      });
    }
    if (addToast) {
      addToast(`Default room admission duration updated to ${selectedDefaultExpiry} hours`, 'success');
    }
    setTimeout(() => setIsUpdatingDefault(false), 500);
  };

  const handleCustomHoursSubmit = (e) => {
    e.preventDefault();
    if (!customHoursModal) return;
    const hours = Number(customHoursInput);
    if (isNaN(hours) || hours <= 0) {
      if (addToast) addToast('Please enter a valid number of hours', 'error');
      return;
    }
    if (onModifyAdmissionExpiry) {
      onModifyAdmissionExpiry({
        rollNumber: customHoursModal.rollNumber,
        newDurationHours: hours
      });
    }
    if (addToast) {
      addToast(`Direct access for ${customHoursModal.studentName || customHoursModal.rollNumber} set to ${hours} hours`, 'success');
    }
    setCustomHoursModal(null);
  };

  if (!isOpen) return null;

  const handleDownloadExcel = () => {
    try {
      setIsExporting(true);
      const rows = studentAttendance.map((item, idx) => ({
        'S.No': idx + 1,
        'Roll Number': item.rollNumber || 'N/A',
        'Student Name': item.name || 'Anonymous',
        'Role': 'Student',
        'Email ID': item.email && item.email !== 'N/A' ? item.email : 'N/A',
        'Mobile Number': item.mobile && item.mobile !== 'N/A' ? item.mobile : 'N/A',
        'Login Time': item.joinedAt ? new Date(item.joinedAt).toLocaleString() : 'N/A',
        'Exit Time': item.exitedAt ? new Date(item.exitedAt).toLocaleString() : 'Active Now',
        'Session Duration': item.duration || 'Active Now',
        'Status': item.status || 'Active'
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Auto-size columns for high readability
      worksheet['!cols'] = [
        { wch: 6 },  // S.No
        { wch: 20 }, // Roll Number
        { wch: 25 }, // Student Name
        { wch: 14 }, // Role
        { wch: 28 }, // Email ID
        { wch: 20 }, // Mobile Number
        { wch: 24 }, // Login Time
        { wch: 24 }, // Exit Time
        { wch: 18 }, // Session Duration
        { wch: 12 }  // Status
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Attendance');

      const fileName = `momo-student-attendance-${roomCode || 'session'}-${Date.now()}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      if (addToast) {
        addToast(`Excel report downloaded: ${fileName}`, 'success');
      }
    } catch (err) {
      console.error('Failed to export Excel:', err);
      // Fallback to server endpoint
      if (roomCode) {
        window.location.href = `/api/room/${roomCode}/attendance/excel`;
      }
      if (addToast) {
        addToast('Downloading Excel report from server...', 'info');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl max-h-[90vh] rounded-3xl glass-panel p-5 sm:p-7 shadow-2xl border border-white/10 flex flex-col gap-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Classroom Management & Student Access
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Faculty View</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage attendance records and 72-hour direct room admissions for Room: <span className="font-mono text-cyan-300 font-bold">{roomCode}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {activeTab === 'attendance' && (
              <>
                {/* Clear Room Logs */}
                <button
                  onClick={handleClearRoomAttendance}
                  disabled={studentAttendance.length === 0}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-inner transition-all active:scale-95 cursor-pointer ${
                    clearingRoomLogs
                      ? 'bg-rose-600 text-white border border-rose-500 animate-pulse shadow-lg shadow-rose-500/30'
                      : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 disabled:opacity-40'
                  }`}
                  title={clearingRoomLogs ? 'Click again to confirm clearing all logs' : 'Delete all student attendance logs for this room'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{clearingRoomLogs ? 'Confirm Clear All?' : 'Clear Room Logs'}</span>
                </button>

                {/* Download Excel Button */}
                <button
                  onClick={handleDownloadExcel}
                  disabled={isExporting || studentAttendance.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>{isExporting ? 'Exporting...' : 'Download Excel (.xlsx)'}</span>
                </button>
              </>
            )}

            {activeTab === 'admissions' && (
              <button
                onClick={() => {
                  if (onRefreshAdmissions) onRefreshAdmissions();
                  if (addToast) addToast('Admissions refreshed', 'info');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Admissions</span>
              </button>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Attendance & Login Logs ({studentAttendance.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('admissions');
              if (onRefreshAdmissions) onRefreshAdmissions();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'admissions'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Student Direct Access & Expiry ({admissions.length})</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-500/30 text-cyan-200 border border-cyan-500/30">
              {defaultDurationHours}h Window
            </span>
          </button>
        </div>

        {/* ================= TAB 1: ATTENDANCE LOGS ================= */}
        {activeTab === 'attendance' && (
          <>
            {/* Metrics Bar & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/5 text-xs text-slate-300">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Total Students: <strong className="text-white font-bold">{studentAttendance.length}</strong></span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Active Now: <strong className="text-emerald-400 font-bold">{activeCount}</strong></span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/5 text-xs text-slate-400">
                  <LogOut className="w-3.5 h-3.5 text-slate-400" />
                  <span>Exited: <strong className="text-slate-300 font-bold">{exitedCount}</strong></span>
                </div>
              </div>

              {/* Search Filter */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name, roll no, email..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Attendance Records Table */}
            <div className="flex-1 overflow-x-auto overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/60 max-h-[48vh]">
              {filteredList.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
                  <Users className="w-10 h-10 text-slate-600 mb-2" />
                  <p className="text-sm font-medium text-slate-300">No student attendance records found</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {searchTerm ? 'Try a different search query' : 'Students will be logged automatically upon joining this classroom'}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-slate-900/90 sticky top-0 text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
                      <th className="py-3 px-3.5 text-center w-12">#</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-3.5">Roll Number</th>
                      <th className="py-3 px-3.5">Role</th>
                      <th className="py-3 px-4">Email ID</th>
                      <th className="py-3 px-4">Mobile Number</th>
                      <th className="py-3 px-4">Login Time</th>
                      <th className="py-3 px-4">Exit Time</th>
                      <th className="py-3 px-3.5">Duration</th>
                      <th className="py-3 px-3.5 text-center">Status</th>
                      <th className="py-3 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredList.map((item, idx) => {
                      const isActive = item.status === 'Active';
                      return (
                        <tr 
                          key={item.id || item.senderId || idx}
                          className="hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="py-3 px-3.5 text-center font-mono text-slate-500 text-xs">
                            {idx + 1}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                item.role?.includes('Faculty') || item.role === 'Admin'
                                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              }`}>
                                {(item.name || 'P').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-semibold text-white block truncate max-w-[140px]">
                                  {item.name || 'Anonymous Device'}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3.5 font-mono text-xs">
                            {item.rollNumber && item.rollNumber !== 'N/A' ? (
                              <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold text-[11px]">
                                {item.rollNumber}
                              </span>
                            ) : (
                              <span className="text-slate-500">N/A</span>
                            )}
                          </td>

                          <td className="py-3 px-3.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium text-[10px]">
                              <span>Student</span>
                            </span>
                          </td>

                          <td className="py-3 px-4 text-slate-300 font-mono text-xs">
                            {item.email && item.email !== 'N/A' ? (
                              <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                                <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                                <span>{item.email}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500">N/A</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-slate-300 font-mono text-xs">
                            {item.mobile && item.mobile !== 'N/A' ? (
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                                <span>{item.mobile}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500">N/A</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-slate-300 text-xs">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-cyan-400 shrink-0" />
                              <span>{item.joinedAt ? new Date(item.joinedAt).toLocaleTimeString() : 'N/A'}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-slate-300 text-xs">
                            {item.exitedAt ? (
                              <div className="flex items-center gap-1.5">
                                <LogOut className="w-3 h-3 text-slate-500 shrink-0" />
                                <span>{new Date(item.exitedAt).toLocaleTimeString()}</span>
                              </div>
                            ) : (
                              <span className="text-emerald-400 font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span>Active Now</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3.5 font-mono text-xs text-slate-300">
                            {item.duration || (isActive ? 'Active' : 'N/A')}
                          </td>

                          <td className="py-3 px-3.5 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isActive
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border border-white/5'
                            }`}>
                              {item.status || (isActive ? 'Active' : 'Exited')}
                            </span>
                          </td>

                          <td className="py-3 px-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isFaculty && (item.status === 'Active' || item.status === 'Live' || !item.exitedAt) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to remove "${item.name || 'this student'}" from this classroom?`)) {
                                      if (onKickStudent) {
                                        onKickStudent({
                                          socketId: item.socketId,
                                          senderId: item.senderId,
                                          rollNumber: item.rollNumber,
                                          peerName: item.name
                                        });
                                      }
                                    }
                                  }}
                                  title="Remove student from classroom now"
                                  className="p-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-500/20 transition-colors cursor-pointer"
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteStudentLog(item.id, item.name)}
                                title="Delete this student attendance record"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ================= TAB 2: STUDENT ADMISSIONS & 72H EXPIRY ================= */}
        {activeTab === 'admissions' && (
          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            {/* Faculty Room-Wide Default Expiration Config Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900/90 to-emerald-950/30 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Room Default Admission Window</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Currently {defaultDurationHours} Hours
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Students admitted with their registration number can re-enter this room directly without knocking until expiry.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
                <select
                  value={selectedDefaultExpiry}
                  onChange={(e) => setSelectedDefaultExpiry(Number(e.target.value))}
                  className="bg-slate-950 border border-cyan-500/40 text-cyan-300 font-bold rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
                >
                  <option value={1}>1 Hour</option>
                  <option value={6}>6 Hours</option>
                  <option value={12}>12 Hours</option>
                  <option value={24}>24 Hours (1 Day)</option>
                  <option value={48}>48 Hours (2 Days)</option>
                  <option value={72}>72 Hours (Default)</option>
                  <option value={168}>7 Days (1 Week)</option>
                  <option value={720}>30 Days (1 Month)</option>
                </select>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={applyToExisting}
                    onChange={(e) => setApplyToExisting(e.target.checked)}
                    className="rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Apply to existing students</span>
                </label>

                <button
                  type="button"
                  onClick={handleSaveDefaultExpiry}
                  disabled={isUpdatingDefault}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  {isUpdatingDefault ? 'Saving...' : 'Update Default Expiry'}
                </button>
              </div>
            </div>

            {/* Search filter for admitted students */}
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>
                  Admitted Students: <strong className="text-white font-bold">{admissions.length}</strong>
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 text-[11px]">
                  Only Faculty can modify expiration or revoke permissions
                </span>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search student or roll number..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Admitted Students Table */}
            <div className="flex-1 overflow-x-auto overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/60 max-h-[44vh]">
              {filteredAdmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
                  <Clock className="w-10 h-10 text-slate-600 mb-2" />
                  <p className="text-sm font-medium text-slate-300">No student admissions active</p>
                  <p className="text-xs text-slate-500 mt-1">
                    When faculty admits a student from the knock modal, their registration number is granted 72-hour direct room access.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-slate-900/90 sticky top-0 text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
                      <th className="py-3 px-3.5 text-center w-12">#</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Registration No (Student ID)</th>
                      <th className="py-3 px-4">Admitted At</th>
                      <th className="py-3 px-4">Direct Access Expiration</th>
                      <th className="py-3 px-4 text-right">Faculty Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredAdmissions.map((adm, idx) => {
                      const countdown = formatCountdown(adm.expiresAt);
                      const isDropdownOpen = activeDropdownId === (adm.rollNumber || adm.id);

                      return (
                        <tr
                          key={adm.id || adm.rollNumber || idx}
                          className="hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="py-3 px-3.5 text-center font-mono text-slate-500 text-xs">
                            {idx + 1}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                                {(adm.peerName || 'S').charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-white truncate max-w-[160px]">
                                {adm.peerName || 'Student'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono font-bold text-xs">
                              {adm.rollNumber || 'N/A'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-slate-300 text-xs">
                            <div className="flex flex-col">
                              <span>{adm.admittedAt ? new Date(adm.admittedAt).toLocaleDateString() : 'N/A'}</span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {adm.admittedAt ? new Date(adm.admittedAt).toLocaleTimeString() : ''}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold w-fit ${
                                countdown.isExpired
                                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              }`}>
                                <span className={`w-2 h-2 rounded-full ${countdown.isExpired ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'}`}></span>
                                <span>{countdown.label}</span>
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {adm.expiresAt ? new Date(adm.expiresAt).toLocaleString() : 'N/A'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="relative inline-flex items-center gap-2">
                              {/* Modify Expiry Dropdown Trigger */}
                              <button
                                type="button"
                                onClick={() => setActiveDropdownId(isDropdownOpen ? null : (adm.rollNumber || adm.id))}
                                className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                <span>Modify Expiry ▾</span>
                              </button>

                              {/* Dropdown Menu */}
                              {isDropdownOpen && (
                                <div className="absolute right-0 top-full mt-1 w-48 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl p-2 z-50 flex flex-col gap-1 text-left text-xs animate-in fade-in">
                                  <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                    Quick Adjust
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onModifyAdmissionExpiry) {
                                        onModifyAdmissionExpiry({ rollNumber: adm.rollNumber, addHours: 1 });
                                      }
                                      setActiveDropdownId(null);
                                      if (addToast) addToast(`Extended by 1 hour for ${adm.rollNumber}`, 'success');
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-white/10 hover:text-cyan-300 transition-colors"
                                  >
                                    +1 Hour
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onModifyAdmissionExpiry) {
                                        onModifyAdmissionExpiry({ rollNumber: adm.rollNumber, addHours: 24 });
                                      }
                                      setActiveDropdownId(null);
                                      if (addToast) addToast(`Extended by 24 hours for ${adm.rollNumber}`, 'success');
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-white/10 hover:text-cyan-300 transition-colors"
                                  >
                                    +24 Hours (1 Day)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onModifyAdmissionExpiry) {
                                        onModifyAdmissionExpiry({ rollNumber: adm.rollNumber, addHours: 72 });
                                      }
                                      setActiveDropdownId(null);
                                      if (addToast) addToast(`Extended by 72 hours for ${adm.rollNumber}`, 'success');
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-white/10 hover:text-cyan-300 transition-colors"
                                  >
                                    +72 Hours (3 Days)
                                  </button>

                                  <div className="border-t border-white/10 my-1"></div>

                                  <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                    Set Duration from Now
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onModifyAdmissionExpiry) {
                                        onModifyAdmissionExpiry({ rollNumber: adm.rollNumber, newDurationHours: 24 });
                                      }
                                      setActiveDropdownId(null);
                                      if (addToast) addToast(`Set to 24 hours for ${adm.rollNumber}`, 'success');
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-white/10 hover:text-cyan-300 transition-colors"
                                  >
                                    Set 24 Hours
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onModifyAdmissionExpiry) {
                                        onModifyAdmissionExpiry({ rollNumber: adm.rollNumber, newDurationHours: 72 });
                                      }
                                      setActiveDropdownId(null);
                                      if (addToast) addToast(`Set to 72 hours (default) for ${adm.rollNumber}`, 'success');
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-white/10 hover:text-cyan-300 transition-colors"
                                  >
                                    Set 72 Hours (Default)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onModifyAdmissionExpiry) {
                                        onModifyAdmissionExpiry({ rollNumber: adm.rollNumber, newDurationHours: 168 });
                                      }
                                      setActiveDropdownId(null);
                                      if (addToast) addToast(`Set to 7 days for ${adm.rollNumber}`, 'success');
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-white/10 hover:text-cyan-300 transition-colors"
                                  >
                                    Set 7 Days
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveDropdownId(null);
                                      setCustomHoursModal({
                                        rollNumber: adm.rollNumber,
                                        studentName: adm.peerName
                                      });
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-cyan-300 hover:bg-cyan-500/15 font-semibold transition-colors"
                                  >
                                    Custom Hours...
                                  </button>

                                  <div className="border-t border-white/10 my-1"></div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onRevokeAdmission) {
                                        onRevokeAdmission({ rollNumber: adm.rollNumber, senderId: adm.senderId });
                                      }
                                      setActiveDropdownId(null);
                                      if (addToast) addToast(`Access revoked for ${adm.rollNumber}`, 'error');
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 font-bold transition-colors"
                                  >
                                    Revoke Access Now
                                  </button>
                                </div>
                              )}

                              {/* Quick Revoke Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (onRevokeAdmission) {
                                    onRevokeAdmission({ rollNumber: adm.rollNumber, senderId: adm.senderId });
                                  }
                                  if (addToast) addToast(`Access revoked for ${adm.rollNumber}`, 'error');
                                }}
                                title="Revoke student admission and require approval on next join"
                                className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all active:scale-95 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Custom Hours Modal */}
        {customHoursModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-cyan-500/30 p-5 flex flex-col gap-4 shadow-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>Custom Admission Duration</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setCustomHoursModal(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCustomHoursSubmit} className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Direct access duration (hours from now) for:
                  </label>
                  <div className="text-xs font-bold text-cyan-300 mb-2">
                    {customHoursModal.studentName} ({customHoursModal.rollNumber})
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="8760"
                    value={customHoursInput}
                    onChange={(e) => setCustomHoursInput(e.target.value)}
                    required
                    autoFocus
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-cyan-500/40 text-white font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    placeholder="e.g. 72"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    e.g. 24 = 1 day, 72 = 3 days, 168 = 1 week
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setCustomHoursModal(null)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20"
                  >
                    Save Duration
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-white/10 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {activeTab === 'attendance'
                ? 'Attendance log is confidential and only accessible to the Room Creator (Faculty).'
                : 'Direct access expiration is strictly controlled by the faculty host.'}
            </span>
          </div>
          <div className="text-slate-400">
            Records update in real-time as users join or leave the session.
          </div>
        </div>
      </div>
    </div>
  );
}
