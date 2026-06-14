/* ============================================================
   ESIMS - Shared Utilities
   ============================================================ */
'use strict';

// ── Toast Notifications ───────────────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
  let ctr = document.getElementById('toast-container');
  if (!ctr) { ctr = document.createElement('div'); ctr.id = 'toast-container'; document.body.appendChild(ctr); }
  const icons = { success:'fa-check-circle', error:'fa-times-circle', info:'fa-info-circle', warning:'fa-exclamation-triangle' };
  const colors = { success:'#198754', error:'#dc3545', info:'#0A4D8C', warning:'#ffc107' };
  const t = document.createElement('div');
  t.className = `toast-item ${type}`;
  t.innerHTML = `<i class="fas ${icons[type]||icons.info}" style="color:${colors[type]};font-size:1rem;flex-shrink:0;margin-top:1px"></i>
    <div style="flex:1;font-size:.845rem;font-weight:500;color:var(--text)">${message}</div>
    <button onclick="this.closest('.toast-item').remove()" style="background:none;border:none;cursor:pointer;color:var(--gray-500);padding:0;flex-shrink:0"><i class="fas fa-times"></i></button>`;
  ctr.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(110%)'; t.style.transition='all .4s'; }, duration - 500);
  setTimeout(() => t.remove(), duration);
}

// ── Loading State ─────────────────────────────────────────────
function setLoading(btn, on = true) {
  if (!btn) return;
  if (on) { btn._orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...'; }
  else     { btn.disabled = false; btn.innerHTML = btn._orig || 'Submit'; }
}

// ── Confirm Dialog ────────────────────────────────────────────
function confirmAction(msg = 'Are you sure? This cannot be undone.') { return confirm(msg); }

// ── Formatters ────────────────────────────────────────────────
function fmtCurrency(n) { return new Intl.NumberFormat('fr-CM').format(+n || 0) + ' FCFA'; }
function fmtDate(d, locale = 'fr-CM') {
  if (!d) return 'N/A';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDateTime(d) {
  if (!d) return 'N/A';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('fr-CM') + ' ' + dt.toLocaleTimeString('fr-CM', { hour:'2-digit', minute:'2-digit' });
}
function calcGrade(ca, exam) {
  // CA is out of 30, Exam is out of 70 — simple addition = score out of 100
  const f2 = Math.min(100, parseFloat((parseFloat(ca||0) + parseFloat(exam||0)).toFixed(2)));
  let g = 'F';
  if (f2>=90)g='A+'; else if(f2>=80)g='A'; else if(f2>=75)g='B+';
  else if(f2>=70)g='B'; else if(f2>=65)g='C+'; else if(f2>=60)g='C'; else if(f2>=50)g='D';
  return { final: f2, grade: g };
}
function gradeColor(g) {
  if(['A+','A'].includes(g)) return '#198754';
  if(['B+','B'].includes(g)) return '#0A4D8C';
  if(['C+','C'].includes(g)) return '#6c757d';
  if(g==='D') return '#ffc107';
  return '#dc3545';
}
function statusBadge(status) {
  const map = { Active:'success', Completed:'primary', Graduated:'primary', Issued:'success', Draft:'secondary', Revoked:'danger', Dropped:'danger', Suspended:'warning', Withdrawn:'secondary' };
  return `<span class="badge bg-${map[status]||'secondary'}">${status||'—'}</span>`;
}
function avatarUrl(name) {
  const enc = encodeURIComponent((name||'U').split(' ').map(p=>p[0]).join('').toUpperCase().slice(0,2));
  return `https://ui-avatars.com/api/?name=${enc}&background=0A4D8C&color=fff&size=128&bold=true`;
}

// ── Table Search ──────────────────────────────────────────────
function initTableSearch(inputId, tableId) {
  const inp = document.getElementById(inputId);
  const tbl = document.getElementById(tableId);
  if (!inp || !tbl) return;
  inp.addEventListener('input', () => {
    const q = inp.value.toLowerCase();
    tbl.querySelectorAll('tbody tr').forEach(r => { r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none'; });
  });
}

// ── Pagination Renderer ───────────────────────────────────────
function renderPagination(containerId, current, totalPages, onPage) {
  const el = document.getElementById(containerId);
  if (!el || totalPages <= 1) { if(el) el.innerHTML=''; return; }
  let h = '<nav aria-label="Page navigation"><ul class="pagination pagination-sm mb-0 flex-wrap">';
  h += `<li class="page-item${current<=1?' disabled':''}"><a class="page-link" href="#" data-p="${current-1}">‹</a></li>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i===1||i===totalPages||(i>=current-1&&i<=current+1)) { h += `<li class="page-item${i===current?' active':''}"><a class="page-link" href="#" data-p="${i}">${i}</a></li>`; }
    else if (i===current-2||i===current+2) { h += '<li class="page-item disabled"><span class="page-link">…</span></li>'; }
  }
  h += `<li class="page-item${current>=totalPages?' disabled':''}"><a class="page-link" href="#" data-p="${current+1}">›</a></li></ul></nav>`;
  el.innerHTML = h;
  el.querySelectorAll('[data-p]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); onPage(+a.dataset.p); }));
}

// ── Print ─────────────────────────────────────────────────────
function printElement(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const w = window.open('', '_blank', 'width=800,height=600');
  w.document.write(`<!DOCTYPE html><html><head><title>Print</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <style>body{padding:20px}@media print{.no-print{display:none!important}}</style>
    </head><body>${el.outerHTML}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`);
  w.document.close();
}

// ── Export CSV ────────────────────────────────────────────────
function exportCSV(tableId, filename = 'export.csv') {
  const tbl = document.getElementById(tableId);
  if (!tbl) return;
  const csv = Array.from(tbl.querySelectorAll('tr'))
    .map(r => Array.from(r.querySelectorAll('th,td')).map(c => `"${c.textContent.trim().replace(/"/g,'""')}"`).join(','))
    .join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename; a.click();
}

// ── Dark Mode ─────────────────────────────────────────────────
function initDarkMode() {
  const t = localStorage.getItem('esims_theme') || 'light';
  document.documentElement.setAttribute('data-theme', t);
  const ico = document.getElementById('darkIcon');
  if (ico) ico.className = t==='dark'?'fas fa-sun':'fas fa-moon';
}
function toggleDark() {
  const cur = document.documentElement.getAttribute('data-theme')||'light';
  const nxt = cur==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme', nxt);
  localStorage.setItem('esims_theme', nxt);
  const ico = document.getElementById('darkIcon');
  if (ico) ico.className = nxt==='dark'?'fas fa-sun':'fas fa-moon';
}

// ── URL Params Helper ─────────────────────────────────────────
function getParam(name) { return new URLSearchParams(window.location.search).get(name); }

// ── Form Serializer ───────────────────────────────────────────
function formToObj(formEl) {
  const obj = {};
  new FormData(formEl).forEach((v, k) => { obj[k] = v || null; });
  return obj;
}

// ── Populate Select ───────────────────────────────────────────
function populateSelect(selectEl, items, valueKey, labelKey, placeholder = 'Select...') {
  if (!selectEl) return;
  selectEl.innerHTML = `<option value="">${placeholder}</option>` +
    items.map(i => `<option value="${i[valueKey]}">${i[labelKey]}</option>`).join('');
}
