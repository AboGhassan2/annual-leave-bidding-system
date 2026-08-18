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
    const tab = this.state._kpiAdminTab || 'overview';
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
            style="flex:1;padding:6px 0;border-radius:7px;font-weight:700;font-size:0.78rem;border:none;background:${selectedCompany === name ? '#D4A017' : 'rgba(255,255,255,0.08)'};color:${selectedCompany === name ? '#1B4332' : 'rgba(255,255,255,0.7)'};cursor:pointer;">
            ${esc(name)}
        </button>
    `;

    // ── Sidebar nav — a vertical "metro line" rail with station dots,
    // matching the site's own dark-green/gold identity ──
    const navItem = (key, icon, label, count) => {
        const active = tab === key;
        return `
            <div onclick="app.state._kpiAdminTab='${key}';app.renderKpiPlannerView();"
                style="position:relative;display:flex;align-items:center;gap:12px;padding:10px 18px;cursor:pointer;color:${active ? '#fff' : 'rgba(255,255,255,0.65)'};background:${active ? 'rgba(255,255,255,0.06)' : 'transparent'};">
                <span style="width:11px;height:11px;border-radius:50%;flex-shrink:0;z-index:1;background:${active ? '#D4A017' : '#2D6A4F'};border:3px solid ${active ? '#D4A017' : 'rgba(255,255,255,0.28)'};box-shadow:${active ? '0 0 0 3px rgba(212,160,23,0.25)' : 'none'};"></span>
                <span style="font-size:0.92rem;">${icon}</span>
                <span style="font-size:0.85rem;font-weight:600;">${esc(label)}</span>
                ${count != null ? `<span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:rgba(255,255,255,0.4);">${count}</span>` : ''}
            </div>
        `;
    };

    // Counts for the two nav items the redesign shows a badge on.
    const navDirectorateCount = (this.state.kpiDirectorates || []).filter(d => (d.company || 'OMC') === selectedCompany).length;
    const navDirIds = new Set((this.state.kpiDirectorates || []).filter(d => (d.company || 'OMC') === selectedCompany).map(d => d.id));
    const navKpiCount = (this.state.kpiDefinitions || []).filter(k => k.is_active !== false && navDirIds.has(this._kpiEffectiveDirectorateId(k))).length;

    let sectionHtml = '';
    if (tab === 'overview') sectionHtml = this._renderKpiOverviewSection();
    else if (tab === 'directorates') sectionHtml = this._renderKpiDirectoratesSection();
    else if (tab === 'kpis') sectionHtml = this._renderKpiDefinitionsSection();
    else if (tab === 'results') sectionHtml = this._renderKpiResultsSection();
    else if (tab === 'kpiReporting') sectionHtml = this._renderKpiReportingSection();
    else if (tab === 'financialReporting') sectionHtml = this._renderKpiFinancialReportingSection();
    else if (tab === 'preview') sectionHtml = this._renderKpiPreviewSection();
    else if (tab === 'import') sectionHtml = this._renderKpiImportSection();
    else sectionHtml = this._renderKpiUsersSection();

    content.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:26px;width:100%;">
            <aside style="width:248px;flex-shrink:0;background:#1B4332;border-radius:14px;padding:24px 0;position:sticky;top:calc(var(--topbar-h, 0px) + 20px);display:flex;flex-direction:column;">
                <div style="padding:0 22px 22px 22px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:20px;">
                    <div style="color:#fff;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:1.5rem;letter-spacing:0.02em;">FLOW <span style="color:#D4A017;">◆</span> KPI</div>
                    <div style="font-size:0.72rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.08em;margin-top:2px;">Riyadh Metro Operator</div>
                </div>
                <div style="padding:0 22px 26px 22px;">
                    <div style="font-size:0.66rem;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Company</div>
                    <div style="display:flex;gap:6px;background:rgba(255,255,255,0.06);border-radius:8px;padding:3px;">
                        ${companyBtn('OMC')}
                        ${companyBtn('Audit')}
                    </div>
                </div>
                <nav style="position:relative;padding:4px 0;flex:1;">
                    <div style="position:absolute;left:23px;top:14px;bottom:14px;width:3px;background:rgba(255,255,255,0.12);border-radius:2px;"></div>
                    ${navItem('directorates', '🏛️', 'Directorates', navDirectorateCount)}
                    ${navItem('overview', '🏠', 'Overview')}
                    ${navItem('kpis', '📈', 'KPIs', navKpiCount)}
                    ${navItem('results', '✏️', 'Enter Results')}
                    ${navItem('kpiReporting', '📊', 'KPI Reporting')}
                    ${navItem('financialReporting', '💰', 'Financial Reporting')}
                    ${navItem('preview', '👁️', 'Preview Dashboard')}
                    ${navItem('import', '📥', 'Import from Excel')}
                    ${navItem('users', '👥', 'Manage Users')}
                </nav>
                <div style="padding:16px 22px 4px 22px;border-top:1px solid rgba(255,255,255,0.08);margin-top:12px;display:flex;align-items:center;gap:10px;">
                    <div style="width:30px;height:30px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg, #7C3AED, #2D6A4F);"></div>
                    <div>
                        <div style="font-size:0.8rem;font-weight:600;color:#fff;">KPI Planner</div>
                        <div style="font-size:0.68rem;color:rgba(255,255,255,0.45);">Full Access · Admin</div>
                    </div>
                </div>
            </aside>
            <main style="flex:1;min-width:0;">
                ${sectionHtml}
            </main>
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
// ════════════════════════════════════════════════════════════════════
// Overview — landing page for the KPI Planner, per the redesign concept.
// Real computed figures (not mockup placeholders): KPI/directorate
// counts, average Final KPI across entered results, a benchmark
// (Exceptional/Acceptable/Unacceptable) breakdown bar, monthly KPIs
// still awaiting this month's entry, a preview of the first 3
// directorates, and a quick-actions grid linking to every other tab.
// ════════════════════════════════════════════════════════════════════
app._renderKpiOverviewSection = function() {
    const esc = this._escHtml.bind(this);
    const selectedCompany = this.state._kpiSelectedCompany || 'OMC';
    const directorates = (this.state.kpiDirectorates || []).filter(d => (d.company || 'OMC') === selectedCompany);
    const dirIds = new Set(directorates.map(d => d.id));
    const definitions = (this.state.kpiDefinitions || []).filter(k => k.is_active !== false && dirIds.has(this._kpiEffectiveDirectorateId(k)));
    const results = (this.state.kpiResults || []).filter(r => definitions.some(k => k.id === r.kpi_definition_id));

    const totalKpis = definitions.length;
    const totalDirectorates = directorates.length;

    const finalKpiValues = results.map(r => r.final_kpi).filter(v => v != null).map(Number);
    const avgFinalKpi = finalKpiValues.length > 0 ? finalKpiValues.reduce((a, b) => a + b, 0) / finalKpiValues.length : null;

    // Benchmark breakdown across each KPI's most recent result, for the stacked bar.
    let excCount = 0, accCount = 0, unaccCount = 0;
    definitions.forEach(k => {
        const kResults = results.filter(r => r.kpi_definition_id === k.id).sort((a, b) => (b.entered_at || '').localeCompare(a.entered_at || ''));
        if (kResults.length === 0) return;
        const label = this._kpiResultBenchmark(kResults[0], k);
        if (label === 'Exceptional') excCount++;
        else if (label === 'Acceptable') accCount++;
        else if (label === 'Unacceptable') unaccCount++;
    });
    const gradedTotal = excCount + accCount + unaccCount;
    const excPct = gradedTotal ? (excCount / gradedTotal * 100) : 0;
    const accPct = gradedTotal ? (accCount / gradedTotal * 100) : 0;
    const unaccPct = gradedTotal ? (unaccCount / gradedTotal * 100) : 0;

    // Monthly KPIs with no result entered for the current calendar month yet.
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const awaitingCount = definitions.filter(k => k.period_type === 'monthly').filter(k =>
        !results.some(r => r.kpi_definition_id === k.id && r.year === curYear && r.period_value === curMonth)
    ).length;

    const lineColors = { L3: '#7C3AED', L4: '#0891B2', L5: '#2D6A4F', L6: '#DC2626' };
    const allLineBadges = ['L3', 'L4', 'L5', 'L6'].map(l =>
        `<span style="font-family:'JetBrains Mono',monospace;font-size:0.68rem;font-weight:600;color:#fff;padding:3px 8px;border-radius:5px;background:${lineColors[l]};">${l}</span>`
    ).join('');

    // Areas — a DIFFERENT concept from Directorates: Area lives on each
    // KPI (k.area/k.area_pct, from the Weight Hierarchy import) and
    // doesn't map 1:1 to a Directorate record. Grouped here directly
    // from the KPIs that have an area set, per explicit request to show
    // the real Operations/Transit System Maintenance/Facilities
    // Maintenance/Management breakdown (not whichever Directorates
    // happen to have the most KPIs). Every card shows all 4 lines,
    // regardless of which lines that area's own KPIs actually sit on —
    // also per explicit request, not a bug.
    const areaGroups = {};
    definitions.forEach(k => {
        if (!k.area) return;
        if (!areaGroups[k.area]) areaGroups[k.area] = { name: k.area, pct: k.area_pct, count: 0 };
        areaGroups[k.area].count++;
        if (areaGroups[k.area].pct == null && k.area_pct != null) areaGroups[k.area].pct = k.area_pct;
    });
    const areaList = Object.values(areaGroups).sort((a, b) => (b.pct || 0) - (a.pct || 0));

    const dirPreview = areaList.map(a => `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;">
            <p style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.1rem;color:#1B4332;">${esc(a.name)}</p>
            <p style="font-size:0.76rem;color:#6b7280;margin:4px 0 12px 0;">Area · ${a.pct != null ? (a.pct * 100).toFixed(0) : '—'}% of company score</p>
            <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">${allLineBadges}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.78rem;">
                <span style="color:#6b7280;">${a.count} KPI${a.count !== 1 ? 's' : ''}</span>
                <span style="font-family:'JetBrains Mono',monospace;font-weight:600;color:#1B4332;">${a.pct != null ? (a.pct * 100).toFixed(1) : '0.0'}% weight</span>
            </div>
        </div>
    `).join('');

    const quickAction = (tabKey, icon, title, desc) => `
        <div onclick="app.state._kpiAdminTab='${tabKey}';app.renderKpiPlannerView();"
            style="background:#1B4332;color:#fff;border-radius:12px;padding:18px 16px;cursor:pointer;display:flex;flex-direction:column;gap:10px;">
            <div style="font-size:1.4rem;">${icon}</div>
            <div>
                <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:0.95rem;">${esc(title)}</div>
                <div style="font-size:0.7rem;color:rgba(255,255,255,0.55);margin-top:2px;">${esc(desc)}</div>
            </div>
        </div>
    `;

    return `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
            <div>
                <h1 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.7rem;color:#14251C;">Overview</h1>
                <p style="font-size:0.8rem;color:#6b7280;margin-top:2px;">${esc(selectedCompany)} · Company-wide, all directorates · ${curYear}</p>
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="app.state._kpiAdminTab='import';app.renderKpiPlannerView();" style="padding:9px 18px;background:#fff;border:1.5px solid #e5e7eb;color:#1B4332;border-radius:8px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:0.85rem;letter-spacing:0.04em;">📥 Import</button>
                <button onclick="app.state._kpiAdminTab='kpis';app.renderKpiPlannerView();" style="padding:9px 18px;background:linear-gradient(135deg, #8b6914 0%, #b8860b 50%, #d4a017 100%);color:#fff;border:none;border-radius:8px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:0.85rem;letter-spacing:0.04em;">+ Add KPI</button>
            </div>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;">
                <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">Total KPIs</p>
                <p style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:2rem;color:#14251C;margin-top:2px;">${totalKpis}</p>
                ${gradedTotal > 0 ? `
                    <div style="display:flex;height:6px;border-radius:4px;overflow:hidden;margin-top:12px;">
                        <span style="width:${excPct}%;background:#2D6A4F;"></span>
                        <span style="width:${accPct}%;background:#1D4ED8;"></span>
                        <span style="width:${unaccPct}%;background:#DC2626;"></span>
                    </div>
                ` : ''}
            </div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;">
                <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">Directorates</p>
                <p style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:2rem;color:#14251C;margin-top:2px;">${totalDirectorates}</p>
                <p style="font-size:0.72rem;color:#9ca3af;margin-top:8px;">${areaList.length} Area${areaList.length !== 1 ? 's' : ''} · 4 Lines each</p>
            </div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;">
                <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">Avg Final KPI</p>
                <p style="font-family:'JetBrains Mono',monospace;font-weight:700;font-size:2rem;color:#14251C;margin-top:2px;">${avgFinalKpi != null ? avgFinalKpi.toFixed(2) : '—'}</p>
                <p style="font-size:0.72rem;color:#9ca3af;margin-top:8px;">of 2.00 max, all entered results</p>
            </div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;">
                <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">Awaiting Entry</p>
                <p style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:2rem;color:${awaitingCount > 0 ? '#DC2626' : '#14251C'};margin-top:2px;">${awaitingCount}</p>
                <p style="font-size:0.72rem;color:#9ca3af;margin-top:8px;">monthly KPIs, this month</p>
            </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px;">
            <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.25rem;color:#14251C;">Directorates</h2>
            <span onclick="app.state._kpiAdminTab='directorates';app.renderKpiPlannerView();" style="font-size:0.8rem;color:#B8860B;font-weight:600;cursor:pointer;">View all →</span>
        </div>
        ${areaList.length === 0 ? `<p style="font-size:0.85rem;color:#9ca3af;margin-bottom:28px;">No Area data yet for ${esc(selectedCompany)} — run the Weight Hierarchy import (Import from Excel tab) to populate Area/Level percentages.</p>` : `
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-7">${dirPreview}</div>
        `}

        <h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.25rem;color:#14251C;margin-bottom:14px;">Quick actions</h2>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            ${quickAction('directorates', '🏛️', 'Directorates', 'Manage areas & lines')}
            ${quickAction('kpis', '📈', 'KPIs', 'Definitions & weights')}
            ${quickAction('results', '✏️', 'Enter Results', 'Record this period')}
            ${quickAction('kpiReporting', '📊', 'KPI Reporting', 'Scorecards & trends')}
            ${quickAction('financialReporting', '💰', 'Financial Reporting', 'Fee periods & partner shares')}
            ${quickAction('preview', '👁️', 'Preview', 'Director dashboard')}
            ${quickAction('import', '📥', 'Import', 'From Excel')}
            ${quickAction('users', '👥', 'Users', 'Directors & access')}
        </div>
    `;
};

// ════════════════════════════════════════════════════════════════════
// KPI Reporting — a company-wide scorecard: every KPI (optionally
// filtered to one directorate) with its most recent result, Factor
// Score, Final KPI, and Benchmark status in one table. Distinct from the
// KPIs tab (definitions/editing) and Preview Dashboard (one directorate
// at a time, charts) — this is a flat, scannable report across
// everything at once.
// ════════════════════════════════════════════════════════════════════
app._renderKpiReportingSection = function() {
    const esc = this._escHtml.bind(this);
    const selectedCompany = this.state._kpiSelectedCompany || 'OMC';
    const directorates = (this.state.kpiDirectorates || []).filter(d => (d.company || 'OMC') === selectedCompany);
    const dirIds = new Set(directorates.map(d => d.id));
    const allDefinitions = (this.state.kpiDefinitions || []).filter(k => k.is_active !== false && dirIds.has(this._kpiEffectiveDirectorateId(k)));

    // Membership by OWNERSHIP SHARE, not just home directorate — same
    // fix already applied to the KPIs tab (a KPI defined under Operations
    // but partly owned by Finance should still show up when filtering to
    // Finance). This section is purely a read-only report, so there's no
    // "which directorate can enter this KPI's result" concern to protect
    // against, unlike Enter Results.
    const filterDirectorateId = this.state._kpiReportingFilterDirectorateId || '';
    const filterDirectorateIdNum = filterDirectorateId ? parseInt(filterDirectorateId, 10) : null;
    const filterCode = (this.state._kpiReportingFilterCode || '').trim().toUpperCase();
    const filterLine = this.state._kpiReportingFilterLine || '';
    const filterPeriodType = this.state._kpiReportingFilterPeriodType || '';

    let definitions = filterDirectorateIdNum
        ? allDefinitions.filter(k => this._kpiOwnershipWeight(k, filterDirectorateIdNum) > 0)
        : allDefinitions;
    if (filterCode) definitions = definitions.filter(k => (k.kpi_code || '').toUpperCase().includes(filterCode));
    if (filterPeriodType) definitions = definitions.filter(k => k.period_type === filterPeriodType);
    if (filterLine) {
        definitions = definitions.filter(k => {
            const line = (this.state.kpiDirectorateDepartments || []).find(l => l.id === k.department_id);
            return line && line.department_name === filterLine;
        });
    }

    // Month Number (Excel) filter — M1-M121, built directly from the
    // imported fee calendar, same convention used on Enter Results/KPI
    // Detail elsewhere. Only affects Monthly KPIs (a specific calendar
    // month has no meaning for a Quarterly/Yearly KPI's own result) —
    // those still show their latest result regardless.
    const feePeriods = [...(this.state.kpiFeePeriods || [])].sort((a, b) => a.kpi_month_no - b.kpi_month_no);
    const filterMonthNo = this.state._kpiReportingFilterMonthNo != null ? Number(this.state._kpiReportingFilterMonthNo) : null;
    const filterFeePeriod = filterMonthNo != null ? feePeriods.find(p => p.kpi_month_no === filterMonthNo) : null;

    const distinctLines = [...new Set(allDefinitions.map(k => {
        const line = (this.state.kpiDirectorateDepartments || []).find(l => l.id === k.department_id);
        return line ? line.department_name : null;
    }).filter(Boolean))].sort();

    const rows = definitions.map(k => {
        const dir = directorates.find(d => d.id === this._kpiEffectiveDirectorateId(k));
        const viewWeight = filterDirectorateIdNum ? this._kpiOwnershipWeight(k, filterDirectorateIdNum) : 1;
        const isSharedView = viewWeight > 0 && viewWeight < 1;
        const line = (this.state.kpiDirectorateDepartments || []).find(l => l.id === k.department_id);

        let displayResult = null;
        if (k.period_type === 'monthly' && filterFeePeriod) {
            const calMonthStr = String(filterFeePeriod.kpi_cal_month).padStart(2, '0');
            displayResult = (this.state.kpiResults || []).find(r => r.kpi_definition_id === k.id && Number(r.year) === filterFeePeriod.kpi_year && r.period_value === calMonthStr) || null;
        } else {
            displayResult = (this.state.kpiResults || [])
                .filter(r => r.kpi_definition_id === k.id)
                .sort((a, b) => (b.entered_at || '').localeCompare(a.entered_at || ''))[0] || null;
        }

        const benchmark = displayResult ? this._kpiResultBenchmark(displayResult, k) : null;
        const benchmarkBadge = {
            Exceptional: ['Exceptional', '#d1fae5', '#065f46'],
            Acceptable: ['Acceptable', '#dbeafe', '#1e40af'],
            Unacceptable: ['Unacceptable', '#fee2e2', '#991b1b'],
        }[benchmark] || ['—', '#f3f4f6', '#6b7280'];
        return `
            <tr style="border-top:1px solid #f3f4f6;">
                <td style="padding:8px 12px;font-weight:600;">${k.kpi_code ? `<span style="font-family:'JetBrains Mono',monospace;color:#B8860B;">${esc(k.kpi_code)}</span>: ` : ''}${esc(k.name)}${isSharedView ? ` <span style="color:#7c3aed;font-size:0.7rem;font-weight:700;">🤝 ${Math.round(viewWeight * 100)}% share</span>` : ''}</td>
                <td style="padding:8px 12px;">${dir ? esc(dir.name) : '—'}${isSharedView ? ' (home)' : ''}</td>
                <td style="padding:8px 12px;">${line ? esc(line.department_name) : '—'}</td>
                <td style="padding:8px 12px;">${{ monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' }[k.period_type] || k.period_type}</td>
                <td style="padding:8px 12px;">${displayResult ? esc(displayResult.period_label) : '—'}</td>
                <td style="padding:8px 12px;text-align:right;">${displayResult ? esc(String(displayResult.actual_value)) : '—'}</td>
                <td style="padding:8px 12px;text-align:right;color:#6b7280;">${displayResult && displayResult.factor_score != null ? Number(displayResult.factor_score).toFixed(2) : '—'}</td>
                <td style="padding:8px 12px;text-align:right;font-weight:600;">${displayResult && displayResult.final_kpi != null ? Number(displayResult.final_kpi).toFixed(2) : '—'}</td>
                <td style="padding:8px 12px;"><span style="background:${benchmarkBadge[1]};color:${benchmarkBadge[2]};padding:2px 10px;border-radius:999px;font-size:0.72rem;font-weight:700;">${benchmarkBadge[0]}</span></td>
                <td style="padding:8px 12px;font-size:0.78rem;color:#6b7280;max-width:180px;">${displayResult && displayResult.remarks ? esc(displayResult.remarks) : '—'}</td>
            </tr>
        `;
    }).join('');

    return `
        <h1 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.7rem;color:#14251C;margin-bottom:2px;">KPI Reporting</h1>
        <p style="font-size:0.8rem;color:#6b7280;margin-bottom:20px;">${esc(selectedCompany)} · Every KPI's most recent recorded result</p>

        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px;margin-bottom:18px;">
            <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end;">
                <div>
                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Directorate</label>
                    <select onchange="app.state._kpiReportingFilterDirectorateId = this.value; app.renderKpiPlannerView();"
                        style="padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;min-width:180px;">
                        <option value="">All directorates</option>
                        ${directorates.map(d => `<option value="${d.id}" ${String(d.id) === String(filterDirectorateId) ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Code</label>
                    <input type="text" value="${esc(this.state._kpiReportingFilterCode || '')}" placeholder="e.g. A1"
                        onchange="app.state._kpiReportingFilterCode = this.value; app.renderKpiPlannerView();"
                        style="padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;width:90px;box-sizing:border-box;" />
                </div>
                <div>
                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Line</label>
                    <select onchange="app.state._kpiReportingFilterLine = this.value; app.renderKpiPlannerView();"
                        style="padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;">
                        <option value="">All Lines</option>
                        ${distinctLines.map(l => `<option value="${esc(l)}" ${filterLine === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">KPI Period</label>
                    <select onchange="app.state._kpiReportingFilterPeriodType = this.value; app.renderKpiPlannerView();"
                        style="padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;">
                        <option value="">All</option>
                        <option value="monthly" ${filterPeriodType === 'monthly' ? 'selected' : ''}>Monthly</option>
                        <option value="quarterly" ${filterPeriodType === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                        <option value="yearly" ${filterPeriodType === 'yearly' ? 'selected' : ''}>Yearly</option>
                    </select>
                </div>
                ${feePeriods.length > 0 ? `
                <div>
                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Month Number (Excel)</label>
                    <select onchange="app.state._kpiReportingFilterMonthNo = this.value ? parseInt(this.value, 10) : null; app.renderKpiPlannerView();"
                        style="padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;min-width:170px;">
                        <option value="">Latest result</option>
                        ${feePeriods.map(p => `<option value="${p.kpi_month_no}" ${filterMonthNo === p.kpi_month_no ? 'selected' : ''}>${esc(p.kpi_fiscal_month)}${p.kpi_month_name ? ' — ' + esc(p.kpi_month_name) + ' ' + esc(String(p.kpi_year)) : ''}</option>`).join('')}
                    </select>
                </div>
                ` : ''}
            </div>
        </div>

        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            ${definitions.length === 0 ? '<p style="padding:30px;text-align:center;color:#9ca3af;font-size:0.85rem;">No KPIs match this filter.</p>' : `
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                        <thead>
                            <tr style="text-align:left;color:#6b7280;font-size:0.7rem;text-transform:uppercase;background:#f9fafb;">
                                <th style="padding:8px 12px;">KPI</th>
                                <th style="padding:8px 12px;">Directorate</th>
                                <th style="padding:8px 12px;">Line</th>
                                <th style="padding:8px 12px;">Frequency</th>
                                <th style="padding:8px 12px;">Period</th>
                                <th style="padding:8px 12px;text-align:right;">Result</th>
                                <th style="padding:8px 12px;text-align:right;">Factor</th>
                                <th style="padding:8px 12px;text-align:right;">Final KPI</th>
                                <th style="padding:8px 12px;">Benchmark</th>
                                <th style="padding:8px 12px;">Remarks</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `}
        </div>
    `;
};

// ════════════════════════════════════════════════════════════════════
// Financial Reporting — the current period's fee calendar position and
// company-wide partner (HIT/FS/ALS) allocation totals, built on the
// Financial Calendar & Partner Allocation data imported earlier.
// ════════════════════════════════════════════════════════════════════
app._renderKpiFinancialReportingSection = function() {
    const esc = this._escHtml.bind(this);
    const selectedCompany = this.state._kpiSelectedCompany || 'OMC';
    const directorates = (this.state.kpiDirectorates || []).filter(d => (d.company || 'OMC') === selectedCompany);
    const dirIds = new Set(directorates.map(d => d.id));
    const definitions = (this.state.kpiDefinitions || []).filter(k => k.is_active !== false && dirIds.has(this._kpiEffectiveDirectorateId(k)));

    const now = new Date();
    const feePeriod = this._kpiFeePeriodForCalendarDate(now.getFullYear(), now.getMonth() + 1);

    const lineStatuses = ['L3', 'L4', 'L5', 'L6'].map(line => ({
        line,
        status: feePeriod ? this._kpiLineFeeStatus(line, feePeriod.kpi_month_no) : null,
    }));

    let totalHit = 0, totalFs = 0, totalAls = 0;
    definitions.forEach(k => {
        const shares = this._kpiAllocationSharesFromFinalWeight(k);
        if (shares.hit != null) totalHit += shares.hit;
        if (shares.fs != null) totalFs += shares.fs;
        if (shares.als != null) totalAls += shares.als;
    });

    return `
        <h1 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.7rem;color:#14251C;margin-bottom:2px;">Financial Reporting</h1>
        <p style="font-size:0.8rem;color:#6b7280;margin-bottom:20px;">${esc(selectedCompany)} · Fee periods &amp; partner allocation</p>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">
                <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;margin-bottom:10px;">Current Fee Period</p>
                ${feePeriod ? `
                    <p style="font-family:'JetBrains Mono',monospace;font-weight:700;font-size:1.3rem;color:#14251C;">${esc(feePeriod.kpi_fiscal_month)} → ${esc(feePeriod.fee_fiscal_month)}</p>
                    <p style="font-size:0.78rem;color:#6b7280;margin-top:6px;">KPI Month ${esc(feePeriod.kpi_fiscal_month)} (${esc(feePeriod.kpi_month_name || '')} ${esc(String(feePeriod.kpi_year || ''))}) bills against Fixed Fee Month ${esc(feePeriod.fee_fiscal_month)}</p>
                    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
                        ${lineStatuses.map(l => `
                            <span style="font-size:0.72rem;font-weight:700;padding:4px 10px;border-radius:999px;background:${l.status === 'Active' ? '#eaf5ef' : l.status === 'Pre-project' ? '#fffbeb' : '#f3f4f6'};color:${l.status === 'Active' ? '#2D6A4F' : l.status === 'Pre-project' ? '#92400e' : '#9ca3af'};">
                                ${esc(l.line)}: ${esc(l.status || 'No data')}
                            </span>
                        `).join('')}
                    </div>
                ` : `<p style="font-size:0.85rem;color:#9ca3af;">No fee period calendar imported yet for the current month — run the Financial Calendar import (Import from Excel tab).</p>`}
            </div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">
                <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;margin-bottom:10px;">Company-Wide Partner Allocation</p>
                <p style="font-size:0.75rem;color:#9ca3af;margin-bottom:14px;">Sum of each KPI's Final Weight × partner share — the static, design-time split, not tied to any one period's results.</p>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:0.85rem;font-weight:600;">HIT</span>
                        <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#7C3AED;">${(totalHit * 100).toFixed(2)}%</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:0.85rem;font-weight:600;">FS</span>
                        <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#0891B2;">${(totalFs * 100).toFixed(2)}%</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:0.85rem;font-weight:600;">ALS</span>
                        <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#2D6A4F;">${(totalAls * 100).toFixed(2)}%</span>
                    </div>
                </div>
            </div>
        </div>

        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:6px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:4px;">
                <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">MGT Ratio Per Line — Company-Wide</p>
                ${(() => {
                    // Independent of the "Current Fee Period" card above
                    // — that one is deliberately pinned to today's real
                    // calendar date, but this table is something the
                    // user browses across months (or an annual sum), and
                    // today's still-in-progress month usually has no
                    // results entered yet.
                    const mgtFeePeriods = [...(this.state.kpiFeePeriods || [])].sort((a, b) => a.kpi_month_no - b.kpi_month_no);
                    if (mgtFeePeriods.length === 0) return '';
                    const mode = this.state._kpiFinReportMgtMode === 'year' ? 'year' : 'month';
                    const rawSelected = this.state._kpiFinReportMgtSelectedMonthNo;
                    const selectedMonthNo = rawSelected != null ? Number(rawSelected) : this._kpiLatestMonthWithMgtData(mgtFeePeriods, null);
                    const yearOptions = [...new Set(mgtFeePeriods.map(p => p.kpi_year))].sort((a, b) => a - b);
                    const rawYear = this.state._kpiFinReportMgtSelectedYear;
                    const selectedYear = rawYear != null ? Number(rawYear) : (yearOptions.length > 0 ? yearOptions[yearOptions.length - 1] : new Date().getFullYear());
                    return `
                        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                            <div style="display:flex;border:1.5px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                                <button onclick="app.state._kpiFinReportMgtMode='month';app.renderKpiPlannerView();" style="padding:6px 12px;border:none;font-size:0.78rem;font-weight:700;cursor:pointer;background:${mode === 'month' ? '#1B4332' : '#fff'};color:${mode === 'month' ? '#fff' : '#374151'};">Month</button>
                                <button onclick="app.state._kpiFinReportMgtMode='year';app.renderKpiPlannerView();" style="padding:6px 12px;border:none;font-size:0.78rem;font-weight:700;cursor:pointer;background:${mode === 'year' ? '#1B4332' : '#fff'};color:${mode === 'year' ? '#fff' : '#374151'};">Year (Sum)</button>
                            </div>
                            ${mode === 'month' ? `
                                <select onchange="app.state._kpiFinReportMgtSelectedMonthNo=parseInt(this.value,10);app.renderKpiPlannerView();" style="padding:6px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.8rem;">
                                    ${mgtFeePeriods.map(p => `<option value="${p.kpi_month_no}" ${selectedMonthNo === p.kpi_month_no ? 'selected' : ''}>${esc(p.kpi_fiscal_month)}${p.kpi_month_name ? ' — ' + esc(p.kpi_month_name) + ' ' + esc(String(p.kpi_year)) : ''}</option>`).join('')}
                                </select>
                            ` : `
                                <select onchange="app.state._kpiFinReportMgtSelectedYear=parseInt(this.value,10);app.renderKpiPlannerView();" style="padding:6px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.8rem;">
                                    ${yearOptions.map(y => `<option value="${y}" ${selectedYear === y ? 'selected' : ''}>${y}</option>`).join('')}
                                </select>
                            `}
                        </div>
                    `;
                })()}
            </div>
            ${(() => {
                const mgtFeePeriods = [...(this.state.kpiFeePeriods || [])].sort((a, b) => a.kpi_month_no - b.kpi_month_no);
                if (mgtFeePeriods.length === 0) {
                    return `<p style="font-size:0.85rem;color:#9ca3af;">No fee period calendar imported yet — run the Financial Calendar import (Import from Excel tab).</p>`;
                }
                const mode = this.state._kpiFinReportMgtMode === 'year' ? 'year' : 'month';

                if (mode === 'year') {
                    const yearOptions = [...new Set(mgtFeePeriods.map(p => p.kpi_year))].sort((a, b) => a - b);
                    const rawYear = this.state._kpiFinReportMgtSelectedYear;
                    const selectedYear = rawYear != null ? Number(rawYear) : (yearOptions.length > 0 ? yearOptions[yearOptions.length - 1] : new Date().getFullYear());
                    const annual = this._kpiMgtRatioPerLineAnnual(selectedYear, null);
                    if (annual.monthsInYearCount === 0) {
                        return `<p style="font-size:0.85rem;color:#9ca3af;">No Financial Calendar imported yet for ${esc(String(selectedYear))}.</p>`;
                    }
                    return `
                        <p style="font-size:0.75rem;color:#9ca3af;margin-bottom:14px;">Sum of each month's Weighted Contribution across all ${annual.monthsInYearCount} KPI Month(s) configured in ${esc(String(selectedYear))} — not an average, and across every ${esc(selectedCompany)} directorate.</p>
                        <div style="overflow-x:auto;">
                            <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                                <thead>
                                    <tr style="text-align:left;color:#6b7280;font-size:0.7rem;text-transform:uppercase;background:#f9fafb;">
                                        <th style="padding:8px 12px;">Line</th>
                                        <th style="padding:8px 12px;text-align:right;">Months Counted</th>
                                        <th style="padding:8px 12px;text-align:right;">Weighted (Sum)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${annual.rows.map(r => `
                                        <tr style="border-top:1px solid #f3f4f6;">
                                            <td style="padding:8px 12px;font-weight:700;">${esc(r.line)}</td>
                                            <td style="padding:8px 12px;text-align:right;">${r.monthsCounted} / ${annual.monthsInYearCount}</td>
                                            <td style="padding:8px 12px;text-align:right;font-weight:700;color:#1B4332;">${(r.sumWeighted * 100).toFixed(4)}%</td>
                                        </tr>
                                    `).join('')}
                                    <tr style="border-top:2px solid #e5e7eb;">
                                        <td colspan="2" style="padding:10px 12px;font-weight:700;text-align:right;">Total</td>
                                        <td style="padding:10px 12px;text-align:right;font-weight:800;font-family:'JetBrains Mono',monospace;color:#B8860B;">${(annual.total * 100).toFixed(4)}%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    `;
                }

                const rawSelected = this.state._kpiFinReportMgtSelectedMonthNo;
                const mgtSelectedMonthNo = rawSelected != null ? Number(rawSelected) : this._kpiLatestMonthWithMgtData(mgtFeePeriods, null);
                const mgtSelectedPeriod = mgtFeePeriods.find(p => p.kpi_month_no === mgtSelectedMonthNo);
                const mgtTable = this._kpiMgtRatioPerLine(mgtSelectedMonthNo, null);
                // Cost per Mgmt / Cost per Line / Total Cost — the M%
                // sheet's own L/M/N columns, per line, for this same
                // month. Uses the same _kpiLineCostPool the Cost Inputs
                // panel and Cost/Penalty Allocation already rely on, so
                // this is exactly the imported-or-manual figure, never a
                // separate calculation.
                const costRows = mgtTable.rows.map(r => this._kpiLineCostPool(r.line, mgtSelectedMonthNo, selectedCompany));
                const fmtCost = (v) => v != null ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';
                const costTotal = (key) => costRows.reduce((sum, c) => sum + (c && c[key] != null ? c[key] : 0), 0);
                const anyCostData = costRows.some(c => c != null);
                return `
                    <p style="font-size:0.75rem;color:#9ca3af;margin-bottom:14px;">KPI Month ${esc(mgtSelectedPeriod ? mgtSelectedPeriod.kpi_fiscal_month : String(mgtSelectedMonthNo))} — every ${esc(selectedCompany)} directorate's KPIs on each line, weighted by station count</p>
                    <div style="overflow-x:auto;">
                        <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                            <thead>
                                <tr style="text-align:left;color:#6b7280;font-size:0.7rem;text-transform:uppercase;background:#f9fafb;">
                                    <th style="padding:8px 12px;">Line</th>
                                    <th style="padding:8px 12px;text-align:right;">Stations</th>
                                    <th style="padding:8px 12px;text-align:right;">Ratio</th>
                                    <th style="padding:8px 12px;text-align:right;">KPIFt</th>
                                    <th style="padding:8px 12px;text-align:right;">M%erc</th>
                                    <th style="padding:8px 12px;text-align:right;">M%erct-avgte</th>
                                    <th style="padding:8px 12px;text-align:right;">Cost per Mgmt</th>
                                    <th style="padding:8px 12px;text-align:right;">Cost per Line</th>
                                    <th style="padding:8px 12px;text-align:right;">Total Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${mgtTable.rows.map((r, i) => {
                                    const cost = costRows[i];
                                    return `
                                    <tr style="border-top:1px solid #f3f4f6;">
                                        <td style="padding:8px 12px;font-weight:700;">${esc(r.line)}</td>
                                        <td style="padding:8px 12px;text-align:right;">${r.stations != null ? r.stations : '—'}</td>
                                        <td style="padding:8px 12px;text-align:right;">${r.ratio != null ? (r.ratio * 100).toFixed(1) + '%' : '—'}</td>
                                        <td style="padding:8px 12px;text-align:right;font-family:'JetBrains Mono',monospace;">${r.kpiFt != null ? r.kpiFt.toFixed(4) : '—'}</td>
                                        <td style="padding:8px 12px;text-align:right;">${r.mPerc != null ? (r.mPerc * 100).toFixed(3) + '%' : '—'}</td>
                                        <td style="padding:8px 12px;text-align:right;font-weight:700;color:#1B4332;">${r.weighted != null ? (r.weighted * 100).toFixed(3) + '%' : '—'}</td>
                                        <td style="padding:8px 12px;text-align:right;">${cost ? fmtCost(cost.managementAllocation) : '—'}</td>
                                        <td style="padding:8px 12px;text-align:right;">${cost ? fmtCost(cost.lineCost) : '—'}</td>
                                        <td style="padding:8px 12px;text-align:right;font-weight:700;">${cost ? fmtCost(cost.totalPool) : '—'}</td>
                                    </tr>
                                `;
                                }).join('')}
                                <tr style="border-top:2px solid #e5e7eb;">
                                    <td colspan="5" style="padding:10px 12px;font-weight:700;text-align:right;">Total</td>
                                    <td style="padding:10px 12px;text-align:right;font-weight:800;font-family:'JetBrains Mono',monospace;color:#B8860B;">${(mgtTable.total * 100).toFixed(4)}%</td>
                                    <td style="padding:10px 12px;text-align:right;font-weight:700;">${anyCostData ? fmtCost(costTotal('managementAllocation')) : '—'}</td>
                                    <td style="padding:10px 12px;text-align:right;font-weight:700;">${anyCostData ? fmtCost(costTotal('lineCost')) : '—'}</td>
                                    <td style="padding:10px 12px;text-align:right;font-weight:800;">${anyCostData ? fmtCost(costTotal('totalPool')) : '—'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    ${mgtTable.rows.every(r => r.stations == null) ? `<p style="font-size:0.72rem;color:#92400e;margin-top:10px;">⚠️ No station counts imported for ${esc(mgtSelectedPeriod ? mgtSelectedPeriod.kpi_fiscal_month : '')} — run the Stations import.</p>` : ''}
                    ${mgtTable.rows.every(r => r.kpiFt == null) ? `<p style="font-size:0.72rem;color:#92400e;margin-top:4px;">⚠️ No KPI results recorded yet for this month — enter results for the corresponding calendar month to populate KPIFt.</p>` : ''}
                    ${!anyCostData ? `<p style="font-size:0.72rem;color:#92400e;margin-top:4px;">⚠️ No Cost Pool data (M%) or manual cost inputs for this month — run the M% import or the Cost Inputs panel on Enter Results.</p>` : ''}
                `;
            })()}
        </div>

        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:6px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:4px;">
                <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">Availability Factor — All Lines</p>
                ${(() => {
                    const availFeePeriods = [...(this.state.kpiFeePeriods || [])].sort((a, b) => a.kpi_month_no - b.kpi_month_no);
                    if (availFeePeriods.length === 0) return '';
                    const selected = this.state._kpiFinReportAvailSelectedMonthNo != null ? Number(this.state._kpiFinReportAvailSelectedMonthNo) : this._kpiLatestMonthWithAvailabilityData(availFeePeriods);
                    return `
                        <select onchange="app.state._kpiFinReportAvailSelectedMonthNo=parseInt(this.value,10);app.renderKpiPlannerView();" style="padding:6px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.8rem;">
                            ${availFeePeriods.map(p => `<option value="${p.kpi_month_no}" ${selected === p.kpi_month_no ? 'selected' : ''}>${esc(p.kpi_fiscal_month)}${p.kpi_month_name ? ' — ' + esc(p.kpi_month_name) + ' ' + esc(String(p.kpi_year)) : ''}</option>`).join('')}
                        </select>
                    `;
                })()}
            </div>
            ${(() => {
                const availFeePeriods = [...(this.state.kpiFeePeriods || [])].sort((a, b) => a.kpi_month_no - b.kpi_month_no);
                if (availFeePeriods.length === 0) return `<p style="font-size:0.85rem;color:#9ca3af;">No fee period calendar imported yet — run the Financial Calendar import (Import from Excel tab).</p>`;
                const availMonthNo = this.state._kpiFinReportAvailSelectedMonthNo != null ? Number(this.state._kpiFinReportAvailSelectedMonthNo) : this._kpiLatestMonthWithAvailabilityData(availFeePeriods);
                const rows = ['L3', 'L4', 'L5', 'L6'].flatMap(l => this._kpiLineAvailabilityForMonth(l, availMonthNo));
                if (rows.length === 0) return `<p style="font-size:0.85rem;color:#9ca3af;">No Availability Factor data imported yet for this month.</p>`;
                return `
                    <div style="overflow-x:auto;margin-top:10px;">
                        <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                            <thead>
                                <tr style="text-align:left;color:#6b7280;font-size:0.7rem;text-transform:uppercase;background:#f9fafb;">
                                    <th style="padding:8px 12px;">Line</th>
                                    <th style="padding:8px 12px;">Metric</th>
                                    <th style="padding:8px 12px;text-align:right;">Raw</th>
                                    <th style="padding:8px 12px;text-align:right;">Adjusted</th>
                                    <th style="padding:8px 12px;text-align:right;">KPIF</th>
                                    <th style="padding:8px 12px;text-align:right;">KPI Cost</th>
                                    <th style="padding:8px 12px;">Remark</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.map(r => {
                                    const kpif = this._kpiAvailabilityMetricFactorScore(r.metric, r.line, availMonthNo, selectedCompany);
                                    const kpiCost = this._kpiAvailabilityMetricCost(r.metric, r.line, availMonthNo, selectedCompany);
                                    return `
                                    <tr style="border-top:1px solid #f3f4f6;">
                                        <td style="padding:8px 12px;font-weight:700;">${esc(r.line)}</td>
                                        <td style="padding:8px 12px;">${esc(r.metric)}</td>
                                        <td style="padding:8px 12px;text-align:right;">${r.raw_value != null ? Number(r.raw_value).toFixed(3) + '%' : '—'}</td>
                                        <td style="padding:8px 12px;text-align:right;font-weight:700;color:#1B4332;">${r.adjusted_value != null ? Number(r.adjusted_value).toFixed(3) + '%' : '—'}</td>
                                        <td style="padding:8px 12px;text-align:right;font-family:'JetBrains Mono',monospace;">${kpif != null ? kpif.toFixed(4) : '—'}</td>
                                        <td style="padding:8px 12px;text-align:right;">${kpiCost != null ? Number(kpiCost).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</td>
                                        <td style="padding:8px 12px;font-size:0.75rem;color:#6b7280;">${r.remark ? esc(r.remark) : '—'}</td>
                                    </tr>
                                `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                    <p style="font-size:0.7rem;color:#9ca3af;margin-top:8px;">KPI Cost = KPIF \u00d7 a fixed Base Cost (imported from the WF sheet) \u2014 recalculates automatically whenever a new KPI Result is entered. Shows \u2014 until this metric has both a Base Cost imported and thresholds configured (so KPIF can compute).</p>
                `;
            })()}
        </div>

        <p style="font-size:0.75rem;color:#9ca3af;">This is a summary view built on the Financial Calendar &amp; Partner Allocation data — see the Enter Results tab for each KPI's own HIT/FS/ALS Share, the KPIs tab for per-KPI Final Weight breakdowns, and each Director's Overview page for their own directorate's MGT Ratio Per Line.</p>
    `;
};

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
                    <button onclick="app.openKpiDirectorateModal(${d.id})" style="padding:6px 12px;background:#EAF5EF;color:#2D6A4F;border-radius:8px;font-size:0.78rem;font-weight:700;">Edit</button>
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
                    <button onclick="app.openKpiDirectorateModal(null)" style="padding:8px 16px;background:linear-gradient(135deg, #8b6914 0%, #b8860b 50%, #d4a017 100%);color:#fff;border-radius:8px;font-size:0.85rem;font-weight:700;">+ Add Directorate</button>
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
                    <button onclick="app.saveKpiDirectorateModal()" style="padding:9px 18px;border-radius:8px;font-weight:700;font-size:0.85rem;border:none;background:linear-gradient(135deg, #8b6914 0%, #b8860b 50%, #d4a017 100%);color:#fff;">Save</button>
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
        const allocShares = this._kpiAllocationSharesFromFinalWeight(k);
        const hasAllocShares = allocShares.hit != null || allocShares.fs != null || allocShares.als != null;
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
                <td style="padding:10px 12px;text-align:right;">
                    <span style="font-weight:700;color:${finalWeight != null ? '#059669' : '#d1d5db'};">${finalWeight != null ? (finalWeight * 100).toFixed(1) + '%' : '—'}</span>
                    ${hasAllocShares ? `<br/><span style="font-size:0.68rem;color:#0891b2;white-space:nowrap;">HIT ${allocShares.hit != null ? (allocShares.hit * 100).toFixed(2) + '%' : '—'} · FS ${allocShares.fs != null ? (allocShares.fs * 100).toFixed(2) + '%' : '—'} · ALS ${allocShares.als != null ? (allocShares.als * 100).toFixed(2) + '%' : '—'}</span>` : ''}
                </td>
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
                <button onclick="app.openKpiDefinitionModal(null)" style="padding:8px 16px;background:linear-gradient(135deg, #8b6914 0%, #b8860b 50%, #d4a017 100%);color:#fff;border-radius:8px;font-size:0.85rem;font-weight:700;">+ Add KPI</button>
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
                    <button onclick="app.saveKpiDefinitionModal()" style="padding:9px 18px;border-radius:8px;font-weight:700;font-size:0.85rem;border:none;background:linear-gradient(135deg, #8b6914 0%, #b8860b 50%, #d4a017 100%);color:#fff;">Save</button>
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
// The 5 manual monthly inputs the Cost/Penalty Allocation chain needs
// (Total Management Cost + one Line Cost per line) — everything else in
// that chain computes automatically from data already in the system. A
// separate, independent panel from the KPI results form below it, since
// these figures aren't tied to any specific KPI or directorate — shown
// on Enter Results regardless of which KPI/directorate is selected.
app._renderKpiMonthlyCostInputsPanel = function() {
    const esc = this._escHtml.bind(this);
    const feePeriods = [...(this.state.kpiFeePeriods || [])].sort((a, b) => a.kpi_month_no - b.kpi_month_no);
    if (feePeriods.length === 0) return '';

    const selectedMonthNo = this.state._kpiCostInputsSelectedMonthNo != null
        ? Number(this.state._kpiCostInputsSelectedMonthNo)
        : feePeriods[feePeriods.length - 1].kpi_month_no;
    const existing = this._kpiMonthlyCostsForMonth(selectedMonthNo);
    const selectedCompany = this.state._kpiSelectedCompany || 'OMC';
    const anyPoolForMonth = ['L3', 'L4', 'L5', 'L6'].some(line => this._kpiLineCostPool(line, selectedMonthNo, selectedCompany) != null);
    const val = (v) => v != null ? v : '';

    return `
        <div class="bg-white rounded-xl shadow-md p-5 mb-6">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:6px;">
                <h3 class="text-lg font-bold text-gray-800">Monthly Cost Inputs</h3>
                <select onchange="app.state._kpiCostInputsSelectedMonthNo=parseInt(this.value,10);app.renderKpiPlannerView();" style="padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;">
                    ${feePeriods.map(p => `<option value="${p.kpi_month_no}" ${selectedMonthNo === p.kpi_month_no ? 'selected' : ''}>${esc(p.kpi_fiscal_month)}${p.kpi_month_name ? ' — ' + esc(p.kpi_month_name) + ' ' + esc(String(p.kpi_year)) : ''}</option>`).join('')}
                </select>
            </div>
            <p style="font-size:0.75rem;color:#6b7280;margin-bottom:16px;">
                The only figures that feed the Cost/Penalty Allocation chain that aren't computed from data already in the system —
                everything downstream (Management Allocation, Weighted Penalty Distribution, per-KPI cost, and the HIT/FS/ALS split)
                calculates automatically from these once saved. If this month's Management Allocation and Line Cost were already
                imported directly from an M% sheet (Import from Excel), the import takes precedence and these manual fields are ignored
                for that month.
            </p>
            <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(150px, 1fr));gap:12px;margin-bottom:14px;">
                <div>
                    <label style="font-size:0.75rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Total Management Cost</label>
                    <input type="number" step="any" id="kpiCostInputMgmt" value="${val(existing ? existing.total_management_cost : null)}"
                        style="width:100%;padding:7px 9px;border:1.5px solid #e5e7eb;border-radius:6px;font-size:0.85rem;box-sizing:border-box;" />
                </div>
                <div>
                    <label style="font-size:0.75rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Line 3 Cost</label>
                    <input type="number" step="any" id="kpiCostInputL3" value="${val(existing ? existing.line_l3_cost : null)}"
                        style="width:100%;padding:7px 9px;border:1.5px solid #e5e7eb;border-radius:6px;font-size:0.85rem;box-sizing:border-box;" />
                </div>
                <div>
                    <label style="font-size:0.75rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Line 4 Cost</label>
                    <input type="number" step="any" id="kpiCostInputL4" value="${val(existing ? existing.line_l4_cost : null)}"
                        style="width:100%;padding:7px 9px;border:1.5px solid #e5e7eb;border-radius:6px;font-size:0.85rem;box-sizing:border-box;" />
                </div>
                <div>
                    <label style="font-size:0.75rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Line 5 Cost</label>
                    <input type="number" step="any" id="kpiCostInputL5" value="${val(existing ? existing.line_l5_cost : null)}"
                        style="width:100%;padding:7px 9px;border:1.5px solid #e5e7eb;border-radius:6px;font-size:0.85rem;box-sizing:border-box;" />
                </div>
                <div>
                    <label style="font-size:0.75rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Line 6 Cost</label>
                    <input type="number" step="any" id="kpiCostInputL6" value="${val(existing ? existing.line_l6_cost : null)}"
                        style="width:100%;padding:7px 9px;border:1.5px solid #e5e7eb;border-radius:6px;font-size:0.85rem;box-sizing:border-box;" />
                </div>
            </div>
            <button onclick="app.saveKpiMonthlyCostInputs(${selectedMonthNo})" style="padding:8px 16px;background:linear-gradient(135deg, #8b6914 0%, #b8860b 50%, #d4a017 100%);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.82rem;">Save Cost Inputs</button>
            ${anyPoolForMonth ? `
                <div style="margin-top:16px;padding-top:14px;border-top:1px solid #f3f4f6;display:flex;gap:18px;flex-wrap:wrap;">
                    ${['L3', 'L4', 'L5', 'L6'].map(line => {
                        const pool = this._kpiLineCostPool(line, selectedMonthNo, selectedCompany);
                        return `<span style="font-size:0.78rem;color:#374151;"><strong>${esc(line)}</strong> pool: ${pool && pool.totalPool != null ? Number(pool.totalPool).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}${pool && pool.source === 'imported' ? ' <span style="color:#0891b2;font-weight:700;">(from import)</span>' : ''}</span>`;
                    }).join('')}
                </div>
            ` : ''}
        </div>
    `;
};

app.saveKpiMonthlyCostInputs = async function(kpiMonthNo) {
    const readNum = (id) => {
        const v = document.getElementById(id).value;
        return v === '' ? null : Number(v);
    };
    const saved = await this.saveKpiLineMonthlyCosts(kpiMonthNo, {
        totalManagementCost: readNum('kpiCostInputMgmt'),
        l3Cost: readNum('kpiCostInputL3'),
        l4Cost: readNum('kpiCostInputL4'),
        l5Cost: readNum('kpiCostInputL5'),
        l6Cost: readNum('kpiCostInputL6'),
    });
    if (saved) this.renderKpiPlannerView();
};

app._renderKpiResultsSection = function() {
    const esc = this._escHtml.bind(this);
    const selectedCompany = this.state._kpiSelectedCompany || 'OMC';
    const directorates = (this.state.kpiDirectorates || []).filter(d => (d.company || 'OMC') === selectedCompany);
    const definitions = (this.state.kpiDefinitions || []).filter(k => directorates.some(d => d.id === k.directorate_id));

    if (definitions.length === 0) {
        return `
            ${this._renderKpiMonthlyCostInputsPanel()}
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

    // ── Line filter, right after Directorate — scoped to lines that
    // actually have KPIs in this directorate, same "distinct lines
    // present" convention as KPI Reporting's Line filter ──
    const directoratesKpis = selectedDirectorateId != null ? this._kpisForDirectorate(selectedDirectorateId) : definitions;
    const availableLines = [...new Set(directoratesKpis.map(k => {
        const line = (this.state.kpiDirectorateDepartments || []).find(l => l.id === k.department_id);
        return line ? line.department_name : null;
    }).filter(Boolean))].sort();
    let filterLine = this.state._kpiResultsFilterLine || '';
    if (filterLine && !availableLines.includes(filterLine)) filterLine = '';
    const lineSelectHtml = `
        <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Line</label>
        <select id="kpiResultsLineSelect" onchange="app.state._kpiResultsFilterLine = this.value; app.state._kpiResultsSelectedId = null; app.renderKpiPlannerView();"
            style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:10px;">
            <option value="">All Lines</option>
            ${availableLines.map(l => `<option value="${esc(l)}" ${l === filterLine ? 'selected' : ''}>${esc(l)}</option>`).join('')}
        </select>
    `;

    // ── KPI Name filter (Step 3) — scoped to the directorate, Line, AND
    // the KPI Period selected above ──
    const scopedDefinitions = (selectedDirectorateId != null ? this._kpisForDirectorate(selectedDirectorateId) : definitions)
        .filter(k => k.period_type === filterPeriod)
        .filter(k => {
            if (!filterLine) return true;
            const line = (this.state.kpiDirectorateDepartments || []).find(l => l.id === k.department_id);
            return line && line.department_name === filterLine;
        });

    if (scopedDefinitions.length === 0) {
        return `
            <div class="bg-white rounded-xl shadow-md p-5">
                <h3 class="text-lg font-bold text-gray-800 mb-4">Enter Results</h3>
                ${periodFilterHtml}
                ${directorateSelectHtml}
                ${lineSelectHtml}
                <p class="text-sm text-gray-400 text-center py-6">No ${periodLabels[filterPeriod].toLowerCase()} KPIs defined for this directorate${filterLine ? ' on ' + esc(filterLine) : ''} yet.</p>
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

    const kpiOptions = scopedDefinitions.map(k => `<option value="${k.id}" ${k.id === selected.id ? 'selected' : ''}>${esc(this._kpiDisplayNameWithLine(k))}${k.kpi_code ? ` (${esc(k.kpi_code)})` : ''}</option>`).join('');
    const periodSelectOptions = periodOptions.map(p => `<option value="${esc(p.value)}">${esc(p.label)}</option>`).join('');
    const yearOptions = [selectedYear - 1, selectedYear, selectedYear + 1].map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`).join('');

    const resultsRows = existingResults.map(r => {
        // Benchmark label (Exceptional/Acceptable/Unacceptable) per the
        // exact V-column formula — replaces the old 2-tier on_target/
        // below_target badge in this table specifically. Falls back to
        // r.status's simpler "—" behavior only when Exceptional or
        // Unacceptable isn't configured for this KPI (benchmark can't be
        // computed), so the column never just goes blank.
        const benchmark = this._kpiResultBenchmark(r, selected);
        const benchmarkBadge = {
            Exceptional: ['Exceptional', '#d1fae5', '#065f46'],
            Acceptable: ['Acceptable', '#dbeafe', '#1e40af'],
            Unacceptable: ['Unacceptable', '#fee2e2', '#991b1b'],
        }[benchmark] || ['—', '#f3f4f6', '#6b7280'];
        const isOverridden = r.final_kpi != null && r.factor_score != null && Math.abs(r.final_kpi - r.factor_score) > 1e-9;
        // Per explicit correction: the three partners calculate their
        // ratio from Final Weight, NOT from this period's Final KPI/
        // Factor score — same static, design-time allocation already
        // shown in the KPIs tab, not a per-period performance split.
        const finalWeight = this._kpiFinalWeight(selected);
        const shares = this._kpiAllocationSharesFromFinalWeight(selected);
        // KPI Month / Fee Month (M1-M121 / M2-M122) — only meaningful for
        // monthly results, since the mapping is per calendar month; a
        // quarterly/yearly result has no single month to look up.
        const feePeriod = r.period_type === 'monthly' && r.period_value
            ? this._kpiFeePeriodForCalendarDate(r.year, parseInt(r.period_value, 10))
            : null;
        return `
            <tr>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${esc(r.period_label)}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${feePeriod ? esc(feePeriod.kpi_fiscal_month) : '—'}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${feePeriod ? esc(feePeriod.fee_fiscal_month) : '—'}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${esc(String(r.actual_value))}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${r.target_value != null ? esc(String(r.target_value)) : '—'}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${r.achievement != null ? esc(String(r.achievement)) + '%' : '—'}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;"><span style="background:${benchmarkBadge[1]};color:${benchmarkBadge[2]};padding:2px 10px;border-radius:999px;font-size:0.72rem;font-weight:700;">${benchmarkBadge[0]}</span></td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${r.factor_score != null ? esc(Number(r.factor_score).toFixed(2)) : '—'}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">
                    <input type="number" step="any" value="${r.final_kpi != null ? r.final_kpi : ''}"
                        onchange="app.overrideKpiFinalScore(${r.id}, this.value === '' ? null : parseFloat(this.value))"
                        style="width:70px;padding:4px 6px;border:1.5px solid ${isOverridden ? '#7c3aed' : '#e5e7eb'};border-radius:6px;font-size:0.8rem;font-weight:${isOverridden ? '700' : '400'};color:${isOverridden ? '#7c3aed' : '#111827'};" />
                    ${isOverridden ? '<span title="Manually overridden — differs from the auto-calculated Factor Score" style="font-size:0.7rem;color:#7c3aed;">✎</span>' : ''}
                </td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:${finalWeight != null ? '#059669' : '#d1d5db'};">${finalWeight != null ? (finalWeight * 100).toFixed(2) + '%' : '—'}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;">${shares.hit != null ? (shares.hit * 100).toFixed(3) + '%' : '—'}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;">${shares.fs != null ? (shares.fs * 100).toFixed(3) + '%' : '—'}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;">${shares.als != null ? (shares.als * 100).toFixed(3) + '%' : '—'}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:0.78rem;color:#6b7280;max-width:160px;">${esc(r.remarks || '—')}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;">
                    <button onclick="app.confirmDeleteKpiResultEntry(${r.id})" style="color:#991b1b;background:none;border:none;font-size:0.75rem;cursor:pointer;text-decoration:underline;">Delete</button>
                </td>
            </tr>
        `;
    }).join('');

    return `
        ${this._renderKpiMonthlyCostInputsPanel()}

        <div class="bg-white rounded-xl shadow-md p-5">
            <h3 class="text-lg font-bold text-gray-800 mb-4">Enter Results</h3>

            ${periodFilterHtml}
            ${directorateSelectHtml}
            ${lineSelectHtml}

            <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">KPI</label>
            <select id="kpiResultsKpiSelect" onchange="app.state._kpiResultsSelectedId = parseInt(this.value, 10); app.renderKpiPlannerView();"
                style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:10px;">
                ${kpiOptions}
            </select>
            <p style="font-size:0.75rem;color:#6b7280;margin-bottom:16px;">
                ${esc(selected.period_type)} · ${selected.direction === 'lower_is_better' ? 'Lower is better' : 'Higher is better'}${selected.unit ? ' · ' + esc(selected.unit) : ''}<br/>
                <span style="color:#059669;font-weight:600;">Exceptional: ${selected.exceptional_value != null ? esc(String(selected.exceptional_value)) : '—'}</span>
                &nbsp;·&nbsp;<span style="color:#1d4ed8;font-weight:600;">Acceptable (Target): ${esc(String(selected.target_value))}</span>
                &nbsp;·&nbsp;<span style="color:#dc2626;font-weight:600;">Unacceptable: ${selected.unacceptable_value != null ? esc(String(selected.unacceptable_value)) : '—'}</span>
                ${(selected.exceptional_value == null || selected.unacceptable_value == null) ? '<br/><span style="color:#92400e;">⚠️ Exceptional and/or Unacceptable isn\'t set for this KPI yet — Factor Score can\'t be calculated until both are configured (Edit this KPI in the KPIs tab).</span>' : ''}
                ${(selected.hit_pct != null || selected.fs_pct != null || selected.als_pct != null) ? `<br/><span style="color:#0891b2;">Partner split: HIT ${selected.hit_pct != null ? Math.round(selected.hit_pct * 100) + '%' : '—'} · FS ${selected.fs_pct != null ? Math.round(selected.fs_pct * 100) + '%' : '—'} · ALS ${selected.als_pct != null ? Math.round(selected.als_pct * 100) + '%' : '—'}</span>` : ''}
            </p>

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
                    <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">KPI Result${selected.unit ? ' (' + esc(selected.unit) + ')' : ''}</label>
                    <input type="number" step="any" id="kpiResultValue"
                        style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;" />
                </div>
            </div>
            <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Remarks (optional)</label>
            <textarea id="kpiResultRemarks" rows="2" style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;box-sizing:border-box;margin-bottom:14px;"></textarea>
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:20px;flex-wrap:wrap;">
                <button onclick="app.saveKpiResultEntry(${selected.id})" style="padding:9px 18px;background:linear-gradient(135deg, #8b6914 0%, #b8860b 50%, #d4a017 100%);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.85rem;">Save Result</button>
                ${selected.period_type === 'monthly' ? `
                    <button onclick="app.state._kpiBulkInsertOpen = !app.state._kpiBulkInsertOpen; app.renderKpiPlannerView();" style="padding:9px 18px;background:#fff;border:1.5px solid #1B4332;color:#1B4332;border-radius:8px;font-weight:700;font-size:0.85rem;">📅 ${this.state._kpiBulkInsertOpen ? 'Close Bulk Insert' : 'Bulk Insert (Whole Year)'}</button>
                ` : ''}
            </div>

            ${(selected.period_type === 'monthly' && this.state._kpiBulkInsertOpen) ? this._renderKpiBulkInsertPanel(selected, selectedYear) : ''}

            <h4 style="font-size:0.85rem;font-weight:700;margin-bottom:8px;">Recorded results for ${esc(this._kpiDisplayNameWithLine(selected))}</h4>
            ${existingResults.length === 0 ? '<p class="text-sm text-gray-400">No results recorded yet.</p>' : `
                <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                    <thead>
                        <tr style="text-align:left;color:#6b7280;font-size:0.72rem;text-transform:uppercase;">
                            <th style="padding:8px 12px;">Period</th>
                            <th style="padding:8px 12px;">KPI Month</th>
                            <th style="padding:8px 12px;">Fee Month</th>
                            <th style="padding:8px 12px;">KPI Result</th>
                            <th style="padding:8px 12px;">Target</th>
                            <th style="padding:8px 12px;">Achievement</th>
                            <th style="padding:8px 12px;">Status</th>
                            <th style="padding:8px 12px;">Factor</th>
                            <th style="padding:8px 12px;">Final KPI</th>
                            <th style="padding:8px 12px;text-align:right;">Final Weight</th>
                            <th style="padding:8px 12px;text-align:right;">HIT Share</th>
                            <th style="padding:8px 12px;text-align:right;">FS Share</th>
                            <th style="padding:8px 12px;text-align:right;">ALS Share</th>
                            <th style="padding:8px 12px;">Remarks</th>
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

// Bulk Insert (Whole Year) — a second way to enter results alongside the
// single-entry form above, not a replacement for it. Twelve inputs, one
// per calendar month, all funneled through the exact same saveKpiResult
// used by the single-entry form, so Factor Score/Final KPI-override
// preservation/achievement all behave identically either way. Only
// offered for monthly-cadence KPIs, since quarterly (4 periods) and
// yearly (1) don't have the same "12 separate saves" burden this solves.
app._renderKpiBulkInsertPanel = function(kpiDef, year) {
    const esc = this._escHtml.bind(this);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // Pre-fill with whatever's already saved for this KPI+year, so
    // reopening the panel shows existing values (editable) rather than
    // starting blank and risking an accidental overwrite of context.
    const existingByMonth = {};
    (this.state.kpiResults || []).forEach(r => {
        if (r.kpi_definition_id === kpiDef.id && Number(r.year) === Number(year) && r.period_value) {
            existingByMonth[r.period_value] = r.actual_value;
        }
    });

    return `
        <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:20px;">
            <p style="font-size:0.8rem;font-weight:700;color:#1B4332;margin-bottom:4px;">Bulk Insert — ${esc(this._kpiDisplayNameWithLine(kpiDef))}, ${year}</p>
            <p style="font-size:0.72rem;color:#6b7280;margin-bottom:14px;">Fill in whichever months you have — blank months are skipped, not overwritten. Existing values for ${year} are pre-filled below.</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(90px, 1fr));gap:10px;margin-bottom:14px;">
                ${monthNames.map((name, i) => {
                    const mm = String(i + 1).padStart(2, '0');
                    const existing = existingByMonth[mm];
                    return `
                        <div>
                            <label style="font-size:0.72rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">${name}</label>
                            <input type="number" step="any" id="kpiBulkMonth${mm}" value="${existing != null ? existing : ''}"
                                style="width:100%;padding:7px 8px;border:1.5px solid #e5e7eb;border-radius:6px;font-size:0.82rem;box-sizing:border-box;" />
                        </div>
                    `;
                }).join('')}
            </div>
            <button onclick="app.saveKpiResultBulk(${kpiDef.id}, ${year})" style="padding:8px 16px;background:linear-gradient(135deg, #8b6914 0%, #b8860b 50%, #d4a017 100%);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.82rem;">Save All Filled Months</button>
        </div>
    `;
};

app.saveKpiResultBulk = async function(kpiDefinitionId, year) {
    const monthNames = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const toSave = monthNames
        .map(mm => ({ mm, value: document.getElementById(`kpiBulkMonth${mm}`).value }))
        .filter(m => m.value !== '');

    if (toSave.length === 0) {
        this.showToast('Enter at least one month\'s value first.', 'error');
        return;
    }

    // Sequential, not Promise.all — saveKpiResult reads this.state.kpiResults
    // to decide whether a prior Final KPI override survives a re-save, and
    // running twelve of those concurrently against the same in-memory state
    // risks two saves reading a stale snapshot before either has written
    // back, which Promise.all's concurrent, out-of-order completion doesn't
    // guarantee protection against for a single-threaded state array like
    // this one.
    let saveCount = 0, failCount = 0;
    for (const m of toSave) {
        const saved = await this.saveKpiResult(kpiDefinitionId, { year, periodType: 'monthly', periodValue: m.mm, actualValue: Number(m.value), remarks: '', source: 'bulk' });
        if (saved) saveCount++; else failCount++;
    }

    this.showToast(`Bulk insert complete: ${saveCount} saved${failCount > 0 ? `, ${failCount} failed` : ''}.`, failCount > 0 ? 'error' : 'success');
    this.state._kpiBulkInsertOpen = false;
    this.renderKpiPlannerView();
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

        ${this._buildKpiDashboardBody(selectedDirectorateId, year, "app.renderKpiPlannerView()")}
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
    const financialPreview = this.state._kpiFinancialImportPreview;
    const financialResult = this.state._kpiFinancialImportResult;

    return `
        <div style="background:#EAF5EF;border:1px solid #C4E0D1;border-radius:10px;padding:10px 16px;margin-bottom:16px;font-size:0.82rem;color:#1B4332;">
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
                    <span style="padding:8px 18px;background:linear-gradient(135deg, #8b6914 0%, #b8860b 50%, #d4a017 100%);color:#fff;border-radius:8px;font-size:0.85rem;font-weight:700;">📁 Choose Excel File</span>
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

        <div class="bg-white rounded-xl shadow-md p-5 mt-6">
            <h3 class="text-lg font-bold text-gray-800 mb-2">4. Import Financial Calendar, Stations &amp; Partner Allocation</h3>
            <p style="font-size:0.8rem;color:#6b7280;margin-bottom:16px;">
                Upload the whole master workbook in one go — each piece is detected automatically by its column headers, regardless of what
                the sheet tabs are named: a <strong>Period KPI vs Fees</strong> sheet (KPI Month No / KPI Fixed Fee No — maps each KPI month to
                its fee month, always 1 month ahead), a <strong>Line FFt</strong> sheet (Report Month No / Fee Stream / Lag (Months) — each
                line's Active/Pre-project schedule), a <strong>Stations</strong> sheet (Fiscal Month No / Line / No. of Stations — feeds the
                MGT Ratio Per Line table's Ratio column), and a <strong>Partner Allocation</strong> sheet (KPI Code / Allocation % / HIT% / FS% /
                ALS% — splits each KPI's result across the three partners, matched by KPI Code + Line against KPIs already created above).
                The fee-period, line-schedule, and station-count pieces replace the tenant's whole reference table each time (nothing to merge
                — nobody hand-edits a fiscal calendar or a station count); Partner Allocation only updates matching existing KPIs, same as the
                imports above.
            </p>

            <div style="border:2px dashed #d1d5db;border-radius:10px;padding:24px;text-align:center;margin-bottom:20px;">
                <input type="file" id="kpiFinancialImportFileInput" accept=".xlsx,.xls" style="display:none;" onchange="app._handleKpiFinancialImportFile(event)" />
                <label for="kpiFinancialImportFileInput" style="cursor:pointer;">
                    <p style="color:#6b7280;margin-bottom:10px;">Click to browse, or drag a file here</p>
                    <span style="padding:8px 18px;background:#0891b2;color:#fff;border-radius:8px;font-size:0.85rem;font-weight:700;">📁 Choose Excel File</span>
                </label>
            </div>

            ${financialPreview ? this._renderKpiFinancialImportPreview(financialPreview) : ''}
            ${financialResult ? this._renderKpiFinancialImportResult(financialResult) : ''}
        </div>

        <div class="bg-white rounded-xl shadow-md p-5 mt-6">
            <h3 class="text-lg font-bold text-gray-800 mb-2">5. One-Time: Import M31_IWF Results (All Lines)</h3>
            <p style="font-size:0.8rem;color:#6b7280;margin-bottom:16px;">
                A one-time historical backfill of 128 real values from AMEEN (1).xlsx's M31_IWF sheet — all four line sections (L3-L6),
                column R (the KPIs showing "-" in each line's section, A1 and A6, are correctly left out of every line). Note some KPIs'
                frequency genuinely differs by line in the source file (e.g. C1 "Cleanliness of Trains" is Monthly on L3 but Quarterly on
                L4/L5/L6) — preserved exactly as found per line, not assumed uniform. KPI Month 31 maps to <strong>May 2026</strong> on the
                imported fee calendar, so each KPI is saved under whatever real period its own frequency implies for that month: Monthly
                &rarr; May 2026, Quarterly &rarr; Q2 2026, Annual (E3, H1) &rarr; 2026. Matched by KPI Code + Line against KPIs already
                created under the selected company — this only updates existing KPIs, it never creates new ones.
            </p>
            <button onclick="app._confirmM31IWFImport()" style="padding:9px 18px;background:linear-gradient(135deg, #8b6914 0%, #b8860b 50%, #d4a017 100%);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.85rem;">Import All Lines</button>
            ${this.state._kpiM31ImportResult ? `
                <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:16px;">
                    <p style="font-size:0.82rem;color:#374151;margin-bottom:4px;">${this.state._kpiM31ImportResult.updated} saved, ${this.state._kpiM31ImportResult.notFound} not found, ${this.state._kpiM31ImportResult.failed} failed.</p>
                    ${this.state._kpiM31ImportResult.errors.length > 0 ? `
                        <div style="background:#fffbeb;border-radius:8px;padding:12px;margin-top:10px;max-height:200px;overflow-y:auto;">
                            ${this.state._kpiM31ImportResult.errors.map(e => `<p style="font-size:0.75rem;color:#92400e;">${this._escHtml(e)}</p>`).join('')}
                        </div>
                    ` : ''}
                </div>
            ` : ''}
        </div>

        <div class="bg-white rounded-xl shadow-md p-5 mt-6">
            <h3 class="text-lg font-bold text-gray-800 mb-2">6. Directorate Assignment Audit</h3>
            <p style="font-size:0.8rem;color:#6b7280;margin-bottom:16px;">
                Read-only check comparing every KPI's current home directorate against its correct primary owner from the real
                KPI_Owner.xlsx (highest-% owner per KPI Code — same across all 4 lines). This does NOT change anything automatically —
                reassigning a KPI's directorate also needs its Line record repointed to the new directorate's own L3/L4/L5/L6, not just
                swapping one field, so any fix found here needs to be done manually via the Directorates/KPIs tabs after review.
            </p>
            <button onclick="app._runKpiDirectorateAudit()" style="padding:9px 18px;background:linear-gradient(135deg, #8b6914 0%, #b8860b 50%, #d4a017 100%);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.85rem;">Run Audit</button>
            ${this.state._kpiDirectorateAudit ? `
                <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:16px;">
                    <p style="font-size:0.82rem;color:#374151;margin-bottom:10px;">
                        Checked ${this.state._kpiDirectorateAudit.checked} KPIs against the reference
                        ${this.state._kpiDirectorateAudit.noReference > 0 ? `(${this.state._kpiDirectorateAudit.noReference} skipped — no matching KPI Code in the reference, e.g. custom KPIs not in the original file)` : ''} —
                        <strong style="color:${this.state._kpiDirectorateAudit.mismatches.length > 0 ? '#991b1b' : '#166534'};">${this.state._kpiDirectorateAudit.mismatches.length} mismatch(es) found</strong>.
                    </p>
                    ${this.state._kpiDirectorateAudit.mismatches.length > 0 ? `
                        <div style="overflow-x:auto;">
                            <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                                <thead>
                                    <tr style="text-align:left;color:#6b7280;font-size:0.7rem;text-transform:uppercase;background:#f9fafb;">
                                        <th style="padding:8px 12px;">KPI</th>
                                        <th style="padding:8px 12px;">Line</th>
                                        <th style="padding:8px 12px;">Currently Under</th>
                                        <th style="padding:8px 12px;">Should Be</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${this.state._kpiDirectorateAudit.mismatches.map(m => `
                                        <tr style="border-top:1px solid #f3f4f6;">
                                            <td style="padding:8px 12px;font-weight:600;">${this._escHtml(m.kpiCode)}: ${this._escHtml(m.kpiName)}</td>
                                            <td style="padding:8px 12px;">${this._escHtml(m.line)}</td>
                                            <td style="padding:8px 12px;color:#991b1b;">${this._escHtml(m.currentDirectorate)}</td>
                                            <td style="padding:8px 12px;color:#166534;font-weight:600;">${this._escHtml(m.expectedDirectorate)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
        </div>
    `;
};

app._runKpiDirectorateAudit = function() {
    this.state._kpiDirectorateAudit = this.auditKpiDirectorateAssignments(this.state._kpiSelectedCompany || 'OMC');
    this.renderKpiPlannerView();
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
                <div style="background:#EAF5EF;border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:#2D6A4F;font-weight:700;">VALID ROWS</p>
                    <p style="font-size:1.4rem;font-weight:800;color:#2D6A4F;">${validRows.length}</p>
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
                <div style="background:#EAF5EF;border-radius:8px;padding:10px;">
                    <p style="font-size:0.72rem;color:#2D6A4F;font-weight:700;">UPDATED</p>
                    <p style="font-size:1.4rem;font-weight:800;color:#2D6A4F;">${result.updated}</p>
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

// Reads every sheet in the uploaded workbook and detects which of the 3
// known formats each one matches by its column headers (not sheet
// name — the actual master file's tabs aren't named exactly what a
// user might expect, so name-matching would be fragile).
app._handleKpiFinancialImportFile = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    this.state._kpiFinancialImportPreview = null;
    this.state._kpiFinancialImportResult = null;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            let partnerAllocation = null, feePeriods = null, lineSchedule = null, stationCounts = null, availability = null, availabilityMonthNo = null, iwfResults = null, iwfMonthNo = null, costPools = null, resultsHistory = null, availabilityCostRows = null, availabilityBaseCostRows = null;
            workbook.SheetNames.forEach(name => {
                // Availability Factor and IWF Results are both detected
                // by SHEET NAME, not headers — neither has an explicit
                // month column. Both parsers now read the raw worksheet
                // object directly (by absolute cell address, e.g.
                // sheet['D13']), NOT a pre-converted array-of-arrays —
                // a real file exposed a bug where sheet_to_json's
                // header:1 array is relative to the sheet's own USED
                // RANGE, which can start at any column (both real
                // M32_IWF and M32_AFctr sheets start at column B, not
                // A), silently shifting every array-index-based read by
                // one column with no error. Reading by literal address
                // sidesteps that entirely.
                const afctrMatch = /^M(\d+)_AFctr$/i.exec(name.trim());
                if (!availability && afctrMatch) {
                    const monthNo = parseInt(afctrMatch[1], 10);
                    const parsed = this._kpiParseAvailabilityFactorRows(workbook.Sheets[name], monthNo);
                    if (parsed.length > 0) { availability = parsed; availabilityMonthNo = monthNo; }
                    return;
                }
                const iwfMatch = /^M(\d+)_IWF$/i.exec(name.trim());
                if (!iwfResults && iwfMatch) {
                    const monthNo = parseInt(iwfMatch[1], 10);
                    const parsed = this._kpiParseIWFResultsRows(workbook.Sheets[name], monthNo);
                    if (parsed.length > 0) { iwfResults = parsed; iwfMonthNo = monthNo; }
                    return;
                }
                // "KPI Results" — a full multi-month historical backfill,
                // distinct from the single-month M{N}_IWF sheets. Exact
                // name match to avoid colliding with "KPI Results TLR &
                // TSR", a different sheet in the same workbook.
                if (!resultsHistory && name.trim() === 'KPI Results') {
                    const parsed = this._kpiParseFullKpiResultsSheet(workbook.Sheets[name]);
                    if (parsed.length > 0) resultsHistory = parsed;
                    return;
                }
                // "WF" — feeds two pieces: the newer Base Cost figures
                // per (Line, Metric) that drive the live KPIF x BaseCost
                // formula, and the older single-month cost breakdown
                // (kept for backward compatibility, no longer used by
                // the display).
                if (!availabilityCostRows && name.trim() === 'WF') {
                    const parsed = this._kpiParseWFAvailabilityCostRows(workbook.Sheets[name]);
                    if (parsed.length > 0) availabilityCostRows = parsed;
                    const baseCostParsed = this._kpiParseWFBaseCostRows(workbook.Sheets[name]);
                    if (baseCostParsed.length > 0) availabilityBaseCostRows = baseCostParsed;
                    return;
                }

                const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { raw: false, defval: '' });
                if (rows.length === 0) return;
                const headers = Object.keys(rows[0]);
                if (!partnerAllocation && headers.includes('Allocation %') && headers.includes('HIT%')) {
                    const nonEmpty = rows.filter(r => r['KPI Code']);
                    partnerAllocation = this._kpiParsePartnerAllocationRows(nonEmpty);
                } else if (!feePeriods && headers.includes('KPI Month No') && headers.includes('KPI Fixed Fee No')) {
                    feePeriods = this._kpiParseFeePeriodRows(rows);
                } else if (!lineSchedule && headers.includes('Report Month No') && headers.includes('Fee Stream')) {
                    lineSchedule = this._kpiParseLineFeeScheduleRows(rows);
                } else if (!stationCounts && headers.includes('Fiscal Month No') && headers.includes('No. of Stations') && headers.includes('Line')) {
                    stationCounts = this._kpiParseStationCountRows(rows);
                } else if (!costPools && headers.includes('Mngmnt Per Line') && headers.includes('Line Cost')) {
                    // Reads the RAW worksheet object (not the header-keyed
                    // `rows` above), since the L/M/N dollar columns use
                    // accounting format for negatives (e.g. "(29,759.63)"),
                    // unparseable as text — the parser reads cell.v directly.
                    const parsed = this._kpiParseMPercentCostRows(workbook.Sheets[name]);
                    if (parsed.length > 0) costPools = parsed;
                }
            });

            if (!partnerAllocation && !feePeriods && !lineSchedule && !stationCounts && !availability && !iwfResults && !costPools && !resultsHistory) {
                this.showToast('No matching sheets found — expected columns for Partner Allocation, Period KPI vs Fees, Line FFt, Stations, M% Cost Pools, or a "M{N}_AFctr"/"M{N}_IWF" sheet.', 'error');
                return;
            }

            this.state._kpiFinancialImportPreview = { partnerAllocation, feePeriods, lineSchedule, stationCounts, availability, availabilityMonthNo, iwfResults, iwfMonthNo, costPools, resultsHistory, availabilityCostRows, availabilityBaseCostRows };
            this.renderKpiPlannerView();
        } catch (err) {
            console.error('❌ Failed to parse financial import file:', err.message);
            this.showToast('Could not read this file: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
};

app._renderKpiFinancialImportPreview = function(preview) {
    const esc = this._escHtml.bind(this);
    const { partnerAllocation, feePeriods, lineSchedule, stationCounts, availability, availabilityMonthNo, iwfResults, iwfMonthNo, costPools, resultsHistory, availabilityCostRows, availabilityBaseCostRows } = preview;
    const selectedCompany = this.state._kpiSelectedCompany || 'OMC';

    const tile = (label, found, count, extra) => `
        <div style="background:${found ? '#f0fdf4' : '#f9fafb'};border-radius:8px;padding:10px;">
            <p style="font-size:0.72rem;color:${found ? '#166534' : '#9ca3af'};font-weight:700;">${esc(label)}</p>
            <p style="font-size:1.2rem;font-weight:800;color:${found ? '#166534' : '#9ca3af'};">${found ? count : 'not found'}</p>
            ${extra ? `<p style="font-size:0.72rem;color:#6b7280;">${extra}</p>` : ''}
        </div>
    `;

    let paNotFound = 0;
    if (partnerAllocation) {
        paNotFound = partnerAllocation.validRows.filter(r => !this._kpiFindExistingKpiByCodeAndLine(r.kpiCode, r.line, selectedCompany)).length;
    }
    const costPoolMonths = costPools ? [...new Set(costPools.map(r => r.kpi_month_no))].sort((a, b) => a - b) : [];
    const historyMonths = resultsHistory ? [...new Set(resultsHistory.map(r => r.kpi_month_no))].sort((a, b) => a - b) : [];

    return `
        <div style="border-top:1px solid #e5e7eb;padding-top:16px;">
            <h4 style="font-weight:700;margin-bottom:10px;">Detected in this file</h4>
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-4">
                ${tile('Partner Allocation rows', !!partnerAllocation, partnerAllocation ? partnerAllocation.validRows.length : 0, partnerAllocation && paNotFound > 0 ? `${paNotFound} won't match any existing KPI` : '')}
                ${tile('Fee period months', !!feePeriods, feePeriods ? feePeriods.length : 0, feePeriods ? 'replaces the whole calendar' : '')}
                ${tile('Line fee schedule rows', !!lineSchedule, lineSchedule ? lineSchedule.length : 0, lineSchedule ? 'replaces the whole schedule' : '')}
                ${tile('Station count rows', !!stationCounts, stationCounts ? stationCounts.length : 0, stationCounts ? 'replaces the whole table' : '')}
                ${tile('Availability Factor rows', !!availability, availability ? availability.length : 0, availability ? `KPI Month ${availabilityMonthNo} only` : '')}
                ${tile('KPI Results (IWF)', !!iwfResults, iwfResults ? iwfResults.length : 0, iwfResults ? `KPI Month ${iwfMonthNo}, all lines` : '')}
                ${tile('Cost Pool rows (M%)', !!costPools, costPools ? costPools.length : 0, costPools ? `KPI Months ${costPoolMonths[0]}\u2013${costPoolMonths[costPoolMonths.length - 1]}` : '')}
                ${tile('KPI Results history', !!resultsHistory, resultsHistory ? resultsHistory.length : 0, resultsHistory ? `KPI Months ${historyMonths[0]}\u2013${historyMonths[historyMonths.length - 1]}, both companies` : '')}
                ${tile('Availability Cost (WF)', !!availabilityCostRows, availabilityCostRows ? availabilityCostRows.length : 0, availabilityCostRows ? 'one month\u2019s snapshot \u2014 month resolved from Cost Pool data' : '')}
                ${tile('Availability Base Cost (WF)', !!availabilityBaseCostRows, availabilityBaseCostRows ? availabilityBaseCostRows.length : 0, availabilityBaseCostRows ? 'feeds KPI Cost = KPIF \u00d7 this, every month' : '')}
            </div>
            ${!costPools && availabilityCostRows ? `
                <div style="background:#fef2f2;border-radius:8px;padding:12px;margin-bottom:16px;">
                    <p style="font-size:0.8rem;color:#991b1b;">⚠️ Availability Cost (WF) needs the M% Cost Pool data to figure out which month it belongs to — this file doesn't include an M% sheet, so run that import first, then re-import this WF sheet.</p>
                </div>
            ` : ''}
            ${partnerAllocation && partnerAllocation.invalidRows.length > 0 ? `
                <div style="background:#fef2f2;border-radius:8px;padding:12px;margin-bottom:16px;max-height:160px;overflow-y:auto;">
                    <p style="font-size:0.8rem;font-weight:700;color:#991b1b;margin-bottom:6px;">Partner Allocation rows that will be skipped:</p>
                    ${partnerAllocation.invalidRows.map(r => `<p style="font-size:0.75rem;color:#991b1b;">Row ${r.rowNumber}: ${esc(r.errors.join('; '))}</p>`).join('')}
                </div>
            ` : ''}
            ${resultsHistory && resultsHistory.length > 200 ? `
                <div style="background:#fffbeb;border-radius:8px;padding:12px;margin-bottom:16px;">
                    <p style="font-size:0.8rem;color:#92400e;">⚠️ ${resultsHistory.length} KPI Results will be saved one at a time — this may take several minutes. Stay on this page until it finishes.</p>
                </div>
            ` : ''}
            <div style="display:flex;gap:10px;">
                <button onclick="app.state._kpiFinancialImportPreview=null;app.state._kpiFinancialImportResult=null;app.renderKpiPlannerView();"
                    style="padding:9px 18px;border-radius:8px;font-weight:600;font-size:0.85rem;border:1.5px solid #e5e7eb;background:#fff;color:#374151;">Cancel</button>
                <button onclick="app._confirmKpiFinancialImport()"
                    style="padding:9px 18px;border-radius:8px;font-weight:700;font-size:0.85rem;border:none;background:#0891b2;color:#fff;">
                    Confirm Import
                </button>
            </div>
        </div>
    `;
};

app._renderKpiFinancialImportResult = function(result) {
    const esc = this._escHtml.bind(this);
    const lines = [];
    if (result.partnerAllocation) lines.push(`Partner Allocation: ${result.partnerAllocation.updated} updated, ${result.partnerAllocation.notFound} not found, ${result.partnerAllocation.failed} failed`);
    if (result.feePeriods) lines.push(`Fee periods: ${result.feePeriods.imported} imported`);
    if (result.lineSchedule) lines.push(`Line fee schedule: ${result.lineSchedule.imported} imported`);
    if (result.stationCounts) lines.push(`Station counts: ${result.stationCounts.imported} imported`);
    if (result.availability) lines.push(`Availability Factor: ${result.availability.imported} imported`);
    if (result.iwfResults) lines.push(`KPI Results (IWF): ${result.iwfResults.updated} updated, ${result.iwfResults.notFound} not found, ${result.iwfResults.failed} failed`);
    if (result.costPools) lines.push(`Cost Pools (M%): ${result.costPools.imported} imported`);
    if (result.resultsHistory) lines.push(`KPI Results history: ${result.resultsHistory.updated} updated, ${result.resultsHistory.notFound} not found, ${result.resultsHistory.failed} failed`);
    if (result.availabilityCost) lines.push(`Availability Cost (WF): ${result.availabilityCost.imported} imported`);
    if (result.availabilityBaseCost) lines.push(`Availability Base Cost (WF): ${result.availabilityBaseCost.imported} imported`);
    // Every one of the pieces can carry its own errors — a previous
    // version of this only checked Partner Allocation's, so a real
    // failure saving fee periods/line schedule (e.g. a missing table
    // from an unrun migration) was silently swallowed and showed as a
    // bare "0 imported" with nothing explaining why.
    const allErrors = [
        ...(result.partnerAllocation ? result.partnerAllocation.errors.map(e => `Partner Allocation — ${e}`) : []),
        ...(result.feePeriods ? result.feePeriods.errors.map(e => `Fee periods — ${e}`) : []),
        ...(result.lineSchedule ? result.lineSchedule.errors.map(e => `Line fee schedule — ${e}`) : []),
        ...(result.stationCounts ? result.stationCounts.errors.map(e => `Station counts — ${e}`) : []),
        ...(result.availability ? result.availability.errors.map(e => `Availability Factor — ${e}`) : []),
        ...(result.iwfResults ? result.iwfResults.errors.map(e => `KPI Results (IWF) — ${e}`) : []),
        ...(result.costPools ? result.costPools.errors.map(e => `Cost Pools (M%) — ${e}`) : []),
        ...(result.resultsHistory ? result.resultsHistory.errors.map(e => `KPI Results history — ${e}`) : []),
        ...(result.availabilityCost ? result.availabilityCost.errors.map(e => `Availability Cost (WF) — ${e}`) : []),
        ...(result.availabilityBaseCost ? result.availabilityBaseCost.errors.map(e => `Availability Base Cost (WF) — ${e}`) : []),
    ];
    return `
        <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:16px;">
            <h4 style="font-weight:700;margin-bottom:10px;">Import Result</h4>
            ${lines.map(l => `<p style="font-size:0.82rem;color:#374151;margin-bottom:4px;">${esc(l)}</p>`).join('')}
            ${allErrors.length > 0 ? `
                <div style="background:#fffbeb;border-radius:8px;padding:12px;margin-top:10px;max-height:200px;overflow-y:auto;">
                    ${allErrors.map(e => `<p style="font-size:0.75rem;color:#92400e;">${esc(e)}</p>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
};

app._confirmKpiFinancialImport = async function() {
    const preview = this.state._kpiFinancialImportPreview;
    if (!preview) return;
    const parts = [];
    if (preview.partnerAllocation) parts.push(`${preview.partnerAllocation.validRows.length} Partner Allocation row(s)`);
    if (preview.feePeriods) parts.push(`${preview.feePeriods.length} fee period month(s) (replaces the existing calendar)`);
    if (preview.lineSchedule) parts.push(`${preview.lineSchedule.length} line fee schedule row(s) (replaces the existing schedule)`);
    if (preview.stationCounts) parts.push(`${preview.stationCounts.length} station count row(s) (replaces the existing table)`);
    if (preview.availability) parts.push(`${preview.availability.length} Availability Factor row(s) for KPI Month ${preview.availabilityMonthNo}`);
    if (preview.iwfResults) parts.push(`${preview.iwfResults.length} KPI Result(s) for KPI Month ${preview.iwfMonthNo}, all lines`);
    if (preview.costPools) parts.push(`${preview.costPools.length} Cost Pool row(s) (M%)`);
    if (preview.resultsHistory) parts.push(`${preview.resultsHistory.length} historical KPI Result(s), both companies`);
    if (preview.availabilityCostRows) parts.push(`${preview.availabilityCostRows.length} Availability Cost row(s) (WF, one month)`);
    const ok = confirm(`Import ${parts.join(', ')}?`);
    if (!ok) return;

    const result = {};
    if (preview.partnerAllocation) {
        result.partnerAllocation = await this.importKpiPartnerAllocation(preview.partnerAllocation.validRows, this.state._kpiSelectedCompany || 'OMC');
    }
    if (preview.feePeriods) {
        result.feePeriods = await this.importKpiFeePeriods(preview.feePeriods);
    }
    if (preview.lineSchedule) {
        result.lineSchedule = await this.importKpiLineFeeSchedule(preview.lineSchedule);
    }
    if (preview.stationCounts) {
        result.stationCounts = await this.importKpiLineStationCounts(preview.stationCounts);
    }
    if (preview.availability) {
        result.availability = await this.importKpiLineAvailability(preview.availability, preview.availabilityMonthNo);
    }
    if (preview.iwfResults) {
        result.iwfResults = await this.importKpiIWFResults(preview.iwfResults, preview.iwfMonthNo, this.state._kpiSelectedCompany || 'OMC');
    }
    if (preview.costPools) {
        result.costPools = await this.importKpiLineCostPools(preview.costPools);
    }
    if (preview.resultsHistory) {
        result.resultsHistory = await this.importKpiFullResultsHistory(preview.resultsHistory);
    }
    if (preview.availabilityCostRows) {
        // Must run AFTER costPools — the month for each row is resolved
        // by matching against kpiLineCostPools, which the step above
        // just populated (or which was already there from an earlier
        // M% import in a previous session).
        result.availabilityCost = await this.importKpiLineAvailabilityCost(preview.availabilityCostRows, this.state._kpiSelectedCompany || 'OMC');
    }
    if (preview.availabilityBaseCostRows) {
        // No ordering dependency on anything else — this is a fixed
        // dollar figure per (Line, Metric), not month-scoped.
        result.availabilityBaseCost = await this.importKpiLineAvailabilityBaseCost(preview.availabilityBaseCostRows, this.state._kpiSelectedCompany || 'OMC');
    }

    this.state._kpiFinancialImportResult = result;
    this.state._kpiFinancialImportPreview = null;
    this.renderKpiPlannerView();
};

app._confirmM31IWFImport = async function() {
    const ok = confirm('Import the 128 real M31_IWF results across all 4 lines (May 2026 / Q2 2026 / 2026, per each KPI\'s own frequency)? This only updates existing KPIs, matched by KPI Code + Line.');
    if (!ok) return;
    const result = await this.importM31IWFResults(this.state._kpiSelectedCompany || 'OMC');
    this.state._kpiM31ImportResult = result;
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
                    ${u.linked_login ? ' · <span style="color:#40916C;">🔗 Linked to Corporate Staff login</span>' : ''}
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
            <button onclick="app.doGrantKpiDirectorAccess()" style="padding:9px 18px;background:linear-gradient(135deg, #8b6914 0%, #b8860b 50%, #d4a017 100%);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.85rem;">
                🔗 Grant Access to All Matching Directors
            </button>
        </div>

        <div class="bg-white rounded-xl shadow-md p-5">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <h3 class="text-lg font-bold text-gray-800">All KPI Users (${users.length})</h3>
                <button onclick="app.openKpiUserModal()" style="padding:8px 16px;background:linear-gradient(135deg, #8b6914 0%, #b8860b 50%, #d4a017 100%);color:#fff;border-radius:8px;font-size:0.85rem;font-weight:700;">+ Add User</button>
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
                    <button onclick="app.saveKpiUserModal()" style="padding:9px 18px;border-radius:8px;font-weight:700;font-size:0.85rem;border:none;background:linear-gradient(135deg, #8b6914 0%, #b8860b 50%, #d4a017 100%);color:#fff;">Save</button>
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
app._buildKpiDashboardBody = function(directorateId, year, rerenderCall) {
    // This body is shared by TWO different top-level pages: the Director
    // dashboard's own Overview (renderKpiDirectorView) AND the Planner's
    // "Preview Dashboard" tab (renderKpiPlannerView, previewing another
    // directorate read-only). Every interactive control inside here must
    // call back into whichever one is actually hosting it — hardcoding
    // renderKpiDirectorView() broke Preview Dashboard's controls for a
    // Planner session (no verifiedKpiUser exists for a Planner login, so
    // that function's directorateId resolution failed and showed the
    // Director-only "Not Yet Assigned to a Directorate" error page).
    const rerender = rerenderCall || 'app.renderKpiDirectorView()';
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

    // MGT Ratio Per Line — per AMEEN (1).xlsx's M31_IWF sheet. Defaults
    // to the latest imported KPI Month, since (unlike the KPI Detail
    // list) there's no meaningful "just show me the latest result"
    // fallback for a table that's inherently anchored to one specific
    // month's station counts. A separate "Year (Sum)" mode sums each
    // month's Weighted Contribution across the whole year instead — per
    // explicit request, a SUM across all KPI Months in that year, not an
    // average.
    const mgtFeePeriods = [...(this.state.kpiFeePeriods || [])].sort((a, b) => a.kpi_month_no - b.kpi_month_no);
    const mgtMode = this.state._kpiMgtRatioMode === 'year' ? 'year' : 'month';
    const mgtRawSelected = this.state._kpiMgtRatioSelectedMonthNo;
    const mgtSelectedMonthNo = mgtRawSelected != null ? Number(mgtRawSelected) : this._kpiLatestMonthWithMgtData(mgtFeePeriods, directorateId);
    const mgtTable = mgtMode === 'month' && mgtSelectedMonthNo != null ? this._kpiMgtRatioPerLine(mgtSelectedMonthNo, directorateId) : null;
    const mgtSelectedPeriod = mgtSelectedMonthNo != null ? mgtFeePeriods.find(p => p.kpi_month_no === mgtSelectedMonthNo) : null;
    const mgtYearOptions = [...new Set(mgtFeePeriods.map(p => p.kpi_year))].sort((a, b) => a - b);
    const mgtSelectedYear = this.state._kpiMgtRatioSelectedYear != null ? Number(this.state._kpiMgtRatioSelectedYear) : (mgtYearOptions.length > 0 ? mgtYearOptions[mgtYearOptions.length - 1] : year);
    const mgtAnnual = mgtMode === 'year' ? this._kpiMgtRatioPerLineAnnual(mgtSelectedYear, directorateId) : null;

    return `
        <!-- Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;">
                <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">Total KPIs</p>
                <p style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:2rem;color:#14251C;margin-top:2px;">${cards.total}</p>
            </div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-left:4px solid #2D6A4F;border-radius:12px;padding:18px 20px;">
                <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">Achieved</p>
                <p style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:2rem;color:#2D6A4F;margin-top:2px;">${cards.achieved}</p>
            </div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-left:4px solid #DC2626;border-radius:12px;padding:18px 20px;">
                <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">Below Target</p>
                <p style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:2rem;color:#DC2626;margin-top:2px;">${cards.belowTarget}</p>
            </div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-left:4px solid #d1d5db;border-radius:12px;padding:18px 20px;">
                <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">Pending</p>
                <p style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:2rem;color:#6b7280;margin-top:2px;">${cards.pending}</p>
            </div>
        </div>

        <!-- MGT Ratio Per Line -->
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
                <div>
                    <h3 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.05rem;color:#14251C;">MGT Ratio Per Line</h3>
                    <p style="font-size:0.72rem;color:#9ca3af;">This directorate's own KPIs, weighted by each line's share of station count</p>
                </div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                    <div style="display:flex;border:1.5px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                        <button onclick="app.state._kpiMgtRatioMode='month';${rerender};" style="padding:6px 12px;border:none;font-size:0.78rem;font-weight:700;cursor:pointer;background:${mgtMode === 'month' ? '#1B4332' : '#fff'};color:${mgtMode === 'month' ? '#fff' : '#374151'};">Month</button>
                        <button onclick="app.state._kpiMgtRatioMode='year';${rerender};" style="padding:6px 12px;border:none;font-size:0.78rem;font-weight:700;cursor:pointer;background:${mgtMode === 'year' ? '#1B4332' : '#fff'};color:${mgtMode === 'year' ? '#fff' : '#374151'};">Year (Sum)</button>
                    </div>
                    ${mgtMode === 'month' && mgtFeePeriods.length > 0 ? `
                        <select onchange="app.state._kpiMgtRatioSelectedMonthNo=parseInt(this.value,10);${rerender};" style="padding:6px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.8rem;">
                            ${mgtFeePeriods.map(p => `<option value="${p.kpi_month_no}" ${mgtSelectedMonthNo === p.kpi_month_no ? 'selected' : ''}>${esc(p.kpi_fiscal_month)}${p.kpi_month_name ? ' — ' + esc(p.kpi_month_name) + ' ' + esc(String(p.kpi_year)) : ''}</option>`).join('')}
                        </select>
                    ` : ''}
                    ${mgtMode === 'year' && mgtYearOptions.length > 0 ? `
                        <select onchange="app.state._kpiMgtRatioSelectedYear=parseInt(this.value,10);${rerender};" style="padding:6px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.8rem;">
                            ${mgtYearOptions.map(y => `<option value="${y}" ${mgtSelectedYear === y ? 'selected' : ''}>${y}</option>`).join('')}
                        </select>
                    ` : ''}
                </div>
            </div>
            ${mgtMode === 'month' ? (!mgtTable ? `<p style="font-size:0.8rem;color:#9ca3af;text-align:center;padding:20px 0;">No Financial Calendar imported yet — run the Import from Excel section to enable this table.</p>` : `
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                        <thead>
                            <tr style="text-align:left;color:#6b7280;font-size:0.7rem;text-transform:uppercase;background:#f9fafb;">
                                <th style="padding:8px 12px;">Line</th>
                                <th style="padding:8px 12px;text-align:right;">Stations</th>
                                <th style="padding:8px 12px;text-align:right;">Ratio</th>
                                <th style="padding:8px 12px;text-align:right;">KPIFt</th>
                                <th style="padding:8px 12px;text-align:right;">M%erc</th>
                                <th style="padding:8px 12px;text-align:right;">M%erct-avgte</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${mgtTable.rows.map(r => `
                                <tr style="border-top:1px solid #f3f4f6;">
                                    <td style="padding:8px 12px;font-weight:700;">${esc(r.line)}</td>
                                    <td style="padding:8px 12px;text-align:right;">${r.stations != null ? r.stations : '—'}</td>
                                    <td style="padding:8px 12px;text-align:right;">${r.ratio != null ? (r.ratio * 100).toFixed(1) + '%' : '—'}</td>
                                    <td style="padding:8px 12px;text-align:right;font-family:'JetBrains Mono',monospace;">${r.kpiFt != null ? r.kpiFt.toFixed(4) : '—'}</td>
                                    <td style="padding:8px 12px;text-align:right;">${r.mPerc != null ? (r.mPerc * 100).toFixed(3) + '%' : '—'}</td>
                                    <td style="padding:8px 12px;text-align:right;font-weight:700;color:#1B4332;">${r.weighted != null ? (r.weighted * 100).toFixed(3) + '%' : '—'}</td>
                                </tr>
                            `).join('')}
                            <tr style="border-top:2px solid #e5e7eb;">
                                <td colspan="5" style="padding:10px 12px;font-weight:700;text-align:right;">Total</td>
                                <td style="padding:10px 12px;text-align:right;font-weight:800;font-family:'JetBrains Mono',monospace;color:#B8860B;">${(mgtTable.total * 100).toFixed(4)}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `) : (!mgtAnnual || mgtAnnual.monthsInYearCount === 0 ? `<p style="font-size:0.8rem;color:#9ca3af;text-align:center;padding:20px 0;">No Financial Calendar imported yet for ${esc(String(mgtSelectedYear))} — run the Import from Excel section to enable this table.</p>` : `
                <p style="font-size:0.72rem;color:#9ca3af;margin-bottom:10px;">Sum of each month's Weighted Contribution across all ${mgtAnnual.monthsInYearCount} KPI Month(s) configured in ${esc(String(mgtSelectedYear))} — not an average.</p>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                        <thead>
                            <tr style="text-align:left;color:#6b7280;font-size:0.7rem;text-transform:uppercase;background:#f9fafb;">
                                <th style="padding:8px 12px;">Line</th>
                                <th style="padding:8px 12px;text-align:right;">Months Counted</th>
                                <th style="padding:8px 12px;text-align:right;">Weighted (Sum)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${mgtAnnual.rows.map(r => `
                                <tr style="border-top:1px solid #f3f4f6;">
                                    <td style="padding:8px 12px;font-weight:700;">${esc(r.line)}</td>
                                    <td style="padding:8px 12px;text-align:right;">${r.monthsCounted} / ${mgtAnnual.monthsInYearCount}</td>
                                    <td style="padding:8px 12px;text-align:right;font-weight:700;color:#1B4332;">${(r.sumWeighted * 100).toFixed(4)}%</td>
                                </tr>
                            `).join('')}
                            <tr style="border-top:2px solid #e5e7eb;">
                                <td colspan="2" style="padding:10px 12px;font-weight:700;text-align:right;">Total</td>
                                <td style="padding:10px 12px;text-align:right;font-weight:800;font-family:'JetBrains Mono',monospace;color:#B8860B;">${(mgtAnnual.total * 100).toFixed(4)}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `)}
        </div>

        <!-- Availability Factor -->
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
                <div>
                    <h3 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.05rem;color:#14251C;">Availability Factor</h3>
                    <p style="font-size:0.72rem;color:#9ca3af;">PSA / TSA / FOSA — raw vs. adjusted, per line</p>
                </div>
                ${mgtFeePeriods.length > 0 ? `
                    <select onchange="app.state._kpiAvailabilitySelectedMonthNo=parseInt(this.value,10);${rerender};" style="padding:6px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.8rem;">
                        ${mgtFeePeriods.map(p => `<option value="${p.kpi_month_no}" ${(this.state._kpiAvailabilitySelectedMonthNo != null ? Number(this.state._kpiAvailabilitySelectedMonthNo) : this._kpiLatestMonthWithAvailabilityData(mgtFeePeriods)) === p.kpi_month_no ? 'selected' : ''}>${esc(p.kpi_fiscal_month)}${p.kpi_month_name ? ' — ' + esc(p.kpi_month_name) + ' ' + esc(String(p.kpi_year)) : ''}</option>`).join('')}
                    </select>
                ` : ''}
            </div>
            ${(() => {
                const availMonthNo = this.state._kpiAvailabilitySelectedMonthNo != null ? Number(this.state._kpiAvailabilitySelectedMonthNo) : this._kpiLatestMonthWithAvailabilityData(mgtFeePeriods);
                if (availMonthNo == null) return `<p style="font-size:0.8rem;color:#9ca3af;text-align:center;padding:20px 0;">No Financial Calendar imported yet.</p>`;
                // Availability Factor is physical network data (like
                // station counts), not owned by one directorate — a
                // directorate has all 4 lines as its own departments, so
                // this shows every line's figures for the selected month,
                // same shape as the company-wide station/MGT tables.
                const rows = ['L3', 'L4', 'L5', 'L6'].flatMap(l => this._kpiLineAvailabilityForMonth(l, availMonthNo));
                if (rows.length === 0) return `<p style="font-size:0.8rem;color:#9ca3af;text-align:center;padding:20px 0;">No Availability Factor data imported yet for this month — run the Import from Excel section.</p>`;
                const dirForCompany = (this.state.kpiDirectorates || []).find(d => d.id === directorateId);
                const company = dirForCompany ? (dirForCompany.company || 'OMC') : 'OMC';
                return `
                    <div style="overflow-x:auto;">
                        <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                            <thead>
                                <tr style="text-align:left;color:#6b7280;font-size:0.7rem;text-transform:uppercase;background:#f9fafb;">
                                    <th style="padding:8px 12px;">Line</th>
                                    <th style="padding:8px 12px;">Metric</th>
                                    <th style="padding:8px 12px;text-align:right;">Raw</th>
                                    <th style="padding:8px 12px;text-align:right;">Adjusted</th>
                                    <th style="padding:8px 12px;text-align:right;">KPIF</th>
                                    <th style="padding:8px 12px;text-align:right;">KPI Cost</th>
                                    <th style="padding:8px 12px;">Remark</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.map(r => {
                                    const kpif = this._kpiAvailabilityMetricFactorScore(r.metric, r.line, availMonthNo, company);
                                    const kpiCost = this._kpiAvailabilityMetricCost(r.metric, r.line, availMonthNo, company);
                                    return `
                                    <tr style="border-top:1px solid #f3f4f6;">
                                        <td style="padding:8px 12px;font-weight:700;">${esc(r.line)}</td>
                                        <td style="padding:8px 12px;">${esc(r.metric)}</td>
                                        <td style="padding:8px 12px;text-align:right;">${r.raw_value != null ? Number(r.raw_value).toFixed(3) + '%' : '—'}</td>
                                        <td style="padding:8px 12px;text-align:right;font-weight:700;color:#1B4332;">${r.adjusted_value != null ? Number(r.adjusted_value).toFixed(3) + '%' : '—'}</td>
                                        <td style="padding:8px 12px;text-align:right;font-family:'JetBrains Mono',monospace;">${kpif != null ? kpif.toFixed(4) : '—'}</td>
                                        <td style="padding:8px 12px;text-align:right;">${kpiCost != null ? Number(kpiCost).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</td>
                                        <td style="padding:8px 12px;font-size:0.75rem;color:#6b7280;">${r.remark ? esc(r.remark) : '—'}</td>
                                    </tr>
                                `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            })()}
        </div>

        ${monthly.length > 0 || monthlyCadenceKpis.length > 0 ? `
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
                    <h3 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.05rem;color:#14251C;">
                        Monthly Performance — ${year}${selectedMonthlyKpi ? ` · ${esc(selectedMonthlyKpi.name)}` : ' · All KPIs (Average)'}
                    </h3>
                    <select onchange="app.state._kpiOverviewMonthlySelectedKpiId = this.value ? parseInt(this.value, 10) : null; ${rerender};"
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
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">
                    <h3 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.05rem;color:#14251C;margin-bottom:1px;">Quarterly Trend</h3>
                    <p style="font-size:0.72rem;color:#9ca3af;margin-bottom:12px;">Across every quarter with recorded results</p>
                    <div style="background:#1F2937;border-radius:10px;padding:14px;box-sizing:border-box;height:248px;"><canvas id="kpiQuarterlyChart"></canvas></div>
                </div>
            ` : ''}
            ${yearlyTrend.series.length > 0 ? `
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">
                    <h3 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.05rem;color:#14251C;margin-bottom:1px;">Year-over-Year Trend</h3>
                    <p style="font-size:0.72rem;color:#9ca3af;margin-bottom:12px;">Across every year with recorded results</p>
                    <div style="height:220px;"><canvas id="kpiYearlyChart"></canvas></div>
                </div>
            ` : ''}
            ${monthly.length === 0 && quarterlyTrend.series.length === 0 && yearlyTrend.series.length === 0 ? `
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;text-align:center;" class="lg:col-span-2">
                    <p class="text-sm text-gray-400">No results recorded yet — charts will appear once results are entered.</p>
                </div>
            ` : ''}
        </div>

        <!-- Department ranking -->
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
            <h3 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.05rem;color:#14251C;margin-bottom:16px;">Department Ranking</h3>
            ${ranking.length === 0 ? '<p class="text-sm text-gray-400 text-center py-4">No department results yet.</p>' : ranking.map((r, i) => `
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                    <span style="width:20px;color:#9ca3af;font-size:0.8rem;font-family:'JetBrains Mono',monospace;">#${i + 1}</span>
                    <span style="width:140px;font-size:0.85rem;font-weight:600;color:#14251C;">${esc(r.departmentName)}</span>
                    <div style="flex:1;background:#f3f4f6;border-radius:999px;height:18px;overflow:hidden;">
                        <div style="height:100%;width:${Math.min(100, Math.max(4, r.avgAchievement))}%;background:${r.avgAchievement >= 100 ? '#2D6A4F' : '#D4A017'};border-radius:999px;"></div>
                    </div>
                    <span style="width:60px;text-align:right;font-size:0.8rem;font-weight:700;font-family:'JetBrains Mono',monospace;color:#14251C;">${r.avgAchievement}%</span>
                </div>
            `).join('')}
        </div>

        <!-- Top / Lowest KPIs -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">
                <h3 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.05rem;color:#2D6A4F;margin-bottom:10px;">🏆 Top KPIs</h3>
                ${top10.length === 0 ? '<p class="text-sm text-gray-400 py-4">No results yet.</p>' : top10.map(k => kpiListRow(k, '#2D6A4F')).join('')}
            </div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">
                <h3 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.05rem;color:#DC2626;margin-bottom:10px;">⚠️ Lowest KPIs</h3>
                ${bottom10.length === 0 ? '<p class="text-sm text-gray-400 py-4">No results yet.</p>' : bottom10.map(k => kpiListRow(k, '#DC2626')).join('')}
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
                    backgroundColor: '#40916C',
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

    const navItem = (key, icon, label) => {
        const active = tab === key;
        return `
            <div onclick="app.state._kpiDirectorTab='${key}';app.renderKpiDirectorView();"
                style="position:relative;display:flex;align-items:center;gap:12px;padding:10px 18px;cursor:pointer;color:${active ? '#fff' : 'rgba(255,255,255,0.65)'};background:${active ? 'rgba(255,255,255,0.06)' : 'transparent'};">
                <span style="width:11px;height:11px;border-radius:50%;flex-shrink:0;z-index:1;background:${active ? '#D4A017' : '#2D6A4F'};border:3px solid ${active ? '#D4A017' : 'rgba(255,255,255,0.28)'};box-shadow:${active ? '0 0 0 3px rgba(212,160,23,0.25)' : 'none'};"></span>
                <span style="font-size:0.92rem;">${icon}</span>
                <span style="font-size:0.85rem;font-weight:600;">${esc(label)}</span>
            </div>
        `;
    };

    let bodyHtml, kpiPickerHtml = '';
    let selectedKpiWeight = 1;
    if (tab === 'detail') {
        if (kpisInScope.length === 0) {
            bodyHtml = `<div class="bg-white rounded-xl shadow p-8 text-center"><p class="text-sm text-gray-400">No KPIs configured for this directorate yet.</p></div>`;
        } else if (this.state._kpiDirectorSelectedKpiId != null && kpisInScope.some(k => k.id === this.state._kpiDirectorSelectedKpiId)) {
            const selectedKpiId = this.state._kpiDirectorSelectedKpiId;
            const selectedKpiClone = kpisInScope.find(k => k.id === selectedKpiId);
            selectedKpiWeight = selectedKpiClone ? selectedKpiClone._ownershipWeight : 1;
            const kpiOptions = kpisInScope.map(k => `<option value="${k.id}" ${k.id === selectedKpiId ? 'selected' : ''}>${esc(this._kpiDisplayNameWithLine(k))}${k._ownershipWeight < 1 ? ` (${Math.round(k._ownershipWeight * 100)}% share)` : ''}</option>`).join('');
            kpiPickerHtml = `
                <button onclick="app.state._kpiDirectorSelectedKpiId = null; app.renderKpiDirectorView();"
                    style="padding:8px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;font-weight:600;color:#1B4332;background:#fff;">← All KPIs</button>
                <select onchange="app.state._kpiDirectorSelectedKpiId = parseInt(this.value, 10); app.renderKpiDirectorView();"
                    style="padding:8px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;font-weight:600;">
                    ${kpiOptions}
                </select>
            `;
            bodyHtml = this._buildKpiSingleDetailBody(selectedKpiId, year, selectedKpiWeight);
        } else {
            // Default: every configured KPI, filterable, with an
            // M1-M121 Month selector matching the source Excel's
            // convention — per explicit request, this replaces the old
            // behavior of always auto-picking one KPI (which functionally
            // meant only ever seeing a single, often unrepresentative,
            // KPI on first load).
            bodyHtml = this._buildKpiDetailListBody(directorateId, year, kpisInScope);
        }
    } else {
        bodyHtml = this._buildKpiDashboardBody(directorateId, year);
    }

    content.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:26px;width:100%;">
            <aside style="width:248px;flex-shrink:0;background:#1B4332;border-radius:14px;padding:24px 0;position:sticky;top:calc(var(--topbar-h, 0px) + 20px);display:flex;flex-direction:column;">
                <div style="padding:0 22px 14px 22px;">
                    <div style="color:#fff;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:1.2rem;letter-spacing:0.02em;">FLOW <span style="color:#D4A017;">◆</span> KPI</div>
                </div>
                <div style="padding:0 22px 14px 22px;">
                    <h2 style="color:#fff;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.15rem;">📈 ${esc(directorate ? directorate.name : 'KPI')}</h2>
                    ${isSuperUser ? '<span style="display:inline-block;margin-top:8px;background:rgba(212,160,23,0.18);color:#D4A017;padding:2px 8px;border-radius:999px;font-size:0.65rem;font-weight:700;">👁️ VIEW-ONLY · ALL</span>' : ''}
                </div>
                <nav style="position:relative;padding:14px 0 4px 0;border-top:1px solid rgba(255,255,255,0.1);flex:1;">
                    <div style="position:absolute;left:23px;top:28px;bottom:14px;width:3px;background:rgba(255,255,255,0.12);border-radius:2px;"></div>
                    ${navItem('overview', '🏛️', 'Overview')}
                    ${navItem('detail', '🔍', 'KPI Detail')}
                </nav>
                <div style="padding:16px 22px 4px 22px;border-top:1px solid rgba(255,255,255,0.08);margin-top:12px;display:flex;align-items:center;gap:10px;">
                    <div style="width:30px;height:30px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg, #7C3AED, #2D6A4F);"></div>
                    <div>
                        <div style="font-size:0.8rem;font-weight:600;color:#fff;">${esc(user.name)}</div>
                        <div style="font-size:0.68rem;color:rgba(255,255,255,0.45);">${isSuperUser ? 'Super User · All Directorates' : 'KPI Executive Director'}</div>
                    </div>
                </div>
            </aside>
            <main style="flex:1;min-width:0;">
                <div class="flex justify-between items-center flex-wrap gap-3 mb-4">
                    <div></div>
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
                ${bodyHtml}
            </main>
        </div>
    `;

    if (tab === 'detail' && kpisInScope.length > 0 && this.state._kpiDirectorSelectedKpiId != null && kpisInScope.some(k => k.id === this.state._kpiDirectorSelectedKpiId)) {
        this._drawKpiSingleDetailChart(this.state._kpiDirectorSelectedKpiId, year, selectedKpiWeight);
    } else if (tab !== 'detail') {
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
// Default view for the "KPI Detail" tab — every configured KPI for this
// directorate, filterable, with an M1-M121 Month selector built directly
// from the imported Financial Calendar (kpi_fee_periods), matching the
// source Excel's own numbering exactly. Clicking a row drills into the
// existing single-KPI chart view (_buildKpiSingleDetailBody) — this
// doesn't replace that, it's just no longer the forced starting point.
app._buildKpiDetailListBody = function(directorateId, year, kpisInScope) {
    const esc = this._escHtml.bind(this);

    const filterPeriod = this.state._kpiDetailFilterPeriod || 'all';
    const filterLine = this.state._kpiDetailFilterLine || 'all';

    // Month (Excel) selector — only meaningful for monthly KPIs; picking
    // one just has no effect on quarterly/yearly rows, which always show
    // their own latest result regardless.
    const feePeriods = [...(this.state.kpiFeePeriods || [])].sort((a, b) => a.kpi_month_no - b.kpi_month_no);
    const selectedMonthNo = this.state._kpiDetailSelectedMonthNo != null ? Number(this.state._kpiDetailSelectedMonthNo) : null;
    const selectedFeePeriod = selectedMonthNo != null ? feePeriods.find(p => p.kpi_month_no === selectedMonthNo) : null;

    const lineOf = (k) => (this.state.kpiDirectorateDepartments || []).find(l => l.id === k.department_id);

    let filtered = kpisInScope;
    if (filterPeriod !== 'all') filtered = filtered.filter(k => k.period_type === filterPeriod);
    if (filterLine !== 'all') filtered = filtered.filter(k => { const l = lineOf(k); return l && l.department_name === filterLine; });

    const rows = filtered.map(k => {
        const line = lineOf(k);
        let result = null;
        if (k.period_type === 'monthly' && selectedFeePeriod) {
            const calMonthStr = String(selectedFeePeriod.kpi_cal_month).padStart(2, '0');
            result = (this.state.kpiResults || []).find(r => r.kpi_definition_id === k.id && Number(r.year) === selectedFeePeriod.kpi_year && r.period_value === calMonthStr) || null;
        } else {
            const scoped = this._kpiScopedResults(k.id, k._ownershipWeight).filter(r => Number(r.year) === year).sort((a, b) => (b.entered_at || '').localeCompare(a.entered_at || ''));
            result = scoped[0] || null;
        }
        const benchmark = result ? this._kpiResultBenchmark(result, k) : null;
        const benchmarkBadge = {
            Exceptional: ['Exceptional', '#d1fae5', '#065f46'],
            Acceptable: ['Acceptable', '#dbeafe', '#1e40af'],
            Unacceptable: ['Unacceptable', '#fee2e2', '#991b1b'],
        }[benchmark] || ['—', '#f3f4f6', '#6b7280'];
        const periodLabel = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' }[k.period_type] || k.period_type;
        return `
            <tr style="border-top:1px solid #f3f4f6;cursor:pointer;" onclick="app.state._kpiDirectorSelectedKpiId=${k.id};app.renderKpiDirectorView();">
                <td style="padding:10px 12px;font-weight:600;color:#1B4332;">${esc(k.name)}${k._ownershipWeight < 1 ? ` <span style="color:#7c3aed;font-size:0.7rem;font-weight:700;">(${Math.round(k._ownershipWeight * 100)}% share)</span>` : ''}</td>
                <td style="padding:10px 12px;">${line ? esc(line.department_name) : '—'}</td>
                <td style="padding:10px 12px;">${esc(periodLabel)}</td>
                <td style="padding:10px 12px;">${result ? esc(result.period_label) : '—'}</td>
                <td style="padding:10px 12px;text-align:right;">${result ? esc(String(result.actual_value)) : '—'}</td>
                <td style="padding:10px 12px;text-align:right;">${result && result.achievement != null ? esc(String(result.achievement)) + '%' : '—'}</td>
                <td style="padding:10px 12px;"><span style="background:${benchmarkBadge[1]};color:${benchmarkBadge[2]};padding:2px 10px;border-radius:999px;font-size:0.72rem;font-weight:700;">${benchmarkBadge[0]}</span></td>
            </tr>
        `;
    }).join('');

    const distinctLines = [...new Set(kpisInScope.map(k => { const l = lineOf(k); return l ? l.department_name : null; }).filter(Boolean))].sort();

    return `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px;margin-bottom:18px;">
            <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end;">
                <div>
                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">KPI Period</label>
                    <select onchange="app.state._kpiDetailFilterPeriod=this.value;app.renderKpiDirectorView();" style="padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;">
                        <option value="all" ${filterPeriod === 'all' ? 'selected' : ''}>All</option>
                        <option value="monthly" ${filterPeriod === 'monthly' ? 'selected' : ''}>Monthly</option>
                        <option value="quarterly" ${filterPeriod === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                        <option value="yearly" ${filterPeriod === 'yearly' ? 'selected' : ''}>Yearly</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Line</label>
                    <select onchange="app.state._kpiDetailFilterLine=this.value;app.renderKpiDirectorView();" style="padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;">
                        <option value="all" ${filterLine === 'all' ? 'selected' : ''}>All Lines</option>
                        ${distinctLines.map(l => `<option value="${esc(l)}" ${filterLine === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}
                    </select>
                </div>
                ${feePeriods.length > 0 ? `
                <div>
                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Month (Excel)</label>
                    <select onchange="app.state._kpiDetailSelectedMonthNo=this.value?parseInt(this.value,10):null;app.renderKpiDirectorView();" style="padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.85rem;min-width:180px;">
                        <option value="">Latest result</option>
                        ${feePeriods.map(p => `<option value="${p.kpi_month_no}" ${selectedMonthNo === p.kpi_month_no ? 'selected' : ''}>${esc(p.kpi_fiscal_month)}${p.kpi_month_name ? ' — ' + esc(p.kpi_month_name) + ' ' + esc(String(p.kpi_year)) : ''}</option>`).join('')}
                    </select>
                </div>
                ` : ''}
            </div>
            ${feePeriods.length === 0 ? '<p style="font-size:0.72rem;color:#9ca3af;margin-top:10px;">No fee period calendar imported yet — the Month selector will appear once the Planner runs the Financial Calendar import.</p>' : ''}
        </div>

        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            ${filtered.length === 0 ? '<p style="padding:30px;text-align:center;color:#9ca3af;font-size:0.85rem;">No KPIs match this filter.</p>' : `
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                        <thead>
                            <tr style="text-align:left;color:#6b7280;font-size:0.7rem;text-transform:uppercase;background:#f9fafb;">
                                <th style="padding:8px 12px;">KPI</th>
                                <th style="padding:8px 12px;">Line</th>
                                <th style="padding:8px 12px;">Frequency</th>
                                <th style="padding:8px 12px;">Period</th>
                                <th style="padding:8px 12px;text-align:right;">Result</th>
                                <th style="padding:8px 12px;text-align:right;">Achievement</th>
                                <th style="padding:8px 12px;">Benchmark</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `}
        </div>
    `;
};

app._buildKpiSingleDetailBody = function(kpiId, year, weight) {    const esc = this._escHtml.bind(this);
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

