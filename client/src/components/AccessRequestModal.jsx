import React, { useEffect } from 'react';
import { 
  Bell, 
  Check, 
  X, 
  Users, 
  Smartphone, 
  Laptop, 
  Tablet, 
  Monitor, 
  CheckCheck,
  ShieldCheck,
  Mail,
  Phone
} from 'lucide-react';

function getDeviceIcon(name = '') {
  const lower = name.toLowerCase();
  if (lower.includes('phone') || lower.includes('iphone') || lower.includes('android') || lower.includes('mobile')) return Smartphone;
  if (lower.includes('tablet') || lower.includes('ipad')) return Tablet;
  if (lower.includes('desktop') || lower.includes('pc')) return Monitor;
  return Laptop;
}

export default function AccessRequestModal({
  isOpen,
  onClose,
  pendingRequests,
  onAdmit,
  onDeny,
  onAdmitAll
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !pendingRequests || pendingRequests.length === 0) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-3xl glass-panel p-6 shadow-2xl border border-cyan-500/30 flex flex-col gap-5 ring-1 ring-cyan-500/20"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
              <Bell className="w-5 h-5 animate-bounce" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Join Request{pendingRequests.length > 1 ? 's' : ''}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                  {pendingRequests.length} Waiting
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Someone scanned the QR code or used your share link to join
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Minimize"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Requests List */}
        <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
          {pendingRequests.map((req) => {
            const Icon = getDeviceIcon(req.peerName);
            return (
              <div
                key={req.socketId}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-cyan-500/30 transition-all shadow-inner"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-white truncate max-w-[140px] sm:max-w-[200px]">
                        {req.peerName || 'Student'}
                      </h4>
                      {req.rollNumber && req.rollNumber !== 'N/A' && (
                        <span className="px-2 py-0.5 text-[10px] font-bold font-mono uppercase bg-cyan-500/20 text-cyan-300 rounded-md border border-cyan-500/30">
                          {req.rollNumber}
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                        72h Access
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 mt-0.5 text-[11px] text-slate-400 font-mono">
                      {req.email && req.email !== 'N/A' && (
                        <span className="flex items-center gap-1 text-slate-300">
                          <Mail className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span className="truncate max-w-[170px] sm:max-w-[210px]">{req.email}</span>
                        </span>
                      )}
                      {req.mobile && req.mobile !== 'N/A' && (
                        <span className="flex items-center gap-1 text-slate-300">
                          <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{req.mobile}</span>
                        </span>
                      )}
                      {(!req.email || req.email === 'N/A') && (!req.mobile || req.mobile === 'N/A') && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                          <span>Requesting access</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Admit & Deny Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onDeny(req.socketId)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Deny</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdmit(req.socketId)}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Admit</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10 gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Only admitted devices can view or share files</span>
          </div>

          {pendingRequests.length > 1 && (
            <button
              type="button"
              onClick={onAdmitAll}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all active:scale-95"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Admit All ({pendingRequests.length})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
