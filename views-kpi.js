// ════════════════════════════════════════════════════════════════════
// views-kpi.js — Stage 2: KPI Planner admin screens.
//
// Three sections in one view, switched via a simple local tab state
// (this.state._kpiAdminTab): Directorates, KPIs, Enter Results. All data
// operations call straight into api-kpi.js's already-tested functions —
// this file is purely the view layer.
//
// renderKpiDirectorView() at the bottom is a placeholder only — the real
// view-only KPI card dashboard is Stage 4, not yet built. It exists here
// so the new Director login (Stage 3) has somewhere real to land instead
// of a dead link.
// ════════════════════════════════════════════════════════════════════

// Every unique department name across Ops + Maintenance rosters — used to
// build the checkbox picker when mapping departments to a directorate.
// Deliberately spans both categories: "broader operational KPIs" were
// confirmed to potentially cover either.
app._kpiAllDepartments = function() {
    const ops = (this.state.employees || []).map(e => e.department).filter(Boolean);
    const maint = (this.state.maintenanceStaffUsers || []).map(e => e.department).filter(Boolean);
    return [...new Set([...ops, ...maint])].sort();
};

// Pure helper: generates the valid period labels for a given period_type
// and year — e.g. monthly -> ['2027-01', ..., '2027-12'], quarterly ->
// ['2027-Q1', ..., '2027-Q4'], yearly -> ['2027']. No state reads beyond
// this.state.months (for labels), safe to unit test directly.
app.kpiPeriodOptions = function(periodType, year) {
    if (periodType === 'monthly') {
        return this.state.months.map((m, i) => ({ value: `${year}-${String(i + 1).padStart(2, '0')}`, label: `${m} ${year}` }));
    }
    if (periodType === 'quarterly') {
        return [1, 2, 3, 4].map(q => ({ value: `${year}-Q${q}`, label: `Q${q} ${year}` }));
    }
    if (periodType === 'yearly') {
        return [{ value: `${year}`, label: `${year}` }];
    }
    return [];
};

app.renderKpiPlannerView = function() {
    const content = document.getElementById('contentArea');
    const tab = this.state._kpiAdminTab || 'directorates';
    const esc = this._escHtml.bind(this);

    // One-time backfill: every directorate should always have all 4
    // standard lines, including ones created before this structure
    // existed. Guarded to run once per session (not on every render) and
    // fire-and-forget — ensureKpiLinesForDirectorate is idempotent, so
    // this is safe even if it overlaps with a later call; any lines it
    // adds simply appear on the next re-render.
    if (!this._kpiLinesBackfilled) {
        this._kpiLinesBackfilled = true;
        (this.state.kpiDirectorates || []).forEach(d => {
            this.ensureKpiLinesForDirectorate(d.id).then(() => {
                if (this.state.activeView === 'kpiPlannerAdmin') this.renderKpiPlannerView();
            });
        });
    }

    // ── Company switcher (OMC / Audit) ──
    // Two companies operate as fully independent KPI setups sharing the
    // same screens: every directorate belongs to exactly one company, and
    // everything else (lines, KPI definitions, results) cascades from its
    // directorate — so scoping by company here is enough to keep OMC and
    // Audit data completely separate everywhere below. This one switcher
    // is the single "Company" step of the cascade for every tab, rather
    // than a separate identical dropdown repeated on each tab.
    const selectedCompany = this.state._kpiSelectedCompany || 'OMC';
    const companyBtn = (name) => `
        <button onclick="app.state._kpiSelectedCompany='${name}'; app.state._kpiResultsSelectedDirectorateId=null; app.state._kpiResultsSelectedId=null; app.state._kpiDefFilterDirectorateId=null; app.state._kpiDefFilterKpiId=null; app.renderKpiPlannerView();"
            style="padding:7px 18px;border-radius:999px;font-weight:700;font-size:0.8rem;border:1.5px solid ${selectedCompany === name ? '#1d4ed8' : '#e5e7eb'};background:${selectedCompany === name ? '#1d4ed8' : '#fff'};color:${selectedCompany === name ? '#fff' : '#374151'};cursor:pointer;">
            ${esc(name)}
        </button>
    `;

    const tabBtn = (key, icon, label) => `
        <button onclick="app.state._kpiAdminTab='${key}';app.renderKpiPlannerView();"
            class="px-4 py-2 rounded-lg font-semibold text-sm ${tab === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}">
            ${icon} ${label}
        </button>
    `;

    let sectionHtml = '';
    if (tab === 'directorates') sectionHtml = this._renderKpiDirectoratesSection();
    else if (tab === 'kpis') sectionHtml = this._renderKpiDefinitionsSection();
    else if (tab === 'results') sectionHtml = this._renderKpiResultsSection();
    else if (tab === 'preview') sectionHtml = this._renderKpiPreviewSection();
    else if (tab === 'import') sectionHtml = this._renderKpiImportSection();
    else sectionHtml = this._renderKpiUsersSection();

    content.innerHTML = `
        <div class="max-w-5xl mx-auto">
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-gray-800">📊 KPI Planner</h2>
                <p class="text-gray-500 text-sm mt-1">Define directorates, KPIs, and enter results.</p>
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                <span style="font-size:0.75rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.03em;">Company</span>
                <div style="display:flex;gap:6px;">
                    ${companyBtn('OMC')}
                    ${companyBtn('Audit')}
                </div>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
                ${tabBtn('directorates', '🏛️', 'Directorates')}
                ${tabBtn('kpis', '📈', 'KPIs')}
                ${tabBtn('results', '✏️', 'Enter Results')}
                ${tabBtn('preview', '👁️', 'Preview Dashboard')}
                ${tabBtn('import', '📥', 'Import from Excel')}
                ${tabBtn('users', '👥', 'Manage Users')}
            </div>
            ${sectionHtml}
        </div>
    `;

    // The Preview Dashboard tab embeds the same chart canvases the
    // Director/Viewer dashboard uses — draw them now that this HTML is
    // actually in the DOM (mirrors renderKpiDirectorView's own call to
    // this after its own content.innerHTML assignment).
    if (tab === 'preview' && this.state._kpiPreviewDirectorateId) {
        this._drawKpiDashboardCharts(this.state._kpiPreviewDirectorateId, this.state._kpiPreviewYear || new Date().getFullYear());
    }
};

// ════════════════════════════════════════════════════════════════════
// Section 1: Directorates
// ════════════════════════════════════════════════════════════════════
app._renderKpiDirectoratesSection = function() {
    const esc = this._escHtml.bind(this);
    const selectedCompany = this.state._kpiSelectedCompany || 'OMC';
    // Directorates created before "company" existed are treated as OMC —
    // this is also what the DB column defaults to, so this fallback is
    // purely a safety net for state that predates a migration/reload.
    const directorates = (this.state.kpiDirectorates || []).filter(d => (d.company || 'OMC') === selectedCompany);

    const rows = directorates.map(d => {
        const lines = (this.state.kpiDirectorateDepartments || []).filter(m => m.directorate_id === d.id);
        const kpiCount = (this.state.kpiDefinitions || []).filter(k => k.directorate_id === d.id).length;
        return `
            <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <p style="font-weight:700;">${esc(d.name)}</p>
                    <p style="font-size:0.75rem;color:#6b7280;">Lines: ${lines.map(l => esc(l.department_name)).join(', ') || '—'} · ${kpiCount} KPI${kpiCount !== 1 ? 's' : ''}</p>
                </div>
                <div style="display:flex;gap:8px;">
                    <button onclick="app.openKpiDirectorateModal(${d.id})" style="padding:6px 12px;background:#eff6ff;color:#1d4ed8;border-radius:8px;font-size:0.78rem;font-weight:700;">Edit</button>
                    <button onclick="app.confirmDeleteKpiDirectorate(${d.id})" style="padding:6px 12px;background:#fef2f2;color:#991b1b;border-radius:8px;font-size:0.78rem;font-weight:700;">Delete</button>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="bg-white rounded-xl shadow-md p-5">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
                <h3 class="text-lg font-bold text-gray-800">${esc(selectedCompany)} Directorates</h3>
                <div style="display:flex;gap:8px;">
                    ${selectedCompany === 'OMC' && directorates.length > 0 ? `
                        <button onclick="app.doCopyKpiOmcStructureToAudit()" style="padding:8px 16px;background:#f3f4f6;color:#374151;border-radius:8px;font-size:0.85rem;font-weight:700;">📋 Copy OMC → Audit</button>
                    ` : ''}
                    <button onclick="app.openKpiDirectorateModal(null)" style="padding:8px 16px;background:#1d4ed8;color:#fff;border-radius:8px;font-size:0.85rem;font-weight:700;">+ Add Directorate</button>
                </div>
            </div>
            <p style="font-size:0.75rem;color:#9ca3af;margin-bottom:12px;">Every directorate automatically has 4 operational lines — L3, L4, L5, L6. KPIs are configured per line when you add them. New directorates are added under <strong>${esc(selectedCompany)}</strong> — switch company above to add one for the other side.</p>
            ${directorates.length === 0 ? `<p class="text-sm text-gray-400 text-center py-6">No ${esc(selectedCompany)} directorates yet — add one to get started.</p>` : rows}
        </div>

        <!-- Directorate modal — name only, the 4 lines are created automatically -->
        <div id="kpiDirectorateModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;padding:20px;">
            <div style="background:#fff;border-radius:16px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:28px;">
                <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:16px;" id="kpiDirectorateModalTitle">Add Directorate</h3>
                <input type="hidden" id="kpiDirectorateEditId" value="" />
                <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Directorate Name</label>
                <input type="text" id="kpiDirectorateName" placeholder="e.g. Operations Directorate"
                    style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:8px;" />
                <p style="font-size:0.72rem;color:#9ca3af;margin-bottom:20px;">Lines L3, L4, L5, and L6 will be created automatically under this directorate. It will belong to <strong>${esc(selectedCompany)}</strong>.</p>
                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button onclick="app.closeKpiDirectorateModal()" style="padding:9px 18px;border-radius:8px;font-weight:600;font-size:0.85rem;border:1.5px solid #e5e7eb;background:#fff;color:#374151;">Cancel</button>
                    <button onclick="app.saveKpiDirectorateModal()" style="padding:9px 18px;border-radius:8px;font-weight:700;font-size:0.85rem;border:none;background:#1d4ed8;color:#fff;">Save</button>
                </div>
            </div>
        </div>
    `;
};

app.openKpiDirectorateModal = function(directorateId) {
    const existing = directorateId ? (this.state.kpiDirectorates || []).find(d => d.id === directorateId) : null;
    document.getElementById('kpiDirectorateModalTitle').textContent = existing ? 'Edit Directorate' : 'Add Directorate';
    document.getElementById('kpiDirectorateEditId').value = directorateId || '';
    document.getElementById('kpiDirectorateName').value = existing ? existing.name : '';
    document.getElementById('kpiDirectorateModal').style.display = 'flex';
};

app.closeKpiDirectorateModal = function() {
    document.getElementById('kpiDirectorateModal').style.display = 'none';
};

app.saveKpiDirectorateModal = async function() {
    const name = (document.getElementById('kpiDirectorateName').value || '').trim();
    if (!name) { this.showToast('Please enter a directorate name.', 'error'); return; }
    const existingId = document.getElementById('kpiDirectorateEditId').value;
    const idNum = existingId ? parseInt(existingId, 10) : null;

    const saved = await this.saveKpiDirectorate(name, idNum, this.state._kpiSelectedCompany || 'OMC');
    if (!saved) return;

    // Idempotent — only adds whichever of L3/L4/L5/L6 don't already exist
    // for this directorate, never touches/replaces any that do.
    await this.ensureKpiLinesForDirectorate(saved.id);

    this.closeKpiDirectorateModal();
    this.renderKpiPlannerView();
};

app.confirmDeleteKpiDirectorate = async function(id) {
    if (!confirm('Delete this directorate? This also deletes every KPI defined under it and all their recorded results. This cannot be undone.')) return;
    const ok = await this.deleteKpiDirectorate(id);
    if (ok) this.renderKpiPlannerView();
};

app.doCopyKpiOmcStructureToAudit = async function() {
    const ok = confirm(
        'Copy every OMC directorate, line, and KPI (with its thresholds and owners) into Audit?\n\n' +
        'Recorded results are NOT copied — Audit starts with the same KPI structure but a clean slate of entered data.\n\n' +
        'Any OMC directorate whose name already exists under Audit will be skipped, so this is safe to run more than once.'
    );
    if (!ok) return;
    this.showToast('Copying OMC structure to Audit…', 'success');
    const result = await this.copyKpiOmcStructureToAudit();
    const parts = [`${result.directorates} directorate${result.directorates !== 1 ? 's' : ''}`, `${result.kpis} KPI${result.kpis !== 1 ? 's' : ''}`];
    if (result.owners > 0) parts.push(`${result.owners} owner record${result.owners !== 1 ? 's' : ''}`);
    let msg = `Copied ${parts.join(', ')} to Audit.`;
    if (result.skipped > 0) msg += ` (${result.skipped} directorate${result.skipped !== 1 ? 's' : ''} skipped — already existed under Audit.)`;
    this.showToast(msg, 'success');
    this.renderKpiPlannerView();
};

// ════════════════════════════════════════════════════════════════════
// Section 2: KPI Definitions
// ════════════════════════════════════════════════════════════════════
app._renderKpiDefinitionsSection = function() {
    const esc = this._escHtml.bind(this);
    const selectedCompany = this.state._kpiSelectedCompany || 'OMC';
    const directorates = (this.state.kpiDirectorates || []).filter(d => (d.company || 'OMC') === selectedCompany);
    const definitions = (this.state.kpiDefinitions || []).filter(k => directorates.some(d => d.id === k.directorate_id));

    if (directorates.length === 0) {
        return `
            <div class="bg-white rounded-xl shadow-md p-5">
                <p class="text-sm text-gray-400 text-center py-6">Add a ${esc(selectedCompany)} directorate first — every KPI must belong to one.</p>
            </div>
        `;
    }

    // ── Filter: KPI Period -> Directorate -> KPI Name ──
    // Narrows the list below; Company is the shared switcher at the top
    // of the page, so it's already applied to `directorates`/`definitions`
    // above. KPI Name defaults to "All" here (unlike Enter Results, this
    // is a browsing/management list, not a single-record entry form).
    const periodTypes = ['monthly', 'quarterly', 'yearly'];
    const periodLabels = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };
    let filterPeriod = this.state._kpiDefFilterPeriod;
    if (!periodTypes.includes(filterPeriod)) {
        filterPeriod = 'monthly';
        this.state._kpiDefFilterPeriod = filterPeriod;
    }

    let filterDirectorateId = this.state._kpiDefFilterDirectorateId;
    if (filterDirectorateId == null || !directorates.some(d => d.id === filterDirectorateId)) {
        filterDirectorateId = directorates[0].id;
        this.state._kpiDefFilterDirectorateId = filterDirectorateId;
    }

    // Membership here is by OWNERSHIP SHARE, not just home directorate_id
    // — a KPI defined under Operations but 5%-owned by Finance should
    // still show up when browsing Finance, same as it does on Finance's
    // dashboard. Editing/deleting still always acts on the one real
    // record (openKpiDefinitionModal reads the KPI's actual
    // directorate_id, never the filter), so this is purely a visibility
    // fix, not a duplication of the underlying data.
    const kpisInDirPeriod = definitions.filter(k => k.period_type === filterPeriod && this._kpiOwnershipWeight(k, filterDirectorateId) > 0);

    let filterKpiId = this.state._kpiDefFilterKpiId; // null/undefined = "All KPIs"
    if (filterKpiId != null && !kpisInDirPeriod.some(k => k.id === filterKpiId)) {
        filterKpiId = null;
        this.state._kpiDefFilterKpiId = null;
    }

    const visibleDefinitions = filterKpiId != null ? kpisInDirPeriod.filter(k => k.id === filterKpiId) : kpisInDirPeriod;

    const periodFilterOptions = periodTypes.map(p => `<option value="${p}" ${p === filterPeriod ? 'selected' : ''}>${periodLabels[p]}</option>`).join('');
    const directorateFilterOptions = directorates.map(d => `<option value="${d.id}" ${d.id === filterDirectorateId ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
    const kpiNameFilterOptions = `<option value="">All KPIs</option>` + kpisInDirPeriod.map(k => {
        const w = this._kpiOwnershipWeight(k, filterDirectorateId);
        return `<option value="${k.id}" ${k.id === filterKpiId ? 'selected' : ''}>${esc(this._kpiDisplayNameWithLine(k))}${w < 1 ? ` (${Math.round(w * 100)}% share)` : ''}</option>`;
    }).join('');

    const rows = visibleDefinitions.map(k => {
        const line = (this.state.kpiDirectorateDepartments || []).find(d => d.id === k.department_id);
        const owners = (this.state.kpiOwners || []).filter(o => o.kpi_definition_id === k.id);
        // Show the owner relevant to the directorate CURRENTLY BEING
        // VIEWED, not just whoever has the highest overall percentage —
        // filtering to Finance (a 10% share) must show Finance's own
        // owner (e.g. Tariq), never the 90% owner from a different
        // directorate (e.g. Hani), even though Hani has the bigger share.
        const filterDir = directorates.find(d => d.id === filterDirectorateId);
        const contextOwner = filterDir ? owners.find(o => o.owner_dept === filterDir.name) : null;
        const displayOwner = contextOwner || (owners.length > 0 ? owners.reduce((a, b) => (b.owner_percentage || 0) > (a.owner_percentage || 0) ? b : a) : null);
        const otherOwnerCount = owners.length - (displayOwner ? 1 : 0);
        const viewWeight = this._kpiOwnershipWeight(k, filterDirectorateId);
        const isSharedView = viewWeight < 1 && viewWeight > 0;
        const homeDir = directorates.find(d => d.id === k.directorate_id);
        const finalWeight = this._kpiFinalWeight(k);
        const periodLabel = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' }[k.period_type] || k.period_type;
        return `
            <tr style="border-top:1px solid #f3f4f6;">
                <td style="padding:10px 12px;">
                    <p style="font-weight:700;">${esc(k.name)}</p>
                    ${k.category ? `<p style="font-size:0.72rem;color:#6b7280;">${esc(k.category)}</p>` : ''}
                    ${isSharedView ? `<span style="font-size:0.7rem;color:#7c3aed;font-weight:700;">🤝 ${Math.round(viewWeight * 100)}% share (home: ${esc(homeDir ? homeDir.name : 'unknown')})</span>` : ''}
                </td>
                <td style="padding:10px 12px;">${k.area ? esc(k.area) : '<span style="color:#d1d5db;">—</span>'}</td>
                <td style="padding:10px 12px;font-weight:700;">${line ? esc(line.department_name) : '—'}</td>
                <td style="padding:10px 12px;">${esc(periodLabel)}</td>
                <td style="padding:10px 12px;text-align:right;font-weight:700;color:${finalWeight != null ? '#059669' : '#d1d5db'};">${finalWeight != null ? (finalWeight * 100).toFixed(1) + '%' : '—'}</td>
                <td style="padding:10px 12px;">${displayOwner ? esc(displayOwner.owner_name || displayOwner.owner_dept) + (displayOwner.owner_percentage != null ? ` <span style="color:#9ca3af;font-size:0.72rem;">(${Math.round(displayOwner.owner_percentage * 100)}%)</span>` : '') + (otherOwnerCount > 0 ? ` <span style="color:#9ca3af;font-size:0.72rem;">+${otherOwnerCount}</span>` : '') : '<span style="color:#d1d5db;">—</span>'}</td>
                <td style="padding:10px 12px;text-align:right;color:${k.exceptional_value != null ? '#059669' : '#d1d5db'};">${k.exceptional_value != null ? esc(String(k.exceptional_value)) : '—'}</td>
                <td style="padding:10px 12px;text-align:right;color:${k.target_value != null ? '#1d4ed8' : '#d1d5db'};font-weight:600;">${k.target_value != null ? esc(String(k.target_value)) : '—'}</td>
                <td style="padding:10px 12px;text-align:right;color:${k.unacceptable_value != null ? '#dc2626' : '#d1d5db'};">${k.unacceptable_value != null ? esc(String(k.unacceptable_value)) : '—'}</td>
                <td style="padding:10px 12px;text-align:right;white-space:nowrap;">
                    <button onclick="app.openKpiDefinitionModal(${k.id})" title="Edit" style="background:none;border:none;cursor:pointer;font-size:0.95rem;">✏️</button>
                    <button onclick="app.confirmDeleteKpiDefinition(${k.id})" title="Delete" style="background:none;border:none;cursor:pointer;font-size:0.95rem;">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');

    // Directorate options for the Add/Edit KPI modal — scoped to the
    // active company so a KPI can never be attached to a directorate
    // belonging to the other one.
    const directorateOptions = directorates.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');

    return `
        <div class="bg-white rounded-xl shadow-md p-5 mb-5">
            <h4 style="font-size:0.8rem;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.03em;margin-bottom:10px;">Filter</h4>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <div style="min-width:140px;">
                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">KPI Period</label>
                    <select onchange="app.state._kpiDefFilterPeriod=this.value; app.state._kpiDefFilterKpiId=null; app.renderKpiPlannerView();"
                        style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.82rem;box-sizing:border-box;">
                        ${periodFilterOptions}
                    </select>
                </div>
                <div style="flex:1;min-width:180px;">
                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Directorate</label>
                    <select onchange="app.state._kpiDefFilterDirectorateId=parseInt(this.value,10); app.state._kpiDefFilterKpiId=null; app.renderKpiPlannerView();"
                        style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.82rem;box-sizing:border-box;">
                        ${directorateFilterOptions}
                    </select>
                </div>
                <div style="flex:1;min-width:180px;">
                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">KPI Name</label>
                    <select onchange="app.state._kpiDefFilterKpiId=this.value?parseInt(this.value,10):null; app.renderKpiPlannerView();"
                        style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.82rem;box-sizing:border-box;">
                        ${kpiNameFilterOptions}
                    </select>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-xl shadow-md p-5">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <h3 class="text-lg font-bold text-gray-800">${esc(selectedCompany)} KPIs</h3>
                <button onclick="app.openKpiDefinitionModal(null)" style="padding:8px 16px;background:#1d4ed8;color:#fff;border-radius:8px;font-size:0.85rem;font-weight:700;">+ Add KPI</button>
            </div>
            ${visibleDefinitions.length === 0 ? '<p class="text-sm text-gray-400 text-center py-6">No KPIs match this filter.</p>' : `
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                        <thead>
                            <tr style="text-align:left;color:#6b7280;font-size:0.72rem;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">
                                <th style="padding:8px 12px;">KPI</th>
                                <th style="padding:8px 12px;">Area</th>
                                <th style="padding:8px 12px;">Line</th>
                                <th style="padding:8px 12px;">Frequency</th>
                                <th style="padding:8px 12px;text-align:right;">Final Weight</th>
                                <th style="padding:8px 12px;">Owner</th>
                                <th style="padding:8px 12px;text-align:right;">Exceptional</th>
                                <th style="padding:8px 12px;text-align:right;">Acceptable</th>
                                <th style="padding:8px 12px;text-align:right;">Unacceptable</th>
                                <th style="padding:8px 12px;text-align:right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `}
        </div>

        <!-- KPI definition modal -->
        <div id="kpiDefinitionModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;padding:20px;">
            <div style="background:#fff;border-radius:16px;max-width:480px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:28px;">
                <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:16px;" id="kpiDefinitionModalTitle">Add KPI</h3>
                <input type="hidden" id="kpiDefinitionEditId" value="" />

                <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Directorate</label>
                <select id="kpiDefDirectorate" onchange="app._populateKpiDefLineOptions()" style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:14px;">
                    ${directorateOptions}
                </select>

                <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Line</label>
                <select id="kpiDefLine" style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:14px;"></select>

                <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">KPI Name</label>
                <input type="text" id="kpiDefName" placeholder="e.g. On-Time Performance"
                    style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:14px;" />

                <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Category (optional)</label>
                <input type="text" id="kpiDefCategory" placeholder="e.g. Safety, Punctuality, Incidents"
                    style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:14px;" />

                <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Performance Thresholds</label>
                <p style="font-size:0.72rem;color:#9ca3af;margin-bottom:8px;">Acceptable is what shows as "Target" on the Executive Director dashboard. Exceptional and Unacceptable are for Planner reference only.</p>
                <div style="display:flex;gap:10px;margin-bottom:14px;">
                    <div style="flex:1;">
                        <label style="font-size:0.75rem;font-weight:600;color:#059669;display:block;margin-bottom:6px;">Exceptional</label>
                        <input type="number" id="kpiDefExceptional" step="any"
                            style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;" />
                    </div>
                    <div style="flex:1;">
                        <label style="font-size:0.75rem;font-weight:600;color:#1d4ed8;display:block;margin-bottom:6px;">Acceptable (Target)</label>
                        <input type="number" id="kpiDefTarget" step="any"
                            style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;" />
                    </div>
                    <div style="flex:1;">
                        <label style="font-size:0.75rem;font-weight:600;color:#dc2626;display:block;margin-bottom:6px;">Unacceptable</label>
                        <input type="number" id="kpiDefUnacceptable" step="any"
                            style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;" />
                    </div>
                </div>

                <div style="display:flex;gap:10px;margin-bottom:14px;">
                    <div style="flex:1;">
                        <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Unit</label>
                        <input type="text" id="kpiDefUnit" placeholder="%, count, days"
                            style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;" />
                    </div>
                </div>

                <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">How often is this measured?</label>
                <select id="kpiDefPeriodType" style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:14px;">
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                </select>

                <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Which direction is "good"?</label>
                <select id="kpiDefDirection" style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:20px;">
                    <option value="higher_is_better">Higher is better (e.g. Punctuality %)</option>
                    <option value="lower_is_better">Lower is better (e.g. Incident count)</option>
                </select>

                <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Weight Hierarchy (optional)</label>
                <p style="font-size:0.72rem;color:#9ca3af;margin-bottom:8px;">Separate from Directorate/Line above — feeds Final Weight = Area % × Level 1 % × Level 2 % × Level 3 %. Leave blank if this KPI isn't part of the weighted scorecard.</p>
                <div style="display:flex;gap:8px;margin-bottom:8px;">
                    <input type="text" id="kpiDefArea" placeholder="Area (e.g. Operations)" style="flex:2;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.8rem;box-sizing:border-box;" />
                    <input type="number" id="kpiDefAreaPct" placeholder="Area %" step="any" style="flex:1;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.8rem;box-sizing:border-box;" />
                </div>
                <div style="display:flex;gap:8px;margin-bottom:8px;">
                    <input type="text" id="kpiDefLevel1" placeholder="Level 1" style="flex:2;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.8rem;box-sizing:border-box;" />
                    <input type="number" id="kpiDefLevel1Pct" placeholder="Level 1 %" step="any" style="flex:1;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.8rem;box-sizing:border-box;" />
                </div>
                <div style="display:flex;gap:8px;margin-bottom:8px;">
                    <input type="text" id="kpiDefLevel2" placeholder="Level 2" style="flex:2;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.8rem;box-sizing:border-box;" />
                    <input type="number" id="kpiDefLevel2Pct" placeholder="Level 2 %" step="any" style="flex:1;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.8rem;box-sizing:border-box;" />
                </div>
                <div style="display:flex;gap:8px;margin-bottom:20px;">
                    <input type="number" id="kpiDefLevel3Pct" placeholder="Level 3 % (this KPI's own share)" step="any" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.8rem;box-sizing:border-box;" />
                </div>

                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button onclick="app.closeKpiDefinitionModal()" style="padding:9px 18px;border-radius:8px;font-weight:600;font-size:0.85rem;border:1.5px solid #e5e7eb;background:#fff;color:#374151;">Cancel</button>
                    <button onclick="app.saveKpiDefinitionModal()" style="padding:9px 18px;border-radius:8px;font-weight:700;font-size:0.85rem;border:none;background:#1d4ed8;color:#fff;">Save</button>
                </div>
            </div>
        </div>
    `;
};

// Repopulates the Line dropdown to match whichever directorate is
// currently selected — called on directorate change, and once right
// after the modal opens to seed the initial state.
app._populateKpiDefLineOptions = function(selectedLineId) {
    const esc = this._escHtml.bind(this);
    const directorateId = parseInt(document.getElementById('kpiDefDirectorate').value, 10);
    const lines = (this.state.kpiDirectorateDepartments || []).filter(d => d.directorate_id === directorateId);
    document.getElementById('kpiDefLine').innerHTML = lines.length === 0
        ? '<option value="">— No lines found —</option>'
        : lines.map(l => `<option value="${l.id}" ${selectedLineId === l.id ? 'selected' : ''}>${esc(l.department_name)}</option>`).join('');
};

app.openKpiDefinitionModal = function(kpiId) {
    const existing = kpiId ? (this.state.kpiDefinitions || []).find(k => k.id === kpiId) : null;
    document.getElementById('kpiDefinitionModalTitle').textContent = existing ? 'Edit KPI' : 'Add KPI';
    document.getElementById('kpiDefinitionEditId').value = kpiId || '';
    document.getElementById('kpiDefDirectorate').value = existing ? existing.directorate_id : (this.state._kpiDefFilterDirectorateId || this.state.kpiDirectorates[0]?.id || '');
    document.getElementById('kpiDefName').value = existing ? existing.name : '';
    document.getElementById('kpiDefCategory').value = existing ? (existing.category || '') : '';
    document.getElementById('kpiDefExceptional').value = existing && existing.exceptional_value != null ? existing.exceptional_value : '';
    document.getElementById('kpiDefTarget').value = existing ? existing.target_value : '';
    document.getElementById('kpiDefUnacceptable').value = existing && existing.unacceptable_value != null ? existing.unacceptable_value : '';
    document.getElementById('kpiDefUnit').value = existing ? (existing.unit || '') : '';
    document.getElementById('kpiDefPeriodType').value = existing ? existing.period_type : (this.state._kpiDefFilterPeriod || 'monthly');
    document.getElementById('kpiDefDirection').value = existing ? existing.direction : 'higher_is_better';
    document.getElementById('kpiDefArea').value = existing && existing.area != null ? existing.area : '';
    document.getElementById('kpiDefAreaPct').value = existing && existing.area_pct != null ? existing.area_pct * 100 : '';
    document.getElementById('kpiDefLevel1').value = existing && existing.level1 != null ? existing.level1 : '';
    document.getElementById('kpiDefLevel1Pct').value = existing && existing.level1_pct != null ? existing.level1_pct * 100 : '';
    document.getElementById('kpiDefLevel2').value = existing && existing.level2 != null ? existing.level2 : '';
    document.getElementById('kpiDefLevel2Pct').value = existing && existing.level2_pct != null ? existing.level2_pct * 100 : '';
    document.getElementById('kpiDefLevel3Pct').value = existing && existing.level3_pct != null ? existing.level3_pct * 100 : '';
    this._populateKpiDefLineOptions(existing ? existing.department_id : null);
    document.getElementById('kpiDefinitionModal').style.display = 'flex';
};

app.closeKpiDefinitionModal = function() {
    document.getElementById('kpiDefinitionModal').style.display = 'none';
};

app.saveKpiDefinitionModal = async function() {
    const name = (document.getElementById('kpiDefName').value || '').trim();
    if (!name) { this.showToast('Please enter a KPI name.', 'error'); return; }
    const targetValue = document.getElementById('kpiDefTarget').value;
    if (targetValue === '') { this.showToast('Please enter an Acceptable (target) value.', 'error'); return; }
    const lineIdRaw = document.getElementById('kpiDefLine').value;
    if (!lineIdRaw) { this.showToast('Please select a line.', 'error'); return; }

    // Exceptional/Unacceptable are optional — Planner-reference-only
    // thresholds, not used in any achievement calculation, so a KPI can
    // be saved with just Acceptable filled in (e.g. right after an
    // Excel import, which never sets these two).
    const exceptionalRaw = document.getElementById('kpiDefExceptional').value;
    const unacceptableRaw = document.getElementById('kpiDefUnacceptable').value;

    const existingId = document.getElementById('kpiDefinitionEditId').value;

    // Weight Hierarchy is entirely optional — a blank field means "don't
    // set/change this", not "clear it to zero". Inputs are typed as
    // whole numbers (30 for 30%) for ease of entry, converted to the
    // fraction the rest of the app stores (0.30) on the way in.
    const areaVal = document.getElementById('kpiDefArea').value.trim();
    const areaPctRaw = document.getElementById('kpiDefAreaPct').value;
    const level1Val = document.getElementById('kpiDefLevel1').value.trim();
    const level1PctRaw = document.getElementById('kpiDefLevel1Pct').value;
    const level2Val = document.getElementById('kpiDefLevel2').value.trim();
    const level2PctRaw = document.getElementById('kpiDefLevel2Pct').value;
    const level3PctRaw = document.getElementById('kpiDefLevel3Pct').value;

    const def = {
        directorateId: parseInt(document.getElementById('kpiDefDirectorate').value, 10),
        departmentId: parseInt(lineIdRaw, 10),
        name,
        category: document.getElementById('kpiDefCategory').value.trim(),
        unit: document.getElementById('kpiDefUnit').value.trim(),
        targetValue: Number(targetValue),
        exceptionalValue: exceptionalRaw !== '' ? Number(exceptionalRaw) : null,
        unacceptableValue: unacceptableRaw !== '' ? Number(unacceptableRaw) : null,
        periodType: document.getElementById('kpiDefPeriodType').value,
        direction: document.getElementById('kpiDefDirection').value,
        area: areaVal || null,
        areaPct: areaPctRaw !== '' ? Number(areaPctRaw) / 100 : null,
        level1: level1Val || null,
        level1Pct: level1PctRaw !== '' ? Number(level1PctRaw) / 100 : null,
        level2: level2Val || null,
        level2Pct: level2PctRaw !== '' ? Number(level2PctRaw) / 100 : null,
        level3Pct: level3PctRaw !== '' ? Number(level3PctRaw) / 100 : null,
    };

    const saved = await this.saveKpiDefinition(def, existingId ? parseInt(existingId, 10) : null);
    if (!saved) return;

    this.closeKpiDefinitionModal();
    this.renderKpiPlannerView();
};

app.confirmDeleteKpiDefinition = async function(id) {
    if (!confirm('Delete this KPI? This also deletes every result recorded for it. This cannot be undone.')) return;
    const ok = await this.deleteKpiDefinition(id);
    if (ok) this.renderKpiPlannerView();
};

// ════════════════════════════════════════════════════════════════════
// Section 3: Enter Results
// ════════════════════════════════════════════════════════════════════
app._renderKpiResultsSection = function() {
    const esc = this._escHtml.bind(this);
    const selectedCompany = this.state._kpiSelectedCompany || 'OMC';
    const directorates = (this.state.kpiDirectorates || []).filter(d => (d.company || 'OMC') === selectedCompany);
    const definitions = (this.state.kpiDefinitions || []).filter(k => directorates.some(d => d.id === k.directorate_id));

    if (definitions.length === 0) {
        return `
            <div class="bg-white rounded-xl shadow-md p-5">
                <p class="text-sm text-gray-400 text-center py-6">Add a ${esc(selectedCompany)} KPI first — results are recorded against a specific KPI.</p>
            </div>
        `;
    }

    // ── KPI Period filter (Step 1 of the on-page cascade — Company is the
    // shared switcher above the tabs) ──
    // Defaults to whatever KPI is currently selected's period, so
    // switching tabs doesn't silently reset the user's place.
    const periodTypes = ['monthly', 'quarterly', 'yearly'];
    const periodLabels = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };
    let filterPeriod = this.state._kpiResultsFilterPeriod;
    if (!periodTypes.includes(filterPeriod)) {
        const currentDef = this.state._kpiResultsSelectedId ? definitions.find(k => k.id === this.state._kpiResultsSelectedId) : null;
        filterPeriod = currentDef ? currentDef.period_type : 'monthly';
        this.state._kpiResultsFilterPeriod = filterPeriod;
    }
    const periodFilterHtml = `
        <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">KPI Period</label>
        <select id="kpiResultsPeriodTypeSelect" onchange="app.state._kpiResultsFilterPeriod = this.value; app.state._kpiResultsSelectedId = null; app.renderKpiPlannerView();"
            style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:10px;">
            ${periodTypes.map(p => `<option value="${p}" ${p === filterPeriod ? 'selected' : ''}>${periodLabels[p]}</option>`).join('')}
        </select>
    `;

    // ── Directorate filter (Step 2) — scoped to the active company ──
    let selectedDirectorateId = this.state._kpiResultsSelectedDirectorateId;
    const directorateIsValid = selectedDirectorateId != null && directorates.some(d => d.id === selectedDirectorateId);
    if (!directorateIsValid) {
        const currentDef = this.state._kpiResultsSelectedId ? definitions.find(k => k.id === this.state._kpiResultsSelectedId) : null;
        const fallbackDirId = currentDef ? this._kpiEffectiveDirectorateId(currentDef) : null;
        selectedDirectorateId = (fallbackDirId != null && directorates.some(d => d.id === fallbackDirId))
            ? fallbackDirId
            : (directorates.find(d => this._kpisForDirectorate(d.id).length > 0) || directorates[0] || {}).id ?? null;
        this.state._kpiResultsSelectedDirectorateId = selectedDirectorateId;
    }

    const directorateOptions = directorates.map(d => `<option value="${d.id}" ${d.id === selectedDirectorateId ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
    const directorateSelectHtml = `
        <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Directorate</label>
        <select id="kpiResultsDirectorateSelect" onchange="app.state._kpiResultsSelectedDirectorateId = parseInt(this.value, 10); app.state._kpiResultsSelectedId = null; app.renderKpiPlannerView();"
            style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:10px;">
            ${directorateOptions}
        </select>
    `;

    // ── KPI Name filter (Step 3) — scoped to the directorate AND the
    // KPI Period selected above ──
    const scopedDefinitions = (selectedDirectorateId != null ? this._kpisForDirectorate(selectedDirectorateId) : definitions)
        .filter(k => k.period_type === filterPeriod);

    if (scopedDefinitions.length === 0) {
        return `
            <div class="bg-white rounded-xl shadow-md p-5">
                <h3 class="text-lg font-bold text-gray-800 mb-4">Enter Results</h3>
                ${periodFilterHtml}
                ${directorateSelectHtml}
                <p class="text-sm text-gray-400 text-center py-6">No ${periodLabels[filterPeriod].toLowerCase()} KPIs defined for this directorate yet.</p>
            </div>
        `;
    }

    const selectedId = (this.state._kpiResultsSelectedId && scopedDefinitions.some(k => k.id === this.state._kpiResultsSelectedId))
        ? this.state._kpiResultsSelectedId
        : scopedDefinitions[0].id;
    this.state._kpiResultsSelectedId = selectedId;
    const selected = scopedDefinitions.find(k => k.id === selectedId) || scopedDefinitions[0];
    const selectedYear = this.state._kpiResultsSelectedYear || this.state.biddingYear || new Date().getFullYear();
    // selected.period_type always equals filterPeriod (scopedDefinitions is
    // pre-filtered by it above) — using it directly here is equivalent and
    // keeps this line self-contained if that invariant ever changes.
    const periodOptions = this.kpiPeriodOptions(selected.period_type, selectedYear);
    const existingResults = (this.state.kpiResults || [])
        .filter(r => r.kpi_definition_id === selected.id)
        .sort((a, b) => a.period_label.localeCompare(b.period_label));

    const kpiOptions = scopedDefinitions.map(k => `<option value="${k.id}" ${k.id === selected.id ? 'selected' : ''}>${esc(this._kpiDisplayNameWithLine(k))}</option>`).join('');
    const periodSelectOptions = periodOptions.map(p => `<option value="${esc(p.value)}">${esc(p.label)}</option>`).join('');
    const yearOptions = [selectedYear - 1, selectedYear, selectedYear + 1].map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`).join('');

    const resultsRows = existingResults.map(r => {
        // Prefer the stored status/achievement (computed and snapshotted at
        // entry time) — falls back to a live computation only for older
        // rows saved before this snapshotting existed.
        const status = r.status || this.kpiStatus(r.actual_value, r.target_value ?? selected.target_value, selected.direction);
        const statusBadge = { on_target: ['On Target', '#d1fae5', '#065f46'], below_target: ['Below Target', '#fee2e2', '#991b1b'], no_data: ['—', '#f3f4f6', '#6b7280'] }[status];
        const isOverridden = r.final_kpi != null && r.factor_score != null && Math.abs(r.final_kpi - r.factor_score) > 1e-9;
        return `
            <tr>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${esc(r.period_label)}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${esc(String(r.actual_value))}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${r.target_value != null ? esc(String(r.target_value)) : '—'}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${r.achievement != null ? esc(String(r.achievement)) + '%' : '—'}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;"><span style="background:${statusBadge[1]};color:${statusBadge[2]};padding:2px 10px;border-radius:999px;font-size:0.72rem;font-weight:700;">${statusBadge[0]}</span></td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${r.factor_score != null ? esc(Number(r.factor_score).toFixed(2)) : '—'}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">
                    <input type="number" step="any" value="${r.final_kpi != null ? r.final_kpi : ''}"
                        onchange="app.overrideKpiFinalScore(${r.id}, this.value === '' ? null : parseFloat(this.value))"
                        style="width:70px;padding:4px 6px;border:1.5px solid ${isOverridden ? '#7c3aed' : '#e5e7eb'};border-radius:6px;font-size:0.8rem;font-weight:${isOverridden ? '700' : '400'};color:${isOverridden ? '#7c3aed' : '#111827'};" />
                    ${isOverridden ? '<span title="Manually overridden — differs from the auto-calculated Factor Score" style="font-size:0.7rem;color:#7c3aed;">✎</span>' : ''}
                </td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:0.78rem;color:#6b7280;max-width:160px;">${esc(r.remarks || '—')}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:0.75rem;">
                    ${r.approved_at ? `<span style="color:#065f46;">✓ ${esc(r.approved_by || 'Approved')}</span>` : `<button onclick="app.doApproveKpiResult(${r.id})" style="padding:4px 10px;background:#166534;color:#fff;border:none;border-radius:6px;font-size:0.72rem;font-weight:700;cursor:pointer;">Approve</button>`}
                </td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;">
                    <button onclick="app.confirmDeleteKpiResultEntry(${r.id})" style="color:#991b1b;background:none;border:none;font-size:0.75rem;cursor:pointer;text-decoration:underline;">Delete</button>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="bg-white rounded-xl shadow-md p-5">
            <h3 class="text-lg font-bold text-gray-800 mb-4">Enter Results</h3>

            ${periodFilterHtml}
            ${directorateSelectHtml}

            <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">KPI</label>
            <select id="kpiResultsKpiSelect" onchange="app.state._kpiResultsSelectedId = parseInt(this.value, 10); app.renderKpiPlannerView();"
                style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:10px;">
                ${kpiOptions}
            </select>
            <p style="font-size:0.75rem;color:#6b7280;margin-bottom:16px;">Target: <strong>${esc(String(selected.target_value))}${selected.unit ? ' ' + esc(selected.unit) : ''}</strong> · ${esc(selected.period_type)} · ${selected.direction === 'lower_is_better' ? 'Lower is better' : 'Higher is better'}</p>

            <div style="display:flex;gap:10px;align-items:flex-end;margin-bottom:14px;flex-wrap:wrap;">
                <div style="min-width:100px;">
                    <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Year</label>
                    <select id="kpiResultYear" onchange="app.state._kpiResultsSelectedYear = parseInt(this.value, 10); app.renderKpiPlannerView();"
                        style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;">
                        ${yearOptions}
                    </select>
                </div>
                <div style="flex:1;min-width:160px;">
                    <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Period</label>
                    <select id="kpiResultPeriod" style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;">
                        ${periodSelectOptions}
                    </select>
                </div>
                <div style="flex:1;min-width:120px;">
                    <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Actual Value${selected.unit ? ' (' + esc(selected.unit) + ')' : ''}</label>
                    <input type="number" step="any" id="kpiResultValue"
                        style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;" />
                </div>
            </div>
            <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Remarks (optional)</label>
            <textarea id="kpiResultRemarks" rows="2" style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:14px;"></textarea>
            <button onclick="app.saveKpiResultEntry(${selected.id})" style="padding:9px 18px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.85rem;margin-bottom:20px;">Save Result</button>

            <h4 style="font-size:0.85rem;font-weight:700;margin-bottom:8px;">Recorded results for ${esc(this._kpiDisplayNameWithLine(selected))}</h4>
            ${existingResults.length === 0 ? '<p class="text-sm text-gray-400">No results recorded yet.</p>' : `
                <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                    <thead>
                        <tr style="text-align:left;color:#6b7280;font-size:0.72rem;text-transform:uppercase;">
                            <th style="padding:8px 12px;">Period</th>
                            <th style="padding:8px 12px;">Actual</th>
                            <th style="padding:8px 12px;">Target</th>
                            <th style="padding:8px 12px;">Achievement</th>
                            <th style="padding:8px 12px;">Status</th>
                            <th style="padding:8px 12px;">Factor</th>
                            <th style="padding:8px 12px;">Final KPI</th>
                            <th style="padding:8px 12px;">Remarks</th>
                            <th style="padding:8px 12px;">Approval</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${resultsRows}</tbody>
                </table>
            `}
        </div>
    `;
};

app.saveKpiResultEntry = async function(kpiDefinitionId) {
    const periodRaw = document.getElementById('kpiResultPeriod').value; // e.g. "2027-01", "2027-Q1", or "2027"
    const value = document.getElementById('kpiResultValue').value;
    const remarks = document.getElementById('kpiResultRemarks').value;
    if (value === '') { this.showToast('Please enter a value.', 'error'); return; }

    const def = (this.state.kpiDefinitions || []).find(k => k.id === kpiDefinitionId);
    const periodType = def ? def.period_type : 'monthly';
    // Parse the combined "year-value" string back into its parts — the
    // dropdown's own value already encodes exactly what kpiPeriodOptions
    // generated, so this just reverses that same format.
    const hyphenIdx = periodRaw.indexOf('-');
    const year = hyphenIdx >= 0 ? parseInt(periodRaw.slice(0, hyphenIdx), 10) : parseInt(periodRaw, 10);
    const periodValue = hyphenIdx >= 0 ? periodRaw.slice(hyphenIdx + 1) : null;

    const saved = await this.saveKpiResult(kpiDefinitionId, { year, periodType, periodValue, actualValue: Number(value), remarks, source: 'manual' });
    if (saved) {
        this.showToast('Result saved.', 'success');
        this.renderKpiPlannerView();
    }
};


app.confirmDeleteKpiResultEntry = async function(id) {
    if (!confirm('Delete this result?')) return;
    const ok = await this.deleteKpiResult(id);
    if (ok) this.renderKpiPlannerView();
};

app.doApproveKpiResult = async function(id) {
    const ok = await this.approveKpiResult(id);
    if (ok) this.renderKpiPlannerView();
};

// ════════════════════════════════════════════════════════════════════
// KPI Executive Director — PLACEHOLDER ONLY. The real, view-only card
// dashboard scoped to the director's own directorate is Stage 4, not yet
// built. This exists purely so the new Director login has somewhere real
// to land rather than a dead link.
// ════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════
// Section 4: Manage Users
// ════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════
// Section: Preview Dashboard — the Viewer role's functionality, folded
// into the Planner's own screen rather than a separate login. Lets the
// Planner pick any directorate and preview exactly the same read-only
// dashboard a real Director/Viewer would see, reusing
// _buildKpiDashboardBody/_drawKpiDashboardCharts so this can never drift
// from what they actually see.
// ════════════════════════════════════════════════════════════════════
app._renderKpiPreviewSection = function() {
    const esc = this._escHtml.bind(this);
    const directorates = this.state.kpiDirectorates || [];

    if (directorates.length === 0) {
        return `
            <div class="bg-white rounded-xl shadow-md p-5">
                <p class="text-sm text-gray-400 text-center py-6">Add a directorate first — there's nothing to preview yet.</p>
            </div>
        `;
    }

    const selectedDirectorateId = this.state._kpiPreviewDirectorateId || directorates[0].id;
    const selectedDirectorate = directorates.find(d => d.id === selectedDirectorateId) || directorates[0];
    const year = this.state._kpiPreviewYear || new Date().getFullYear();
    const yearOptions = [year - 1, year, year + 1].map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('');
    const directorateOptions = ['OMC', 'Audit'].map(company => {
        const inCompany = directorates.filter(d => (d.company || 'OMC') === company);
        if (inCompany.length === 0) return '';
        return `<optgroup label="${esc(company)}">${inCompany.map(d => `<option value="${d.id}" ${d.id === selectedDirectorateId ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</optgroup>`;
    }).join('');

    return `
        <div class="bg-white rounded-xl shadow-md p-5 mb-6">
            <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
                <div style="flex:1;min-width:200px;">
                    <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Directorate</label>
                    <select onchange="app.state._kpiPreviewDirectorateId = parseInt(this.value, 10); app.renderKpiPlannerView();"
                        style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;">
                        ${directorateOptions}
                    </select>
                </div>
                <div style="min-width:100px;">
                    <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Year</label>
                    <select onchange="app.state._kpiPreviewYear = parseInt(this.value, 10); app.renderKpiPlannerView();"
                        style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;">
                        ${yearOptions}
                    </select>
                </div>
            </div>
            <p style="font-size:0.72rem;color:#9ca3af;margin-top:10px;">This is a read-only preview — exactly what a Director/Viewer for ${esc(selectedDirectorate.name)} would see.</p>
        </div>

        ${this._buildKpiDashboardBody(selectedDirectorateId, year)}
    `;
};

// ════════════════════════════════════════════════════════════════════
// Import from Excel — bulk-configures KPIs + owners from a spreadsheet.
// Flow: pick a file -> parsed client-side via the XLSX library already
// loaded for this app -> validated/grouped via the pure functions in
// api-kpi.js -> preview shown -> planner confirms -> saved to Supabase.
// Nothing is written until the planner explicitly clicks Confirm.
// ════════════════════════════════════════════════════════════════════
app._renderKpiImportSection = function() {
    const esc = this._escHtml.bind(this);
    const selectedCompany = this.state._kpiSelectedCompany || 'OMC';
    const preview = this.state._kpiImportPreview;
    const result = this.state._kpiImportResult;
    const thresholdPreview = this.state._kpiThresholdImportPreview;
    const thresholdResult = this.state._kpiThresholdImportResult;
    const weightPreview = this.state._kpiWeightImportPreview;
    const weightResult = this.state._kpiWeightImportResult;

    return `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 16px;margin-bottom:16px;font-size:0.82rem;color:#1e40af;">
            📁 Importing into <strong>${esc(selectedCompany)}</strong> — switch company above if this isn't the one you meant.
        </div>

        <div class="bg-white rounded-xl shadow-md p-5 mb-6">
            <h3 class="text-lg font-bold text-gray-800 mb-2">1. Import KPIs &amp; Owners from Excel</h3>
            <p style="font-size:0.8rem;color:#6b7280;margin-bottom:16px;">
                Expected columns: Line, Code, KPI Code, KPI Name, Frequency, KPI Weight %, Owner Dept, Owner Name, Owner Email, Owner %.
                Each row is one KPI-line-owner combination — a KPI split across multiple owners should appear as multiple rows with the same Line and KPI Code.
                Run this first — it creates the KPIs and directorates. Exceptional/Acceptable/Unacceptable thresholds are not part of this import.
            </p>

            <div style="border:2px dashed #d1d5db;border-radius:10px;padding:24px;text-align:center;margin-bottom:20px;">
                <input type="file" id="kpiImportFileInput" accept=".xlsx,.xls" style="display:none;" onchange="app._handleKpiImportFile(event)" />
                <label for="kpiImportFileInput" style="cursor:pointer;">
                    <p style="color:#6b7280;margin-bottom:10px;">Click to browse, or drag a file here</p>
                    <span style="padding:8px 18px;background:#1d4ed8;color:#fff;border-radius:8px;font-size:0.85rem;font-weight:700;">📁 Choose Excel File</span>
                </label>
            </div>

            ${preview ? this._renderKpiImportPreview(preview) : ''}
            ${result ? this._renderKpiImportResult(result) : ''}
        </div>

        <div class="bg-white rounded-xl shadow-md p-5">
            <h3 class="text-lg font-bold text-gray-800 mb-2">2. Import Thresholds (Exceptional / Acceptable / Unacceptable)</h3>
            <p style="font-size:0.8rem;color:#6b7280;margin-bottom:16px;">
                Expected columns: Line, KPI Code, Unit, Exceptional, Acceptable, Unacceptable. Updates KPIs already created above — matched by
                KPI Code and Line — it never creates new ones. Also sets each KPI's direction (higher/lower is better), inferred automatically
                from whether Exceptional is above or below Unacceptable.
            </p>

            <div style="border:2px dashed #d1d5db;border-radius:10px;padding:24px;text-align:center;margin-bottom:20px;">
                <input type="file" id="kpiThresholdImportFileInput" accept=".xlsx,.xls" style="display:none;" onchange="app._handleKpiThresholdImportFile(event)" />
                <label for="kpiThresholdImportFileInput" style="cursor:pointer;">
                    <p style="color:#6b7280;margin-bottom:10px;">Click to browse, or drag a file here</p>
                    <span style="padding:8px 18px;background:#7c3aed;color:#fff;border-radius:8px;font-size:0.85rem;font-weight:700;">📁 Choose Excel File</span>
                </label>
            </div>

            ${thresholdPreview ? this._renderKpiThresholdImportPreview(thresholdPreview) : ''}
            ${thresholdResult ? this._renderKpiThresholdImportResult(thresholdResult) : ''}
        </div>

        <div class="bg-white rounded-xl shadow-md p-5 mt-6">
            <h3 class="text-lg font-bold text-gray-800 mb-2">3. Import Weight Hierarchy (Area / Level 1 / Level 2 / Level 3 %)</h3>
            <p style="font-size:0.8rem;color:#6b7280;margin-bottom:16px;">
                Expected columns: KPI Code, Area, Area %, Level 1, Level 1 %, Level 2, Level 2 %, Level 3% (Area/Level 1/Level 2 and their %
                only need to be entered on each group's first row — blank cells inherit the nearest value above, same convention as the source file).
                Line is optional: leave it blank to apply the same weighting to every line-instance of that KPI Code, or fill it in to weight
                just one line. Updates KPIs already created by the import above — matched by KPI Code — it never creates new ones. This is a
                separate layer from Directorate/Line/Owner and doesn't change dashboards or Enter Results — it only powers each KPI's Final Weight.
            </p>

            <div style="border:2px dashed #d1d5db;border-radius:10px;padding:24px;text-align:center;margin-bottom:20px;">
                <input type="file" id="kpiWeightImportFileInput" accept=".xlsx,.xls" style="display:none;" onchange="app._handleKpiWeightImportFile(event)" />
                <label for="kpiWeightImportFileInput" style="cursor:pointer;">
                    <p style="color:#6b7280;margin-bottom:10px;">Click to browse, or drag a file here</p>
                    <span style="padding:8px 18px;background:#059669;color:#fff;border-radius:8px;font-size:0.85rem;font-weight:700;">📁 Choose Excel File</span>
                </label>
            </div>

            ${weightPreview ? this._renderKpiWeightImportPreview(weightPreview) : ''}
            ${weightResult ? this._renderKpiWeightImportResult(weightResult) : ''}
        </div>
    `;
};

app._renderKpiImportPreview = function(preview) {
    const esc = this._escHtml.bind(this);
    const { validRows, invalidRows, grouped, conflicts } = preview;
    const selectedCompany = this.state._kpiSelectedCompany || 'OMC';
    const primaryDepts = [...new Set(grouped.map(g => this._kpiDeterminePrimaryOwnerDept(g.owners)))];
    const existingDirNames = new Set((this.state.kpiDirectorates || []).filter(d => (d.company || 'OMC') === selectedCompany).map(d => d.name));
    const newDepts = primaryDepts.filter(d => !existingDirNames.has(d));

    return `
        <div style="border-top:1px solid #e5e7eb;padding-top:16px;">
            <h4 style="font-weight:700;margin-bottom:10px;">Preview</h4>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div style="background:#eff6ff;border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:#1d4ed8;font-weight:700;">VALID ROWS</p>
                    <p style="font-size:1.4rem;font-weight:800;color:#1d4ed8;">${validRows.length}</p>
                </div>
                <div style="background:${invalidRows.length > 0 || conflicts.length > 0 ? '#fef2f2' : '#f0fdf4'};border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:${invalidRows.length > 0 || conflicts.length > 0 ? '#991b1b' : '#166534'};font-weight:700;">INVALID / CONFLICTING ROWS</p>
                    <p style="font-size:1.4rem;font-weight:800;color:${invalidRows.length > 0 || conflicts.length > 0 ? '#991b1b' : '#166534'};">${invalidRows.length + conflicts.length}</p>
                </div>
                <div style="background:#faf5ff;border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:#7c3aed;font-weight:700;">KPIs TO IMPORT</p>
                    <p style="font-size:1.4rem;font-weight:800;color:#7c3aed;">${grouped.length}</p>
                </div>
                <div style="background:#fffbeb;border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:#92400e;font-weight:700;">NEW DIRECTORATES</p>
                    <p style="font-size:1.4rem;font-weight:800;color:#92400e;">${newDepts.length}</p>
                </div>
            </div>

            ${newDepts.length > 0 ? `<p style="font-size:0.8rem;color:#6b7280;margin-bottom:10px;">Will create: ${newDepts.map(d => `<strong>${esc(d)}</strong>`).join(', ')}</p>` : ''}

            ${conflicts.length > 0 ? `
                <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:16px;max-height:220px;overflow-y:auto;">
                    <p style="font-size:0.8rem;font-weight:700;color:#991b1b;margin-bottom:6px;">⚠️ Same Line + KPI Code used for different KPIs — NOT imported:</p>
                    <p style="font-size:0.72rem;color:#991b1b;margin-bottom:8px;">These rows share the same (Line, KPI Code) but have different KPI Names — merging them would misattribute one KPI's owner to the wrong directorate, so they're excluded until the codes are made unique in the source file.</p>
                    ${conflicts.map(c => `<p style="font-size:0.75rem;color:#991b1b;">${esc(c.line)} / ${esc(c.kpiCode)}: ${c.names.map(n => `"${esc(n)}"`).join(' vs ')}</p>`).join('')}
                </div>
            ` : ''}

            ${invalidRows.length > 0 ? `
                <div style="background:#fef2f2;border-radius:8px;padding:12px;margin-bottom:16px;max-height:200px;overflow-y:auto;">
                    <p style="font-size:0.8rem;font-weight:700;color:#991b1b;margin-bottom:6px;">Rows that will be skipped:</p>
                    ${invalidRows.map(r => `<p style="font-size:0.75rem;color:#991b1b;">Row ${r.rowNumber}: ${esc(r.errors.join('; '))}</p>`).join('')}
                </div>
            ` : ''}

            <div style="max-height:280px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;">
                <table style="width:100%;border-collapse:collapse;font-size:0.78rem;">
                    <thead style="position:sticky;top:0;background:#f9fafb;">
                        <tr style="text-align:left;">
                            <th style="padding:6px 10px;">Line</th>
                            <th style="padding:6px 10px;">Code</th>
                            <th style="padding:6px 10px;">KPI Name</th>
                            <th style="padding:6px 10px;">Frequency</th>
                            <th style="padding:6px 10px;">Owner(s)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${grouped.map(g => `
                            <tr style="border-top:1px solid #f3f4f6;">
                                <td style="padding:6px 10px;">${esc(g.line)}</td>
                                <td style="padding:6px 10px;">${esc(g.kpiCode)}</td>
                                <td style="padding:6px 10px;">${esc(g.kpiName)}</td>
                                <td style="padding:6px 10px;">${esc(g.periodType)}</td>
                                <td style="padding:6px 10px;">${g.owners.map(o => `${esc(o.name || o.dept)} (${Math.round(o.pct * 100)}%)`).join(', ')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div style="display:flex;gap:10px;">
                <button onclick="app.state._kpiImportPreview=null;app.state._kpiImportResult=null;app.renderKpiPlannerView();"
                    style="padding:9px 18px;border-radius:8px;font-weight:600;font-size:0.85rem;border:1.5px solid #e5e7eb;background:#fff;color:#374151;">Cancel</button>
                <button onclick="app._confirmKpiImport()" ${validRows.length === 0 ? 'disabled' : ''}
                    style="padding:9px 18px;border-radius:8px;font-weight:700;font-size:0.85rem;border:none;background:${validRows.length === 0 ? '#9ca3af' : '#059669'};color:#fff;">
                    Confirm Import (${grouped.length} KPI${grouped.length !== 1 ? 's' : ''})
                </button>
            </div>
        </div>
    `;
};

app._renderKpiImportResult = function(result) {
    const esc = this._escHtml.bind(this);
    return `
        <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:16px;">
            <h4 style="font-weight:700;margin-bottom:10px;">Import Result</h4>
            <div class="grid grid-cols-3 gap-3 mb-4">
                <div style="background:#f0fdf4;border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:#166534;font-weight:700;">CREATED</p>
                    <p style="font-size:1.4rem;font-weight:800;color:#166534;">${result.created}</p>
                </div>
                <div style="background:#eff6ff;border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:#1d4ed8;font-weight:700;">UPDATED</p>
                    <p style="font-size:1.4rem;font-weight:800;color:#1d4ed8;">${result.updated}</p>
                </div>
                <div style="background:${result.failed > 0 ? '#fef2f2' : '#f9fafb'};border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:${result.failed > 0 ? '#991b1b' : '#6b7280'};font-weight:700;">FAILED</p>
                    <p style="font-size:1.4rem;font-weight:800;color:${result.failed > 0 ? '#991b1b' : '#6b7280'};">${result.failed}</p>
                </div>
            </div>
            ${result.errors.length > 0 ? `
                <div style="background:#fef2f2;border-radius:8px;padding:12px;max-height:200px;overflow-y:auto;">
                    ${result.errors.map(e => `<p style="font-size:0.75rem;color:#991b1b;">${esc(e)}</p>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
};

app._handleKpiImportFile = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    this.state._kpiImportPreview = null;
    this.state._kpiImportResult = null;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawRows = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: '' });

            const { validRows, invalidRows } = this._kpiParseOwnerImportRows(rawRows);
            const { groups, conflicts } = this._kpiGroupImportRowsByLineAndCode(validRows);
            this.state._kpiImportPreview = { validRows, invalidRows, grouped: groups, conflicts };
            this.renderKpiPlannerView();
        } catch (err) {
            console.error('❌ Failed to parse import file:', err.message);
            this.showToast('Could not read this file: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; // allow re-selecting the same file after fixing it
};

app._confirmKpiImport = async function() {
    const preview = this.state._kpiImportPreview;
    if (!preview) return;
    const ok = confirm(`Import ${preview.grouped.length} KPIs? This will create/update KPI definitions and owner records.`);
    if (!ok) return;
    const result = await this.importKpiOwnerData(preview.grouped, this.state._kpiSelectedCompany || 'OMC');
    this.state._kpiImportResult = result;
    this.state._kpiImportPreview = null;
    this.renderKpiPlannerView();
};

app._renderKpiThresholdImportPreview = function(preview) {
    const esc = this._escHtml.bind(this);
    const { validRows, invalidRows } = preview;
    const selectedCompany = this.state._kpiSelectedCompany || 'OMC';
    const notFoundCount = validRows.filter(r => !this._kpiFindExistingKpiByCodeAndLine(r.kpiCode, r.line, selectedCompany)).length;

    return `
        <div style="border-top:1px solid #e5e7eb;padding-top:16px;">
            <h4 style="font-weight:700;margin-bottom:10px;">Preview</h4>
            <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                <div style="background:#faf5ff;border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:#7c3aed;font-weight:700;">VALID ROWS</p>
                    <p style="font-size:1.4rem;font-weight:800;color:#7c3aed;">${validRows.length}</p>
                </div>
                <div style="background:${invalidRows.length > 0 ? '#fef2f2' : '#f0fdf4'};border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:${invalidRows.length > 0 ? '#991b1b' : '#166534'};font-weight:700;">INVALID ROWS</p>
                    <p style="font-size:1.4rem;font-weight:800;color:${invalidRows.length > 0 ? '#991b1b' : '#166534'};">${invalidRows.length}</p>
                </div>
                <div style="background:${notFoundCount > 0 ? '#fffbeb' : '#f0fdf4'};border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:${notFoundCount > 0 ? '#92400e' : '#166534'};font-weight:700;">NO MATCHING KPI</p>
                    <p style="font-size:1.4rem;font-weight:800;color:${notFoundCount > 0 ? '#92400e' : '#166534'};">${notFoundCount}</p>
                </div>
            </div>

            ${notFoundCount > 0 ? `<p style="font-size:0.78rem;color:#92400e;margin-bottom:12px;">${notFoundCount} row${notFoundCount !== 1 ? 's' : ''} reference a KPI Code/Line combination that doesn't exist yet — run the KPI &amp; Owners import above first, or check the spreadsheet for typos.</p>` : ''}

            ${invalidRows.length > 0 ? `
                <div style="background:#fef2f2;border-radius:8px;padding:12px;margin-bottom:16px;max-height:200px;overflow-y:auto;">
                    <p style="font-size:0.8rem;font-weight:700;color:#991b1b;margin-bottom:6px;">Rows that will be skipped:</p>
                    ${invalidRows.map(r => `<p style="font-size:0.75rem;color:#991b1b;">Row ${r.rowNumber}: ${esc(r.errors.join('; '))}</p>`).join('')}
                </div>
            ` : ''}

            <div style="max-height:280px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;">
                <table style="width:100%;border-collapse:collapse;font-size:0.78rem;">
                    <thead style="position:sticky;top:0;background:#f9fafb;">
                        <tr style="text-align:left;">
                            <th style="padding:6px 10px;">Line</th>
                            <th style="padding:6px 10px;">KPI Code</th>
                            <th style="padding:6px 10px;">Direction</th>
                            <th style="padding:6px 10px;">Exceptional</th>
                            <th style="padding:6px 10px;">Acceptable</th>
                            <th style="padding:6px 10px;">Unacceptable</th>
                            <th style="padding:6px 10px;">Match</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${validRows.map(r => {
                            const found = this._kpiFindExistingKpiByCodeAndLine(r.kpiCode, r.line);
                            return `
                                <tr style="border-top:1px solid #f3f4f6;">
                                    <td style="padding:6px 10px;">${esc(r.line)}</td>
                                    <td style="padding:6px 10px;">${esc(r.kpiCode)}</td>
                                    <td style="padding:6px 10px;">${r.direction === 'higher_is_better' ? '⬆️ Higher' : '⬇️ Lower'}</td>
                                    <td style="padding:6px 10px;">${r.exceptional != null ? esc(String(r.exceptional)) : '—'}</td>
                                    <td style="padding:6px 10px;">${esc(String(r.acceptable))}</td>
                                    <td style="padding:6px 10px;">${esc(String(r.unacceptable))}</td>
                                    <td style="padding:6px 10px;">${found ? '<span style="color:#059669;">✓ found</span>' : '<span style="color:#dc2626;">✗ not found</span>'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <div style="display:flex;gap:10px;">
                <button onclick="app.state._kpiThresholdImportPreview=null;app.state._kpiThresholdImportResult=null;app.renderKpiPlannerView();"
                    style="padding:9px 18px;border-radius:8px;font-weight:600;font-size:0.85rem;border:1.5px solid #e5e7eb;background:#fff;color:#374151;">Cancel</button>
                <button onclick="app._confirmKpiThresholdImport()" ${validRows.length === 0 ? 'disabled' : ''}
                    style="padding:9px 18px;border-radius:8px;font-weight:700;font-size:0.85rem;border:none;background:${validRows.length === 0 ? '#9ca3af' : '#7c3aed'};color:#fff;">
                    Confirm Import (${validRows.length - notFoundCount} will update)
                </button>
            </div>
        </div>
    `;
};

app._renderKpiThresholdImportResult = function(result) {
    const esc = this._escHtml.bind(this);
    return `
        <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:16px;">
            <h4 style="font-weight:700;margin-bottom:10px;">Import Result</h4>
            <div class="grid grid-cols-3 gap-3 mb-4">
                <div style="background:#f0fdf4;border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:#166534;font-weight:700;">UPDATED</p>
                    <p style="font-size:1.4rem;font-weight:800;color:#166534;">${result.updated}</p>
                </div>
                <div style="background:${result.notFound > 0 ? '#fffbeb' : '#f9fafb'};border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:${result.notFound > 0 ? '#92400e' : '#6b7280'};font-weight:700;">NOT FOUND</p>
                    <p style="font-size:1.4rem;font-weight:800;color:${result.notFound > 0 ? '#92400e' : '#6b7280'};">${result.notFound}</p>
                </div>
                <div style="background:${result.failed > 0 ? '#fef2f2' : '#f9fafb'};border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:${result.failed > 0 ? '#991b1b' : '#6b7280'};font-weight:700;">FAILED</p>
                    <p style="font-size:1.4rem;font-weight:800;color:${result.failed > 0 ? '#991b1b' : '#6b7280'};">${result.failed}</p>
                </div>
            </div>
            ${result.errors.length > 0 ? `
                <div style="background:#fffbeb;border-radius:8px;padding:12px;max-height:200px;overflow-y:auto;">
                    ${result.errors.map(e => `<p style="font-size:0.75rem;color:#92400e;">${esc(e)}</p>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
};

app._handleKpiThresholdImportFile = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    this.state._kpiThresholdImportPreview = null;
    this.state._kpiThresholdImportResult = null;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawRows = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: '' });

            const { validRows, invalidRows } = this._kpiParseThresholdImportRows(rawRows);
            this.state._kpiThresholdImportPreview = { validRows, invalidRows };
            this.renderKpiPlannerView();
        } catch (err) {
            console.error('❌ Failed to parse threshold import file:', err.message);
            this.showToast('Could not read this file: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
};

app._confirmKpiThresholdImport = async function() {
    const preview = this.state._kpiThresholdImportPreview;
    if (!preview) return;
    const ok = confirm(`Update thresholds for ${preview.validRows.length} rows? This overwrites Exceptional/Acceptable/Unacceptable and direction on matching KPIs.`);
    if (!ok) return;
    const result = await this.importKpiThresholdData(preview.validRows, this.state._kpiSelectedCompany || 'OMC');
    this.state._kpiThresholdImportResult = result;
    this.state._kpiThresholdImportPreview = null;
    this.renderKpiPlannerView();
};

app._renderKpiWeightImportPreview = function(preview) {
    const esc = this._escHtml.bind(this);
    const { validRows, invalidRows } = preview;
    const selectedCompany = this.state._kpiSelectedCompany || 'OMC';
    const matchCountFor = (r) => r.line
        ? (this._kpiFindExistingKpiByCodeAndLine(r.kpiCode, r.line, selectedCompany) ? 1 : 0)
        : this._kpiFindExistingKpisByCode(r.kpiCode, selectedCompany).length;
    const notFoundCount = validRows.filter(r => matchCountFor(r) === 0).length;
    const totalWeight = validRows.reduce((sum, r) => sum + (r.areaPct * r.level1Pct * r.level2Pct * r.level3Pct), 0);

    return `
        <div style="border-top:1px solid #e5e7eb;padding-top:16px;">
            <h4 style="font-weight:700;margin-bottom:10px;">Preview</h4>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div style="background:#f0fdf4;border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:#166534;font-weight:700;">VALID ROWS</p>
                    <p style="font-size:1.4rem;font-weight:800;color:#166534;">${validRows.length}</p>
                </div>
                <div style="background:${invalidRows.length > 0 ? '#fef2f2' : '#f0fdf4'};border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:${invalidRows.length > 0 ? '#991b1b' : '#166534'};font-weight:700;">INVALID ROWS</p>
                    <p style="font-size:1.4rem;font-weight:800;color:${invalidRows.length > 0 ? '#991b1b' : '#166534'};">${invalidRows.length}</p>
                </div>
                <div style="background:${notFoundCount > 0 ? '#fffbeb' : '#f0fdf4'};border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:${notFoundCount > 0 ? '#92400e' : '#166534'};font-weight:700;">NO MATCHING KPI</p>
                    <p style="font-size:1.4rem;font-weight:800;color:${notFoundCount > 0 ? '#92400e' : '#166534'};">${notFoundCount}</p>
                </div>
                <div style="background:${Math.abs(totalWeight - 1) < 0.001 ? '#f0fdf4' : '#fffbeb'};border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:${Math.abs(totalWeight - 1) < 0.001 ? '#166534' : '#92400e'};font-weight:700;">TOTAL WEIGHT</p>
                    <p style="font-size:1.4rem;font-weight:800;color:${Math.abs(totalWeight - 1) < 0.001 ? '#166534' : '#92400e'};">${(totalWeight * 100).toFixed(1)}%</p>
                </div>
            </div>

            ${Math.abs(totalWeight - 1) >= 0.001 ? `<p style="font-size:0.78rem;color:#92400e;margin-bottom:12px;">⚠️ These rows sum to ${(totalWeight * 100).toFixed(1)}%, not 100% — double-check the source file before confirming; a hierarchy with gaps or overlaps will under- or over-count some KPIs.</p>` : ''}
            ${notFoundCount > 0 ? `<p style="font-size:0.78rem;color:#92400e;margin-bottom:12px;">${notFoundCount} row${notFoundCount !== 1 ? 's' : ''} reference a KPI Code that doesn't exist yet${selectedCompany ? ` under ${esc(selectedCompany)}` : ''} — run the KPI &amp; Owners import above first, or check for typos.</p>` : ''}

            ${invalidRows.length > 0 ? `
                <div style="background:#fef2f2;border-radius:8px;padding:12px;margin-bottom:16px;max-height:200px;overflow-y:auto;">
                    <p style="font-size:0.8rem;font-weight:700;color:#991b1b;margin-bottom:6px;">Rows that will be skipped:</p>
                    ${invalidRows.map(r => `<p style="font-size:0.75rem;color:#991b1b;">Row ${r.rowNumber}: ${esc(r.errors.join('; '))}</p>`).join('')}
                </div>
            ` : ''}

            <div style="max-height:280px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;">
                <table style="width:100%;border-collapse:collapse;font-size:0.78rem;">
                    <thead style="position:sticky;top:0;background:#f9fafb;">
                        <tr style="text-align:left;">
                            <th style="padding:6px 10px;">KPI Code</th>
                            <th style="padding:6px 10px;">Line</th>
                            <th style="padding:6px 10px;">Area</th>
                            <th style="padding:6px 10px;">Level 1</th>
                            <th style="padding:6px 10px;">Level 2</th>
                            <th style="padding:6px 10px;">Final Weight</th>
                            <th style="padding:6px 10px;">Match</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${validRows.map(r => {
                            const matches = matchCountFor(r);
                            const finalWeight = r.areaPct * r.level1Pct * r.level2Pct * r.level3Pct;
                            return `
                                <tr style="border-top:1px solid #f3f4f6;">
                                    <td style="padding:6px 10px;">${esc(r.kpiCode)}</td>
                                    <td style="padding:6px 10px;">${r.line ? esc(r.line) : '<span style="color:#9ca3af;">all lines</span>'}</td>
                                    <td style="padding:6px 10px;">${esc(r.area)}</td>
                                    <td style="padding:6px 10px;">${esc(r.level1)}</td>
                                    <td style="padding:6px 10px;">${esc(r.level2)}</td>
                                    <td style="padding:6px 10px;font-weight:700;">${(finalWeight * 100).toFixed(3)}%</td>
                                    <td style="padding:6px 10px;">${matches > 0 ? `<span style="color:#059669;">✓ ${matches} found</span>` : '<span style="color:#dc2626;">✗ not found</span>'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <div style="display:flex;gap:10px;">
                <button onclick="app.state._kpiWeightImportPreview=null;app.state._kpiWeightImportResult=null;app.renderKpiPlannerView();"
                    style="padding:9px 18px;border-radius:8px;font-weight:600;font-size:0.85rem;border:1.5px solid #e5e7eb;background:#fff;color:#374151;">Cancel</button>
                <button onclick="app._confirmKpiWeightImport()" ${validRows.length === 0 ? 'disabled' : ''}
                    style="padding:9px 18px;border-radius:8px;font-weight:700;font-size:0.85rem;border:none;background:${validRows.length === 0 ? '#9ca3af' : '#059669'};color:#fff;">
                    Confirm Import
                </button>
            </div>
        </div>
    `;
};

app._renderKpiWeightImportResult = function(result) {
    const esc = this._escHtml.bind(this);
    return `
        <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:16px;">
            <h4 style="font-weight:700;margin-bottom:10px;">Import Result</h4>
            <div class="grid grid-cols-3 gap-3 mb-4">
                <div style="background:#f0fdf4;border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:#166534;font-weight:700;">UPDATED</p>
                    <p style="font-size:1.4rem;font-weight:800;color:#166534;">${result.updated}</p>
                </div>
                <div style="background:${result.notFound > 0 ? '#fffbeb' : '#f9fafb'};border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:${result.notFound > 0 ? '#92400e' : '#6b7280'};font-weight:700;">NOT FOUND</p>
                    <p style="font-size:1.4rem;font-weight:800;color:${result.notFound > 0 ? '#92400e' : '#6b7280'};">${result.notFound}</p>
                </div>
                <div style="background:${result.failed > 0 ? '#fef2f2' : '#f9fafb'};border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:${result.failed > 0 ? '#991b1b' : '#6b7280'};font-weight:700;">FAILED</p>
                    <p style="font-size:1.4rem;font-weight:800;color:${result.failed > 0 ? '#991b1b' : '#6b7280'};">${result.failed}</p>
                </div>
            </div>
            ${result.errors.length > 0 ? `
                <div style="background:#fffbeb;border-radius:8px;padding:12px;max-height:200px;overflow-y:auto;">
                    ${result.errors.map(e => `<p style="font-size:0.75rem;color:#92400e;">${esc(e)}</p>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
};

app._handleKpiWeightImportFile = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    this.state._kpiWeightImportPreview = null;
    this.state._kpiWeightImportResult = null;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawRows = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: '' });

            const { validRows, invalidRows } = this._kpiParseWeightImportRows(rawRows);
            this.state._kpiWeightImportPreview = { validRows, invalidRows };
            this.renderKpiPlannerView();
        } catch (err) {
            console.error('❌ Failed to parse weight import file:', err.message);
            this.showToast('Could not read this file: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
};

app._confirmKpiWeightImport = async function() {
    const preview = this.state._kpiWeightImportPreview;
    if (!preview) return;
    const ok = confirm(`Apply weighting to ${preview.validRows.length} KPI Code(s)? This overwrites Area/Level 1/Level 2/Level 3 % (and Final Weight) on matching KPIs.`);
    if (!ok) return;
    const result = await this.importKpiWeightData(preview.validRows, this.state._kpiSelectedCompany || 'OMC');
    this.state._kpiWeightImportResult = result;
    this.state._kpiWeightImportPreview = null;
    this.renderKpiPlannerView();
};

app._renderKpiUsersSection = function() {
    const esc = this._escHtml.bind(this);
    const users = this.state.kpiUsers || [];
    const directorates = this.state.kpiDirectorates || [];
    const csDirectorCount = this._csDirectors().length;
    const alreadyGranted = users.filter(u => u.linked_login).length;

    const dirName = (id) => directorates.find(d => d.id === id)?.name || '';

    const rows = users.map(u => `
        <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <div style="flex:1;min-width:180px;">
                <p style="font-weight:700;">${esc(u.name)} <span style="font-size:0.7rem;font-weight:400;color:#6b7280;">(${esc(u.id)})</span></p>
                <p style="font-size:0.75rem;color:#6b7280;">
                    ${u.role === 'kpi_planner' ? '📊 KPI Planner' : '📈 KPI Director'}
                    ${u.linked_login ? ' · <span style="color:#1d4ed8;">🔗 Linked to Corporate Staff login</span>' : ''}
                </p>
            </div>
            ${u.role === 'kpi_director' ? `
                <div style="display:flex;flex-direction:column;gap:6px;min-width:200px;">
                    <label style="display:flex;align-items:center;gap:6px;font-size:0.75rem;color:#374151;">
                        <input type="checkbox" ${u.can_view_all_directorates ? 'checked' : ''}
                            onchange="app.toggleKpiUserSuperUser('${u.id}', this.checked)" />
                        Super user (all directorates)
                    </label>
                    <select onchange="app.reassignKpiUserDirectorate('${u.id}', this.value)"
                        ${u.can_view_all_directorates ? 'disabled' : ''}
                        style="padding:6px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.78rem;${u.can_view_all_directorates ? 'opacity:0.5;' : ''}">
                        <option value="">— Unassigned —</option>
                        ${['OMC', 'Audit'].map(company => {
                            const inCompany = directorates.filter(d => (d.company || 'OMC') === company);
                            if (inCompany.length === 0) return '';
                            return `<optgroup label="${esc(company)}">${inCompany.map(d => `<option value="${d.id}" ${u.directorate_id === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</optgroup>`;
                        }).join('')}
                    </select>
                </div>
            ` : ''}
            <button onclick="app.confirmDeleteKpiUser('${u.id}')" style="padding:6px 12px;background:#fef2f2;color:#991b1b;border-radius:8px;font-size:0.78rem;font-weight:700;">Delete</button>
        </div>
    `).join('');

    return `
        <div class="bg-white rounded-xl shadow-md p-5 mb-5">
            <h3 class="text-lg font-bold text-gray-800 mb-1">Grant Access to Corporate Staff Directors</h3>
            <p class="text-sm text-gray-500 mb-3">
                Found ${csDirectorCount} Corporate Staff member${csDirectorCount !== 1 ? 's' : ''} whose role contains "Director"${alreadyGranted > 0 ? ` (${alreadyGranted} already granted)` : ''}.
                Granting access lets them log in with their existing Corporate Staff ID and password — no separate password to manage, it always checks their current Corporate Staff login.
            </p>
            <button onclick="app.doGrantKpiDirectorAccess()" style="padding:9px 18px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.85rem;">
                🔗 Grant Access to All Matching Directors
            </button>
        </div>

        <div class="bg-white rounded-xl shadow-md p-5">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <h3 class="text-lg font-bold text-gray-800">All KPI Users (${users.length})</h3>
                <button onclick="app.openKpiUserModal()" style="padding:8px 16px;background:#1d4ed8;color:#fff;border-radius:8px;font-size:0.85rem;font-weight:700;">+ Add User</button>
            </div>
            ${users.length === 0 ? '<p class="text-sm text-gray-400 text-center py-6">No KPI users yet.</p>' : rows}
        </div>

        <!-- Manual Add User modal -->
        <div id="kpiUserModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;padding:20px;">
            <div style="background:#fff;border-radius:16px;max-width:440px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:28px;">
                <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:16px;">Add KPI User</h3>

                <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Login ID</label>
                <input type="text" id="kpiUserModalId" placeholder="e.g. kpiplanner2"
                    style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:14px;" />

                <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Name</label>
                <input type="text" id="kpiUserModalName" placeholder="Full name"
                    style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:14px;" />

                <label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:#374151;margin-bottom:10px;">
                    <input type="checkbox" id="kpiUserModalLinked" onchange="document.getElementById('kpiUserModalPwdRow').style.display = this.checked ? 'none' : 'block';" />
                    Linked login — use the password from their existing ID on another roster (Corporate Staff, Golden Command, Employees, or Maintenance)
                </label>

                <div id="kpiUserModalPwdRow">
                    <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Password</label>
                    <input type="text" id="kpiUserModalPwd" placeholder="Set a password"
                        style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:14px;" />
                </div>

                <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Role</label>
                <select id="kpiUserModalRole" onchange="document.getElementById('kpiUserModalDirectorateRow').style.display = this.value === 'kpi_director' ? 'block' : 'none'; document.getElementById('kpiUserModalSuperRow').style.display = this.value === 'kpi_director' ? 'block' : 'none';"
                    style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:14px;">
                    <option value="kpi_planner">📊 KPI Planner</option>
                    <option value="kpi_director">📈 KPI Executive Director</option>
                </select>

                <div id="kpiUserModalSuperRow" style="display:none;margin-bottom:14px;">
                    <label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:#374151;">
                        <input type="checkbox" id="kpiUserModalSuper" onchange="document.getElementById('kpiUserModalDirectorateRow').style.display = this.checked ? 'none' : 'block';" />
                        Super user — view-only access across every directorate, not just one (no edit rights)
                    </label>
                </div>

                <div id="kpiUserModalDirectorateRow" style="display:none;margin-bottom:20px;">
                    <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Directorate</label>
                    <select id="kpiUserModalDirectorate" style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;">
                        <option value="">— Unassigned (assign later) —</option>
                        ${directorates.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}
                    </select>
                </div>

                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button onclick="app.closeKpiUserModal()" style="padding:9px 18px;border-radius:8px;font-weight:600;font-size:0.85rem;border:1.5px solid #e5e7eb;background:#fff;color:#374151;">Cancel</button>
                    <button onclick="app.saveKpiUserModal()" style="padding:9px 18px;border-radius:8px;font-weight:700;font-size:0.85rem;border:none;background:#1d4ed8;color:#fff;">Save</button>
                </div>
            </div>
        </div>
    `;
};

app.openKpiUserModal = function() {
    document.getElementById('kpiUserModalId').value = '';
    document.getElementById('kpiUserModalName').value = '';
    document.getElementById('kpiUserModalPwd').value = '';
    document.getElementById('kpiUserModalLinked').checked = false;
    document.getElementById('kpiUserModalPwdRow').style.display = 'block';
    document.getElementById('kpiUserModalRole').value = 'kpi_planner';
    document.getElementById('kpiUserModalSuper').checked = false;
    document.getElementById('kpiUserModalSuperRow').style.display = 'none';
    document.getElementById('kpiUserModalDirectorateRow').style.display = 'none';
    document.getElementById('kpiUserModal').style.display = 'flex';
};

app.closeKpiUserModal = function() {
    document.getElementById('kpiUserModal').style.display = 'none';
};

app.saveKpiUserModal = async function() {
    const id = (document.getElementById('kpiUserModalId').value || '').trim();
    const name = (document.getElementById('kpiUserModalName').value || '').trim();
    const linkedLogin = document.getElementById('kpiUserModalLinked').checked;
    const password = document.getElementById('kpiUserModalPwd').value || '';
    const role = document.getElementById('kpiUserModalRole').value;
    const canViewAllDirectorates = role === 'kpi_director' && document.getElementById('kpiUserModalSuper').checked;
    const directorateIdRaw = document.getElementById('kpiUserModalDirectorate').value;

    if (!id || !name) {
        this.showToast('Please fill in ID and name.', 'error');
        return;
    }
    // A linked-login account never needs a password typed here — its
    // real password always comes from whichever roster (CS/GC/Employees/
    // Maintenance) already has that same ID.
    if (!linkedLogin && !password) {
        this.showToast('Please set a password, or check "Linked login" to use their existing roster password instead.', 'error');
        return;
    }
    if ((this.state.kpiUsers || []).some(u => u.id === id)) {
        this.showToast('A KPI user with that ID already exists.', 'error');
        return;
    }

    const saved = await this.saveKpiUser({
        id, name, password, role,
        directorateId: (!canViewAllDirectorates && directorateIdRaw) ? parseInt(directorateIdRaw, 10) : null,
        linkedLogin, canViewAllDirectorates,
    }, null);
    if (saved) {
        this.closeKpiUserModal();
        this.renderKpiPlannerView();
    }
};

app.doGrantKpiDirectorAccess = async function() {
    await this.grantKpiDirectorAccessToCsDirectors();
    this.renderKpiPlannerView();
};

app.reassignKpiUserDirectorate = async function(userId, directorateIdRaw) {
    const user = (this.state.kpiUsers || []).find(u => u.id === userId);
    if (!user) return;
    const directorateId = directorateIdRaw ? parseInt(directorateIdRaw, 10) : null;
    await this.saveKpiUser({
        name: user.name, role: user.role, directorateId,
        linkedLogin: !!user.linked_login, password: user.password,
        // Preserve whatever super-user status this director already had —
        // this dropdown only changes their single directorate assignment,
        // it must never silently clear an existing super-user grant.
        canViewAllDirectorates: !!user.can_view_all_directorates,
    }, userId);
    this.renderKpiPlannerView();
};

// Grants or revokes "super user" (view-only, all-directorates) status on
// an EXISTING KPI Director. This is the only place that can toggle it
// after account creation — the Add User modal's checkbox only applies at
// creation time. Granting clears their single directorate_id (mirrors
// the Add User modal's own behavior: a super user has no single
// directorate); revoking leaves them unassigned so the planner picks a
// real directorate via the dropdown next.
app.toggleKpiUserSuperUser = async function(userId, isSuper) {
    const user = (this.state.kpiUsers || []).find(u => u.id === userId);
    if (!user) return;
    const saved = await this.saveKpiUser({
        name: user.name, role: user.role,
        directorateId: isSuper ? null : user.directorate_id,
        linkedLogin: !!user.linked_login, password: user.password,
        canViewAllDirectorates: isSuper,
    }, userId);
    if (saved) this.renderKpiPlannerView();
};

app.confirmDeleteKpiUser = async function(id) {
    if (!confirm('Remove this KPI user\'s access? This cannot be undone.')) return;
    const ok = await this.deleteKpiUser(id);
    if (ok) this.renderKpiPlannerView();
};


// ════════════════════════════════════════════════════════════════════
// Stage 4: KPI Executive Director dashboard — view-only, scoped to
// exactly the director's own directorate. Every number here is built
// from the pure helpers in api-kpi.js, already tested directly.
// ════════════════════════════════════════════════════════════════════
// Builds the dashboard's inner HTML (cards, chart containers, ranking,
// top/bottom lists) for a given directorate+year — shared by the real
// Director/Viewer login view below AND the Planner's "Preview Dashboard"
// tab, so the two never duplicate (and risk diverging from) the same
// rendering logic. Deliberately excludes the outer page wrapper/header/
// year-selector, since those differ between a full-page view and an
// embedded preview inside another screen's tab.
app._buildKpiDashboardBody = function(directorateId, year) {
    const esc = this._escHtml.bind(this);
    const cards = this._kpiDashboardCards(directorateId, year);
    const ranking = this._kpiDepartmentRanking(directorateId, year);
    const rankedKpis = this._kpiRankedList(directorateId, year);
    const top10 = rankedKpis.slice(0, 10);
    const bottom10 = rankedKpis.slice(-10).reverse();
    // Selector state: null/undefined means "All KPIs (Average)" — the
    // original behavior. A specific id shows just that KPI's own
    // monthly data instead, since averaging across every monthly KPI
    // gave no indication of which KPI the chart actually represented.
    // Guarded against a stale id from a DIFFERENT directorate (e.g. the
    // Planner's Preview Dashboard tab switching between directorates) —
    // only honored if it's actually one of this directorate's own
    // monthly-cadence KPIs, otherwise treated as no selection for this
    // render rather than silently showing empty data under a misleading
    // "All KPIs" title.
    const monthlyCadenceKpis = this._kpisForDirectorateDashboard(directorateId).filter(k => k.period_type === 'monthly');
    const rawSelectedMonthlyKpiId = this.state._kpiOverviewMonthlySelectedKpiId ?? null;
    const selectedMonthlyKpiId = (rawSelectedMonthlyKpiId != null && monthlyCadenceKpis.some(k => k.id === rawSelectedMonthlyKpiId))
        ? rawSelectedMonthlyKpiId : null;
    const monthly = this._kpiOverviewMonthlyChartData(directorateId, year, selectedMonthlyKpiId);
    const selectedMonthlyKpi = selectedMonthlyKpiId != null ? monthlyCadenceKpis.find(k => k.id === selectedMonthlyKpiId) : null;
    // Quarterly and Yearly are trend charts spanning every year that has
    // results — not scoped to the single selected year like Monthly is,
    // since the whole point is showing long-term performance over time.
    const quarterlyTrend = this._kpiMultiYearTrendWithAutoAggregation(directorateId, 'quarterly', year);
    const yearlyTrend = this._kpiMultiYearTrendWithAutoAggregation(directorateId, 'yearly');

    const kpiListRow = (item, color) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:0.85rem;">
            <span>${esc(item.name)}${item.weight < 1 ? ` <span style="color:#7c3aed;font-size:0.7rem;font-weight:700;">(${Math.round(item.weight * 100)}% share)</span>` : ''}</span>
            <span style="font-weight:700;color:${color};">${item.achievement}%</span>
        </div>
    `;

    return `
        <!-- Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="bg-white rounded-xl shadow p-5">
                <p class="text-xs font-semibold text-gray-500 uppercase">Total KPIs</p>
                <p class="text-3xl font-bold text-gray-800 mt-1">${cards.total}</p>
            </div>
            <div class="bg-white rounded-xl shadow p-5 border-l-4 border-emerald-500">
                <p class="text-xs font-semibold text-gray-500 uppercase">Achieved</p>
                <p class="text-3xl font-bold text-emerald-700 mt-1">${cards.achieved}</p>
            </div>
            <div class="bg-white rounded-xl shadow p-5 border-l-4 border-red-500">
                <p class="text-xs font-semibold text-gray-500 uppercase">Below Target</p>
                <p class="text-3xl font-bold text-red-700 mt-1">${cards.belowTarget}</p>
            </div>
            <div class="bg-white rounded-xl shadow p-5 border-l-4 border-gray-300">
                <p class="text-xs font-semibold text-gray-500 uppercase">Pending</p>
                <p class="text-3xl font-bold text-gray-500 mt-1">${cards.pending}</p>
            </div>
        </div>

        <!-- Monthly (single year) -->
        ${monthly.length > 0 || monthlyCadenceKpis.length > 0 ? `
            <div class="bg-white rounded-xl shadow p-5 mb-6">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
                    <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wide">
                        Monthly Performance — ${year}${selectedMonthlyKpi ? ` · ${esc(selectedMonthlyKpi.name)}` : ' · All KPIs (Average)'}
                    </h3>
                    <select onchange="app.state._kpiOverviewMonthlySelectedKpiId = this.value ? parseInt(this.value, 10) : null; app.renderKpiDirectorView();"
                        style="padding:6px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.8rem;">
                        <option value="" ${selectedMonthlyKpiId == null ? 'selected' : ''}>All KPIs (Average)</option>
                        ${monthlyCadenceKpis.map(k => `<option value="${k.id}" ${k.id === selectedMonthlyKpiId ? 'selected' : ''}>${esc(this._kpiDisplayNameWithLine(k))}${k._ownershipWeight < 1 ? ` (${Math.round(k._ownershipWeight * 100)}% share)` : ''}</option>`).join('')}
                    </select>
                </div>
                ${monthly.length > 0 ? `
                    <div style="height:220px;"><canvas id="kpiMonthlyChart"></canvas></div>
                ` : `
                    <p class="text-sm text-gray-400 text-center py-8">No results recorded yet for ${selectedMonthlyKpi ? esc(selectedMonthlyKpi.name) : 'this selection'} in ${year}.</p>
                `}
            </div>
        ` : ''}

        <!-- Quarterly and Yearly trends (all available history) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            ${quarterlyTrend.series.length > 0 ? `
                <div class="bg-white rounded-xl shadow p-5">
                    <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">Quarterly Trend</h3>
                    <p style="font-size:0.72rem;color:#9ca3af;margin-bottom:10px;">Across every quarter with recorded results</p>
                    <div style="background:#1F2937;border-radius:10px;padding:14px;box-sizing:border-box;height:248px;"><canvas id="kpiQuarterlyChart"></canvas></div>
                </div>
            ` : ''}
            ${yearlyTrend.series.length > 0 ? `
                <div class="bg-white rounded-xl shadow p-5">
                    <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">Year-over-Year Trend</h3>
                    <p style="font-size:0.72rem;color:#9ca3af;margin-bottom:10px;">Across every year with recorded results</p>
                    <div style="height:220px;"><canvas id="kpiYearlyChart"></canvas></div>
                </div>
            ` : ''}
            ${monthly.length === 0 && quarterlyTrend.series.length === 0 && yearlyTrend.series.length === 0 ? `
                <div class="bg-white rounded-xl shadow p-5 lg:col-span-2 text-center py-8">
                    <p class="text-sm text-gray-400">No results recorded yet — charts will appear once results are entered.</p>
                </div>
            ` : ''}
        </div>

        <!-- Department ranking -->
        <div class="bg-white rounded-xl shadow p-5 mb-6">
            <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Department Ranking</h3>
            ${ranking.length === 0 ? '<p class="text-sm text-gray-400 text-center py-4">No department results yet.</p>' : ranking.map((r, i) => `
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                    <span style="width:20px;color:#9ca3af;font-size:0.8rem;">#${i + 1}</span>
                    <span style="width:140px;font-size:0.85rem;font-weight:600;">${esc(r.departmentName)}</span>
                    <div style="flex:1;background:#f3f4f6;border-radius:999px;height:18px;overflow:hidden;">
                        <div style="height:100%;width:${Math.min(100, Math.max(4, r.avgAchievement))}%;background:${r.avgAchievement >= 100 ? '#10b981' : '#f59e0b'};border-radius:999px;"></div>
                    </div>
                    <span style="width:60px;text-align:right;font-size:0.8rem;font-weight:700;">${r.avgAchievement}%</span>
                </div>
            `).join('')}
        </div>

        <!-- Top / Lowest KPIs -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="bg-white rounded-xl shadow p-5">
                <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">Top KPIs</h3>
                ${top10.length === 0 ? '<p class="text-sm text-gray-400 py-4">No results yet.</p>' : top10.map(k => kpiListRow(k, '#065f46')).join('')}
            </div>
            <div class="bg-white rounded-xl shadow p-5">
                <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">Lowest KPIs</h3>
                ${bottom10.length === 0 ? '<p class="text-sm text-gray-400 py-4">No results yet.</p>' : bottom10.map(k => kpiListRow(k, '#991b1b')).join('')}
            </div>
        </div>
    `;
};

// Draws the 2 performance charts into whatever canvas elements currently
// exist in the DOM (must be called AFTER the HTML from
// _buildKpiDashboardBody has actually been inserted) — shared by both
// call sites for the same reason as the body-builder above.
app._drawKpiDashboardCharts = function(directorateId, year) {
    if (typeof Chart === 'undefined') return;
    const monthlyCadenceKpis = this._kpisForDirectorateDashboard(directorateId).filter(k => k.period_type === 'monthly');
    const rawSelectedMonthlyKpiId = this.state._kpiOverviewMonthlySelectedKpiId ?? null;
    const selectedMonthlyKpiId = (rawSelectedMonthlyKpiId != null && monthlyCadenceKpis.some(k => k.id === rawSelectedMonthlyKpiId))
        ? rawSelectedMonthlyKpiId : null;
    const monthly = this._kpiOverviewMonthlyChartData(directorateId, year, selectedMonthlyKpiId);
    const quarterlyTrend = this._kpiMultiYearTrendWithAutoAggregation(directorateId, 'quarterly', year);
    const yearlyTrend = this._kpiMultiYearTrendWithAutoAggregation(directorateId, 'yearly');

    if (this._kpiMonthlyChart) { this._kpiMonthlyChart.destroy(); this._kpiMonthlyChart = null; }
    if (this._kpiQuarterlyChart) { this._kpiQuarterlyChart.destroy(); this._kpiQuarterlyChart = null; }
    if (this._kpiYearlyChart) { this._kpiYearlyChart.destroy(); this._kpiYearlyChart = null; }

    const monthlyCtx = document.getElementById('kpiMonthlyChart');
    if (monthlyCtx && monthly.length > 0) {
        this._kpiMonthlyChart = new Chart(monthlyCtx, {
            type: 'bar',
            data: {
                labels: monthly.map(m => this.state.months[parseInt(m.period, 10) - 1]?.slice(0, 3) || m.period),
                datasets: [{
                    label: 'Avg Achievement %',
                    data: monthly.map(m => m.avgAchievement),
                    backgroundColor: '#1d4ed8',
                    borderRadius: 4,
                    details: monthly, // consumed by the tooltip callback below, not read by Chart.js itself
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    // Rich, multi-line tooltip matching the Quarterly/
                    // Year-over-Year trend charts — Value, Achievement,
                    // Target — rather than just the achievement figure
                    // shown above the bar.
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const d = ctx.dataset.details ? ctx.dataset.details[ctx.dataIndex] : null;
                                const lines = [];
                                if (d && d.avgActual != null) lines.push(`Value: ${d.avgActual}`);
                                lines.push(`Achievement: ${ctx.parsed.y}%`);
                                if (d && d.avgTarget != null) lines.push(`Target: ${d.avgTarget}`);
                                return lines;
                            },
                        },
                    },
                    datalabels: {
                        anchor: 'end', align: 'top',
                        color: '#1e3a8a', font: { weight: 'bold', size: 11 },
                        formatter: v => v + '%',
                    },
                },
                scales: { y: { beginAtZero: true } },
                layout: { padding: { top: 16 } },
            },
            plugins: (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [],
        });
    }

    // Quarterly/Yearly trend charts share the same shape: one line per
    // KPI, plotted across every period that has a result. A shared
    // helper keeps them from drifting apart in styling.
    const drawTrendChart = (canvasId, trend, darkTheme, showLabels) => {
        const ctx = document.getElementById(canvasId);
        if (!ctx || trend.series.length === 0) return null;
        const colorsForThisChart = this._kpiColorsForSeries(trend.series);
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: trend.labels,
                datasets: trend.series.map((s, i) => ({
                    label: s.name,
                    data: s.data,
                    backgroundColor: colorsForThisChart.get(s.id),
                    borderRadius: 4,
                    details: s.details, // consumed by the tooltip callback below, not read by Chart.js itself
                })),
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: trend.series.length > 1, position: 'bottom',
                        labels: { boxWidth: 10, font: { size: 10 }, color: darkTheme ? '#e5e7eb' : undefined },
                    },
                    // Rich, multi-line hover tooltip — KPI name, period,
                    // actual value, achievement %, and target — reducing
                    // on-chart clutter from always-visible labels (real
                    // problem confirmed with 4 KPIs x 4 periods = 16
                    // labels at once) while still surfacing full detail
                    // on demand.
                    tooltip: {
                        callbacks: {
                            title: items => items[0]?.label ?? '',
                            label: ctx => {
                                const d = ctx.dataset.details ? ctx.dataset.details[ctx.dataIndex] : null;
                                const lines = [ctx.dataset.label];
                                if (d && d.actualValue != null) lines.push(`Value: ${d.actualValue}`);
                                lines.push(`Achievement: ${ctx.parsed.y}%`);
                                if (d && d.targetValue != null) lines.push(`Target: ${d.targetValue}`);
                                return lines;
                            },
                        },
                    },
                    ...(showLabels ? {
                        datalabels: {
                            anchor: 'end', align: 'top',
                            color: darkTheme ? '#ffffff' : '#374151',
                            font: { weight: 'bold', size: 10 },
                            formatter: v => v != null ? v + '%' : '',
                        },
                    } : {}),
                },
                scales: darkTheme ? {
                    y: { beginAtZero: true, ticks: { color: '#e5e7eb' }, grid: { color: 'rgba(255,255,255,0.08)' } },
                    x: { ticks: { color: '#e5e7eb' }, grid: { display: false } },
                } : { y: { beginAtZero: true } },
                layout: showLabels ? { padding: { top: 16 } } : undefined,
            },
            plugins: (showLabels && typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [],
        });
    };

    this._kpiQuarterlyChart = drawTrendChart('kpiQuarterlyChart', quarterlyTrend, true, false);
    this._kpiYearlyChart = drawTrendChart('kpiYearlyChart', yearlyTrend, false, false);
};

app.renderKpiDirectorView = function() {
    const content = document.getElementById('contentArea');
    const esc = this._escHtml.bind(this);
    const user = this.state.verifiedKpiUser;
    const isSuperUser = !!(user && user.can_view_all_directorates);
    // A super user (view-only across every directorate) picks which one
    // to view via a selector below, rather than being locked to
    // user.directorate_id like a normal, single-directorate director.
    const directorateId = isSuperUser
        ? (this.state._kpiSuperUserSelectedDirectorateId ?? (this.state.kpiDirectorates || [])[0]?.id ?? null)
        : (user ? user.directorate_id : null);

    if (!directorateId) {
        content.innerHTML = `
            <div class="max-w-3xl mx-auto">
                <div class="bg-white rounded-xl shadow-md p-8 text-center">
                    <p style="font-size:2.5rem;">⏳</p>
                    <h2 class="text-xl font-bold text-gray-800 mt-2">${isSuperUser ? 'No Directorates Yet' : 'Not Yet Assigned to a Directorate'}</h2>
                    <p class="text-sm text-gray-500 mt-2">Welcome, ${esc(user ? user.name : '')}. ${isSuperUser ? 'No directorates have been created yet — once the KPI Planner adds one, you\'ll be able to browse it here.' : 'Your account hasn\'t been assigned to a directorate yet — once the KPI Planner assigns you one, your KPI dashboard will appear here.'}</p>
                </div>
            </div>
        `;
        return;
    }

    const directorate = (this.state.kpiDirectorates || []).find(d => d.id === directorateId);
    const year = this.state._kpiDashboardYear || new Date().getFullYear();
    const yearOptions = [year - 1, year, year + 1].map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('');
    const tab = this.state._kpiDirectorTab || 'overview';
    const kpisInScope = this._kpisForDirectorateDashboard(directorateId);

    const tabBtn = (key, label) => `
        <button onclick="app.state._kpiDirectorTab='${key}';app.renderKpiDirectorView();"
            class="px-4 py-2 rounded-lg font-semibold text-sm ${tab === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}">
            ${label}
        </button>
    `;

    let bodyHtml, kpiPickerHtml = '';
    let selectedKpiWeight = 1;
    if (tab === 'detail') {
        if (kpisInScope.length === 0) {
            bodyHtml = `<div class="bg-white rounded-xl shadow p-8 text-center"><p class="text-sm text-gray-400">No KPIs configured for this directorate yet.</p></div>`;
        } else {
            const selectedKpiId = this.state._kpiDirectorSelectedKpiId || kpisInScope[0].id;
            const selectedKpiClone = kpisInScope.find(k => k.id === selectedKpiId);
            selectedKpiWeight = selectedKpiClone ? selectedKpiClone._ownershipWeight : 1;
            const kpiOptions = kpisInScope.map(k => `<option value="${k.id}" ${k.id === selectedKpiId ? 'selected' : ''}>${esc(this._kpiDisplayNameWithLine(k))}${k._ownershipWeight < 1 ? ` (${Math.round(k._ownershipWeight * 100)}% share)` : ''}</option>`).join('');
            kpiPickerHtml = `
                <select onchange="app.state._kpiDirectorSelectedKpiId = parseInt(this.value, 10); app.renderKpiDirectorView();"
                    style="padding:8px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;font-weight:600;">
                    ${kpiOptions}
                </select>
            `;
            bodyHtml = this._buildKpiSingleDetailBody(selectedKpiId, year, selectedKpiWeight);
        }
    } else {
        bodyHtml = this._buildKpiDashboardBody(directorateId, year);
    }

    content.innerHTML = `
        <div class="max-w-6xl mx-auto">
            <div class="flex justify-between items-center flex-wrap gap-3 mb-4">
                <div>
                    <h2 class="text-2xl font-bold text-gray-800">📈 ${esc(directorate ? directorate.name : 'KPI')} Dashboard</h2>
                    <p class="text-gray-500 text-sm mt-1">Welcome, ${esc(user.name)}.${isSuperUser ? ' <span style="background:#faf5ff;color:#7c3aed;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:700;margin-left:6px;">👁️ VIEW-ONLY · ALL DIRECTORATES</span>' : ''}</p>
                </div>
                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                    ${isSuperUser ? `
                        <select onchange="app.state._kpiSuperUserSelectedDirectorateId = parseInt(this.value, 10); app.state._kpiDirectorSelectedKpiId = null; app.renderKpiDirectorView();"
                            style="padding:8px 14px;border:1.5px solid #7c3aed;border-radius:8px;font-size:0.85rem;font-weight:600;color:#7c3aed;">
                            ${['OMC', 'Audit'].map(company => {
                                const inCompany = (this.state.kpiDirectorates || []).filter(d => (d.company || 'OMC') === company);
                                if (inCompany.length === 0) return '';
                                return `<optgroup label="${esc(company)}">${inCompany.map(d => `<option value="${d.id}" ${d.id === directorateId ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</optgroup>`;
                            }).join('')}
                        </select>
                    ` : ''}
                    ${kpiPickerHtml}
                    <select onchange="app.state._kpiDashboardYear = parseInt(this.value, 10); app.renderKpiDirectorView();"
                        style="padding:8px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;font-weight:600;">
                        ${yearOptions}
                    </select>
                </div>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:20px;">
                ${tabBtn('overview', '🏛️ Overview')}
                ${tabBtn('detail', '🔍 KPI Detail')}
            </div>
            ${bodyHtml}
        </div>
    `;

    if (tab === 'detail' && kpisInScope.length > 0) {
        this._drawKpiSingleDetailChart(this.state._kpiDirectorSelectedKpiId || kpisInScope[0].id, year, selectedKpiWeight);
    } else {
        this._drawKpiDashboardCharts(directorateId, year);
    }
};

// ════════════════════════════════════════════════════════════════════
// Per-KPI Detail view — the reference-image redesign. A director picks
// one specific KPI and sees a full detail breakdown: 5 summary cards,
// a color-coded monthly bar chart with a target line, top/lowest
// performing months, and a rule-based narrative summary. Everything here
// reads from _kpiSingleYearStats/_kpiMonthsRanked/_kpiRuleBasedSummary,
// already tested independently in api-kpi.js.
// ════════════════════════════════════════════════════════════════════
app._buildKpiSingleDetailBody = function(kpiId, year, weight) {
    const esc = this._escHtml.bind(this);
    const stats = this._kpiSingleYearStats(kpiId, year, weight);

    if (!stats) {
        return `
            <div class="bg-white rounded-xl shadow p-8 text-center">
                <p class="text-sm text-gray-400">No results recorded yet for this KPI in ${year}.</p>
            </div>
        `;
    }

    const yearStatus = this._kpiYearStatusLabel(stats.overallAchievement);
    const monthName = (p) => this.state.months[parseInt(p, 10) - 1]?.slice(0, 3) || p;
    const ranked = this._kpiMonthsRanked(kpiId, year, weight);
    const top5 = ranked.slice(0, 5);
    const bottom5 = ranked.slice(-5).reverse();
    const summaryLines = this._kpiRuleBasedSummary(kpiId, year, weight);
    const sharePct = weight != null ? Math.round(weight * 100) : 100;

    const tierColor = { above: '#059669', near: '#d97706', below: '#dc2626', none: '#9ca3af' };
    const dots = stats.monthlyResults.map(m => `<span title="${esc(monthName(m.period))}: ${m.achievement}%" style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${tierColor[this._kpiMonthColorTier(m.achievement)]};margin-right:3px;"></span>`).join('');

    const monthRow = (item, color) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:0.82rem;">
            <span>${esc(monthName(item.period))}</span>
            <span style="font-weight:700;color:${color};">${item.achievement}%</span>
        </div>
    `;

    return `
        ${sharePct < 100 ? `
            <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:10px 16px;margin-bottom:16px;font-size:0.82rem;color:#7c3aed;">
                🤝 This directorate owns <strong>${sharePct}%</strong> of this KPI. The achievement % below reflects the KPI's actual overall performance — your ${sharePct}% share is what counts toward this directorate's own totals and averages.
            </div>
        ` : ''}
        <!-- 5 summary cards -->
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div class="bg-white rounded-xl shadow p-5">
                <p class="text-xs font-semibold text-gray-500 uppercase">Overall Achievement</p>
                <p class="text-2xl font-bold mt-1" style="color:${stats.overallAchievement >= 100 ? '#059669' : '#dc2626'};">${stats.overallAchievement}%</p>
            </div>
            <div class="bg-white rounded-xl shadow p-5">
                <p class="text-xs font-semibold text-gray-500 uppercase">Target Achieved</p>
                <p class="text-2xl font-bold text-gray-800 mt-1">${stats.targetsMetCount} / ${stats.totalMonthsWithData}</p>
                <p style="margin-top:6px;">${dots}</p>
            </div>
            <div class="bg-white rounded-xl shadow p-5 border-l-4 border-emerald-500">
                <p class="text-xs font-semibold text-gray-500 uppercase">Best Month</p>
                <p class="text-lg font-bold text-emerald-700 mt-1">${esc(monthName(stats.bestMonth.period))}</p>
                <p class="text-xs text-gray-500">${stats.bestMonth.achievement}%</p>
            </div>
            <div class="bg-white rounded-xl shadow p-5 border-l-4 border-red-500">
                <p class="text-xs font-semibold text-gray-500 uppercase">Lowest Month</p>
                <p class="text-lg font-bold text-red-700 mt-1">${esc(monthName(stats.lowestMonth.period))}</p>
                <p class="text-xs text-gray-500">${stats.lowestMonth.achievement}%</p>
            </div>
            <div class="bg-white rounded-xl shadow p-5" style="border-left:4px solid ${yearStatus.color};">
                <p class="text-xs font-semibold text-gray-500 uppercase">Year Status</p>
                <p class="text-lg font-bold mt-1" style="color:${yearStatus.color};">${esc(yearStatus.label)}</p>
                <p class="text-xs text-gray-500">${esc(yearStatus.description)}</p>
            </div>
        </div>

        <!-- Color-coded monthly chart -->
        <div class="bg-white rounded-xl shadow p-5 mb-6">
            <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Monthly Performance — ${year}</h3>
            <div style="height:260px;"><canvas id="kpiSingleDetailChart"></canvas></div>
            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:0.72rem;color:#6b7280;">
                <span><span style="display:inline-block;width:9px;height:9px;border-radius:999px;background:#059669;margin-right:4px;"></span>Above Target (≥100%)</span>
                <span><span style="display:inline-block;width:9px;height:9px;border-radius:999px;background:#d97706;margin-right:4px;"></span>Near Target (80%-99%)</span>
                <span><span style="display:inline-block;width:9px;height:9px;border-radius:999px;background:#dc2626;margin-right:4px;"></span>Below Target (&lt;80%)</span>
                <span><span style="display:inline-block;width:9px;height:9px;border-radius:999px;background:#9ca3af;margin-right:4px;"></span>No Data</span>
            </div>
        </div>

        <!-- Top / Lowest performing months -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div class="bg-white rounded-xl shadow p-5">
                <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">Top Performing Months</h3>
                ${top5.length === 0 ? '<p class="text-sm text-gray-400 py-4">No data yet.</p>' : top5.map(m => monthRow(m, '#065f46')).join('')}
            </div>
            <div class="bg-white rounded-xl shadow p-5">
                <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">Lowest Performing Months</h3>
                ${bottom5.length === 0 ? '<p class="text-sm text-gray-400 py-4">No data yet.</p>' : bottom5.map(m => monthRow(m, '#991b1b')).join('')}
            </div>
        </div>

        <!-- Rule-based performance summary -->
        <div class="bg-white rounded-xl shadow p-5">
            <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Performance Summary</h3>
            <ul style="margin:0;padding-left:18px;font-size:0.85rem;color:#374151;line-height:1.8;">
                ${summaryLines.map(l => `<li>${esc(l)}</li>`).join('')}
            </ul>
        </div>
    `;
};

// Draws the color-coded monthly bar chart (per-bar color by tier) with a
// dashed target-line overlay — a Chart.js bar+line mixed chart.
app._drawKpiSingleDetailChart = function(kpiId, year, weight) {
    if (typeof Chart === 'undefined') return;
    const stats = this._kpiSingleYearStats(kpiId, year, weight);
    if (this._kpiSingleDetailChartInstance) { this._kpiSingleDetailChartInstance.destroy(); this._kpiSingleDetailChartInstance = null; }
    if (!stats) return;

    const ctx = document.getElementById('kpiSingleDetailChart');
    if (!ctx) return;

    const kpiDef = (this.state.kpiDefinitions || []).find(k => k.id === kpiId);
    const tierColor = { above: '#059669', near: '#d97706', below: '#dc2626', none: '#9ca3af' };
    const monthName = (p) => this.state.months[parseInt(p, 10) - 1]?.slice(0, 3) || p;

    // Convert each raw threshold into the SAME achievement-% scale the
    // bars already use — "what achievement % would this month have
    // scored if its actual value exactly hit this threshold" — using the
    // identical direction-aware formula _computeKpiResultFields uses for
    // real results (higher_is_better: value/target*100; lower_is_better:
    // target/value*100, inverted). Acceptable is always exactly 100% by
    // definition, since Acceptable IS the target. This is what lets three
    // thresholds on a KPI's own raw unit (%, count, currency, whatever)
    // sit correctly on one shared achievement-% axis alongside the bars.
    const target = kpiDef ? kpiDef.target_value : null;
    const lowerIsBetter = kpiDef && kpiDef.direction === 'lower_is_better';
    const thresholdAsAchievement = (value) => {
        if (value == null || target == null || target === 0 || value === 0) return null;
        return lowerIsBetter ? (target / value) * 100 : (value / target) * 100;
    };
    const exceptionalLine = kpiDef ? thresholdAsAchievement(kpiDef.exceptional_value) : null;
    const acceptableLine = target != null ? 100 : null;
    const unacceptableLine = kpiDef ? thresholdAsAchievement(kpiDef.unacceptable_value) : null;

    const datasets = [
        {
            type: 'bar',
            label: 'Achievement (%)',
            data: stats.monthlyResults.map(m => m.achievement),
            backgroundColor: stats.monthlyResults.map(m => tierColor[this._kpiMonthColorTier(m.achievement)]),
            borderRadius: 4,
            order: 1,
        },
    ];
    const edgePointRadius = (context) => (context.dataIndex === 0 || context.dataIndex === stats.monthlyResults.length - 1) ? 5 : 0;

    if (exceptionalLine != null) {
        datasets.push({
            type: 'line', label: `Exceptional (${exceptionalLine.toFixed(1)}%)`,
            data: stats.monthlyResults.map(() => exceptionalLine),
            borderColor: '#059669', borderDash: [2, 2], borderWidth: 2, order: 0,
            pointStyle: 'triangle', pointRadius: edgePointRadius, pointBackgroundColor: '#059669', pointBorderColor: '#059669',
        });
    }
    if (acceptableLine != null) {
        datasets.push({
            type: 'line', label: `Acceptable (${acceptableLine.toFixed(1)}%)`,
            data: stats.monthlyResults.map(() => acceptableLine),
            borderColor: '#1d4ed8', borderDash: [10, 3], borderWidth: 2, order: 0,
            pointStyle: 'circle', pointRadius: edgePointRadius, pointBackgroundColor: '#1d4ed8', pointBorderColor: '#1d4ed8',
        });
    }
    if (unacceptableLine != null) {
        datasets.push({
            type: 'line', label: `Unacceptable (${unacceptableLine.toFixed(1)}%)`,
            data: stats.monthlyResults.map(() => unacceptableLine),
            borderColor: '#dc2626', borderDash: [5, 3, 1, 3], borderWidth: 2, order: 0,
            pointStyle: 'rectRot', pointRadius: edgePointRadius, pointBackgroundColor: '#dc2626', pointBorderColor: '#dc2626',
        });
    }

    this._kpiSingleDetailChartInstance = new Chart(ctx, {
        data: { labels: stats.monthlyResults.map(m => monthName(m.period)), datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            // When the three thresholds sit close together (e.g. 101%/
            // 100%/99%), the lines themselves can visually overlap and
            // become hard to tell apart no matter how they're styled —
            // 'index' mode means hovering ANYWHERE on the chart shows
            // every series' exact value at that point in one tooltip, so
            // there's always a reliable way to read them apart.
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: true, position: 'right', labels: { boxWidth: 14, font: { size: 11 } } },
                tooltip: { mode: 'index', intersect: false },
                datalabels: {
                    anchor: 'end', align: 'top', color: '#374151', font: { weight: 'bold', size: 10 },
                    formatter: (v, ctx) => {
                        if (ctx.dataset.type !== 'bar') return '';
                        const m = stats.monthlyResults[ctx.dataIndex];
                        if (!m || m.actualValue == null) return '';
                        // "%"-unit KPIs read naturally as "85.86%" (no
                        // space); anything else gets a space before the
                        // unit ("42 days", "3 Number" if unit is literally
                        // "Number", etc.) — falls back to the bare number
                        // when no unit is set at all.
                        const unit = kpiDef ? kpiDef.unit : '';
                        return unit === '%' ? `${m.actualValue}%` : `${m.actualValue}${unit ? ' ' + unit : ''}`;
                    },
                },
            },
            scales: { y: { beginAtZero: true } },
        },
        plugins: (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [],
    });
};

