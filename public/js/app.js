// UET KSK Centralized Timetable Web Application Engine

let masterDepartments = [];
let masterRooms = [];
let masterCourses = [];
let masterInstructors = [];
let currentTimetableEntries = [];

// Chart.js handles
let chartDeptResourcesInstance = null;
let chartDeptUtilizationInstance = null;
let chartFacultyRanksInstance = null;
let chartRoomTypesInstance = null;
let chartSharedVsIndependentInstance = null;
let chartInterDeptSupportInstance = null;

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
  // Super Admin Access Control Guard: Do NOT allow Super Admin to access viewDashboard
  if (currentUser && currentUser.role === 'admin' && viewId === 'viewDashboard') {
    viewId = 'viewDeptsTree';
    navElem = document.getElementById('navDepts');
  }

  document.querySelectorAll('.main-view').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('active');
  });
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  const target = document.getElementById(viewId);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
  }

  if (navElem) navElem.classList.add('active');

  const pageHeader = document.getElementById('pageHeaderTitle');
  if (pageHeader) {
    if (viewId === 'viewDashboard') pageHeader.innerHTML = '<i class="fa-solid fa-chart-line" style="color:var(--uet-green); margin-right:6px;"></i> Resource Utilization';
    else if (viewId === 'viewDeptsTree') pageHeader.innerHTML = '<i class="fa-solid fa-building-columns" style="color:var(--uet-green); margin-right:8px;"></i> Department Hierarchy';
    else if (viewId === 'viewTimetable') pageHeader.innerHTML = '<i class="fa-solid fa-calendar-days" style="color:var(--uet-green); margin-right:8px;"></i> Centralized Timetable';
    else if (viewId === 'viewExcelImport') pageHeader.innerHTML = '<i class="fa-solid fa-file-excel" style="color:var(--uet-green); margin-right:8px;"></i> Room View Importer';
    else if (viewId === 'viewRoomsManager') pageHeader.innerHTML = '<i class="fa-solid fa-door-open" style="color:var(--uet-green); margin-right:8px;"></i> Rooms & Labs Manager';
    else if (viewId === 'viewRoomRequests') pageHeader.innerHTML = '<i class="fa-solid fa-paper-plane" style="color:var(--uet-green); margin-right:8px;"></i> Room Requests Portal';
    else if (viewId === 'viewAdminCreds') pageHeader.innerHTML = '<i class="fa-solid fa-user-shield" style="color:var(--uet-green); margin-right:8px;"></i> Coordinator Management';
    else if (viewId === 'viewSettings') pageHeader.innerHTML = '<i class="fa-solid fa-gear" style="color:var(--uet-green); margin-right:8px;"></i> Account Settings';
  }

  if (viewId === 'viewDashboard') renderCampusResourceUtilization();
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

// Campus Resource Utilization Sub-Tab Navigation Switcher
function switchDashboardTab(tabId, elem) {
  const pills = document.querySelectorAll('.subnav-pill');
  pills.forEach(p => p.classList.remove('active'));

  if (elem) {
    elem.classList.add('active');
  }

  const panels = document.querySelectorAll('.dash-tab-panel');
  if (tabId === 'all') {
    panels.forEach(panel => {
      panel.style.display = 'block';
      panel.classList.add('active');
    });
  } else {
    panels.forEach(panel => {
      panel.style.display = 'none';
      panel.classList.remove('active');
    });
    const panelName = 'panel' + tabId.charAt(0).toUpperCase() + tabId.slice(1);
    const targetPanel = document.getElementById(panelName);
    if (targetPanel) {
      targetPanel.style.display = 'block';
      targetPanel.classList.add('active');
    }
  }

  // Re-trigger chart rendering/resize for animated charts across any sub-tab view
  setTimeout(() => {
    renderResourceCharts();
  }, 50);
}

function toggleSidebar() {
  const sidebar = document.getElementById('uetSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (window.innerWidth <= 992) {
    if (sidebar) sidebar.classList.toggle('mobile-open');
    if (overlay) overlay.classList.toggle('active');
  } else {
    if (sidebar) sidebar.classList.toggle('collapsed');
  }
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
    const [deptRes, roomRes, courseRes, instRes, ttRes] = await Promise.all([
      fetch('/api/departments'),
      fetch('/api/rooms'),
      fetch('/api/courses'),
      fetch('/api/instructors'),
      fetch('/api/timetable')
    ]);

    masterDepartments = await deptRes.json();
    masterRooms = await roomRes.json();
    masterCourses = await courseRes.json();
    masterInstructors = await instRes.json();
    currentTimetableEntries = await ttRes.json();

    populateFilterDropdowns();
    renderDeptTree();
    await fetchRoomRequests();
    renderCampusResourceUtilization();
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

  const facultyDeptFilter = document.getElementById('facultyDeptFilter');
  if (facultyDeptFilter) {
    facultyDeptFilter.innerHTML = `<option value="">All Departments</option>` +
      masterDepartments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
  }

  const deptDatalist = document.getElementById('departmentsDatalist');
  if (deptDatalist) {
    deptDatalist.innerHTML = `<option value="All Departments"></option>` + 
      masterDepartments.map(d => `<option value="${d.name} (${d.code})"></option>`).join('');
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
            <div class="tree-toggle-btn" id="dash-btn-toggle-${d.id}">-</div>
            <div class="dept-title"><i class="fa-solid fa-building-columns" style="color:${d.color || '#006633'}"></i> ${d.name} (${d.code})</div>
            <span class="badge bg-blue" style="color:#fff; margin-left:4px;">Classrooms: ${cCount}</span>
            <span class="badge bg-purple" style="color:#fff; margin-left:4px;">Labs: ${lCount}</span>
            <span class="badge bg-green" style="color:#fff; margin-left:4px;">📹 Projectors: ${pCount}</span>
          </div>

          <div class="dept-tree-children" id="dash-node-${d.id}" style="display: flex;">
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
            <div class="tree-toggle-btn" id="main-btn-toggle-${d.id}" onclick="toggleTreeNode('main-node-${d.id}', this.parentElement)">-</div>
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

          <div class="dept-tree-children" id="main-node-${d.id}" style="display: flex;">
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

    if (activeTimetableMode === 'blocks') {
      renderBlockHeatmapGrid(currentTimetableEntries, dayFilter);
    } else {
      renderWeeklyMatrix(currentTimetableEntries, dayFilter);
    }
  } catch (err) {
    gridWrapper.innerHTML = `<div class="form-error">Failed to load timetable data.</div>`;
  }
}

// Timetable View Mode Switcher Global Handler
let activeTimetableMode = 'standard';

function toggleTimetableMode() {
  activeTimetableMode = (activeTimetableMode === 'standard') ? 'blocks' : 'standard';
  updateTimetableModeButtonUI();
  renderTimetable();
}

function switchTimetableMode(mode) {
  activeTimetableMode = mode;
  updateTimetableModeButtonUI();
  renderTimetable();
}

function updateTimetableModeButtonUI() {
  const toggleBtn = document.getElementById('btnToggleTimetableMode');
  const legendBar = document.getElementById('blockModeLegend');

  if (toggleBtn) {
    if (activeTimetableMode === 'standard') {
      toggleBtn.innerHTML = `<i class="fa-solid fa-grip-vertical"></i> Switch to Block Heatmap View`;
      toggleBtn.className = 'btn btn-sm btn-outline';
    } else {
      toggleBtn.innerHTML = `<i class="fa-solid fa-table-cells"></i> Switch to Standard Table View`;
      toggleBtn.className = 'btn btn-sm btn-primary';
    }
  }

  if (legendBar) {
    legendBar.style.setProperty('display', activeTimetableMode === 'blocks' ? 'flex' : 'none', 'important');
  }
}

// Render Block Heatmap Grid View Mode (Exact Time Ranges & Enlarged Blocks)
function renderBlockHeatmapGrid(entries, selectedDay) {
  const gridWrapper = document.getElementById('gridWrapper');
  if (!gridWrapper) return;

  const daysToRender = selectedDay ? [selectedDay] : DAYS_OF_WEEK;

  let html = `
    <div class="micro-heatmap-wrapper p-3" style="width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow-x: auto;">
      <div style="display: grid; grid-template-columns: 85px repeat(${TIME_SLOTS.length}, minmax(90px, 1fr)); gap: 10px; align-items: center; justify-content: center; width: 100%; max-width: 950px; margin: 0 auto;">
        
        <!-- Header Row: Day / Time Slots -->
        <div style="font-weight: 700; font-size: 0.8rem; color: #1e293b; text-transform: uppercase; padding-right: 8px; white-space: nowrap;">Day / Slot</div>
  `;

  TIME_SLOTS.forEach((slot) => {
    let timeLabel = `${slot.start}-${slot.end}`;
    if (slot.start === '12:00') timeLabel = '12:00-01:00';
    else if (slot.start === '13:00') timeLabel = '01:00-02:00';
    else if (slot.start === '14:00') timeLabel = '02:00-03:00';
    else if (slot.start === '15:00') timeLabel = '03:00-04:00';

    html += `<div style="font-weight: 700; font-size: 0.72rem; color: #475569; text-align: center; white-space: nowrap;" title="${slot.label}">${timeLabel}</div>`;
  });

  daysToRender.forEach((day, dayIdx) => {
    const isTopRow = dayIdx === 0 || day === 'Monday';
    const isBottomRow = dayIdx === daysToRender.length - 1 || day === 'Friday';
    const tooltipClass = (isTopRow || isBottomRow) ? 'heatmap-tooltip tooltip-below' : 'heatmap-tooltip';

    html += `<div style="font-weight: 700; font-size: 0.82rem; color: #1e293b; white-space: nowrap; padding-right: 8px;">${day.substring(0, 3)}</div>`;

    TIME_SLOTS.forEach(slot => {
      const isLunchBreak = (slot.start === '12:00' && slot.end === '13:00');
      const isJummahBreak = (slot.start === '13:00' && slot.end === '14:00' && day === 'Friday');

      const matching = entries.filter(e => {
        return e.day_of_week === day && (
          (e.start_time >= slot.start && e.start_time < slot.end) ||
          (e.start_time <= slot.start && e.end_time > slot.start)
        );
      });

      if (isLunchBreak) {
        html += `
          <div class="micro-block block-lunch" style="width:100%; height:38px; border-radius:8px; background:#d97706; cursor:pointer; position:relative;">
            <div class="${tooltipClass}">
              🍔 Lunch Break
            </div>
          </div>
        `;
      } else if (isJummahBreak) {
        html += `
          <div class="micro-block block-jummah" style="width:100%; height:38px; border-radius:8px; background:#10b981; cursor:pointer; position:relative;">
            <div class="${tooltipClass}">
              🕌 Jummah Break
            </div>
          </div>
        `;
      } else if (matching.length > 0) {
        const roomNumbers = [...new Set(matching.map(m => m.room_name))].join(', ');
        html += `
          <div class="micro-block block-occupied" style="width:100%; height:38px; border-radius:8px; background:#16a34a; cursor:pointer; position:relative;">
            <div class="${tooltipClass}">
              🚪 Rooms: <strong>${roomNumbers}</strong>
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="micro-block block-empty" style="width:100%; height:38px; border-radius:8px; background:#ef4444; cursor:pointer; position:relative;">
            <div class="${tooltipClass}">
              🔴 Vacant Slot
            </div>
          </div>
        `;
      }
    });
  });

  html += `
      </div>
    </div>
  `;

  gridWrapper.innerHTML = html;
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
      } else {
        html += `
          <div class="vacant-slot-box">
            <span class="vacant-text">Available</span>
          </div>
        `;
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
  window.location.href = '/api/upload/template';
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

function onRoomTypeChange() {
  const roomTypeSelect = document.getElementById('roomType');
  if (!roomTypeSelect) return;
  const room_type = roomTypeSelect.value;
  const computersGroup = document.getElementById('computersGroup');
  const label = document.getElementById('computersGroupLabel');

  if (room_type === 'Computer Lab' || room_type === 'Science Lab') {
    if (computersGroup) computersGroup.style.display = 'block';
    if (label) {
      label.textContent = room_type === 'Computer Lab' 
        ? 'Number of Computers *' 
        : 'Number of Computers / Lab Equipment Stations *';
    }
  } else {
    if (computersGroup) computersGroup.style.display = 'none';
  }
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
  if (room_type === 'Computer Lab' || room_type === 'Science Lab') {
    computers_count = document.getElementById('roomComputers').value || 0;
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

// Room Availability Lookup Modal (Requirement 3: Department-Specific with Total, Occupied, and Available Summary)
function openRoomFinderModal() {
  const rfDept = document.getElementById('rfDept');
  if (rfDept) {
    rfDept.innerHTML = `<option value="">🏛️ All Departments (Campus-Wide)</option>` + 
      masterDepartments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
  }
  openModal('roomFinderModal');
}

function closeRoomFinderModal() {
  closeModal('roomFinderModal');
}

async function checkRoomAvailability(e) {
  e.preventDefault();
  const deptSelect = document.getElementById('rfDept');
  const deptId = deptSelect ? deptSelect.value : '';
  const day = document.getElementById('rfDay').value;
  const start_time = document.getElementById('rfStart').value;
  const end_time = document.getElementById('rfEnd').value;

  const container = document.getElementById('roomFinderResults');
  container.innerHTML = `<p class="placeholder-text"><i class="fa-solid fa-spin fa-circle-notch"></i> Searching free classrooms & laboratories...</p>`;

  try {
    const res = await fetch(`/api/rooms/availability?day=${day}&start_time=${start_time}&end_time=${end_time}`);
    const data = await res.json();

    let targetRooms = masterRooms;
    if (deptId) {
      targetRooms = masterRooms.filter(r => Number(r.department_id) === Number(deptId));
    }

    const availableIds = new Set((data.available || []).map(r => Number(r.id)));
    const availableRooms = targetRooms.filter(r => availableIds.has(Number(r.id)));
    const occupiedRooms = targetRooms.filter(r => !availableIds.has(Number(r.id)));

    const totalCount = targetRooms.length;
    const availableCount = availableRooms.length;
    const occupiedCount = occupiedRooms.length;

    let html = `
      <div class="stat-cards-grid stat-cards-3 mb-3">
        <div class="stat-card p-3" style="border-left: 4px solid #0284c7; background:#ffffff;">
          <div class="stat-info">
            <span class="stat-value" style="color: #0284c7; font-size: 1.4rem; font-weight: 800;">${totalCount}</span>
            <span class="stat-label" style="text-transform: uppercase; font-size: 0.75rem; font-weight: 700; color: #64748b;">Total Rooms</span>
          </div>
        </div>
        <div class="stat-card p-3" style="border-left: 4px solid #16a34a; background:#ffffff;">
          <div class="stat-info">
            <span class="stat-value" style="color: #16a34a; font-size: 1.4rem; font-weight: 800;">${availableCount}</span>
            <span class="stat-label" style="text-transform: uppercase; font-size: 0.75rem; font-weight: 700; color: #64748b;">Empty / Available Rooms</span>
          </div>
        </div>
        <div class="stat-card p-3" style="border-left: 4px solid #dc2626; background:#ffffff;">
          <div class="stat-info">
            <span class="stat-value" style="color: #dc2626; font-size: 1.4rem; font-weight: 800;">${occupiedCount}</span>
            <span class="stat-label" style="text-transform: uppercase; font-size: 0.75rem; font-weight: 700; color: #64748b;">Occupied Rooms</span>
          </div>
        </div>
      </div>

      <div style="margin-bottom: 12px; font-weight: 700; color: var(--uet-green);">
        <i class="fa-solid fa-circle-check"></i> Found ${availableCount} Free Rooms on ${day} (${start_time} - ${end_time}):
      </div>
    `;

    if (availableCount === 0) {
      html += `<div class="form-error">No vacant rooms available at this time slot for the selected filter (${day} ${start_time} - ${end_time}). All ${totalCount} rooms are occupied!</div>`;
    } else {
      html += `<div class="form-grid">`;
      availableRooms.forEach(r => {
        const isLab = r.room_type === 'Computer Lab' || r.room_type === 'Science Lab';
        html += `
          <div class="slot-card p-3" style="border-left: 4px solid var(--uet-green); background: #ffffff; box-shadow: var(--shadow-sm); border-radius: 8px;">
            <div class="course-code" style="font-weight: 700; color: var(--uet-green-dark);">${r.room_name} (${r.department_code || 'DEPT'})</div>
            <div class="course-title" style="font-size: 0.85rem; color: #475569;">${r.room_type}</div>
            <div class="slot-meta" style="margin-top: 4px; font-size: 0.8rem;">
              <span>🪑 Seats: <strong>${r.capacity}</strong> | ${r.projector ? '📹 Proj: Yes' : 'No Proj'}</span>
              ${isLab ? `<span> | 💻 Equip: <strong>${r.computers_count || 40}</strong></span>` : ''}
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

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
  if (!roomSelect) return;
  roomSelect.innerHTML = '';

  let availableTargetRooms = [];
  if (currentUser.role === 'admin' || !myDeptId) {
    availableTargetRooms = masterRooms;
  } else {
    availableTargetRooms = masterRooms.filter(r => Number(r.department_id) !== myDeptId);
    if (availableTargetRooms.length === 0) {
      availableTargetRooms = masterRooms;
    }
  }

  if (availableTargetRooms.length === 0) {
    alert('No rooms are currently registered in the system to request.');
    return;
  }

  availableTargetRooms.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `${r.room_name} — ${r.department_name || r.department_code || 'Dept'} (${r.room_type}, ${r.capacity} seats)`;
    if (preselectRoomId && Number(r.id) === Number(preselectRoomId)) {
      opt.selected = true;
    }
    roomSelect.appendChild(opt);
  });

  const btnSubmit = document.getElementById('btnSubmitReq');
  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.style.opacity = '1';
  }

  const reqCode = document.getElementById('reqCourseCode');
  if (reqCode) reqCode.value = `${currentUser.department_code || 'CS'}-101`;

  const reqName = document.getElementById('reqCourseName');
  if (reqName) reqName.value = 'Guest Department Lecture';

  const reqSec = document.getElementById('reqSection');
  if (reqSec) reqSec.value = `${currentUser.department_code || 'CS'}-1A`;

  const reqSem = document.getElementById('reqSemester');
  if (reqSem) reqSem.value = '1';

  const reqNotes = document.getElementById('reqNotes');
  if (reqNotes) reqNotes.value = '';

  const reqError = document.getElementById('reqError');
  if (reqError) reqError.style.display = 'none';

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

  const entriesList = (typeof currentTimetableEntries !== 'undefined' && Array.isArray(currentTimetableEntries)) ? currentTimetableEntries : [];
  const conflict = entriesList.find(e => 
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

// ============================================================================
// CAMPUS RESOURCE UTILIZATION ENGINE & MANAGEMENT FORMS
// ============================================================================

// Consistent Visualization Color Engine (Requirements 15, 16, 17, 18)
function getUtilizationStatus(utilPct) {
  const pct = Math.min(100, Math.max(0, Math.round(utilPct)));
  if (pct >= 90) {
    return {
      label: `Full Utilization (${pct}%)`,
      badgeClass: 'bg-danger',
      badgeColor: '#fff',
      color: '#dc2626', // Red (Req 17: Full Utilization)
      status: 'Fully Utilized'
    };
  } else if (pct >= 50) {
    return {
      label: `Moderate Utilization (${pct}%)`,
      badgeClass: 'bg-warning',
      badgeColor: '#1e293b',
      color: '#eab308', // Yellow (Req 16: Moderate Utilization)
      status: 'Moderate Utilization'
    };
  } else {
    return {
      label: `Full Availability (${pct}%)`,
      badgeClass: 'bg-green',
      badgeColor: '#fff',
      color: '#16a34a', // Green (Req 15: 100% Available)
      status: 'Optimal Availability'
    };
  }
}

function renderCampusResourceUtilization() {
  if (!masterDepartments || masterDepartments.length === 0) return;

  // 1. Calculate Campus Summary Metrics (Requirement 2, 11, 12, 13, 14)
  const deptCount = masterDepartments.length;
  const totalRooms = masterRooms.length;
  const totalLabs = masterRooms.filter(r => r.room_type === 'Computer Lab' || r.room_type === 'Science Lab').length;
  const totalComputers = masterRooms.reduce((acc, r) => acc + (Number(r.computers_count) || (r.room_type === 'Computer Lab' ? 40 : (r.room_type === 'Science Lab' ? 10 : 0))), 0);
  const totalProjectors = masterRooms.filter(r => r.projector === 1 || r.projector === 'Yes' || r.projector === '1').length;
  const totalFaculty = masterInstructors.length;

  if (document.getElementById('statDeptCount')) document.getElementById('statDeptCount').textContent = deptCount;
  if (document.getElementById('statTotalRoomsCount')) document.getElementById('statTotalRoomsCount').textContent = totalRooms;
  if (document.getElementById('statLabCount')) document.getElementById('statLabCount').textContent = totalLabs;
  if (document.getElementById('statComputerCount')) document.getElementById('statComputerCount').textContent = totalComputers;
  if (document.getElementById('statProjectorCount')) document.getElementById('statProjectorCount').textContent = totalProjectors;
  if (document.getElementById('statFacultyCount')) document.getElementById('statFacultyCount').textContent = totalFaculty;

  // Calculate Shared vs Independent Resources (Req 11, 12)
  let sharedCount = 0;
  let independentCount = 0;
  let interDeptSlotsCount = 0;

  masterRooms.forEach(room => {
    const entries = currentTimetableEntries.filter(e => Number(e.room_id) === Number(room.id));
    const deptsUsing = new Set(entries.map(e => Number(e.department_id)));
    if (deptsUsing.size > 1) {
      sharedCount++;
    } else {
      independentCount++;
    }
    entries.forEach(e => {
      if (Number(e.department_id) !== Number(room.department_id)) {
        interDeptSlotsCount++;
      }
    });
  });

  const sharedPct = totalRooms > 0 ? Math.round((sharedCount / totalRooms) * 100) : 0;
  const independentPct = totalRooms > 0 ? Math.round((independentCount / totalRooms) * 100) : 100;
  const interDeptSharingPct = currentTimetableEntries.length > 0 ? Math.round((interDeptSlotsCount / currentTimetableEntries.length) * 100) : 0;

  if (document.getElementById('statSharedResourcePct')) document.getElementById('statSharedResourcePct').textContent = `${sharedPct}% (${sharedCount} Rooms)`;
  if (document.getElementById('statIndependentResourcePct')) document.getElementById('statIndependentResourcePct').textContent = `${independentPct}% (${independentCount} Rooms)`;
  if (document.getElementById('statInterDeptSupportPct')) document.getElementById('statInterDeptSupportPct').textContent = `${interDeptSharingPct}% (${interDeptSlotsCount} Slots)`;

  // Show "Add Faculty" button if logged-in user has edit access
  const addFacultyBtn = document.getElementById('btnAddFacultyBtn');
  if (addFacultyBtn) {
    addFacultyBtn.style.display = (currentUser && (currentUser.role === 'admin' || currentUser.role === 'dept_admin')) ? 'inline-flex' : 'none';
  }

  // 2. Render Graphical Charts (Requirements 4, 9, 10, 11, 12, 13, 14, 18)
  renderResourceCharts();

  // 3. Render Department Utilization Table (Requirements 3, 10, 15-18)
  renderDeptRoomsUtilizationTable();

  // 4. Render Department Statistics Cards
  renderDepartmentStatsCards();

  // 5. Render Faculty Workload Module & Statistics (Requirements 19-22)
  renderFacultyStats();
  renderFacultyTable();
  renderFacultyWorkloadTable();
}

// Chart.js Plugin to Render Exact Numerical Values on Top of Bars, Line Points, and Doughnut Slices
const chartValueLabelsPlugin = {
  id: 'customValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    const isHorizontal = chart.options && chart.options.indexAxis === 'y';

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;
      meta.data.forEach((element, index) => {
        const val = dataset.data[index];
        if (val === undefined || val === null) return;
        const displayVal = typeof val === 'number' ? val : val;
        if (displayVal === 0 && chart.config.type === 'doughnut') return;

        ctx.font = 'bold 11px Inter, system-ui, sans-serif';

        if (chart.config.type === 'bar') {
          if (isHorizontal) {
            const chartRight = chart.chartArea ? chart.chartArea.right : (chart.width - 25);
            if (element.x + 25 > chartRight) {
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'right';
              ctx.textBaseline = 'middle';
              ctx.fillText(displayVal, element.x - 8, element.y);
            } else {
              ctx.fillStyle = '#0f172a';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(displayVal, element.x + 6, element.y);
            }
          } else {
            ctx.fillStyle = '#0f172a';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(displayVal, element.x, element.y - 3);
          }
        } else if (chart.config.type === 'line') {
          ctx.fillStyle = '#0f172a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(displayVal + '%', element.x, element.y - 8);
        } else if (chart.config.type === 'doughnut' || chart.config.type === 'pie') {
          const position = element.tooltipPosition();
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(displayVal, position.x, position.y);
        }
      });
    });
    ctx.restore();
  }
};

if (typeof Chart !== 'undefined' && Chart.register) {
  try {
    Chart.register(chartValueLabelsPlugin);
  } catch (e) {
    // Plugin registered
  }
}

function renderResourceCharts() {
  if (typeof Chart === 'undefined') return;

  const deptCodes = masterDepartments.map(d => d.code);
  const roomCounts = masterDepartments.map(d => masterRooms.filter(r => Number(r.department_id) === Number(d.id)).length);
  const labCounts = masterDepartments.map(d => masterRooms.filter(r => Number(r.department_id) === Number(d.id) && (r.room_type === 'Computer Lab' || r.room_type === 'Science Lab')).length);
  const compCounts = masterDepartments.map(d => masterRooms.filter(r => Number(r.department_id) === Number(d.id)).reduce((acc, r) => acc + (Number(r.computers_count) || (r.room_type === 'Computer Lab' ? 40 : (r.room_type === 'Science Lab' ? 10 : 0))), 0));
  const projCounts = masterDepartments.map(d => masterRooms.filter(r => Number(r.department_id) === Number(d.id) && (r.projector === 1 || r.projector === 'Yes' || r.projector === '1')).length);

  // Utilization rates %
  const utilRates = masterDepartments.map(d => {
    const dRooms = masterRooms.filter(r => Number(r.department_id) === Number(d.id));
    if (dRooms.length === 0) return 0;
    const activeSlots = currentTimetableEntries.filter(e => Number(e.department_id) === Number(d.id)).length;
    const capacitySlots = dRooms.length * 40; // 8 slots/day * 5 days = 40 max slots per room per week
    const pct = Math.min(100, Math.round((activeSlots / Math.max(1, capacitySlots)) * 100 * 10) / 10);
    return pct;
  });

  const avgOccupancy = utilRates.length > 0 ? (utilRates.reduce((a, b) => a + b, 0) / utilRates.length).toFixed(1) : 0;
  if (document.getElementById('badgeAvgOccupancy')) {
    document.getElementById('badgeAvgOccupancy').textContent = `${avgOccupancy}% Avg Occupancy`;
  }

  // Common Animation Settings
  const chartAnimationOptions = {
    duration: 1500,
    easing: 'easeOutQuart',
    animateRotate: true,
    animateScale: true
  };

  // Chart 1: Department Resources Bar Chart
  const ctxResources = document.getElementById('chartDeptResources');
  if (ctxResources) {
    if (chartDeptResourcesInstance) chartDeptResourcesInstance.destroy();
    chartDeptResourcesInstance = new Chart(ctxResources, {
      type: 'bar',
      data: {
        labels: deptCodes,
        datasets: [
          { label: 'Total Rooms', data: roomCounts, backgroundColor: '#006633', borderRadius: 6 },
          { label: 'Laboratories', data: labCounts, backgroundColor: '#ea580c', borderRadius: 6 },
          { label: 'Projectors', data: projCounts, backgroundColor: '#16a34a', borderRadius: 6 },
          { label: 'Computers (x10)', data: compCounts.map(c => Math.round(c / 10)), backgroundColor: '#7c3aed', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: chartAnimationOptions,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // Chart 2: Department Utilization Rate Line Chart with Color Coding (Req 15-18)
  const ctxUtil = document.getElementById('chartDeptUtilization');
  if (ctxUtil) {
    if (chartDeptUtilizationInstance) chartDeptUtilizationInstance.destroy();
    
    // Consistent point colors: Green (<50%), Yellow (50-89%), Red (>=90%)
    const pointColors = utilRates.map(r => r >= 90 ? '#dc2626' : (r >= 50 ? '#eab308' : '#16a34a'));

    chartDeptUtilizationInstance = new Chart(ctxUtil, {
      type: 'line',
      data: {
        labels: deptCodes,
        datasets: [{
          label: 'Room Utilization Rate (%)',
          data: utilRates,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.15)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          pointRadius: 6,
          pointHoverRadius: 9
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: chartAnimationOptions,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } }
      }
    });
  }

  // Chart 3: Shared vs Independent Resource Allocation Doughnut Chart (Requirements 11 & 12)
  let sharedCount = 0;
  let independentCount = 0;
  masterRooms.forEach(room => {
    const entries = currentTimetableEntries.filter(e => Number(e.room_id) === Number(room.id));
    const deptsUsing = new Set(entries.map(e => Number(e.department_id)));
    if (deptsUsing.size > 1) sharedCount++;
    else independentCount++;
  });

  const ctxShared = document.getElementById('chartSharedVsIndependent');
  if (ctxShared) {
    if (chartSharedVsIndependentInstance) chartSharedVsIndependentInstance.destroy();
    chartSharedVsIndependentInstance = new Chart(ctxShared, {
      type: 'doughnut',
      data: {
        labels: ['Shared Resources (Multi-Dept)', 'Independent Resources (Single-Dept)'],
        datasets: [{
          data: [sharedCount, independentCount],
          backgroundColor: ['#7c3aed', '#2563eb']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: chartAnimationOptions,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  // Chart 4: Inter-Departmental Support Matrix Bar Chart (Requirements 13 & 14)
  const crossDeptSupportPerDept = masterDepartments.map(d => {
    const dRooms = masterRooms.filter(r => Number(r.department_id) === Number(d.id));
    const dRoomIds = new Set(dRooms.map(r => r.id));
    let crossCount = 0;
    currentTimetableEntries.forEach(e => {
      if (dRoomIds.has(Number(e.room_id)) && Number(e.department_id) !== Number(d.id)) {
        crossCount++;
      }
    });
    return crossCount;
  });

  const ctxInterDept = document.getElementById('chartInterDeptSupport');
  if (ctxInterDept) {
    if (chartInterDeptSupportInstance) chartInterDeptSupportInstance.destroy();
    chartInterDeptSupportInstance = new Chart(ctxInterDept, {
      type: 'bar',
      data: {
        labels: deptCodes,
        datasets: [{
          label: 'Cross-Department Support Slots Provided',
          data: crossDeptSupportPerDept,
          backgroundColor: '#0891b2',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: chartAnimationOptions,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  // Chart 5: Faculty Designation Ranks Chart
  const isDeptCoord = currentUser && currentUser.role === 'dept_admin' && currentUser.department_id;
  const targetFacultyList = isDeptCoord 
    ? masterInstructors.filter(i => Number(i.department_id) === Number(currentUser.department_id))
    : masterInstructors;

  const desigRanks = [
    'Professor',
    'Associate Professor',
    'Assistant Professor',
    'Lecturer',
    'Teaching Fellow',
    'Graduate Assistant',
    'Teaching Assistant'
  ];
  const rankCounts = desigRanks.map(rank => targetFacultyList.filter(i => (i.designation || '').toLowerCase() === rank.toLowerCase()).length);

  if (document.getElementById('badgeTotalFacultyRanks')) {
    document.getElementById('badgeTotalFacultyRanks').textContent = isDeptCoord 
      ? `${targetFacultyList.length} Members (${currentUser.department_code || 'Dept'})`
      : `${masterInstructors.length} Members (All Departments)`;
  }

  const ctxFaculty = document.getElementById('chartFacultyRanks');
  if (ctxFaculty) {
    if (chartFacultyRanksInstance) chartFacultyRanksInstance.destroy();
    chartFacultyRanksInstance = new Chart(ctxFaculty, {
      type: 'bar',
      data: {
        labels: desigRanks,
        datasets: [{
          label: 'Faculty Members',
          data: rankCounts,
          backgroundColor: ['#006633', '#16a34a', '#2563eb', '#7c3aed', '#ea580c', '#0891b2', '#dc2626'],
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: chartAnimationOptions,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, grace: '15%' } }
      }
    });
  }

  // Chart 6: Room Categories Breakdown Doughnut Chart
  const classroomsCount = masterRooms.filter(r => r.room_type === 'Lecture Hall' || r.room_type === 'Lecture Room').length;
  const compLabCount = masterRooms.filter(r => r.room_type === 'Computer Lab').length;
  const sciLabCount = masterRooms.filter(r => r.room_type === 'Science Lab').length;
  const otherRoomCount = masterRooms.filter(r => r.room_type !== 'Lecture Hall' && r.room_type !== 'Lecture Room' && r.room_type !== 'Computer Lab' && r.room_type !== 'Science Lab').length;

  const ctxRoomTypes = document.getElementById('chartRoomTypes');
  if (ctxRoomTypes) {
    if (chartRoomTypesInstance) chartRoomTypesInstance.destroy();
    chartRoomTypesInstance = new Chart(ctxRoomTypes, {
      type: 'doughnut',
      data: {
        labels: ['Lecture Rooms', 'Computer Labs', 'Science Labs', 'Seminars/Other'],
        datasets: [{
          data: [classroomsCount, compLabCount, sciLabCount, otherRoomCount],
          backgroundColor: ['#006633', '#7c3aed', '#ea580c', '#2563eb']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: chartAnimationOptions,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }
}

function renderDeptRoomsUtilizationTable() {
  const tbody = document.getElementById('tbodyDeptRoomsUtilization');
  if (!tbody) return;

  if (masterDepartments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">No department data available.</td></tr>`;
    return;
  }

  let html = '';
  masterDepartments.forEach(d => {
    const dRooms = masterRooms.filter(r => Number(r.department_id) === Number(d.id));
    const classrooms = dRooms.filter(r => r.room_type === 'Lecture Hall' || r.room_type === 'Lecture Room').length;
    const compLabs = dRooms.filter(r => r.room_type === 'Computer Lab').length;
    const sciLabs = dRooms.filter(r => r.room_type === 'Science Lab').length;

    const computers = dRooms.reduce((acc, r) => acc + (Number(r.computers_count) || (r.room_type === 'Computer Lab' ? 40 : (r.room_type === 'Science Lab' ? 10 : 0))), 0);
    const projectors = dRooms.filter(r => r.projector === 1 || r.projector === 'Yes' || r.projector === '1').length;
    const activeSlots = currentTimetableEntries.filter(e => Number(e.department_id) === Number(d.id)).length;

    const maxWeeklySlots = Math.max(1, dRooms.length * 40);
    const utilPct = Math.min(100, Math.round((activeSlots / maxWeeklySlots) * 100 * 10) / 10);
    const statusObj = getUtilizationStatus(utilPct);

    html += `
      <tr>
        <td style="vertical-align: middle;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:36px; height:36px; border-radius:10px; background:rgba(0,102,51,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="fa-solid fa-building-columns" style="color:${d.color || '#006633'}; font-size:1.1rem;"></i>
            </div>
            <div>
              <strong style="font-size:0.95rem; color:var(--text-dark);">${d.name}</strong>
              <div class="text-xs text-muted" style="margin-top:2px;">Code: <strong>${d.code}</strong> | ${d.building || 'KSK Block'}</div>
            </div>
          </div>
        </td>
        <td style="vertical-align: middle; white-space:nowrap;"><span class="badge bg-blue" style="color:#fff; font-weight:700; padding:6px 12px; font-size:0.85rem;"><i class="fa-solid fa-door-closed"></i> ${dRooms.length} Rooms</span></td>
        <td style="vertical-align: middle; white-space:nowrap;"><span class="badge bg-blue" style="background:#0284c7 !important; color:#ffffff !important; font-weight:600; padding:6px 12px; font-size:0.85rem;"><i class="fa-solid fa-chalkboard-user"></i> ${classrooms} Classrooms</span></td>
        <td style="vertical-align: middle;">
          <div style="display:flex; flex-direction:column; gap:3px; white-space:nowrap;">
            <span class="badge bg-purple" style="font-size:0.75rem; padding:3px 8px; color:#fff; font-weight:600;"><i class="fa-solid fa-laptop-code"></i> ${compLabs} Comp Labs</span>
            <span class="badge bg-orange" style="font-size:0.75rem; padding:3px 8px; color:#fff; font-weight:600;"><i class="fa-solid fa-flask"></i> ${sciLabs} Sci Labs</span>
          </div>
        </td>
        <td style="vertical-align: middle; white-space:nowrap;"><span class="badge bg-purple" style="color:#fff; font-weight:600; padding:5px 10px; font-size:0.82rem;"><i class="fa-solid fa-desktop"></i> ${computers} PCs</span></td>
        <td style="vertical-align: middle; white-space:nowrap;"><span class="badge bg-green" style="color:#fff; font-weight:600; padding:5px 10px; font-size:0.82rem;"><i class="fa-solid fa-video"></i> ${projectors}</span></td>
        <td style="vertical-align: middle; white-space:nowrap;"><span class="badge bg-purple" style="color:#fff; font-weight:700; padding:6px 12px; font-size:0.85rem;"><i class="fa-solid fa-clock"></i> ${activeSlots} Slots</span></td>
        <td style="vertical-align: middle; min-width: 130px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="progress-bar-bg" style="flex:1; height:8px; background:#e2e8f0; border-radius:6px; overflow:hidden;">
              <div style="width:${utilPct}%; height:100%; background:${statusObj.color}; border-radius:6px;"></div>
            </div>
            <strong class="text-sm" style="color:${statusObj.color}; font-weight:700;">${utilPct}%</strong>
          </div>
        </td>
        <td style="vertical-align: middle; white-space: nowrap;">
          <span class="badge ${statusObj.badgeClass}" style="color:${statusObj.badgeColor}; white-space:nowrap; display:inline-flex; align-items:center; gap:4px; padding:6px 12px; font-weight:600; font-size:0.8rem; border-radius:20px;">
            <i class="fa-solid fa-shield-halved"></i> ${statusObj.label}
          </span>
        </td>
        <td style="vertical-align: middle;">
          <button class="btn btn-sm btn-outline" style="white-space:nowrap;" onclick="openDeptResourceModal(${d.id})">
            <i class="fa-solid fa-sliders"></i> Manage Resources
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function renderDepartmentStatsCards() {
  const container = document.getElementById('deptStatsCardsContainer');
  if (!container) return;

  if (masterDepartments.length === 0) {
    container.innerHTML = `<p class="text-muted">No department statistics available.</p>`;
    return;
  }

  let html = '';
  masterDepartments.forEach(d => {
    const dRooms = masterRooms.filter(r => Number(r.department_id) === Number(d.id));
    const dInstructors = masterInstructors.filter(i => Number(i.department_id) === Number(d.id));

    const classrooms = dRooms.filter(r => r.room_type === 'Lecture Hall' || r.room_type === 'Lecture Room').length;
    const compLabs = dRooms.filter(r => r.room_type === 'Computer Lab').length;
    const sciLabs = dRooms.filter(r => r.room_type === 'Science Lab').length;
    const computers = dRooms.reduce((acc, r) => acc + (Number(r.computers_count) || (r.room_type === 'Computer Lab' ? 40 : (r.room_type === 'Science Lab' ? 10 : 0))), 0);
    const projectors = dRooms.filter(r => r.projector === 1 || r.projector === 'Yes' || r.projector === '1').length;
    const activeSlots = currentTimetableEntries.filter(e => Number(e.department_id) === Number(d.id)).length;

    html += `
      <div class="dept-stat-card glass-card">
        <div class="dept-card-header" style="border-bottom: 2px solid ${d.color || '#006633'};">
          <div class="dept-card-brand">
            <i class="fa-solid fa-building-columns" style="color:${d.color || '#006633'};"></i>
            <div>
              <h3>${d.name}</h3>
              <span>Dept Code: ${d.code} | ${d.building || 'KSK Campus'}</span>
            </div>
          </div>
          ${canUserEditDept(d.id) ? `
            <button class="btn btn-sm btn-outline" onclick="openDeptResourceModal(${d.id})">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
          ` : ''}
        </div>

        <div class="dept-card-body">
          <div class="dept-metrics-grid">
            <div class="dept-metric-item">
              <i class="fa-solid fa-door-closed icon-blue"></i>
              <div class="metric-data">
                <span class="m-val">${dRooms.length}</span>
                <span class="m-lbl">Total Rooms</span>
              </div>
            </div>

            <div class="dept-metric-item">
              <i class="fa-solid fa-chalkboard-user icon-green"></i>
              <div class="metric-data">
                <span class="m-val">${classrooms}</span>
                <span class="m-lbl">Classrooms</span>
              </div>
            </div>

            <div class="dept-metric-item">
              <i class="fa-solid fa-laptop-code icon-purple"></i>
              <div class="metric-data">
                <span class="m-val">${compLabs + sciLabs}</span>
                <span class="m-lbl">Labs (${compLabs} C | ${sciLabs} S)</span>
              </div>
            </div>

            <div class="dept-metric-item">
              <i class="fa-solid fa-desktop icon-orange"></i>
              <div class="metric-data">
                <span class="m-val">${computers}</span>
                <span class="m-lbl">Computers</span>
              </div>
            </div>

            <div class="dept-metric-item">
              <i class="fa-solid fa-video icon-green"></i>
              <div class="metric-data">
                <span class="m-val">${projectors}</span>
                <span class="m-lbl">Projectors</span>
              </div>
            </div>

            <div class="dept-metric-item">
              <i class="fa-solid fa-user-graduate icon-teal"></i>
              <div class="metric-data">
                <span class="m-val">${dInstructors.length}</span>
                <span class="m-lbl">Faculty</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderFacultyStats() {
  const isDeptCoord = currentUser && currentUser.role === 'dept_admin' && currentUser.department_id;
  const targetInstructors = isDeptCoord 
    ? masterInstructors.filter(i => Number(i.department_id) === Number(currentUser.department_id))
    : masterInstructors;

  const professors = targetInstructors.filter(i => (i.designation || '').toLowerCase() === 'professor').length;
  const assocProfs = targetInstructors.filter(i => (i.designation || '').toLowerCase() === 'associate professor').length;
  const asstProfs = targetInstructors.filter(i => (i.designation || '').toLowerCase() === 'assistant professor').length;
  const lecturers = targetInstructors.filter(i => (i.designation || '').toLowerCase() === 'lecturer').length;
  const teachingFellows = targetInstructors.filter(i => (i.designation || '').toLowerCase() === 'teaching fellow').length;
  const gradAssts = targetInstructors.filter(i => (i.designation || '').toLowerCase() === 'graduate assistant').length;
  const teachAssts = targetInstructors.filter(i => (i.designation || '').toLowerCase() === 'teaching assistant').length;

  if (document.getElementById('statProfessorsCount')) document.getElementById('statProfessorsCount').textContent = professors;
  if (document.getElementById('statAssocProfCount')) document.getElementById('statAssocProfCount').textContent = assocProfs;
  if (document.getElementById('statAsstProfCount')) document.getElementById('statAsstProfCount').textContent = asstProfs;
  if (document.getElementById('statLecturersCount')) document.getElementById('statLecturersCount').textContent = lecturers;
  if (document.getElementById('statTeachingFellowsCount')) document.getElementById('statTeachingFellowsCount').textContent = teachingFellows;
  if (document.getElementById('statGradAsstCount')) document.getElementById('statGradAsstCount').textContent = gradAssts;
  if (document.getElementById('statTeachAsstCount')) document.getElementById('statTeachAsstCount').textContent = teachAssts;

  const csRefBox = document.querySelector('.cs-faculty-reference-box');
  if (csRefBox) {
    if (isDeptCoord && (currentUser.department_code || '').toUpperCase() !== 'CS') {
      csRefBox.style.display = 'none';
    } else {
      csRefBox.style.display = 'flex';
      const csDept = masterDepartments.find(d => (d.code || '').toUpperCase() === 'CS');
      if (csDept) {
        const csInstructors = masterInstructors.filter(i => Number(i.department_id) === Number(csDept.id)).length;
        if (document.getElementById('statCsFacultyTotal')) document.getElementById('statCsFacultyTotal').textContent = csInstructors;
      }
    }
  }

  // Populate faculty filter dropdowns
  const facultyDeptFilter = document.getElementById('facultyDeptFilter');
  if (facultyDeptFilter) {
    if (isDeptCoord) {
      facultyDeptFilter.innerHTML = `<option value="${currentUser.department_id}">${currentUser.department_name} (${currentUser.department_code})</option>`;
      facultyDeptFilter.value = currentUser.department_id;
      facultyDeptFilter.disabled = true;
    } else if (facultyDeptFilter.options.length <= 1) {
      facultyDeptFilter.innerHTML = `<option value="">All Departments</option>` +
        masterDepartments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
    }
  }

  const workloadDeptFilter = document.getElementById('workloadDeptFilter');
  if (workloadDeptFilter) {
    if (isDeptCoord) {
      workloadDeptFilter.innerHTML = `<option value="${currentUser.department_id}">${currentUser.department_name} (${currentUser.department_code})</option>`;
      workloadDeptFilter.value = currentUser.department_id;
      workloadDeptFilter.disabled = true;
    } else if (workloadDeptFilter.options.length <= 1) {
      workloadDeptFilter.innerHTML = `<option value="">All Departments</option>` +
        masterDepartments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
    }
  }
}

function renderFacultyTable() {
  const tbody = document.getElementById('tbodyFacultyList');
  if (!tbody) return;

  const searchQuery = (document.getElementById('facultySearchInput')?.value || '').toLowerCase();
  const isDeptCoord = currentUser && currentUser.role === 'dept_admin' && currentUser.department_id;
  const deptFilter = isDeptCoord ? currentUser.department_id : (document.getElementById('facultyDeptFilter')?.value || '');
  const desigFilter = document.getElementById('facultyDesigFilter')?.value || '';

  let filtered = [...masterInstructors];

  if (deptFilter) {
    filtered = filtered.filter(i => Number(i.department_id) === Number(deptFilter));
  }
  if (desigFilter) {
    filtered = filtered.filter(i => (i.designation || '').toLowerCase() === desigFilter.toLowerCase());
  }
  if (searchQuery) {
    filtered = filtered.filter(i => 
      (i.name || '').toLowerCase().includes(searchQuery) ||
      (i.email || '').toLowerCase().includes(searchQuery) ||
      (i.designation || '').toLowerCase().includes(searchQuery)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted p-3">No matching faculty members found.</td></tr>`;
    return;
  }

  let html = '';
  filtered.forEach((f, idx) => {
    const dept = masterDepartments.find(d => Number(d.id) === Number(f.department_id)) || {};
    const canEdit = canUserEditDept(f.department_id);

    html += `
      <tr>
        <td>${idx + 1}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-user-graduate" style="color:var(--primary-color);"></i>
            <strong>${f.name}</strong>
          </div>
        </td>
        <td>${f.email ? `<a href="mailto:${f.email}">${f.email}</a>` : '<span class="text-muted">N/A</span>'}</td>
        <td><span class="badge bg-purple" style="color:#fff;">${f.designation || 'Lecturer'}</span></td>
        <td>
          <span class="badge" style="background:${dept.color || '#006633'}; color:#fff;">${dept.code || 'Dept'}</span>
          <span class="text-xs ml-1">${dept.name || ''}</span>
        </td>
        <td>
          ${canEdit ? `
            <button class="btn-icon btn-icon-primary" title="Edit Faculty" onclick="openFacultyModal(${f.id})">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn-icon btn-icon-danger ml-1" title="Delete Faculty" onclick="deleteFacultyMember(${f.id}, '${f.name.replace(/'/g, "\\'")}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : '<span class="text-muted text-xs">Read-Only</span>'}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

async function renderAdminCredsTable() {
  const container = document.getElementById('adminCredsTableContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/departments/credentials');
    const users = await res.json();
    if (!res.ok) throw new Error(users.error || 'Failed to fetch credentials');

    let html = `
      <div class="table-responsive">
        <table class="uet-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Username</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Default Password</th>
            </tr>
          </thead>
          <tbody>
    `;

    users.forEach((u, idx) => {
      html += `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${u.username}</strong></td>
          <td>${u.full_name}</td>
          <td>${u.email || 'N/A'}</td>
          <td><span class="badge ${u.role === 'admin' ? 'bg-purple' : 'bg-green'}" style="color:#fff;">${u.role}</span></td>
          <td>${u.department_name ? `<span class="badge" style="background:${u.department_color || '#006633'}; color:#fff;">${u.department_name}</span>` : '<span class="text-muted">Central Admin</span>'}</td>
          <td><code>${u.plain_password || '******'}</code></td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="form-error">Error loading coordinator credentials: ${err.message}</div>`;
  }
}

function openDeptResourceModal(deptId) {
  const dept = masterDepartments.find(d => Number(d.id) === Number(deptId));
  if (!dept) return;

  const modalTitle = document.getElementById('modalDeptResourceTitle');
  if (modalTitle) {
    modalTitle.innerHTML = `<i class="fa-solid fa-sliders"></i> ${dept.name} (${dept.code}) Resource Management`;
  }

  const container = document.getElementById('modalDeptResourceContent');
  if (!container) return;

  const dRooms = masterRooms.filter(r => Number(r.department_id) === Number(dept.id));
  const dFaculty = masterInstructors.filter(i => Number(i.department_id) === Number(dept.id));
  const canEdit = canUserEditDept(dept.id);

  let html = `
    <div class="dept-manage-summary mb-4 p-3 glass-card" style="border-left: 4px solid ${dept.color || '#006633'};">
      <div class="flex-between">
        <div>
          <h4 class="m-0">${dept.name} Resource Control Panel</h4>
          <p class="text-xs text-muted m-0">Location: ${dept.building || 'UET KSK Academic Block'}</p>
        </div>
        <div>
          ${canEdit ? `
            <button class="btn btn-sm btn-primary" onclick="openAddRoomModalWithDept(${dept.id})">
              <i class="fa-solid fa-plus"></i> Add Room / Lab
            </button>
            <button class="btn btn-sm btn-accent ml-2" onclick="openFacultyModalForDept(${dept.id})">
              <i class="fa-solid fa-user-plus"></i> Add Faculty Member
            </button>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- Section 1: Department Rooms & Labs -->
    <h4><i class="fa-solid fa-door-open"></i> Allocated Rooms & Laboratories (${dRooms.length})</h4>
    <div class="table-responsive mb-4">
      <table class="uet-table text-sm">
        <thead>
          <tr>
            <th>Room Name</th>
            <th>Type</th>
            <th>Chairs/Capacity</th>
            <th>Projector</th>
            <th>Computers</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${dRooms.length === 0 ? `<tr><td colspan="6" class="text-muted text-center">No rooms assigned.</td></tr>` : 
            dRooms.map(r => `
              <tr>
                <td><strong>${r.room_name}</strong></td>
                <td><span class="badge ${r.room_type === 'Computer Lab' ? 'bg-purple' : 'bg-green'}" style="color:#fff;">${r.room_type}</span></td>
                <td>🪑 ${r.capacity || 50}</td>
                <td>${r.projector ? '📹 Yes' : 'No'}</td>
                <td>💻 ${r.computers_count || 0} PCs</td>
                <td>
                  ${canEdit ? `
                    <button class="btn-icon btn-icon-primary" title="Edit Room" onclick="openEditRoomModal(${r.id}); closeModal('modalDeptResourceManage');">
                      <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-icon btn-icon-danger ml-1" title="Delete Room" onclick="handleDeleteRoom(${r.id}, '${r.room_name}'); closeModal('modalDeptResourceManage');">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Section 2: Department Faculty Members -->
    <h4><i class="fa-solid fa-user-graduate"></i> Department Faculty Members (${dFaculty.length})</h4>
    <div class="table-responsive">
      <table class="uet-table text-sm">
        <thead>
          <tr>
            <th>Name</th>
            <th>Designation</th>
            <th>Email</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${dFaculty.length === 0 ? `<tr><td colspan="4" class="text-muted text-center">No faculty members assigned.</td></tr>` :
            dFaculty.map(f => `
              <tr>
                <td><strong>${f.name}</strong></td>
                <td><span class="badge bg-purple" style="color:#fff;">${f.designation}</span></td>
                <td>${f.email || 'N/A'}</td>
                <td>
                  ${canEdit ? `
                    <button class="btn-icon btn-icon-primary" title="Edit Faculty" onclick="openFacultyModal(${f.id})">
                      <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-icon btn-icon-danger ml-1" title="Delete Faculty" onclick="deleteFacultyMember(${f.id}, '${f.name.replace(/'/g, "\\'")}')">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
  openModal('modalDeptResourceManage');
}

// Teacher / Faculty Utilization & Workload Calculation Module (Requirements 19, 20, 21, 22)
function renderFacultyWorkloadTable() {
  const tbody = document.getElementById('tbodyFacultyWorkload');
  if (!tbody) return;

  if (masterInstructors.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted p-3">No faculty data available.</td></tr>`;
    return;
  }

  const searchVal = (document.getElementById('workloadSearchInput')?.value || '').toLowerCase().trim();
  const deptFilter = document.getElementById('workloadDeptFilter')?.value || '';
  const desigFilter = document.getElementById('workloadDesigFilter')?.value || '';

  const filteredInstructors = masterInstructors.filter(inst => {
    if (deptFilter && Number(inst.department_id) !== Number(deptFilter)) return false;
    if (desigFilter && (inst.designation || '').toLowerCase() !== desigFilter.toLowerCase()) return false;
    if (searchVal) {
      const matchName = (inst.name || '').toLowerCase().includes(searchVal);
      const matchEmail = (inst.email || '').toLowerCase().includes(searchVal);
      const assignedSlots = currentTimetableEntries.filter(e => Number(e.instructor_id) === Number(inst.id));
      const matchCourse = assignedSlots.some(slot => {
        const c = masterCourses.find(course => Number(course.id) === Number(slot.course_id));
        return c && (c.course_name.toLowerCase().includes(searchVal) || c.course_code.toLowerCase().includes(searchVal));
      });
      if (!matchName && !matchEmail && !matchCourse) return false;
    }
    return true;
  });

  if (filteredInstructors.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted p-3">No matching faculty workload records found.</td></tr>`;
    return;
  }

  let totalUtilSum = 0;
  let html = '';

  filteredInstructors.forEach((inst) => {
    const dept = masterDepartments.find(d => Number(d.id) === Number(inst.department_id)) || {};
    const assignedSlots = currentTimetableEntries.filter(e => Number(e.instructor_id) === Number(inst.id));

    const courseMap = {};
    let totalCreditHours = 0;

    assignedSlots.forEach(slot => {
      const course = masterCourses.find(c => Number(c.id) === Number(slot.course_id));
      const credit = course ? (Number(course.credit_hours) || 3) : 3;
      if (!courseMap[slot.course_id]) {
        courseMap[slot.course_id] = course ? `${course.course_code} (${course.course_name})` : `Course #${slot.course_id}`;
        totalCreditHours += credit;
      }
    });

    const coursesListStr = Object.values(courseMap).join(', ') || '<span class="text-muted text-xs">No active courses assigned</span>';
    const targetCreditHours = Number(inst.max_credit_hours) || 12;
    const workloadPct = Math.min(100, Math.round((totalCreditHours / targetCreditHours) * 100));
    totalUtilSum += workloadPct;

    const statusObj = getUtilizationStatus(workloadPct);

    html += `
      <tr>
        <td style="vertical-align: middle;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:36px; height:36px; border-radius:10px; background:rgba(0,102,51,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="fa-solid fa-user-graduate" style="color:var(--uet-green); font-size:1.1rem;"></i>
            </div>
            <div>
              <strong style="font-size:0.95rem; color:var(--text-dark);">${inst.name}</strong>
              <div class="text-xs text-muted" style="margin-top:2px;">${inst.email || 'No official email'}</div>
            </div>
          </div>
        </td>
        <td style="vertical-align: middle; white-space:nowrap;"><span class="badge bg-purple" style="color:#fff; font-weight:600; padding:5px 10px; font-size:0.8rem;">${inst.designation || 'Lecturer'}</span></td>
        <td style="vertical-align: middle; white-space:nowrap;"><span class="badge" style="background:${dept.color || '#006633'}; color:#fff; font-weight:700; padding:5px 10px;">${dept.code || 'Dept'}</span></td>
        <td style="max-width: 250px; vertical-align: middle;"><div class="text-xs text-truncate">${coursesListStr}</div></td>
        <td style="vertical-align: middle; white-space:nowrap;"><strong style="font-size:0.95rem; color:var(--text-dark);">${totalCreditHours}</strong> <span class="text-xs text-muted">hrs</span></td>
        <td style="vertical-align: middle; white-space:nowrap;"><span class="text-sm text-muted">${targetCreditHours} hrs</span></td>
        <td style="vertical-align: middle; min-width: 130px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="progress-bar-bg" style="flex:1; height:8px; background:#e2e8f0; border-radius:6px; overflow:hidden;">
              <div style="width:${workloadPct}%; height:100%; background:${statusObj.color}; border-radius:6px;"></div>
            </div>
            <strong class="text-sm" style="color:${statusObj.color}; font-weight:700;">${workloadPct}%</strong>
          </div>
        </td>
        <td style="vertical-align: middle; white-space: nowrap;">
          <span class="badge ${statusObj.badgeClass}" style="color:${statusObj.badgeColor}; white-space:nowrap; display:inline-flex; align-items:center; gap:4px; padding:6px 12px; font-weight:600; font-size:0.8rem; border-radius:20px;">
            <i class="fa-solid fa-shield-halved"></i> ${statusObj.label}
          </span>
        </td>
        <td style="vertical-align: middle;">
          <button class="btn btn-sm btn-outline" style="white-space:nowrap;" onclick="openFacultyProfileModal(${inst.id})">
            <i class="fa-solid fa-address-card"></i> View Contact Profile
          </button>
        </td>
      </tr>
    `;
  });

  const avgFacultyUtil = filteredInstructors.length > 0 ? Math.round(totalUtilSum / filteredInstructors.length) : 0;
  if (document.getElementById('badgeAvgFacultyUtilization')) {
    document.getElementById('badgeAvgFacultyUtilization').textContent = `${avgFacultyUtil}% Avg Faculty Workload`;
  }

  tbody.innerHTML = html;
}

function openFacultyProfileModal(instId) {
  const inst = masterInstructors.find(i => Number(i.id) === Number(instId));
  if (!inst) return;

  const dept = masterDepartments.find(d => Number(d.id) === Number(inst.department_id)) || {};
  const assignedSlots = currentTimetableEntries.filter(e => Number(e.instructor_id) === Number(inst.id));

  const courseMap = {};
  let totalCreditHours = 0;
  assignedSlots.forEach(slot => {
    const course = masterCourses.find(c => Number(c.id) === Number(slot.course_id));
    const credit = course ? (Number(course.credit_hours) || 3) : 3;
    if (!courseMap[slot.course_id]) {
      courseMap[slot.course_id] = {
        code: course ? course.course_code : 'CRS',
        name: course ? course.course_name : 'Course',
        credit,
        sem: course ? course.semester : 1
      };
      totalCreditHours += credit;
    }
  });

  const targetHours = Number(inst.max_credit_hours) || 12;
  const workloadPct = Math.min(100, Math.round((totalCreditHours / targetHours) * 100));
  const statusObj = getUtilizationStatus(workloadPct);

  const container = document.getElementById('modalFacultyProfileBody');
  if (!container) return;

  container.innerHTML = `
    <div class="faculty-profile-card p-3 glass-card mb-4" style="border-top: 4px solid ${dept.color || '#006633'};">
      <div class="flex-between">
        <div style="display:flex; align-items:center; gap:16px;">
          <div class="stat-icon bg-purple" style="width:60px; height:60px; font-size:1.8rem;">
            <i class="fa-solid fa-user-tie"></i>
          </div>
          <div>
            <h3 class="m-0">${inst.name}</h3>
            <div class="mt-1">
              <span class="badge bg-purple" style="color:#fff;">${inst.designation || 'Lecturer'}</span>
              <span class="badge" style="background:${dept.color || '#006633'}; color:#fff; margin-left:6px;">${dept.name} (${dept.code})</span>
            </div>
          </div>
        </div>
        <div>
          <span class="badge ${statusObj.badgeClass}" style="color:${statusObj.badgeColor}; font-size:0.95rem; padding:8px 14px;">
            ${statusObj.label}
          </span>
        </div>
      </div>
    </div>

    <!-- Contact Info Grid (Requirement 21) -->
    <h4 class="mb-3"><i class="fa-solid fa-address-book" style="color:var(--primary-color);"></i> Official Contact Information & Office Details</h4>
    <div class="stat-cards-grid stat-cards-3 mb-4">
      <div class="stat-card">
        <div class="stat-icon bg-blue"><i class="fa-solid fa-envelope"></i></div>
        <div class="stat-info">
          <span class="stat-label">Official Email</span>
          <span class="stat-value" style="font-size:0.95rem;">${inst.email ? `<a href="mailto:${inst.email}">${inst.email}</a>` : 'Not Specified'}</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon bg-green"><i class="fa-solid fa-phone"></i></div>
        <div class="stat-info">
          <span class="stat-label">Official Contact Phone / Ext</span>
          <span class="stat-value" style="font-size:0.95rem;">${inst.phone || '+92 42 99029200 (Ext 104)'}</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon bg-orange"><i class="fa-solid fa-building-user"></i></div>
        <div class="stat-info">
          <span class="stat-label">Office Room Location</span>
          <span class="stat-value" style="font-size:0.95rem;">${inst.office_room || 'Academic Block, Faculty Office 102'}</span>
        </div>
      </div>
    </div>

    <!-- Teaching Workload Meter (Requirement 20) -->
    <div class="card glass-card mb-4 p-3">
      <h4><i class="fa-solid fa-chart-line"></i> Teaching Workload & Credit Hours Meter</h4>
      <div class="mt-2">
        <div class="flex-between text-sm mb-1">
          <span>Assigned Credit Hours: <strong>${totalCreditHours} / ${targetHours} Hours</strong></span>
          <span><strong>${workloadPct}% Workload</strong></span>
        </div>
        <div class="progress-bar-bg" style="height:12px; background:#e2e8f0; border-radius:6px; overflow:hidden;">
          <div style="width:${workloadPct}%; height:100%; background:${statusObj.color}; transition: width 0.4s;"></div>
        </div>
      </div>
    </div>

    <!-- Assigned Courses Matrix -->
    <h4><i class="fa-solid fa-book-bookmark"></i> Assigned Academic Courses (${Object.keys(courseMap).length})</h4>
    <div class="table-responsive">
      <table class="uet-table text-sm">
        <thead>
          <tr>
            <th>Course Code</th>
            <th>Course Name</th>
            <th>Credit Hours</th>
            <th>Semester</th>
          </tr>
        </thead>
        <tbody>
          ${Object.keys(courseMap).length === 0 ? '<tr><td colspan="4" class="text-muted text-center">No courses currently assigned in timetable.</td></tr>' :
            Object.values(courseMap).map(c => `
              <tr>
                <td><strong>${c.code}</strong></td>
                <td>${c.name}</td>
                <td><span class="badge bg-green" style="color:#fff;">${c.credit} Credit Hrs</span></td>
                <td>Semester ${c.sem}</td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    </div>
  `;

  openModal('modalFacultyProfile');
}

function openFacultyModalForDept(deptId) {
  closeModal('modalDeptResourceManage');
  openFacultyModal(null, deptId);
}

function openFacultyModal(editId = null, preSelectDeptId = null) {
  const form = document.getElementById('facultyMemberForm');
  if (form) form.reset();

  const editIdInput = document.getElementById('editFacultyId');
  if (editIdInput) editIdInput.value = editId || '';

  const title = document.getElementById('modalFacultyTitle');
  const btn = document.getElementById('btnFacultySubmit');

  const deptSelect = document.getElementById('facultyDeptId');
  if (deptSelect) {
    deptSelect.innerHTML = masterDepartments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
    if (preSelectDeptId) deptSelect.value = preSelectDeptId;
    else if (currentUser && currentUser.role === 'dept_admin' && currentUser.department_id) {
      deptSelect.value = currentUser.department_id;
    }
  }

  if (editId) {
    const inst = masterInstructors.find(i => Number(i.id) === Number(editId));
    if (inst) {
      if (title) title.innerHTML = `<i class="fa-solid fa-user-pen"></i> Edit Faculty Member`;
      if (btn) btn.textContent = 'Update Faculty Member';
      if (document.getElementById('facultyName')) document.getElementById('facultyName').value = inst.name;
      if (document.getElementById('facultyEmail')) document.getElementById('facultyEmail').value = inst.email || '';
      if (document.getElementById('facultyPhone')) document.getElementById('facultyPhone').value = inst.phone || '';
      if (document.getElementById('facultyOffice')) document.getElementById('facultyOffice').value = inst.office_room || '';
      if (document.getElementById('facultyMaxCredit')) document.getElementById('facultyMaxCredit').value = inst.max_credit_hours || 12;
      if (document.getElementById('facultyDesignation')) document.getElementById('facultyDesignation').value = inst.designation || 'Lecturer';
      if (deptSelect) deptSelect.value = inst.department_id;
    }
  } else {
    if (title) title.innerHTML = `<i class="fa-solid fa-user-plus"></i> Add Faculty Member`;
    if (btn) btn.textContent = 'Save Faculty Member';
  }

  openModal('modalFacultyForm');
}

async function handleSaveFacultyMember(event) {
  event.preventDefault();
  const editId = document.getElementById('editFacultyId').value;
  const name = document.getElementById('facultyName').value.trim();
  const email = document.getElementById('facultyEmail').value.trim();
  const phone = document.getElementById('facultyPhone') ? document.getElementById('facultyPhone').value.trim() : '';
  const office_room = document.getElementById('facultyOffice') ? document.getElementById('facultyOffice').value.trim() : '';
  const max_credit_hours = document.getElementById('facultyMaxCredit') ? document.getElementById('facultyMaxCredit').value : 12;
  const designation = document.getElementById('facultyDesignation').value;
  const department_id = document.getElementById('facultyDeptId').value;

  if (!name || !department_id) {
    alert('Faculty name and department are required!');
    return;
  }

  try {
    const url = editId ? `/api/instructors/${editId}` : '/api/instructors';
    const method = editId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, designation, department_id, phone, office_room, max_credit_hours })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save faculty member');

    closeModal('modalFacultyForm');
    await loadMasterData();
    alert(data.message || 'Faculty member saved successfully!');
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function deleteFacultyMember(id, name) {
  if (!confirm(`Are you sure you want to delete faculty member "${name}"?`)) return;

  try {
    const res = await fetch(`/api/instructors/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete faculty member');

    closeModal('modalDeptResourceManage');
    await loadMasterData();
    alert(data.message || 'Faculty member deleted successfully!');
  } catch (err) {
    alert('Error: ' + err.message);
  }
}
