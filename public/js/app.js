// UET KSK Centralized Timetable Web Application Engine

let masterDepartments = [];
let masterRooms = [];
let masterCourses = [];
let currentTimetableEntries = [];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TIME_SLOTS = [
  { start: '08:00', end: '09:00', label: '08:00 - 09:00 AM' },
  { start: '09:00', end: '10:00', label: '09:00 - 10:00 AM' },
  { start: '10:00', end: '11:00', label: '10:00 - 11:00 AM' },
  { start: '11:00', end: '12:00', label: '11:00 - 12:00 PM' },
  { start: '12:00', end: '13:00', label: '12:00 - 01:00 PM' },
  { start: '13:00', end: '14:00', label: '01:00 - 02:00 PM' },
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

// GLOBAL POPUP & MODAL CONTROLLER (With Background Body Scroll Lock)
function openModal(modalId) {
  const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (modal) {
    modal.classList.add('active');
    document.body.classList.add('modal-open');
  }
}

function closeModal(modalId) {
  const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (modal) {
    modal.classList.remove('active');
  }
  if (!document.querySelector('.modal.active')) {
    document.body.classList.remove('modal-open');
  }
}

function closeAllActiveModals() {
  document.querySelectorAll('.modal.active').forEach(modal => {
    modal.classList.remove('active');
  });
  document.body.classList.remove('modal-open');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'Esc') {
    closeAllActiveModals();
  }
});

document.addEventListener('click', (e) => {
  if (e.target && e.target.classList && e.target.classList.contains('modal') && e.target.classList.contains('active')) {
    closeAllActiveModals();
  }
});

// View Navigation Switcher
async function switchMainView(viewId, navElem) {
  document.querySelectorAll('.main-view').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  const target = document.getElementById(viewId);
  if (target) target.style.display = 'block';

  if (navElem) navElem.classList.add('active');

  if (viewId === 'viewDeptsTree') renderDeptTree();
  if (viewId === 'viewRoomsManager') renderRoomsManager();
  if (viewId === 'viewAdminCreds') renderAdminCredsTable();
  if (viewId === 'viewSettings' && typeof populateSettingsForm === 'function') populateSettingsForm();
  if (viewId === 'viewRoomRequests') {
    await fetchRoomRequests();
    renderRoomRequestsView();
  }

  closeSidebarMobile();
}

function toggleSidebar() {
  const sidebar = document.getElementById('uetSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.toggle('mobile-open');
  if (overlay) overlay.classList.toggle('active');
}

function closeSidebarMobile() {
  const sidebar = document.getElementById('uetSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (overlay) overlay.classList.remove('active');
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

    const classrooms = masterRooms.filter(r => r.room_type !== 'Computer Lab');
    const labs = masterRooms.filter(r => r.room_type === 'Computer Lab');
    const projectors = masterRooms.filter(r => r.projector === 1 || r.projector === 'Yes' || r.projector === '1');

    if (document.getElementById('statClassroomCount')) document.getElementById('statClassroomCount').textContent = classrooms.length;
    if (document.getElementById('statLabCount')) document.getElementById('statLabCount').textContent = labs.length;
    if (document.getElementById('statProjectorCount')) document.getElementById('statProjectorCount').textContent = projectors.length;

    populateFilterDropdowns();
    renderDeptTree();
    await fetchRoomRequests();
  } catch (err) {
    console.error('Error loading master data:', err);
  }
}

// Populate Filter Dropdowns
function populateFilterDropdowns() {
  const filterDept = document.getElementById('filterDept');
  if (filterDept) {
    filterDept.innerHTML = `<option value="">🏛️ All Departments (Central View)</option>` +
      masterDepartments.map(d => {
        const dRooms = masterRooms.filter(r => Number(r.department_id) === Number(d.id));
        const cCount = dRooms.filter(r => r.room_type !== 'Computer Lab').length;
        const lCount = dRooms.filter(r => r.room_type === 'Computer Lab').length;
        const pCount = dRooms.filter(r => r.projector === 1 || r.projector === 'Yes' || r.projector === '1').length;
        return `<option value="${d.id}">${d.name} (${d.code}) — Classrooms: ${cCount} | Labs: ${lCount} | Projectors: ${pCount}</option>`;
      }).join('');
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

      const cCount = roomList.filter(r => r.room_type !== 'Computer Lab').length;
      const lCount = roomList.filter(r => r.room_type === 'Computer Lab').length;
      const pCount = roomList.filter(r => r.projector === 1 || r.projector === 'Yes' || r.projector === '1').length;

      dashHtml += `
        <div class="dept-tree-node">
          <div class="dept-tree-header" onclick="toggleTreeNode('dash-node-${d.id}', this)">
            <div class="tree-toggle-btn" id="dash-btn-toggle-${d.id}">${isFirstOpen ? '-' : '+'}</div>
            <div class="dept-title"><i class="fa-solid fa-building-columns" style="color:${d.color || '#006633'}"></i> ${d.name} (${d.code})</div>
            <span class="badge bg-blue" style="color:#fff; margin-left:4px;">Classrooms: ${cCount}</span>
            <span class="badge bg-purple" style="color:#fff; margin-left:4px;">Labs: ${lCount}</span>
            <span class="badge bg-green" style="color:#fff; margin-left:4px;">📹 Projectors: ${pCount}</span>
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
                <button class="btn-icon btn-icon-primary ml-2" title="Edit Room Details" onclick="event.stopPropagation(); openEditRoomModal(${r.id})">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="btn-icon btn-icon-danger ml-1" title="Delete Room" onclick="event.stopPropagation(); handleDeleteRoom(${r.id}, '${r.room_name}')">
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

      const cCount = roomList.filter(r => r.room_type !== 'Computer Lab').length;
      const lCount = roomList.filter(r => r.room_type === 'Computer Lab').length;
      const pCount = roomList.filter(r => r.projector === 1 || r.projector === 'Yes' || r.projector === '1').length;

      mainHtml += `
        <div class="dept-tree-node">
          <div class="dept-tree-header">
            <div class="tree-toggle-btn" id="main-btn-toggle-${d.id}" onclick="toggleTreeNode('main-node-${d.id}', this.parentElement)">${isFirstOpen ? '-' : '+'}</div>
            <div class="dept-title" onclick="toggleTreeNode('main-node-${d.id}', this.parentElement)"><i class="fa-solid fa-building-columns" style="color:${d.color || '#006633'}"></i> ${d.name} (${d.code})</div>
            <span class="badge bg-blue" style="color:#fff; margin-left:4px;">Classrooms: ${cCount}</span>
            <span class="badge bg-purple" style="color:#fff; margin-left:4px;">Labs: ${lCount}</span>
            <span class="badge bg-green" style="color:#fff; margin-left:4px;">📹 Projectors: ${pCount}</span>
            
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
                <button class="btn-icon btn-icon-primary ml-2" title="Edit Room Details" onclick="event.stopPropagation(); openEditRoomModal(${r.id})">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="btn-icon btn-icon-danger ml-1" title="Delete Room" onclick="event.stopPropagation(); handleDeleteRoom(${r.id}, '${r.room_name}')">
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

      const isLunchBreak = (slot.start === '12:00' && slot.end === '13:00');
      const isJummahBreak = (slot.start === '13:00' && slot.end === '14:00' && day === 'Friday');

      if (isLunchBreak) {
        html += `
          <div class="break-card lunch-break">
            <i class="fa-solid fa-utensils"></i>
            <span class="break-title">Lunch Break</span>
            <span class="break-time">12:00 - 01:00 PM</span>
          </div>
        `;
      } else if (isJummahBreak) {
        html += `
          <div class="break-card jummah-break">
            <i class="fa-solid fa-mosque"></i>
            <span class="break-title">Jummah Break</span>
            <span class="break-time">01:00 - 02:00 PM</span>
          </div>
        `;
      } else if (matching.length > 0) {
        matching.forEach(entry => {
          const canEdit = canUserEditDept(entry.department_id);
          const canDelete = canUserDeleteSlot(entry);
          const isLab = entry.room_type === 'Computer Lab';
          const projBadge = entry.room_projector ? '📹 Proj: Yes' : 'No Proj';
          const compBadge = isLab ? ` | 💻 ${entry.room_computers || 40} PCs` : '';

          html += `
            <div class="slot-card" style="border-left-color: ${entry.department_color || '#006633'};">
              <div class="slot-card-header">
                <span class="dept-pill" style="background: ${entry.department_color || '#006633'}">${entry.department_code}</span>
                <span class="sem-badge">Sem ${formatSemSec(entry.semester, entry.section)}</span>
              </div>
              <div class="course-title">${entry.course_name}</div>
              
              <div class="slot-meta">
                <span><i class="fa-solid fa-door-closed"></i> <strong>${entry.room_name}</strong> (${isLab ? 'Lab' : 'Lecture'})</span>
                <span class="room-spec-pill">🪑 ${entry.room_capacity || 50} Seats | ${projBadge}${compBadge}</span>
              </div>

              ${(canEdit || canDelete) ? `
                <div class="slot-actions no-print">
                  ${canEdit ? `
                    <button class="btn-icon" title="Edit Slot" onclick="openEditSlotModal(${entry.id})">
                      <i class="fa-solid fa-pen"></i>
                    </button>
                  ` : ''}
                  ${canDelete ? `
                    <button class="btn-icon btn-icon-danger" title="Delete Slot" onclick="handleDeleteSlot(${entry.id})">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  ` : ''}
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

// DOWNLOAD SAMPLE EXCEL TIMETABLE PATTERN TEMPLATE (.xlsx)
function downloadExcelTemplate() {
  if (typeof XLSX !== 'undefined') {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Room Specs
    const roomSpecsData = [
      ["Room No.", "No. of Chairs", "Projector (Yes or No)", "No. of Computers"],
      ["G-10", 50, "Yes", 0],
      ["G-11", 50, "No", 0],
      ["F-04", 60, "Yes", 0],
      ["Labs", "", "", ""],
      ["G-05", 40, "Yes", 40],
      ["G-16", 40, "Yes", 40]
    ];
    const roomSpecsSheet = XLSX.utils.aoa_to_sheet(roomSpecsData);
    XLSX.utils.book_append_sheet(wb, roomSpecsSheet, "Room Specs");

    // Sheet 2: Matrix for G-10 (Lecture Hall)
    const g10Data = [
      ["Day / Time", "8-9 AM", "9-10 AM", "10-11 AM", "11-12 AM", "12-1 PM (Break)", "1-2 PM", "2-3 PM", "3-4 PM"],
      ["Monday", "Programming Fundamentals | Sem 1-A", 0, "Digital Logic Design | Sem 1-A", 0, "Lunch Break", "Linear Algebra | Sem 1-A", 0, 0],
      ["Tuesday", 0, "Data Structures | Sem 3-A", 0, "Object Oriented Prog | Sem 3-A", 0, "Circuit Analysis | Sem 3-A", 0, 0],
      ["Wednesday", "Database Systems | Sem 5-A", 0, "Operating Systems | Sem 5-A", 0, "Lunch Break", "Computer Networks | Sem 5-A", 0, 0],
      ["Thursday", 0, "Software Engineering | Sem 7-A", 0, "Artificial Intelligence | Sem 7-A", 0, "Compiler Construction | Sem 7-A", 0, 0],
      ["Friday", "Programming Fundamentals | Sem 1-B", 0, 0, 0, "Programming Fundamentals | Sem 1-B", "Jummah Break", 0, 0]
    ];
    const g10Sheet = XLSX.utils.aoa_to_sheet(g10Data);
    XLSX.utils.book_append_sheet(wb, g10Sheet, "G-10");

    // Sheet 3: Matrix for G-05 (Computer Lab)
    const g05Data = [
      ["Day / Time", "8-9 AM", "9-10 AM", "10-11 AM", "11-12 AM", "12-1 PM (Break)", "1-2 PM", "2-3 PM", "3-4 PM"],
      ["Monday", "Programming Fundamentals Lab | Sem 1-A", "Programming Fundamentals Lab | Sem 1-A", 0, 0, "Lunch Break", "Data Structures Lab | Sem 3-A", "Data Structures Lab | Sem 3-A", 0],
      ["Tuesday", 0, 0, "Database Systems Lab | Sem 5-A", "Database Systems Lab | Sem 5-A", 0, 0, 0, 0],
      ["Wednesday", "Programming Fundamentals Lab | Sem 1-B", "Programming Fundamentals Lab | Sem 1-B", 0, 0, "Lunch Break", 0, 0, 0],
      ["Thursday", 0, 0, "Artificial Intelligence Lab | Sem 7-A", "Artificial Intelligence Lab | Sem 7-A", 0, 0, 0, 0],
      ["Friday", 0, 0, 0, 0, 0, "Jummah Break", 0, 0]
    ];
    const g05Sheet = XLSX.utils.aoa_to_sheet(g05Data);
    XLSX.utils.book_append_sheet(wb, g05Sheet, "G-05");

    // Sheet 4: Pattern Guide
    const guideData = [
      ["UET KSK Timetable Excel Pattern Guide"],
      [""],
      ["Sheet 1: Room Specifications (First Sheet)"],
      ["- Column 1: Room No (e.g. G-10, G-11, F-04, G-05)"],
      ["- Column 2: No. of Chairs (e.g. 50, 60, 40)"],
      ["- Column 3: Projector Available ('Yes' or 'No')"],
      ["- Column 4: No. of Computers (For Labs, e.g. 40; for lecture halls set 0 or leave blank)"],
      ["- Note: Use 'Labs' in Column 1 to start the computer labs section."],
      [""],
      ["Sheets 2+: Room Timetable Matrix (One sheet per room name, e.g. 'G-10', 'G-05')"],
      ["- Header Row (Row 1): 'Day / Time', '8-9 AM', '9-10 AM', '10-11 AM', '11-12 AM', '12-1 PM', '1-2 PM', '2-3 PM', '3-4 PM'"],
      ["- Column 1 (Days): Monday, Tuesday, Wednesday, Thursday, Friday"],
      ["- Cell Format: Enter lecture details in cell format: Course Name | Sem [Semester]-[Section]"],
      ["  Example 1: Programming Fundamentals | Sem 1-A"],
      ["  Example 2: Data Structures | Sem 3-B"],
      ["- (Note: Enter 1 or 'Yes' if you want default course & section assigned)"],
      [""],
      ["After filling out this template, upload the file in the UET KSK Timetable Portal!"]
    ];
    const guideSheet = XLSX.utils.aoa_to_sheet(guideData);
    XLSX.utils.book_append_sheet(wb, guideSheet, "Pattern Guide");

    XLSX.writeFile(wb, "UET_KSK_Timetable_Pattern_Template.xlsx");
  } else {
    window.location.href = '/api/upload/template';
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
          <div class="mt-3 pt-2 border-top d-flex gap-2">
            <button class="btn btn-primary btn-sm" onclick="openEditRoomModal(${r.id})">
              <i class="fa-solid fa-pen-to-square"></i> Edit Room
            </button>
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
  openModal('deptMgmtModal');
}
function closeDeptManagementModal() {
  closeModal('deptMgmtModal');
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
  const modalTitle = document.getElementById('addRoomModalTitle');
  const submitBtn = document.getElementById('addRoomSubmitBtn');
  const editIdInput = document.getElementById('editRoomId');

  if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid fa-door-plus"></i> Add New Room / Lab`;
  if (submitBtn) submitBtn.textContent = 'Add Room';
  if (editIdInput) editIdInput.value = '';

  const form = document.getElementById('addRoomForm');
  if (form) form.reset();

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
  openModal('addRoomModal');
}

function openEditRoomModal(roomId) {
  const room = masterRooms.find(r => Number(r.id) === Number(roomId));
  if (!room) return;

  const modalTitle = document.getElementById('addRoomModalTitle');
  const submitBtn = document.getElementById('addRoomSubmitBtn');
  const editIdInput = document.getElementById('editRoomId');

  if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Room / Lab Details`;
  if (submitBtn) submitBtn.textContent = 'Update Room Details';
  if (editIdInput) editIdInput.value = room.id;

  const deptSel = document.getElementById('roomDept');
  if (deptSel) {
    if (currentUser && currentUser.role === 'dept_admin') {
      deptSel.innerHTML = `<option value="${currentUser.department_id}">${currentUser.department_name} (${currentUser.department_code})</option>`;
      deptSel.disabled = true;
    } else {
      deptSel.disabled = false;
      deptSel.innerHTML = masterDepartments.map(d => `<option value="${d.id}" ${d.id == room.department_id ? 'selected' : ''}>${d.name} (${d.code})</option>`).join('');
    }
  }

  document.getElementById('roomName').value = room.room_name;
  document.getElementById('roomCapacity').value = room.capacity || room.chairs_count || 50;
  document.getElementById('roomType').value = room.room_type || 'Lecture Hall';
  document.getElementById('roomProjector').value = room.projector ? '1' : '0';
  document.getElementById('roomComputers').value = room.computers_count || 40;

  onRoomTypeChange();
  openModal('addRoomModal');
}

function closeAddRoomModal() {
  closeModal('addRoomModal');
}

async function handleCreateRoom(e) {
  e.preventDefault();
  const roomId = document.getElementById('editRoomId').value;
  const room_name = document.getElementById('roomName').value.trim();
  const capacity = document.getElementById('roomCapacity').value;
  const room_type = document.getElementById('roomType').value;
  const projector = document.getElementById('roomProjector').value;
  
  let computers_count = 0;
  if (room_type === 'Computer Lab') {
    computers_count = document.getElementById('roomComputers').value;
  }
  
  const department_id = document.getElementById('roomDept').value || (currentUser ? currentUser.department_id : null);

  const url = roomId ? `/api/rooms/${roomId}` : '/api/rooms';
  const method = roomId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_name, building: 'Main Academic Block', capacity, room_type, projector, computers_count, department_id })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to save room.');
      return;
    }

    closeAddRoomModal();
    await loadMasterData();
    renderRoomsManager();
    renderDeptTree();
  } catch (err) {
    alert('Error saving room.');
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
  document.getElementById('slotCourse').value = '';
  document.getElementById('slotError').style.display = 'none';

  populateSlotDeptDropdown();
  openModal('slotModal');
}

function openEditSlotModal(entryId) {
  const entry = currentTimetableEntries.find(e => e.id === entryId);
  if (!entry) return;

  document.getElementById('slotModalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Timetable Schedule Slot`;
  document.getElementById('slotId').value = entry.id;
  document.getElementById('slotError').style.display = 'none';

  populateSlotDeptDropdown(entry.department_id);

  document.getElementById('slotCourse').value = entry.course_name || '';
  document.getElementById('slotDay').value = entry.day_of_week;
  document.getElementById('slotStart').value = entry.start_time;
  document.getElementById('slotEnd').value = entry.end_time;
  document.getElementById('slotSection').value = entry.section || 'A';
  document.getElementById('slotSemester').value = entry.semester;

  onSlotDeptChange(entry.course_id, entry.room_id);

  openModal('slotModal');
}

function closeSlotModal() {
  closeModal('slotModal');
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

function formatSemSec(semester, section) {
  if (!section) return `${semester || 1}-A`;
  let cleanSec = String(section).trim();

  if (cleanSec.toLowerCase().startsWith('sem')) {
    return cleanSec.replace(/^sem\s*/i, '');
  }

  cleanSec = cleanSec.replace(/^(CS|EE|ME|CE|MGT|IT|SE)-?/i, '').trim();

  if (cleanSec.startsWith(`${semester}-`)) {
    return cleanSec;
  }
  if (cleanSec.startsWith(`${semester}`)) {
    const rest = cleanSec.substring(String(semester).length).replace(/^-/, '').trim();
    return `${semester}-${rest || 'A'}`;
  }

  return `${semester}-${cleanSec}`;
}

function onSlotDeptChange(selectedCourseId = null, selectedRoomId = null) {
  const deptId = document.getElementById('slotDept').value;
  const courseDatalist = document.getElementById('slotCourseDatalist');
  const roomSel = document.getElementById('slotRoom');

  const filteredCourses = masterCourses.filter(c => Number(c.department_id) === Number(deptId));
  
  if (courseDatalist) {
    courseDatalist.innerHTML = filteredCourses.map(c => 
      `<option value="${c.course_name}">Semester ${c.semester}</option>`
    ).join('');
  }

  if (selectedCourseId) {
    const matched = filteredCourses.find(c => Number(c.id) === Number(selectedCourseId));
    if (matched) {
      document.getElementById('slotCourse').value = matched.course_name;
    }
  }

  roomSel.innerHTML = masterRooms.map(r => {
    const isMine = currentUser && (currentUser.role === 'admin' || Number(r.department_id) === Number(currentUser.department_id));
    const labelSuffix = isMine ? '' : ` [Owned by ${r.department_name}]`;
    return `<option value="${r.id}" ${selectedRoomId == r.id ? 'selected' : ''}>${r.room_name} (Cap: ${r.capacity})${labelSuffix}</option>`;
  }).join('');

  onSlotRoomChange();
}

function onSlotRoomChange() {
  const roomId = Number(document.getElementById('slotRoom').value);
  const noticeEl = document.getElementById('slotRoomNotice');
  if (!noticeEl || !roomId) return;

  const room = masterRooms.find(r => Number(r.id) === roomId);
  const isMine = currentUser && (currentUser.role === 'admin' || (room && Number(room.department_id) === Number(currentUser.department_id)));

  if (room && !isMine) {
    noticeEl.style.display = 'block';
    noticeEl.className = 'p-2 bg-purple text-white rounded text-sm mt-1';
    noticeEl.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <strong>Cross-Dept Request:</strong> This room belongs to <strong>${room.department_name}</strong>. Submitting will send a Room Allocation Request to them for approval.`;
  } else {
    noticeEl.style.display = 'none';
  }
}

// Save Schedule Slot
async function handleSaveSlot(e) {
  e.preventDefault();

  const slotId = document.getElementById('slotId').value;
  const department_id = document.getElementById('slotDept').value;
  const course_input = document.getElementById('slotCourse').value.trim();
  const instructor_id = 1;
  const room_id = document.getElementById('slotRoom').value;
  const day_of_week = document.getElementById('slotDay').value;
  const start_time = document.getElementById('slotStart').value;
  const end_time = document.getElementById('slotEnd').value;
  const section = document.getElementById('slotSection').value.trim();
  const semester = document.getElementById('slotSemester').value;

  const errDiv = document.getElementById('slotError');
  errDiv.style.display = 'none';

  if (!course_input) {
    errDiv.innerHTML = `<strong>⚠️ Missing Course:</strong> Please select or type a course code/name.`;
    errDiv.style.display = 'block';
    return;
  }

  // Mandatory Time Constraints Validation (University hours: 07:30 AM to 04:00 PM)
  if (start_time < "07:30") {
    errDiv.innerHTML = `<strong>⚠️ Time Constraint Violation:</strong> Classes cannot start earlier than 07:30 AM (University Opening Time).`;
    errDiv.style.display = 'block';
    return;
  }

  if (end_time > "16:00") {
    errDiv.innerHTML = `<strong>⚠️ Time Constraint Violation:</strong> Classes cannot end later than 04:00 PM / 16:00 (University Closing Time).`;
    errDiv.style.display = 'block';
    return;
  }

  if (end_time <= start_time) {
    errDiv.innerHTML = `<strong>⚠️ Time Constraint Violation:</strong> End time (${end_time}) must be higher than Start time (${start_time}).`;
    errDiv.style.display = 'block';
    return;
  }

  // Weekend constraint check
  if (day_of_week === 'Saturday' || day_of_week === 'Sunday') {
    errDiv.innerHTML = `<strong>⚠️ Holiday Constraint Violation:</strong> Saturday and Sunday are university holidays. Classes can only be scheduled Monday through Friday.`;
    errDiv.style.display = 'block';
    return;
  }

  // Lunch Break check (12:00 to 13:00 on Mon-Fri)
  if (start_time < '13:00' && end_time > '12:00') {
    errDiv.innerHTML = `<strong>⚠️ Break Time Conflict:</strong> 12:00 PM to 01:00 PM is Lunch / Recess Break. Classes cannot be scheduled during this break.`;
    errDiv.style.display = 'block';
    return;
  }

  // Friday Jummah Break check (13:00 to 14:00)
  if (day_of_week === 'Friday' && start_time < '14:00' && end_time > '13:00') {
    errDiv.innerHTML = `<strong>⚠️ Break Time Conflict:</strong> 01:00 PM to 02:00 PM is Jummah Prayer Break on Friday. Classes cannot be scheduled during this break.`;
    errDiv.style.display = 'block';
    return;
  }

  const payload = {
    department_id,
    course_input,
    instructor_id,
    room_id,
    day_of_week,
    start_time,
    end_time,
    section,
    semester
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
      errDiv.innerHTML = `<strong>⚠️ Schedule Conflict / Validation Error:</strong> ${data.error}<br><small>Modification rejected to prevent overwriting existing schedule or breaking time rules.</small>`;
      errDiv.style.display = 'block';
      return;
    }

    if (res.status === 202 || data.isRequest) {
      alert(`📩 ROOM REQUEST SUBMITTED:\n\n${data.message}`);
      closeSlotModal();
      switchRequestTab('outgoing');
      await switchMainView('viewRoomRequests', document.getElementById('navRequests'));
      await loadMasterData();
      return;
    }

    closeSlotModal();
    await loadMasterData();
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
  openModal('roomFinderModal');
}
function closeRoomFinderModal() {
  closeModal('roomFinderModal');
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

// CROSS-DEPARTMENT ROOM REQUEST MANAGER
let roomRequests = [];
let activeRequestTab = 'incoming';

async function fetchRoomRequests() {
  try {
    const res = await fetch('/api/requests');
    if (res.ok) {
      roomRequests = await res.json();
    } else {
      roomRequests = [];
    }
  } catch (err) {
    roomRequests = [];
  }
  updateRequestBadgeCounters();
}

function updateRequestBadgeCounters() {
  if (!currentUser) return;
  const myDeptId = Number(currentUser.department_id);
  const isSuperAdmin = currentUser.role === 'admin';

  const incomingPending = roomRequests.filter(r => 
    (isSuperAdmin || Number(r.owning_department_id) === myDeptId) && r.status === 'pending'
  ).length;

  const outgoingCount = roomRequests.filter(r => 
    Number(r.requesting_department_id) === myDeptId
  ).length;

  const totalCount = roomRequests.length;

  const badgeEl = document.getElementById('pendingRequestsBadge');
  if (badgeEl) {
    if (incomingPending > 0) {
      badgeEl.style.display = 'inline-block';
      badgeEl.textContent = incomingPending;
    } else {
      badgeEl.style.display = 'none';
    }
  }

  const tabInBadge = document.getElementById('tabIncomingBadge');
  if (tabInBadge) tabInBadge.textContent = incomingPending;

  const tabOutBadge = document.getElementById('tabOutgoingBadge');
  if (tabOutBadge) tabOutBadge.textContent = outgoingCount;

  const tabAllBadge = document.getElementById('tabAllBadge');
  if (tabAllBadge) tabAllBadge.textContent = totalCount;
}

function switchRequestTab(tabName) {
  activeRequestTab = tabName;
  const btnIn = document.getElementById('tabIncomingReqs');
  const btnOut = document.getElementById('tabOutgoingReqs');
  const btnAll = document.getElementById('tabAllReqs');

  [btnIn, btnOut, btnAll].forEach(b => {
    if (b) b.classList.remove('active');
  });

  if (tabName === 'incoming' && btnIn) btnIn.classList.add('active');
  else if (tabName === 'outgoing' && btnOut) btnOut.classList.add('active');
  else if (tabName === 'all' && btnAll) btnAll.classList.add('active');

  renderRoomRequestsView();
}

function renderRoomRequestsView() {
  const container = document.getElementById('roomRequestsListContainer');
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = `<div class="form-error">Please login to view room requests.</div>`;
    return;
  }

  const myDeptId = Number(currentUser.department_id);
  const isSuperAdmin = currentUser.role === 'admin';

  const incomingReqs = roomRequests.filter(r => isSuperAdmin || Number(r.owning_department_id) === myDeptId);
  const outgoingReqs = roomRequests.filter(r => Number(r.requesting_department_id) === myDeptId);

  let filtered = [];
  if (activeRequestTab === 'incoming') {
    filtered = incomingReqs;
  } else if (activeRequestTab === 'outgoing') {
    filtered = outgoingReqs;
  } else {
    filtered = roomRequests;
  }

  if (filtered.length === 0) {
    let emptyTitle = 'No Incoming Room Requests';
    let emptyMsg = 'There are currently no room allocation requests for your department\'s rooms.';
    if (activeRequestTab === 'outgoing') {
      emptyTitle = 'No Sent Room Requests';
      emptyMsg = 'You have not submitted any room allocation requests to other departments.';
    } else if (activeRequestTab === 'all') {
      emptyTitle = 'No Room Requests Found';
      emptyMsg = 'There are no active or past room requests in the system.';
    }

    container.innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 40px;">
        <i class="fa-solid fa-inbox" style="font-size: 2.5rem; color: var(--uet-green);"></i>
        <h3 class="mt-2">${emptyTitle}</h3>
        <p class="text-muted">${emptyMsg}</p>
      </div>
    `;
    return;
  }

  let html = `<div class="form-grid">`;

  filtered.forEach(req => {
    const isIncoming = Number(req.owning_department_id) === myDeptId || isSuperAdmin;
    let statusBadge = '';
    if (req.status === 'pending') {
      statusBadge = `<span class="badge bg-purple"><i class="fa-solid fa-clock"></i> Pending Approval</span>`;
    } else if (req.status === 'approved') {
      statusBadge = `<span class="badge bg-green"><i class="fa-solid fa-circle-check"></i> Approved & Allocated</span>`;
    } else {
      statusBadge = `<span class="badge bg-red"><i class="fa-solid fa-circle-xmark"></i> Rejected</span>`;
    }

    html += `
      <div class="card glass-card p-4" style="border-left: 4px solid ${req.requesting_department_color || '#006633'};">
        <div class="d-flex justify-between items-center mb-2">
          <span class="badge" style="background:${req.requesting_department_color || '#006633'}; color:#fff;">
            Request from ${req.requesting_department_code || 'DEPT'}
          </span>
          ${statusBadge}
        </div>

        <h4 style="margin: 4px 0; color: var(--uet-gold);">
          <i class="fa-solid fa-door-open"></i> ${req.room_name} (${req.owning_department_name || 'Owner Dept'})
        </h4>

        <div style="font-size: 0.9rem; color: #fff; font-weight: 600; margin-bottom: 6px;">
          📚 ${req.course_code} - ${req.course_name}
        </div>

        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">
          📅 <strong>${req.day_of_week}</strong> (${req.start_time} - ${req.end_time}) | Section: <strong>${req.section}</strong> | Sem: <strong>${req.semester}</strong>
        </div>

        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">
          🏛️ Requesting Dept: <strong>${req.requesting_department_name}</strong>
          <br>🏛️ Owning Dept: <strong>${req.owning_department_name}</strong>
          ${req.notes ? `<br>💬 Notes: <em>"${req.notes}"</em>` : ''}
        </div>

        <div class="d-flex gap-2 border-t pt-3 align-items-center">
          ${(isIncoming && req.status === 'pending') ? `
            <button class="btn btn-success btn-sm flex-1" onclick="handleApproveRequest(${req.id})">
              <i class="fa-solid fa-check"></i> Approve & Allocate
            </button>
            <button class="btn btn-danger btn-sm" onclick="handleRejectRequest(${req.id})">
              <i class="fa-solid fa-xmark"></i> Reject
            </button>
          ` : ''}
          <button class="btn btn-outline btn-sm text-danger" title="Delete Request Record" onclick="handleDeleteRequest(${req.id})">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function openRoomRequestModal(preselectRoomId = null) {
  if (!currentUser) {
    alert('Please login to request a room.');
    return;
  }

  const myDeptId = Number(currentUser.department_id);
  const roomSelect = document.getElementById('reqRoom');
  roomSelect.innerHTML = '';

  const otherRooms = masterRooms.filter(r => Number(r.department_id) !== myDeptId);

  if (otherRooms.length === 0) {
    alert('No rooms belonging to other departments are available to request.');
    return;
  }

  otherRooms.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `${r.room_name} - ${r.department_name} (${r.room_type}, ${r.capacity} seats)`;
    if (preselectRoomId && Number(r.id) === Number(preselectRoomId)) {
      opt.selected = true;
    }
    roomSelect.appendChild(opt);
  });

  document.getElementById('reqCourseCode').value = `${currentUser.department_code || 'CS'}-101`;
  document.getElementById('reqCourseName').value = 'Guest Department Lecture';
  document.getElementById('reqSection').value = `${currentUser.department_code || 'CS'}-1A`;
  document.getElementById('reqSemester').value = '1';
  document.getElementById('reqNotes').value = '';
  document.getElementById('reqError').style.display = 'none';

  checkRequestRoomVacancy();

  openModal('roomRequestModal');
}

function closeRoomRequestModal() {
  closeModal('roomRequestModal');
}

function checkRequestRoomVacancy() {
  const roomId = Number(document.getElementById('reqRoom').value);
  const day = document.getElementById('reqDay').value;
  const start = document.getElementById('reqStart').value;
  const end = document.getElementById('reqEnd').value;
  const statusDiv = document.getElementById('reqVacancyStatus');
  const btnSubmit = document.getElementById('btnSubmitReq');

  if (!roomId || !day || !start || !end) return;

  const targetRoom = masterRooms.find(r => r.id === roomId);
  const roomName = targetRoom ? targetRoom.room_name : 'Room';

  const conflict = timetableEntries.find(e => 
    Number(e.room_id) === roomId &&
    e.day_of_week === day &&
    (e.start_time < end && e.end_time > start)
  );

  if (conflict) {
    statusDiv.innerHTML = `
      <div class="form-error" style="display:block;">
        ❌ <strong>Room Busy:</strong> "${roomName}" is ALREADY OCCUPIED on ${day} (${start} - ${end}) by ${conflict.course_code} (${conflict.section}). Requests can only be submitted for vacant time slots.
      </div>
    `;
    btnSubmit.disabled = true;
    btnSubmit.style.opacity = '0.5';
  } else {
    statusDiv.innerHTML = `
      <div class="p-2 bg-green text-white rounded" style="font-size: 0.85rem;">
        ✓ <strong>Room Free:</strong> "${roomName}" is 100% VACANT on ${day} (${start} - ${end}). You can submit your request!
      </div>
    `;
    btnSubmit.disabled = false;
    btnSubmit.style.opacity = '1';
  }
}

async function handleCreateRoomRequest(e) {
  e.preventDefault();
  const errorDiv = document.getElementById('reqError');
  errorDiv.style.display = 'none';

  const room_id = document.getElementById('reqRoom').value;
  const day_of_week = document.getElementById('reqDay').value;
  const start_time = document.getElementById('reqStart').value;
  const end_time = document.getElementById('reqEnd').value;
  const course_code = document.getElementById('reqCourseCode').value;
  const course_name = document.getElementById('reqCourseName').value;
  const section = document.getElementById('reqSection').value;
  const semester = document.getElementById('reqSemester').value;
  const notes = document.getElementById('reqNotes').value;

  try {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id,
        day_of_week,
        start_time,
        end_time,
        course_code,
        course_name,
        section,
        semester,
        notes
      })
    });

    const data = await res.json();

    if (!res.ok) {
      errorDiv.textContent = data.error || 'Failed to submit room request.';
      errorDiv.style.display = 'block';
      return;
    }

    alert(data.message);
    closeRoomRequestModal();

    switchRequestTab('outgoing');
    await switchMainView('viewRoomRequests', document.getElementById('navRequests'));
  } catch (err) {
    errorDiv.textContent = 'Server error submitting room request.';
    errorDiv.style.display = 'block';
  }
}

async function handleApproveRequest(requestId) {
  if (!confirm('Approve this request and allocate this room for the specified time slot?')) return;

  try {
    const res = await fetch(`/api/requests/${requestId}/approve`, {
      method: 'POST'
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Failed to approve request.');
      return;
    }

    alert(data.message);
    await loadMasterData();
    await fetchRoomRequests();
    renderRoomRequestsView();
    renderTimetable();
  } catch (err) {
    alert('Server error approving request.');
  }
}

async function handleRejectRequest(requestId) {
  if (!confirm('Are you sure you want to reject this room request?')) return;

  try {
    const res = await fetch(`/api/requests/${requestId}/reject`, {
      method: 'POST'
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Failed to reject request.');
      return;
    }

    alert(data.message);
    await fetchRoomRequests();
    renderRoomRequestsView();
  } catch (err) {
    alert('Server error rejecting request.');
  }
}

async function handleDeleteRequest(requestId) {
  if (!confirm('Are you sure you want to delete/cancel this room request?')) return;

  try {
    const res = await fetch(`/api/requests/${requestId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to delete request.');
      return;
    }
    alert(data.message);
    await loadMasterData();
    await fetchRoomRequests();
    renderRoomRequestsView();
    renderTimetable();
  } catch (err) {
    alert('Server error deleting request.');
  }
}
