// ============================================
// Staff Attendance System - HQ & Branches
// ============================================

const STORAGE_KEYS = {
  staff: 'att_staff',
  branches: 'att_branches',
  records: 'att_records',
  settings: 'att_settings'
};

let branchChart = null;
let trendChart = null;
let currentReportData = [];
let html5QrCode = null;
let scannedStaff = null; // holds staff object after QR scan
let currentQRStaff = null; // for badge modal

// ---------- Helpers ----------
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDuration(ms) {
  if (!ms || ms < 0) return '—';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function hoursDecimal(ms) {
  if (!ms || ms < 0) return 0;
  return +(ms / 3600000).toFixed(2);
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  const icon = document.getElementById('toastIcon');
  const text = document.getElementById('toastMsg');
  text.textContent = msg;
  icon.className = type === 'success'
    ? 'fas fa-check-circle text-emerald-400'
    : type === 'error'
      ? 'fas fa-exclamation-circle text-rose-400'
      : 'fas fa-info-circle text-blue-400';
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3200);
}

function getData(key) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS[key]) || '[]');
  } catch {
    return [];
  }
}

function setData(key, data) {
  localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data));
}

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
  } catch {
    return {};
  }
}

function saveSettingsData(s) {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(s));
}

// ---------- Seed Data ----------
function seedIfEmpty() {
  let branches = getData('branches');
  if (branches.length === 0) {
    branches = [
      { id: 'br-hq', name: 'Headquarters (HQ)', code: 'HQ', location: 'Nairobi', type: 'HQ' },
      { id: 'br-nbo', name: 'Nairobi Branch', code: 'NBO', location: 'Nairobi', type: 'Branch' },
      { id: 'br-msa', name: 'Mombasa Branch', code: 'MSA', location: 'Mombasa', type: 'Branch' },
      { id: 'br-ksm', name: 'Kisumu Branch', code: 'KSM', location: 'Kisumu', type: 'Branch' },
      { id: 'br-eld', name: 'Eldoret Branch', code: 'ELD', location: 'Eldoret', type: 'Branch' }
    ];
    setData('branches', branches);
  }

  let staff = getData('staff');
  if (staff.length === 0) {
    staff = [
      { id: 'st1', empId: 'EMP001', name: 'Alice Wanjiku', dept: 'Operations', branchId: 'br-hq', phone: '+254 712 345 678' },
      { id: 'st2', empId: 'EMP002', name: 'Brian Otieno', dept: 'Finance', branchId: 'br-hq', phone: '+254 723 456 789' },
      { id: 'st3', empId: 'EMP003', name: 'Catherine Njeri', dept: 'HR', branchId: 'br-hq', phone: '+254 734 567 890' },
      { id: 'st4', empId: 'EMP004', name: 'David Kamau', dept: 'Sales', branchId: 'br-nbo', phone: '+254 745 678 901' },
      { id: 'st5', empId: 'EMP005', name: 'Esther Akinyi', dept: 'Customer Service', branchId: 'br-nbo', phone: '+254 756 789 012' },
      { id: 'st6', empId: 'EMP006', name: 'Felix Omondi', dept: 'Logistics', branchId: 'br-msa', phone: '+254 767 890 123' },
      { id: 'st7', empId: 'EMP007', name: 'Grace Wambui', dept: 'Admin', branchId: 'br-ksm', phone: '+254 778 901 234' },
      { id: 'st8', empId: 'EMP008', name: 'Henry Kiprop', dept: 'IT', branchId: 'br-eld', phone: '+254 789 012 345' }
    ];
    setData('staff', staff);
  }

  const settings = getSettings();
  if (!settings.startTime) {
    saveSettingsData({ startTime: '08:30', company: 'My Company Ltd' });
  }
}

// ---------- Tabs ----------
function switchTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
  document.getElementById('panel-' + name).classList.remove('hidden');
  document.getElementById('tab-' + name).classList.add('tab-active');

  if (name === 'dashboard') refreshDashboard();
  if (name === 'attendance') refreshTodayTable();
  if (name === 'staff') renderStaffList();
  if (name === 'branches') renderBranches();
  if (name === 'reports') populateReportBranches();
}

// ---------- Clock ----------
function updateClock() {
  const el = document.getElementById('currentDateTime');
  const now = new Date();
  el.textContent = now.toLocaleString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

// ---------- Populate Selects ----------
function populateSelects() {
  const staff = getData('staff');
  const branches = getData('branches');

  const empSelect = document.getElementById('attEmployee');
  empSelect.innerHTML = '<option value="">-- Select Employee --</option>';
  staff.forEach(s => {
    empSelect.innerHTML += `<option value="${s.id}">${s.empId} – ${s.name}</option>`;
  });

  const branchSelect = document.getElementById('attBranch');
  branchSelect.innerHTML = '<option value="">-- Select Branch --</option>';
  branches.forEach(b => {
    branchSelect.innerHTML += `<option value="${b.id}">${b.name} (${b.code})</option>`;
  });

  const staffBranch = document.getElementById('staffBranch');
  staffBranch.innerHTML = '';
  branches.forEach(b => {
    staffBranch.innerHTML += `<option value="${b.id}">${b.name}</option>`;
  });
}

// ---------- Sign In / Out ----------
function signIn() {
  const empId = document.getElementById('attEmployee').value;
  const branchId = document.getElementById('attBranch').value;
  const notes = document.getElementById('attNotes').value.trim();

  if (!empId || !branchId) {
    showAttMessage('Please select both Employee and Branch.', 'error');
    return;
  }

  const staff = getData('staff');
  const employee = staff.find(s => s.id === empId);
  if (!employee) return;

  const records = getData('records');
  const today = todayISO();

  // Check if already signed in today without sign-out
  const openRecord = records.find(r =>
    r.staffId === empId && r.date === today && r.signIn && !r.signOut
  );
  if (openRecord) {
    showAttMessage(`${employee.name} is already signed in today.`, 'error');
    return;
  }

  const settings = getSettings();
  const startTime = settings.startTime || '08:30';
  const now = new Date();
  const [sh, sm] = startTime.split(':').map(Number);
  const lateThreshold = new Date(now);
  lateThreshold.setHours(sh, sm, 0, 0);

  const isLate = now > lateThreshold;
  const status = isLate ? 'Late' : 'On Time';

  const record = {
    id: uid(),
    staffId: empId,
    empId: employee.empId,
    name: employee.name,
    branchId,
    date: today,
    signIn: now.toISOString(),
    signOut: null,
    notes: notes || (isLate ? 'Late arrival' : ''),
    status,
    createdAt: now.toISOString()
  };

  records.push(record);
  setData('records', records);

  showAttMessage(`✓ ${employee.name} signed in at ${formatTime(record.signIn)}${isLate ? ' (Late)' : ''}`, 'success');
  document.getElementById('attNotes').value = '';
  refreshTodayTable();
  toast(`${employee.name} signed in successfully`);
}

function signOut() {
  const empId = document.getElementById('attEmployee').value;
  if (!empId) {
    showAttMessage('Please select an Employee.', 'error');
    return;
  }

  const staff = getData('staff');
  const employee = staff.find(s => s.id === empId);
  if (!employee) return;

  const records = getData('records');
  const today = todayISO();

  const openRecord = records.find(r =>
    r.staffId === empId && r.date === today && r.signIn && !r.signOut
  );

  if (!openRecord) {
    showAttMessage(`${employee.name} has no open sign-in for today.`, 'error');
    return;
  }

  openRecord.signOut = new Date().toISOString();
  const notes = document.getElementById('attNotes').value.trim();
  if (notes) openRecord.notes = (openRecord.notes ? openRecord.notes + ' | ' : '') + notes;

  setData('records', records);
  showAttMessage(`✓ ${employee.name} signed out at ${formatTime(openRecord.signOut)}`, 'success');
  document.getElementById('attNotes').value = '';
  refreshTodayTable();
  toast(`${employee.name} signed out successfully`);
}

function showAttMessage(msg, type) {
  const el = document.getElementById('attMessage');
  el.className = `mt-4 p-3 rounded-xl text-sm font-medium ${
    type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
  }`;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ---------- Today's Table ----------
function refreshTodayTable() {
  const records = getData('records').filter(r => r.date === todayISO());
  const branches = getData('branches');
  const tbody = document.getElementById('todayTableBody');
  const empty = document.getElementById('todayEmpty');
  document.getElementById('todayCount').textContent = `${records.length} record${records.length !== 1 ? 's' : ''}`;

  if (records.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = records
    .sort((a, b) => new Date(b.signIn) - new Date(a.signIn))
    .map(r => {
      const branch = branches.find(b => b.id === r.branchId);
      const duration = r.signOut
        ? formatDuration(new Date(r.signOut) - new Date(r.signIn))
        : '—';
      const statusClass = !r.signOut
        ? 'status-in'
        : r.status === 'Late'
          ? 'status-late'
          : 'status-out';
      const statusText = !r.signOut ? 'Present' : r.status === 'Late' ? 'Late' : 'Completed';

      return `<tr class="hover:bg-slate-50">
        <td class="py-3 font-medium text-slate-800">${r.name}<br><span class="text-xs text-slate-400">${r.empId}</span></td>
        <td class="py-3 text-slate-600">${branch ? branch.code : '—'}</td>
        <td class="py-3 text-slate-600">${formatTime(r.signIn)}</td>
        <td class="py-3 text-slate-600">${formatTime(r.signOut)}</td>
        <td class="py-3 text-slate-600">${duration}</td>
        <td class="py-3"><span class="px-2.5 py-1 rounded-full text-xs font-medium ${statusClass}">${statusText}</span></td>
      </tr>`;
    }).join('');
}

// ---------- Dashboard ----------
function refreshDashboard() {
  const staff = getData('staff');
  const records = getData('records');
  const branches = getData('branches');
  const today = todayISO();
  const todayRecords = records.filter(r => r.date === today);

  const presentIds = new Set(todayRecords.filter(r => r.signIn).map(r => r.staffId));
  const present = presentIds.size;
  const absent = Math.max(0, staff.length - present);
  const late = todayRecords.filter(r => r.status === 'Late').length;

  document.getElementById('kpiPresent').textContent = present;
  document.getElementById('kpiAbsent').textContent = absent;
  document.getElementById('kpiLate').textContent = late;
  document.getElementById('kpiTotal').textContent = staff.length;

  // Currently signed in
  const currently = todayRecords.filter(r => r.signIn && !r.signOut);
  const container = document.getElementById('currentlyPresent');
  if (currently.length === 0) {
    container.innerHTML = '<p class="text-slate-400 col-span-full text-center py-6">No one is currently signed in.</p>';
  } else {
    container.innerHTML = currently.map(r => {
      const branch = branches.find(b => b.id === r.branchId);
      return `<div class="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
        <div class="w-10 h-10 bg-emerald-200 rounded-full flex items-center justify-center text-emerald-800 font-bold text-sm">
          ${r.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div>
          <p class="font-medium text-slate-800 text-sm">${r.name}</p>
          <p class="text-xs text-slate-500">${branch ? branch.name : ''} · since ${formatTime(r.signIn)}</p>
        </div>
      </div>`;
    }).join('');
  }

  // Branch chart
  const branchCounts = {};
  branches.forEach(b => branchCounts[b.code] = 0);
  todayRecords.forEach(r => {
    const b = branches.find(x => x.id === r.branchId);
    if (b) branchCounts[b.code] = (branchCounts[b.code] || 0) + 1;
  });

  const ctx1 = document.getElementById('branchChart').getContext('2d');
  if (branchChart) branchChart.destroy();
  branchChart = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: Object.keys(branchCounts),
      datasets: [{
        label: 'Sign-ins',
        data: Object.values(branchCounts),
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { grid: { display: false } }
      }
    }
  });

  // 7-day trend
  const days = [];
  const counts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push(d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }));
    counts.push(records.filter(r => r.date === iso).length);
  }

  const ctx2 = document.getElementById('trendChart').getContext('2d');
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx2, {
    type: 'line',
    data: {
      labels: days,
      datasets: [{
        label: 'Records',
        data: counts,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.1)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#3b82f6',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { grid: { display: false } }
      }
    }
  });
}

// ---------- Reports ----------
function populateReportBranches() {
  const branches = getData('branches');
  const sel = document.getElementById('reportBranch');
  const current = sel.value;
  sel.innerHTML = '<option value="all">All Branches</option>';
  branches.forEach(b => {
    sel.innerHTML += `<option value="${b.id}">${b.name}</option>`;
  });
  if (current) sel.value = current;
}

function quickReport(period) {
  const now = new Date();
  let from, to;
  to = todayISO();

  switch (period) {
    case 'today':
      from = to;
      document.getElementById('reportType').value = 'daily';
      break;
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      from = to = y.toISOString().slice(0, 10);
      document.getElementById('reportType').value = 'daily';
      break;
    }
    case 'thisWeek': {
      const day = now.getDay() || 7;
      const mon = new Date(now);
      mon.setDate(now.getDate() - day + 1);
      from = mon.toISOString().slice(0, 10);
      document.getElementById('reportType').value = 'weekly';
      break;
    }
    case 'lastWeek': {
      const day = now.getDay() || 7;
      const mon = new Date(now);
      mon.setDate(now.getDate() - day + 1 - 7);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      from = mon.toISOString().slice(0, 10);
      to = sun.toISOString().slice(0, 10);
      document.getElementById('reportType').value = 'weekly';
      break;
    }
    case 'thisMonth':
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      document.getElementById('reportType').value = 'monthly';
      break;
    case 'lastMonth': {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      from = lm.toISOString().slice(0, 10);
      to = lastDay.toISOString().slice(0, 10);
      document.getElementById('reportType').value = 'monthly';
      break;
    }
    case 'thisQuarter': {
      const q = Math.floor(now.getMonth() / 3);
      from = `${now.getFullYear()}-${String(q * 3 + 1).padStart(2, '0')}-01`;
      document.getElementById('reportType').value = 'quarterly';
      break;
    }
  }

  document.getElementById('reportFrom').value = from;
  document.getElementById('reportTo').value = to;
  generateReport();
}

function generateReport() {
  const type = document.getElementById('reportType').value;
  const branchId = document.getElementById('reportBranch').value;
  const from = document.getElementById('reportFrom').value;
  const to = document.getElementById('reportTo').value;

  if (!from || !to) {
    toast('Please select From and To dates', 'error');
    return;
  }

  let records = getData('records').filter(r => r.date >= from && r.date <= to);
  if (branchId !== 'all') {
    records = records.filter(r => r.branchId === branchId);
  }

  records.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  currentReportData = records;

  const branches = getData('branches');
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const branchLabel = branchId === 'all'
    ? 'All Branches'
    : (branches.find(b => b.id === branchId)?.name || '');

  document.getElementById('reportTitle').textContent = `${typeLabel} Attendance Report`;
  document.getElementById('reportSubtitle').textContent =
    `${formatDate(from)} – ${formatDate(to)} · ${branchLabel} · ${records.length} records`;

  // Summary
  const uniqueStaff = new Set(records.map(r => r.staffId)).size;
  const lateCount = records.filter(r => r.status === 'Late').length;
  const completed = records.filter(r => r.signOut).length;
  let totalHours = 0;
  records.forEach(r => {
    if (r.signOut) totalHours += hoursDecimal(new Date(r.signOut) - new Date(r.signIn));
  });

  document.getElementById('reportSummary').innerHTML = `
    <div class="bg-blue-50 rounded-xl p-3 text-center">
      <p class="text-2xl font-bold text-blue-700">${records.length}</p>
      <p class="text-xs text-blue-600">Total Records</p>
    </div>
    <div class="bg-emerald-50 rounded-xl p-3 text-center">
      <p class="text-2xl font-bold text-emerald-700">${uniqueStaff}</p>
      <p class="text-xs text-emerald-600">Unique Staff</p>
    </div>
    <div class="bg-amber-50 rounded-xl p-3 text-center">
      <p class="text-2xl font-bold text-amber-700">${lateCount}</p>
      <p class="text-xs text-amber-600">Late Arrivals</p>
    </div>
    <div class="bg-indigo-50 rounded-xl p-3 text-center">
      <p class="text-2xl font-bold text-indigo-700">${totalHours.toFixed(1)}</p>
      <p class="text-xs text-indigo-600">Total Hours</p>
    </div>
  `;

  const tbody = document.getElementById('reportTableBody');
  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-slate-400">No records found for the selected period.</td></tr>`;
  } else {
    tbody.innerHTML = records.map(r => {
      const branch = branches.find(b => b.id === r.branchId);
      const hours = r.signOut
        ? hoursDecimal(new Date(r.signOut) - new Date(r.signIn)).toFixed(2)
        : '—';
      const statusClass = r.status === 'Late' ? 'status-late' : (r.signOut ? 'status-out' : 'status-in');
      return `<tr class="hover:bg-slate-50 border-b border-slate-50">
        <td class="px-3 py-2.5">${formatDate(r.date)}</td>
        <td class="px-3 py-2.5 font-medium">${r.name}<br><span class="text-xs text-slate-400">${r.empId}</span></td>
        <td class="px-3 py-2.5">${branch ? branch.code : '—'}</td>
        <td class="px-3 py-2.5">${formatTime(r.signIn)}</td>
        <td class="px-3 py-2.5">${formatTime(r.signOut)}</td>
        <td class="px-3 py-2.5">${hours}</td>
        <td class="px-3 py-2.5"><span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}">${r.status || (r.signOut ? 'Completed' : 'Present')}</span></td>
        <td class="px-3 py-2.5 text-slate-500 text-xs max-w-[120px] truncate">${r.notes || ''}</td>
      </tr>`;
    }).join('');
  }

  document.getElementById('reportResults').classList.remove('hidden');
}

function exportReportCSV() {
  if (!currentReportData.length) {
    toast('No data to export', 'error');
    return;
  }
  const branches = getData('branches');
  const headers = ['Date', 'Employee ID', 'Employee Name', 'Branch', 'Sign In', 'Sign Out', 'Hours', 'Status', 'Notes'];
  const rows = currentReportData.map(r => {
    const branch = branches.find(b => b.id === r.branchId);
    const hours = r.signOut
      ? hoursDecimal(new Date(r.signOut) - new Date(r.signIn)).toFixed(2)
      : '';
    return [
      r.date,
      r.empId,
      `"${r.name}"`,
      branch ? branch.name : '',
      formatTime(r.signIn),
      formatTime(r.signOut),
      hours,
      r.status || '',
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_report_${document.getElementById('reportFrom').value}_to_${document.getElementById('reportTo').value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Report exported as CSV');
}

function printReport() {
  window.print();
}

// ---------- Staff Management ----------
function addStaff() {
  const name = document.getElementById('staffName').value.trim();
  const empId = document.getElementById('staffId').value.trim();
  const dept = document.getElementById('staffDept').value.trim();
  const branchId = document.getElementById('staffBranch').value;
  const phone = document.getElementById('staffPhone').value.trim();

  if (!name || !empId) {
    toast('Name and Employee ID are required', 'error');
    return;
  }

  const staff = getData('staff');
  if (staff.some(s => s.empId.toLowerCase() === empId.toLowerCase())) {
    toast('Employee ID already exists', 'error');
    return;
  }

  staff.push({
    id: uid(),
    empId,
    name,
    dept: dept || 'General',
    branchId,
    phone
  });
  setData('staff', staff);

  document.getElementById('staffName').value = '';
  document.getElementById('staffId').value = '';
  document.getElementById('staffDept').value = '';
  document.getElementById('staffPhone').value = '';

  populateSelects();
  renderStaffList();
  toast(`${name} added successfully`);
}

function deleteStaff(id) {
  if (!confirm('Delete this employee? Their attendance records will remain.')) return;
  let staff = getData('staff');
  staff = staff.filter(s => s.id !== id);
  setData('staff', staff);
  populateSelects();
  renderStaffList();
  toast('Employee removed');
}

function renderStaffList() {
  const search = (document.getElementById('staffSearch')?.value || '').toLowerCase();
  const staff = getData('staff');
  const branches = getData('branches');
  const filtered = staff.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search) ||
    s.empId.toLowerCase().includes(search) ||
    (s.dept || '').toLowerCase().includes(search)
  );

  const tbody = document.getElementById('staffTableBody');
  tbody.innerHTML = filtered.map(s => {
    const branch = branches.find(b => b.id === s.branchId);
    return `<tr class="hover:bg-slate-50 border-b border-slate-50">
      <td class="py-3 font-mono text-xs text-slate-500">${s.empId}</td>
      <td class="py-3 font-medium text-slate-800">${s.name}</td>
      <td class="py-3 text-slate-600">${s.dept || '—'}</td>
      <td class="py-3 text-slate-600">${branch ? branch.code : '—'}</td>
      <td class="py-3 text-slate-600 text-xs">${s.phone || '—'}</td>
      <td class="py-3">
        <div class="flex items-center gap-2">
          <button onclick="showStaffQR('${s.id}')" class="text-blue-500 hover:text-blue-700 text-sm" title="Show QR Badge">
            <i class="fas fa-qrcode"></i>
          </button>
          <button onclick="deleteStaff('${s.id}')" class="text-rose-500 hover:text-rose-700 text-sm" title="Delete">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" class="text-center py-8 text-slate-400">No staff found</td></tr>';
}

// ---------- Branches ----------
function addBranch() {
  const name = document.getElementById('branchName').value.trim();
  const code = document.getElementById('branchCode').value.trim().toUpperCase();
  const location = document.getElementById('branchLocation').value.trim();
  const type = document.getElementById('branchType').value;

  if (!name || !code) {
    toast('Branch name and code are required', 'error');
    return;
  }

  const branches = getData('branches');
  if (branches.some(b => b.code === code)) {
    toast('Branch code already exists', 'error');
    return;
  }

  branches.push({ id: uid(), name, code, location, type });
  setData('branches', branches);

  document.getElementById('branchName').value = '';
  document.getElementById('branchCode').value = '';
  document.getElementById('branchLocation').value = '';

  populateSelects();
  renderBranches();
  toast(`${name} added successfully`);
}

function deleteBranch(id) {
  const branches = getData('branches');
  if (branches.length <= 1) {
    toast('You must keep at least one branch', 'error');
    return;
  }
  if (!confirm('Delete this branch?')) return;
  setData('branches', branches.filter(b => b.id !== id));
  populateSelects();
  renderBranches();
  toast('Branch removed');
}

function renderBranches() {
  const branches = getData('branches');
  const staff = getData('staff');
  const grid = document.getElementById('branchesGrid');

  const typeColors = {
    HQ: 'from-blue-600 to-indigo-600',
    Branch: 'from-emerald-500 to-teal-600',
    Regional: 'from-amber-500 to-orange-600'
  };

  grid.innerHTML = branches.map(b => {
    const count = staff.filter(s => s.branchId === b.id).length;
    const gradient = typeColors[b.type] || typeColors.Branch;
    return `<div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden card-hover">
      <div class="h-2 bg-gradient-to-r ${gradient}"></div>
      <div class="p-5">
        <div class="flex items-start justify-between">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">${b.type}</span>
            <h3 class="font-semibold text-slate-800 mt-0.5">${b.name}</h3>
            <p class="text-sm text-slate-500 mt-1"><i class="fas fa-map-marker-alt mr-1"></i>${b.location || '—'}</p>
          </div>
          <span class="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-lg">${b.code}</span>
        </div>
        <div class="mt-4 flex items-center justify-between">
          <span class="text-sm text-slate-500"><i class="fas fa-users mr-1"></i>${count} staff</span>
          ${b.type !== 'HQ' ? `<button onclick="deleteBranch('${b.id}')" class="text-rose-400 hover:text-rose-600 text-sm"><i class="fas fa-trash-alt"></i></button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ---------- Settings ----------
function showSettings() {
  const s = getSettings();
  document.getElementById('settingStartTime').value = s.startTime || '08:30';
  document.getElementById('settingCompany').value = s.company || 'My Company Ltd';
  document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.add('hidden');
}

function saveSettings() {
  saveSettingsData({
    startTime: document.getElementById('settingStartTime').value,
    company: document.getElementById('settingCompany').value.trim() || 'My Company Ltd'
  });
  closeSettings();
  toast('Settings saved');
}

function clearAllData() {
  if (!confirm('This will delete ALL staff, branches, and attendance records. Continue?')) return;
  if (!confirm('Are you absolutely sure? This cannot be undone.')) return;
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  seedIfEmpty();
  populateSelects();
  renderStaffList();
  renderBranches();
  refreshTodayTable();
  closeSettings();
  toast('All data cleared and reset to defaults');
}

function exportAllData() {
  const data = {
    staff: getData('staff'),
    branches: getData('branches'),
    records: getData('records'),
    settings: getSettings(),
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_backup_${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Full data backup downloaded');
}

// ---------- Face Recognition ----------
let faceStream = null;
let faceDetectInterval = null;
let faceRecognizing = false;

async function startFaceScanner() {
  const area = document.getElementById('faceScannerArea');
  const btn = document.getElementById('btnStartFace');
  const status = document.getElementById('faceStatus');
  const resultEl = document.getElementById('faceScanResult');

  resultEl.classList.add('hidden');
  area.classList.remove('hidden');
  btn.classList.add('hidden');
  status.textContent = 'Loading face models…';
  status.className = 'text-xs text-center text-amber-600 mt-2';

  try {
    await loadFaceModels();
    status.textContent = 'Starting camera…';
    const video = document.getElementById('faceVideo');
    const canvas = document.getElementById('faceOverlay');
    faceStream = await startCamera(video, 'user');

    // Size overlay to video
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    };

    status.textContent = 'Position your face in the frame, then tap Recognize';
    status.className = 'text-xs text-center text-emerald-600 mt-2';

    // Live detection overlay
    if (faceDetectInterval) clearInterval(faceDetectInterval);
    faceDetectInterval = setInterval(async () => {
      try {
        await detectAndDraw(video, canvas);
      } catch (e) { /* ignore frame errors */ }
    }, 300);
  } catch (err) {
    console.error(err);
    status.textContent = 'Camera or models failed. Check permissions / internet.';
    status.className = 'text-xs text-center text-rose-600 mt-2';
    toast('Face recognition unavailable: ' + (err.message || 'error'), 'error');
    stopFaceScanner();
  }
}

function stopFaceScanner() {
  if (faceDetectInterval) {
    clearInterval(faceDetectInterval);
    faceDetectInterval = null;
  }
  const video = document.getElementById('faceVideo');
  stopCamera(video);
  faceStream = null;
  const canvas = document.getElementById('faceOverlay');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  document.getElementById('faceScannerArea').classList.add('hidden');
  document.getElementById('btnStartFace').classList.remove('hidden');
  faceRecognizing = false;
}

async function captureAndRecognize() {
  if (faceRecognizing) return;
  faceRecognizing = true;

  const status = document.getElementById('faceStatus');
  const resultEl = document.getElementById('faceScanResult');
  const btn = document.getElementById('btnFaceCapture');
  const video = document.getElementById('faceVideo');

  status.textContent = 'Analyzing face…';
  status.className = 'text-xs text-center text-amber-600 mt-2';
  btn.disabled = true;

  try {
    const descriptor = await getFaceDescriptor(video);
    if (!descriptor) {
      status.textContent = 'No face detected. Move closer and try again.';
      status.className = 'text-xs text-center text-rose-600 mt-2';
      resultEl.className = 'mt-3 p-3 rounded-xl text-sm bg-rose-50 text-rose-700';
      resultEl.textContent = 'No face found in frame.';
      resultEl.classList.remove('hidden');
      faceRecognizing = false;
      btn.disabled = false;
      return;
    }

    const staff = getData('staff');
    const enrolled = staff.filter(s => s.faceDescriptor && s.faceDescriptor.length > 50);

    if (enrolled.length === 0) {
      status.textContent = 'No enrolled faces. Register faces in Admin → Staff.';
      status.className = 'text-xs text-center text-amber-600 mt-2';
      resultEl.className = 'mt-3 p-3 rounded-xl text-sm bg-amber-50 text-amber-800';
      resultEl.textContent = 'No staff have face data yet. HR/Admin must enroll faces first.';
      resultEl.classList.remove('hidden');
      faceRecognizing = false;
      btn.disabled = false;
      return;
    }

    const match = matchFace(descriptor, enrolled);
    if (!match) {
      status.textContent = 'Face not recognized.';
      status.className = 'text-xs text-center text-rose-600 mt-2';
      resultEl.className = 'mt-3 p-3 rounded-xl text-sm bg-rose-50 text-rose-700';
      resultEl.textContent = 'No match. Ensure face was enrolled under Staff Registry.';
      resultEl.classList.remove('hidden');
      faceRecognizing = false;
      btn.disabled = false;
      return;
    }

    // Success — open same confirm flow as QR
    status.textContent = `Matched: ${match.staff.name} (${match.confidence.toFixed(0)}%)`;
    status.className = 'text-xs text-center text-emerald-600 mt-2';
    resultEl.className = 'mt-3 p-3 rounded-xl text-sm bg-emerald-50 text-emerald-700';
    resultEl.textContent = `Recognized ${match.staff.name} · confidence ${match.confidence.toFixed(0)}%`;
    resultEl.classList.remove('hidden');

    stopFaceScanner();
    scannedStaff = match.staff;
    openQRConfirm(match.staff);
    toast(`Face matched: ${match.staff.name}`);
  } catch (err) {
    console.error(err);
    status.textContent = 'Recognition error';
    status.className = 'text-xs text-center text-rose-600 mt-2';
    toast('Face recognition failed', 'error');
  }

  faceRecognizing = false;
  btn.disabled = false;
}

// ---------- QR Code Scanning ----------
function getQRPayload(staff) {
  // Format: ATT|{empId}|{internalId}
  return `ATT|${staff.empId}|${staff.id}`;
}

function parseQRPayload(text) {
  if (!text) return null;
  text = text.trim();

  // Format ATT|EMP001|st1
  if (text.startsWith('ATT|')) {
    const parts = text.split('|');
    if (parts.length >= 3) {
      return { empId: parts[1], staffId: parts[2] };
    }
  }

  // Plain employee ID fallback (e.g. EMP001)
  const staff = getData('staff');
  const byEmpId = staff.find(s => s.empId.toUpperCase() === text.toUpperCase());
  if (byEmpId) return { empId: byEmpId.empId, staffId: byEmpId.id };

  // Internal id fallback
  const byId = staff.find(s => s.id === text);
  if (byId) return { empId: byId.empId, staffId: byId.id };

  return null;
}

async function startQRScanner() {
  const area = document.getElementById('qrScannerArea');
  const btn = document.getElementById('btnStartScan');
  const resultEl = document.getElementById('qrScanResult');

  resultEl.classList.add('hidden');
  area.classList.remove('hidden');
  btn.classList.add('hidden');

  if (html5QrCode) {
    try { await html5QrCode.stop(); } catch (e) {}
    html5QrCode = null;
  }

  html5QrCode = new Html5Qrcode('qr-reader');

  const config = {
    fps: 10,
    qrbox: { width: 220, height: 220 },
    aspectRatio: 1.0,
    disableFlip: false
  };

  try {
    await html5QrCode.start(
      { facingMode: 'environment' },
      config,
      onQRScanSuccess,
      () => {} // ignore continuous fail
    );
  } catch (err) {
    // Fallback to any camera
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length) {
        await html5QrCode.start(cameras[0].id, config, onQRScanSuccess, () => {});
      } else {
        throw new Error('No camera found');
      }
    } catch (err2) {
      toast('Camera access denied or unavailable. Use manual entry.', 'error');
      stopQRScanner();
      console.error(err2);
    }
  }
}

async function stopQRScanner() {
  if (html5QrCode) {
    try {
      await html5QrCode.stop();
      html5QrCode.clear();
    } catch (e) {}
    html5QrCode = null;
  }
  document.getElementById('qrScannerArea').classList.add('hidden');
  document.getElementById('btnStartScan').classList.remove('hidden');
}

function onQRScanSuccess(decodedText) {
  // Prevent multiple rapid triggers
  if (scannedStaff) return;

  const parsed = parseQRPayload(decodedText);
  if (!parsed) {
    const resultEl = document.getElementById('qrScanResult');
    resultEl.className = 'mt-3 p-3 rounded-xl text-sm bg-rose-50 text-rose-700';
    resultEl.textContent = 'Invalid QR code. Not a staff badge.';
    resultEl.classList.remove('hidden');
    return;
  }

  const staff = getData('staff');
  const employee = staff.find(s => s.id === parsed.staffId || s.empId === parsed.empId);
  if (!employee) {
    const resultEl = document.getElementById('qrScanResult');
    resultEl.className = 'mt-3 p-3 rounded-xl text-sm bg-rose-50 text-rose-700';
    resultEl.textContent = 'Staff not found in system.';
    resultEl.classList.remove('hidden');
    return;
  }

  scannedStaff = employee;
  stopQRScanner();
  openQRConfirm(employee);
}

function openQRConfirm(employee) {
  const branches = getData('branches');
  const records = getData('records');
  const today = todayISO();

  const openRecord = records.find(r =>
    r.staffId === employee.id && r.date === today && r.signIn && !r.signOut
  );

  document.getElementById('qrConfirmName').textContent = employee.name;
  document.getElementById('qrConfirmMeta').textContent = `${employee.empId} · ${employee.dept || 'Staff'}`;
  document.getElementById('qrConfirmAvatar').textContent =
    employee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const statusEl = document.getElementById('qrConfirmStatus');
  if (openRecord) {
    statusEl.textContent = `Currently signed in since ${formatTime(openRecord.signIn)}`;
    statusEl.className = 'text-sm mt-2 font-medium text-emerald-600';
  } else {
    statusEl.textContent = 'Not signed in today';
    statusEl.className = 'text-sm mt-2 font-medium text-slate-500';
  }

  // Populate branch select
  const branchSel = document.getElementById('qrConfirmBranch');
  branchSel.innerHTML = '';
  branches.forEach(b => {
    branchSel.innerHTML += `<option value="${b.id}" ${b.id === employee.branchId ? 'selected' : ''}>${b.name}</option>`;
  });

  // Highlight recommended action
  const btnIn = document.getElementById('qrBtnSignIn');
  const btnOut = document.getElementById('qrBtnSignOut');
  if (openRecord) {
    btnOut.classList.add('ring-2', 'ring-offset-2', 'ring-rose-400');
    btnIn.classList.remove('ring-2', 'ring-offset-2', 'ring-emerald-400');
  } else {
    btnIn.classList.add('ring-2', 'ring-offset-2', 'ring-emerald-400');
    btnOut.classList.remove('ring-2', 'ring-offset-2', 'ring-rose-400');
  }

  document.getElementById('qrConfirmModal').classList.remove('hidden');
}

function closeQRConfirm() {
  scannedStaff = null;
  document.getElementById('qrConfirmModal').classList.add('hidden');
}

function qrDoSignIn() {
  if (!scannedStaff) return;
  // Fill the manual form and call signIn
  document.getElementById('attEmployee').value = scannedStaff.id;
  document.getElementById('attBranch').value = document.getElementById('qrConfirmBranch').value;
  document.getElementById('attNotes').value = 'Via QR scan';
  closeQRConfirm();
  signIn();
}

function qrDoSignOut() {
  if (!scannedStaff) return;
  document.getElementById('attEmployee').value = scannedStaff.id;
  document.getElementById('attBranch').value = document.getElementById('qrConfirmBranch').value;
  document.getElementById('attNotes').value = 'Via QR scan';
  closeQRConfirm();
  signOut();
}

// ---------- QR Badge Generation ----------
function showStaffQR(staffId) {
  const staff = getData('staff');
  const employee = staff.find(s => s.id === staffId);
  if (!employee) return;

  currentQRStaff = employee;
  const branches = getData('branches');
  const branch = branches.find(b => b.id === employee.branchId);

  document.getElementById('qrStaffName').textContent = employee.name;
  document.getElementById('qrStaffId').textContent = employee.empId;
  document.getElementById('qrBranch').textContent = branch ? `${branch.name} (${branch.code})` : '';

  const canvas = document.getElementById('qrCanvas');
  const payload = getQRPayload(employee);

  QRCode.toCanvas(canvas, payload, {
    width: 200,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
    errorCorrectionLevel: 'M'
  }, (err) => {
    if (err) {
      console.error(err);
      toast('Failed to generate QR code', 'error');
    }
  });

  document.getElementById('qrModal').classList.remove('hidden');
}

function closeQRModal() {
  currentQRStaff = null;
  document.getElementById('qrModal').classList.add('hidden');
}

function downloadQR() {
  if (!currentQRStaff) return;
  const canvas = document.getElementById('qrCanvas');
  const link = document.createElement('a');
  link.download = `QR_${currentQRStaff.empId}_${currentQRStaff.name.replace(/\s+/g, '_')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  toast('QR badge downloaded');
}

function printQR() {
  if (!currentQRStaff) return;
  const canvas = document.getElementById('qrCanvas');
  const dataUrl = canvas.toDataURL('image/png');
  const branches = getData('branches');
  const branch = branches.find(b => b.id === currentQRStaff.branchId);
  const settings = getSettings();

  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>QR Badge - ${currentQRStaff.name}</title>
      <style>
        body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; }
        .badge { border: 2px solid #1e293b; border-radius: 16px; padding: 24px; display: inline-block; max-width: 280px; }
        img { width: 200px; height: 200px; }
        h2 { margin: 12px 0 4px; font-size: 18px; }
        p { margin: 4px 0; color: #64748b; font-size: 13px; }
        .company { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; }
      </style>
    </head>
    <body>
      <div class="badge">
        <div class="company">${settings.company || 'Company'}</div>
        <img src="${dataUrl}" alt="QR Code" />
        <h2>${currentQRStaff.name}</h2>
        <p>${currentQRStaff.empId}</p>
        <p>${branch ? branch.name : ''}</p>
        <p style="margin-top:12px;font-size:11px;">Scan to Sign In / Sign Out</p>
      </div>
      <script>window.onload = function() { window.print(); }<\/script>
    </body>
    </html>
  `);
  win.document.close();
}

// ---------- Init ----------
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  // Auth check
  if (typeof seedUsersIfEmpty === 'function') seedUsersIfEmpty();
  seedIfEmpty();

  currentUser = (typeof getSession === 'function') ? getSession() : null;
  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  // Header user info
  const avatar = document.getElementById('headerAvatar');
  const nameEl = document.getElementById('headerUserName');
  const roleEl = document.getElementById('headerUserRole');
  if (avatar) avatar.textContent = currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  if (nameEl) nameEl.textContent = currentUser.name;
  if (roleEl) roleEl.textContent = (typeof ROLE_LABELS !== 'undefined' ? ROLE_LABELS[currentUser.role] : currentUser.role);

  // Role-based UI
  applyRoleUI(currentUser.role);

  populateSelects();

  // If staff role with linked staffId, lock employee select to themselves
  if (currentUser.role === 'staff' && currentUser.staffId) {
    const empSelect = document.getElementById('attEmployee');
    empSelect.value = currentUser.staffId;
    empSelect.disabled = true;
    // Auto-select their branch
    const staff = getData('staff');
    const emp = staff.find(s => s.id === currentUser.staffId);
    if (emp && emp.branchId) {
      document.getElementById('attBranch').value = emp.branchId;
    }
  }

  refreshTodayTable();
  updateClock();
  setInterval(updateClock, 1000);

  // Default report dates
  const rf = document.getElementById('reportFrom');
  const rt = document.getElementById('reportTo');
  if (rf) rf.value = todayISO();
  if (rt) rt.value = todayISO();

  // Auto-select default branch when employee changes
  document.getElementById('attEmployee').addEventListener('change', function () {
    const staff = getData('staff');
    const emp = staff.find(s => s.id === this.value);
    if (emp && emp.branchId) {
      document.getElementById('attBranch').value = emp.branchId;
    }
  });
});

function applyRoleUI(role) {
  const isAdminOrHR = role === 'admin' || role === 'hr';

  // Hide admin-only tabs for staff
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdminOrHR ? '' : 'none';
  });

  // Header buttons
  const adminLink = document.getElementById('adminLink');
  const btnExport = document.getElementById('btnExport');
  const btnSettings = document.getElementById('btnSettings');
  if (adminLink) adminLink.classList.toggle('hidden', !isAdminOrHR);
  if (btnExport) btnExport.classList.toggle('hidden', !isAdminOrHR);
  if (btnSettings) btnSettings.classList.toggle('hidden', role !== 'admin');
}
