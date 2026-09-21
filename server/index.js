import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const ROOM_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

// Ensure temporary uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'temp');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e8 // 100 MB max buffer size for websocket
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory data store
// rooms[normalizedCode] = { code, slug, createdAt, lastActivity, items: [], peers: Set<socketId> }
const rooms = new Map();
// files[fileId] = { fileId, originalName, storedPath, mimeType, size, createdAt, roomCode }
const filesRegistry = new Map();

// Persistent Master / Super Admins Store
const ADMINS_FILE = path.join(__dirname, '..', 'server', 'data', 'admins.json');
const DATA_DIR = path.join(__dirname, '..', 'server', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const adminsStore = new Map();

function saveAdminsToFile() {
  try {
    const list = Array.from(adminsStore.values());
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save admins to file:', err);
  }
}

function loadAdminsFromFile() {
  try {
    if (fs.existsSync(ADMINS_FILE)) {
      const data = fs.readFileSync(ADMINS_FILE, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list) && list.length > 0) {
        adminsStore.clear();
        for (const admin of list) {
          adminsStore.set(admin.username.toLowerCase(), admin);
        }
        return;
      }
    }
  } catch (err) {
    console.error('Failed to load admins from file, fallback to default:', err);
  }

  // Fallback initial Super Admin
  const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
  const defaultPassword = process.env.ADMIN_PASSWORD || 'Yash1822';
  const initialAdmin = {
    id: 'admin_root',
    username: defaultUsername,
    password: defaultPassword,
    name: 'Main System Administrator',
    email: '',
    createdAt: new Date().toISOString(),
    isRoot: true
  };
  adminsStore.set(defaultUsername.toLowerCase(), initialAdmin);
  saveAdminsToFile();
}

loadAdminsFromFile();

// Faculty Store: facultyId -> { id, facultyId, password, name, email, department, assignedRooms: [], createdAt, isActive }
const FACULTIES_FILE = path.join(__dirname, '..', 'server', 'data', 'faculties.json');
const facultyStore = new Map();

function saveFacultiesToFile() {
  try {
    const list = Array.from(facultyStore.values());
    fs.writeFileSync(FACULTIES_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save faculties to file:', err);
  }
}

function loadFacultiesFromFile() {
  try {
    if (fs.existsSync(FACULTIES_FILE)) {
      const data = fs.readFileSync(FACULTIES_FILE, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) {
        facultyStore.clear();
        for (const f of list) {
          facultyStore.set(f.facultyId.toUpperCase(), f);
        }
      }
    }
  } catch (err) {
    console.error('Failed to load faculties from file:', err);
  }
}

loadFacultiesFromFile();

// Global Attendance Store & Persistence: id -> attendanceEntry
const ATTENDANCE_FILE = path.join(__dirname, '..', 'server', 'data', 'attendance.json');
const globalAttendanceStore = new Map();

function saveAttendanceToFile() {
  try {
    const list = Array.from(globalAttendanceStore.values());
    fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save attendance to file:', err);
  }
}

function loadAttendanceFromFile() {
  try {
    if (fs.existsSync(ATTENDANCE_FILE)) {
      const data = fs.readFileSync(ATTENDANCE_FILE, 'utf-8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) {
        globalAttendanceStore.clear();
        for (const item of list) {
          // If faculty session has student roll number or default, resolve to actual facultyId
          if (item.isHost || item.role === 'Faculty (Host)') {
            let facId = null;
            const norm = item.roomCode ? item.roomCode.toString().trim().toLowerCase().replace(/\s+/g, '') : '';
            for (const fac of facultyStore.values()) {
              if ((fac.assignedRooms && fac.assignedRooms.some(c => c.toString().trim().toLowerCase().replace(/\s+/g, '') === norm)) || fac.name === item.name) {
                facId = fac.facultyId;
                break;
              }
            }
            if (facId && (!item.rollNumber || item.rollNumber === 'FACULTY' || !item.rollNumber.toUpperCase().startsWith('FAC'))) {
              item.rollNumber = facId;
            }
          }
          globalAttendanceStore.set(item.id, item);
        }
      }
    }
  } catch (err) {
    console.error('Failed to load attendance from file:', err);
  }
}

loadAttendanceFromFile();

// Random 3-word slug generators
const ADJECTIVES = ['fast', 'blue', 'swift', 'brave', 'cool', 'bright', 'vivid', 'cosmic', 'silent', 'golden', 'neon', 'rapid', 'atomic', 'solar', 'mystic', 'hyper', 'zenith', 'stellar'];
const COLORS = ['falcon', 'tiger', 'comet', 'phoenix', 'otter', 'dolphin', 'panther', 'eagle', 'dragon', 'rocket', 'badger', 'badger', 'sparrow', 'lynx', 'cheetah', 'condor', 'jaguar'];
const NOUNS = ['pulse', 'beacon', 'orbit', 'wave', 'signal', 'spark', 'nexus', 'vortex', 'relay', 'haven', 'matrix', 'stream', 'horizon', 'prism', 'zenith', 'breeze'];

export function generateSlug() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const col = COLORS[Math.floor(Math.random() * COLORS.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}-${col}-${noun}`;
}

export function generate6DigitCode() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return num.toString();
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    const ext = path.extname(file.originalname) || '';
    cb(null, `${fileId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB limit
});

// Helper to normalize room code (strip spaces, lowercase)
function normalizeCode(code) {
  if (!code) return '';
  return code.toString().trim().toLowerCase().replace(/\s+/g, '');
}

function getOrCreateRoom(codeOrSlug, creatorId = null, creatorName = 'User 1', roomLabel = '') {
  const normalized = normalizeCode(codeOrSlug);

  // Check if this room is in any faculty's assigned rooms
  let matchedFaculty = null;
  for (const fac of facultyStore.values()) {
    if (fac.assignedRooms && fac.assignedRooms.some(c => normalizeCode(c) === normalized)) {
      matchedFaculty = fac;
      break;
    }
  }

  if (rooms.has(normalized)) {
    const room = rooms.get(normalized);
    room.lastActivity = Date.now();

    // Check if matchedFaculty or room.assignedFacultyId exists
    if (!matchedFaculty && room.assignedFacultyId) {
      matchedFaculty = facultyStore.get(room.assignedFacultyId.toUpperCase());
    }
    if (!matchedFaculty) {
      for (const fac of facultyStore.values()) {
        if (fac.assignedRooms && fac.assignedRooms.some(c => normalizeCode(c) === normalizeCode(room.code) || normalizeCode(c) === normalizeCode(room.slug))) {
          matchedFaculty = fac;
          break;
        }
      }
    }

    if (matchedFaculty) {
      room.assignedFacultyId = matchedFaculty.facultyId;
      room.hostName = matchedFaculty.name;
      room.isFacultyAssigned = true;
      room.roomCategory = 'faculty';
      if (!room.roomName || room.roomName.startsWith('Room ') || room.roomName.startsWith('Student Space') || room.roomName.startsWith('Peer Space')) {
        room.roomName = roomLabel || `${matchedFaculty.department || 'Classroom'} - ${matchedFaculty.name}`;
      }
    } else if (room.isFacultyAssigned) {
      room.roomCategory = 'faculty';
    } else {
      room.roomCategory = 'student';
    }

    if (creatorId && !room.hostClientId) {
      room.hostClientId = creatorId;
      room.hostName = matchedFaculty ? matchedFaculty.name : (creatorName || 'User 1');
      room.admittedClients.add(creatorId);
    }
    if (roomLabel && (!room.roomName || room.roomName.startsWith('Room ') || room.roomName.startsWith('Student Space') || room.roomName.startsWith('Peer Space'))) {
      room.roomName = roomLabel;
    }
    return room;
  }

  // Determine if it's 6-digit or slug
  const isDigits = /^\d{6}$/.test(normalized);
  const code = isDigits ? normalized : generate6DigitCode();
  const slug = isDigits ? generateSlug() : normalized;

  // Secondary check with code or slug
  if (!matchedFaculty) {
    for (const fac of facultyStore.values()) {
      if (fac.assignedRooms && fac.assignedRooms.some(c => normalizeCode(c) === normalizeCode(code) || normalizeCode(c) === normalizeCode(slug))) {
        matchedFaculty = fac;
        break;
      }
    }
  }

  const isFacultyAssigned = Boolean(matchedFaculty);
  const roomAttendanceLog = new Map();
  for (const [id, entry] of globalAttendanceStore.entries()) {
    if (normalizeCode(entry.roomCode) === normalizeCode(code) || (slug && normalizeCode(entry.roomCode) === normalizeCode(slug))) {
      roomAttendanceLog.set(id, entry);
    }
  }

  const room = {
    code,
    slug,
    roomName: roomLabel || (isFacultyAssigned ? `${matchedFaculty.department || 'Classroom'} - ${matchedFaculty.name}` : `Peer Space ${code}`),
    roomCategory: isFacultyAssigned ? 'faculty' : 'student',
    assignedFacultyId: isFacultyAssigned ? matchedFaculty.facultyId : null,
    isFacultyAssigned,
    isLocked: false,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    ttlMinutes: 15, // default 15 minutes, configurable to 30, 60, 1440, or 'infinity'
    items: [],
    hostClientId: creatorId || null,
    hostSocketId: null,
    hostName: isFacultyAssigned ? matchedFaculty.name : (creatorName || 'User 1'),
    admittedClients: new Set(creatorId ? [creatorId] : []),
    waitingPeers: new Map(), // socketId -> { socketId, peerName, rollNumber, email, mobile, senderId, role, requestedAt }
    peers: new Map(), // socketId -> { socketId, peerName, rollNumber, email, mobile, senderId, joinedAt, isHost, role }
    attendanceLog: roomAttendanceLog // entryId -> { id, roomCode, roomName, senderId, socketId, name, rollNumber, email, mobile, role, isHost, joinedAt, exitedAt, duration, status }
  };

  rooms.set(normalizeCode(code), room);
  rooms.set(normalizeCode(slug), room);
  return room;
}

function formatDuration(seconds) {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs === 0) return `${remMins}m ${secs}s`;
  return `${hrs}h ${remMins}m`;
}

function recordAttendance(room, { senderId, socketId, name, rollNumber, email, mobile, isHost, role }) {
  if (!senderId && !socketId) return null;

  const userRole = isHost ? 'Faculty (Host)' : (role || 'Student');
  const now = new Date().toISOString();

  // Resolve rollNumber / ID: If faculty host, always ensure we use the faculty ID, never a student roll number
  let finalId = rollNumber;
  if (isHost || userRole === 'Faculty (Host)') {
    let facId = null;
    if (room.assignedFacultyId) {
      facId = room.assignedFacultyId;
    } else {
      const norm = normalizeCode(room.code);
      for (const fac of facultyStore.values()) {
        if ((fac.assignedRooms && fac.assignedRooms.some(c => normalizeCode(c) === norm)) || fac.name === name || fac.name === room.hostName) {
          facId = fac.facultyId;
          break;
        }
      }
    }
    if (rollNumber && rollNumber.toUpperCase().startsWith('FAC')) {
      finalId = rollNumber.toUpperCase();
    } else {
      finalId = facId || 'FAC101';
    }
  } else {
    finalId = rollNumber && rollNumber.trim() ? rollNumber.trim() : 'N/A';
  }

  // Find if there is an ALREADY ACTIVE session for this user in this room
  let activeEntry = null;
  for (const entry of room.attendanceLog.values()) {
    if (entry.status === 'Active' && ((senderId && entry.senderId === senderId) || (socketId && entry.socketId === socketId))) {
      activeEntry = entry;
      break;
    }
  }

  if (activeEntry) {
    // Reconnecting or updating active session
    activeEntry.socketId = socketId || activeEntry.socketId;
    if (name) activeEntry.name = name;
    if (finalId && finalId !== 'N/A') activeEntry.rollNumber = finalId;
    if (email && email !== 'N/A') activeEntry.email = email;
    if (mobile && mobile !== 'N/A') activeEntry.mobile = mobile;
    activeEntry.role = userRole;
    activeEntry.isHost = Boolean(isHost);
    globalAttendanceStore.set(activeEntry.id, activeEntry);
    saveAttendanceToFile();
    return activeEntry;
  }

  // Not currently active: This is a NEW session (either first join, or re-join after exiting / logging out)
  const entryId = uuidv4();
  const newEntry = {
    id: entryId,
    roomCode: room.code,
    roomName: room.roomName,
    hostName: room.hostName || 'Faculty Host',
    senderId: senderId || socketId,
    socketId: socketId || null,
    name: name || (isHost ? (room.hostName || 'Faculty Host') : 'Student'),
    rollNumber: finalId,
    email: email && email.trim() ? email.trim() : 'N/A',
    mobile: mobile && mobile.trim() ? mobile.trim() : 'N/A',
    role: userRole,
    isHost: Boolean(isHost),
    joinedAt: now,
    exitedAt: null,
    duration: '0s',
    status: 'Active'
  };

  room.attendanceLog.set(entryId, newEntry);
  globalAttendanceStore.set(entryId, newEntry);
  saveAttendanceToFile();
  return newEntry;
}

function recordExit(room, socketId, senderId = null) {
  if (!room || !room.attendanceLog) return;
  const now = new Date().toISOString();
  let updated = false;

  for (const entry of room.attendanceLog.values()) {
    if (entry.status === 'Active') {
      const matchSocket = socketId && entry.socketId === socketId;
      const matchSender = senderId && entry.senderId === senderId;
      if (matchSocket || matchSender) {
        entry.exitedAt = now;
        entry.status = 'Exited';
        const durationSec = Math.max(0, Math.round((Date.now() - new Date(entry.joinedAt).getTime()) / 1000));
        entry.duration = formatDuration(durationSec);
        globalAttendanceStore.set(entry.id, entry);
        updated = true;
      }
    }
  }

  if (updated) {
    saveAttendanceToFile();
  }
}

function getAttendanceList(room) {
  if (!room || !room.attendanceLog) return [];
  return Array.from(room.attendanceLog.values()).map(entry => {
    let duration = entry.duration;
    if (entry.status === 'Active') {
      const liveSec = Math.max(0, Math.round((Date.now() - new Date(entry.joinedAt).getTime()) / 1000));
      duration = `${formatDuration(liveSec)} (Live)`;
    }
    return {
      ...entry,
      duration: duration || '0s'
    };
  }).sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
}

function getStudentAttendanceList(room) {
  return getAttendanceList(room).filter(entry => !entry.isHost && !entry.role?.includes('Faculty'));
}

function notifyAdminAttendance(room) {
  if (!room) return;
  const hostPeer = Array.from(room.peers.values()).find(p => p.isHost);
  const hostTargetSocketId = room.hostSocketId || hostPeer?.socketId;
  if (hostTargetSocketId) {
    io.to(hostTargetSocketId).emit('attendance-updated', {
      attendance: getStudentAttendanceList(room)
    });
  }
}

// REST API Endpoints

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeRooms: rooms.size / 2,
    activeFiles: filesRegistry.size,
    totalFaculties: facultyStore.size
  });
});

// Master / Super Admin Authentication
app.post('/api/auth/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required' });
  }
  const cleanUsername = username.trim().toLowerCase();
  const admin = adminsStore.get(cleanUsername);

  if (admin && admin.password === password) {
    return res.json({
      success: true,
      role: 'admin',
      token: 'admin_token_' + Date.now(),
      user: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        email: admin.email || '',
        role: 'admin',
        isRoot: Boolean(admin.isRoot)
      }
    });
  }
  return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
});

// Admin: Get all Super Admins
app.get('/api/admin/super-admins', (req, res) => {
  const list = Array.from(adminsStore.values()).map(a => ({
    id: a.id,
    username: a.username,
    name: a.name,
    email: a.email || '',
    createdAt: a.createdAt,
    isRoot: Boolean(a.isRoot)
  }));
  res.json({ success: true, superAdmins: list });
});

// Admin: Create new Super Admin
app.post('/api/admin/super-admins', (req, res) => {
  const { username, password, name, email } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ success: false, error: 'Name, username, and password are required' });
  }
  const cleanUsername = username.trim().toLowerCase();
  if (adminsStore.has(cleanUsername)) {
    return res.status(400).json({ success: false, error: `Super Admin "${username.trim()}" already exists` });
  }

  const newAdmin = {
    id: 'admin_' + uuidv4().slice(0, 8),
    username: username.trim(),
    password: password.trim(),
    name: name.trim(),
    email: email ? email.trim() : '',
    createdAt: new Date().toISOString(),
    isRoot: false
  };

  adminsStore.set(cleanUsername, newAdmin);
  saveAdminsToFile();

  res.json({
    success: true,
    superAdmin: {
      id: newAdmin.id,
      username: newAdmin.username,
      name: newAdmin.name,
      email: newAdmin.email,
      createdAt: newAdmin.createdAt,
      isRoot: false
    }
  });
});

// Admin: Delete a Super Admin
app.delete('/api/admin/super-admins/:id', (req, res) => {
  const { id } = req.params;
  const currentAdminUsername = (req.headers['x-admin-username'] || '').toLowerCase();

  if (adminsStore.size <= 1) {
    return res.status(400).json({ success: false, error: 'Cannot delete the only remaining Super Admin account' });
  }

  let foundKey = null;
  let targetAdmin = null;
  for (const [key, admin] of adminsStore.entries()) {
    if (admin.id === id || admin.username.toLowerCase() === id.toLowerCase()) {
      foundKey = key;
      targetAdmin = admin;
      break;
    }
  }

  if (!targetAdmin) {
    return res.status(404).json({ success: false, error: 'Super Admin account not found' });
  }

  if (currentAdminUsername && targetAdmin.username.toLowerCase() === currentAdminUsername) {
    return res.status(400).json({ success: false, error: 'You cannot delete your own active Super Admin account' });
  }

  adminsStore.delete(foundKey);
  saveAdminsToFile();

  res.json({
    success: true,
    message: `Super Admin "${targetAdmin.name}" (${targetAdmin.username}) deleted successfully`
  });
});

// Admin: Update own Profile (Username / Password / Name)
app.put('/api/admin/profile', (req, res) => {
  const { currentUsername, currentPassword, newUsername, newPassword, name, email } = req.body;
  if (!currentUsername) {
    return res.status(400).json({ success: false, error: 'Current username is required' });
  }

  const oldKey = currentUsername.trim().toLowerCase();
  const admin = adminsStore.get(oldKey);

  if (!admin) {
    return res.status(404).json({ success: false, error: 'Admin account not found' });
  }

  if (currentPassword && admin.password !== currentPassword) {
    return res.status(401).json({ success: false, error: 'Current password does not match' });
  }

  // Handle Username update
  if (newUsername && newUsername.trim().toLowerCase() !== oldKey) {
    const newKey = newUsername.trim().toLowerCase();
    if (adminsStore.has(newKey)) {
      return res.status(400).json({ success: false, error: `Username "${newUsername.trim()}" is already in use` });
    }
    adminsStore.delete(oldKey);
    admin.username = newUsername.trim();
    adminsStore.set(newKey, admin);
  }

  // Handle Password update
  if (newPassword && newPassword.trim()) {
    admin.password = newPassword.trim();
  }

  // Handle Name update
  if (name && name.trim()) {
    admin.name = name.trim();
  }

  // Handle Email update
  if (email !== undefined) {
    admin.email = email.trim();
  }

  saveAdminsToFile();

  res.json({
    success: true,
    user: {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      email: admin.email || '',
      role: 'admin',
      isRoot: Boolean(admin.isRoot)
    }
  });
});

// Faculty (Semi-Admin) Authentication
app.post('/api/auth/faculty/login', (req, res) => {
  const { facultyId, password } = req.body;
  if (!facultyId || !password) {
    return res.status(400).json({ success: false, error: 'Faculty ID and password are required' });
  }
  const cleanId = facultyId.trim().toUpperCase();
  const faculty = facultyStore.get(cleanId);
  if (!faculty || faculty.password !== password) {
    return res.status(401).json({ success: false, error: 'Invalid Faculty ID or password' });
  }
  if (!faculty.isActive) {
    return res.status(403).json({ success: false, error: 'Faculty account is deactivated by Main Admin' });
  }

  // Fetch full room details for assigned rooms
  const assignedRoomDetails = (faculty.assignedRooms || []).map(code => {
    const room = getOrCreateRoom(code, null, faculty.name);
    return {
      code: room.code,
      slug: room.slug,
      formattedCode: `${room.code.slice(0, 3)} ${room.code.slice(3)}`,
      roomName: room.roomName || `Classroom ${room.code}`,
      ttlMinutes: room.ttlMinutes || 15,
      activePeers: room.peers.size,
      activeStudents: Array.from(room.peers.values()).filter(p => !p.isHost).length,
      waitingStudents: room.waitingPeers.size
    };
  });

  return res.json({
    success: true,
    role: 'faculty',
    token: 'faculty_token_' + Date.now(),
    faculty: {
      id: faculty.id,
      facultyId: faculty.facultyId,
      name: faculty.name,
      email: faculty.email,
      department: faculty.department,
      assignedRooms: faculty.assignedRooms || [],
      assignedRoomDetails
    }
  });
});

// Admin: Get all faculties
app.get('/api/admin/faculties', (req, res) => {
  const list = Array.from(facultyStore.values()).map(f => {
    const roomDetails = (f.assignedRooms || []).map(code => {
      const room = rooms.get(normalizeCode(code));
      return {
        code,
        slug: room?.slug || '',
        roomName: room?.roomName || `Room ${code}`,
        livePeers: room?.peers.size || 0
      };
    });
    return {
      id: f.id,
      facultyId: f.facultyId,
      password: f.password,
      name: f.name,
      email: f.email,
      department: f.department,
      assignedRooms: f.assignedRooms || [],
      roomDetails,
      createdAt: f.createdAt,
      isActive: f.isActive
    };
  });
  res.json({ success: true, faculties: list });
});

// Admin: Create new faculty and assign room
app.post('/api/admin/faculty', (req, res) => {
  const { facultyId, password, name, email, department, assignedRoomCode, roomName } = req.body;
  if (!facultyId || !password || !name) {
    return res.status(400).json({ success: false, error: 'Faculty ID, password, and name are required' });
  }
  const cleanId = facultyId.trim().toUpperCase();
  if (facultyStore.has(cleanId)) {
    return res.status(400).json({ success: false, error: `Faculty ID "${cleanId}" already exists` });
  }

  const assignedRooms = [];
  let targetRoomCode = assignedRoomCode ? normalizeCode(assignedRoomCode) : generate6DigitCode();
  while (rooms.has(normalizeCode(targetRoomCode)) && !assignedRoomCode) {
    targetRoomCode = generate6DigitCode();
  }

  const room = getOrCreateRoom(targetRoomCode, null, name, roomName || `${department || 'Classroom'} - ${name}`);
  room.assignedFacultyId = cleanId;
  room.hostName = name;
  room.isFacultyAssigned = true;
  room.roomCategory = 'faculty';
  assignedRooms.push(room.code);

  const newFaculty = {
    id: 'fac_' + uuidv4().slice(0, 8),
    facultyId: cleanId,
    password: password.trim(),
    name: name.trim(),
    email: email ? email.trim() : '',
    department: department ? department.trim() : 'General Department',
    assignedRooms,
    createdAt: new Date().toISOString(),
    isActive: true
  };

  facultyStore.set(cleanId, newFaculty);
  saveFacultiesToFile();

  res.json({
    success: true,
    faculty: newFaculty,
    createdRoom: {
      code: room.code,
      slug: room.slug,
      roomName: room.roomName,
      formattedCode: `${room.code.slice(0, 3)} ${room.code.slice(3)}`
    }
  });
});

// Admin: Update faculty / reset password / toggle active
app.put('/api/admin/faculty/:facultyId', (req, res) => {
  const { facultyId } = req.params;
  const cleanId = facultyId.trim().toUpperCase();
  const faculty = facultyStore.get(cleanId);
  if (!faculty) {
    return res.status(404).json({ success: false, error: 'Faculty not found' });
  }
  const { name, password, email, department, isActive, assignedRooms } = req.body;
  if (name !== undefined) faculty.name = name.trim();
  if (password !== undefined) faculty.password = password.trim();
  if (email !== undefined) faculty.email = email.trim();
  if (department !== undefined) faculty.department = department.trim();
  if (isActive !== undefined) faculty.isActive = Boolean(isActive);
  if (Array.isArray(assignedRooms)) {
    faculty.assignedRooms = assignedRooms;
    // Synchronize rooms
    for (const code of assignedRooms) {
      if (code) {
        const r = getOrCreateRoom(code, null, faculty.name, `${faculty.department || 'Classroom'} - ${faculty.name}`);
        r.assignedFacultyId = cleanId;
        r.isFacultyAssigned = true;
        r.hostName = faculty.name;
        r.roomCategory = 'faculty';
      }
    }
  }

  facultyStore.set(cleanId, faculty);
  saveFacultiesToFile();

  res.json({ success: true, faculty });
});

// Admin: Delete faculty
app.delete('/api/admin/faculty/:facultyId', (req, res) => {
  const { facultyId } = req.params;
  const cleanId = facultyId.trim().toUpperCase();
  if (!facultyStore.has(cleanId)) {
    return res.status(404).json({ success: false, error: 'Faculty not found' });
  }
  facultyStore.delete(cleanId);
  saveFacultiesToFile();

  res.json({ success: true, message: `Faculty ${cleanId} removed successfully` });
});

// Room Info endpoint for quick lookup
app.get('/api/room/:code/info', (req, res) => {
  const { code } = req.params;
  const normalized = normalizeCode(code);
  let matchedFaculty = null;
  for (const fac of facultyStore.values()) {
    if (fac.assignedRooms && fac.assignedRooms.some(c => normalizeCode(c) === normalized)) {
      matchedFaculty = fac;
      break;
    }
  }
  const room = rooms.get(normalized);
  const isFaculty = Boolean(matchedFaculty || (room && (room.isFacultyAssigned || room.assignedFacultyId)));
  const facultyName = matchedFaculty ? matchedFaculty.name : (room?.hostName || null);
  res.json({
    success: true,
    code: room ? room.code : code,
    isFacultyAssigned: isFaculty,
    roomCategory: isFaculty ? 'faculty' : 'student',
    facultyName,
    roomName: room?.roomName || (isFaculty ? (matchedFaculty ? `${matchedFaculty.department || 'Classroom'} - ${matchedFaculty.name}` : `Classroom ${code}`) : `Peer Space ${code}`)
  });
});

// Admin: Get all rooms list
app.get('/api/admin/rooms', (req, res) => {
  // 1. Ensure all rooms assigned to any faculty in facultyStore are instantiated
  for (const fac of facultyStore.values()) {
    if (Array.isArray(fac.assignedRooms)) {
      for (const roomCode of fac.assignedRooms) {
        if (roomCode) {
          const facRoom = getOrCreateRoom(roomCode, null, fac.name, `${fac.department || 'Classroom'} - ${fac.name}`);
          facRoom.assignedFacultyId = fac.facultyId;
          facRoom.isFacultyAssigned = true;
          facRoom.hostName = fac.name;
          facRoom.roomCategory = 'faculty';
        }
      }
    }
  }

  // 2. Build set of all normalized codes & slugs assigned to any faculty
  const facultyAssignedCodeSet = new Set();
  for (const fac of facultyStore.values()) {
    if (Array.isArray(fac.assignedRooms)) {
      for (const rc of fac.assignedRooms) {
        if (rc) facultyAssignedCodeSet.add(normalizeCode(rc));
      }
    }
  }

  const uniqueRooms = new Map();
  for (const [_, room] of rooms.entries()) {
    if (!uniqueRooms.has(room.code)) {
      // Robust lookup of assigned faculty
      let assignedFaculty = room.assignedFacultyId ? facultyStore.get(room.assignedFacultyId.toUpperCase()) : null;
      if (!assignedFaculty) {
        for (const fac of facultyStore.values()) {
          if (fac.assignedRooms && fac.assignedRooms.some(c => normalizeCode(c) === normalizeCode(room.code) || normalizeCode(c) === normalizeCode(room.slug))) {
            assignedFaculty = fac;
            break;
          }
        }
      }

      const isFacultyRoom = Boolean(
        assignedFaculty ||
        room.isFacultyAssigned ||
        facultyAssignedCodeSet.has(normalizeCode(room.code)) ||
        facultyAssignedCodeSet.has(normalizeCode(room.slug))
      );

      if (isFacultyRoom) {
        room.isFacultyAssigned = true;
        room.roomCategory = 'faculty';
        if (assignedFaculty) {
          room.assignedFacultyId = assignedFaculty.facultyId;
          room.hostName = assignedFaculty.name;
        }
      } else {
        room.isFacultyAssigned = false;
        room.roomCategory = 'student';
      }

      const studentCount = Array.from(room.peers.values()).filter(p => !p.isHost).length;
      const formattedCode = `${room.code.slice(0, 3)} ${room.code.slice(3)}`;

      let cleanRoomName = room.roomName;
      if (!cleanRoomName || cleanRoomName.startsWith('Room ') || cleanRoomName.startsWith('Student Space')) {
        cleanRoomName = isFacultyRoom
          ? (assignedFaculty ? `${assignedFaculty.department || 'Classroom'} - ${assignedFaculty.name}` : `Classroom ${room.code}`)
          : `Peer Space ${room.code}`;
      }

      uniqueRooms.set(room.code, {
        code: room.code,
        slug: room.slug,
        formattedCode,
        roomName: cleanRoomName,
        roomCategory: isFacultyRoom ? 'faculty' : 'student',
        isFacultyAssigned: isFacultyRoom,
        assignedFacultyId: isFacultyRoom ? (assignedFaculty ? assignedFaculty.facultyId : room.assignedFacultyId) : null,
        assignedFacultyName: isFacultyRoom ? (assignedFaculty ? assignedFaculty.name : (room.hostName || 'Faculty Host')) : null,
        hostName: isFacultyRoom ? (assignedFaculty ? assignedFaculty.name : (room.hostName || 'Faculty Host')) : (room.hostName || 'Student Peer'),
        isLocked: room.isLocked || false,
        activePeersCount: room.peers.size,
        activeStudentsCount: studentCount,
        waitingCount: room.waitingPeers.size,
        itemsCount: room.items.length,
        ttlMinutes: room.ttlMinutes || 15,
        createdAt: room.createdAt,
        lastActivity: room.lastActivity
      });
    }
  }

  const allRooms = Array.from(uniqueRooms.values());
  const facultyRooms = allRooms.filter(r => r.isFacultyAssigned === true || r.roomCategory === 'faculty');
  const studentRooms = allRooms.filter(r => !r.isFacultyAssigned && r.roomCategory !== 'faculty');

  res.json({
    success: true,
    rooms: allRooms,
    facultyRooms,
    studentRooms,
    counts: {
      total: allRooms.length,
      faculty: facultyRooms.length,
      student: studentRooms.length
    }
  });
});

// Admin: Create new room
app.post('/api/admin/rooms/create', (req, res) => {
  const { roomName, assignedFacultyId, customCode } = req.body;
  let code = customCode ? normalizeCode(customCode) : generate6DigitCode();
  while (rooms.has(normalizeCode(code)) && !customCode) {
    code = generate6DigitCode();
  }
  const room = getOrCreateRoom(code, null, 'Faculty Host', roomName);
  if (assignedFacultyId) {
    const cleanFacId = assignedFacultyId.trim().toUpperCase();
    const fac = facultyStore.get(cleanFacId);
    if (fac) {
      room.assignedFacultyId = cleanFacId;
      room.hostName = fac.name;
      room.isFacultyAssigned = true;
      room.roomCategory = 'faculty';
      if (!fac.assignedRooms.includes(room.code)) {
        fac.assignedRooms.push(room.code);
        facultyStore.set(cleanFacId, fac);
        saveFacultiesToFile();
      }
    }
  }
  res.json({
    success: true,
    room: {
      code: room.code,
      slug: room.slug,
      formattedCode: `${room.code.slice(0, 3)} ${room.code.slice(3)}`,
      roomName: room.roomName,
      assignedFacultyId: room.assignedFacultyId
    }
  });
});

// Admin: Assign room to faculty
app.post('/api/admin/rooms/assign', (req, res) => {
  const { roomCode, facultyId } = req.body;
  if (!roomCode || !facultyId) {
    return res.status(400).json({ error: 'roomCode and facultyId required' });
  }
  const cleanFacId = facultyId.trim().toUpperCase();
  const faculty = facultyStore.get(cleanFacId);
  if (!faculty) {
    return res.status(404).json({ error: 'Faculty not found' });
  }
  const room = getOrCreateRoom(roomCode);
  room.assignedFacultyId = cleanFacId;
  room.hostName = faculty.name;
  room.isFacultyAssigned = true;
  room.roomCategory = 'faculty';
  if (!faculty.assignedRooms.includes(room.code)) {
    faculty.assignedRooms.push(room.code);
    facultyStore.set(cleanFacId, faculty);
    saveFacultiesToFile();
  }
  res.json({ success: true, message: `Room ${room.code} assigned to ${faculty.name}` });
});

// Admin: Change / Update allotted room (code, name, faculty assignment)
app.put('/api/admin/rooms/:roomCode', (req, res) => {
  const { roomCode } = req.params;
  const { roomName, assignedFacultyId, newRoomCode } = req.body;

  if (!roomCode) {
    return res.status(400).json({ success: false, error: 'roomCode is required' });
  }

  const oldNormalized = normalizeCode(roomCode);
  const room = getOrCreateRoom(oldNormalized);
  if (!room) {
    return res.status(404).json({ success: false, error: 'Room not found' });
  }

  let finalCode = room.code;
  let finalNormalized = oldNormalized;

  // 1. Update Room Code if provided
  if (newRoomCode && typeof newRoomCode === 'string') {
    const rawCleanCode = newRoomCode.trim().replace(/\s+/g, '');
    const cleanNewNormalized = normalizeCode(rawCleanCode);

    if (!cleanNewNormalized || cleanNewNormalized.length < 3 || cleanNewNormalized.length > 12) {
      return res.status(400).json({
        success: false,
        error: 'Room code must be between 3 and 12 alphanumeric characters.'
      });
    }

    if (!/^[a-zA-Z0-9]+$/.test(rawCleanCode)) {
      return res.status(400).json({
        success: false,
        error: 'Room code must contain only letters and numbers.'
      });
    }

    if (cleanNewNormalized !== oldNormalized) {
      // Check if code is already used by another active room
      if (rooms.has(cleanNewNormalized)) {
        return res.status(400).json({
          success: false,
          error: `Room code "${rawCleanCode}" is already taken by an active room.`
        });
      }

      // Check if code is already assigned to another faculty
      const isAssignedElsewhere = Array.from(facultyStore.values()).some(fac =>
        (fac.assignedRooms || []).some(c => normalizeCode(c) === cleanNewNormalized)
      );
      if (isAssignedElsewhere) {
        return res.status(400).json({
          success: false,
          error: `Room code "${rawCleanCode}" is already assigned to a faculty member.`
        });
      }

      // Apply new room code
      finalCode = rawCleanCode;
      finalNormalized = cleanNewNormalized;
      room.code = finalCode;
      room.slug = finalNormalized;

      // Re-key in rooms Map
      rooms.delete(oldNormalized);
      rooms.set(finalNormalized, room);

      // Update filesRegistry references
      for (const [_, fileMeta] of filesRegistry.entries()) {
        if (normalizeCode(fileMeta.roomCode) === oldNormalized) {
          fileMeta.roomCode = finalCode;
        }
      }

      // Migrate active sockets in the Socket.IO room
      const socketsInOldRoom = io.sockets.adapter.rooms.get(oldNormalized);
      if (socketsInOldRoom) {
        const socketIds = Array.from(socketsInOldRoom);
        for (const sid of socketIds) {
          const s = io.sockets.sockets.get(sid);
          if (s) {
            s.leave(oldNormalized);
            s.join(finalNormalized);
          }
        }
      }

      // Notify clients of the code change
      io.to(finalNormalized).emit('room-code-changed', {
        oldCode: roomCode,
        newCode: finalCode,
        formattedCode: finalCode.length === 6 ? `${finalCode.slice(0, 3)} ${finalCode.slice(3)}` : finalCode,
        roomName: room.roomName
      });
    }
  }

  // 2. Update room name if provided
  if (roomName && typeof roomName === 'string') {
    room.roomName = roomName.trim();
  }

  // 3. Update faculty allotment if provided
  if (assignedFacultyId !== undefined) {
    const cleanNewFacId = assignedFacultyId ? assignedFacultyId.trim().toUpperCase() : null;
    const oldFacId = room.assignedFacultyId ? room.assignedFacultyId.toUpperCase() : null;

    // Remove old code or final code from old faculty if changed
    if (oldFacId && oldFacId !== cleanNewFacId) {
      const oldFac = facultyStore.get(oldFacId);
      if (oldFac && Array.isArray(oldFac.assignedRooms)) {
        oldFac.assignedRooms = oldFac.assignedRooms.filter(c =>
          normalizeCode(c) !== oldNormalized && normalizeCode(c) !== finalNormalized
        );
        facultyStore.set(oldFacId, oldFac);
      }
    }

    if (cleanNewFacId) {
      const newFac = facultyStore.get(cleanNewFacId);
      if (!newFac) {
        return res.status(404).json({ success: false, error: `Faculty ID "${cleanNewFacId}" not found` });
      }

      if (!Array.isArray(newFac.assignedRooms)) {
        newFac.assignedRooms = [];
      }
      // Remove any old reference to the old code
      newFac.assignedRooms = newFac.assignedRooms.filter(c => normalizeCode(c) !== oldNormalized);
      if (!newFac.assignedRooms.some(c => normalizeCode(c) === finalNormalized)) {
        newFac.assignedRooms.push(finalCode);
      }
      facultyStore.set(cleanNewFacId, newFac);

      room.assignedFacultyId = newFac.facultyId;
      room.hostName = newFac.name;
      room.isFacultyAssigned = true;
      room.roomCategory = 'faculty';
    } else {
      // Unassigned
      room.assignedFacultyId = null;
      room.hostName = 'Faculty Host';
      room.isFacultyAssigned = false;
      room.roomCategory = 'faculty';
    }

    saveFacultiesToFile();
  } else if (finalNormalized !== oldNormalized) {
    // If faculty allotment was unchanged, but room code changed, update code in existing faculty's list
    for (const [facId, fac] of facultyStore.entries()) {
      if (fac.assignedRooms && fac.assignedRooms.some(c => normalizeCode(c) === oldNormalized)) {
        fac.assignedRooms = fac.assignedRooms.map(c => normalizeCode(c) === oldNormalized ? finalCode : c);
        facultyStore.set(facId, fac);
      }
    }
    saveFacultiesToFile();
  }

  // Notify active peers in room of updated info
  io.to(finalNormalized).emit('room-info-updated', {
    code: room.code,
    roomName: room.roomName,
    hostName: room.hostName,
    assignedFacultyId: room.assignedFacultyId
  });

  const formattedCode = room.code.length === 6 ? `${room.code.slice(0, 3)} ${room.code.slice(3)}` : room.code;

  res.json({
    success: true,
    message: `Classroom ${formattedCode} updated successfully`,
    room: {
      code: room.code,
      slug: room.slug,
      formattedCode,
      roomName: room.roomName,
      assignedFacultyId: room.assignedFacultyId,
      assignedFacultyName: room.hostName
    }
  });
});

// Admin: Delete allotted room
app.delete('/api/admin/rooms/:roomCode', (req, res) => {
  const { roomCode } = req.params;
  if (!roomCode) {
    return res.status(400).json({ success: false, error: 'roomCode is required' });
  }

  const normalized = normalizeCode(roomCode);

  // 1. Remove from all faculties in facultyStore
  let facultyUpdated = false;
  for (const [facId, fac] of facultyStore.entries()) {
    if (Array.isArray(fac.assignedRooms)) {
      const origLen = fac.assignedRooms.length;
      fac.assignedRooms = fac.assignedRooms.filter(c => normalizeCode(c) !== normalized);
      if (fac.assignedRooms.length !== origLen) {
        facultyUpdated = true;
        facultyStore.set(facId, fac);
      }
    }
  }
  if (facultyUpdated) {
    saveFacultiesToFile();
  }

  // 2. Disconnect active peers in the room
  io.to(normalized).emit('kicked-from-room', {
    message: 'This classroom was deleted by the System Administrator.'
  });

  // 3. Remove uploaded files associated with this room
  for (const [fileId, fileMeta] of filesRegistry.entries()) {
    if (fileMeta.roomCode && normalizeCode(fileMeta.roomCode) === normalized) {
      try {
        if (fs.existsSync(fileMeta.storedPath)) {
          fs.unlinkSync(fileMeta.storedPath);
        }
      } catch (err) {
        console.error(`Failed to unlink file ${fileId}:`, err);
      }
      filesRegistry.delete(fileId);
    }
  }

  // 4. Remove from rooms Map
  const room = rooms.get(normalized);
  if (room) {
    rooms.delete(normalizeCode(room.code));
    rooms.delete(normalizeCode(room.slug));
  } else {
    rooms.delete(normalized);
  }

  res.json({
    success: true,
    message: `Classroom ${roomCode} deleted successfully`
  });
});

// Admin: System statistics overview
app.get('/api/admin/system-stats', (req, res) => {
  let totalStudentsLive = 0;
  let totalPeersLive = 0;
  let totalWaiting = 0;
  let totalItemsShared = 0;
  let totalFacultyRooms = 0;
  let totalStudentRooms = 0;
  const countedCodes = new Set();

  for (const [_, room] of rooms.entries()) {
    if (!countedCodes.has(room.code)) {
      countedCodes.add(room.code);
      let isFaculty = Boolean(room.isFacultyAssigned || room.assignedFacultyId);
      if (!isFaculty) {
        for (const fac of facultyStore.values()) {
          if (fac.assignedRooms && fac.assignedRooms.some(c => normalizeCode(c) === normalizeCode(room.code) || normalizeCode(c) === normalizeCode(room.slug))) {
            isFaculty = true;
            break;
          }
        }
      }

      if (isFaculty) {
        totalFacultyRooms++;
      } else {
        totalStudentRooms++;
      }
      totalPeersLive += room.peers.size;
      totalStudentsLive += Array.from(room.peers.values()).filter(p => !p.isHost).length;
      totalWaiting += room.waitingPeers.size;
      totalItemsShared += room.items.length;
    }
  }

  res.json({
    totalSuperAdmins: adminsStore.size,
    totalFaculties: facultyStore.size,
    totalRooms: countedCodes.size,
    totalFacultyRooms,
    totalStudentRooms,
    totalStudentsLive,
    totalPeersLive,
    totalWaiting,
    totalItemsShared,
    activeFilesStored: filesRegistry.size
  });
});

// Admin: Global attendance across all rooms (Faculty only)
app.get('/api/admin/global-attendance', (req, res) => {
  const records = [];
  const countedIds = new Set();

  // 1. Collect from active rooms in memory (to calculate live duration for Active entries)
  for (const [_, room] of rooms.entries()) {
    const list = getAttendanceList(room);
    for (const item of list) {
      if (!countedIds.has(item.id)) {
        countedIds.add(item.id);
        records.push({
          roomCode: room.code,
          roomName: room.roomName || `Room ${room.code}`,
          hostName: room.hostName || 'Faculty Host',
          ...item
        });
      }
    }
  }

  // 2. Add any entries from globalAttendanceStore that aren't in active rooms
  for (const item of globalAttendanceStore.values()) {
    if (!countedIds.has(item.id)) {
      countedIds.add(item.id);
      records.push(item);
    }
  }

  // Filter for faculty records only (exclude students from Admin portal)
  const facultyRecords = records
    .filter(item => item.isHost || item.role === 'Faculty (Host)' || item.role?.includes('Faculty'))
    .map(item => {
      let facId = item.rollNumber;
      if (!facId || facId === 'FACULTY' || !facId.toUpperCase().startsWith('FAC')) {
        const norm = normalizeCode(item.roomCode);
        for (const fac of facultyStore.values()) {
          if ((fac.assignedRooms && fac.assignedRooms.some(c => normalizeCode(c) === norm)) || fac.name === item.name || fac.name === item.hostName) {
            facId = fac.facultyId;
            break;
          }
        }
      }
      return {
        ...item,
        rollNumber: facId || 'FAC101'
      };
    });

  // Sort descending by joinedAt
  facultyRecords.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

  res.json({ success: true, attendance: facultyRecords });
});

// Admin: Export Global Multi-Room Attendance as Excel (.xlsx) (Faculty only)
app.get('/api/admin/global-attendance/excel', (req, res) => {
  const records = [];
  const countedIds = new Set();

  for (const [_, room] of rooms.entries()) {
    const list = getAttendanceList(room);
    for (const item of list) {
      if (!countedIds.has(item.id)) {
        countedIds.add(item.id);
        records.push({
          roomCode: room.code,
          roomName: room.roomName || `Room ${room.code}`,
          hostName: room.hostName || 'Faculty Host',
          ...item
        });
      }
    }
  }

  for (const item of globalAttendanceStore.values()) {
    if (!countedIds.has(item.id)) {
      countedIds.add(item.id);
      records.push(item);
    }
  }

  // Filter for faculty records only
  const facultyRecords = records
    .filter(item => item.isHost || item.role === 'Faculty (Host)' || item.role?.includes('Faculty'))
    .map(item => {
      let facId = item.rollNumber;
      if (!facId || facId === 'FACULTY' || !facId.toUpperCase().startsWith('FAC')) {
        const norm = normalizeCode(item.roomCode);
        for (const fac of facultyStore.values()) {
          if ((fac.assignedRooms && fac.assignedRooms.some(c => normalizeCode(c) === norm)) || fac.name === item.name || fac.name === item.hostName) {
            facId = fac.facultyId;
            break;
          }
        }
      }
      return {
        ...item,
        rollNumber: facId || 'FAC101'
      };
    });
  facultyRecords.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

  const rows = facultyRecords.map((entry, idx) => ({
    'S.No': idx + 1,
    'Room Code': entry.roomCode,
    'Classroom Name': entry.roomName,
    'Faculty ID': entry.rollNumber || 'FAC101',
    'Faculty Member': entry.name || 'Faculty Host',
    'Role': entry.role || 'Faculty (Host)',
    'Email ID': entry.email || 'N/A',
    'Mobile Number': entry.mobile || 'N/A',
    'Login Time': new Date(entry.joinedAt).toLocaleString(),
    'Exit Time': entry.exitedAt ? new Date(entry.exitedAt).toLocaleString() : 'Active Now',
    'Session Duration': entry.duration || '0s',
    'Status': entry.status || 'Active'
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 14 }, // Room Code
    { wch: 28 }, // Classroom Name
    { wch: 18 }, // Faculty ID
    { wch: 24 }, // Faculty Member
    { wch: 18 }, // Role
    { wch: 28 }, // Email ID
    { wch: 18 }, // Mobile Number
    { wch: 24 }, // Login Time
    { wch: 24 }, // Exit Time
    { wch: 18 }, // Session Duration
    { wch: 12 }  // Status
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Faculty Attendance');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', `attachment; filename="momo-faculty-attendance-${Date.now()}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// Universal / Admin: Delete a single attendance/login record by ID
app.delete(['/api/attendance/:id', '/api/admin/attendance/:id'], (req, res) => {
  const { id } = req.params;
  let found = false;

  if (globalAttendanceStore.has(id)) {
    globalAttendanceStore.delete(id);
    found = true;
  }

  for (const room of rooms.values()) {
    if (room.attendanceLog && room.attendanceLog.has(id)) {
      room.attendanceLog.delete(id);
      found = true;
      notifyAdminAttendance(room);
    }
  }

  if (found) {
    saveAttendanceToFile();
    return res.json({ success: true, message: 'Faculty attendance record deleted successfully' });
  } else {
    return res.status(404).json({ error: 'Attendance record not found' });
  }
});

// Admin: Clear / Delete all faculty attendance/login logs
app.delete('/api/admin/attendance', (req, res) => {
  let deletedCount = 0;

  for (const [id, item] of Array.from(globalAttendanceStore.entries())) {
    if (item.isHost || item.role?.includes('Faculty')) {
      globalAttendanceStore.delete(id);
      deletedCount++;
    }
  }

  for (const room of rooms.values()) {
    if (room.attendanceLog) {
      for (const [id, item] of Array.from(room.attendanceLog.entries())) {
        if (item.isHost || item.role?.includes('Faculty')) {
          room.attendanceLog.delete(id);
        }
      }
    }
  }

  saveAttendanceToFile();
  return res.json({ success: true, message: `Cleared ${deletedCount} faculty login records` });
});

// Faculty: Get specific faculty rooms
app.get('/api/faculty/:facultyId/rooms', (req, res) => {
  const { facultyId } = req.params;
  const cleanId = facultyId.trim().toUpperCase();
  const faculty = facultyStore.get(cleanId);
  if (!faculty) {
    return res.status(404).json({ error: 'Faculty not found' });
  }

  const assignedRoomDetails = (faculty.assignedRooms || []).map(code => {
    const room = getOrCreateRoom(code, null, faculty.name);
    return {
      code: room.code,
      slug: room.slug,
      formattedCode: `${room.code.slice(0, 3)} ${room.code.slice(3)}`,
      roomName: room.roomName || `Classroom ${room.code}`,
      ttlMinutes: room.ttlMinutes || 15,
      activePeers: room.peers.size,
      activeStudents: Array.from(room.peers.values()).filter(p => !p.isHost).length,
      waitingStudents: room.waitingPeers.size
    };
  });

  res.json({ success: true, rooms: assignedRoomDetails });
});

// Generate new pairing codes
app.get('/api/rooms/new', (req, res) => {
  let code = generate6DigitCode();
  let slug = generateSlug();
  while (rooms.has(normalizeCode(code))) {
    code = generate6DigitCode();
  }
  const room = getOrCreateRoom(code);
  res.json({
    code: room.code,
    slug: room.slug,
    formattedCode: `${room.code.slice(0, 3)} ${room.code.slice(3)}`,
    ttlMinutes: room.ttlMinutes || 15
  });
});

// Upload endpoint
app.post('/api/upload/:roomCode', upload.array('files'), (req, res) => {
  const { roomCode } = req.params;
  const room = getOrCreateRoom(roomCode);
  const uploadedItems = [];

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  for (const file of req.files) {
    const fileId = path.parse(file.filename).name;
    const mime = file.mimetype || 'application/octet-stream';
    let itemType = 'file';
    if (mime.startsWith('image/')) itemType = 'image';
    else if (mime.startsWith('video/')) itemType = 'video';
    else if (mime.startsWith('audio/')) itemType = 'audio';

    const fileMeta = {
      fileId,
      originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'), // handle UTF-8 names
      storedPath: file.path,
      mimeType: mime,
      size: file.size,
      createdAt: Date.now(),
      ttlMinutes: room.ttlMinutes || 15,
      roomCode: room.code
    };

    filesRegistry.set(fileId, fileMeta);

    const item = {
      id: uuidv4(),
      type: itemType,
      sender: req.body.senderName || 'Peer',
      senderId: req.body.senderId || null,
      timestamp: new Date().toISOString(),
      payload: {
        fileId,
        fileName: fileMeta.originalName,
        fileSize: fileMeta.size,
        mimeType: mime,
        downloadUrl: `/api/download/${fileId}`,
        previewUrl: `/api/preview/${fileId}`
      }
    };

    room.items.unshift(item);
    room.lastActivity = Date.now();
    uploadedItems.push(item);

    // Broadcast item to room peers
    io.to(normalizeCode(room.code)).emit('item-added', item);
  }

  res.json({ success: true, items: uploadedItems });
});

// Direct file download
app.get('/api/download/:fileId', (req, res) => {
  const { fileId } = req.params;
  const fileMeta = filesRegistry.get(fileId);

  if (!fileMeta || !fs.existsSync(fileMeta.storedPath)) {
    return res.status(404).json({ error: 'File not found or expired' });
  }

  res.download(fileMeta.storedPath, fileMeta.originalName);
});

// Inline file preview (for image lightbox, audio/video streaming)
app.get('/api/preview/:fileId', (req, res) => {
  const { fileId } = req.params;
  const fileMeta = filesRegistry.get(fileId);

  if (!fileMeta || !fs.existsSync(fileMeta.storedPath)) {
    return res.status(404).json({ error: 'File not found or expired' });
  }

  res.setHeader('Content-Type', fileMeta.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileMeta.originalName)}"`);

  // Support range requests for video/audio seeking
  const range = req.headers.range;
  if (range && (fileMeta.mimeType.startsWith('video/') || fileMeta.mimeType.startsWith('audio/'))) {
    const stat = fs.statSync(fileMeta.storedPath);
    const total = stat.size;
    const parts = range.replace(/bytes=/, '').split('-');
    const partialStart = parts[0];
    const partialEnd = parts[1];

    const start = parseInt(partialStart, 10);
    const end = partialEnd ? parseInt(partialEnd, 10) : total - 1;
    const chunkSize = (end - start) + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': fileMeta.mimeType,
    });

    const stream = fs.createReadStream(fileMeta.storedPath, { start, end });
    stream.pipe(res);
  } else {
    fs.createReadStream(fileMeta.storedPath).pipe(res);
  }
});

// Batch download all files in room as zip
app.get('/api/room/:roomCode/zip', (req, res) => {
  const { roomCode } = req.params;
  const room = rooms.get(normalizeCode(roomCode));

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const fileItems = room.items.filter(item => ['file', 'image', 'video', 'audio'].includes(item.type));
  if (fileItems.length === 0) {
    return res.status(400).json({ error: 'No files available to download in this room' });
  }

  const archive = archiver('zip', { zlib: { level: 6 } });
  const zipFileName = `momo-${room.code}-${Date.now()}.zip`;

  res.attachment(zipFileName);
  archive.pipe(res);

  const addedNames = new Set();
  for (const item of fileItems) {
    const meta = filesRegistry.get(item.payload.fileId);
    if (meta && fs.existsSync(meta.storedPath)) {
      let entryName = meta.originalName;
      let counter = 1;
      while (addedNames.has(entryName)) {
        const parsed = path.parse(meta.originalName);
        entryName = `${parsed.name} (${counter})${parsed.ext}`;
        counter++;
      }
      addedNames.add(entryName);
      archive.file(meta.storedPath, { name: entryName });
    }
  }

  archive.finalize();
});

// Attendance Activity JSON endpoint (Faculty Portal - Students only)
app.get('/api/room/:roomCode/attendance', (req, res) => {
  const { roomCode } = req.params;
  const room = rooms.get(normalizeCode(roomCode));
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({
    roomCode: room.code,
    roomSlug: room.slug,
    hostName: room.hostName,
    attendance: getStudentAttendanceList(room)
  });
});

// Download student attendance report as authentic Excel (.xlsx) file (Faculty Portal)
app.get('/api/room/:roomCode/attendance/excel', (req, res) => {
  const { roomCode } = req.params;
  const room = rooms.get(normalizeCode(roomCode));
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const attendanceList = getStudentAttendanceList(room);
  const rows = attendanceList.map((entry, idx) => ({
    'S.No': idx + 1,
    'Roll Number / ID': entry.rollNumber || 'N/A',
    'Participant Name': entry.name || 'Anonymous',
    'Role': entry.role || 'Student',
    'Email ID': entry.email || 'N/A',
    'Mobile Number': entry.mobile || 'N/A',
    'Login Time': new Date(entry.joinedAt).toLocaleString(),
    'Exit Time': entry.exitedAt ? new Date(entry.exitedAt).toLocaleString() : 'Active Now',
    'Session Duration': entry.duration || '0s',
    'Status': entry.status || 'Active'
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Auto-set column widths for clean readability in Excel
  worksheet['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 20 }, // Roll Number / ID
    { wch: 24 }, // Participant Name
    { wch: 16 }, // Role
    { wch: 28 }, // Email ID
    { wch: 20 }, // Mobile Number
    { wch: 24 }, // Login Time
    { wch: 24 }, // Exit Time
    { wch: 18 }, // Session Duration
    { wch: 12 }  // Status
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Attendance');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', `attachment; filename="momo-student-attendance-${room.code}-${Date.now()}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// Faculty / Classroom: Delete a specific student attendance/login entry
app.delete('/api/room/:roomCode/attendance/:id', (req, res) => {
  const { roomCode, id } = req.params;
  const room = rooms.get(normalizeCode(roomCode));
  const norm = normalizeCode(roomCode);
  let found = false;

  if (room && room.attendanceLog && room.attendanceLog.has(id)) {
    room.attendanceLog.delete(id);
    found = true;
  }

  if (globalAttendanceStore.has(id)) {
    const entry = globalAttendanceStore.get(id);
    if (!roomCode || normalizeCode(entry.roomCode) === norm) {
      globalAttendanceStore.delete(id);
      found = true;
    }
  }

  if (found) {
    saveAttendanceToFile();
    if (room) {
      notifyAdminAttendance(room);
    }
    return res.json({ success: true, message: 'Student attendance record deleted successfully' });
  } else {
    return res.status(404).json({ error: 'Attendance record not found' });
  }
});

// Faculty / Classroom: Delete / Clear all student attendance/login records for a room
app.delete('/api/room/:roomCode/attendance', (req, res) => {
  const { roomCode } = req.params;
  const room = rooms.get(normalizeCode(roomCode));
  const norm = normalizeCode(roomCode);
  let deletedCount = 0;

  if (room && room.attendanceLog) {
    for (const [id, entry] of Array.from(room.attendanceLog.entries())) {
      if (!entry.isHost && !entry.role?.includes('Faculty')) {
        room.attendanceLog.delete(id);
        deletedCount++;
      }
    }
  }

  for (const [id, entry] of Array.from(globalAttendanceStore.entries())) {
    if (normalizeCode(entry.roomCode) === norm && !entry.isHost && !entry.role?.includes('Faculty')) {
      globalAttendanceStore.delete(id);
      deletedCount++;
    }
  }

  saveAttendanceToFile();
  if (room) {
    notifyAdminAttendance(room);
  }
  return res.json({ success: true, message: `Cleared ${deletedCount} student attendance records for room ${roomCode}` });
});

// Periodic Ephemeral Storage Cleanup Worker (runs every 60s)
function cleanupExpiredTransfers() {
  const now = Date.now();
  let deletedFilesCount = 0;
  let closedRoomsCount = 0;

  // 1. Delete expired files based on their specific room TTL
  for (const [fileId, fileMeta] of filesRegistry.entries()) {
    const ttl = fileMeta.ttlMinutes ?? 15;
    if (ttl === 'infinity' || ttl === 0) {
      continue; // Infinite retention transfers do not expire automatically
    }

    const ttlMs = Number(ttl) * 60 * 1000;
    if (now - fileMeta.createdAt > ttlMs) {
      try {
        if (fs.existsSync(fileMeta.storedPath)) {
          fs.unlinkSync(fileMeta.storedPath);
        }
      } catch (err) {
        console.error(`Failed to unlink expired file ${fileId}:`, err);
      }
      filesRegistry.delete(fileId);
      deletedFilesCount++;
    }
  }

  // 2. Clear expired rooms that have no active peers and exceeded TTL
  for (const [codeKey, room] of rooms.entries()) {
    const ttl = room.ttlMinutes ?? 15;
    if (ttl === 'infinity' || ttl === 0) {
      continue;
    }

    const ttlMs = Number(ttl) * 60 * 1000;
    if (now - room.lastActivity > ttlMs && (!room.peers || room.peers.size === 0)) {
      rooms.delete(codeKey);
      closedRoomsCount++;
    }
  }

  if (deletedFilesCount > 0 || closedRoomsCount > 0) {
    console.log(`[MOMO Cleanup] Purged ${deletedFilesCount} expired files and ${closedRoomsCount} idle rooms.`);
  }
}

setInterval(cleanupExpiredTransfers, 60 * 1000);

// Socket.IO signaling logic
io.on('connection', (socket) => {
  let currentRoomCode = null;
  let isWaitingInRoom = null;

  socket.on('join-room', ({ roomCode, peerName, rollNumber, email, mobile, senderId, role = 'student', facultyId = null }) => {
    if (!roomCode) return;
    const cleanCode = normalizeCode(roomCode);

    // Check if room already exists or is an authorized faculty classroom
    const isExistingRoom = rooms.has(cleanCode) || Array.from(facultyStore.values()).some(fac =>
      fac.assignedRooms && fac.assignedRooms.some(c => normalizeCode(c) === cleanCode)
    );

    // Students cannot create rooms; they are only allowed to join existing classrooms
    if (!isExistingRoom && role === 'student') {
      socket.emit('access-denied', {
        roomCode: cleanCode,
        message: 'Classroom not found. Students can only join existing classrooms created by faculty. Please verify your room code.'
      });
      return;
    }

    const room = getOrCreateRoom(cleanCode, senderId, peerName);
    const normalized = normalizeCode(room.code);

    // Leave any previous room if changing
    if (currentRoomCode && currentRoomCode !== normalized) {
      socket.leave(currentRoomCode);
      const prevRoom = rooms.get(currentRoomCode);
      if (prevRoom) {
        recordExit(prevRoom, socket.id);
        notifyAdminAttendance(prevRoom);
        prevRoom.peers.delete(socket.id);
        io.to(currentRoomCode).emit('peer-left', {
          socketId: socket.id,
          peers: Array.from(prevRoom.peers.values()),
          peerCount: prevRoom.peers.size
        });
      }
    }

    // Clean up if previously waiting
    if (isWaitingInRoom && isWaitingInRoom !== normalized) {
      const prevW = rooms.get(isWaitingInRoom);
      if (prevW) {
        prevW.waitingPeers.delete(socket.id);
        if (prevW.hostSocketId) {
          io.to(prevW.hostSocketId).emit('pending-requests-updated', {
            pendingRequests: Array.from(prevW.waitingPeers.values())
          });
        }
      }
      isWaitingInRoom = null;
    }

    // Determine authorization and role
    const cleanFacId = facultyId ? facultyId.trim().toUpperCase() : null;
    const isFacultyUser = Boolean(cleanFacId && facultyStore.has(cleanFacId));
    const facultyAccount = isFacultyUser ? facultyStore.get(cleanFacId) : null;

    // Faculty Semi-Admin Authorization
    const isHost = isFacultyUser ||
      (!room.hostClientId && role === 'faculty') ||
      (room.hostClientId === senderId && role !== 'student');

    if (isHost && isFacultyUser) {
      room.assignedFacultyId = facultyAccount.facultyId;
      room.hostClientId = senderId || socket.id;
      room.hostSocketId = socket.id;
      room.hostName = facultyAccount.name;
      room.hostEmail = facultyAccount.email;
      room.admittedClients.add(room.hostClientId);
      if (!facultyAccount.assignedRooms.includes(room.code)) {
        facultyAccount.assignedRooms.push(room.code);
      }
    } else if (isHost && !isFacultyUser) {
      room.hostClientId = senderId || socket.id;
      room.hostSocketId = socket.id;
      if (peerName) room.hostName = peerName;
      if (email) room.hostEmail = email;
      if (mobile) room.hostMobile = mobile;
      room.admittedClients.add(room.hostClientId);
    }

    const isAdmitted = isHost || (senderId && room.admittedClients.has(senderId));

    // If admitted (either Faculty Host or previously approved Student)
    if (isAdmitted) {
      isWaitingInRoom = null;
      currentRoomCode = normalized;
      socket.join(normalized);
      room.waitingPeers.delete(socket.id);

      const peerInfo = {
        socketId: socket.id,
        peerName: peerName || (isHost ? (room.hostName || 'Faculty Host') : 'Student'),
        rollNumber: (isHost || isFacultyUser) 
          ? (facultyAccount?.facultyId || room.assignedFacultyId || (rollNumber && rollNumber.toUpperCase().startsWith('FAC') ? rollNumber : 'FAC101'))
          : (rollNumber || 'N/A'),
        email: email || (isHost ? (room.hostEmail || '') : ''),
        mobile: mobile || (isHost ? (room.hostMobile || '') : ''),
        senderId: senderId || socket.id,
        joinedAt: Date.now(),
        isHost,
        role: isHost ? 'Faculty (Host)' : 'Student'
      };
      room.peers.set(socket.id, peerInfo);
      room.lastActivity = Date.now();

      // Record in attendance log
      recordAttendance(room, {
        senderId: peerInfo.senderId,
        socketId: socket.id,
        name: peerInfo.peerName,
        rollNumber: peerInfo.rollNumber,
        email: peerInfo.email,
        mobile: peerInfo.mobile,
        isHost,
        role: peerInfo.role
      });
      notifyAdminAttendance(room);

      // Send full room state & peers to the newly connected peer
      socket.emit('room-joined', {
        code: room.code,
        slug: room.slug,
        formattedCode: `${room.code.slice(0, 3)} ${room.code.slice(3)}`,
        roomName: room.roomName,
        roomCategory: room.isFacultyAssigned ? 'faculty' : 'student',
        isFacultyAssigned: Boolean(room.isFacultyAssigned),
        items: room.items,
        peers: Array.from(room.peers.values()),
        peerCount: room.peers.size,
        ttlMinutes: room.ttlMinutes || 15,
        createdAt: room.createdAt,
        isHost,
        role: peerInfo.role,
        hostName: room.hostName || 'Faculty Host',
        isLocked: room.isLocked || false,
        pendingRequests: isHost ? Array.from(room.waitingPeers.values()) : [],
        attendance: isHost ? getStudentAttendanceList(room) : []
      });

      // Notify other peers in the room with updated peer list
      socket.to(normalized).emit('peer-joined', {
        peer: peerInfo,
        peers: Array.from(room.peers.values()),
        peerName: peerInfo.peerName,
        peerCount: room.peers.size
      });
      return;
    }

    // STUDENT KNOCK / WAITING ROOM FLOW
    // Check if room is locked
    if (room.isLocked) {
      socket.emit('access-denied', {
        roomCode: room.code,
        message: 'This classroom is currently locked by the faculty host. No new entries permitted.'
      });
      return;
    }

    isWaitingInRoom = normalized;
    const waitingInfo = {
      socketId: socket.id,
      peerName: peerName || 'Student',
      rollNumber: rollNumber || 'N/A',
      email: email || 'N/A',
      mobile: mobile || 'N/A',
      senderId: senderId || socket.id,
      role: 'Student',
      requestedAt: Date.now()
    };
    room.waitingPeers.set(socket.id, waitingInfo);

    // Notify guest device that they are in the waiting room
    socket.emit('access-waiting', {
      code: room.code,
      slug: room.slug,
      formattedCode: `${room.code.slice(0, 3)} ${room.code.slice(3)}`,
      roomName: room.roomName,
      hostName: room.hostName || 'Faculty Host',
      peerName: waitingInfo.peerName,
      rollNumber: waitingInfo.rollNumber,
      email: waitingInfo.email,
      mobile: waitingInfo.mobile
    });

    // Notify Faculty (Host) that a student knocked / requested room access
    const hostPeer = Array.from(room.peers.values()).find(p => p.isHost);
    const hostTargetSocketId = room.hostSocketId || hostPeer?.socketId;

    if (hostTargetSocketId) {
      io.to(hostTargetSocketId).emit('access-requested', {
        socketId: socket.id,
        peerName: waitingInfo.peerName,
        rollNumber: waitingInfo.rollNumber,
        email: waitingInfo.email,
        mobile: waitingInfo.mobile,
        senderId: waitingInfo.senderId,
        requestedAt: waitingInfo.requestedAt,
        pendingRequests: Array.from(room.waitingPeers.values())
      });
    }
  });

  // Host Action: Admit a specific waiting peer
  socket.on('admit-peer', ({ roomCode, targetSocketId }) => {
    if (!roomCode || !targetSocketId) return;
    const room = getOrCreateRoom(roomCode);
    const normalized = normalizeCode(room.code);

    const callerPeer = room.peers.get(socket.id);
    const isHost = (room.hostSocketId === socket.id) || (callerPeer && callerPeer.isHost);
    if (!isHost) return;

    const waitingPeer = room.waitingPeers.get(targetSocketId);
    if (!waitingPeer) return;

    room.waitingPeers.delete(targetSocketId);
    if (waitingPeer.senderId) {
      room.admittedClients.add(waitingPeer.senderId);
    }

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.data = targetSocket.data || {};
      targetSocket.data.roomCode = normalized;
      targetSocket.join(normalized);
      const peerInfo = {
        socketId: targetSocket.id,
        peerName: waitingPeer.peerName,
        rollNumber: waitingPeer.rollNumber || 'N/A',
        email: waitingPeer.email,
        mobile: waitingPeer.mobile,
        senderId: waitingPeer.senderId,
        joinedAt: Date.now(),
        isHost: false,
        role: 'Student'
      };
      room.peers.set(targetSocket.id, peerInfo);
      room.lastActivity = Date.now();

      // Record in attendance log
      recordAttendance(room, {
        senderId: waitingPeer.senderId,
        socketId: targetSocket.id,
        name: waitingPeer.peerName,
        rollNumber: waitingPeer.rollNumber,
        email: waitingPeer.email,
        mobile: waitingPeer.mobile,
        isHost: false,
        role: 'Student'
      });
      notifyAdminAttendance(room);

      targetSocket.emit('room-joined', {
        code: room.code,
        slug: room.slug,
        formattedCode: `${room.code.slice(0, 3)} ${room.code.slice(3)}`,
        roomName: room.roomName,
        roomCategory: room.isFacultyAssigned ? 'faculty' : 'student',
        isFacultyAssigned: Boolean(room.isFacultyAssigned),
        items: room.items,
        peers: Array.from(room.peers.values()),
        peerCount: room.peers.size,
        ttlMinutes: room.ttlMinutes || 15,
        createdAt: room.createdAt,
        isHost: false,
        role: 'Student',
        hostName: room.hostName || 'Faculty Host',
        admittedByHost: true
      });

      io.to(normalized).emit('peer-joined', {
        peer: peerInfo,
        peers: Array.from(room.peers.values()),
        peerName: peerInfo.peerName,
        peerCount: room.peers.size
      });
    }

    // Update host with latest pending requests
    socket.emit('pending-requests-updated', {
      pendingRequests: Array.from(room.waitingPeers.values())
    });
  });

  // Host Action: Deny a specific waiting peer
  socket.on('deny-peer', ({ roomCode, targetSocketId }) => {
    if (!roomCode || !targetSocketId) return;
    const room = getOrCreateRoom(roomCode);
    const callerPeer = room.peers.get(socket.id);
    const isHost = (room.hostSocketId === socket.id) || (callerPeer && callerPeer.isHost);
    if (!isHost) return;

    const waitingPeer = room.waitingPeers.get(targetSocketId);
    if (waitingPeer) {
      room.waitingPeers.delete(targetSocketId);
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.emit('access-denied', {
          roomCode: room.code,
          message: 'The faculty host declined your request to join this session.'
        });
      }
    }

    socket.emit('pending-requests-updated', {
      pendingRequests: Array.from(room.waitingPeers.values())
    });
  });

  // Host Action: Admit all waiting peers
  socket.on('admit-all', ({ roomCode }) => {
    if (!roomCode) return;
    const room = getOrCreateRoom(roomCode);
    const callerPeer = room.peers.get(socket.id);
    const isHost = (room.hostSocketId === socket.id) || (callerPeer && callerPeer.isHost);
    if (!isHost) return;

    const normalized = normalizeCode(room.code);
    const waitingList = Array.from(room.waitingPeers.values());
    room.waitingPeers.clear();

    for (const waitingPeer of waitingList) {
      if (waitingPeer.senderId) {
        room.admittedClients.add(waitingPeer.senderId);
      }
      const targetSocket = io.sockets.sockets.get(waitingPeer.socketId);
      if (targetSocket) {
        targetSocket.data = targetSocket.data || {};
        targetSocket.data.roomCode = normalized;
        targetSocket.join(normalized);
        const peerInfo = {
          socketId: targetSocket.id,
          peerName: waitingPeer.peerName,
          rollNumber: waitingPeer.rollNumber || 'N/A',
          email: waitingPeer.email,
          mobile: waitingPeer.mobile,
          senderId: waitingPeer.senderId,
          joinedAt: Date.now(),
          isHost: false,
          role: 'Student'
        };
        room.peers.set(targetSocket.id, peerInfo);

        recordAttendance(room, {
          senderId: waitingPeer.senderId,
          socketId: targetSocket.id,
          name: waitingPeer.peerName,
          rollNumber: waitingPeer.rollNumber,
          email: waitingPeer.email,
          mobile: waitingPeer.mobile,
          isHost: false,
          role: 'Student'
        });

        targetSocket.emit('room-joined', {
          code: room.code,
          slug: room.slug,
          formattedCode: `${room.code.slice(0, 3)} ${room.code.slice(3)}`,
          roomName: room.roomName,
          roomCategory: room.isFacultyAssigned ? 'faculty' : 'student',
          isFacultyAssigned: Boolean(room.isFacultyAssigned),
          items: room.items,
          peers: Array.from(room.peers.values()),
          peerCount: room.peers.size,
          ttlMinutes: room.ttlMinutes || 15,
          createdAt: room.createdAt,
          isHost: false,
          role: 'Student',
          hostName: room.hostName || 'Faculty Host',
          admittedByHost: true
        });
      }
    }

    notifyAdminAttendance(room);

    io.to(normalized).emit('peer-joined', {
      peers: Array.from(room.peers.values()),
      peerCount: room.peers.size
    });

    socket.emit('pending-requests-updated', {
      pendingRequests: []
    });
  });

  // Host Action: Kick / Remove peer
  socket.on('kick-peer', ({ roomCode, targetSocketId }) => {
    if (!roomCode || !targetSocketId) return;
    const room = getOrCreateRoom(roomCode);
    const callerPeer = room.peers.get(socket.id);
    const isHost = (room.hostSocketId === socket.id) || (callerPeer && callerPeer.isHost);
    if (!isHost) return;

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    const removedPeer = room.peers.get(targetSocketId);
    if (removedPeer && removedPeer.senderId) {
      room.admittedClients.delete(removedPeer.senderId);
    }
    room.peers.delete(targetSocketId);
    recordExit(room, targetSocketId);
    notifyAdminAttendance(room);

    if (targetSocket) {
      targetSocket.leave(normalizeCode(room.code));
      targetSocket.emit('kicked-from-room', {
        message: 'You have been removed from the session by the faculty host.'
      });
    }
    io.to(normalizeCode(room.code)).emit('peer-left', {
      socketId: targetSocketId,
      peers: Array.from(room.peers.values()),
      peerCount: room.peers.size
    });
  });

  // Host Action: Toggle Room Lock
  socket.on('toggle-lock-room', ({ roomCode }) => {
    if (!roomCode) return;
    const room = getOrCreateRoom(roomCode);
    const callerPeer = room.peers.get(socket.id);
    const isHost = (room.hostSocketId === socket.id) || (callerPeer && callerPeer.isHost);
    if (!isHost) return;

    room.isLocked = !room.isLocked;
    io.to(normalizeCode(room.code)).emit('room-lock-status', {
      isLocked: room.isLocked
    });
  });

  // Guest Action: Cancel access request / leave waiting room
  socket.on('cancel-access-request', ({ roomCode }) => {
    if (!roomCode) return;
    const room = rooms.get(normalizeCode(roomCode));
    if (room) {
      room.waitingPeers.delete(socket.id);
      const hostPeer = Array.from(room.peers.values()).find(p => p.isHost);
      const hostTargetSocketId = room.hostSocketId || hostPeer?.socketId;
      if (hostTargetSocketId) {
        io.to(hostTargetSocketId).emit('pending-requests-updated', {
          pendingRequests: Array.from(room.waitingPeers.values())
        });
      }
    }
    isWaitingInRoom = null;
  });

  // Guest Action: Update display profile (name, email, mobile) while in waiting room
  socket.on('update-waiting-profile', ({ roomCode, peerName, email, mobile }) => {
    if (!roomCode) return;
    const room = rooms.get(normalizeCode(roomCode));
    if (room && room.waitingPeers.has(socket.id)) {
      const waiting = room.waitingPeers.get(socket.id);
      if (peerName) waiting.peerName = peerName.trim();
      if (email) waiting.email = email.trim();
      if (mobile) waiting.mobile = mobile.trim();
      const hostPeer = Array.from(room.peers.values()).find(p => p.isHost);
      const hostTargetSocketId = room.hostSocketId || hostPeer?.socketId;
      if (hostTargetSocketId) {
        io.to(hostTargetSocketId).emit('pending-requests-updated', {
          pendingRequests: Array.from(room.waitingPeers.values())
        });
      }
    }
  });

  // Compatibility listener
  socket.on('update-waiting-name', ({ roomCode, peerName }) => {
    if (!roomCode || !peerName) return;
    const room = rooms.get(normalizeCode(roomCode));
    if (room && room.waitingPeers.has(socket.id)) {
      const waiting = room.waitingPeers.get(socket.id);
      waiting.peerName = peerName.trim();
      const hostPeer = Array.from(room.peers.values()).find(p => p.isHost);
      const hostTargetSocketId = room.hostSocketId || hostPeer?.socketId;
      if (hostTargetSocketId) {
        io.to(hostTargetSocketId).emit('pending-requests-updated', {
          pendingRequests: Array.from(room.waitingPeers.values())
        });
      }
    }
  });

  // Text message / link broadcast
  socket.on('send-text', ({ roomCode, text, senderName, senderId }) => {
    if (!text || !text.trim()) return;
    const room = getOrCreateRoom(roomCode);

    const isUrl = /^https?:\/\/[^\s]+$/i.test(text.trim());
    const item = {
      id: uuidv4(),
      type: 'text',
      sender: senderName || 'Peer',
      senderId: senderId || socket.id,
      timestamp: new Date().toISOString(),
      payload: {
        text: text.trim(),
        isUrl
      }
    };

    room.items.unshift(item);
    room.lastActivity = Date.now();
    const cleanRoom = normalizeCode(room.code);
    socket.join(cleanRoom);
    io.to(cleanRoom).emit('item-added', item);
  });

  // Code snippet broadcast
  socket.on('send-code', ({ roomCode, code, language, title, senderName, senderId }) => {
    if (!code || !code.trim()) return;
    const room = getOrCreateRoom(roomCode);

    const item = {
      id: uuidv4(),
      type: 'code',
      sender: senderName || 'Peer',
      senderId: senderId || socket.id,
      timestamp: new Date().toISOString(),
      payload: {
        code: code.trim(),
        language: language || 'javascript',
        title: title || 'Code Snippet'
      }
    };

    room.items.unshift(item);
    room.lastActivity = Date.now();
    const cleanRoom = normalizeCode(room.code);
    socket.join(cleanRoom);
    io.to(cleanRoom).emit('item-added', item);
  });

  // Peer activity indicator (dragover, typing)
  socket.on('peer-activity', ({ roomCode, activity, active }) => {
    if (!roomCode) return;
    socket.to(normalizeCode(roomCode)).emit('peer-activity', {
      socketId: socket.id,
      activity, // 'dragging' | 'typing'
      active
    });
  });

  // Peer profile updated handler
  socket.on('update-peer-profile', ({ roomCode, peerName, email, mobile }) => {
    if (!roomCode) return;
    const room = getOrCreateRoom(roomCode);
    if (room.peers.has(socket.id)) {
      const peer = room.peers.get(socket.id);
      if (peerName) peer.peerName = peerName.trim();
      if (email) peer.email = email.trim();
      if (mobile) peer.mobile = mobile.trim();
      if (peer.isHost) {
        if (peerName) room.hostName = peerName.trim();
        if (email) room.hostEmail = email.trim();
        if (mobile) room.hostMobile = mobile.trim();
      }
      recordAttendance(room, {
        senderId: peer.senderId,
        socketId: socket.id,
        name: peer.peerName,
        email: peer.email,
        mobile: peer.mobile,
        isHost: peer.isHost
      });
      notifyAdminAttendance(room);
    }
    io.to(normalizeCode(room.code)).emit('peer-renamed', {
      socketId: socket.id,
      peerName: peerName ? peerName.trim() : '',
      peers: Array.from(room.peers.values())
    });
  });

  // Backward-compatible update-peer-name handler
  socket.on('update-peer-name', ({ roomCode, peerName }) => {
    if (!roomCode || !peerName) return;
    const room = getOrCreateRoom(roomCode);
    if (room.peers.has(socket.id)) {
      const peer = room.peers.get(socket.id);
      peer.peerName = peerName.trim();
      if (peer.isHost) {
        room.hostName = peerName.trim();
      }
      recordAttendance(room, {
        senderId: peer.senderId,
        socketId: socket.id,
        name: peer.peerName,
        email: peer.email,
        mobile: peer.mobile,
        isHost: peer.isHost
      });
      notifyAdminAttendance(room);
    }
    io.to(normalizeCode(room.code)).emit('peer-renamed', {
      socketId: socket.id,
      peerName: peerName.trim(),
      peers: Array.from(room.peers.values())
    });
  });

  // Update room TTL expiration handler
  socket.on('update-room-ttl', ({ roomCode, ttlMinutes, peerName }) => {
    if (!roomCode || ttlMinutes === undefined) return;
    const room = getOrCreateRoom(roomCode);
    room.ttlMinutes = ttlMinutes;
    room.lastActivity = Date.now();

    // Update existing files in room
    for (const [_, fileMeta] of filesRegistry.entries()) {
      if (fileMeta.roomCode === room.code) {
        fileMeta.ttlMinutes = ttlMinutes;
      }
    }

    io.to(normalizeCode(room.code)).emit('room-ttl-updated', {
      ttlMinutes,
      peerName: peerName || 'A peer'
    });
  });

  // Request new session / reset room (Restricted: Students cannot create rooms)
  socket.on('request-new-session', ({ peerName, email, mobile, senderId, role = 'student', facultyId = null } = {}) => {
    const cleanFacId = facultyId ? facultyId.trim().toUpperCase() : null;
    const isFacultyUser = Boolean(cleanFacId && facultyStore.has(cleanFacId));
    if (!isFacultyUser && role === 'student') {
      socket.emit('access-denied', {
        message: 'Students cannot create rooms. Room creation is restricted to Faculty and Administrators. Please join an existing classroom.'
      });
      return;
    }

    // Leave previous room if changing
    if (currentRoomCode) {
      socket.leave(currentRoomCode);
      const prevRoom = rooms.get(currentRoomCode);
      if (prevRoom) {
        recordExit(prevRoom, socket.id);
        notifyAdminAttendance(prevRoom);
        prevRoom.peers.delete(socket.id);
        io.to(currentRoomCode).emit('peer-left', {
          socketId: socket.id,
          peers: Array.from(prevRoom.peers.values()),
          peerCount: prevRoom.peers.size
        });
      }
    }

    let newCode = generate6DigitCode();
    while (rooms.has(normalizeCode(newCode))) {
      newCode = generate6DigitCode();
    }
    const newRoom = getOrCreateRoom(newCode, senderId, peerName);
    newRoom.hostSocketId = socket.id;
    if (email) newRoom.hostEmail = email;
    if (mobile) newRoom.hostMobile = mobile;

    const normalized = normalizeCode(newRoom.code);
    currentRoomCode = normalized;
    socket.join(normalized);

    const peerInfo = {
      socketId: socket.id,
      peerName: peerName || 'Faculty Host',
      email: email || '',
      mobile: mobile || '',
      senderId: senderId || socket.id,
      joinedAt: Date.now(),
      isHost: true
    };
    newRoom.peers.set(socket.id, peerInfo);

    recordAttendance(newRoom, {
      senderId: senderId || socket.id,
      socketId: socket.id,
      name: peerName || 'Faculty Host',
      email: email || 'N/A',
      mobile: mobile || 'N/A',
      isHost: true
    });

    socket.emit('session-created', {
      code: newRoom.code,
      slug: newRoom.slug,
      formattedCode: `${newRoom.code.slice(0, 3)} ${newRoom.code.slice(3)}`,
      items: newRoom.items,
      peers: Array.from(newRoom.peers.values()),
      peerCount: newRoom.peers.size,
      ttlMinutes: newRoom.ttlMinutes || 15,
      createdAt: newRoom.createdAt,
      isHost: true,
      hostName: newRoom.hostName || 'Faculty Host',
      attendance: getStudentAttendanceList(newRoom)
    });
  });

  // Explicit leave-room handler
  socket.on('leave-room', ({ roomCode } = {}) => {
    const targetCode = normalizeCode(roomCode || currentRoomCode);
    if (targetCode) {
      socket.leave(targetCode);
      const room = rooms.get(targetCode);
      if (room) {
        const peer = room.peers.get(socket.id);
        const senderId = peer?.senderId || (room.hostSocketId === socket.id ? room.hostClientId : null);
        recordExit(room, socket.id, senderId);
        notifyAdminAttendance(room);
        room.peers.delete(socket.id);
        if (room.hostSocketId === socket.id) {
          room.hostSocketId = null;
        }
        io.to(targetCode).emit('peer-left', {
          socketId: socket.id,
          peers: Array.from(room.peers.values()),
          peerCount: room.peers.size
        });
      }
      if (currentRoomCode === targetCode) {
        currentRoomCode = null;
      }
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    // Check if waiting in a room
    if (isWaitingInRoom) {
      const waitingRoom = rooms.get(isWaitingInRoom);
      if (waitingRoom) {
        waitingRoom.waitingPeers.delete(socket.id);
        const hostPeer = Array.from(waitingRoom.peers.values()).find(p => p.isHost);
        const hostTargetSocketId = waitingRoom.hostSocketId || hostPeer?.socketId;
        if (hostTargetSocketId) {
          io.to(hostTargetSocketId).emit('pending-requests-updated', {
            pendingRequests: Array.from(waitingRoom.waitingPeers.values())
          });
        }
      }
    }

    // Safety sweep of waitingPeers in all rooms
    for (const [_, room] of rooms.entries()) {
      if (room.waitingPeers && room.waitingPeers.has(socket.id)) {
        room.waitingPeers.delete(socket.id);
        const hostPeer = Array.from(room.peers.values()).find(p => p.isHost);
        const hostTargetSocketId = room.hostSocketId || hostPeer?.socketId;
        if (hostTargetSocketId) {
          io.to(hostTargetSocketId).emit('pending-requests-updated', {
            pendingRequests: Array.from(room.waitingPeers.values())
          });
        }
      }
    }

    // Handle peer exit across active rooms
    for (const [_, room] of rooms.entries()) {
      let isRoomPeer = false;
      let senderId = null;

      if (room.peers && room.peers.has(socket.id)) {
        const peer = room.peers.get(socket.id);
        senderId = peer?.senderId;
        room.peers.delete(socket.id);
        isRoomPeer = true;
      }

      if (room.hostSocketId === socket.id) {
        if (!senderId) senderId = room.hostClientId;
        room.hostSocketId = null;
        isRoomPeer = true;
      }

      if (isRoomPeer) {
        recordExit(room, socket.id, senderId);
        notifyAdminAttendance(room);
        io.to(normalizeCode(room.code)).emit('peer-left', {
          socketId: socket.id,
          peers: Array.from(room.peers.values()),
          peerCount: room.peers.size
        });
      }
    }
  });
});

// Serve frontend in production
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MOMO - Your personal space backend & Socket.IO server running on port ${PORT}`);
});
