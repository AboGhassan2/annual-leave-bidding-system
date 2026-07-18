// ════════════════════════════════════════════════════════════════════
// views-reports.js — Seniority Report, Audit Log, and the Bid
// Allocation Justification Report.
//
// Attaches onto the shared `app` object, must load AFTER app.js and
// after utils.js (uses this._ordinal(), this._escHtml()) and
// api-supabase.js (writeAuditLog writes to the audit_logs table).
//
// Covers: renderSeniorityReportView and its filter/export; the full
// Justification Report pipeline (_buildJustificationRowsForResults
// through exportJustificationReport — see the original design notes
// inline below, unchanged from when this was first built); and the
// Audit Log (writeAuditLog, renderAuditLogView, filterAuditLog,
// clearAuditLog).
// ════════════════════════════════════════════════════════════════════

            app.renderSeniorityReportView = function() {
                const content = document.getElementById('contentArea');

                const calcYears = (seniorityDate) => {
                    if (!seniorityDate) return 0;
                    const joinDate = new Date(seniorityDate);
                    if (isNaN(joinDate.getTime())) return 0;
                    return (new Date() - joinDate) / (1000 * 60 * 60 * 24 * 365.25);
                };

                // OPS staff = this.state.employees, plus Maintenance staff from the
                // separate maintenanceStaffUsers array (tagged with isMaintenance for filtering/export)
                const opsRows = (this.state.employees || []).map(e => {
                    const years = calcYears(e.seniorityDate);
                    return {
                        id: e.id,
                        name: e.name || '—',
                        department: e.department || 'Unassigned',
                        position: e.position || '—',
                        seniorityDate: e.seniorityDate || '',
                        years,
                        eligibleSlots: years > 5 ? 'Slot C / Slot D' : 'Slot A / Slot B',
                        isMaintenance: false
                    };
                });

                const maintRows = (this.state.maintenanceStaffUsers || []).map(e => {
                    const years = calcYears(e.seniorityDate);
                    return {
                        id: e.id,
                        name: e.name || '—',
                        department: e.department || 'Maintenance',
                        position: e.position || '—',
                        seniorityDate: e.seniorityDate || '',
                        years,
                        eligibleSlots: years > 5 ? 'Slot C / Slot D' : 'Slot A / Slot B',
                        isMaintenance: true
                    };
                });

                const rows = [...opsRows, ...maintRows];

                // Sort: most senior (earliest date) first
                rows.sort((a, b) => {
                    const da = a.seniorityDate ? new Date(a.seniorityDate) : new Date('9999-12-31');
                    const db = b.seniorityDate ? new Date(b.seniorityDate) : new Date('9999-12-31');
                    return da - db;
                });

                const seniorCount = rows.filter(r => r.years > 5).length;
                const juniorCount = rows.length - seniorCount;
                const missingCount = rows.filter(r => !r.seniorityDate).length;

                // Filters
                const deptOptions = [...new Set(rows.map(r => r.department))].sort();

                content.innerHTML = `
                    <div class="max-w-7xl mx-auto">
                        <div class="metro-card p-6 mb-6">
                            <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
                                <div>
                                    <h2 class="text-2xl font-bold" style="font-family:'Barlow Condensed',sans-serif;color:var(--app-text);">📋 Seniority Date Report</h2>
                                    <p class="text-sm mt-1" style="color:var(--app-text-muted);">All Operations Staff and Maintenance Staff</p>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="app.exportSeniorityReportCSV()" class="metro-tab metro-tab-primary">
                                        ⬇ Export Excel
                                    </button>
                                    <button onclick="app.setActiveView('dashboard')" class="metro-tab">
                                        ← Back
                                    </button>
                                </div>
                            </div>

                            <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                                <div class="p-4 rounded-lg" style="background:var(--app-green-50);">
                                    <p class="text-2xl font-bold" style="color:var(--app-text);">${rows.length}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Total Staff</p>
                                </div>
                                <div class="bg-blue-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold text-blue-700">${rows.filter(r => r.isMaintenance).length}</p>
                                    <p class="text-sm text-gray-600">Maintenance Staff</p>
                                </div>
                                <div class="bg-orange-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold text-orange-700">${seniorCount}</p>
                                    <p class="text-sm text-gray-600">&gt;5 yrs — Slot C/D</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background:var(--app-green-50);">
                                    <p class="text-2xl font-bold" style="color:var(--metro-green-dark);">${juniorCount}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">≤5 yrs — Slot A/B</p>
                                </div>
                                <div class="bg-red-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold text-red-700">${missingCount}</p>
                                    <p class="text-sm text-gray-600">Missing Seniority Date</p>
                                </div>
                            </div>

                            <div class="flex flex-wrap gap-3 mb-4">
                                <input type="text" id="seniorityReportSearch" placeholder="Search by name or ID…"
                                    oninput="app._filterSeniorityReport()"
                                    class="px-3 py-2 border-2 rounded-lg text-sm flex-1 min-w-[200px]" style="border-color:var(--app-border);" />
                                <select id="seniorityReportDeptFilter" onchange="app._filterSeniorityReport()" class="px-3 py-2 border-2 rounded-lg text-sm" style="border-color:var(--app-border);">
                                    <option value="all">All Departments</option>
                                    ${deptOptions.map(d => `<option value="${this._escHtml(d)}">${this._escHtml(d)}</option>`).join('')}
                                </select>
                                <select id="seniorityReportEligFilter" onchange="app._filterSeniorityReport()" class="px-3 py-2 border-2 rounded-lg text-sm" style="border-color:var(--app-border);">
                                    <option value="all">All Eligibility</option>
                                    <option value="senior">&gt;5 yrs — Slot C/D</option>
                                    <option value="junior">≤5 yrs — Slot A/B</option>
                                </select>
                                <select id="seniorityReportTypeFilter" onchange="app._filterSeniorityReport()" class="px-3 py-2 border-2 rounded-lg text-sm" style="border-color:var(--app-border);">
                                    <option value="all">All Staff Types</option>
                                    <option value="ops">Operations Staff</option>
                                    <option value="maintenance">Maintenance Staff</option>
                                </select>
                            </div>

                            <div class="overflow-x-auto" style="border:1px solid var(--app-border);border-radius:10px;">
                                <table class="metro-table" id="seniorityReportTable">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Staff ID</th>
                                            <th>Name</th>
                                            <th>Department</th>
                                            <th>Position</th>
                                            <th>Type</th>
                                            <th>Seniority Date</th>
                                            <th>Years of Service</th>
                                            <th>Eligible Slots</th>
                                        </tr>
                                    </thead>
                                    <tbody id="seniorityReportBody">
                                        ${rows.map((r, idx) => this._seniorityReportRow(r, idx)).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <p class="text-xs mt-3" style="color:var(--app-text-muted);">Showing <span id="seniorityReportCount">${rows.length}</span> of ${rows.length} staff. Sorted by seniority date (most senior first).</p>
                        </div>
                    </div>
                `;

                // Cache rows on window for the filter/export functions to reuse without re-deriving
                window._seniorityReportRows = rows;
            };

            app._seniorityReportRow = function(r, idx) {
                const badgeClass = r.years > 5 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800';
                const missingStyle = !r.seniorityDate ? 'background:#fef2f2;' : '';
                return `
                    <tr style="${missingStyle}" data-dept="${this._escHtml(r.department)}" data-elig="${r.years > 5 ? 'senior' : 'junior'}" data-type="${r.isMaintenance ? 'maintenance' : 'ops'}" data-search="${this._escHtml((r.name + ' ' + r.id).toLowerCase())}">
                        <td style="text-align:center;color:var(--app-text-muted);">${idx + 1}</td>
                        <td style="font-family:monospace;font-size:0.8rem;">${this._escHtml(r.id)}</td>
                        <td style="font-weight:600;">${this._escHtml(r.name)}</td>
                        <td>${this._escHtml(r.department)}</td>
                        <td>${this._escHtml(r.position)}</td>
                        <td>${r.isMaintenance ? '<span class="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">Maintenance</span>' : '<span class="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700">Operations</span>'}</td>
                        <td>${r.seniorityDate ? this._escHtml(r.seniorityDate.slice(0,10)) : '<span class="text-red-500 font-semibold">Missing</span>'}</td>
                        <td style="text-align:center;font-weight:600;">${r.years.toFixed(1)}</td>
                        <td><span class="px-2 py-1 rounded text-xs font-semibold ${badgeClass}">${r.eligibleSlots}</span></td>
                    </tr>`;
            };

            app._filterSeniorityReport = function() {
                const q = (document.getElementById('seniorityReportSearch')?.value || '').toLowerCase().trim();
                const dept = document.getElementById('seniorityReportDeptFilter')?.value || 'all';
                const elig = document.getElementById('seniorityReportEligFilter')?.value || 'all';
                const type = document.getElementById('seniorityReportTypeFilter')?.value || 'all';
                const rowsEls = document.querySelectorAll('#seniorityReportBody tr');
                let visible = 0;
                rowsEls.forEach(tr => {
                    const matchesQ    = !q || (tr.dataset.search || '').includes(q);
                    const matchesDept = dept === 'all' || tr.dataset.dept === dept;
                    const matchesElig = elig === 'all' || tr.dataset.elig === elig;
                    const matchesType = type === 'all' || tr.dataset.type === type;
                    const show = matchesQ && matchesDept && matchesElig && matchesType;
                    tr.style.display = show ? '' : 'none';
                    if (show) visible++;
                });
                const countEl = document.getElementById('seniorityReportCount');
                if (countEl) countEl.textContent = visible;
            };

            app.exportSeniorityReportCSV = function() {
                const rows = window._seniorityReportRows || [];
                if (rows.length === 0) {
                    alert('No staff data to export.');
                    return;
                }
                const wsData = [
                    ['Staff ID', 'Name', 'Department', 'Position', 'Staff Type', 'Seniority Date', 'Years of Service', 'Eligible Slots']
                ];
                rows.forEach(r => {
                    wsData.push([
                        r.id, r.name, r.department, r.position,
                        r.isMaintenance ? 'Maintenance' : 'Operations',
                        r.seniorityDate ? r.seniorityDate.slice(0, 10) : 'Missing',
                        r.years.toFixed(1),
                        r.eligibleSlots
                    ]);
                });
                const ws = XLSX.utils.aoa_to_sheet(wsData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Seniority Report');
                XLSX.writeFile(wb, `Seniority_Report_${this.state.biddingYear}.xlsx`);
            };

            app._buildJustificationRowsForResults = function(results, groupField, category) {
                if (!results || results.length === 0) return [];

                // Employee's own submitted bids, in the order they were submitted
                // (earliest timestamp = 1st choice, next = 2nd choice, ...).
                const bidsByEmp = {};
                (this.state.bids || []).forEach(b => {
                    if (!bidsByEmp[b.employeeId]) bidsByEmp[b.employeeId] = [];
                    bidsByEmp[b.employeeId].push(b);
                });
                Object.keys(bidsByEmp).forEach(id => {
                    bidsByEmp[id].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
                });

                const slotLetter = (slotType) => (slotType || '').slice(-1).toUpperCase();

                // key = groupValue||month||slotLetter → every "Bid Awarded" winner of that key
                const winnersByKey = {};
                results.filter(r => r.type === 'Bid Awarded').forEach(r => {
                    const key = `${r[groupField] || ''}||${r.month || ''}||${slotLetter(r.slotType)}`;
                    if (!winnersByKey[key]) winnersByKey[key] = [];
                    winnersByKey[key].push({
                        employeeId: r.employeeId,
                        employeeName: r.employeeName,
                        seniorityRank: r.seniorityRank
                    });
                });

                // Resolve the group key (dept or position) a bid belongs to, mirroring
                // how the allocation engine itself resolves it at award time.
                const bidGroupValue = (bid, empGroupValue) => bid.department || empGroupValue || 'Unassigned';
                const bidKey = (bid, empGroupValue) => {
                    const month = bid.month || (bid.startDate ? this.state.months[new Date(bid.startDate).getMonth()] : '');
                    return `${bidGroupValue(bid, empGroupValue)}||${month}||${slotLetter(bid.slotType)}`;
                };

                const resultsByEmp = {};
                results.forEach(r => {
                    if (!resultsByEmp[r.employeeId]) resultsByEmp[r.employeeId] = [];
                    resultsByEmp[r.employeeId].push(r);
                });

                const rows = [];
                Object.keys(resultsByEmp).forEach(empId => {
                    const empResults = resultsByEmp[empId].slice().sort((a, b) => (a.slotOrder || 0) - (b.slotOrder || 0));
                    const myBids = bidsByEmp[empId] || [];
                    const empGroupValue = empResults[0]?.[groupField] || '';

                    empResults.forEach(r => {
                        let awardStatus, justification;

                        if (r.type === 'Bid Awarded') {
                            // Which of the employee's own submitted bids does this match?
                            let matchIdx = myBids.findIndex(b => b.startDate === r.startDate && b.endDate === r.endDate);
                            if (matchIdx === -1) {
                                const rKey = `${r[groupField] || ''}||${r.month || ''}||${slotLetter(r.slotType)}`;
                                matchIdx = myBids.findIndex(b => bidKey(b, empGroupValue) === rKey);
                            }
                            const choiceNum = matchIdx >= 0 ? matchIdx + 1 : (r.bidChoice || 1);
                            awardStatus = `${this._ordinal(choiceNum)} Choice`;

                            if (choiceNum === 1) {
                                justification = `Employee was awarded their first-choice slot based on seniority.`;
                            } else {
                                const lostOrdinals = [];
                                let firstLosersWinnerName = '';
                                for (let i = 0; i < choiceNum - 1; i++) {
                                    const lostBid = myBids[i];
                                    if (!lostBid) continue;
                                    lostOrdinals.push(this._ordinal(i + 1));
                                    if (!firstLosersWinnerName) {
                                        const key = bidKey(lostBid, empGroupValue);
                                        const winners = (winnersByKey[key] || []).filter(w => w.employeeId !== empId);
                                        if (winners.length) {
                                            winners.sort((a, b) => (a.seniorityRank ?? 999) - (b.seniorityRank ?? 999));
                                            firstLosersWinnerName = `${winners[0].employeeName} (${winners[0].employeeId})`;
                                        }
                                    }
                                }
                                if (choiceNum === 2 && lostOrdinals.length === 1) {
                                    justification = firstLosersWinnerName
                                        ? `Employee's first-choice slot was awarded to ${firstLosersWinnerName}, who has a higher seniority ranking. The employee was awarded their 2nd choice.`
                                        : `Employee's first-choice slot was no longer available by the time it was processed. The employee was awarded their 2nd choice.`;
                                } else {
                                    justification = `Employee's ${lostOrdinals.join(' and ')} choices were awarded to higher-seniority employees. The employee was awarded their ${this._ordinal(choiceNum)} choice.`;
                                }
                            }
                        } else {
                            // Auto-Assigned
                            if (myBids.length === 0) {
                                awardStatus = 'No Bid Submitted';
                                justification = 'Employee did not submit any bid. A leftover slot was assigned after all bidding employees had been processed.';
                            } else {
                                awardStatus = 'Leftover Slot';
                                justification = "None of the employee's selected choices were available after seniority allocation. The employee was assigned the best available remaining slot.";
                            }
                        }

                        rows.push({
                            category,
                            employeeId: empId,
                            employeeName: r.employeeName,
                            position: r.position || '',
                            department: groupField === 'department' ? (r.department || '') : (r.department || r.position || ''),
                            seniorityRank: r.seniorityRank,
                            slotOrder: r.slotOrder,
                            totalEmployeeSlots: r.totalEmployeeSlots || 2,
                            awardedSlot: `${r.slotName || ''} — ${this.blockLabel ? this.blockLabel(r.month) : (r.month || '')} ${r.startDate || ''} → ${r.endDate || ''} (${r.days || 0}d)`,
                            awardStatus,
                            justification
                        });
                    });
                });

                return rows;
            };

            app.buildJustificationReport = function() {
                const opsRows  = this._buildJustificationRowsForResults(this.state.results || [], 'department', 'Ops');
                const maintRows = this._buildJustificationRowsForResults(this.state.maintResults || [], 'position', 'Maintenance');
                const rows = [...opsRows, ...maintRows];
                rows.sort((a, b) =>
                    (a.category || '').localeCompare(b.category) ||
                    (a.department || '').localeCompare(b.department || '') ||
                    (a.position || '').localeCompare(b.position || '') ||
                    (a.seniorityRank || 0) - (b.seniorityRank || 0) ||
                    (a.slotOrder || 0) - (b.slotOrder || 0)
                );
                return rows;
            };

            app.renderJustificationReport = function() {
                if (!this.state.isProcessed && !this.state.isMaintProcessed) {
                    alert('No results yet — process Ops or Maintenance bids first.');
                    return;
                }
                this._justificationRows = this.buildJustificationReport();
                if (this._justificationRows.length === 0) {
                    alert('No awarded slots found to report on yet.');
                    return;
                }
                const catSel = document.getElementById('jrCategoryFilter');
                if (catSel) catSel.value = 'all';
                const searchEl = document.getElementById('jrSearch');
                if (searchEl) searchEl.value = '';
                this._filterJustificationReport();
                document.getElementById('justificationReportModal').style.display = 'flex';
            };

            app._filterJustificationReport = function() {
                const rows = this._justificationRows || [];
                const category = document.getElementById('jrCategoryFilter')?.value || 'all';
                const search = (document.getElementById('jrSearch')?.value || '').toLowerCase().trim();

                const filtered = rows.filter(r => {
                    if (category !== 'all' && r.category !== category) return false;
                    if (search && !String(r.employeeName || '').toLowerCase().includes(search) && !String(r.employeeId || '').toLowerCase().includes(search)) return false;
                    return true;
                });

                const esc = this._escHtml.bind(this);
                const statusColors = {
                    '1st Choice': 'bg-green-100 text-green-800',
                    '2nd Choice': 'bg-blue-100 text-blue-800',
                    '3rd Choice': 'bg-indigo-100 text-indigo-800',
                    'Leftover Slot': 'bg-orange-100 text-orange-800',
                    'No Bid Submitted': 'bg-gray-200 text-gray-700'
                };

                const body = document.getElementById('justificationReportBody');
                if (!body) return;

                if (filtered.length === 0) {
                    body.innerHTML = `<div style="text-align:center;padding:40px 0;color:#9ca3af;">No matching entries.</div>`;
                    return;
                }

                body.innerHTML = `
                    <p style="font-size:0.75rem;color:#6b7280;margin-bottom:10px;">${filtered.length} slot(s) shown</p>
                    <div style="overflow-x:auto;border:1px solid #e5e7eb;border-radius:10px;">
                        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
                            <thead>
                                <tr style="background:#fafafa;text-align:left;color:#6b7280;font-size:0.68rem;text-transform:uppercase;">
                                    <th style="padding:8px 10px;">Employee</th>
                                    <th style="padding:8px 10px;">Position</th>
                                    <th style="padding:8px 10px;">Department</th>
                                    <th style="padding:8px 10px;">Seniority&nbsp;Rank</th>
                                    <th style="padding:8px 10px;">Slot</th>
                                    <th style="padding:8px 10px;">Awarded Slot</th>
                                    <th style="padding:8px 10px;">Status</th>
                                    <th style="padding:8px 10px;">Justification</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filtered.map(r => `
                                    <tr style="border-top:1px solid #f0f0f0;">
                                        <td style="padding:8px 10px;">
                                            <p style="font-weight:600;">${esc(r.employeeName)}</p>
                                            <p style="font-size:0.7rem;color:#9ca3af;">${esc(r.employeeId)} · ${esc(r.category)}</p>
                                        </td>
                                        <td style="padding:8px 10px;">${esc(r.position)}</td>
                                        <td style="padding:8px 10px;">${esc(r.department)}</td>
                                        <td style="padding:8px 10px;text-align:center;">#${esc(r.seniorityRank)}</td>
                                        <td style="padding:8px 10px;text-align:center;">${r.slotOrder} of ${r.totalEmployeeSlots}</td>
                                        <td style="padding:8px 10px;">${esc(r.awardedSlot)}</td>
                                        <td style="padding:8px 10px;"><span class="px-2 py-1 rounded-full text-xs font-bold ${statusColors[r.awardStatus] || 'bg-gray-100 text-gray-700'}">${esc(r.awardStatus)}</span></td>
                                        <td style="padding:8px 10px;color:#374151;max-width:320px;">${esc(r.justification)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            };

            app.exportJustificationReport = function() {
                const rows = this._justificationRows || [];
                if (rows.length === 0) {
                    alert('Nothing to export yet — open the Justification Report first.');
                    return;
                }
                const wsData = [
                    ['Category', 'Employee ID', 'Employee Name', 'Position', 'Department', 'Seniority Rank',
                     'Slot # (of Total)', 'Awarded Slot', 'Award Status', 'Justification']
                ];
                rows.forEach(r => {
                    wsData.push([
                        r.category, r.employeeId, r.employeeName, r.position, r.department, r.seniorityRank,
                        `${r.slotOrder} of ${r.totalEmployeeSlots}`, r.awardedSlot, r.awardStatus, r.justification
                    ]);
                });
                const ws = XLSX.utils.aoa_to_sheet(wsData);
                ws['!cols'] = [{wch:12},{wch:12},{wch:22},{wch:20},{wch:20},{wch:12},{wch:12},{wch:34},{wch:16},{wch:70}];
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Bid Justification');
                XLSX.writeFile(wb, `Bid_Allocation_Justification_${this.state.biddingYear}.xlsx`);
            };

            app.writeAuditLog = async function(action, details = {}) {
                const entry = {
                    action,
                    user_id: this.state.currentUser?.id || this.state.currentUser?.name || 'unknown',
                    user_name: this.state.currentUser?.name || 'unknown',
                    user_type: this.state.userType || 'unknown',
                    details: JSON.stringify(details),
                    timestamp: new Date().toISOString()
                };

                // Always save locally
                try {
                    const local = JSON.parse(localStorage.getItem('auditLog') || '[]');
                    local.unshift(entry);
                    localStorage.setItem('auditLog', JSON.stringify(local.slice(0, 500))); // keep last 500
                } catch(e) { console.warn('Audit local save failed', e); }

                // Also save to Supabase audit_logs table
                if (this.supabase) {
                    try {
                        await this.supabase.from('audit_logs').insert({
                            tenant_id: this._tid(),
                            action: entry.action,
                            user_id: entry.user_id,
                            user_name: entry.user_name,
                            user_type: entry.user_type,
                            details: entry.details,
                            created_at: entry.timestamp
                        });
                    } catch(e) { console.warn('Audit Supabase save failed', e); }
                }
            };

            app.renderAuditLogView = async function() {
                const content = document.getElementById('contentArea');
                content.innerHTML = `
                    <div class="max-w-6xl mx-auto">
                        <div class="metro-card p-6">
                            <div class="flex items-center justify-between mb-6">
                                <div>
                                    <h2 class="text-2xl font-bold" style="font-family:'Barlow Condensed',sans-serif;color:var(--app-text);">🔍 Audit Log</h2>
                                    <p class="text-sm mt-1" style="color:var(--app-text-muted);">All system activity — logins, bids, overrides, password changes</p>
                                </div>
                                <div class="flex gap-3">
                                    <button onclick="app.renderAuditLogView()" class="metro-tab">🔄 Refresh</button>
                                    <button onclick="app.clearAuditLog()" class="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100">🗑 Clear Local</button>
                                </div>
                            </div>

                            <!-- Filters -->
                            <div class="flex gap-3 mb-5 flex-wrap">
                                <select id="auditFilterType" onchange="app.filterAuditLog()" class="px-3 py-2 border rounded-lg text-sm" style="border-color:var(--app-border);">
                                    <option value="all">All Actions</option>
                                    <option value="LOGIN">Login</option>
                                    <option value="LOGOUT">Logout</option>
                                    <option value="BID_PLACED">Bid Placed</option>
                                    <option value="BID_REMOVED">Bid Removed</option>
                                    <option value="BIDS_PROCESSED">Bids Processed</option>
                                    <option value="PASSWORD_CHANGED">Password Changed</option>
                                    <option value="MANUAL_OVERRIDE">Manual Override</option>
                                    <option value="DATA_UPLOADED">Data Uploaded</option>
                                    <option value="SYSTEM_RESET">System Reset</option>
                                    <option value="SF_SYNC">SF Sync</option>
                                </select>
                                <select id="auditFilterRole" onchange="app.filterAuditLog()" class="px-3 py-2 border rounded-lg text-sm" style="border-color:var(--app-border);">
                                    <option value="all">All Roles</option>
                                    <option value="employee">Operation Staff</option>
                                    <option value="planner">Planner</option>
                                    <option value="goldencommand">Golden Command</option>
                                    <option value="corporatestaff">Corporate Staff</option>
                                    <option value="maintenancestaff">Maintenance</option>
                                </select>
                                <input type="text" id="auditSearch" oninput="app.filterAuditLog()" placeholder="Search name or ID..." class="px-3 py-2 border rounded-lg text-sm flex-1 min-w-40" style="border-color:var(--app-border);" />
                            </div>

                            <div id="auditTableContainer">
                                <div class="text-center py-8 text-gray-400">⏳ Loading audit log...</div>
                            </div>
                        </div>
                    </div>
                `;

                // Load from Supabase first, fallback to localStorage
                let logs = [];
                if (this.supabase) {
                    try {
                        const { data, error } = await this.supabase
                            .from('audit_logs')
                            .select('*')
                            .eq('tenant_id', this._tid())
                            .order('created_at', { ascending: false })
                            .limit(500);
                        if (!error && data) {
                            logs = data.map(r => ({
                                action: r.action,
                                user_id: r.user_id,
                                user_name: r.user_name,
                                user_type: r.user_type,
                                details: r.details,
                                timestamp: r.created_at
                            }));
                        }
                    } catch(e) { console.warn('Audit load from Supabase failed', e); }
                }

                // Merge with local if Supabase had nothing
                if (logs.length === 0) {
                    logs = JSON.parse(localStorage.getItem('auditLog') || '[]');
                }

                this._auditLogs = logs;
                this.filterAuditLog();
            };

            app.filterAuditLog = function() {
                const logs = this._auditLogs || [];
                const typeFilter = document.getElementById('auditFilterType')?.value || 'all';
                const roleFilter = document.getElementById('auditFilterRole')?.value || 'all';
                const search = (document.getElementById('auditSearch')?.value || '').toLowerCase();

                const filtered = logs.filter(l => {
                    if (typeFilter !== 'all' && l.action !== typeFilter) return false;
                    if (roleFilter !== 'all' && l.user_type !== roleFilter) return false;
                    if (search && !l.user_name?.toLowerCase().includes(search) && !l.user_id?.toLowerCase().includes(search)) return false;
                    return true;
                });

                const actionColors = {
                    'LOGIN':            'bg-green-100 text-green-800',
                    'LOGOUT':           'bg-gray-100 text-gray-700',
                    'BID_PLACED':       'bg-blue-100 text-blue-800',
                    'BID_REMOVED':      'bg-orange-100 text-orange-800',
                    'BIDS_PROCESSED':   'bg-purple-100 text-purple-800',
                    'PASSWORD_CHANGED': 'bg-yellow-100 text-yellow-800',
                    'MANUAL_OVERRIDE':  'bg-red-100 text-red-800',
                    'DATA_UPLOADED':    'bg-indigo-100 text-indigo-800',
                    'SYSTEM_RESET':     'bg-red-200 text-red-900',
                };

                const roleIcons = { employee: '👤', planner: '🛠️', goldencommand: '⭐', corporatestaff: '🏢', maintenancestaff: '🔧' };

                const container = document.getElementById('auditTableContainer');
                if (!container) return;

                if (filtered.length === 0) {
                    container.innerHTML = `<div class="text-center py-12 text-gray-400">
                        <p class="text-3xl mb-3">📭</p>
                        <p>No audit entries found${search ? ' matching your search' : ''}.</p>
                    </div>`;
                    return;
                }

                container.innerHTML = `
                    <p class="text-xs mb-3" style="color:var(--app-text-muted);">${filtered.length} entr${filtered.length===1?'y':'ies'} found</p>
                    <div class="overflow-x-auto" style="border:1px solid var(--app-border);border-radius:10px;">
                        <table class="metro-table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Action</th>
                                    <th>User</th>
                                    <th>Role</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filtered.map(l => {
                                    const ts = l.timestamp ? new Date(l.timestamp).toLocaleString('en-US', {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—';
                                    const colorClass = actionColors[l.action] || 'bg-gray-100 text-gray-700';
                                    const roleIcon = roleIcons[l.user_type] || '👤';
                                    let detailsObj = {};
                                    if (l.details && typeof l.details === 'object') {
                                        detailsObj = l.details;
                                    } else if (typeof l.details === 'string' && l.details.trim()) {
                                        try { detailsObj = JSON.parse(l.details); } catch(e) { detailsObj = {}; }
                                    }
                                    const detailStr = Object.entries(detailsObj).map(([k,v]) => `<span class="text-gray-500">${k}:</span> <span class="font-medium">${v}</span>`).join(' · ');
                                    return `
                                        <tr>
                                            <td style="font-family:monospace;font-size:0.75rem;color:var(--app-text-muted);white-space:nowrap;">${ts}</td>
                                            <td><span class="px-2 py-1 rounded-full text-xs font-bold ${colorClass}">${l.action}</span></td>
                                            <td>
                                                <p style="font-weight:600;">${l.user_name || '—'}</p>
                                                <p class="text-xs" style="color:var(--app-text-muted);">${l.user_id || ''}</p>
                                            </td>
                                            <td style="font-size:0.8rem;">${roleIcon} ${l.user_type || '—'}</td>
                                            <td style="font-size:0.8rem;color:var(--app-text-muted);">${detailStr || '—'}</td>
                                        </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            };

            app.clearAuditLog = function() {
                if (!confirm('Clear local audit log? (Supabase records will remain)')) return;
                localStorage.removeItem('auditLog');
                this._auditLogs = [];
                this.filterAuditLog();
            };

