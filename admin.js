// ============================================
// Admin Panel Logic
// ============================================

let currentSession = null;
let branchChart = null;
let trendChart = null;
let currentReportData = [];
let staffPhotoData = null; // base64 photo being edited
let staffFaceDescriptor = null; // enrolled face descriptor array
let enrollStream = null;
let enrollInterval = null;

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  seedUsersIfEmpty();
  currentSession = requireAuth(['admin', 'hr']);
  if (!currentSession) return;

  // Header
  document.getElementById('userName').textContent = currentSession.name;
  document.getElementById('userRoleLabel').textContent = ROLE_LABELS[currentSession.role] || currentSession.role;
  document.getElementById('headerRole').textContent = ROLE_LABELS[currentSession.role];
  document.getElementById('userAvatar').textContent = currentSession.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  // Restrict admin-only features for HR
  if (currentSession.role === 'hr') {
    // HR can still manage users (credentials) per requirements
  }

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('reportFrom').value = today;
  document.getElementById('reportTo').value = today;

  showSection('dashboard');
});

// ---------- Navigation ----------
function showSection(name) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById('sec-' + name).classList.remove('hidden');
  const nav = document.getElementById('nav-' + name);
  if (nav) nav.classList.add('active');

  if (name === 'dashboard') refreshDashboard();
  if (name === 'staff') renderAdminStaff();
  if (name === 'users') renderUsers();
  if (name === 'branches') renderAdminBranches();
  if (name === 'reports') populateReportBranches();
}

// ---------- Helpers ----------
function getStaff() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEYS.staff) || '[]'); } catch { return []; }
}
function setStaff(data) { localStorage.setItem(AUTH_KEYS.staff, JSON.stringify(data)); }

function getBranches() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEYS.branches) || '[]'); } catch { return []; }
}
function setBranches(data) { localStorage.setItem(AUTH_KEYS.branches, JSON.stringify(data)); }

function getRecords() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEYS.records) || '[]'); } catch { return []; }
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function hoursDecimal(ms) {
  if (!ms || ms < 0) return 0;
  return +(ms / 3600000).toFixed(2);
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  document.getElementById('toastIcon').className = type === 'success'
    ? 'fas fa-check-circle text-emerald-400'
    : 'fas fa-exclamation-circle text-rose-400';
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Dashboard ----------
function refreshDashboard() {
  const staff = getStaff();
  const records = getRecords();
  const branches = getBranches();
  const users = getUsers();
  const today = todayISO();
  const todayRec = records.filter(r => r.date === today);

  const presentIds = new Set(todayRec.filter(r => r.signIn).map(r => r.staffId));
  document.getElementById('kpiPresent').textContent = presentIds.size;
  document.getElementById('kpiAbsent').textContent = Math.max(0, staff.length - presentIds.size);
  document.getElementById('kpiTotal').textContent = staff.length;
  document.getElementById('kpiUsers').textContent = users.length;

  // Currently present
  const currently = todayRec.filter(r => r.signIn && !r.signOut);
  const container = document.getElementById('currentlyPresent');
  if (!currently.length) {
    container.innerHTML = '<p class="text-slate-400 col-span-full text-center py-6 text-sm">No one currently signed in.</p>';
  } else {
    container.innerHTML = currently.map(r => {
      const b = branches.find(x => x.id === r.branchId);
      return `<div class="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
        <div class="w-9 h-9 bg-emerald-200 rounded-full flex items-center justify-center text-emerald-800 font-bold text-xs">
          ${r.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div>
          <p class="font-medium text-slate-800 text-sm">${r.name}</p>
          <p class="text-xs text-slate-500">${b ? b.code : ''} · ${formatTime(r.signIn)}</p>
        </div>
      </div>`;
    }).join('');
  }

  // Charts
  const branchCounts = {};
  branches.forEach(b => branchCounts[b.code] = 0);
  todayRec.forEach(r => {
    const b = branches.find(x => x.id === r.branchId);
    if (b) branchCounts[b.code] = (branchCounts[b.code] || 0) + 1;
  });

  const ctx1 = document.getElementById('branchChart').getContext('2d');
  if (branchChart) branchChart.destroy();
  branchChart = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: Object.keys(branchCounts),
      datasets: [{ data: Object.values(branchCounts), backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'], borderRadius: 6 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });

  const days = [], counts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }));
    counts.push(records.filter(r => r.date === d.toISOString().slice(0, 10)).length);
  }
  const ctx2 = document.getElementById('trendChart').getContext('2d');
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx2, {
    type: 'line',
    data: {
      labels: days,
      datasets: [{ data: counts, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.35, pointRadius: 4 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });
}

// ---------- Staff Registry ----------
function renderAdminStaff() {
  const search = (document.getElementById('staffSearch')?.value || '').toLowerCase();
  const staff = getStaff();
  const branches = getBranches();
  const filtered = staff.filter(s =>
    !search || s.name.toLowerCase().includes(search) || s.empId.toLowerCase().includes(search) ||
    (s.dept || '').toLowerCase().includes(search)
  );

  document.getElementById('adminStaffBody').innerHTML = filtered.map(s => {
    const b = branches.find(x => x.id === s.branchId);
    const coords = (s.lat != null && s.lng != null)
      ? `<span class="text-xs font-mono text-slate-500">${Number(s.lat).toFixed(4)}, ${Number(s.lng).toFixed(4)}</span>`
      : '<span class="text-xs text-slate-300">Not set</span>';
    const photo = s.photo
      ? `<img src="${s.photo}" class="w-9 h-9 rounded-full object-cover border border-slate-200" />`
      : `<div class="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">${s.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>`;

    const faceBadge = (s.faceDescriptor && s.faceDescriptor.length > 50)
      ? '<span class="inline-flex items-center gap-1 text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium ml-1" title="Face enrolled"><i class="fas fa-face-viewfinder"></i> Face</span>'
      : '';

    return `<tr class="border-b border-slate-50 hover:bg-slate-50">
      <td class="px-4 py-3">${photo}</td>
      <td class="px-4 py-3">
        <p class="font-medium text-slate-800">${s.name}${faceBadge}</p>
        <p class="text-xs text-slate-400 font-mono">${s.empId}</p>
      </td>
      <td class="px-4 py-3 text-slate-600">${s.dept || '—'}</td>
      <td class="px-4 py-3 text-slate-600">${b ? b.name : '—'}</td>
      <td class="px-4 py-3">${coords}</td>
      <td class="px-4 py-3">
        <div class="flex items-center gap-2">
          <button onclick="editStaff('${s.id}')" class="text-blue-500 hover:text-blue-700" title="Edit"><i class="fas fa-pen"></i></button>
          <button onclick="deleteStaffRecord('${s.id}')" class="text-rose-500 hover:text-rose-700" title="Delete"><i class="fas fa-trash-alt"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" class="text-center py-10 text-slate-400">No staff found</td></tr>';
}

function openStaffModal(staffId) {
  staffPhotoData = null;
  staffFaceDescriptor = null;
  stopFaceEnrollment();
  document.getElementById('editStaffId').value = staffId || '';
  document.getElementById('staffModalTitle').textContent = staffId ? 'Modify Staff' : 'Register Staff';
  document.getElementById('staffPhotoPreview').classList.add('hidden');
  document.getElementById('staffPhotoPlaceholder').classList.remove('hidden');
  document.getElementById('staffPhotoInput').value = '';
  updateFaceEnrollStatus(null);

  // Populate branches
  const sel = document.getElementById('sBranch');
  sel.innerHTML = getBranches().map(b => `<option value="${b.id}">${b.name}</option>`).join('');

  if (staffId) {
    const s = getStaff().find(x => x.id === staffId);
    if (s) {
      document.getElementById('sName').value = s.name;
      document.getElementById('sEmpId').value = s.empId;
      document.getElementById('sDept').value = s.dept || '';
      document.getElementById('sPhone').value = s.phone || '';
      document.getElementById('sEmail').value = s.email || '';
      document.getElementById('sBranch').value = s.branchId || '';
      document.getElementById('sLat').value = s.lat != null ? s.lat : '';
      document.getElementById('sLng').value = s.lng != null ? s.lng : '';
      if (s.photo) {
        staffPhotoData = s.photo;
        document.getElementById('staffPhotoPreview').src = s.photo;
        document.getElementById('staffPhotoPreview').classList.remove('hidden');
        document.getElementById('staffPhotoPlaceholder').classList.add('hidden');
      }
      if (s.faceDescriptor && s.faceDescriptor.length > 50) {
        staffFaceDescriptor = s.faceDescriptor;
        updateFaceEnrollStatus(true);
      }
    }
  } else {
    ['sName','sEmpId','sDept','sPhone','sEmail','sLat','sLng'].forEach(id => document.getElementById(id).value = '');
  }

  document.getElementById('staffModal').classList.remove('hidden');
}

function closeStaffModal() {
  stopFaceEnrollment();
  document.getElementById('staffModal').classList.add('hidden');
}

function updateFaceEnrollStatus(enrolled) {
  const el = document.getElementById('faceEnrollStatus');
  if (!el) return;
  if (enrolled) {
    el.textContent = '✓ Face descriptor enrolled — ready for recognition';
    el.className = 'text-xs mt-1 text-emerald-600 font-medium';
  } else {
    el.textContent = 'No face descriptor enrolled';
    el.className = 'text-xs mt-1 text-slate-400';
  }
}

function previewStaffPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    const img = new Image();
    img.onload = async function() {
      const canvas = document.createElement('canvas');
      const max = 200;
      let w = img.width, h = img.height;
      if (w > h) { if (w > max) { h *= max / w; w = max; } }
      else { if (h > max) { w *= max / h; h = max; } }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      staffPhotoData = canvas.toDataURL('image/jpeg', 0.7);
      document.getElementById('staffPhotoPreview').src = staffPhotoData;
      document.getElementById('staffPhotoPreview').classList.remove('hidden');
      document.getElementById('staffPhotoPlaceholder').classList.add('hidden');

      // Try extract face descriptor from uploaded image
      try {
        await loadFaceModels();
        // Use full-res image for better descriptor
        const full = new Image();
        full.onload = async () => {
          const desc = await getFaceDescriptor(full);
          if (desc) {
            staffFaceDescriptor = descriptorToArray(desc);
            updateFaceEnrollStatus(true);
            toast('Face extracted from photo');
          } else {
            toast('No face detected in photo — try enroll via camera', 'error');
          }
        };
        full.src = ev.target.result;
      } catch (err) {
        console.warn('Face extract from photo failed', err);
      }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// Face enrollment via live camera
async function startFaceEnrollment() {
  const area = document.getElementById('faceEnrollArea');
  const btn = document.getElementById('btnStartEnroll');
  area.classList.remove('hidden');
  btn.classList.add('hidden');
  try {
    await loadFaceModels();
    const video = document.getElementById('enrollVideo');
    const canvas = document.getElementById('enrollOverlay');
    enrollStream = await startCamera(video, 'user');
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    };
    if (enrollInterval) clearInterval(enrollInterval);
    enrollInterval = setInterval(async () => {
      try { await detectAndDraw(video, canvas); } catch (e) {}
    }, 300);
  } catch (err) {
    toast('Camera failed: ' + (err.message || 'error'), 'error');
    stopFaceEnrollment();
  }
}

function stopFaceEnrollment() {
  if (enrollInterval) { clearInterval(enrollInterval); enrollInterval = null; }
  const video = document.getElementById('enrollVideo');
  if (video) stopCamera(video);
  enrollStream = null;
  const area = document.getElementById('faceEnrollArea');
  const btn = document.getElementById('btnStartEnroll');
  if (area) area.classList.add('hidden');
  if (btn) btn.classList.remove('hidden');
}

async function captureFaceEnrollment() {
  const video = document.getElementById('enrollVideo');
  try {
    const desc = await getFaceDescriptor(video);
    if (!desc) {
      toast('No face detected. Center your face and try again.', 'error');
      return;
    }
    staffFaceDescriptor = descriptorToArray(desc);
    // Also capture a photo snapshot
    const snap = captureFrame(video);
    // Resize for storage
    const small = document.createElement('canvas');
    const max = 200;
    let w = snap.width, h = snap.height;
    if (w > h) { if (w > max) { h *= max / w; w = max; } }
    else { if (h > max) { w *= max / h; h = max; } }
    small.width = w; small.height = h;
    small.getContext('2d').drawImage(snap, 0, 0, w, h);
    staffPhotoData = small.toDataURL('image/jpeg', 0.7);
    document.getElementById('staffPhotoPreview').src = staffPhotoData;
    document.getElementById('staffPhotoPreview').classList.remove('hidden');
    document.getElementById('staffPhotoPlaceholder').classList.add('hidden');
    updateFaceEnrollStatus(true);
    stopFaceEnrollment();
    toast('Face enrolled successfully');
  } catch (err) {
    console.error(err);
    toast('Enrollment failed', 'error');
  }
}

function captureStaffGPS() {
  if (!navigator.geolocation) {
    toast('Geolocation not supported', 'error');
    return;
  }
  toast('Getting GPS location...');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      document.getElementById('sLat').value = pos.coords.latitude.toFixed(6);
      document.getElementById('sLng').value = pos.coords.longitude.toFixed(6);
      toast('GPS coordinates captured');
    },
    () => toast('Unable to get location. Check permissions.', 'error')
  );
}

function saveStaff() {
  const id = document.getElementById('editStaffId').value;
  const name = document.getElementById('sName').value.trim();
  const empId = document.getElementById('sEmpId').value.trim();
  const dept = document.getElementById('sDept').value.trim();
  const phone = document.getElementById('sPhone').value.trim();
  const email = document.getElementById('sEmail').value.trim();
  const branchId = document.getElementById('sBranch').value;
  const lat = document.getElementById('sLat').value;
  const lng = document.getElementById('sLng').value;

  if (!name || !empId) {
    toast('Name and Employee ID are required', 'error');
    return;
  }

  let staff = getStaff();
  if (id) {
    const idx = staff.findIndex(s => s.id === id);
    if (idx === -1) return;
    // Check empId uniqueness
    if (staff.some(s => s.id !== id && s.empId.toLowerCase() === empId.toLowerCase())) {
      toast('Employee ID already exists', 'error');
      return;
    }
    staff[idx] = {
      ...staff[idx],
      name, empId, dept, phone, email, branchId,
      lat: lat !== '' ? parseFloat(lat) : null,
      lng: lng !== '' ? parseFloat(lng) : null,
      photo: staffPhotoData !== null ? staffPhotoData : staff[idx].photo,
      faceDescriptor: staffFaceDescriptor !== null ? staffFaceDescriptor : staff[idx].faceDescriptor
    };
    toast('Staff updated');
  } else {
    if (staff.some(s => s.empId.toLowerCase() === empId.toLowerCase())) {
      toast('Employee ID already exists', 'error');
      return;
    }
    staff.push({
      id: uid(), empId, name, dept, phone, email, branchId,
      lat: lat !== '' ? parseFloat(lat) : null,
      lng: lng !== '' ? parseFloat(lng) : null,
      photo: staffPhotoData,
      faceDescriptor: staffFaceDescriptor
    });
    toast('Staff registered');
  }
  setStaff(staff);
  closeStaffModal();
  renderAdminStaff();
}

function editStaff(id) { openStaffModal(id); }

function deleteStaffRecord(id) {
  if (!confirm('Delete this staff member? Attendance records will be kept.')) return;
  setStaff(getStaff().filter(s => s.id !== id));
  // Unlink from users
  const users = getUsers();
  users.forEach(u => { if (u.staffId === id) u.staffId = null; });
  setUsers(users);
  renderAdminStaff();
  toast('Staff deleted');
}

// ---------- Users / Credentials ----------
function renderUsers() {
  const users = getUsers();
  const staff = getStaff();
  const canManage = hasPermission(currentSession.role, 'manage_credentials') || hasPermission(currentSession.role, 'assign_roles');

  document.getElementById('usersBody').innerHTML = users.map(u => {
    const linked = staff.find(s => s.id === u.staffId);
    const roleClass = u.role === 'admin' ? 'role-admin' : u.role === 'hr' ? 'role-hr' : 'role-staff';
    return `<tr class="border-b border-slate-50 hover:bg-slate-50">
      <td class="px-4 py-3 font-mono text-sm">${u.username}</td>
      <td class="px-4 py-3 font-medium text-slate-800">${u.name}</td>
      <td class="px-4 py-3"><span class="px-2.5 py-1 rounded-full text-xs font-medium ${roleClass}">${ROLE_LABELS[u.role]}</span></td>
      <td class="px-4 py-3 text-slate-600 text-sm">${linked ? linked.name + ' (' + linked.empId + ')' : '—'}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-0.5 rounded-full text-xs font-medium ${u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
          ${u.active ? 'Active' : 'Disabled'}
        </span>
      </td>
      <td class="px-4 py-3">
        ${canManage ? `<div class="flex items-center gap-2">
          <button onclick="editUser('${u.id}')" class="text-blue-500 hover:text-blue-700" title="Edit"><i class="fas fa-pen"></i></button>
          ${u.id !== currentSession.userId ? `<button onclick="deleteUserAccount('${u.id}')" class="text-rose-500 hover:text-rose-700" title="Delete"><i class="fas fa-trash-alt"></i></button>` : ''}
        </div>` : '—'}
      </td>
    </tr>`;
  }).join('');
}

function openUserModal(userId) {
  document.getElementById('editUserId').value = userId || '';
  document.getElementById('userModalTitle').textContent = userId ? 'Edit User / Credentials' : 'Create User';
  document.getElementById('pwdHint').textContent = userId ? '(leave blank to keep)' : '*';
  document.getElementById('uActiveWrap').classList.toggle('hidden', !userId);

  // Staff link options
  const staffSel = document.getElementById('uStaffId');
  staffSel.innerHTML = '<option value="">— None —</option>' +
    getStaff().map(s => `<option value="${s.id}">${s.empId} – ${s.name}</option>`).join('');

  // Role options: only admin can create/assign admin role
  const roleSel = document.getElementById('uRole');
  if (currentSession.role !== 'admin') {
    roleSel.innerHTML = `
      <option value="staff">Staff (Sign In/Out only)</option>
      <option value="hr">Human Resource</option>`;
  } else {
    roleSel.innerHTML = `
      <option value="staff">Staff (Sign In/Out only)</option>
      <option value="hr">Human Resource</option>
      <option value="admin">Administrator</option>`;
  }

  if (userId) {
    const u = getUsers().find(x => x.id === userId);
    if (u) {
      document.getElementById('uName').value = u.name;
      document.getElementById('uUsername').value = u.username;
      document.getElementById('uPassword').value = '';
      document.getElementById('uRole').value = u.role;
      document.getElementById('uStaffId').value = u.staffId || '';
      document.getElementById('uActive').checked = u.active !== false;
    }
  } else {
    document.getElementById('uName').value = '';
    document.getElementById('uUsername').value = '';
    document.getElementById('uPassword').value = '';
    document.getElementById('uRole').value = 'staff';
    document.getElementById('uStaffId').value = '';
  }

  document.getElementById('userModal').classList.remove('hidden');
}

function closeUserModal() {
  document.getElementById('userModal').classList.add('hidden');
}

function saveUser() {
  const id = document.getElementById('editUserId').value;
  const name = document.getElementById('uName').value.trim();
  const username = document.getElementById('uUsername').value.trim();
  const password = document.getElementById('uPassword').value;
  const role = document.getElementById('uRole').value;
  const staffId = document.getElementById('uStaffId').value || null;

  if (!name || !username) {
    toast('Name and username are required', 'error');
    return;
  }

  // Only admin can assign admin role
  if (role === 'admin' && currentSession.role !== 'admin') {
    toast('Only administrators can assign Admin role', 'error');
    return;
  }

  if (id) {
    const updates = { name, username, role, staffId };
    if (password) updates.password = password;
    if (!document.getElementById('uActiveWrap').classList.contains('hidden')) {
      updates.active = document.getElementById('uActive').checked;
    }
    const result = updateUser(id, updates);
    if (!result.success) { toast(result.message, 'error'); return; }
    toast('User updated');
  } else {
    if (!password) { toast('Password is required for new users', 'error'); return; }
    const result = createUser({ username, password, name, role, staffId });
    if (!result.success) { toast(result.message, 'error'); return; }
    toast('User created');
  }
  closeUserModal();
  renderUsers();
}

function editUser(id) { openUserModal(id); }

function deleteUserAccount(id) {
  if (!confirm('Delete this user account?')) return;
  const result = deleteUser(id);
  if (!result.success) { toast(result.message, 'error'); return; }
  renderUsers();
  toast('User deleted');
}

// ---------- Branches ----------
function renderAdminBranches() {
  const branches = getBranches();
  const staff = getStaff();
  const typeColors = { HQ: 'from-blue-600 to-indigo-600', Branch: 'from-emerald-500 to-teal-600', Regional: 'from-amber-500 to-orange-600' };

  document.getElementById('adminBranchesGrid').innerHTML = branches.map(b => {
    const count = staff.filter(s => s.branchId === b.id).length;
    const coords = (b.lat != null && b.lng != null)
      ? `${Number(b.lat).toFixed(4)}, ${Number(b.lng).toFixed(4)}`
      : 'No GPS set';
    return `<div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="h-1.5 bg-gradient-to-r ${typeColors[b.type] || typeColors.Branch}"></div>
      <div class="p-5">
        <div class="flex items-start justify-between">
          <div>
            <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">${b.type}</span>
            <h3 class="font-semibold text-slate-800">${b.name}</h3>
            <p class="text-sm text-slate-500 mt-0.5"><i class="fas fa-map-marker-alt mr-1 text-xs"></i>${b.location || '—'}</p>
          </div>
          <span class="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-1 rounded-lg">${b.code}</span>
        </div>
        <p class="text-xs text-slate-400 mt-2 font-mono">${coords}</p>
        <div class="mt-3 flex items-center justify-between">
          <span class="text-sm text-slate-500"><i class="fas fa-users mr-1"></i>${count} staff</span>
          <div class="flex gap-2">
            <button onclick="editBranch('${b.id}')" class="text-blue-500 hover:text-blue-700 text-sm"><i class="fas fa-pen"></i></button>
            ${b.type !== 'HQ' ? `<button onclick="deleteBranchRecord('${b.id}')" class="text-rose-500 hover:text-rose-700 text-sm"><i class="fas fa-trash-alt"></i></button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openBranchModal(branchId) {
  document.getElementById('editBranchId').value = branchId || '';
  document.getElementById('branchModalTitle').textContent = branchId ? 'Edit Branch' : 'Add Branch';
  if (branchId) {
    const b = getBranches().find(x => x.id === branchId);
    if (b) {
      document.getElementById('bName').value = b.name;
      document.getElementById('bCode').value = b.code;
      document.getElementById('bType').value = b.type;
      document.getElementById('bLocation').value = b.location || '';
      document.getElementById('bLat').value = b.lat != null ? b.lat : '';
      document.getElementById('bLng').value = b.lng != null ? b.lng : '';
    }
  } else {
    ['bName','bCode','bLocation','bLat','bLng'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('bType').value = 'Branch';
  }
  document.getElementById('branchModal').classList.remove('hidden');
}

function closeBranchModal() { document.getElementById('branchModal').classList.add('hidden'); }

function captureBranchGPS() {
  if (!navigator.geolocation) { toast('Geolocation not supported', 'error'); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      document.getElementById('bLat').value = pos.coords.latitude.toFixed(6);
      document.getElementById('bLng').value = pos.coords.longitude.toFixed(6);
      toast('GPS captured');
    },
    () => toast('Unable to get location', 'error')
  );
}

function saveBranch() {
  const id = document.getElementById('editBranchId').value;
  const name = document.getElementById('bName').value.trim();
  const code = document.getElementById('bCode').value.trim().toUpperCase();
  const type = document.getElementById('bType').value;
  const location = document.getElementById('bLocation').value.trim();
  const lat = document.getElementById('bLat').value;
  const lng = document.getElementById('bLng').value;

  if (!name || !code) { toast('Name and code required', 'error'); return; }

  let branches = getBranches();
  if (id) {
    const idx = branches.findIndex(b => b.id === id);
    if (branches.some(b => b.id !== id && b.code === code)) { toast('Code already exists', 'error'); return; }
    branches[idx] = {
      ...branches[idx], name, code, type, location,
      lat: lat !== '' ? parseFloat(lat) : null,
      lng: lng !== '' ? parseFloat(lng) : null
    };
    toast('Branch updated');
  } else {
    if (branches.some(b => b.code === code)) { toast('Code already exists', 'error'); return; }
    branches.push({
      id: uid(), name, code, type, location,
      lat: lat !== '' ? parseFloat(lat) : null,
      lng: lng !== '' ? parseFloat(lng) : null
    });
    toast('Branch added');
  }
  setBranches(branches);
  closeBranchModal();
  renderAdminBranches();
}

function editBranch(id) { openBranchModal(id); }

function deleteBranchRecord(id) {
  if (getBranches().length <= 1) { toast('Keep at least one branch', 'error'); return; }
  if (!confirm('Delete this branch?')) return;
  setBranches(getBranches().filter(b => b.id !== id));
  renderAdminBranches();
  toast('Branch deleted');
}

// ---------- Reports ----------
function populateReportBranches() {
  const sel = document.getElementById('reportBranch');
  const cur = sel.value;
  sel.innerHTML = '<option value="all">All Branches</option>' +
    getBranches().map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  if (cur) sel.value = cur;
}

function quickAdminReport(period) {
  const now = new Date();
  let from, to = todayISO();
  if (period === 'today') { from = to; document.getElementById('reportType').value = 'daily'; }
  else if (period === 'thisWeek') {
    const day = now.getDay() || 7;
    const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
    from = mon.toISOString().slice(0, 10);
    document.getElementById('reportType').value = 'weekly';
  } else if (period === 'thisMonth') {
    from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    document.getElementById('reportType').value = 'monthly';
  } else if (period === 'thisQuarter') {
    const q = Math.floor(now.getMonth() / 3);
    from = `${now.getFullYear()}-${String(q*3+1).padStart(2,'0')}-01`;
    document.getElementById('reportType').value = 'quarterly';
  }
  document.getElementById('reportFrom').value = from;
  document.getElementById('reportTo').value = to;
  generateAdminReport();
}

function generateAdminReport() {
  const type = document.getElementById('reportType').value;
  const branchId = document.getElementById('reportBranch').value;
  const from = document.getElementById('reportFrom').value;
  const to = document.getElementById('reportTo').value;
  if (!from || !to) { toast('Select dates', 'error'); return; }

  let records = getRecords().filter(r => r.date >= from && r.date <= to);
  if (branchId !== 'all') records = records.filter(r => r.branchId === branchId);
  records.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  currentReportData = records;

  const branches = getBranches();
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  document.getElementById('adminReportTitle').textContent = `${typeLabel} Attendance Report`;
  document.getElementById('adminReportSub').textContent =
    `${formatDate(from)} – ${formatDate(to)} · ${records.length} records`;

  const unique = new Set(records.map(r => r.staffId)).size;
  const late = records.filter(r => r.status === 'Late').length;
  let totalH = 0;
  records.forEach(r => { if (r.signOut) totalH += hoursDecimal(new Date(r.signOut) - new Date(r.signIn)); });

  document.getElementById('adminReportSummary').innerHTML = `
    <div class="bg-blue-50 rounded-xl p-3 text-center"><p class="text-2xl font-bold text-blue-700">${records.length}</p><p class="text-xs text-blue-600">Records</p></div>
    <div class="bg-emerald-50 rounded-xl p-3 text-center"><p class="text-2xl font-bold text-emerald-700">${unique}</p><p class="text-xs text-emerald-600">Staff</p></div>
    <div class="bg-amber-50 rounded-xl p-3 text-center"><p class="text-2xl font-bold text-amber-700">${late}</p><p class="text-xs text-amber-600">Late</p></div>
    <div class="bg-indigo-50 rounded-xl p-3 text-center"><p class="text-2xl font-bold text-indigo-700">${totalH.toFixed(1)}</p><p class="text-xs text-indigo-600">Hours</p></div>`;

  document.getElementById('adminReportBody').innerHTML = records.length ? records.map(r => {
    const b = branches.find(x => x.id === r.branchId);
    const h = r.signOut ? hoursDecimal(new Date(r.signOut) - new Date(r.signIn)).toFixed(2) : '—';
    const sc = r.status === 'Late' ? 'status-late' : (r.signOut ? 'status-out' : 'status-in');
    return `<tr class="border-b border-slate-50">
      <td class="px-3 py-2">${formatDate(r.date)}</td>
      <td class="px-3 py-2 font-medium">${r.name}<br><span class="text-xs text-slate-400">${r.empId}</span></td>
      <td class="px-3 py-2">${b ? b.code : '—'}</td>
      <td class="px-3 py-2">${formatTime(r.signIn)}</td>
      <td class="px-3 py-2">${formatTime(r.signOut)}</td>
      <td class="px-3 py-2">${h}</td>
      <td class="px-3 py-2"><span class="px-2 py-0.5 rounded-full text-xs font-medium ${sc}">${r.status || (r.signOut ? 'Done' : 'In')}</span></td>
    </tr>`;
  }).join('') : '<tr><td colspan="7" class="text-center py-8 text-slate-400">No records</td></tr>';

  document.getElementById('adminReportResults').classList.remove('hidden');
}

function exportAdminCSV() {
  if (!currentReportData.length) { toast('No data', 'error'); return; }
  const branches = getBranches();
  const headers = ['Date','Employee ID','Name','Branch','Sign In','Sign Out','Hours','Status','Notes'];
  const rows = currentReportData.map(r => {
    const b = branches.find(x => x.id === r.branchId);
    const h = r.signOut ? hoursDecimal(new Date(r.signOut) - new Date(r.signIn)).toFixed(2) : '';
    return [r.date, r.empId, `"${r.name}"`, b ? b.name : '', formatTime(r.signIn), formatTime(r.signOut), h, r.status||'', `"${(r.notes||'').replace(/"/g,'""')}"`].join(',');
  });
  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `report_${document.getElementById('reportFrom').value}_${document.getElementById('reportTo').value}.csv`;
  a.click();
  toast('CSV exported');
}
