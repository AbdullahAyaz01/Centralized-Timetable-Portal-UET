// UET KSK Centralized Timetable Web Application Engine

let masterDepartments = [];
let masterRooms = [];
let masterCourses = [];
let currentTimetableEntries = [];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_SLOTS = [
  { start: '08:00', end: '09:00', label: '08:00 - 09:00 AM' },
  { start: '09:00', end: '10:00', label: '09:00 - 10:00 AM' },
  { start: '10:00', end: '11:00', label: '10:00 - 11:00 AM' },
  { start: '11:00', end: '12:00', label: '11:00 - 12:00 AM' },
  { start: '13:00', end: '14:00', label: '01:00 - 02:00 PM (Break)' },
  { start: '14:00', end: '15:00', label: '02:00 - 03:00 PM' },
  { start: '15:00', end: '16:00', label: '03:00 - 04:00 PM' }
];

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthSession();
  if (currentUser) {
    await loadMasterData();
    setupDropzone();
    await renderTimetable();
  }
});

// View Navigation Switcher
function switchMainView(viewId, navElem) {
  document.querySelectorAll('.main-view').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  const target = document.getElementById(viewId);
  if (target) target.style.display = 'block';

  if (navElem) navElem.classList.add('active');

  if (viewId === 'viewDeptsTree') renderDeptTree();
  if (viewId === 'viewRoomsManager') renderRoomsManager();
  if (viewId === 'viewAdminCreds') renderAdminCredsTable();
}

function toggleSidebar() {
  document.getElementById('uetSidebar').classList.toggle('mobile-open');
}

// Load Master Data
async function loadMasterData() {
  try {
    const [deptRes, roomRes, courseRes] = await Promise.all([
      fetch('/api/departments'),
      fetch('/api/rooms'),
      fetch('/api/courses')
    ]);

    masterDepartments = await deptRes.json();
    masterRooms = await roomRes.json();
    masterCourses = await courseRes.json();

    document.getElementById('statDeptCount').textContent = masterDepartments.length;
    document.getElementById('statRoomCount').textContent = masterRooms.length;

    populateFilterDropdowns();
    renderDeptTree();
  } catch (err) {
    console.error('Error loading master data:', err);
  }
}

// Populate Filter Dropdowns
function populateFilterDropdowns() {
  const filterDept = document.getElementById('filterDept');
  if (filterDept) {
    filterDept.innerHTML = `<option value="">🏛️ All Departments (Central View)</option>` +
      masterDepartments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
  }

  const filterRoom = document.getElementById('filterRoom');
  if (filterRoom) {
    filterRoom.innerHTML = `<option value="">All Rooms</option>` +
      masterRooms.map(r => `<option value="${r.id}">${r.room_name} (${r.room_type})</option>`).join('');
  }
}

// DEPARTMENT & ROOM TREE VIEW
function renderDeptTree() {
  const dashTree = document.getElementById('dashboardDeptTree');
  const mainTree = document.getElementById('mainDeptTreeContainer');
  const isSuperAdmin = currentUser && currentUser.role === 'admin';

  if (masterDepartments.length === 0) return;

  if (dashTree) {
    let dashHtml = `<div class="dept-tree-container">`;
    masterDepartments.forEach((d, idx) => {
      const isFirstOpen = idx === 0;
      const roomList = d.rooms && d.rooms.length > 0 ? d.rooms : masterRooms.filter(r => Number(r.department_id) === Number(d.id));
      const canEditDept = canUserEditDept(d.id);

      dashHtml += `
        <div class="dept-tree-node">
          <div class="dept-tree-header" onclick="toggleTreeNode('dash-node-${d.id}', this)">
            <div class="tree-toggle-btn" id="dash-btn-toggle-${d.id}">${isFirstOpen ? '-' : '+'}</div>
            <div class="dept-title"><i class="fa-solid fa-building-columns" style="color:${d.color || '#006633'}"></i> ${d.name} (${d.code})</div>
            <span class="badge" style="background:${d.color || '#006633'}; color:#fff;">${roomList.length} Rooms</span>
          </div>

          <div class="dept-tree-children" id="dash-node-${d.id}" style="display: ${isFirstOpen ? 'flex' : 'none'};">
      `;

      if (roomList.length === 0) {
        dashHtml += `<div class="text-muted text-sm p-2">No rooms assigned directly to this department.</div>`;
      } else {
        roomList.forEach(r => {
          const isLab = r.room_type === 'Computer Lab';
          const hasProj = r.projector ? '📹 Projector: Yes' : 'No Projector';
          const compInfo = isLab ? ` | 💻 ${r.computers_count || 40} Computers` : '';

          dashHtml += `
            <div class="room-tree-item" onclick="inspectRoomTimetable(${r.id}, '${r.room_name}')">
              <span class="room-badge"><i class="fa-solid ${isLab ? 'fa-laptop-code' : 'fa-chalkboard-user'}"></i> ${r.room_name}</span>
              <span class="badge ${isLab ? 'bg-purple' : 'bg-green'}" style="color:#fff;">${isLab ? 'Computer Lab' : 'Lecture Room'}</span>
              <div class="room-specs">
                <span>🪑 ${r.capacity || r.chairs_count || 50} Chairs</span>
                <span>${hasProj}</span>
                <span>${compInfo}</span>
              </div>
              ${canEditDept ? `
                <button class="btn-icon btn-icon-danger ml-2" title="Delete Room" onclick="event.stopPropagation(); handleDeleteRoom(${r.id}, '${r.room_name}')">
                  <i class="fa-solid fa-trash"></i>
                </button>
              ` : ''}
            </div>
          `;
        });
      }
      dashHtml += `</div></div>`;
    });
    dashHtml += `</div>`;
    dashTree.innerHTML = dashHtml;
  }

  if (mainTree) {
    let mainHtml = `<div class="dept-tree-container">`;
    masterDepartments.forEach((d, idx) => {
      const isFirstOpen = idx === 0;
      const roomList = d.rooms && d.rooms.length > 0 ? d.rooms : masterRooms.filter(r => Number(r.department_id) === Number(d.id));
      const canEditDept = canUserEditDept(d.id);

      mainHtml += `
        <div class="dept-tree-node">
          <div class="dept-tree-header">
            <div class="tree-toggle-btn" id="main-btn-toggle-${d.id}" onclick="toggleTreeNode('main-node-${d.id}', this.parentElement)">${isFirstOpen ? '-' : '+'}</div>
            <div class="dept-title" onclick="toggleTreeNode('main-node-${d.id}', this.parentElement)"><i class="fa-solid fa-building-columns" style="color:${d.color || '#006633'}"></i> ${d.name} (${d.code})</div>
            <span class="badge mr-2" style="background:${d.color || '#006633'}; color:#fff;">${roomList.length} Rooms</span>
            
            ${isSuperAdmin ? `
              <button class="btn-icon btn-icon-danger" title="Delete Department" onclick="event.stopPropagation(); handleDeleteDept(${d.id}, '${d.name}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ''}
          </div>

          <div class="dept-tree-children" id="main-node-${d.id}" style="display: ${isFirstOpen ? 'flex' : 'none'};">
      `;

      if (roomList.length === 0) {
        mainHtml += `<div class="text-muted text-sm p-2">No rooms assigned directly to this department.</div>`;
      } else {
        roomList.forEach(r => {
          const isLab = r.room_type === 'Computer Lab';
          const hasProj = r.projector ? '📹 Projector: Yes' : 'No Projector';
          const compInfo = isLab ? ` | 💻 ${r.computers_count || 40} Computers` : '';

          mainHtml += `
            <div class="room-tree-item" onclick="inspectRoomTimetable(${r.id}, '${r.room_name}')">
              <span class="room-badge"><i class="fa-solid ${isLab ? 'fa-laptop-code' : 'fa-chalkboard-user'}"></i> ${r.room_name}</span>
              <span class="badge ${isLab ? 'bg-purple' : 'bg-green'}" style="color:#fff;">${isLab ? 'Computer Lab' : 'Lecture Room'}</span>
              <div class="room-specs">
                <span>🪑 ${r.capacity || r.chairs_count || 50} Chairs</span>
                <span>${hasProj}</span>
                <span>${compInfo}</span>
              </div>
              ${canEditDept ? `
                <button class="btn-icon btn-icon-danger ml-2" title="Delete Room" onclick="event.stopPropagation(); handleDeleteRoom(${r.id}, '${r.room_name}')">
                  <i class="fa-solid fa-trash"></i>
                </button>
              ` : ''}
            </div>
          `;
        });
      }
      mainHtml += `</div></div>`;
    });
    mainHtml += `</div>`;
    mainTree.innerHTML = mainHtml;
  }
}

function toggleTreeNode(nodeId, headerElem) {
  const node = document.getElementById(nodeId);
  const toggleBtn = headerElem.querySelector('.tree-toggle-btn');
  if (node) {
    if (node.style.display === 'none' || !node.style.display) {
      node.style.display = 'flex';
      if (toggleBtn) toggleBtn.textContent = '-';
    } else {
      node.style.display = 'none';
      if (toggleBtn) toggleBtn.textContent = '+';
    }
  }
}

// Delete Department Action (Super Admin)
async function handleDeleteDept(deptId, deptName) {
  if (!confirm(`⚠️ DELETE DEPARTMENT WARNING:\n\nAre you sure you want to delete "${deptName}"?\n\nThis action will PERMANENTLY delete ALL rooms, login credentials, courses, and timetable schedule entries for this department!`)) {
    return;
  }

  try {
    const res = await fetch(`/api/departments/${deptId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to delete department.');
      return;
    }
    alert(data.message);
    await loadMasterData();
    renderTimetable();
  } catch (err) {
    alert('Error deleting department.');
  }
}

// Delete Room Action (Isolated by Department Permission)
async function handleDeleteRoom(roomId, roomName) {
  if (!confirm(`⚠️ DELETE ROOM CONFIRMATION:\n\nAre you sure you want to delete room "${roomName}"?\n\nThis will permanently remove the room and any schedule slots assigned to it!`)) {
    return;
  }

  try {
    const res = await fetch(`/api/rooms/${roomId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to delete room.');
      return;
    }
    alert(data.message);
    await loadMasterData();
    renderRoomsManager();
    renderTimetable();
  } catch (err) {
    alert('Error deleting room.');
  }
}

// 1-Click Clear Department Timetable Slots (Dept Coordinator ONLY)
async function handleClearDeptTimetable() {
  if (!currentUser || currentUser.role !== 'dept_admin') {
    alert('Super Admin is forbidden from clearing department timetables. Only department coordinators can clear their timetable.');
    return;
  }

  const targetDeptId = currentUser.department_id;
  const targetDeptName = currentUser.department_name;

  if (!confirm(`⚠️ 1-CLICK PURGE TIMETABLE CONFIRMATION:\n\nAre you sure you want to clear ALL scheduled timetable slots for "${targetDeptName}"?\n\nThis will remove all lectures/labs in 1 click.\nRooms, credentials, and courses will remain 100% SAFE!`)) {
    return;
  }

  try {
    const res = await fetch(`/api/timetable/clear-department/${targetDeptId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to clear department timetable.');
      return;
    }
    alert(data.message);
    renderTimetable();
  } catch (err) {
    alert('Error clearing department timetable.');
  }
}

// Inspect specific room's timetable
function inspectRoomTimetable(roomId, roomName) {
  document.getElementById('filterRoom').value = roomId;
  document.getElementById('filterDept').value = '';
  switchMainView('viewTimetable', document.getElementById('navTimetable'));
  renderTimetable();
}

// Render Master Timetable Matrix
async function renderTimetable() {
  const gridWrapper = document.getElementById('gridWrapper');
  const countNum = document.getElementById('slotCountNumber');
  const statSlotCount = document.getElementById('statSlotCount');
  const activeBadge = document.getElementById('activeFilterBadge');
  const clearBtn = document.getElementById('btnClearDeptTimetable');

  // HIDE Clear Dept Timetable button for Super Admin! Show ONLY for Dept Coordinator!
  if (clearBtn) {
    if (currentUser && currentUser.role === 'dept_admin') {
      clearBtn.style.display = 'inline-flex';
    } else {
      clearBtn.style.display = 'none';
    }
  }

  if (!gridWrapper) return;

  gridWrapper.innerHTML = `<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading schedule...</div>`;

  const deptFilter = document.getElementById('filterDept').value;
  const semFilter = document.getElementById('filterSemester').value;
  const dayFilter = document.getElementById('filterDay').value;
  const roomFilter = document.getElementById('filterRoom').value;
  const searchVal = document.getElementById('globalSearchInput').value.trim();

  const params = new URLSearchParams();
  if (deptFilter) params.append('department_id', deptFilter);
  if (semFilter) params.append('semester', semFilter);
  if (dayFilter) params.append('day', dayFilter);
  if (roomFilter) params.append('room_id', roomFilter);
  if (searchVal) params.append('search', searchVal);

  try {
    const res = await fetch(`/api/timetable?${params.toString()}`);
    currentTimetableEntries = await res.json();

    if (countNum) countNum.textContent = currentTimetableEntries.length;
    if (statSlotCount) statSlotCount.textContent = currentTimetableEntries.length;

    let badges = [];
    if (deptFilter) {
      const d = masterDepartments.find(x => x.id == deptFilter);
      if (d) badges.push(`<span class="badge" style="background:${d.color}; color:#fff;">Dept: ${d.name}</span>`);
    }
    if (roomFilter) {
      const r = masterRooms.find(x => x.id == roomFilter);
      if (r) badges.push(`<span class="badge badge-default">Room: ${r.room_name}</span>`);
    }
    if (semFilter) badges.push(`<span class="badge badge-default">Sem ${semFilter}</span>`);
    if (dayFilter) badges.push(`<span class="badge badge-default">Day: ${dayFilter}</span>`);
    if (searchVal) badges.push(`<span class="badge badge-default">Search: "${searchVal}"</span>`);

    if (badges.length === 0) {
      activeBadge.innerHTML = `<span class="badge badge-default">Showing Centralized Schedule</span>`;
    } else {
      activeBadge.innerHTML = badges.join('');
    }

    if (currentTimetableEntries.length === 0) {
      gridWrapper.innerHTML = `
        <div class="no-slots-placeholder" style="text-align:center; padding:40px;">
          <i class="fa-solid fa-calendar-xmark" style="font-size:2.5rem; color:var(--uet-green);"></i>
          <h3>No Scheduled Lectures Found</h3>
          <p>No timetable slots match your current criteria.</p>
        </div>
      `;
      return;
    }

    renderWeeklyMatrix(currentTimetableEntries, dayFilter);
  } catch (err) {
    gridWrapper.innerHTML = `<div class="form-error">Failed to load timetable data.</div>`;
  }
}

// Weekly Matrix Renderer
function renderWeeklyMatrix(entries, selectedDay) {
  const gridWrapper = document.getElementById('gridWrapper');
  const daysToRender = selectedDay ? [selectedDay] : DAYS_OF_WEEK;

  let html = `<div class="weekly-grid" style="grid-template-columns: 110px repeat(${daysToRender.length}, minmax(190px, 1fr));">`;

  html += `<div class="grid-header-cell"><i class="fa-solid fa-clock"></i> Time Slot</div>`;
  daysToRender.forEach(day => {
    html += `<div class="grid-header-cell">${day}</div>`;
  });

  TIME_SLOTS.forEach(slot => {
    html += `<div class="time-slot-label">${slot.label}</div>`;

    daysToRender.forEach(day => {
      const matching = entries.filter(e => {
        return e.day_of_week === day && (
          (e.start_time >= slot.start && e.start_time < slot.end) ||
          (e.start_time <= slot.start && e.end_time > slot.start)
        );
      });

      html += `<div class="day-column">`;

      if (matching.length > 0) {
        matching.forEach(entry => {
          const canEdit = canUserEditDept(entry.department_id);
          const isLab = entry.room_type === 'Computer Lab';
          const projBadge = entry.room_projector ? '📹 Proj: Yes' : 'No Proj';
          const compBadge = isLab ? ` | 💻 ${entry.room_computers || 40} PCs` : '';

          html += `
            <div class="slot-card" style="border-left-color: ${entry.department_color || '#006633'};">
              <div class="slot-card-header">
                <span class="dept-pill" style="background: ${entry.department_color || '#006633'}">${entry.department_code}</span>
                <span class="course-code">${entry.course_code}</span>
              </div>
              <div class="course-title">${entry.course_name}</div>
              
              <div class="slot-meta">
                <span><i class="fa-solid fa-door-closed"></i> <strong>${entry.room_name}</strong> (${isLab ? 'Lab' : 'Lecture'})</span>
                <span class="room-spec-pill">🪑 ${entry.room_capacity || 50} Seats | ${projBadge}${compBadge}</span>
                <span><i class="fa-solid fa-users"></i> Sec: <strong>${entry.section}</strong> | Sem ${entry.semester}</span>
              </div>

              ${canEdit ? `
                <div class="slot-actions no-print">
                  <button class="btn-icon" title="Edit Slot" onclick="openEditSlotModal(${entry.id})">
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button class="btn-icon btn-icon-danger" title="Delete Slot" onclick="handleDeleteSlot(${entry.id})">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              ` : ''}
            </div>
          `;
        });
      }

      html += `</div>`;
    });
  });

  html += `</div>`;
  gridWrapper.innerHTML = html;
}

// DRAG & DROP EXCEL FILE IMPORTER
function setupDropzone() {
  const dropzone = document.getElementById('excelDropzone');
  if (!dropzone) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
  });

  dropzone.addEventListener('drop', handleDrop, false);
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  if (files.length > 0) {
    processExcelFile(files[0]);
  }
}

function handleFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) {
    processExcelFile(files[0]);
  }
}

async function processExcelFile(file) {
  const statusDiv = document.getElementById('importResultStatus');
  statusDiv.style.display = 'block';
  statusDiv.innerHTML = `<div class="p-3 bg-blue text-white rounded"><i class="fa-solid fa-spinner fa-spin"></i> Reading Excel file "${file.name}"...</div>`;

  const reader = new FileReader();
  reader.onload = async function(e) {
    const data = new Uint8Array(e.target.result);
    const base64Str = btoa(String.fromCharCode.apply(null, data));

    try {
      const res = await fetch('/api/upload/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: base64Str })
      });

      const resData = await res.json();
      if (!res.ok) {
        statusDiv.innerHTML = `<div class="form-error">${resData.error}</div>`;
        return;
      }

      let conflictNotice = '';
      if (resData.conflictsSkipped > 0) {
        conflictNotice = `<div class="mt-2 text-warning font-semibold">⚠️ ${resData.conflictsSkipped} occupied slots were skipped to prevent overwriting existing schedules!</div>`;
      }

      statusDiv.innerHTML = `
        <div class="p-3 bg-green text-white rounded">
          <i class="fa-solid fa-circle-check"></i> Success! Imported ${resData.importedSlots} timetable slots and registered ${resData.newRooms} rooms!
          ${conflictNotice}
        </div>
      `;

      await loadMasterData();
      renderTimetable();
    } catch (err) {
      statusDiv.innerHTML = `<div class="form-error">Error processing Excel upload.</div>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

async function importPresetDashboardXlsx() {
  const statusDiv = document.getElementById('importResultStatus');
  statusDiv.style.display = 'block';
  statusDiv.innerHTML = `<div class="p-3 bg-blue text-white rounded"><i class="fa-solid fa-spinner fa-spin"></i> Importing preset campus dataset \`dashboard.xlsx\`...</div>`;

  try {
    const res = await fetch('/api/upload/excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileData: 'preset' })
    });
    const resData = await res.json();

    let conflictNotice = '';
    if (resData.conflictsSkipped > 0) {
      conflictNotice = `<div class="mt-2 text-warning font-semibold">⚠️ ${resData.conflictsSkipped} occupied slots were skipped to prevent overwriting existing schedules!</div>`;
    }

    statusDiv.innerHTML = `
      <div class="p-3 bg-green text-white rounded">
        <i class="fa-solid fa-circle-check"></i> Dataset \`dashboard.xlsx\` parsed successfully! Imported ${resData.importedSlots} slots.
        ${conflictNotice}
      </div>
    `;

    await loadMasterData();
    renderTimetable();
  } catch (err) {
    statusDiv.innerHTML = `<div class="form-error">Error importing dashboard.xlsx</div>`;
  }
}

// SUPER ADMIN COORDINATOR CREDENTIALS MANAGER
async function renderAdminCredsTable() {
  const container = document.getElementById('adminCredsTableContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/departments/credentials');
    const users = await res.json();

    let html = `
      <table class="dept-list-table">
        <thead>
          <tr>
            <th>Role</th>
            <th>Department</th>
            <th>Full Name</th>
            <th>Username</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>
    `;

    users.forEach(u => {
      html += `
        <tr>
          <td><span class="badge ${u.role === 'admin' ? 'bg-purple' : 'bg-green'}" style="color:#fff;">${u.role}</span></td>
          <td><strong>${u.department_name || 'All (Super Admin)'}</strong></td>
          <td>${u.full_name}</td>
          <td><code>${u.username}</code></td>
          <td>${u.email || '-'}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="form-error">Failed to load coordinator credentials.</div>`;
  }
}

// ROOMS MANAGER DASHBOARD PER DEPARTMENT
function renderRoomsManager() {
  const grid = document.getElementById('roomsListGrid');
  if (!grid) return;

  let html = '';
  masterRooms.forEach(r => {
    const isLab = r.room_type === 'Computer Lab';
    const canEditRoom = canUserEditDept(r.department_id);

    html += `
      <div class="card p-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h4 class="m-0" style="color:var(--uet-green);"><i class="fa-solid ${isLab ? 'fa-laptop-code' : 'fa-door-closed'}"></i> ${r.room_name}</h4>
          <span class="badge ${isLab ? 'bg-purple' : 'bg-green'}" style="color:#fff;">${isLab ? 'Computer Lab' : 'Lecture Room'}</span>
        </div>
        <div class="text-sm text-muted">
          <div>Department: <strong>${r.department_name}</strong></div>
          <div>Chairs: <strong>🪑 ${r.capacity || r.chairs_count || 50} Seats</strong></div>
          <div>Projector: <strong>${r.projector ? '📹 Yes' : 'No'}</strong></div>
          ${isLab ? `<div>Computers: <strong>💻 ${r.computers_count || 40} PCs</strong></div>` : ''}
        </div>
        ${canEditRoom ? `
          <div class="mt-3 pt-2 border-top">
            <button class="btn btn-outline btn-sm text-danger" onclick="handleDeleteRoom(${r.id}, '${r.room_name}')">
              <i class="fa-solid fa-trash"></i> Delete Room
            </button>
          </div>
        ` : ''}
      </div>
    `;
  });

  grid.innerHTML = html;
}

// Combined Dept & Coordinator Account Creation (Super Admin)
async function handleCreateDeptWithCredentials(e) {
  e.preventDefault();
  const name = document.getElementById('newDeptName').value;
  const code = document.getElementById('newDeptCode').value;
  const color = document.getElementById('newDeptColor').value;

  const coordinator_username = document.getElementById('newCoordUsername').value;
  const coordinator_password = document.getElementById('newCoordPassword').value;
  const coordinator_name = document.getElementById('newCoordName').value;
  const coordinator_email = document.getElementById('newCoordEmail').value;

  try {
    const res = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, code, color, building: 'Main Academic Block',
        coordinator_username, coordinator_password, coordinator_name, coordinator_email
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to create department.');
      return;
    }

    alert(`Department "${name}" and Coordinator account "${coordinator_username}" created successfully!`);
    closeDeptManagementModal();
    await loadMasterData();
  } catch (err) {
    alert('Error creating department and coordinator.');
  }
}

function openDeptManagementModal() {
  document.getElementById('deptMgmtModal').classList.add('active');
}
function closeDeptManagementModal() {
  document.getElementById('deptMgmtModal').classList.remove('active');
}

// Conditional Computers Field Toggle based on Room Type
function onRoomTypeChange() {
  const roomType = document.getElementById('roomType').value;
  const compGroup = document.getElementById('computersGroup');
  const compInput = document.getElementById('roomComputers');

  if (roomType === 'Computer Lab') {
    compGroup.style.display = 'block';
    compInput.required = true;
  } else {
    compGroup.style.display = 'none';
    compInput.required = false;
  }
}

// Add Room Modal (LOCKED to Coordinator's Department)
function openAddRoomModal() {
  const deptSel = document.getElementById('roomDept');
  if (deptSel) {
    if (currentUser && currentUser.role === 'dept_admin') {
      deptSel.innerHTML = `<option value="${currentUser.department_id}">${currentUser.department_name} (${currentUser.department_code})</option>`;
      deptSel.disabled = true;
    } else {
      deptSel.disabled = false;
      deptSel.innerHTML = masterDepartments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
    }
  }

  onRoomTypeChange();
  document.getElementById('addRoomModal').classList.add('active');
}

function closeAddRoomModal() {
  document.getElementById('addRoomModal').classList.remove('active');
}

async function handleCreateRoom(e) {
  e.preventDefault();
  const room_name = document.getElementById('roomName').value;
  const capacity = document.getElementById('roomCapacity').value;
  const room_type = document.getElementById('roomType').value;
  const projector = document.getElementById('roomProjector').value;
  
  let computers_count = 0;
  if (room_type === 'Computer Lab') {
    computers_count = document.getElementById('roomComputers').value;
  }
  
  const department_id = document.getElementById('roomDept').value || (currentUser ? currentUser.department_id : null);

  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_name, building: 'Main Academic Block', capacity, room_type, projector, computers_count, department_id })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to add room.');
      return;
    }

    closeAddRoomModal();
    await loadMasterData();
    renderRoomsManager();
  } catch (err) {
    alert('Error creating room.');
  }
}

// Live Search Input Debounce
let searchTimeout;
function handleSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    renderTimetable();
  }, 300);
}

// Add/Edit Timetable Slot Modal Handlers
function openAddSlotModal() {
  document.getElementById('slotModalTitle').innerHTML = `<i class="fa-solid fa-calendar-plus"></i> Add Timetable Schedule Slot`;
  document.getElementById('slotId').value = '';
  document.getElementById('slotForm').reset();
  document.getElementById('slotError').style.display = 'none';

  populateSlotDeptDropdown();
  document.getElementById('slotModal').classList.add('active');
}

function openEditSlotModal(entryId) {
  const entry = currentTimetableEntries.find(e => e.id === entryId);
  if (!entry) return;

  document.getElementById('slotModalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Timetable Schedule Slot`;
  document.getElementById('slotId').value = entry.id;
  document.getElementById('slotError').style.display = 'none';

  populateSlotDeptDropdown(entry.department_id);

  document.getElementById('slotDay').value = entry.day_of_week;
  document.getElementById('slotStart').value = entry.start_time;
  document.getElementById('slotEnd').value = entry.end_time;
  document.getElementById('slotSection').value = entry.section;
  document.getElementById('slotSemester').value = entry.semester;

  onSlotDeptChange(entry.course_id, entry.room_id);

  document.getElementById('slotModal').classList.add('active');
}

function closeSlotModal() {
  document.getElementById('slotModal').classList.remove('active');
}

function populateSlotDeptDropdown(selectedDeptId = null) {
  const slotDept = document.getElementById('slotDept');
  if (!slotDept) return;

  let allowedDepts = [];
  if (currentUser && currentUser.role === 'admin') {
    allowedDepts = masterDepartments;
  } else if (currentUser) {
    allowedDepts = masterDepartments.filter(d => Number(d.id) === Number(currentUser.department_id));
  } else {
    allowedDepts = masterDepartments;
  }

  slotDept.innerHTML = allowedDepts.map(d => 
    `<option value="${d.id}" ${selectedDeptId == d.id ? 'selected' : ''}>${d.name} (${d.code})</option>`
  ).join('');

  onSlotDeptChange();
}

function onSlotDeptChange(selectedCourseId = null, selectedRoomId = null) {
  const deptId = document.getElementById('slotDept').value;
  const courseSel = document.getElementById('slotCourse');
  const roomSel = document.getElementById('slotRoom');

  const filteredCourses = masterCourses.filter(c => Number(c.department_id) === Number(deptId));
  courseSel.innerHTML = filteredCourses.map(c => 
    `<option value="${c.id}" ${selectedCourseId == c.id ? 'selected' : ''}>${c.course_code} - ${c.course_name} (Sem ${c.semester})</option>`
  ).join('') || `<option value="">No courses added for this dept</option>`;

  roomSel.innerHTML = masterRooms.map(r => 
    `<option value="${r.id}" ${selectedRoomId == r.id ? 'selected' : ''}>${r.room_name} (Cap: ${r.capacity})</option>`
  ).join('');
}

// Save Schedule Slot
async function handleSaveSlot(e) {
  e.preventDefault();

  const slotId = document.getElementById('slotId').value;
  const department_id = document.getElementById('slotDept').value;
  const course_id = document.getElementById('slotCourse').value;
  const instructor_id = 1;
  const room_id = document.getElementById('slotRoom').value;
  const day_of_week = document.getElementById('slotDay').value;
  const start_time = document.getElementById('slotStart').value;
  const end_time = document.getElementById('slotEnd').value;
  const section = document.getElementById('slotSection').value.trim();
  const semester = document.getElementById('slotSemester').value;

  const errDiv = document.getElementById('slotError');
  errDiv.style.display = 'none';

  const payload = {
    department_id, course_id, instructor_id, room_id,
    day_of_week, start_time, end_time, section, semester
  };

  const isEdit = !!slotId;
  const url = isEdit ? `/api/timetable/${slotId}` : '/api/timetable';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      errDiv.innerHTML = `<strong>⚠️ Schedule Conflict Alert:</strong> ${data.error}<br><small>Modification rejected to prevent overwriting existing schedule.</small>`;
      errDiv.style.display = 'block';
      return;
    }

    closeSlotModal();
    renderTimetable();
  } catch (err) {
    errDiv.textContent = 'Failed to save slot.';
    errDiv.style.display = 'block';
  }
}

// Delete Slot Handler
async function handleDeleteSlot(id) {
  if (!confirm('Are you sure you want to delete this schedule slot?')) return;
  try {
    const res = await fetch(`/api/timetable/${id}`, { method: 'DELETE' });
    if (!res.ok) return alert('Failed to delete slot.');
    renderTimetable();
  } catch (err) {
    alert('Error deleting slot.');
  }
}

// Room Availability Lookup Modal
function openRoomFinderModal() {
  document.getElementById('roomFinderModal').classList.add('active');
}
function closeRoomFinderModal() {
  document.getElementById('roomFinderModal').classList.remove('active');
}

async function checkRoomAvailability(e) {
  e.preventDefault();
  const day = document.getElementById('rfDay').value;
  const start_time = document.getElementById('rfStart').value;
  const end_time = document.getElementById('rfEnd').value;

  const container = document.getElementById('roomFinderResults');
  container.innerHTML = `<p class="placeholder-text"><i class="fa-solid fa-spin fa-circle-notch"></i> Searching free classrooms...</p>`;

  try {
    const res = await fetch(`/api/rooms/availability?day=${day}&start_time=${start_time}&end_time=${end_time}`);
    const data = await res.json();

    if (data.available.length === 0) {
      container.innerHTML = `<div class="form-error">No rooms available at this time slot (${day} ${start_time} - ${end_time}). All rooms occupied!</div>`;
      return;
    }

    let html = `
      <div style="margin-bottom: 12px; font-weight: 600; color: var(--uet-green);">
        <i class="fa-solid fa-circle-check"></i> Found ${data.available.length} Free Rooms for ${day} (${start_time} - ${end_time}):
      </div>
      <div class="form-grid">
    `;

    data.available.forEach(r => {
      const isLab = r.room_type === 'Computer Lab';
      html += `
        <div class="slot-card" style="border-left-color: var(--uet-green);">
          <div class="course-code">${r.room_name}</div>
          <div class="course-title">${isLab ? 'Computer Lab' : 'Lecture Hall'}</div>
          <div class="slot-meta">
            <span>🪑 Seats: <strong>${r.capacity}</strong> | ${r.projector ? '📹 Proj: Yes' : 'No Proj'}</span>
            ${isLab ? `<span>💻 Computers: <strong>${r.computers_count || 40}</strong></span>` : ''}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="form-error">Failed to check room availability.</div>`;
  }
}
