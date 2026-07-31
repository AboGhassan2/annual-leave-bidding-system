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
    else sectionHtml = this._renderKpiUsersSection();

    content.innerHTML = `
        <div class="max-w-5xl mx-auto">
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-gray-800">📊 KPI Planner</h2>
                <p class="text-gray-500 text-sm mt-1">Define directorates, KPIs, and enter results.</p>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
                ${tabBtn('directorates', '🏛️', 'Directorates')}
                ${tabBtn('kpis', '📈', 'KPIs')}
                ${tabBtn('results', '✏️', 'Enter Results')}
                ${tabBtn('preview', '👁️', 'Preview Dashboard')}
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
    const directorates = this.state.kpiDirectorates || [];

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
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <h3 class="text-lg font-bold text-gray-800">Directorates</h3>
                <button onclick="app.openKpiDirectorateModal(null)" style="padding:8px 16px;background:#1d4ed8;color:#fff;border-radius:8px;font-size:0.85rem;font-weight:700;">+ Add Directorate</button>
            </div>
            <p style="font-size:0.75rem;color:#9ca3af;margin-bottom:12px;">Every directorate automatically has 4 operational lines — L3, L4, L5, L6. KPIs are configured per line when you add them.</p>
            ${directorates.length === 0 ? '<p class="text-sm text-gray-400 text-center py-6">No directorates yet — add one to get started.</p>' : rows}
        </div>

        <!-- Directorate modal — name only, the 4 lines are created automatically -->
        <div id="kpiDirectorateModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;padding:20px;">
            <div style="background:#fff;border-radius:16px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:28px;">
                <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:16px;" id="kpiDirectorateModalTitle">Add Directorate</h3>
                <input type="hidden" id="kpiDirectorateEditId" value="" />
                <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Directorate Name</label>
                <input type="text" id="kpiDirectorateName" placeholder="e.g. Operations Directorate"
                    style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:8px;" />
                <p style="font-size:0.72rem;color:#9ca3af;margin-bottom:20px;">Lines L3, L4, L5, and L6 will be created automatically under this directorate.</p>
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

    const saved = await this.saveKpiDirectorate(name, idNum);
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

// ════════════════════════════════════════════════════════════════════
// Section 2: KPI Definitions
// ════════════════════════════════════════════════════════════════════
app._renderKpiDefinitionsSection = function() {
    const esc = this._escHtml.bind(this);
    const definitions = this.state.kpiDefinitions || [];
    const directorates = this.state.kpiDirectorates || [];

    if (directorates.length === 0) {
        return `
            <div class="bg-white rounded-xl shadow-md p-5">
                <p class="text-sm text-gray-400 text-center py-6">Add a directorate first — every KPI must belong to one.</p>
            </div>
        `;
    }

    const rows = definitions.map(k => {
        const dir = directorates.find(d => d.id === k.directorate_id);
        const line = (this.state.kpiDirectorateDepartments || []).find(d => d.id === k.department_id);
        const dirLabel = { higher_is_better: 'Higher is better', lower_is_better: 'Lower is better' }[k.direction] || k.direction;
        return `
            <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <p style="font-weight:700;">${esc(k.name)} ${k.category ? `<span style="font-size:0.72rem;color:#6b7280;font-weight:400;">(${esc(k.category)})</span>` : ''}</p>
                    <p style="font-size:0.75rem;color:#6b7280;">${esc(dir ? dir.name : 'Unknown directorate')}${line ? ' · ' + esc(line.department_name) : ''} · Target: ${esc(String(k.target_value))}${k.unit ? ' ' + esc(k.unit) : ''} · ${esc(k.period_type)} · ${esc(dirLabel)}</p>
                </div>
                <div style="display:flex;gap:8px;">
                    <button onclick="app.openKpiDefinitionModal(${k.id})" style="padding:6px 12px;background:#eff6ff;color:#1d4ed8;border-radius:8px;font-size:0.78rem;font-weight:700;">Edit</button>
                    <button onclick="app.confirmDeleteKpiDefinition(${k.id})" style="padding:6px 12px;background:#fef2f2;color:#991b1b;border-radius:8px;font-size:0.78rem;font-weight:700;">Delete</button>
                </div>
            </div>
        `;
    }).join('');

    const directorateOptions = directorates.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');

    return `
        <div class="bg-white rounded-xl shadow-md p-5">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <h3 class="text-lg font-bold text-gray-800">KPIs</h3>
                <button onclick="app.openKpiDefinitionModal(null)" style="padding:8px 16px;background:#1d4ed8;color:#fff;border-radius:8px;font-size:0.85rem;font-weight:700;">+ Add KPI</button>
            </div>
            ${definitions.length === 0 ? '<p class="text-sm text-gray-400 text-center py-6">No KPIs yet — add one above.</p>' : rows}
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

                <div style="display:flex;gap:10px;margin-bottom:14px;">
                    <div style="flex:1;">
                        <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Target Value</label>
                        <input type="number" id="kpiDefTarget" step="any"
                            style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;" />
                    </div>
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
    document.getElementById('kpiDefDirectorate').value = existing ? existing.directorate_id : (this.state.kpiDirectorates[0]?.id || '');
    document.getElementById('kpiDefName').value = existing ? existing.name : '';
    document.getElementById('kpiDefCategory').value = existing ? (existing.category || '') : '';
    document.getElementById('kpiDefTarget').value = existing ? existing.target_value : '';
    document.getElementById('kpiDefUnit').value = existing ? (existing.unit || '') : '';
    document.getElementById('kpiDefPeriodType').value = existing ? existing.period_type : 'monthly';
    document.getElementById('kpiDefDirection').value = existing ? existing.direction : 'higher_is_better';
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
    if (targetValue === '') { this.showToast('Please enter a target value.', 'error'); return; }
    const lineIdRaw = document.getElementById('kpiDefLine').value;
    if (!lineIdRaw) { this.showToast('Please select a line.', 'error'); return; }

    const existingId = document.getElementById('kpiDefinitionEditId').value;
    const def = {
        directorateId: parseInt(document.getElementById('kpiDefDirectorate').value, 10),
        departmentId: parseInt(lineIdRaw, 10),
        name,
        category: document.getElementById('kpiDefCategory').value.trim(),
        unit: document.getElementById('kpiDefUnit').value.trim(),
        targetValue: Number(targetValue),
        periodType: document.getElementById('kpiDefPeriodType').value,
        direction: document.getElementById('kpiDefDirection').value,
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
    const definitions = this.state.kpiDefinitions || [];

    if (definitions.length === 0) {
        return `
            <div class="bg-white rounded-xl shadow-md p-5">
                <p class="text-sm text-gray-400 text-center py-6">Add a KPI first — results are recorded against a specific KPI.</p>
            </div>
        `;
    }

    const selectedId = this.state._kpiResultsSelectedId || definitions[0].id;
    const selected = definitions.find(k => k.id === selectedId) || definitions[0];
    const selectedYear = this.state._kpiResultsSelectedYear || this.state.biddingYear || new Date().getFullYear();
    const periodOptions = this.kpiPeriodOptions(selected.period_type, selectedYear);
    const existingResults = (this.state.kpiResults || [])
        .filter(r => r.kpi_definition_id === selected.id)
        .sort((a, b) => a.period_label.localeCompare(b.period_label));

    const kpiOptions = definitions.map(k => `<option value="${k.id}" ${k.id === selected.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('');
    const periodSelectOptions = periodOptions.map(p => `<option value="${esc(p.value)}">${esc(p.label)}</option>`).join('');
    const yearOptions = [selectedYear - 1, selectedYear, selectedYear + 1].map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`).join('');

    const resultsRows = existingResults.map(r => {
        // Prefer the stored status/achievement (computed and snapshotted at
        // entry time) — falls back to a live computation only for older
        // rows saved before this snapshotting existed.
        const status = r.status || this.kpiStatus(r.actual_value, r.target_value ?? selected.target_value, selected.direction);
        const statusBadge = { on_target: ['On Target', '#d1fae5', '#065f46'], below_target: ['Below Target', '#fee2e2', '#991b1b'], no_data: ['—', '#f3f4f6', '#6b7280'] }[status];
        return `
            <tr>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${esc(r.period_label)}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${esc(String(r.actual_value))}${selected.unit ? ' ' + esc(selected.unit) : ''}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${r.achievement != null ? esc(String(r.achievement)) + '%' : '—'}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;"><span style="background:${statusBadge[1]};color:${statusBadge[2]};padding:2px 10px;border-radius:999px;font-size:0.72rem;font-weight:700;">${statusBadge[0]}</span></td>
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

            <h4 style="font-size:0.85rem;font-weight:700;margin-bottom:8px;">Recorded results for ${esc(selected.name)}</h4>
            ${existingResults.length === 0 ? '<p class="text-sm text-gray-400">No results recorded yet.</p>' : `
                <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                    <thead>
                        <tr style="text-align:left;color:#6b7280;font-size:0.72rem;text-transform:uppercase;">
                            <th style="padding:8px 12px;">Period</th>
                            <th style="padding:8px 12px;">Actual</th>
                            <th style="padding:8px 12px;">Achievement</th>
                            <th style="padding:8px 12px;">Status</th>
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
    const directorateOptions = directorates.map(d => `<option value="${d.id}" ${d.id === selectedDirectorateId ? 'selected' : ''}>${esc(d.name)}</option>`).join('');

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
                <select onchange="app.reassignKpiUserDirectorate('${u.id}', this.value)"
                    style="padding:6px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.78rem;">
                    <option value="">— Unassigned —</option>
                    ${directorates.map(d => `<option value="${d.id}" ${u.directorate_id === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
                </select>
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

                <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Password</label>
                <input type="text" id="kpiUserModalPwd" placeholder="Set a password"
                    style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:14px;" />

                <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Role</label>
                <select id="kpiUserModalRole" onchange="document.getElementById('kpiUserModalDirectorateRow').style.display = this.value === 'kpi_director' ? 'block' : 'none';"
                    style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:14px;">
                    <option value="kpi_planner">📊 KPI Planner</option>
                    <option value="kpi_director">📈 KPI Executive Director</option>
                </select>

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
    document.getElementById('kpiUserModalRole').value = 'kpi_planner';
    document.getElementById('kpiUserModalDirectorateRow').style.display = 'none';
    document.getElementById('kpiUserModal').style.display = 'flex';
};

app.closeKpiUserModal = function() {
    document.getElementById('kpiUserModal').style.display = 'none';
};

app.saveKpiUserModal = async function() {
    const id = (document.getElementById('kpiUserModalId').value || '').trim();
    const name = (document.getElementById('kpiUserModalName').value || '').trim();
    const password = document.getElementById('kpiUserModalPwd').value || '';
    const role = document.getElementById('kpiUserModalRole').value;
    const directorateIdRaw = document.getElementById('kpiUserModalDirectorate').value;

    if (!id || !name || !password) {
        this.showToast('Please fill in ID, name, and password.', 'error');
        return;
    }
    if ((this.state.kpiUsers || []).some(u => u.id === id)) {
        this.showToast('A KPI user with that ID already exists.', 'error');
        return;
    }

    const saved = await this.saveKpiUser({
        id, name, password, role,
        directorateId: directorateIdRaw ? parseInt(directorateIdRaw, 10) : null,
        linkedLogin: false,
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
    }, userId);
    this.renderKpiPlannerView();
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
    const monthly = this._kpiPerformanceByPeriod(directorateId, year, 'monthly');
    // Quarterly and Yearly are trend charts spanning every year that has
    // results — not scoped to the single selected year like Monthly is,
    // since the whole point is showing long-term performance over time.
    const quarterlyTrend = this._kpiMultiYearTrend(directorateId, 'quarterly');
    const yearlyTrend = this._kpiMultiYearTrend(directorateId, 'yearly');

    const kpiListRow = (item, color) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:0.85rem;">
            <span>${esc(item.name)}</span>
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
        ${monthly.length > 0 ? `
            <div class="bg-white rounded-xl shadow p-5 mb-6">
                <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Monthly Performance — ${year}</h3>
                <div style="height:220px;"><canvas id="kpiMonthlyChart"></canvas></div>
            </div>
        ` : ''}

        <!-- Quarterly and Yearly trends (all available history) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            ${quarterlyTrend.series.length > 0 ? `
                <div class="bg-white rounded-xl shadow p-5">
                    <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">Quarterly Trend</h3>
                    <p style="font-size:0.72rem;color:#9ca3af;margin-bottom:10px;">Across every quarter with recorded results</p>
                    <div style="height:220px;"><canvas id="kpiQuarterlyChart"></canvas></div>
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
    const monthly = this._kpiPerformanceByPeriod(directorateId, year, 'monthly');
    const quarterlyTrend = this._kpiMultiYearTrend(directorateId, 'quarterly');
    const yearlyTrend = this._kpiMultiYearTrend(directorateId, 'yearly');
    const trendColors = ['#1d4ed8', '#7c3aed', '#059669', '#dc2626', '#d97706', '#0891b2'];

    if (this._kpiMonthlyChart) { this._kpiMonthlyChart.destroy(); this._kpiMonthlyChart = null; }
    if (this._kpiQuarterlyChart) { this._kpiQuarterlyChart.destroy(); this._kpiQuarterlyChart = null; }
    if (this._kpiYearlyChart) { this._kpiYearlyChart.destroy(); this._kpiYearlyChart = null; }

    const monthlyCtx = document.getElementById('kpiMonthlyChart');
    if (monthlyCtx && monthly.length > 0) {
        this._kpiMonthlyChart = new Chart(monthlyCtx, {
            type: 'bar',
            data: {
                labels: monthly.map(m => this.state.months[parseInt(m.period, 10) - 1]?.slice(0, 3) || m.period),
                datasets: [{ label: 'Avg Achievement %', data: monthly.map(m => m.avgAchievement), backgroundColor: '#1d4ed8', borderRadius: 4 }],
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
        });
    }

    // Quarterly/Yearly trend charts share the same shape: one line per
    // KPI, plotted across every period that has a result. A shared
    // helper keeps them from drifting apart in styling.
    const drawTrendChart = (canvasId, trend) => {
        const ctx = document.getElementById(canvasId);
        if (!ctx || trend.series.length === 0) return null;
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: trend.labels,
                datasets: trend.series.map((s, i) => ({
                    label: s.name,
                    data: s.data,
                    borderColor: trendColors[i % trendColors.length],
                    backgroundColor: trendColors[i % trendColors.length],
                    spanGaps: true,
                    tension: 0.25,
                })),
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: trend.series.length > 1, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
                scales: { y: { beginAtZero: true } },
            },
        });
    };

    this._kpiQuarterlyChart = drawTrendChart('kpiQuarterlyChart', quarterlyTrend);
    this._kpiYearlyChart = drawTrendChart('kpiYearlyChart', yearlyTrend);
};

app.renderKpiDirectorView = function() {
    const content = document.getElementById('contentArea');
    const esc = this._escHtml.bind(this);
    const user = this.state.verifiedKpiUser;
    const directorateId = user ? user.directorate_id : null;

    if (!directorateId) {
        content.innerHTML = `
            <div class="max-w-3xl mx-auto">
                <div class="bg-white rounded-xl shadow-md p-8 text-center">
                    <p style="font-size:2.5rem;">⏳</p>
                    <h2 class="text-xl font-bold text-gray-800 mt-2">Not Yet Assigned to a Directorate</h2>
                    <p class="text-sm text-gray-500 mt-2">Welcome, ${esc(user ? user.name : '')}. Your account hasn't been assigned to a directorate yet — once the KPI Planner assigns you one, your KPI dashboard will appear here.</p>
                </div>
            </div>
        `;
        return;
    }

    const directorate = (this.state.kpiDirectorates || []).find(d => d.id === directorateId);
    const year = this.state._kpiDashboardYear || new Date().getFullYear();
    const yearOptions = [year - 1, year, year + 1].map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('');

    content.innerHTML = `
        <div class="max-w-6xl mx-auto">
            <div class="flex justify-between items-center flex-wrap gap-3 mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-gray-800">📈 ${esc(directorate ? directorate.name : 'KPI')} Dashboard</h2>
                    <p class="text-gray-500 text-sm mt-1">Welcome, ${esc(user.name)}.</p>
                </div>
                <select onchange="app.state._kpiDashboardYear = parseInt(this.value, 10); app.renderKpiDirectorView();"
                    style="padding:8px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;font-weight:600;">
                    ${yearOptions}
                </select>
            </div>
            ${this._buildKpiDashboardBody(directorateId, year)}
        </div>
    `;

    this._drawKpiDashboardCharts(directorateId, year);
};

