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
  Trash2
} from 'lucide-react';

export default function AttendanceModal({
  isOpen,
  onClose,
  attendance = [],
  roomCode,
  roomSlug,
  addToast,
  onDeleteRecord,
  onClearRecords
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [deletedIds, setDeletedIds] = useState(() => new Set());

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    const confirmDelete = window.confirm(
      `Delete attendance log for ${studentName || 'this student'}?`
    );
    if (!confirmDelete) return;

    try {
      const cleanCode = (roomCode || '').toString().trim().replace(/\s+/g, '');
      const url = cleanCode ? `/api/room/${cleanCode}/attendance/${id}` : `/api/attendance/${id}`;
      const res = await fetch(url, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setDeletedIds(prev => new Set([...prev, id]));
        if (onDeleteRecord) onDeleteRecord(id);
        if (addToast) addToast('Student attendance record deleted', 'success');
      } else {
        if (addToast) addToast(data.error || 'Failed to delete record', 'error');
      }
    } catch {
      if (addToast) addToast('Server error deleting record', 'error');
    }
  };

  const handleClearRoomAttendance = async () => {
    const cleanCode = (roomCode || '').toString().trim().replace(/\s+/g, '');
    const confirmClear = window.confirm(
      `Are you sure you want to delete ALL student attendance logs for Room ${cleanCode || roomCode}?\n\nThis action cannot be undone.`
    );
    if (!confirmClear) return;

    try {
      const res = await fetch(`/api/room/${cleanCode}/attendance`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setDeletedIds(new Set(studentAttendance.map(item => item.id)));
        if (onClearRecords) onClearRecords();
        if (addToast) addToast(`All student logs cleared for Room ${cleanCode || roomCode}`, 'success');
      } else {
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

  const activeCount = useMemo(() => {
    return studentAttendance.filter(item => item.status === 'Active').length;
  }, [studentAttendance]);

  const exitedCount = useMemo(() => {
    return studentAttendance.filter(item => item.status === 'Exited').length;
  }, [studentAttendance]);

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
        className="relative w-full max-w-5xl max-h-[90vh] rounded-3xl glass-panel p-5 sm:p-7 shadow-2xl border border-white/10 flex flex-col gap-5 overflow-hidden"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Student Classroom Attendance Log
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Faculty View</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Detailed student login, exit timestamps, and roll numbers for Room: <span className="font-mono text-cyan-300 font-bold">{roomCode}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Clear Room Logs */}
            <button
              onClick={handleClearRoomAttendance}
              disabled={studentAttendance.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 disabled:opacity-40 text-xs font-semibold shadow-inner transition-all active:scale-95 cursor-pointer"
              title="Delete all student attendance logs for this room"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Room Logs</span>
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

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metrics Bar & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Quick Metrics */}
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
              placeholder="Search name, email, mobile..."
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
        <div className="flex-1 overflow-x-auto overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/60 max-h-[50vh]">
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
                        {item.role?.includes('Faculty') || item.role === 'Admin' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 font-semibold text-[10px]">
                            <Crown className="w-2.5 h-2.5 text-amber-400" />
                            <span>{item.role || 'Faculty Host'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium text-[10px]">
                            <span>Student</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-300 font-mono text-xs">
                        {item.email && item.email !== 'N/A' ? (
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span className="truncate max-w-[180px]">{item.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Not provided</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-300 font-mono text-xs">
                        {item.mobile && item.mobile !== 'N/A' ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>{item.mobile}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Not provided</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                        <span className="block font-medium">
                          {item.joinedAt ? new Date(item.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}
                        </span>
                        <span className="block text-[10px] text-slate-500">
                          {item.joinedAt ? new Date(item.joinedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>Active Now</span>
                          </span>
                        ) : item.exitedAt ? (
                          <div>
                            <span className="block font-medium text-slate-400">
                              {new Date(item.exitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <span className="block text-[10px] text-slate-500">
                              {new Date(item.exitedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3.5 text-slate-300 font-mono font-medium">
                        {item.duration || 'Live'}
                      </td>

                      <td className="py-3 px-3.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {item.status || (isActive ? 'Active' : 'Exited')}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 text-right">
                        <button
                          onClick={() => handleDeleteStudentLog(item.id, item.name)}
                          title="Delete this student attendance record"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer note */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-white/10 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Attendance log is confidential and only accessible to the Room Creator (Admin).</span>
          </div>
          <div className="text-slate-400">
            Records update in real-time as users join or leave the session.
          </div>
        </div>
      </div>
    </div>
  );
}
