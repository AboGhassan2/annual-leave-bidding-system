// ════════════════════════════════════════════════════════════════════
// views-configure.js — OPS and Maintenance slot configuration screens.
//
// Attaches onto the shared `app` object, must load AFTER app.js.
//
// Covers: renderConfigureSlotsView / renderConfigureMaintSlotsView and
// everything under them — department filtering, per-department slot
// rendering, bulk import, copy-to-all-months, reset-to-default, save
// (to Supabase via this.saveConfigToSupabase()), and the row-opacity/
// mark-all UI helpers for both the Ops and Maintenance versions.
// ════════════════════════════════════════════════════════════════════

            app.renderConfigureSlotsView = function() {
                const content = document.getElementById('contentArea');
                
                // Get all unique departments from employees AND the predefined list
                // Filter: only L3, L46, L5 prefixes
                const employeeDepts = [...new Set(this.state.employees.map(e => e.department || 'Unassigned'))];
                const allRawDepartments = [...new Set([...this.state.departments, ...employeeDepts])];
                const filteredDepts = allRawDepartments.filter(d => /^(L3|L46|L5|L3465)[-\s]/i.test(d) || d === 'L3-SA' || d === 'L5 SA' || d === 'L3 SAMB' || d === 'L5 SAMB' || d === 'L46 SAMB').sort();
                const allDepartments = ['all', ...filteredDepts];
                
                content.innerHTML = `
                    <div class="max-w-7xl mx-auto">
                        <div class="metro-card p-6">
                            <h2 class="text-2xl font-bold mb-4" style="font-family:'Barlow Condensed',sans-serif;color:var(--app-text);">📅 Configure Bid Slot Calendar for ${this.state.biddingYear}</h2>
                            <p class="mb-6" style="color:var(--app-text-muted);">
                                Define specific calendar date ranges for each bid slot per department per block (Block 1–12).
                                Each department has Slot A, Slot B, Slot C and Slot D for each of the 12 blocks, with individual capacity limits.
                                A block's dates can run into the next calendar month — the block number is just the row's position, not a promise about which month its dates fall in.
                            </p>
                            
                            <div class="mb-6 p-4 rounded-lg border" style="background:var(--app-green-50);border-color:var(--app-border);">
                                <label class="block font-semibold mb-2" style="color:var(--app-text);">Filter by Department:</label>
                                <select
                                    id="deptFilter"
                                    class="w-full px-4 py-3 border-2 rounded-lg text-lg font-semibold"
                                    style="border-color:var(--metro-green-light);color:var(--app-text);"
                                    onchange="app.filterDepartments()"
                                >
                                    ${allDepartments.map(dept => `
                                        <option value="${dept}">
                                            ${dept === 'all' ? 'All Departments (L3 / L46 / L5)' : dept}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="flex justify-end gap-2 mb-3">
                                <button onclick="document.querySelectorAll('#configArea details.metro-dept-card').forEach(d=>d.open=true)" class="metro-tab" style="padding:5px 12px;font-size:0.75rem;">⌄ Expand all</button>
                                <button onclick="document.querySelectorAll('#configArea details.metro-dept-card').forEach(d=>d.open=false)" class="metro-tab" style="padding:5px 12px;font-size:0.75rem;">⌃ Collapse all</button>
                            </div>
            
                            <div id="configArea">
                                ${this.renderDeptConfig('all')}
                            </div>
                        </div>
                    </div>
                `;
            };
            app.filterDepartments = function() {
                const filter = document.getElementById('deptFilter').value;
                const configArea = document.getElementById('configArea');
                if (configArea) {
                    configArea.innerHTML = this.renderDeptConfig(filter);
                }
            };
            app.renderConfigureMaintSlotsView = function() {
                const content = document.getElementById('contentArea');
                const maintUsers = this.state.maintenanceStaffUsers || [];
                const maintDepts = [...new Set(maintUsers.map(u => u.position || 'Unassigned'))].sort();
                const allDepts = ['all', ...maintDepts];

                content.innerHTML = `
                    <div class="max-w-7xl mx-auto">
                        <div class="metro-card p-6">
                            <div class="flex items-center gap-3 mb-2">
                                <span style="font-size:1.8rem;">🔧</span>
                                <h2 class="text-2xl font-bold" style="font-family:'Barlow Condensed',sans-serif;color:var(--app-text);">Configure Bid Slot Calendar — Maintenance Staff (${this.state.biddingYear})</h2>
                            </div>
                            <p class="mb-6" style="color:var(--app-text-muted);">
                                Define date ranges and capacities for Slot A, B, and C per Maintenance roster group per month.
                            </p>

                            <div class="mb-6 p-4 rounded-lg border-2" style="background:#fff7ed;border-color:#fdba74;">
                                <label class="block font-semibold mb-2" style="color:#9a3412;">Filter by Roster Group:</label>
                                <select
                                    id="maintDeptFilter"
                                    class="w-full px-4 py-3 border-2 rounded-lg text-lg font-semibold"
                                    style="border-color:#fb923c;color:var(--app-text);"
                                    onchange="app.filterMaintDepartments()"
                                >
                                    ${allDepts.map(d => `<option value="${d}">${d === 'all' ? 'All Roster Groups' : d}</option>`).join('')}
                                </select>
                            </div>

                            <div class="flex justify-end gap-2 mb-3">
                                <button onclick="document.querySelectorAll('#maintConfigArea details.metro-dept-card').forEach(d=>d.open=true)" class="metro-tab" style="padding:5px 12px;font-size:0.75rem;">⌄ Expand all</button>
                                <button onclick="document.querySelectorAll('#maintConfigArea details.metro-dept-card').forEach(d=>d.open=false)" class="metro-tab" style="padding:5px 12px;font-size:0.75rem;">⌃ Collapse all</button>
                            </div>

                            <div id="maintConfigArea">
                                ${this.renderMaintDeptConfig('all')}
                            </div>
                        </div>
                    </div>
                `;
            };
            app.filterMaintDepartments = function() {
                const filter = document.getElementById('maintDeptFilter').value;
                const area = document.getElementById('maintConfigArea');
                if (area) area.innerHTML = this.renderMaintDeptConfig(filter);
            };
            app.renderMaintDeptConfig = function(filter) {
                const maintUsers = this.state.maintenanceStaffUsers || [];
                const allDepts = [...new Set(maintUsers.map(u => u.position || 'Unassigned'))].sort();
                const deptsToConfigure = filter === 'all' ? allDepts : [filter];

                if (deptsToConfigure.length === 0) {
                    return `<div class="rounded p-6 text-center" style="background:#fffbeb;border:1px solid #fde68a;">
                        <p class="text-lg font-semibold">No maintenance roster groups found.</p>
                    </div>`;
                }

                let html = filter === 'all'
                    ? `<div class="mb-6 p-4 rounded" style="background:#fff7ed;border:1px solid #fdba74;">
                        <h3 class="text-xl font-semibold mb-2" style="font-family:'Barlow Condensed',sans-serif;color:#9a3412;">🔧 Maintenance Slot Configuration — All Roster Groups</h3>
                        <p style="color:#9a3412;">Configure date ranges for each bid slot across ${deptsToConfigure.length} maintenance roster groups.</p>
                       </div>`
                    : `<div class="mb-6 p-4 rounded" style="background:#fff7ed;border:1px solid #fdba74;">
                        <h3 class="text-xl font-semibold mb-2" style="font-family:'Barlow Condensed',sans-serif;color:#9a3412;">🔧 Maintenance Slot Configuration — ${filter}</h3>
                       </div>`;

                html += `<div class="space-y-8">`;

                deptsToConfigure.forEach(dept => {
                    const empCount = maintUsers.filter(u => (u.position || 'Unassigned') === dept).length;
                    html += `
                        <details class="metro-dept-card" ${filter !== 'all' ? 'open' : ''}>
                            <summary class="metro-dept-summary" style="background:#fff7ed;">
                                <div style="display:flex;align-items:center;gap:12px;">
                                    <span class="metro-dept-caret" style="color:#ea580c;">▶</span>
                                    <div>
                                        <h3 class="text-xl font-bold" style="font-family:'Barlow Condensed',sans-serif;margin:0;color:#9a3412;">${dept}</h3>
                                        <span class="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded">${empCount} maintenance staff</span>
                                    </div>
                                </div>
                                <div class="flex items-center gap-3">
                                    <span class="text-sm text-gray-500">12-Block Slot Configuration</span>
                                    <button onclick="event.stopPropagation();event.preventDefault();app.resetMaintDeptSlotsToDefault('${dept}')" class="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded hover:bg-gray-300" title="Clears saved dates/capacities/on-off for this roster group and restores the auto-computed default 30-day blocks">↺ Reset to Default Dates</button>
                                </div>
                            </summary>
                            <div class="px-4 pt-3">
                                <details class="bg-indigo-50 border border-indigo-200 rounded-lg">
                                    <summary onclick="event.stopPropagation()" class="cursor-pointer px-3 py-2 font-semibold text-indigo-800 text-sm">📋 Bulk Paste Import (paste all 12 months at once — from Excel or a saved template)</summary>
                                    <div class="p-3 pt-1">
                                        <p class="text-xs text-indigo-700 mb-2">
                                            One row per month, columns tab- or comma-separated, dates as DD/MM/YYYY, "on" as 1 or 0:<br>
                                            <code>Month, SA-Start, SA-End, SA-Max, SA-On, SB-Start, SB-End, SB-Max, SB-On, SC-Start, SC-End, SC-Max, SC-On</code>
                                        </p>
                                        <textarea id="bulkImportMaint-${dept}" rows="4" placeholder="January\t01/01/2027\t15/01/2027\t4\t1\t16/01/2027\t30/01/2027\t4\t1\t01/01/2027\t15/01/2027\t1\t1"
                                            class="w-full text-xs font-mono border border-indigo-300 rounded p-2"></textarea>
                                        <div class="flex gap-2 mt-2">
                                            <button onclick="app.bulkImportMaintDeptSlots('${dept}')" class="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700">Import &amp; Save</button>
                                            <span id="bulkImportMaintMsg-${dept}" class="text-xs self-center"></span>
                                        </div>
                                    </div>
                                </details>
                            </div>
                            <div class="p-4 overflow-x-auto">
                                <table class="w-full text-sm border-collapse">
                                    <thead>
                                        <tr class="bg-gray-50">
                                            <th class="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Block</th>
                                            <th class="border border-gray-200 px-2 py-2 text-center font-semibold text-green-700 bg-green-50">
                                                <div class="flex flex-col items-center gap-1"><span>A — On</span>
                                                    <label class="flex items-center gap-1 cursor-pointer">
                                                        <input type="checkbox" class="maint-mark-all w-3 h-3 accent-green-600" data-dept="${dept}" data-slot="SA" onchange="app._markAllMaintSlot(this)" />
                                                        <span class="text-xs font-normal text-green-600">All</span>
                                                    </label>
                                                </div>
                                            </th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-green-700 bg-green-50">Slot A — Start</th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-green-700 bg-green-50">Slot A — End</th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-green-700 bg-green-50">Slot A — Max</th>
                                            <th class="border border-gray-200 px-2 py-2 text-center font-semibold text-blue-700 bg-blue-50">
                                                <div class="flex flex-col items-center gap-1"><span>B — On</span>
                                                    <label class="flex items-center gap-1 cursor-pointer">
                                                        <input type="checkbox" class="maint-mark-all w-3 h-3 accent-blue-600" data-dept="${dept}" data-slot="SB" onchange="app._markAllMaintSlot(this)" />
                                                        <span class="text-xs font-normal text-blue-600">All</span>
                                                    </label>
                                                </div>
                                            </th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-blue-700 bg-blue-50">Slot B — Start</th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-blue-700 bg-blue-50">Slot B — End</th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-blue-700 bg-blue-50">Slot B — Max</th>
                                            <th class="border border-gray-200 px-2 py-2 text-center font-semibold text-purple-700 bg-purple-50">
                                                <div class="flex flex-col items-center gap-1"><span>C — On</span>
                                                    <label class="flex items-center gap-1 cursor-pointer">
                                                        <input type="checkbox" class="maint-mark-all w-3 h-3 accent-purple-600" data-dept="${dept}" data-slot="SC" onchange="app._markAllMaintSlot(this)" />
                                                        <span class="text-xs font-normal text-purple-600">All</span>
                                                    </label>
                                                </div>
                                            </th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-purple-700 bg-purple-50">Slot C — Start</th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-purple-700 bg-purple-50">Slot C — End</th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-purple-700 bg-purple-50">Slot C — Max</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${this.state.months.map((month, monthIdx) => {
                                            const year = this.state.biddingYear;
                                            const pad = n => String(n).padStart(2,'0');
                                            const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                                            // 360-day calendar: each "month" is a fixed 30-day block (Jan1=day1)
                                            const defaultStart = toDateStr(new Date(year, 0, monthIdx*30 + 1));
                                            const defaultEnd = toDateStr(new Date(year, 0, (monthIdx+1)*30));
                                            return `<tr class="hover:bg-gray-50">
                                                <td class="border border-gray-200 px-3 py-2 font-semibold text-gray-800 bg-gray-50 whitespace-nowrap">${this.blockLabel(month)}</td>
                                                ${['SA','SB','SC'].map((slotId, si) => {
                                                    const colors = ['border-green-300 focus:border-green-500','border-blue-300 focus:border-blue-500','border-purple-300 focus:border-purple-500'];
                                                    const bgCols = ['bg-green-50','bg-blue-50','bg-purple-50'];
                                                    const savedStart = this.state.maintSlotCapacities[`cal-maint-${dept}-${month}-${slotId}-start`];
                                                    const savedEnd = this.state.maintSlotCapacities[`cal-maint-${dept}-${month}-${slotId}-end`];
                                                    const savedCap = this.state.maintSlotCapacities[`cal-maint-${dept}-${month}-${slotId}-capacity`];
                                                    const savedEnabled = this.state.maintSlotCapacities[`cal-maint-${dept}-${month}-${slotId}-enabled`];
                                                    const startVal = savedStart !== undefined ? savedStart : defaultStart;
                                                    const endVal = savedEnd !== undefined ? savedEnd : defaultEnd;
                                                    const capVal = savedCap !== undefined ? savedCap : 1;
                                                    const enabledVal = savedEnabled !== undefined ? savedEnabled : false;
                                                    const opacity = enabledVal ? '' : 'opacity-40';
                                                    return `
                                                        <td class="border border-gray-200 px-1 py-1 ${bgCols[si]} text-center">
                                                            <input type="checkbox"
                                                                data-dept="${dept}" data-month="${month}" data-slot="${slotId}" data-field="enabled"
                                                                class="maint-slot-input maint-slot-enabled w-4 h-4 accent-current cursor-pointer"
                                                                ${enabledVal ? 'checked' : ''}
                                                                onchange="app._toggleMaintSlotOpacity(this)"
                                                            />
                                                        </td>
                                                        <td class="border border-gray-200 px-1 py-1 ${bgCols[si]} ${opacity}">
                                                            <input type="date"
                                                                data-dept="${dept}" data-month="${month}" data-slot="${slotId}" data-field="start"
                                                                class="maint-slot-input w-full px-1 py-1 border ${colors[si]} rounded text-xs"
                                                                min="${year}-01-01" max="${year}-12-31" value="${startVal}" />
                                                        </td>
                                                        <td class="border border-gray-200 px-1 py-1 ${bgCols[si]} ${opacity}">
                                                            <input type="date"
                                                                data-dept="${dept}" data-month="${month}" data-slot="${slotId}" data-field="end"
                                                                class="maint-slot-input w-full px-1 py-1 border ${colors[si]} rounded text-xs"
                                                                min="${year}-01-01" max="${year}-12-31" value="${endVal}" />
                                                        </td>
                                                        <td class="border border-gray-200 px-1 py-1 ${bgCols[si]} ${opacity}">
                                                            <input type="number" min="0" max="200"
                                                                data-dept="${dept}" data-month="${month}" data-slot="${slotId}" data-field="capacity"
                                                                class="maint-slot-input w-full px-1 py-1 border ${colors[si]} rounded text-center text-xs"
                                                                placeholder="1" value="${capVal}" />
                                                        </td>
                                                    `;
                                                }).join('')}
                                            </tr>`;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </details>
                    `;
                });

                html += `</div>`;
                html += `
                    <div class="mt-8">
                        <div class="rounded p-4 mb-4" style="background:#fff7ed;border:1px solid #fdba74;">
                            <p class="font-semibold mb-2" style="color:#9a3412;">📋 Maintenance Slot Configuration Summary:</p>
                            <p class="text-sm" style="color:#9a3412;">
                                • Roster groups: ${deptsToConfigure.length}<br>
                                • Bid slots per group: 3 (Slot A, Slot B, Slot C) × 12 months<br>
                                • Toggle <strong>On</strong> to make a slot visible to Maintenance Staff for that month
                            </p>
                        </div>
                        <div class="flex gap-3">
                            <button onclick="app.saveMaintSlotConfiguration()" class="flex-1 px-6 py-3 text-white rounded-lg font-semibold" style="background:#ea580c;" onmouseover="this.style.background='#c2410c'" onmouseout="this.style.background='#ea580c'">
                                💾 Save All Maintenance Slot Configurations
                            </button>
                            <button onclick="app.setActiveView('admin')" class="metro-tab">
                                ← Back
                            </button>
                        </div>
                    </div>
                `;
                return html;
            };
            app._toggleMaintSlotOpacity = function(checkbox) {
                const row = checkbox.closest('tr');
                if (!row) return;
                const { dept, month, slot } = checkbox.dataset;
                row.querySelectorAll(`input[data-dept="${dept}"][data-month="${month}"][data-slot="${slot}"]:not([data-field="enabled"])`).forEach(inp => {
                    inp.closest('td').style.opacity = checkbox.checked ? '1' : '0.35';
                });
            };
            app._markAllMaintSlot = function(headerCb) {
                const { dept, slot } = headerCb.dataset;
                document.querySelectorAll(`.maint-slot-enabled[data-dept="${dept}"][data-slot="${slot}"]`).forEach(cb => {
                    cb.checked = headerCb.checked;
                    app._toggleMaintSlotOpacity(cb);
                });
            };
            app.saveMaintSlotConfiguration = async function() {
                const inputs = document.querySelectorAll('.maint-slot-input');
                let savedCount = 0;

                // Gather live values first so we can check Slot A/B overlap per dept+block
                // before writing anything — maintenance only has Slots A-C, no D.
                const pending = {};
                inputs.forEach(input => {
                    const { dept, month, slot, field } = input.dataset;
                    if (!dept || !month || !slot || !field) return;
                    const bucketKey = `${dept}||${month}`;
                    if (!pending[bucketKey]) pending[bucketKey] = {};
                    if (!pending[bucketKey][slot]) pending[bucketKey][slot] = {};
                    if (field === 'enabled') pending[bucketKey][slot].enabled = input.checked;
                    else if (field === 'start') pending[bucketKey][slot].start = input.value;
                    else if (field === 'end') pending[bucketKey][slot].end = input.value;
                });

                const overlaps = [];
                Object.keys(pending).forEach(bucketKey => {
                    const [dept, month] = bucketKey.split('||');
                    const a = pending[bucketKey].SA, b = pending[bucketKey].SB;
                    if (!a || !b) return;
                    if (a.enabled === false || b.enabled === false) return;
                    if (!a.start || !a.end || !b.start || !b.end) return;
                    if (this.checkDateOverlap(a.start, a.end, b.start, b.end)) {
                        overlaps.push(`${dept} — ${this.blockLabel(month)}: Slot A (${a.start}→${a.end}) overlaps Slot B (${b.start}→${b.end})`);
                    }
                });

                if (overlaps.length > 0) {
                    const proceed = confirm(
                        `⚠️ ${overlaps.length} overlap(s) found — Slot A/B are meant to run back-to-back, not overlap:\n\n` +
                        overlaps.join('\n') +
                        `\n\nSave anyway? (Cancel to go back and fix the dates first.)`
                    );
                    if (!proceed) return;
                }

                inputs.forEach(input => {
                    const { dept, month, slot, field } = input.dataset;
                    let value;
                    if (field === 'capacity') {
                        value = parseInt(input.value);
                        if (isNaN(value) || value < 0) value = 0;
                    } else if (field === 'enabled') {
                        value = input.checked;
                    } else {
                        value = input.value;
                    }
                    if (dept && slot && field) {
                        const key = month ? `cal-maint-${dept}-${month}-${slot}-${field}` : `cal-maint-${dept}-${slot}-${field}`;
                        this.state.maintSlotCapacities[key] = value;
                        savedCount++;
                    }
                });
                await this.saveConfigToSupabase();
                alert(`✅ Maintenance slot configurations saved!\\n\\n• ${savedCount} fields saved.`);
                this.setActiveView('admin');
            };
            app.resetMaintDeptSlotsToDefault = async function(dept) {
                const prefix = `cal-maint-${dept}-`;
                const keysToRemove = Object.keys(this.state.maintSlotCapacities).filter(k => k.startsWith(prefix));

                if (keysToRemove.length === 0) {
                    alert(`No saved slot configuration found for "${dept}" — it's already showing default dates.`);
                    return;
                }

                if (!confirm(`Reset "${dept}" to default dates?\n\nThis will clear ${keysToRemove.length} saved field(s) (dates, capacities, on/off toggles) for all 12 months. This cannot be undone once saved.`)) {
                    return;
                }

                keysToRemove.forEach(k => delete this.state.maintSlotCapacities[k]);
                await this.saveConfigToSupabase();

                const area = document.getElementById('maintConfigArea');
                const filterVal = document.getElementById('maintDeptFilter')?.value || 'all';
                if (area) area.innerHTML = this.renderMaintDeptConfig(filterVal);

                alert(`✅ "${dept}" reset to default dates.`);
            };
            app.bulkImportMaintDeptSlots = async function(dept) {
                const ta = document.getElementById(`bulkImportMaint-${dept}`);
                const msgEl = document.getElementById(`bulkImportMaintMsg-${dept}`);
                if (!ta || !ta.value.trim()) {
                    if (msgEl) { msgEl.textContent = '⚠️ Paste some rows first.'; msgEl.className = 'text-xs self-center text-red-600'; }
                    return;
                }

                const ddmmyyyyToIso = (s) => {
                    s = (s || '').trim();
                    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                    if (!m) return null;
                    const [, d, mo, y] = m;
                    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
                };
                const toBool = (s) => ['1', 'true', 'yes', 'y', 'on'].includes((s || '').trim().toLowerCase());

                const lines = ta.value.split('\n').map(l => l.trim()).filter(Boolean);
                let rowsImported = 0, fieldsImported = 0;
                const errors = [];

                lines.forEach((line, idx) => {
                    const cols = line.includes('\t') ? line.split('\t') : line.split(',');
                    const cols_ = cols.map(c => c.trim());
                    if (cols_.length < 13) {
                        errors.push(`Row ${idx + 1}: expected 13 columns, found ${cols_.length}`);
                        return;
                    }
                    const [month, ...rest] = cols_;
                    if (!this.state.months.includes(month)) {
                        errors.push(`Row ${idx + 1}: "${month}" is not a valid month name`);
                        return;
                    }
                    const slots = ['SA', 'SB', 'SC'];
                    slots.forEach((slotId, si) => {
                        const [startRaw, endRaw, maxRaw, onRaw] = rest.slice(si * 4, si * 4 + 4);
                        const startIso = ddmmyyyyToIso(startRaw);
                        const endIso = ddmmyyyyToIso(endRaw);
                        if (startRaw && !startIso) { errors.push(`Row ${idx + 1} (${month} ${slotId}): bad start date "${startRaw}"`); return; }
                        if (endRaw && !endIso) { errors.push(`Row ${idx + 1} (${month} ${slotId}): bad end date "${endRaw}"`); return; }
                        if (startIso) { this.state.maintSlotCapacities[`cal-maint-${dept}-${month}-${slotId}-start`] = startIso; fieldsImported++; }
                        if (endIso) { this.state.maintSlotCapacities[`cal-maint-${dept}-${month}-${slotId}-end`] = endIso; fieldsImported++; }
                        if (maxRaw !== undefined && maxRaw !== '') { this.state.maintSlotCapacities[`cal-maint-${dept}-${month}-${slotId}-capacity`] = parseInt(maxRaw) || 0; fieldsImported++; }
                        this.state.maintSlotCapacities[`cal-maint-${dept}-${month}-${slotId}-enabled`] = toBool(onRaw);
                        fieldsImported++;
                    });
                    rowsImported++;
                });

                if (errors.length > 0) {
                    if (msgEl) { msgEl.textContent = `⚠️ ${errors.length} issue(s) — see console.`; msgEl.className = 'text-xs self-center text-red-600'; }
                    console.warn('Bulk import issues:', errors);
                    if (rowsImported === 0) return;
                }

                await this.saveConfigToSupabase();

                const area = document.getElementById('maintConfigArea');
                const filterVal = document.getElementById('maintDeptFilter')?.value || 'all';
                if (area) area.innerHTML = this.renderMaintDeptConfig(filterVal);

                if (msgEl) { msgEl.textContent = `✅ Imported ${rowsImported} month(s), ${fieldsImported} fields saved.`; msgEl.className = 'text-xs self-center text-green-700'; }
            };
            app.renderDeptConfig = function(filter) {
                const employeeDepts = [...new Set(this.state.employees.map(e => e.department || 'Unassigned'))];
                const allRawDepartments = [...new Set([...this.state.departments, ...employeeDepts])];
                const allDepartments = allRawDepartments.filter(d => /^(L3|L46|L5|L3465)[-\s]/i.test(d) || d === 'L3-SA' || d === 'L5 SA' || d === 'L3 SAMB' || d === 'L5 SAMB' || d === 'L46 SAMB').sort();
                
                let departmentsToConfigure = [];
                
                if (filter === 'all') {
                    departmentsToConfigure = allDepartments;
                } else {
                    departmentsToConfigure = [filter];
                }
                
                if (departmentsToConfigure.length === 0) {
                    return `
                        <div class="bg-yellow-50 border border-yellow-200 rounded p-6 text-center">
                            <p class="text-lg font-semibold">No departments found!</p>
                            <p class="mt-2">Please upload employee data first.</p>
                        </div>
                    `;
                }
                
                let html = '';
                
                if (filter === 'all') {
                    html += `
                        <div class="mb-6 p-4 bg-green-50 border border-green-300 rounded">
                            <h3 class="text-xl font-semibold text-green-800 mb-2">📅 Calendar Slot Configuration — All Departments</h3>
                            <p class="text-green-700">Configure specific date ranges for each bid slot period across ${departmentsToConfigure.length} departments.</p>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="mb-6 p-4 bg-blue-50 border border-blue-300 rounded">
                            <h3 class="text-xl font-semibold text-blue-800 mb-2">📅 Calendar Slot Configuration — ${filter}</h3>
                            <p class="text-blue-700">Configure specific date ranges for each bid slot period for this department.</p>
                        </div>
                    `;
                }
                
                html += `<div class="space-y-8">`;
                
                departmentsToConfigure.forEach(dept => {
                    const hasEmployees = employeeDepts.includes(dept);
                    const employeeCount = this.state.employees.filter(e => (e.department || 'Unassigned') === dept).length;
                    
                    // Calendar slots: Slot A, Slot B, Slot C, Slot D (date range based)
                    // A/B = staff with ≤5 years service · C/D = staff with >5 years service
                    const periods = [
                        { id: 'SA', label: 'Slot A', colorClass: 'green', borderColor: 'border-green-400', bgColor: 'bg-green-50' },
                        { id: 'SB', label: 'Slot B', colorClass: 'blue', borderColor: 'border-blue-400', bgColor: 'bg-blue-50' },
                        { id: 'SC', label: 'Slot C', colorClass: 'purple', borderColor: 'border-purple-400', bgColor: 'bg-purple-50' },
                        { id: 'SD', label: 'Slot D', colorClass: 'orange', borderColor: 'border-orange-400', bgColor: 'bg-orange-50' }
                    ];
                    
                    html += `
                        <details class="metro-dept-card" ${filter !== 'all' ? 'open' : ''}>
                            <summary class="metro-dept-summary">
                                <div style="display:flex;align-items:center;gap:12px;">
                                    <span class="metro-dept-caret">▶</span>
                                    <div>
                                        <h3 class="text-xl font-bold" style="font-family:'Barlow Condensed',sans-serif;margin:0;">${dept}</h3>
                                        <div class="flex gap-2 mt-1">
                                            ${hasEmployees ? 
                                                `<span class="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">${employeeCount} employees</span>` : 
                                                `<span class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">No employees</span>`
                                            }
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-3">
                                    <span class="text-sm text-gray-500">12-Block Slot Configuration</span>
                                    <button onclick="event.stopPropagation();event.preventDefault();app.resetDeptSlotsToDefault('${dept}')" class="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded hover:bg-gray-300" title="Clears saved dates/capacities/on-off for this department and restores the auto-computed default 30-day blocks">↺ Reset to Default Dates</button>
                                </div>
                            </summary>
                            <div class="px-4 pt-3">
                                <details class="bg-indigo-50 border border-indigo-200 rounded-lg">
                                    <summary onclick="event.stopPropagation()" class="cursor-pointer px-3 py-2 font-semibold text-indigo-800 text-sm">📋 Bulk Paste Import (paste all 12 months at once — from Excel or a saved template)</summary>
                                    <div class="p-3 pt-1">
                                        <p class="text-xs text-indigo-700 mb-2">
                                            One row per month, columns tab- or comma-separated, dates as DD/MM/YYYY, "on" as 1 or 0:<br>
                                            <code>Month, SA-Start, SA-End, SA-Max, SA-On, SB-Start, SB-End, SB-Max, SB-On, SC-Start, SC-End, SC-Max, SC-On, SD-Start, SD-End, SD-Max, SD-On</code>
                                        </p>
                                        <textarea id="bulkImport-${dept}" rows="4" placeholder="January\t01/01/2027\t15/01/2027\t4\t1\t16/01/2027\t30/01/2027\t4\t1\t01/01/2027\t15/01/2027\t1\t1\t16/01/2027\t04/02/2027\t1\t1"
                                            class="w-full text-xs font-mono border border-indigo-300 rounded p-2"></textarea>
                                        <div class="flex gap-2 mt-2">
                                            <button onclick="app.bulkImportDeptSlots('${dept}')" class="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700">Import &amp; Save</button>
                                            <span id="bulkImportMsg-${dept}" class="text-xs self-center"></span>
                                        </div>
                                    </div>
                                </details>
                            </div>
                            <div class="p-4 overflow-x-auto">
                                <table class="w-full text-sm border-collapse">
                                    <thead>
                                        <tr class="bg-gray-50">
                                            <th class="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Block</th>
                                            <th class="border border-gray-200 px-2 py-2 text-center font-semibold text-green-700 bg-green-50">
                                                <div class="flex flex-col items-center gap-1">
                                                    <span>A — On</span>
                                                    <label class="flex items-center gap-1 cursor-pointer" title="Toggle all Slot A months">
                                                        <input type="checkbox"
                                                            class="mark-all-checkbox w-3 h-3 accent-green-600"
                                                            data-dept="${dept}" data-slot="SA"
                                                            onchange="app._markAllSlot(this)"
                                                            title="Check/uncheck all Slot A months"
                                                        />
                                                        <span class="text-xs font-normal text-green-600">All</span>
                                                    </label>
                                                </div>
                                            </th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-green-700 bg-green-50">Slot A — Start</th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-green-700 bg-green-50">Slot A — End</th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-green-700 bg-green-50">Slot A — Max</th>
                                            <th class="border border-gray-200 px-2 py-2 text-center font-semibold text-blue-700 bg-blue-50">
                                                <div class="flex flex-col items-center gap-1">
                                                    <span>B — On</span>
                                                    <label class="flex items-center gap-1 cursor-pointer" title="Toggle all Slot B months">
                                                        <input type="checkbox"
                                                            class="mark-all-checkbox w-3 h-3 accent-blue-600"
                                                            data-dept="${dept}" data-slot="SB"
                                                            onchange="app._markAllSlot(this)"
                                                            title="Check/uncheck all Slot B months"
                                                        />
                                                        <span class="text-xs font-normal text-blue-600">All</span>
                                                    </label>
                                                </div>
                                            </th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-blue-700 bg-blue-50">Slot B — Start</th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-blue-700 bg-blue-50">Slot B — End</th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-blue-700 bg-blue-50">Slot B — Max</th>
                                            <th class="border border-gray-200 px-2 py-2 text-center font-semibold text-purple-700 bg-purple-50">
                                                <div class="flex flex-col items-center gap-1">
                                                    <span>C — On</span>
                                                    <label class="flex items-center gap-1 cursor-pointer" title="Toggle all Slot C months">
                                                        <input type="checkbox"
                                                            class="mark-all-checkbox w-3 h-3 accent-purple-600"
                                                            data-dept="${dept}" data-slot="SC"
                                                            onchange="app._markAllSlot(this)"
                                                            title="Check/uncheck all Slot C months"
                                                        />
                                                        <span class="text-xs font-normal text-purple-600">All</span>
                                                    </label>
                                                </div>
                                            </th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-purple-700 bg-purple-50">Slot C — Start</th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-purple-700 bg-purple-50">Slot C — End</th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-purple-700 bg-purple-50">Slot C — Max</th>
                                            <th class="border border-gray-200 px-2 py-2 text-center font-semibold text-orange-700 bg-orange-50">
                                                <div class="flex flex-col items-center gap-1">
                                                    <span>D — On</span>
                                                    <label class="flex items-center gap-1 cursor-pointer" title="Toggle all Slot D months">
                                                        <input type="checkbox"
                                                            class="mark-all-checkbox w-3 h-3 accent-orange-600"
                                                            data-dept="${dept}" data-slot="SD"
                                                            onchange="app._markAllSlot(this)"
                                                            title="Check/uncheck all Slot D months"
                                                        />
                                                        <span class="text-xs font-normal text-orange-600">All</span>
                                                    </label>
                                                </div>
                                            </th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-orange-700 bg-orange-50">Slot D — Start</th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-orange-700 bg-orange-50">Slot D — End</th>
                                            <th class="border border-gray-200 px-3 py-2 text-center font-semibold text-orange-700 bg-orange-50">Slot D — Max</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${this.state.months.map((month, monthIdx) => {
                                            const year = this.state.biddingYear;
                                            // Default dates follow the 360-day calendar (30-day blocks per month, Jan1=day1)
                                            const pad = n => String(n).padStart(2, '0');
                                            const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                                            const defaultStart = toDateStr(new Date(year, 0, monthIdx*30 + 1));
                                            const defaultEnd   = toDateStr(new Date(year, 0, (monthIdx+1)*30));
                                            return `
                                                <tr class="hover:bg-gray-50">
                                                    <td class="border border-gray-200 px-3 py-2 font-semibold text-gray-800 bg-gray-50 whitespace-nowrap">${this.blockLabel(month)}</td>
                                                    ${['SA','SB','SC','SD'].map((slotId, si) => {
                                                        const colors = ['border-green-300 focus:border-green-500','border-blue-300 focus:border-blue-500','border-purple-300 focus:border-purple-500','border-orange-300 focus:border-orange-500'];
                                                        const bgCols = ['bg-green-50','bg-blue-50','bg-purple-50','bg-orange-50'];
                                                        const savedStart    = this.state.slotCapacities[`cal-${dept}-${month}-${slotId}-start`];
                                                        const savedEnd      = this.state.slotCapacities[`cal-${dept}-${month}-${slotId}-end`];
                                                        const savedCapacity = this.state.slotCapacities[`cal-${dept}-${month}-${slotId}-capacity`];
                                                        const savedEnabled  = this.state.slotCapacities[`cal-${dept}-${month}-${slotId}-enabled`];
                                                        const startVal    = savedStart    !== undefined ? savedStart    : defaultStart;
                                                        const endVal      = savedEnd      !== undefined ? savedEnd      : defaultEnd;
                                                        const capacityVal = savedCapacity !== undefined ? savedCapacity : 1;
                                                        // enabled defaults to false (planner must explicitly turn on)
                                                        const enabledVal  = savedEnabled  !== undefined ? savedEnabled  : false;
                                                        const rowOpacity  = enabledVal ? '' : 'opacity-40';
                                                        return `
                                                            <td class="border border-gray-200 px-1 py-1 ${bgCols[si]} text-center">
                                                                <input type="checkbox"
                                                                    data-dept="${dept}" data-month="${month}" data-slot="${slotId}" data-field="enabled"
                                                                    class="cal-slot-input cal-slot-enabled w-4 h-4 accent-current cursor-pointer"
                                                                    ${enabledVal ? 'checked' : ''}
                                                                    onchange="app._toggleSlotRowOpacity(this)"
                                                                    title="Enable Slot ${slotId.replace('S','')} for ${this.blockLabel(month)}"
                                                                />
                                                            </td>
                                                            <td class="border border-gray-200 px-1 py-1 ${bgCols[si]} ${rowOpacity}">
                                                                <input type="date"
                                                                    data-dept="${dept}" data-month="${month}" data-slot="${slotId}" data-field="start"
                                                                    class="cal-slot-input w-full px-1 py-1 border ${colors[si]} rounded text-xs"
                                                                    min="${year}-01-01" max="${year}-12-31"
                                                                    value="${startVal}"
                                                                />
                                                            </td>
                                                            <td class="border border-gray-200 px-1 py-1 ${bgCols[si]} ${rowOpacity}">
                                                                <input type="date"
                                                                    data-dept="${dept}" data-month="${month}" data-slot="${slotId}" data-field="end"
                                                                    class="cal-slot-input w-full px-1 py-1 border ${colors[si]} rounded text-xs"
                                                                    min="${year}-01-01" max="${year}-12-31"
                                                                    value="${endVal}"
                                                                />
                                                            </td>
                                                            <td class="border border-gray-200 px-1 py-1 ${bgCols[si]} ${rowOpacity}">
                                                                <input type="number" min="0" max="200"
                                                                    data-dept="${dept}" data-month="${month}" data-slot="${slotId}" data-field="capacity"
                                                                    class="cal-slot-input slot-input w-full px-1 py-1 border ${colors[si]} rounded text-center text-xs"
                                                                    placeholder="1"
                                                                    value="${capacityVal}"
                                                                />
                                                            </td>
                                                        `;
                                                    }).join('')}
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </details>
                    `;
                });
                
                html += `</div>`;
                
                html += `
                    <div class="mt-8">
                        <div class="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
                            <p class="font-semibold text-yellow-800 mb-2">📋 Calendar Configuration Summary:</p>
                            <p class="text-sm text-yellow-700">
                                • Departments: ${departmentsToConfigure.length} department${departmentsToConfigure.length === 1 ? '' : 's'}<br>
                                • Bid slots per department: 4 (Slot A, Slot B, Slot C, Slot D) × 12 months<br>
                                • Slot A &amp; B are visible to staff with ≤5 years of service<br>
                                • Slot C &amp; D are visible to staff with &gt;5 years of service<br>
                                • Toggle <strong>On</strong> to make a slot visible to Operations Staff for that month<br>
                                • Each enabled slot: fixed date range and max capacity seen by staff when bidding<br>
                                • Total configurations: ${departmentsToConfigure.length * 4} bid slots × 12 months
                            </p>
                        </div>
                        
                        <div class="flex gap-3">
                            <button onclick="app.saveSlotConfiguration()" class="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">
                                💾 Save All Slot Configurations
                            </button>
                            <button onclick="app.setActiveView('upload')" class="px-6 py-3 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600">
                                ← Back
                            </button>
                        </div>
                    </div>
                `;
                
                return html;
            };
            app.copyToAllMonths = async function() {
                const filter = document.getElementById('deptFilter')?.value || 'all';
                const employeeDepts = [...new Set(this.state.employees.map(e => e.department || 'Unassigned'))];
                const allDepartments = [...new Set([...this.state.departments, ...employeeDepts])].sort();
                
                let departmentsToCopy = [];
                if (filter === 'all') {
                    departmentsToCopy = allDepartments;
                } else {
                    departmentsToCopy = [filter];
                }
                
                // Get January values for each department and slot
                const januaryValues = {};
                
                departmentsToCopy.forEach(dept => {
                    ['A', 'B', 'C', 'D'].forEach(slot => {
                        const key = `January-${dept}-${slot}`;
                        januaryValues[`${dept}-${slot}`] = this.state.slotCapacities[key] || 1;
                    });
                });
                
                // Apply to all months
                this.state.months.forEach(month => {
                    if (month === 'January') return; // Skip January since it's our source
                    
                    departmentsToCopy.forEach(dept => {
                        ['A', 'B', 'C', 'D'].forEach(slot => {
                            const key = `${month}-${dept}-${slot}`;
                            this.state.slotCapacities[key] = januaryValues[`${dept}-${slot}`];
                        });
                    });
                });
                
                // Update the UI
                const filterVal = document.getElementById('deptFilter')?.value || 'all';
                const configArea = document.getElementById('configArea');
                if (configArea) {
                    configArea.innerHTML = this.renderDeptConfig(filterVal);
                }
                
                await this.saveConfigToSupabase();
            };
            app.resetDeptSlotsToDefault = async function(dept) {
                const prefix = `cal-${dept}-`;
                const keysToRemove = Object.keys(this.state.slotCapacities).filter(k => k.startsWith(prefix));

                if (keysToRemove.length === 0) {
                    alert(`No saved slot configuration found for "${dept}" — it's already showing default dates.`);
                    return;
                }

                if (!confirm(`Reset "${dept}" to default dates?\n\nThis will clear ${keysToRemove.length} saved field(s) (dates, capacities, on/off toggles) for all 12 months. This cannot be undone once saved.`)) {
                    return;
                }

                keysToRemove.forEach(k => delete this.state.slotCapacities[k]);
                await this.saveConfigToSupabase();

                const filterVal = document.getElementById('deptFilter')?.value || 'all';
                const configArea = document.getElementById('configArea');
                if (configArea) configArea.innerHTML = this.renderDeptConfig(filterVal);

                alert(`✅ "${dept}" reset to default dates.`);
            };
            app.bulkImportDeptSlots = async function(dept) {
                const ta = document.getElementById(`bulkImport-${dept}`);
                const msgEl = document.getElementById(`bulkImportMsg-${dept}`);
                if (!ta || !ta.value.trim()) {
                    if (msgEl) { msgEl.textContent = '⚠️ Paste some rows first.'; msgEl.className = 'text-xs self-center text-red-600'; }
                    return;
                }

                const ddmmyyyyToIso = (s) => {
                    s = (s || '').trim();
                    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                    if (!m) return null;
                    const [, d, mo, y] = m;
                    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
                };
                const toBool = (s) => ['1', 'true', 'yes', 'y', 'on'].includes((s || '').trim().toLowerCase());

                const lines = ta.value.split('\n').map(l => l.trim()).filter(Boolean);
                let rowsImported = 0, fieldsImported = 0;
                const errors = [];

                lines.forEach((line, idx) => {
                    const cols = line.includes('\t') ? line.split('\t') : line.split(',');
                    const cols_ = cols.map(c => c.trim());
                    if (cols_.length < 17) {
                        errors.push(`Row ${idx + 1}: expected 17 columns, found ${cols_.length}`);
                        return;
                    }
                    const [month, ...rest] = cols_;
                    if (!this.state.months.includes(month)) {
                        errors.push(`Row ${idx + 1}: "${month}" is not a valid month name`);
                        return;
                    }
                    const slots = ['SA', 'SB', 'SC', 'SD'];
                    slots.forEach((slotId, si) => {
                        const [startRaw, endRaw, maxRaw, onRaw] = rest.slice(si * 4, si * 4 + 4);
                        const startIso = ddmmyyyyToIso(startRaw);
                        const endIso = ddmmyyyyToIso(endRaw);
                        if (startRaw && !startIso) { errors.push(`Row ${idx + 1} (${month} ${slotId}): bad start date "${startRaw}"`); return; }
                        if (endRaw && !endIso) { errors.push(`Row ${idx + 1} (${month} ${slotId}): bad end date "${endRaw}"`); return; }
                        if (startIso) { this.state.slotCapacities[`cal-${dept}-${month}-${slotId}-start`] = startIso; fieldsImported++; }
                        if (endIso) { this.state.slotCapacities[`cal-${dept}-${month}-${slotId}-end`] = endIso; fieldsImported++; }
                        if (maxRaw !== undefined && maxRaw !== '') { this.state.slotCapacities[`cal-${dept}-${month}-${slotId}-capacity`] = parseInt(maxRaw) || 0; fieldsImported++; }
                        this.state.slotCapacities[`cal-${dept}-${month}-${slotId}-enabled`] = toBool(onRaw);
                        fieldsImported++;
                    });
                    rowsImported++;
                });

                if (errors.length > 0) {
                    if (msgEl) { msgEl.textContent = `⚠️ ${errors.length} issue(s) — see console.`; msgEl.className = 'text-xs self-center text-red-600'; }
                    console.warn('Bulk import issues:', errors);
                    if (rowsImported === 0) return; // nothing usable was imported
                }

                await this.saveConfigToSupabase();

                const filterVal = document.getElementById('deptFilter')?.value || 'all';
                const configArea = document.getElementById('configArea');
                if (configArea) configArea.innerHTML = this.renderDeptConfig(filterVal);

                if (msgEl) { msgEl.textContent = `✅ Imported ${rowsImported} month(s), ${fieldsImported} fields saved.`; msgEl.className = 'text-xs self-center text-green-700'; }
            };
            app.saveSlotConfiguration = async function() {
                // Save calendar-based slot inputs (new format: cal-dept-month-slotId-field)
                const calInputs = document.querySelectorAll('.cal-slot-input');
                let savedCount = 0;

                // First pass: gather every input's live value (not yet written to state)
                // so we can validate A-vs-B and C-vs-D overlap per dept+block BEFORE saving.
                const pending = {}; // `${dept}||${month}` -> { SA:{start,end,enabled}, SB:{...}, SC:{...}, SD:{...} }
                calInputs.forEach(input => {
                    const dept = input.dataset.dept;
                    const month = input.dataset.month;
                    const slot = input.dataset.slot;
                    const field = input.dataset.field;
                    if (!dept || !month || !slot || !field) return;
                    const bucketKey = `${dept}||${month}`;
                    if (!pending[bucketKey]) pending[bucketKey] = {};
                    if (!pending[bucketKey][slot]) pending[bucketKey][slot] = {};
                    if (field === 'enabled') pending[bucketKey][slot].enabled = input.checked;
                    else if (field === 'start') pending[bucketKey][slot].start = input.value;
                    else if (field === 'end') pending[bucketKey][slot].end = input.value;
                });

                const overlaps = [];
                const pairsToCheck = [['SA', 'SB'], ['SC', 'SD']];
                Object.keys(pending).forEach(bucketKey => {
                    const [dept, month] = bucketKey.split('||');
                    const slots = pending[bucketKey];
                    pairsToCheck.forEach(([s1, s2]) => {
                        const a = slots[s1], b = slots[s2];
                        if (!a || !b) return;
                        if (a.enabled === false || b.enabled === false) return; // one side is off — no real conflict
                        if (!a.start || !a.end || !b.start || !b.end) return;
                        if (this.checkDateOverlap(a.start, a.end, b.start, b.end)) {
                            overlaps.push(`${dept} — ${this.blockLabel(month)}: Slot ${s1.slice(1)} (${a.start}→${a.end}) overlaps Slot ${s2.slice(1)} (${b.start}→${b.end})`);
                        }
                    });
                });

                if (overlaps.length > 0) {
                    const proceed = confirm(
                        `⚠️ ${overlaps.length} overlap(s) found — Slot A/B and Slot C/D are meant to run back-to-back, not overlap:\n\n` +
                        overlaps.join('\n') +
                        `\n\nSave anyway? (Cancel to go back and fix the dates first.)`
                    );
                    if (!proceed) return;
                }

                calInputs.forEach(input => {
                    const dept = input.dataset.dept;
                    const month = input.dataset.month;
                    const slot = input.dataset.slot;
                    const field = input.dataset.field;
                    let value;
                    if (field === 'capacity') {
                        value = parseInt(input.value);
                        if (isNaN(value) || value < 0) value = 0; // clamp invalid/negative to 0
                    } else if (field === 'enabled') {
                        value = input.checked; // boolean
                    } else {
                        value = input.value;
                    }
                    
                    if (dept && slot && field) {
                        const key = month 
                            ? `cal-${dept}-${month}-${slot}-${field}` 
                            : `cal-${dept}-${slot}-${field}`;
                        this.state.slotCapacities[key] = value;
                        savedCount++;
                    }
                });
                
                await this.saveConfigToSupabase();
                // Also push slot config to Supabase so other browsers get it
                if (this.supabase) {
                    // saveConfigToSupabase above already handles this — no duplicate upsert needed
                }
                
                alert(`✅ Slot configurations saved!\n\n• ${savedCount} fields saved.\n• Each department now has Slot A, B, C configured per block (Block 1–12).`);
                
                this.setActiveView('admin');
            };
            app._toggleSlotRowOpacity = function(checkbox) {
                const row = checkbox.closest('tr');
                if (!row) return;
                const dept  = checkbox.dataset.dept;
                const month = checkbox.dataset.month;
                const slot  = checkbox.dataset.slot;
                // Dims/undims the date+capacity cells for this slot in this row
                row.querySelectorAll(`input[data-dept="${dept}"][data-month="${month}"][data-slot="${slot}"]:not([data-field="enabled"])`).forEach(inp => {
                    inp.closest('td').style.opacity = checkbox.checked ? '1' : '0.35';
                });
                // Keep the "All" header checkbox in sync
                this._syncMarkAllState(dept, slot);
            };
            app._markAllSlot = function(masterCheckbox) {
                const dept    = masterCheckbox.dataset.dept;
                const slot    = masterCheckbox.dataset.slot;
                const checked = masterCheckbox.checked;
                const table   = masterCheckbox.closest('table');
                if (!table) return;
                table.querySelectorAll(
                    `input.cal-slot-enabled[data-dept="${dept}"][data-slot="${slot}"]`
                ).forEach(cb => {
                    if (cb.checked !== checked) {
                        cb.checked = checked;
                        this._toggleSlotRowOpacity(cb);
                    }
                });
                // Ensure master is not left indeterminate after clicking
                masterCheckbox.indeterminate = false;
                masterCheckbox.checked = checked;
            };
            app._syncMarkAllState = function(dept, slot) {
                const masterCbs = document.querySelectorAll(
                    `input.mark-all-checkbox[data-dept="${dept}"][data-slot="${slot}"]`
                );
                masterCbs.forEach(masterCb => {
                    const table = masterCb.closest('table');
                    if (!table) return;
                    const allMonthCbs  = [...table.querySelectorAll(
                        `input.cal-slot-enabled[data-dept="${dept}"][data-slot="${slot}"]`
                    )];
                    const checkedCount = allMonthCbs.filter(cb => cb.checked).length;
                    if (checkedCount === 0) {
                        masterCb.indeterminate = false;
                        masterCb.checked       = false;
                    } else if (checkedCount === allMonthCbs.length) {
                        masterCb.indeterminate = false;
                        masterCb.checked       = true;
                    } else {
                        masterCb.indeterminate = true;
                    }
                });
            };
