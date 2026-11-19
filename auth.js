// ============================================
// Authentication & Role Management
// ============================================

const AUTH_KEYS = {
  users: 'att_users',
  session: 'att_session',
  staff: 'att_staff',
  branches: 'att_branches',
  records: 'att_records',
  settings: 'att_settings'
};

const ROLES = {
  ADMIN: 'admin',
  HR: 'hr',
  STAFF: 'staff'
};

const ROLE_LABELS = {
  admin: 'Administrator',
  hr: 'Human Resource',
  staff: 'Staff'
};

const ROLE_PERMISSIONS = {
  admin: [
    'manage_users', 'assign_roles', 'manage_credentials',
    'register_staff', 'modify_staff', 'assign_location',
    'view_dashboard', 'generate_reports', 'manage_branches',
    'sign_in_out', 'view_all_records', 'system_settings'
  ],
  hr: [
    'register_staff', 'modify_staff', 'assign_location',
    'manage_credentials', 'view_dashboard', 'generate_reports',
    'manage_branches', 'sign_in_out', 'view_all_records'
  ],
  staff: [
    'sign_in_out'
  ]
};

function hasPermission(role, permission) {
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEYS.users) || '[]');
  } catch { return []; }
}

function setUsers(users) {
  localStorage.setItem(AUTH_KEYS.users, JSON.stringify(users));
}

function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(AUTH_KEYS.session) || 'null');
    if (!s) return null;
    // Validate user still exists
    const users = getUsers();
    const user = users.find(u => u.id === s.userId);
    if (!user || !user.active) {
      clearSession();
      return null;
    }
    return { ...s, role: user.role, name: user.name, username: user.username, staffId: user.staffId };
  } catch { return null; }
}

function setSession(user) {
  localStorage.setItem(AUTH_KEYS.session, JSON.stringify({
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    staffId: user.staffId || null,
    loginAt: new Date().toISOString()
  }));
}

function clearSession() {
  localStorage.removeItem(AUTH_KEYS.session);
}

function login(username, password) {
  const users = getUsers();
  const user = users.find(u =>
    u.username.toLowerCase() === username.toLowerCase() &&
    u.password === password
  );

  if (!user) {
    return { success: false, message: 'Invalid username or password' };
  }
  if (!user.active) {
    return { success: false, message: 'Account is disabled. Contact administrator.' };
  }

  setSession(user);
  return { success: true, user };
}

function logout() {
  clearSession();
  window.location.href = 'login.html';
}

function requireAuth(allowedRoles) {
  const session = getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    // Redirect to appropriate page
    if (session.role === 'staff') {
      window.location.href = 'index.html';
    } else {
      window.location.href = 'admin.html';
    }
    return null;
  }
  return session;
}

function seedUsersIfEmpty() {
  let users = getUsers();
  if (users.length === 0) {
    users = [
      {
        id: 'usr-admin',
        username: 'admin',
        password: 'admin123',
        name: 'System Administrator',
        role: 'admin',
        staffId: null,
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr-hr',
        username: 'hr',
        password: 'hr123',
        name: 'HR Manager',
        role: 'hr',
        staffId: null,
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr-staff1',
        username: 'staff1',
        password: 'staff123',
        name: 'Alice Wanjiku',
        role: 'staff',
        staffId: 'st1',
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr-staff2',
        username: 'staff2',
        password: 'staff123',
        name: 'Brian Otieno',
        role: 'staff',
        staffId: 'st2',
        active: true,
        createdAt: new Date().toISOString()
      }
    ];
    setUsers(users);
  }

  // Also seed staff/branches if empty (shared with main app)
  seedCoreDataIfEmpty();
}

function seedCoreDataIfEmpty() {
  // Branches
  let branches = [];
  try { branches = JSON.parse(localStorage.getItem(AUTH_KEYS.branches) || '[]'); } catch {}
  if (branches.length === 0) {
    branches = [
      { id: 'br-hq', name: 'Headquarters (HQ)', code: 'HQ', location: 'Nairobi', type: 'HQ', lat: -1.286389, lng: 36.817223 },
      { id: 'br-nbo', name: 'Nairobi Branch', code: 'NBO', location: 'Nairobi', type: 'Branch', lat: -1.2921, lng: 36.8219 },
      { id: 'br-msa', name: 'Mombasa Branch', code: 'MSA', location: 'Mombasa', type: 'Branch', lat: -4.0435, lng: 39.6682 },
      { id: 'br-ksm', name: 'Kisumu Branch', code: 'KSM', location: 'Kisumu', type: 'Branch', lat: -0.0917, lng: 34.7680 },
      { id: 'br-eld', name: 'Eldoret Branch', code: 'ELD', location: 'Eldoret', type: 'Branch', lat: 0.5143, lng: 35.2698 }
    ];
    localStorage.setItem(AUTH_KEYS.branches, JSON.stringify(branches));
  }

  // Staff
  let staff = [];
  try { staff = JSON.parse(localStorage.getItem(AUTH_KEYS.staff) || '[]'); } catch {}
  if (staff.length === 0) {
    staff = [
      { id: 'st1', empId: 'EMP001', name: 'Alice Wanjiku', dept: 'Operations', branchId: 'br-hq', phone: '+254 712 345 678', email: 'alice@company.com', photo: null, lat: null, lng: null },
      { id: 'st2', empId: 'EMP002', name: 'Brian Otieno', dept: 'Finance', branchId: 'br-hq', phone: '+254 723 456 789', email: 'brian@company.com', photo: null, lat: null, lng: null },
      { id: 'st3', empId: 'EMP003', name: 'Catherine Njeri', dept: 'HR', branchId: 'br-hq', phone: '+254 734 567 890', email: 'catherine@company.com', photo: null, lat: null, lng: null },
      { id: 'st4', empId: 'EMP004', name: 'David Kamau', dept: 'Sales', branchId: 'br-nbo', phone: '+254 745 678 901', email: 'david@company.com', photo: null, lat: null, lng: null },
      { id: 'st5', empId: 'EMP005', name: 'Esther Akinyi', dept: 'Customer Service', branchId: 'br-nbo', phone: '+254 756 789 012', email: 'esther@company.com', photo: null, lat: null, lng: null },
      { id: 'st6', empId: 'EMP006', name: 'Felix Omondi', dept: 'Logistics', branchId: 'br-msa', phone: '+254 767 890 123', email: 'felix@company.com', photo: null, lat: null, lng: null },
      { id: 'st7', empId: 'EMP007', name: 'Grace Wambui', dept: 'Admin', branchId: 'br-ksm', phone: '+254 778 901 234', email: 'grace@company.com', photo: null, lat: null, lng: null },
      { id: 'st8', empId: 'EMP008', name: 'Henry Kiprop', dept: 'IT', branchId: 'br-eld', phone: '+254 789 012 345', email: 'henry@company.com', photo: null, lat: null, lng: null }
    ];
    localStorage.setItem(AUTH_KEYS.staff, JSON.stringify(staff));
  }

  // Settings
  let settings = {};
  try { settings = JSON.parse(localStorage.getItem(AUTH_KEYS.settings) || '{}'); } catch {}
  if (!settings.startTime) {
    localStorage.setItem(AUTH_KEYS.settings, JSON.stringify({ startTime: '08:30', company: 'My Company Ltd' }));
  }
}

// CRUD for users (credentials)
function createUser({ username, password, name, role, staffId }) {
  const users = getUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, message: 'Username already exists' };
  }
  const user = {
    id: uid(),
    username: username.trim(),
    password,
    name: name.trim(),
    role,
    staffId: staffId || null,
    active: true,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  setUsers(users);
  return { success: true, user };
}

function updateUser(id, updates) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return { success: false, message: 'User not found' };

  if (updates.username) {
    const exists = users.some(u => u.id !== id && u.username.toLowerCase() === updates.username.toLowerCase());
    if (exists) return { success: false, message: 'Username already taken' };
  }

  users[idx] = { ...users[idx], ...updates, updatedAt: new Date().toISOString() };
  setUsers(users);
  return { success: true, user: users[idx] };
}

function deleteUser(id) {
  const session = getSession();
  if (session && session.userId === id) {
    return { success: false, message: 'Cannot delete your own account' };
  }
  let users = getUsers();
  users = users.filter(u => u.id !== id);
  setUsers(users);
  return { success: true };
}

function changePassword(userId, newPassword) {
  return updateUser(userId, { password: newPassword });
}
