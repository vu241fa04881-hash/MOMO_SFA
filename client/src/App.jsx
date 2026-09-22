import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { 
  Share2, 
  UploadCloud, 
  ShieldCheck, 
  Clock, 
  Sparkles, 
  ArrowRight, 
  Trash2,
  Inbox,
  Filter,
  Layers,
  ChevronDown
} from 'lucide-react';

import Header from './components/Header';
import ActionToolbar from './components/ActionToolbar';
import DropZoneOverlay from './components/DropZoneOverlay';
import ItemCard from './components/ItemCard';
import CodeModal from './components/CodeModal';
import TextModal from './components/TextModal';
import QrModal from './components/QrModal';
import ImageModal from './components/ImageModal';
import JoinModal from './components/JoinModal';
import RenameUserModal from './components/RenameUserModal';
import ConnectedDevicesModal from './components/ConnectedDevicesModal';
import TtlModal, { formatTtlLabel } from './components/TtlModal';
import ToastContainer from './components/ToastContainer';
import WaitingRoomOverlay from './components/WaitingRoomOverlay';
import AccessRequestModal from './components/AccessRequestModal';
import AttendanceModal from './components/AttendanceModal';
import PortalNavigation from './components/PortalNavigation';
import AdminPortal from './components/AdminPortal';
import FacultyPortal from './components/FacultyPortal';
import StudentPortal from './components/StudentPortal';

import { 
  playReceiveSound, 
  playSendSound, 
  playPeerConnectSound, 
  playKnockSound,
  playAdmittedSound,
  toggleAudioMute, 
  getAudioMuted 
} from './utils/audio';

// Unique client identifier for this tab/device, persisted in localStorage
const CLIENT_ID = (() => {
  let id = localStorage.getItem('momo_client_id');
  if (!id) {
    id = 'client_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('momo_client_id', id);
  }
  return id;
})();
const DEFAULT_NAME = 'Device ' + CLIENT_ID.slice(-3).toUpperCase();

export default function App() {
  // 3-Portal Route Resolution (Student default, Faculty / Admin isolated)
  const isInternalHashChangeRef = useRef(false);

  const getPortalFromHash = () => {
    const hash = (window.location.hash || '').toLowerCase();
    if (hash.includes('admin')) return 'admin';
    if (hash.includes('faculty')) return 'faculty';
    if (hash.includes('student')) return 'student';

    // If hash does not specify portal (e.g. #code=111222), retain saved or active portal
    const saved = sessionStorage.getItem('momo_active_portal');
    if (saved === 'faculty' || saved === 'admin') return saved;
    return 'student'; // Default portal for student access
  };

  const [activePortal, setActivePortal] = useState(getPortalFromHash);
  const activePortalRef = useRef(activePortal);

  useEffect(() => {
    activePortalRef.current = activePortal;
    sessionStorage.setItem('momo_active_portal', activePortal);
  }, [activePortal]);

  useEffect(() => {
    const handleHashChange = () => {
      if (isInternalHashChangeRef.current) {
        return;
      }
      const nextPortal = getPortalFromHash();
      setActivePortal(nextPortal);
      activePortalRef.current = nextPortal;
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [adminUser, setAdminUser] = useState(() => {
    const saved = localStorage.getItem('momo_admin_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [adminToken, setAdminToken] = useState(() => {
    return localStorage.getItem('momo_admin_token') || '';
  });

  const [facultyUser, setFacultyUser] = useState(() => {
    const saved = localStorage.getItem('momo_faculty_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [facultyToken, setFacultyToken] = useState(() => {
    return localStorage.getItem('momo_faculty_token') || '';
  });

  // Theme & Sound state
  const [isDark, setIsDark] = useState(true);
  const [isMuted, setIsMuted] = useState(getAudioMuted());

  // User Profile Credentials (persisted in localStorage)
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('momo_username') || localStorage.getItem('dropper_username') || DEFAULT_NAME;
  });
  const [userRollNumber, setUserRollNumber] = useState(() => {
    return localStorage.getItem('momo_roll_number') || '';
  });
  const [userEmail, setUserEmail] = useState(() => {
    return localStorage.getItem('momo_email') || '';
  });
  const [userMobile, setUserMobile] = useState(() => {
    return localStorage.getItem('momo_mobile') || '';
  });
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);

  // Access Control & Host State (Meet-style knock/admit)
  const [isHost, setIsHost] = useState(false);
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [accessStatus, setAccessStatus] = useState('none'); // 'none' | 'waiting' | 'denied' | 'admitted'
  const [hostName, setHostName] = useState('User 1');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [deniedMessage, setDeniedMessage] = useState('');
  const [waitingRoomInfo, setWaitingRoomInfo] = useState(null);

  // Admin Attendance & Login Details state
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  // Faculty Student Admissions & Expiry state
  const [admissionsList, setAdmissionsList] = useState([]);
  const [roomDefaultDurationHours, setRoomDefaultDurationHours] = useState(72);

  // Room & Connection state
  const [roomCode, setRoomCode] = useState('');
  const [roomSlug, setRoomSlug] = useState('');
  const [formattedCode, setFormattedCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isFacultyRoom, setIsFacultyRoom] = useState(false);
  const [peers, setPeers] = useState([]);
  const [peerCount, setPeerCount] = useState(1);
  const [isDevicesModalOpen, setIsDevicesModalOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [peerActivity, setPeerActivity] = useState('');

  // Items stream & Filters
  const [items, setItems] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'files' | 'images' | 'code' | 'text'

  // Drag & Drop / Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Expiration TTL state (15, 30, 60, 1440, or 'infinity')
  const [ttlMinutes, setTtlMinutes] = useState(15);
  const [isTtlModalOpen, setIsTtlModalOpen] = useState(false);

  // Modals state
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Toasts
  const [toasts, setToasts] = useState([]);

  // Socket & State references to prevent reconnect churn
  const socketRef = useRef(null);
  const dragCounterRef = useRef(0);
  const roomCodeRef = useRef('');
  const userNameRef = useRef(userName);
  const userRollNumberRef = useRef(userRollNumber);
  const userEmailRef = useRef(userEmail);
  const userMobileRef = useRef(userMobile);

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  useEffect(() => {
    userNameRef.current = userName;
  }, [userName]);

  useEffect(() => {
    userRollNumberRef.current = userRollNumber;
  }, [userRollNumber]);

  useEffect(() => {
    userEmailRef.current = userEmail;
  }, [userEmail]);

  useEffect(() => {
    userMobileRef.current = userMobile;
  }, [userMobile]);

  // Helper for adding toast notifications
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Switch Theme
  const handleToggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light-theme');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light-theme');
    }
  };

  // Dynamic document title reflecting classroom vs peer space
  useEffect(() => {
    if (activePortal === 'admin') {
      document.title = 'MOMO — Institutional Admin Portal';
    } else if (activePortal === 'faculty') {
      document.title = roomCode 
        ? `MOMO — Faculty Classroom (${formattedCode || roomCode})` 
        : 'MOMO — Faculty Portal';
    } else if (activePortal === 'student') {
      document.title = roomCode 
        ? (isFacultyRoom ? `MOMO — Classroom (${formattedCode || roomCode})` : `MOMO — Peer Space (${formattedCode || roomCode})`)
        : 'MOMO — Student Portal';
    } else {
      document.title = roomCode 
        ? (isFacultyRoom ? `MOMO — Classroom (${formattedCode || roomCode})` : `MOMO — Peer Space (${formattedCode || roomCode})`)
        : 'MOMO — 3-Portal Workspace';
    }
  }, [activePortal, roomCode, formattedCode, isFacultyRoom]);

  // Toggle Mute
  const handleToggleMute = () => {
    const nextMuted = toggleAudioMute();
    setIsMuted(nextMuted);
    addToast(nextMuted ? 'Sound muted' : 'Sound enabled', 'info');
  };

  // Helper to build the correct hash that always retains the active portal
  const buildPortalHash = useCallback((code, portal = activePortalRef.current) => {
    if (portal === 'faculty') {
      return code ? `#portal=faculty&code=${code}` : '#portal=faculty';
    }
    if (portal === 'admin') {
      return code ? `#portal=admin&code=${code}` : '#portal=admin';
    }
    return code ? `#code=${code}` : '#portal=student';
  }, []);

  // Parse room code from URL hash (e.g. #code=549201, #portal=faculty&code=549201, or #room=fast-blue-falcon)
  const getCodeFromUrl = () => {
    const hash = window.location.hash;
    if (hash) {
      const match = hash.match(/[#&](?:code|room)=([^&]+)/i);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('code')) return params.get('code');
    if (params.get('room')) return params.get('room');
    return null;
  };

  // Save User Profile (Name, Email, Mobile)
  const handleSaveUserProfile = useCallback(({ name, email, mobile }) => {
    const finalName = name || userNameRef.current;
    const finalEmail = email !== undefined ? email : userEmailRef.current;
    const finalMobile = mobile !== undefined ? mobile : userMobileRef.current;

    setUserName(finalName);
    setUserEmail(finalEmail);
    setUserMobile(finalMobile);

    userNameRef.current = finalName;
    userEmailRef.current = finalEmail;
    userMobileRef.current = finalMobile;

    localStorage.setItem('momo_username', finalName);
    localStorage.setItem('momo_email', finalEmail);
    localStorage.setItem('momo_mobile', finalMobile);

    const activeRoom = roomCodeRef.current;
    if (socketRef.current && activeRoom) {
      socketRef.current.emit('update-peer-profile', {
        roomCode: activeRoom.toString().trim().toLowerCase().replace(/\s+/g, ''),
        peerName: finalName,
        email: finalEmail,
        mobile: finalMobile
      });
    }
    addToast(`Profile updated for "${finalName}"`, 'success');
  }, [addToast]);

  const handleSaveUserName = useCallback((newName) => {
    handleSaveUserProfile({ name: newName });
  }, [handleSaveUserProfile]);

  // Select Transfer Expiration TTL
  const handleSelectTtl = useCallback((newTtl) => {
    setTtlMinutes(newTtl);
    const activeRoom = roomCodeRef.current;
    if (socketRef.current && activeRoom) {
      socketRef.current.emit('update-room-ttl', {
        roomCode: activeRoom.toString().trim().toLowerCase().replace(/\s+/g, ''),
        ttlMinutes: newTtl,
        peerName: userNameRef.current
      });
    }
    addToast(`Room expiration set to ${formatTtlLabel(newTtl)}`, 'success');
  }, [addToast]);

  // Join Room via Socket.IO
  const joinRoom = useCallback((code, credentials = {}) => {
    if (!socketRef.current || !code) return;
    const cleanCode = code.toString().trim().toLowerCase().replace(/\s+/g, '');
    const joinRole = credentials.role || (facultyUser && activePortal === 'faculty' ? 'faculty' : 'student');
    const joinFacultyId = credentials.facultyId || (facultyUser ? facultyUser.facultyId : null);
    const isFac = joinRole === 'faculty' || (facultyUser && activePortal === 'faculty');
    const joinRollNumber = isFac
      ? (joinFacultyId || facultyUser?.facultyId || 'FACULTY')
      : (credentials.rollNumber !== undefined ? credentials.rollNumber : userRollNumberRef.current);
    const joinName = credentials.name || (isFac && facultyUser ? facultyUser.name : userNameRef.current);
    const joinEmail = credentials.email !== undefined ? credentials.email : (isFac && facultyUser ? (facultyUser.email || '') : userEmailRef.current);
    const joinMobile = credentials.mobile !== undefined ? credentials.mobile : userMobileRef.current;

    if (credentials.name && !isFac) {
      setUserName(joinName);
      userNameRef.current = joinName;
      localStorage.setItem('momo_username', joinName);
    }
    if (credentials.rollNumber !== undefined && !isFac) {
      setUserRollNumber(joinRollNumber);
      userRollNumberRef.current = joinRollNumber;
      localStorage.setItem('momo_roll_number', joinRollNumber);
    }
    if (credentials.email !== undefined) {
      setUserEmail(joinEmail);
      userEmailRef.current = joinEmail;
      localStorage.setItem('momo_email', joinEmail);
    }
    if (credentials.mobile !== undefined) {
      setUserMobile(joinMobile);
      userMobileRef.current = joinMobile;
      localStorage.setItem('momo_mobile', joinMobile);
    }

    socketRef.current.emit('join-room', {
      roomCode: cleanCode,
      peerName: joinName,
      rollNumber: joinRollNumber,
      email: joinEmail,
      mobile: joinMobile,
      role: joinRole,
      facultyId: joinFacultyId,
      senderId: CLIENT_ID
    });
  }, [facultyUser]);

  // Toggle Room Lock
  const handleToggleLockRoom = useCallback(() => {
    const activeRoom = roomCodeRef.current || roomCode;
    if (!socketRef.current || !activeRoom) return;
    socketRef.current.emit('toggle-lock-room', {
      roomCode: activeRoom
    });
  }, [roomCode]);

  // Auth Handlers
  const handleAdminLogin = (user, token) => {
    setAdminUser(user);
    setAdminToken(token);
    localStorage.setItem('momo_admin_user', JSON.stringify(user));
    localStorage.setItem('momo_admin_token', token);
  };

  const handleAdminLogout = () => {
    setAdminUser(null);
    setAdminToken('');
    localStorage.removeItem('momo_admin_user');
    localStorage.removeItem('momo_admin_token');
    window.location.hash = '#admin';
    addToast('Logged out from Main Admin', 'info');
  };

  const handleFacultyLogin = (faculty, token) => {
    setFacultyUser(faculty);
    setFacultyToken(token);
    localStorage.setItem('momo_faculty_user', JSON.stringify(faculty));
    localStorage.setItem('momo_faculty_token', token);
  };

  const handleFacultyLogout = () => {
    if (socketRef.current && roomCodeRef.current) {
      socketRef.current.emit('leave-room', { roomCode: roomCodeRef.current });
    }
    setFacultyUser(null);
    setFacultyToken('');
    localStorage.removeItem('momo_faculty_user');
    localStorage.removeItem('momo_faculty_token');
    setRoomCode('');
    roomCodeRef.current = '';
    window.location.hash = '#faculty';
    addToast('Logged out from Faculty Portal', 'info');
  };

  // Request fresh session (Restricted: Students cannot create rooms)
  const requestNewSession = useCallback(() => {
    if (!socketRef.current) return;
    if (activePortal === 'student') return;
    socketRef.current.emit('request-new-session', {
      peerName: userNameRef.current,
      email: userEmailRef.current,
      mobile: userMobileRef.current,
      role: 'faculty',
      senderId: CLIENT_ID
    });
  }, [activePortal]);

  // Host Admit/Deny Actions
  const handleAdmitPeer = useCallback((targetSocketId, durationHours) => {
    const activeRoom = roomCodeRef.current || roomCode;
    if (!socketRef.current || !activeRoom) return;
    socketRef.current.emit('admit-peer', {
      roomCode: activeRoom,
      targetSocketId,
      durationHours: durationHours || 72
    });
    addToast('Admitted student to classroom!', 'success');
  }, [addToast, roomCode]);

  const handleDenyPeer = useCallback((targetSocketId) => {
    const activeRoom = roomCodeRef.current || roomCode;
    if (!socketRef.current || !activeRoom) return;
    socketRef.current.emit('deny-peer', {
      roomCode: activeRoom,
      targetSocketId
    });
    addToast('Declined join request', 'info');
  }, [addToast, roomCode]);

  const handleAdmitAll = useCallback((durationHours) => {
    const activeRoom = roomCodeRef.current || roomCode;
    if (!socketRef.current || !activeRoom) return;
    socketRef.current.emit('admit-all', {
      roomCode: activeRoom,
      durationHours: durationHours || 72
    });
    setIsRequestModalOpen(false);
    addToast('Admitted all waiting students!', 'success');
  }, [addToast, roomCode]);

  // Faculty Admissions & Expiry Actions
  const handleModifyAdmissionExpiry = useCallback(({ rollNumber, senderId, addHours, newDurationHours, newExpiresAt }) => {
    const activeRoom = roomCodeRef.current || roomCode;
    if (!socketRef.current || !activeRoom) return;
    socketRef.current.emit('modify-admission-expiry', {
      roomCode: activeRoom,
      rollNumber,
      senderId,
      addHours,
      newDurationHours,
      newExpiresAt
    });
  }, [roomCode]);

  const handleModifyRoomDefaultExpiry = useCallback(({ durationHours, applyToExisting }) => {
    const activeRoom = roomCodeRef.current || roomCode;
    if (!socketRef.current || !activeRoom) return;
    socketRef.current.emit('modify-room-default-expiry', {
      roomCode: activeRoom,
      durationHours,
      applyToExisting
    });
  }, [roomCode]);

  const handleRevokeAdmission = useCallback(({ rollNumber, senderId }) => {
    const activeRoom = roomCodeRef.current || roomCode;
    if (!socketRef.current || !activeRoom) return;
    socketRef.current.emit('revoke-admission', {
      roomCode: activeRoom,
      rollNumber,
      senderId
    });
  }, [roomCode]);

  const handleRefreshAdmissions = useCallback(() => {
    const activeRoom = roomCodeRef.current || roomCode;
    if (!socketRef.current || !activeRoom) return;
    socketRef.current.emit('get-room-admissions', {
      roomCode: activeRoom
    });
  }, [roomCode]);

  // Guest Waiting Room Actions
  const handleCancelAccessRequest = useCallback(() => {
    const targetCode = waitingRoomInfo?.code || roomCodeRef.current || roomCode;
    if (socketRef.current && targetCode) {
      socketRef.current.emit('cancel-access-request', { roomCode: targetCode });
    }
    setAccessStatus('none');
    setWaitingRoomInfo(null);
    setRoomCode('');
    roomCodeRef.current = '';
    window.location.hash = '#portal=student';
  }, [waitingRoomInfo, roomCode]);

  const handleUpdateWaitingProfile = useCallback(({ name, email, mobile }) => {
    handleSaveUserProfile({ name, email, mobile });
    const targetCode = waitingRoomInfo?.code || roomCodeRef.current || roomCode;
    if (socketRef.current && targetCode) {
      socketRef.current.emit('update-waiting-profile', {
        roomCode: targetCode,
        peerName: name || userNameRef.current,
        email: email !== undefined ? email : userEmailRef.current,
        mobile: mobile !== undefined ? mobile : userMobileRef.current
      });
    }
  }, [handleSaveUserProfile, waitingRoomInfo, roomCode]);

  const handleRequestAgain = useCallback(() => {
    const targetCode = waitingRoomInfo?.code || roomCodeRef.current || roomCode;
    if (targetCode) {
      joinRoom(targetCode);
      setAccessStatus('waiting');
    }
  }, [joinRoom, waitingRoomInfo, roomCode]);

  const handleViewRoomAttendance = useCallback(async (targetCode) => {
    try {
      const res = await fetch(`/api/room/${targetCode}/attendance`);
      const data = await res.json();
      if (data.attendance) {
        setAttendanceRecords(data.attendance);
        setRoomCode(targetCode);
        roomCodeRef.current = targetCode;
        setIsHost(true);
        setIsAttendanceModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to load room attendance', err);
    }
  }, []);

  // Initialize Socket.IO connection ONCE on mount
  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      const urlCode = getCodeFromUrl();
      if (urlCode) {
        const clean = urlCode.toString().trim().toLowerCase().replace(/\s+/g, '');
        if (activePortalRef.current === 'faculty' && facultyUser) {
          socket.emit('join-room', {
            roomCode: clean,
            peerName: facultyUser.name,
            rollNumber: facultyUser.facultyId,
            email: facultyUser.email || '',
            role: 'faculty',
            facultyId: facultyUser.facultyId,
            senderId: CLIENT_ID
          });
        } else if (userRollNumberRef.current && userNameRef.current && userNameRef.current !== DEFAULT_NAME) {
          socket.emit('join-room', {
            roomCode: clean,
            peerName: userNameRef.current,
            rollNumber: userRollNumberRef.current,
            email: userEmailRef.current,
            mobile: userMobileRef.current,
            role: 'student',
            senderId: CLIENT_ID
          });
        } else {
          setRoomCode(clean);
        }
      }
      // Note: Never auto-request new session on load; students can only join an existing classroom
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Guest is placed in waiting room
    socket.on('access-waiting', (data) => {
      setAccessStatus('waiting');
      setWaitingRoomInfo({
        code: data.code,
        slug: data.slug,
        formattedCode: data.formattedCode
      });
      setHostName(data.hostName || 'User 1');
      roomCodeRef.current = data.code;
      addToast(`Waiting for host (${data.hostName || 'User 1'}) to admit you...`, 'info');
    });

    // Host receives knock / join request
    socket.on('access-requested', (data) => {
      setPendingRequests(data.pendingRequests || []);
      setIsRequestModalOpen(true);
      playKnockSound();
      addToast(`🔔 ${data.peerName || 'A device'} requested access to join!`, 'info');
    });

    // Host receives updated queue
    socket.on('pending-requests-updated', (data) => {
      const list = data.pendingRequests || [];
      setPendingRequests(list);
      if (list.length === 0) {
        setIsRequestModalOpen(false);
      }
    });

    // Guest was denied
    socket.on('access-denied', (data) => {
      setAccessStatus('denied');
      setDeniedMessage(data.message || 'The host declined your request to join.');
      addToast('Join request declined by host', 'error');
    });

    // Attendance Log updated (pushed to host)
    socket.on('attendance-updated', (data) => {
      setAttendanceRecords(data.attendance || []);
    });

    // Room admissions data updated (pushed to faculty)
    socket.on('room-admissions-data', (data) => {
      if (data.admissions) setAdmissionsList(data.admissions);
      if (data.defaultDurationHours) setRoomDefaultDurationHours(data.defaultDurationHours);
    });

    socket.on('room-admissions-updated', (data) => {
      if (data.admissions) setAdmissionsList(data.admissions);
      if (data.defaultDurationHours) setRoomDefaultDurationHours(data.defaultDurationHours);
    });

    // Room joined payload
    socket.on('room-joined', (data) => {
      setAccessStatus('admitted');
      setIsHost(!!data.isHost);
      setHostName(data.hostName || 'User 1');
      setIsFacultyRoom(Boolean(data.isFacultyAssigned || data.roomCategory === 'faculty'));
      if (data.roomName) setRoomName(data.roomName);
      if (data.isHost) {
        setPendingRequests(data.pendingRequests || []);
        if (data.attendance) {
          setAttendanceRecords(data.attendance);
        }
        socket.emit('get-room-admissions', { roomCode: data.code });
      }
      setRoomCode(data.code);
      setRoomSlug(data.slug);
      setFormattedCode(data.formattedCode);
      setItems(data.items || []);
      setPeers(data.peers || []);
      setPeerCount(data.peerCount || 1);
      setTtlMinutes(data.ttlMinutes || 15);
      roomCodeRef.current = data.code;

      if (data.isLocked !== undefined) {
        setIsRoomLocked(data.isLocked);
      }

      if (data.admittedByHost) {
        playAdmittedSound();
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.2 }
        });
        addToast(`🎉 Admitted to session by ${data.hostName || 'host'}!`, 'success');
      }

      // Update URL hash safely without triggering infinite hashchange loop
      const targetHash = buildPortalHash(data.code, activePortalRef.current);
      if (window.location.hash !== targetHash) {
        isInternalHashChangeRef.current = true;
        window.location.hash = targetHash;
      }
    });

    socket.on('kicked-from-room', (data) => {
      setAccessStatus('denied');
      setDeniedMessage(data.message || 'You were removed from the classroom by the faculty host.');
      addToast(data.message || 'Removed from session by faculty host', 'error');
    });

    socket.on('room-lock-status', (data) => {
      setIsRoomLocked(data.isLocked);
      addToast(data.isLocked ? '🔒 Classroom is now locked by faculty.' : '🔓 Classroom is unlocked.', 'info');
    });

    socket.on('room-code-changed', (data) => {
      if (data.newCode) {
        setRoomCode(data.newCode);
        setRoomSlug(data.newCode);
        setFormattedCode(data.formattedCode || data.newCode);
        roomCodeRef.current = data.newCode;
        if (data.roomName) setRoomName(data.roomName);
        const targetHash = buildPortalHash(data.newCode, activePortalRef.current);
        if (window.location.hash !== targetHash) {
          isInternalHashChangeRef.current = true;
          window.location.hash = targetHash;
        }
        addToast(`Classroom code updated to: ${data.formattedCode || data.newCode}`, 'info');
      }
    });

    socket.on('room-info-updated', (data) => {
      if (data.code) {
        setRoomCode(data.code);
        setRoomSlug(data.code);
        setFormattedCode(data.code.length === 6 ? `${data.code.slice(0, 3)} ${data.code.slice(3)}` : data.code);
        roomCodeRef.current = data.code;
      }
      if (data.roomName) setRoomName(data.roomName);
      if (data.hostName) setHostName(data.hostName);
    });

    // Peer joined event
    socket.on('peer-joined', (data) => {
      setPeerCount(data.peerCount);
      if (data.peers) setPeers(data.peers);
      playPeerConnectSound();
      addToast(`🎉 ${data.peerName || 'Device'} paired! (${data.peerCount} active)`, 'success');
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.15 }
      });
    });

    // Peer left event
    socket.on('peer-left', (data) => {
      setPeerCount(data.peerCount || 1);
      if (data.peers) setPeers(data.peers);
      addToast(`Device disconnected (${data.peerCount} active)`, 'info');
    });

    // Peer renamed event
    socket.on('peer-renamed', (data) => {
      if (data.peers) setPeers(data.peers);
      addToast(`A connected device renamed to "${data.peerName}"`, 'info');
    });

    // Room TTL updated event
    socket.on('room-ttl-updated', (data) => {
      setTtlMinutes(data.ttlMinutes);
      addToast(`Expiration updated to ${formatTtlLabel(data.ttlMinutes)} by ${data.peerName}`, 'info');
    });

    // Session created response
    socket.on('session-created', (data) => {
      setAccessStatus('admitted');
      setIsHost(true);
      setPendingRequests([]);
      if (data.attendance) {
        setAttendanceRecords(data.attendance);
      }
      setRoomCode(data.code);
      setRoomSlug(data.slug);
      setFormattedCode(data.formattedCode);
      setItems([]);
      setPeers([{ socketId: socket.id, peerName: userNameRef.current, senderId: CLIENT_ID, joinedAt: Date.now(), isHost: true }]);
      setPeerCount(1);
      setTtlMinutes(15);
      roomCodeRef.current = data.code;

      const targetHash = buildPortalHash(data.code, activePortalRef.current);
      if (window.location.hash !== targetHash) {
        isInternalHashChangeRef.current = true;
        window.location.hash = targetHash;
      }
      addToast(`Fresh room generated: ${data.formattedCode}`, 'success');
    });

    // New item added in room
    socket.on('item-added', (item) => {
      setItems((prev) => [item, ...prev.filter((i) => i.id !== item.id)]);

      // If sent by peer (not self), trigger sound & toast
      if (item.senderId !== CLIENT_ID) {
        playReceiveSound();
        const typeLabels = {
          image: 'New image received',
          code: 'New code snippet received',
          video: 'New video received',
          audio: 'New audio received',
          file: `File received: ${item.payload?.fileName || ''}`,
          text: 'New text note received'
        };
        addToast(typeLabels[item.type] || 'New item received', 'info');
      }
    });

    // Peer activity (typing / dragging)
    let peerActivityTimeout = null;
    socket.on('peer-activity', ({ activity, active }) => {
      if (active) {
        if (activity === 'dragging') {
          setPeerActivity('Peer is dropping files...');
        } else if (activity === 'typing') {
          setPeerActivity('Peer is typing...');
        }
        clearTimeout(peerActivityTimeout);
        peerActivityTimeout = setTimeout(() => setPeerActivity(''), 3000);
      } else {
        setPeerActivity('');
      }
    });

    // Listen for external browser URL hash changes
    const handleHashChange = () => {
      if (isInternalHashChangeRef.current) {
        isInternalHashChangeRef.current = false;
        return;
      }
      const newCode = getCodeFromUrl();
      if (newCode && newCode !== roomCodeRef.current) {
        const clean = newCode.toString().trim().toLowerCase().replace(/\s+/g, '');
        if (activePortalRef.current === 'faculty' && facultyUser) {
          socket.emit('join-room', {
            roomCode: clean,
            peerName: facultyUser.name,
            rollNumber: facultyUser.facultyId,
            email: facultyUser.email || '',
            role: 'faculty',
            facultyId: facultyUser.facultyId,
            senderId: CLIENT_ID
          });
        } else if (userRollNumberRef.current && userNameRef.current && userNameRef.current !== DEFAULT_NAME) {
          socket.emit('join-room', {
            roomCode: clean,
            peerName: userNameRef.current,
            rollNumber: userRollNumberRef.current,
            email: userEmailRef.current,
            mobile: userMobileRef.current,
            role: 'student',
            senderId: CLIENT_ID
          });
        } else {
          setRoomCode(clean);
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      socket.disconnect();
    };
  }, [addToast]);

  // Upload files handler with progress tracking
  const uploadFiles = useCallback(async (files) => {
    const activeRoom = roomCodeRef.current || roomCode;
    if (!files || files.length === 0 || !activeRoom) return;

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('senderName', userNameRef.current);
    formData.append('senderId', CLIENT_ID);

    try {
      const cleanRoom = activeRoom.toString().trim().toLowerCase().replace(/\s+/g, '');
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/upload/${cleanRoom}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        setIsUploading(false);
        setUploadProgress(0);
        if (xhr.status >= 200 && xhr.status < 300) {
          playSendSound();
          addToast(`Uploaded ${files.length} item${files.length === 1 ? '' : 's'} successfully!`, 'success');
        } else {
          addToast('Failed to upload files', 'error');
        }
      };

      xhr.onerror = () => {
        setIsUploading(false);
        setUploadProgress(0);
        addToast('Network error during upload', 'error');
      };

      xhr.send(formData);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
      addToast('Upload error', 'error');
    }
  }, [addToast, roomCode]);

  // Global Drag and Drop event listeners
  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current += 1;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
        const activeRoom = roomCodeRef.current || roomCode;
        if (socketRef.current && activeRoom) {
          const clean = activeRoom.toString().trim().toLowerCase().replace(/\s+/g, '');
          socketRef.current.emit('peer-activity', { roomCode: clean, activity: 'dragging', active: true });
        }
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragging(false);
        const activeRoom = roomCodeRef.current || roomCode;
        if (socketRef.current && activeRoom) {
          const clean = activeRoom.toString().trim().toLowerCase().replace(/\s+/g, '');
          socketRef.current.emit('peer-activity', { roomCode: clean, activity: 'dragging', active: false });
        }
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      const activeRoom = roomCodeRef.current || roomCode;
      if (socketRef.current && activeRoom) {
        const clean = activeRoom.toString().trim().toLowerCase().replace(/\s+/g, '');
        socketRef.current.emit('peer-activity', { roomCode: clean, activity: 'dragging', active: false });
      }

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        uploadFiles(Array.from(e.dataTransfer.files));
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [uploadFiles, roomCode]);

  // Global Clipboard Paste Listener (Ctrl+V anywhere)
  useEffect(() => {
    const handlePaste = async (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea') {
        return;
      }

      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      const items = clipboardData.items;
      if (!items || items.length === 0) return;

      const activeRoom = roomCodeRef.current || roomCode;
      if (!activeRoom) return;
      const cleanRoom = activeRoom.toString().trim().toLowerCase().replace(/\s+/g, '');

      // 1. Check for image files on clipboard
      const imageFiles = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const ext = file.type.split('/')[1] || 'png';
            const screenshotFile = new File([file], `screenshot-${Date.now()}.${ext}`, { type: file.type });
            imageFiles.push(screenshotFile);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        addToast('Pasting screenshot from clipboard...', 'info');
        uploadFiles(imageFiles);
        return;
      }

      // 2. Check for text or code on clipboard
      const pastedText = clipboardData.getData('text');
      if (pastedText && pastedText.trim().length > 0) {
        e.preventDefault();
        const isLikelyCode = (
          pastedText.includes('\n') && 
          (pastedText.includes('{') || pastedText.includes('function') || pastedText.includes('const ') || pastedText.includes('def ') || pastedText.includes('import ') || pastedText.includes('class '))
        );

        if (isLikelyCode && pastedText.split('\n').length >= 3) {
          socketRef.current?.emit('send-code', {
            roomCode: cleanRoom,
            code: pastedText.trim(),
            language: 'javascript',
            title: 'Clipboard Code Snippet',
            senderName: userNameRef.current,
            senderId: CLIENT_ID
          });
          playSendSound();
          addToast('Pasted code snippet from clipboard!', 'success');
        } else {
          socketRef.current?.emit('send-text', {
            roomCode: cleanRoom,
            text: pastedText.trim(),
            senderName: userNameRef.current,
            senderId: CLIENT_ID
          });
          playSendSound();
          addToast('Pasted text from clipboard!', 'success');
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [uploadFiles, roomCode, addToast]);

  // Send Code Snippet handler
  const handleSendCode = ({ code, language, title }) => {
    const activeRoom = roomCodeRef.current || roomCode;
    if (!socketRef.current || !activeRoom || !code.trim()) return;
    const cleanRoom = activeRoom.toString().trim().toLowerCase().replace(/\s+/g, '');
    socketRef.current.emit('send-code', {
      roomCode: cleanRoom,
      code: code.trim(),
      language,
      title,
      senderName: userNameRef.current,
      senderId: CLIENT_ID
    });
    playSendSound();
    addToast('Code snippet sent to paired devices!', 'success');
  };

  // Send Text handler
  const handleSendText = (text) => {
    const activeRoom = roomCodeRef.current || roomCode;
    if (!socketRef.current || !activeRoom || !text.trim()) return;
    const cleanRoom = activeRoom.toString().trim().toLowerCase().replace(/\s+/g, '');
    socketRef.current.emit('send-text', {
      roomCode: cleanRoom,
      text: text.trim(),
      senderName: userNameRef.current,
      senderId: CLIENT_ID
    });
    playSendSound();
    addToast('Text note sent to paired devices!', 'success');
  };

  // Download All as ZIP
  const handleDownloadAllZip = () => {
    if (!roomCode) return;
    window.location.href = `/api/room/${roomCode}/zip`;
    addToast('Generating & downloading ZIP archive...', 'info');
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'files') return ['file', 'video', 'audio'].includes(item.type);
    if (activeFilter === 'images') return item.type === 'image';
    if (activeFilter === 'code') return item.type === 'code';
    if (activeFilter === 'text') return item.type === 'text';
    return true;
  });

  const hasFiles = items.some((item) => ['file', 'image', 'video', 'audio'].includes(item.type));

  // Reusable collaborative classroom workspace for Faculty and Students
  const renderClassroomWorkspace = () => (
    <>
      <Header
        roomCode={roomCode}
        roomSlug={roomSlug}
        formattedCode={formattedCode}
        peerCount={peerCount}
        userName={userName}
        isHost={isHost}
        pendingRequestsCount={pendingRequests.length}
        onOpenRequestsModal={() => setIsRequestModalOpen(true)}
        onOpenAttendanceModal={() => setIsAttendanceModalOpen(true)}
        onOpenRenameModal={() => setIsRenameModalOpen(true)}
        onOpenDevicesModal={() => setIsDevicesModalOpen(true)}
        ttlMinutes={ttlMinutes}
        onOpenTtlModal={() => setIsTtlModalOpen(true)}
        onNewTransfer={requestNewSession}
        onOpenQr={() => setIsQrModalOpen(true)}
        onOpenJoinModal={() => setIsJoinModalOpen(true)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        addToast={addToast}
        isFacultyRoom={isFacultyRoom}
        roomName={roomName}
        isStudent={activePortal === 'student' || !isHost}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:py-8 flex flex-col">
        {/* Action Toolbar */}
        <ActionToolbar
          onFilesSelected={uploadFiles}
          onOpenTextModal={() => setIsTextModalOpen(true)}
          onOpenCodeModal={() => setIsCodeModalOpen(true)}
          onDownloadAllZip={handleDownloadAllZip}
          hasFiles={hasFiles}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          peerActivity={peerActivity}
        />

        {/* Filter bar & Stats */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 rounded-2xl border border-white/5 text-xs font-medium">
            {[
              { id: 'all', label: `All (${items.length})` },
              { id: 'images', label: `Images (${items.filter(i => i.type === 'image').length})` },
              { id: 'files', label: `Files & Media (${items.filter(i => ['file', 'video', 'audio'].includes(i.type)).length})` },
              { id: 'code', label: `Code (${items.filter(i => i.type === 'code').length})` },
              { id: 'text', label: `Notes (${items.filter(i => i.type === 'text').length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <button
              onClick={() => setIsTtlModalOpen(true)}
              title="Click to edit transfer expiration time"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/5 hover:border-amber-500/40 transition-all group active:scale-95 shadow-inner cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400 group-hover:animate-pulse" />
              <span>Expires: <strong className="text-amber-300 font-semibold">{formatTtlLabel(ttlMinutes)}</strong></span>
              <ChevronDown className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition-colors ml-0.5" />
            </button>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Zero-log ephemeral memory</span>
            </span>
          </div>
        </div>

        {/* Transfer Items Grid / Empty State */}
        {filteredItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-dashed border-white/10 bg-slate-900/20 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">
              <Inbox className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Classroom space is ready</h3>
            <p className="text-slate-400 text-sm max-w-md mb-6">
              Drag and drop lecture slides or materials, press <kbd className="px-1.5 py-0.5 rounded font-mono text-xs border">Ctrl+V</kbd> to paste code, or scan the QR code to connect from mobile.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setIsQrModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium border border-white/10 transition-colors cursor-pointer"
              >
                Show Mobile QR
              </button>
              <button
                onClick={() => setIsJoinModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium border border-white/10 transition-colors cursor-pointer"
              >
                Switch Code
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                currentClientId={CLIENT_ID}
                onOpenImageModal={(url, name) => setSelectedImage({ url, name })}
                addToast={addToast}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-4 px-6 text-center text-xs text-slate-500 glass-panel mt-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">MOMO</span>
            <span>—</span>
            <span>3-Portal Live Classroom & Real-time Collaboration</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Main Admin Control</span>
            <span>•</span>
            <span>Faculty Semi-Admin</span>
            <span>•</span>
            <span>Student Knock & Admit</span>
          </div>
        </div>
      </footer>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-cyan-500/30 relative">
      {/* External Dynamic Background Wallpaper */}
      <div className={`bg-wallpaper ${isDark ? 'bg-wallpaper-dark' : 'bg-wallpaper-light'}`} />

      {/* Ambient Animated Glow Orbs */}
      <div className="ambient-orb-1" />
      <div className="ambient-orb-2" />

      {/* Full-window Drag Overlay */}
      <DropZoneOverlay isDragging={isDragging} />

      {/* Role-Isolated Portal Header (Zero cross-portal switching tabs) */}
      <PortalNavigation
        activePortal={activePortal}
        adminUser={adminUser}
        onAdminLogout={handleAdminLogout}
        facultyUser={facultyUser}
        onFacultyLogout={handleFacultyLogout}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* MAIN ADMIN PORTAL (SUPER ADMIN) */}
      {activePortal === 'admin' && (
        <AdminPortal
          adminUser={adminUser}
          onAdminLogin={handleAdminLogin}
          onAdminLogout={handleAdminLogout}
          addToast={addToast}
          onLaunchRoom={(code) => {
            setActivePortal('faculty');
            activePortalRef.current = 'faculty';
            sessionStorage.setItem('momo_active_portal', 'faculty');
            const targetHash = `#portal=faculty&code=${code}`;
            if (window.location.hash !== targetHash) {
              isInternalHashChangeRef.current = true;
              window.location.hash = targetHash;
            }
            setRoomCode(code);
            roomCodeRef.current = code;
            joinRoom(code, {
              name: facultyUser ? facultyUser.name : 'Faculty Host',
              role: 'faculty',
              facultyId: facultyUser ? facultyUser.facultyId : null
            });
          }}
        />
      )}

      {/* FACULTY PORTAL (SEMI-ADMIN) */}
      {activePortal === 'faculty' && (
        <FacultyPortal
          facultyUser={facultyUser}
          onFacultyLogin={handleFacultyLogin}
          onFacultyLogout={handleFacultyLogout}
          onLaunchClassroom={(code) => {
            if (code) {
              setActivePortal('faculty');
              activePortalRef.current = 'faculty';
              sessionStorage.setItem('momo_active_portal', 'faculty');
              const targetHash = `#portal=faculty&code=${code}`;
              if (window.location.hash !== targetHash) {
                isInternalHashChangeRef.current = true;
                window.location.hash = targetHash;
              }
              setRoomCode(code);
              roomCodeRef.current = code;
              joinRoom(code, {
                name: facultyUser.name,
                email: facultyUser.email,
                role: 'faculty',
                facultyId: facultyUser.facultyId,
                rollNumber: facultyUser.facultyId
              });
            } else {
              if (socketRef.current && roomCodeRef.current) {
                socketRef.current.emit('leave-room', { roomCode: roomCodeRef.current });
              }
              setRoomCode('');
              roomCodeRef.current = '';
              isInternalHashChangeRef.current = true;
              window.location.hash = '#portal=faculty';
            }
          }}
          onViewRoomAttendance={handleViewRoomAttendance}
          currentRoomCode={roomCode}
          isHost={isHost}
          pendingRequestsCount={pendingRequests.length}
          onOpenRequestsModal={() => setIsRequestModalOpen(true)}
          onOpenAttendanceModal={() => setIsAttendanceModalOpen(true)}
          isRoomLocked={isRoomLocked}
          onToggleLockRoom={handleToggleLockRoom}
          addToast={addToast}
        >
          {renderClassroomWorkspace()}
        </FacultyPortal>
      )}

      {/* STUDENT PORTAL */}
      {activePortal === 'student' && (
        <StudentPortal
          roomCode={roomCode}
          userName={userName}
          userRollNumber={userRollNumber}
          userEmail={userEmail}
          userMobile={userMobile}
          onJoinRoom={(details) => {
            setUserName(details.peerName);
            setUserRollNumber(details.rollNumber);
            setUserEmail(details.email);
            setUserMobile(details.mobile);
            localStorage.setItem('momo_username', details.peerName);
            localStorage.setItem('momo_roll_number', details.rollNumber);
            if (details.email) localStorage.setItem('momo_email', details.email);
            if (details.mobile) localStorage.setItem('momo_mobile', details.mobile);

            joinRoom(details.roomCode, {
              name: details.peerName,
              rollNumber: details.rollNumber,
              email: details.email,
              mobile: details.mobile,
              role: 'student'
            });
          }}
          onLeaveRoom={() => {
            if (socketRef.current && roomCodeRef.current) {
              socketRef.current.emit('leave-room', { roomCode: roomCodeRef.current });
            }
            setRoomCode('');
            roomCodeRef.current = '';
            setAccessStatus('none');
            setWaitingRoomInfo(null);
            setItems([]);
            setPeers([]);
            window.location.hash = '#portal=student';
          }}
          isConnected={isConnected}
          isAdmitted={accessStatus === 'admitted'}
          addToast={addToast}
        >
          {renderClassroomWorkspace()}
        </StudentPortal>
      )}

      {/* Modals */}
      <CodeModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        onSendCode={handleSendCode}
      />

      <TextModal
        isOpen={isTextModalOpen}
        onClose={() => setIsTextModalOpen(false)}
        onSendText={handleSendText}
      />

      <QrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        roomCode={roomCode}
        roomSlug={roomSlug}
        formattedCode={formattedCode}
        addToast={addToast}
      />

      <JoinModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onJoinRoom={joinRoom}
        onGenerateNewRoom={requestNewSession}
        userName={userName}
        userEmail={userEmail}
        userMobile={userMobile}
        isStudent={activePortal === 'student' || !isHost}
      />

      <ImageModal
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        imageUrl={selectedImage?.url}
        fileName={selectedImage?.name}
        addToast={addToast}
      />

      <RenameUserModal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        currentName={userName}
        currentEmail={userEmail}
        currentMobile={userMobile}
        onSaveProfile={handleSaveUserProfile}
      />

      <TtlModal
        isOpen={isTtlModalOpen}
        onClose={() => setIsTtlModalOpen(false)}
        currentTtl={ttlMinutes}
        onSelectTtl={handleSelectTtl}
      />

      <ConnectedDevicesModal
        isOpen={isDevicesModalOpen}
        onClose={() => setIsDevicesModalOpen(false)}
        peers={peers}
        currentClientId={CLIENT_ID}
        onOpenQr={() => setIsQrModalOpen(true)}
      />

      {/* Waiting Room Overlay for Students waiting for Faculty approval */}
      <WaitingRoomOverlay
        isOpen={accessStatus === 'waiting' || accessStatus === 'denied'}
        status={accessStatus}
        roomCode={waitingRoomInfo?.code || roomCode}
        roomSlug={waitingRoomInfo?.slug || roomSlug}
        formattedCode={waitingRoomInfo?.formattedCode || formattedCode}
        hostName={hostName}
        userName={userName}
        userRollNumber={userRollNumber}
        userEmail={userEmail}
        userMobile={userMobile}
        deniedMessage={deniedMessage}
        onUpdateProfile={handleUpdateWaitingProfile}
        onCancelRequest={handleCancelAccessRequest}
        onRequestAgain={handleRequestAgain}
      />

      {/* Access Request Modal for Faculty Host */}
      <AccessRequestModal
        isOpen={isHost && isRequestModalOpen && pendingRequests.length > 0}
        onClose={() => setIsRequestModalOpen(false)}
        pendingRequests={pendingRequests}
        onAdmit={handleAdmitPeer}
        onDeny={handleDenyPeer}
        onAdmitAll={handleAdmitAll}
        defaultDurationHours={roomDefaultDurationHours}
      />

      {/* Admin / Faculty Attendance & Login Details Modal */}
      <AttendanceModal
        isOpen={isHost && isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        attendance={attendanceRecords}
        roomCode={roomCode}
        roomSlug={roomSlug}
        addToast={addToast}
        onDeleteRecord={(id) => setAttendanceRecords(prev => prev.filter(r => r.id !== id))}
        onClearRecords={() => setAttendanceRecords([])}
        isFaculty={true}
        admissions={admissionsList}
        defaultDurationHours={roomDefaultDurationHours}
        onModifyAdmissionExpiry={handleModifyAdmissionExpiry}
        onModifyRoomDefaultExpiry={handleModifyRoomDefaultExpiry}
        onRevokeAdmission={handleRevokeAdmission}
        onRefreshAdmissions={handleRefreshAdmissions}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
