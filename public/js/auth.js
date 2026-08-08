// UET KSK Authentication & Persistent Session Manager

let currentUser = null;

async function checkAuthSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      currentUser = data.user;
      localStorage.setItem('uet_saved_user', JSON.stringify(currentUser));
    } else {
      const saved = localStorage.getItem('uet_saved_user');
      if (saved) {
        try { currentUser = JSON.parse(saved); } catch (e) { currentUser = null; }
      }
    }
    updateAuthUI();
  } catch (err) {
    const saved = localStorage.getItem('uet_saved_user');
    if (saved) {
      try { currentUser = JSON.parse(saved); } catch (e) { currentUser = null; }
    }
    updateAuthUI();
  }
}

function updateAuthUI() {
  const landingSection = document.getElementById('viewLanding');
  const authenticatedLayout = document.getElementById('authenticatedLayout');

  const userProfileContainer = document.getElementById('userProfileContainer');
  const btnDashboardAddSlot = document.getElementById('btnDashboardAddSlot');
  const btnAddSlot = document.getElementById('btnAddSlot');
  const btnTreeAddDept = document.getElementById('btnTreeAddDept');
  const btnAddRoom = document.getElementById('btnAddRoom');
  const navAdminCreds = document.getElementById('navAdminCreds');
  const navImport = document.getElementById('navImport');
  const btnClearDeptTimetable = document.getElementById('btnClearDeptTimetable');
  const btnDashboardExcelImport = document.getElementById('btnDashboardExcelImport');

  if (currentUser) {
    // Show Authenticated Dashboard & Hide Public Landing Page
    if (landingSection) landingSection.style.display = 'none';
    if (authenticatedLayout) authenticatedLayout.style.display = 'flex';

    let deptBadgeHtml = '';
    if (currentUser.department_code) {
      deptBadgeHtml = `<span class="dept-pill" style="background:${currentUser.department_color || '#006633'}; color:#fff; margin-left:6px;">${currentUser.department_code}</span>`;
    }

    if (userProfileContainer) {
      userProfileContainer.innerHTML = `
        <div class="user-badge" style="display:flex; align-items:center; gap:10px;">
          <span class="user-name"><strong>${currentUser.full_name}</strong> ${deptBadgeHtml}</span>
          <button class="btn btn-outline btn-sm" onclick="handleLogout()">
            <i class="fa-solid fa-right-from-bracket"></i> Logout
          </button>
        </div>
      `;
    }

    if (currentUser.role === 'admin') {
      if (btnTreeAddDept) btnTreeAddDept.style.display = 'inline-flex';
      if (navAdminCreds) navAdminCreds.style.display = 'block';
      if (btnAddRoom) btnAddRoom.style.display = 'inline-flex';

      if (navImport) navImport.style.display = 'none';
      if (btnDashboardExcelImport) btnDashboardExcelImport.style.display = 'none';
      if (btnDashboardAddSlot) btnDashboardAddSlot.style.display = 'none';
      if (btnAddSlot) btnAddSlot.style.display = 'none';
      if (btnClearDeptTimetable) btnClearDeptTimetable.style.display = 'none';

    } else if (currentUser.role === 'dept_admin') {
      if (btnDashboardAddSlot) btnDashboardAddSlot.style.display = 'inline-flex';
      if (btnAddSlot) btnAddSlot.style.display = 'inline-flex';
      if (btnTreeAddDept) btnTreeAddDept.style.display = 'none';
      if (btnAddRoom) btnAddRoom.style.display = 'inline-flex';
      if (navAdminCreds) navAdminCreds.style.display = 'none';
      if (navImport) navImport.style.display = 'block';
      if (btnDashboardExcelImport) btnDashboardExcelImport.style.display = 'inline-flex';
      if (btnClearDeptTimetable) btnClearDeptTimetable.style.display = 'inline-flex';
    }
  } else {
    // Show Public Landing Page & Lock Authenticated Dashboard
    if (landingSection) landingSection.style.display = 'block';
    if (authenticatedLayout) authenticatedLayout.style.display = 'none';
  }
}

// RBAC Check Helper: Returns true ONLY if user can edit slots for deptId
function canUserEditDept(deptId) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return false;
  if (currentUser.role === 'dept_admin') {
    return Number(currentUser.department_id) === Number(deptId);
  }
  return false;
}

// Modal Trigger Functions
function openLoginModal() {
  document.getElementById('loginForm').reset();
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('loginModal').classList.add('active');
}

function closeLoginModal() {
  document.getElementById('loginModal').classList.remove('active');
}

function fillLogin(username, password) {
  document.getElementById('loginUsername').value = username;
  document.getElementById('loginPassword').value = password;
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const errDiv = document.getElementById('loginError');

  errDiv.style.display = 'none';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      errDiv.textContent = data.error || 'Login failed.';
      errDiv.style.display = 'block';
      return;
    }

    currentUser = data.user;
    localStorage.setItem('uet_saved_user', JSON.stringify(currentUser));

    closeLoginModal();
    updateAuthUI();
    await loadMasterData();
    await renderTimetable();
  } catch (err) {
    errDiv.textContent = 'Server connection error.';
    errDiv.style.display = 'block';
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    localStorage.removeItem('uet_saved_user');
    updateAuthUI();
  } catch (err) {
    console.error('Logout error:', err);
  }
}
