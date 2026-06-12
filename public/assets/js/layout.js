/* ============================================================
   ESIMS Layout Manager  — injects sidebar + topnav into pages
   ============================================================ */
'use strict';

const ROLE_NAV = {
  Administrator: ['dashboard','students','enrollment','programs','courses','results','certificates','interns','payments','lecturers','staff','reports','users'],
  Registrar:     ['dashboard','students','enrollment','certificates','interns','reports'],
  Accountant:    ['dashboard','payments','reports','students'],
  Lecturer:      ['dashboard','results','courses'],
};

function navItems(role) {
  const all = [
    { id:'dashboard',    href:'/dashboard.html',    icon:'fa-th-large',           label:'Dashboard',    section:'Main' },
    { id:'students',     href:'/students.html',     icon:'fa-user-graduate',      label:'Students',     section:'Academic' },
    { id:'enrollment',   href:'/enrollment.html',   icon:'fa-clipboard-list',     label:'Enrollment',   section:'Academic' },
    { id:'programs',     href:'/programs.html',     icon:'fa-book-open',          label:'Programs',     section:'Academic' },
    { id:'courses',      href:'/courses.html',      icon:'fa-chalkboard',         label:'Courses',      section:'Academic' },
    { id:'results',      href:'/results.html',      icon:'fa-chart-bar',          label:'Results',      section:'Academic' },
    { id:'certificates', href:'/certificates.html', icon:'fa-certificate',        label:'Certificates', section:'Academic' },
    { id:'interns',      href:'/interns.html',      icon:'fa-briefcase',          label:'Interns',      section:'Internship' },
    { id:'payments',     href:'/payments.html',     icon:'fa-money-bill-wave',    label:'Payments',     section:'Finance' },
    { id:'lecturers',    href:'/lecturers.html',    icon:'fa-chalkboard-teacher', label:'Lecturers',    section:'HR' },
    { id:'staff',        href:'/staff.html',        icon:'fa-users',              label:'Staff',        section:'HR' },
    { id:'reports',      href:'/reports.html',      icon:'fa-chart-pie',          label:'Reports',      section:'Reports' },
    { id:'users',        href:'/users.html',        icon:'fa-user-shield',        label:'Users',        section:'System' },
  ];
  const allowed = ROLE_NAV[role] || [];
  return all.filter(i => allowed.includes(i.id));
}

function buildSidebar(user) {
  const items = navItems(user.role);
  const currentPage = window.location.pathname.split('/').pop().replace('.html','') || 'dashboard';
  const sections = [...new Set(items.map(i => i.section))];

  const navHTML = sections.map(sec => {
    const links = items.filter(i => i.section === sec).map(i => `
      <a href="${i.href}" class="nav-link${currentPage===i.id?' active':''}">
        <i class="fas ${i.icon}"></i><span class="nav-text">${i.label}</span>
      </a>`).join('');
    return `<div class="nav-section"><span class="nav-label">${sec}</span>${links}</div>`;
  }).join('');

  return `
  <div class="sb-brand">
    <div class="sb-logo">ESC</div>
    <div class="sb-brand-text">
      <div class="brand-name">ESIMS</div>
      <div class="brand-tag">Eschosys Technologies</div>
    </div>
  </div>
  <div class="sb-nav">${navHTML}</div>
  <div class="sb-footer">
    <div class="sb-user">
      <img src="${avatarUrl(user.fullName)}" class="sb-avatar" alt="avatar">
      <div class="sb-foot-info">
        <div class="u-name">${user.fullName}</div>
        <div class="u-role">${user.role}</div>
      </div>
    </div>
  </div>`;
}

function buildTopnav(user, unread = 0) {
  return `
  <div class="topnav-left">
    <button class="btn-toggle" id="sidebarToggle"><i class="fas fa-bars"></i></button>
    <div class="search-wrap d-none d-md-flex">
      <i class="fas fa-search"></i>
      <input type="text" id="gsInput" placeholder="Search students, interns…" autocomplete="off">
    </div>
  </div>
  <div class="topnav-right">
    <button class="icon-btn" onclick="toggleDark()" title="Toggle theme"><i class="fas fa-moon" id="darkIcon"></i></button>
    <div class="dropdown">
      <button class="icon-btn" data-bs-toggle="dropdown">
        <i class="fas fa-bell"></i>
        ${unread > 0 ? `<span class="notif-dot">${unread > 9 ? '9+' : unread}</span>` : ''}
      </button>
      <ul class="dropdown-menu dropdown-menu-end shadow" style="width:300px;border-radius:12px;padding:.5rem" id="notifList">
        <li class="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
          <strong style="font-size:.85rem">Notifications</strong>
          <a href="#" style="font-size:.75rem" onclick="markAllRead(event)">Mark all read</a>
        </li>
        <li class="px-3 py-3 text-center text-muted" style="font-size:.82rem" id="notifEmpty">
          <i class="fas fa-bell-slash d-block mb-1" style="font-size:1.3rem;opacity:.3"></i>Loading…
        </li>
      </ul>
    </div>
    <div class="dropdown">
      <button class="d-flex align-items-center gap-2 border-0 bg-transparent" data-bs-toggle="dropdown" style="cursor:pointer">
        <img src="${avatarUrl(user.fullName)}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)" alt="avatar">
        <div class="d-none d-md-block text-start">
          <div style="font-size:.78rem;font-weight:700;color:var(--text);line-height:1.2">${user.fullName}</div>
          <div style="font-size:.68rem;color:var(--gray-500)">${user.role}</div>
        </div>
        <i class="fas fa-chevron-down d-none d-md-block" style="font-size:.65rem;color:var(--gray-500)"></i>
      </button>
      <ul class="dropdown-menu dropdown-menu-end shadow" style="border-radius:12px;min-width:190px">
        <li class="px-3 py-2 border-bottom"><div style="font-size:.8rem;font-weight:700">${user.fullName}</div><div style="font-size:.7rem;color:var(--gray-500)">${user.role}</div></li>
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item text-danger fw-600" href="#" onclick="doLogout(event)"><i class="fas fa-sign-out-alt me-2"></i>Logout</a></li>
      </ul>
    </div>
  </div>
  <div id="gs-results"></div>`;
}

async function initLayout() {
  // Guard: redirect if not logged in
  if (!Auth.isLoggedIn()) { window.location.href = '/index.html'; return; }

  const user = Auth.user();
  if (!user) { Auth.clear(); window.location.href = '/index.html'; return; }

  // Inject sidebar
  const sidebarEl = document.getElementById('sidebar');
  if (sidebarEl) sidebarEl.innerHTML = buildSidebar(user);

  // Load notifications count
  const notifRes = await API.notifs.list().catch(() => null);
  const unread   = notifRes?.unread || 0;

  // Inject topnav
  const topnavEl = document.getElementById('topnav');
  if (topnavEl) topnavEl.innerHTML = buildTopnav(user, unread);

  // Load notification items
  if (notifRes?.data) renderNotifs(notifRes.data);

  // Wire sidebar toggle
  document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);

  // Restore sidebar + dark mode
  const sb = document.getElementById('sidebar');
  if (window.innerWidth > 991 && localStorage.getItem('sb_collapsed') === '1') {
    sb?.classList.add('collapsed');
    document.querySelector('.main-content')?.classList.add('expanded');
  }
  initDarkMode();

  // Global search
  initGlobalSearch();

  // Show app
  document.getElementById('app')?.classList.remove('d-none');
  document.getElementById('pageLoader')?.classList.add('d-none');
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const mc = document.querySelector('.main-content');
  if (window.innerWidth <= 991) { sb?.classList.toggle('open'); }
  else {
    sb?.classList.toggle('collapsed');
    mc?.classList.toggle('expanded');
    localStorage.setItem('sb_collapsed', sb?.classList.contains('collapsed') ? '1' : '0');
  }
}

function renderNotifs(notifs) {
  const el = document.getElementById('notifEmpty');
  const list = document.getElementById('notifList');
  if (!list) return;
  if (!notifs.length) { if (el) el.innerHTML = '<i class="fas fa-bell-slash d-block mb-1" style="font-size:1.3rem;opacity:.3"></i>No notifications'; return; }
  if (el) el.remove();
  const colors = { info:'primary', success:'success', warning:'warning', danger:'danger' };
  const items = notifs.slice(0, 8).map(n => `
    <li><a class="dropdown-item d-flex gap-2 align-items-start py-2" href="${n.Link||'#'}">
      <span class="badge bg-${colors[n.Type]||'secondary'} mt-1" style="width:8px;height:8px;border-radius:50%;padding:0">&nbsp;</span>
      <div><div style="font-size:.79rem;font-weight:600">${n.Title}</div><div style="font-size:.71rem;color:var(--gray-500)">${fmtDateTime(n.CreatedAt)}</div></div>
    </a></li>`).join('');
  list.insertAdjacentHTML('beforeend', items);
}

async function markAllRead(e) {
  if (e) e.preventDefault();
  await API.notifs.readAll();
  document.querySelector('.notif-dot')?.remove();
}

async function doLogout(e) {
  e.preventDefault();
  await API.auth.logout();
  Auth.clear();
  window.location.href = '/index.html';
}

function initGlobalSearch() {
  const inp = document.getElementById('gsInput');
  const res = document.getElementById('gs-results');
  if (!inp || !res) return;
  let timer;
  inp.addEventListener('input', () => {
    clearTimeout(timer);
    const q = inp.value.trim();
    if (q.length < 2) { res.style.display = 'none'; return; }
    timer = setTimeout(async () => {
      const data = await API.search(q);
      if (!data?.results?.length) { res.style.display = 'none'; return; }
      res.innerHTML = data.results.map(r => `
        <a href="${r.url}" class="gs-item" style="text-decoration:none">
          <div class="gs-icon"><i class="fas ${r.icon}"></i></div>
          <div><div style="font-size:.82rem;font-weight:600;color:var(--text)">${r.name}</div>
               <div style="font-size:.72rem;color:var(--gray-500)">${r.type} · ${r.subtitle||''}</div></div>
        </a>`).join('');
      res.style.display = 'block';
    }, 300);
  });
  document.addEventListener('click', e => { if (!inp.contains(e.target)) res.style.display = 'none'; });
}

// Close mobile sidebar on outside click
document.addEventListener('click', e => {
  const sb = document.getElementById('sidebar');
  if (window.innerWidth <= 991 && sb?.classList.contains('open') && !sb.contains(e.target) && !e.target.closest('#sidebarToggle')) {
    sb.classList.remove('open');
  }
});
