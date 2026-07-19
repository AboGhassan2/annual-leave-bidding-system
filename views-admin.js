// ════════════════════════════════════════════════════════════════════
// views-admin.js — the Admin/Planner control panel: bid review,
// processing, manual override, realtime bid updates, and system
// controls.
//
// Attaches onto the shared `app` object, must load AFTER app.js and
// after allocation.js (renderAdminView and previewAllocation call
// this.computeBidAllocation()/this.processBids()/
// this.processMaintBids()) and api-supabase.js (deleteAllBidsByTab,
// resetSystem, etc. write to Supabase).
//
// Covers:
//   - Bid table rendering & filtering: _isGcOrCs/_isHrCorporate/
//     _isMaintStaff/_isCorporateStaff (role checks), _bidTableForUserType,
//     _switchBidTab, _renderBidsTableHTML, _filterBidsTable,
//     adminDeleteBid, deleteAllBidsByTab, deleteAllBids.
//   - Realtime admin updates: stopAdminPolling (legacy, see
//     allocation.js's polling notes), _mapRemoteBid, start/stopAdminRealtime,
//     start/stopLcRealtime, _setLcStatus, _setAdminStatus,
//     _start/_stopAdminLive, _liveUpdateAdminPanel.
//   - renderAdminView — the main admin panel screen.
//   - showConfirmModal/_resolveConfirmModal — generic confirm dialog,
//     used by the allocation engine's "unconfigured departments"
//     warning.
//   - Preview & processing: previewAllocation, renderPreviewAllocationReport,
//     _filterPreviewAllocationByPosition, exportPreviewAllocationToExcel,
//     exportMaintResults, resetMaintProcessing, renderMaintResultsView,
//     exportResults.
//   - resetSystem — full system reset.
//   - setBiddingDeadline/setBiddingDeadlineCorp/setBiddingYearCorp/
//     toggleCorpLock — admin config actions held back from the
//     views-bidding.js batch specifically because they belong here.
//   - Manual override: renderManualOverrideView, saveOverride,
//     saveAllOverrides, renderMaintManualOverrideView, saveMaintOverride,
//     saveAllMaintOverrides.
// ════════════════════════════════════════════════════════════════════

            app._liveUpdateAdminPanel = function() {
                // Update stats badges
                const bidCountEl = document.getElementById('adminBidCount');
                if (bidCountEl) bidCountEl.textContent = this.state.bids.length;
                const bidCount2El = document.getElementById('adminBidCount2');
                if (bidCount2El) bidCount2El.textContent = this.state.bids.length;
                const uniqueBiddersEl = document.getElementById('adminUniqueBidders');
                if (uniqueBiddersEl) uniqueBiddersEl.textContent = new Set(this.state.bids.map(b => b.employeeId)).size;
                const uniqueBidders2El = document.getElementById('adminUniqueBidders2');
                if (uniqueBidders2El) uniqueBidders2El.textContent = new Set(this.state.bids.map(b => b.employeeId)).size;
                const lastRefreshEl = document.getElementById('adminLastRefresh');
                if (lastRefreshEl) lastRefreshEl.textContent = new Date().toLocaleTimeString();
                // Re-render bids table
                const tableContainer = document.getElementById('adminBidsTableContainer');
                const currentQuery = document.getElementById('bidSearchInput')?.value || '';
                const activeTab = tableContainer?.dataset.activeTab || 'employees';
                if (tableContainer) tableContainer.innerHTML = this._renderBidsTableHTML(currentQuery, activeTab);
                // FIX: keep the GC/CS Leave Tracker in sync after any bid change
                if (typeof window.lcRender === 'function') window.lcRender();
            };

            app._isGcOrCs = function(employeeId) {
                // Returns true if the employeeId belongs to GC, CS, or any sub-group (not a regular employee)
                const gcIds  = (this.state.goldenCommandUsers  || []).map(u => u.id);
                const csIds  = (this.state.corporateStaffUsers || []).map(u => u.id);
                const l456   = (this.state.l456InmUsers        || []).map(u => u.id);
                const l3Inm  = (this.state.l3InmUsers          || []).map(u => u.id);
                const l3Tsm  = (this.state.l3TsmUsers          || []).map(u => u.id);
                const hseq   = (this.state.hseqUsers           || []).map(u => u.id);
                const allSpecial = [...gcIds, ...csIds, ...l456, ...l3Inm, ...l3Tsm, ...hseq];
                return allSpecial.includes(employeeId);
            };

            app._isHrCorporate = function(employeeId) {
                // Returns true only for the specific staff IDs on the HR Corporate list
                // (not the entire Corporate Staff roster).
                return this._HR_CORPORATE_IDS.includes(String(employeeId));
            };

            app._isMaintStaff = function(employeeId, bid) {
                // Prefer the source table tag set at fetch time — reliable even when
                // maintenanceStaffUsers list is not loaded in the admin session
                if (bid && bid._sourceTable) return bid._sourceTable === 'maint_leave_requests';
                // Fallback: check against loaded maintenance staff users list
                const ids = (this.state.maintenanceStaffUsers || []).map(u => u.id);
                if (ids.length > 0) return ids.includes(employeeId);
                // Last resort: check if any bid in state has this employeeId tagged as maint
                return this.state.bids.some(b => b.employeeId === employeeId && b._sourceTable === 'maint_leave_requests');
            };

            app._isCorporateStaff = function(employeeId, bid) {
                // Prefer the source table tag set at fetch time — reliable even when
                // the GC/CS user lists are not loaded in the admin session
                if (bid && bid._sourceTable) return bid._sourceTable === 'corporate_leave_request';
                const gcIds = (this.state.goldenCommandUsers   || []).map(u => u.id);
                const csIds = (this.state.corporateStaffUsers  || []).map(u => u.id);
                if (gcIds.length > 0 || csIds.length > 0) {
                    return gcIds.includes(employeeId) || csIds.includes(employeeId);
                }
                // Last resort: check if any bid in state has this employeeId tagged as corporate
                return this.state.bids.some(b => b.employeeId === employeeId && b._sourceTable === 'corporate_leave_request');
            };

            app._bidTableForUserType = function(userType) {
                if (userType === 'maintenancestaff') return 'maint_leave_requests';
                if (userType === 'goldencommand' || userType === 'corporatestaff') return 'corporate_leave_request';
                return 'leave_requests';
            };

            app._switchBidTab = function(tab) {
                const empBtn   = document.getElementById('bidTabEmp');
                const gccsBtn  = document.getElementById('bidTabGcCs');
                const hrBtn    = document.getElementById('bidTabHr');
                const maintBtn = document.getElementById('bidTabMaint');
                [empBtn, gccsBtn, hrBtn, maintBtn].forEach(btn => {
                    if (!btn) return;
                    btn.style.background = '#f3f4f6'; btn.style.color = '#374151';
                });
                const target = tab === 'employees' ? empBtn : tab === 'gccs' ? gccsBtn : tab === 'hrcorp' ? hrBtn : maintBtn;
                if (target) { target.style.background = '#2d6a4f'; target.style.color = '#fff'; }
                const container = document.getElementById('adminBidsTableContainer');
                if (container) {
                    const currentQuery = document.getElementById('bidSearchInput')?.value || '';
                    container.innerHTML = this._renderBidsTableHTML(currentQuery, tab);
                    container.dataset.activeTab = tab;
                }
            };

            app._renderBidsTableHTML = function(filterQuery = '', tabFilter = 'employees') {
                if (this.state.bids.length === 0) {
                    return `
                        <div class="text-center py-10 text-gray-400">
                            <p class="text-4xl mb-3">📭</p>
                            <p class="font-semibold">No bids submitted yet</p>
                            <p class="text-sm mt-1">Auto-refreshing every 15 seconds. Bids appear here as soon as employees submit them.</p>
                        </div>`;
                }
                const q = filterQuery.toLowerCase().trim();
                // Preference rank: for each employee, the order their bids were actually
                // submitted (by timestamp, ascending) = the same order the allocation
                // engine's preference cascade (Round 1, 2, 3…) consumes them in.
                // Keyed by `${employeeId}||${slotType}||${startDate}` so it survives
                // re-sorting/filtering below.
                const prefRankByBidKey = {};
                const bidKey = (b) => `${b.employeeId}||${b.slotType}||${b.startDate}`;
                const bidsByEmployee = {};
                this.state.bids.forEach(b => {
                    if (!bidsByEmployee[b.employeeId]) bidsByEmployee[b.employeeId] = [];
                    bidsByEmployee[b.employeeId].push(b);
                });
                Object.values(bidsByEmployee).forEach(empBids => {
                    [...empBids]
                        .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
                        .forEach((b, i) => { prefRankByBidKey[bidKey(b)] = i + 1; });
                });
                const sortedBids = [...this.state.bids]
                    .sort((a, b) => {
                        const dA = new Date(this.state.employees.find(e => e.id === a.employeeId)?.seniorityDate || 0);
                        const dB = new Date(this.state.employees.find(e => e.id === b.employeeId)?.seniorityDate || 0);
                        if (dA - dB !== 0) return dA - dB;
                        // Tie-break (same employee, or employees sharing a seniority date):
                        // group by employeeId, then order each employee's own bids by the
                        // actual submission timestamp — this is the order the allocation
                        // engine reads them in, so the # column below reflects reality.
                        if (a.employeeId !== b.employeeId) return String(a.employeeId).localeCompare(String(b.employeeId));
                        return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
                    })
                    .filter(bid => {
                        // Tab filter
                        const isSpecial = this._isGcOrCs(bid.employeeId);
                        const isHr      = this._isHrCorporate(bid.employeeId);
                        const isMaint   = this._isMaintStaff(bid.employeeId, bid);
                        if (tabFilter === 'employees' && (isSpecial || isMaint)) return false;
                        if (tabFilter === 'gccs'      && (!isSpecial || isHr || isMaint)) return false;
                        if (tabFilter === 'hrcorp'    && (!isHr || isMaint)) return false;
                        if (tabFilter === 'maint'     && !isMaint) return false;
                        // Search filter
                        if (!q) return true;
                        const empRec = this.state.employees.find(e => e.id === bid.employeeId);
                        const name = (bid.employeeName || empRec?.name || '').toLowerCase();
                        const id   = (bid.employeeId || '').toLowerCase();
                        // Matches the same fallback chain used to render the Position column,
                        // so searching finds exactly what's shown on screen.
                        const position = (bid.position || empRec?.position || bid.department || empRec?.department || '').toLowerCase();
                        return name.includes(q) || id.includes(q) || position.includes(q);
                    });
                const colorMap = { 
                    slotA: 'bg-green-100 text-green-800', slotB: 'bg-blue-100 text-blue-800', slotC: 'bg-purple-100 text-purple-800', slotD: 'bg-orange-100 text-orange-800',
                    SA:    'bg-green-100 text-green-800', SB:    'bg-blue-100 text-blue-800', SC:    'bg-purple-100 text-purple-800', SD:    'bg-orange-100 text-orange-800'
                };
                const _slotLabel = (st) => {
                    if (st === 'slotA' || st === 'SA') return 'Slot A';
                    if (st === 'slotB' || st === 'SB') return 'Slot B';
                    if (st === 'slotC' || st === 'SC') return 'Slot C';
                    if (st === 'slotD' || st === 'SD') return 'Slot D';
                    if (st === 'gcCustom') return '⭐ Custom';
                    if (st === 'csCustom') return '🏢 Custom';
                    return st || '—';
                };
                const noResults = sortedBids.length === 0 ? `
                    <div class="text-center py-8 text-gray-400">
                        <p class="text-3xl mb-2">🔍</p>
                        <p class="font-semibold">No bids match "<span class="text-indigo-600">${filterQuery}</span>"</p>
                        <p class="text-sm mt-1">Try a different name, ID, or position.</p>
                    </div>` : '';
                return `
                    <div class="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <div class="relative flex-1 max-w-sm">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                            <input type="text" id="bidSearchInput"
                                placeholder="Search by name, ID, or position…"
                                value="${filterQuery.replace(/"/g, '&quot;')}"
                                oninput="app._filterBidsTable(this.value)"
                                style="width:100%;padding:9px 12px 9px 32px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:0.875rem;color:#111827;background:#f9fafb;outline:none;box-sizing:border-box;"
                                onfocus="this.style.borderColor='#6366f1';this.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'"
                                onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'" />
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-sm text-gray-500">${sortedBids.length} of ${this.state.bids.length} bid${this.state.bids.length !== 1 ? 's' : ''}</span>
                            <button onclick="app.deleteAllBidsByTab('${tabFilter}')" class="px-4 py-2 rounded-lg text-sm font-semibold" style="background:#ef4444; color:#ffffff;">
                                🗑️ Delete All ${tabFilter === 'employees' ? '👤 Employee' : tabFilter === 'gccs' ? '⭐ GC & Corporate' : tabFilter === 'hrcorp' ? '🏢 HR Corporate' : '🔧 Maintenance'} Bids
                            </button>
                        </div>
                    </div>
                    ${noResults}
                    <div class="overflow-x-auto" style="border:1px solid var(--app-border);border-radius:10px;">
                        <table class="metro-table">
                            <thead>
                                <tr>
                                    <th>Choice No</th>
                                    <th>Operation Staff ID</th>
                                    <th>Name</th>
                                    <th>Position</th>
                                    <th>Slot Type</th>
                                    <th>Start Date</th>
                                    <th>End Date</th>
                                    <th>Days</th>
                                    <th>Submitted</th>
                                    <th style="text-align:center;">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sortedBids.map((bid, idx) => {
                                    const emp = this.state.employees.find(e => e.id === bid.employeeId);
                                    const slotColor = colorMap[bid.slotType] || 'bg-gray-100 text-gray-700';
                                    const slotDisplay = bid.slotLabel || _slotLabel(bid.slotType);
                                    const submitted = bid.timestamp ? new Date(bid.timestamp).toLocaleString() : 'N/A';
                                    const safeId = encodeURIComponent(bid.employeeId);
                                    const safeSlot = encodeURIComponent(bid.slotType);
                                    const safeStart = encodeURIComponent(bid.startDate);
                                    const prefRank = prefRankByBidKey[bidKey(bid)] || (idx + 1);
                                    return `
                                        <tr>
                                            <td style="text-align:center;color:var(--app-text-muted);" title="Preference #${prefRank} — order this bid was actually submitted in for this employee">${prefRank}</td>
                                            <td style="font-family:monospace;font-size:0.8rem;">${this._escHtml(bid.employeeId)}</td>
                                            <td style="font-weight:600;">${this._escHtml(bid.employeeName || emp?.name || 'Unknown')}</td>
                                            <td>${this._escHtml(bid.position || emp?.position || bid.department || emp?.department || 'Unassigned')}</td>
                                            <td><span class="px-2 py-1 rounded text-xs font-semibold ${slotColor}">${this._escHtml(slotDisplay)}</span></td>
                                            <td>${this._escHtml(bid.startDate || '—')}</td>
                                            <td>${this._escHtml(bid.endDate || '—')}</td>
                                            <td style="text-align:center;font-weight:600;">${this._escHtml(String(bid.days || '—'))}</td>
                                            <td style="font-size:0.75rem;color:var(--app-text-muted);">${this._escHtml(submitted)}</td>
                                            <td style="text-align:center;">
                                                <button onclick="app.adminDeleteBid('${safeId}','${safeSlot}','${safeStart}')"
                                                    class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold hover:bg-red-200">
                                                    🗑️ Delete
                                                </button>
                                            </td>
                                        </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>`;
            };

            app.adminDeleteBid = async function(encodedId, encodedSlot, encodedStart) {
                const employeeId = decodeURIComponent(encodedId);
                const slotType   = decodeURIComponent(encodedSlot);
                const startDate  = decodeURIComponent(encodedStart);

                // ✅ FIX: Look up the bid BEFORE removing it from state,
                // so we can correctly determine the table and pass it to _isMaintStaff.
                // Previously this lookup happened AFTER state removal, returning undefined.
                const bid = this.state.bids.find(b => b.employeeId === employeeId && b.slotType === slotType && b.startDate === startDate);
                const name = bid?.employeeName || employeeId;
                if (!confirm(`Delete bid for ${name} (${slotType}, ${startDate})?\n\nThis cannot be undone.`)) return;

                // Pause polling during delete to avoid race condition where the
                // 15-second auto-refresh fetches from Supabase before the delete completes
                // and overwrites local state — causing the bid to reappear.
                this._stopAdminLive();

                // Remove from local state immediately
                this.state.bids = this.state.bids.filter(b =>
                    !(b.employeeId === employeeId && b.slotType === slotType && b.startDate === startDate)
                );
                this.saveState();

                // Delete from Supabase — route to correct table, await completion
                if (this.supabase) {
                    // ✅ FIX: Use the bid looked up above (before state removal), not a stale re-lookup.
                    // Also added .eq('tenant_id') for safe scoping, consistent with bulk-delete functions.
                    const table = this._isMaintStaff(employeeId, bid)
                        ? 'maint_leave_requests'
                        : this._isCorporateStaff(employeeId, bid)
                            ? 'corporate_leave_request'
                            : 'leave_requests';
                    const { error } = await this.supabase
                        .from(table)
                        .delete()
                        .eq('employee_id', employeeId)
                        .eq('slot_type', slotType)
                        .eq('start_date', startDate)
                        .eq('tenant_id', this._tid());
                    if (error) console.warn(`⚠️ Supabase delete error [${table}]:`, error.message);
                    else console.log(`✅ Bid deleted from ${table}`);
                }

                this._liveUpdateAdminPanel();

                // Resume realtime subscription only after Supabase delete is confirmed done
                this._startAdminLive();
            };

            app._filterBidsTable = function(query) {
                const container = document.getElementById('adminBidsTableContainer');
                const activeTab = container?.dataset.activeTab || 'employees';
                if (container) container.innerHTML = this._renderBidsTableHTML(query, activeTab);
                // Re-focus and restore cursor position
                const input = document.getElementById('bidSearchInput');
                if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
            };

            app.deleteAllBidsByTab = async function(tabFilter) {
                // Determine which bids belong to this tab
                const tabBids = this.state.bids.filter(bid => {
                    const isSpecial = this._isGcOrCs(bid.employeeId);
                    const isHr      = this._isHrCorporate(bid.employeeId);
                    const isMaint   = this._isMaintStaff(bid.employeeId, bid);
                    if (tabFilter === 'employees') return !isSpecial && !isMaint;
                    if (tabFilter === 'gccs')      return isSpecial && !isHr && !isMaint;
                    if (tabFilter === 'hrcorp')    return isHr && !isMaint;
                    if (tabFilter === 'maint')     return isMaint;
                    return false;
                });

                if (tabBids.length === 0) {
                    alert('No bids to delete in this section.');
                    return;
                }

                const sectionName = tabFilter === 'employees' ? '👤 Employee'
                                  : tabFilter === 'gccs'      ? '⭐ GC & Corporate Staff'
                                  : tabFilter === 'hrcorp'    ? '🏢 HR Corporate'
                                  :                             '🔧 Maintenance Staff';

                if (!confirm(`⚠️ Delete ALL ${tabBids.length} ${sectionName} bids?\n\nBids in other sections will NOT be affected.\nThis cannot be undone.`)) return;

                // Pause polling to avoid race condition
                this._stopAdminLive();

                // Remove only the matching bids from local state
                this.state.bids = this.state.bids.filter(bid => {
                    const isSpecial = this._isGcOrCs(bid.employeeId);
                    const isHr      = this._isHrCorporate(bid.employeeId);
                    const isMaint   = this._isMaintStaff(bid.employeeId, bid);
                    if (tabFilter === 'employees') return isSpecial || isMaint;               // keep non-employee bids
                    if (tabFilter === 'gccs')      return !isSpecial || isHr || isMaint;      // keep non-gccs bids (incl. HR corp)
                    if (tabFilter === 'hrcorp')    return !isHr || isMaint;                   // keep non-HR-corp bids
                    if (tabFilter === 'maint')     return !isMaint;                           // keep non-maint bids
                    return true;
                });
                this.saveState();

                if (this.supabase) {
                    if (tabFilter === 'maint') {
                        // Only delete from maint_leave_requests, scoped to this tenant
                        const { error } = await this.supabase
                            .from('maint_leave_requests')
                            .delete()
                            .eq('tenant_id', this._tid());
                        if (error) console.warn('⚠️ Supabase delete all maint error:', error.message);
                        else console.log('✅ All maintenance bids deleted');
                    } else if (tabFilter === 'gccs' || tabFilter === 'hrcorp') {
                        // GC, Corporate Staff, and HR Corporate all live in corporate_leave_request
                        const idsToDelete = tabBids.map(b => b.employeeId);
                        const { error } = await this.supabase
                            .from('corporate_leave_request')
                            .delete()
                            .eq('tenant_id', this._tid())
                            .in('employee_id', idsToDelete);
                        if (error) console.warn(`⚠️ Supabase delete all [${tabFilter}] error:`, error.message);
                        else console.log(`✅ All ${sectionName} bids deleted from corporate_leave_request`);
                    } else {
                        // Ops employees live in leave_requests
                        // Delete only the specific employee IDs for this tab, scoped to this tenant
                        const idsToDelete = tabBids.map(b => b.employeeId);
                        const { error } = await this.supabase
                            .from('leave_requests')
                            .delete()
                            .eq('tenant_id', this._tid())
                            .in('employee_id', idsToDelete);
                        if (error) console.warn(`⚠️ Supabase delete all [${tabFilter}] error:`, error.message);
                        else console.log(`✅ All ${sectionName} bids deleted from leave_requests`);
                    }
                }

                this._liveUpdateAdminPanel();
                // Resume realtime subscription after delete is confirmed done
                this._startAdminLive();
                alert(`✅ All ${sectionName} bids have been deleted.`);
            };

            app.deleteAllBids = async function() {
                if (!confirm(`⚠️ Delete ALL ${this.state.bids.length} bids?\n\nThis will permanently remove every bid from the database and cannot be undone.`)) return;

                this._stopAdminLive();
                this.state.bids = [];
                this.saveState();

                if (this.supabase) {
                    const [r1, r2, r3] = await Promise.all([
                        this.supabase.from('leave_requests').delete().eq('tenant_id', this._tid()),
                        this.supabase.from('maint_leave_requests').delete().eq('tenant_id', this._tid()),
                        this.supabase.from('corporate_leave_request').delete().eq('tenant_id', this._tid())
                    ]);
                    if (r1.error) console.warn('⚠️ Supabase delete all error [leave_requests]:', r1.error.message);
                    if (r2.error) console.warn('⚠️ Supabase delete all error [maint_leave_requests]:', r2.error.message);
                    if (r3.error) console.warn('⚠️ Supabase delete all error [corporate_leave_request]:', r3.error.message);
                    if (!r1.error && !r2.error && !r3.error) console.log('✅ All bids deleted from all three tables');
                }

                this._liveUpdateAdminPanel();
                this._startAdminLive();
                alert('✅ All bids have been deleted.');
            };

            app.stopAdminPolling = function() {
                if (this._adminPollTimer) {
                    clearInterval(this._adminPollTimer);
                    this._adminPollTimer = null;
                    console.log('⏹ Admin poll stopped');
                }
            };

            app._mapRemoteBid = function(bid, sourceTable) {
                return {
                    employeeId: bid.employee_id,
                    employeeName: bid.employee_name ||
                        this.state.employees.find(e => e.id === bid.employee_id)?.name ||
                        (this.state.maintenanceStaffUsers || []).find(e => e.id === bid.employee_id)?.name || '',
                    seniorityDate: this.state.employees.find(e => e.id === bid.employee_id)?.seniorityDate ||
                        (this.state.maintenanceStaffUsers || []).find(e => e.id === bid.employee_id)?.seniorityDate || '',
                    department: bid.department ||
                        this.state.employees.find(e => e.id === bid.employee_id)?.department ||
                        (this.state.maintenanceStaffUsers || []).find(e => e.id === bid.employee_id)?.department || '',
                    position: this.state.employees.find(e => e.id === bid.employee_id)?.position ||
                        (this.state.maintenanceStaffUsers || []).find(e => e.id === bid.employee_id)?.position || '',
                    slotType: bid.slot_type || 'slotA',
                    leaveType: bid.leave_type || 'Annual Leave',
                    startDate: bid.start_date,
                    endDate: bid.end_date,
                    days: bid.days_requested,
                    timestamp: bid.created_at,
                    _sourceTable: sourceTable
                };
            };

            app.startAdminRealtime = function() {
                if (!this.supabase || this._adminRealtimeChannel) return;

                const applyChange = (payload, sourceTable) => {
                    if (!payload?.new && !payload?.old) return;

                    if (payload.eventType === 'DELETE') {
                        const old = payload.old;
                        this.state.bids = this.state.bids.filter(b =>
                            !(b.employeeId === old.employee_id &&
                              b.slotType   === old.slot_type   &&
                              b.startDate  === old.start_date  &&
                              b._sourceTable === sourceTable)
                        );
                    } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const row = payload.new;
                        const mapped = this._mapRemoteBid(row, sourceTable);
                        this.state.bids = [
                            ...this.state.bids.filter(b =>
                                !(b.employeeId === mapped.employeeId &&
                                  b.slotType   === mapped.slotType   &&
                                  b.startDate  === mapped.startDate  &&
                                  b._sourceTable === sourceTable)),
                            mapped
                        ];
                    }
                    this._liveUpdateAdminPanel();
                    this._setAdminStatus('live');
                };

                this._adminRealtimeChannel = this.supabase
                    .channel('admin-bids')
                    .on('postgres_changes',
                        { event: '*', schema: 'public', table: 'leave_requests' },
                        payload => applyChange(payload, 'leave_requests'))
                    .on('postgres_changes',
                        { event: '*', schema: 'public', table: 'maint_leave_requests' },
                        payload => applyChange(payload, 'maint_leave_requests'))
                    .on('postgres_changes',
                        { event: '*', schema: 'public', table: 'corporate_leave_request' },
                        payload => applyChange(payload, 'corporate_leave_request'))
                    .subscribe(status => {
                        console.log('🔌 Admin Realtime status:', status);
                        if (status === 'SUBSCRIBED') this._setAdminStatus('live');
                        if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                            this._setAdminStatus('reconnecting');
                        }
                    });
            };

            app.stopAdminRealtime = function() {
                if (this._adminRealtimeChannel && this.supabase) {
                    this.supabase.removeChannel(this._adminRealtimeChannel);
                    this._adminRealtimeChannel = null;
                    console.log('⏹ Admin Realtime stopped');
                }
            };

            app.startLcRealtime = function() {
                if (!this.supabase || this._lcRealtimeChannel) return;

                const applyLcChange = (payload, sourceTable) => {
                    if (!payload?.new && !payload?.old) return;

                    if (payload.eventType === 'DELETE') {
                        const old = payload.old;
                        this.state.bids = this.state.bids.filter(b =>
                            !(b.employeeId === old.employee_id &&
                              b.slotType   === old.slot_type   &&
                              b.startDate  === old.start_date  &&
                              b._sourceTable === sourceTable)
                        );
                    } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const row = payload.new;
                        const mapped = this._mapRemoteBid(row, sourceTable);
                        this.state.bids = [
                            ...this.state.bids.filter(b =>
                                !(b.employeeId === mapped.employeeId &&
                                  b.slotType   === mapped.slotType   &&
                                  b.startDate  === mapped.startDate  &&
                                  b._sourceTable === sourceTable)),
                            mapped
                        ];
                    }
                    // Re-render the tracker and update the live badge timestamp
                    if (typeof window.lcRender === 'function') window.lcRender();
                    this._setLcStatus('live');
                };

                this._lcRealtimeChannel = this.supabase
                    .channel('lc-tracker-bids')
                    .on('postgres_changes',
                        { event: '*', schema: 'public', table: 'corporate_leave_request' },
                        payload => applyLcChange(payload, 'corporate_leave_request'))
                    .on('postgres_changes',
                        { event: '*', schema: 'public', table: 'golden_command_users' },
                        () => { if (typeof window.lcRender === 'function') window.lcRender(); })
                    .on('postgres_changes',
                        { event: '*', schema: 'public', table: 'corporate_staff_employees' },
                        () => { if (typeof window.lcRender === 'function') window.lcRender(); })
                    .subscribe(status => {
                        console.log('🔌 LC Tracker Realtime:', status);
                        if (status === 'SUBSCRIBED') this._setLcStatus('live');
                        if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                            this._setLcStatus('reconnecting');
                            // Retry after 5s
                            setTimeout(() => {
                                if (this.state.activeView === 'leaveDashboard') {
                                    this.supabase.removeChannel(this._lcRealtimeChannel);
                                    this._lcRealtimeChannel = null;
                                    this.startLcRealtime();
                                }
                            }, 5000);
                        }
                    });
            };

            app.stopLcRealtime = function() {
                if (this._lcRealtimeChannel && this.supabase) {
                    this.supabase.removeChannel(this._lcRealtimeChannel);
                    this._lcRealtimeChannel = null;
                    console.log('⏹ LC Tracker Realtime stopped');
                }
                if (this._lcFallbackTimer) {
                    clearInterval(this._lcFallbackTimer);
                    this._lcFallbackTimer = null;
                }
            };

            app._setLcStatus = function(state) {
                const badge = document.getElementById('lcLiveBadge');
                if (!badge) return;
                if (state === 'live') {
                    badge.innerHTML = '&#9679; LIVE &mdash; <span id="lcLastRefresh">' + new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) + '</span>';
                    badge.style.background = 'rgba(46,204,154,.25)';
                    badge.style.borderColor = 'rgba(46,204,154,.6)';
                    badge.style.color = '#7eedc8';
                } else if (state === 'reconnecting') {
                    badge.innerHTML = '&#9679; Reconnecting…';
                    badge.style.background = 'rgba(255,195,80,.2)';
                    badge.style.borderColor = 'rgba(255,195,80,.5)';
                    badge.style.color = '#ffd98a';
                }
            };

            app._setAdminStatus = function(state) {
                const el = document.getElementById('adminLiveBadge');
                if (!el) return;
                if (state === 'live') {
                    el.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    Live &mdash; realtime updates
                                    &nbsp;|&nbsp; Last: <span id="adminLastRefresh">${new Date().toLocaleTimeString()}</span>`;
                } else if (state === 'reconnecting') {
                    el.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>
                                    Reconnecting &mdash; fallback polling every 30s`;
                }
            };

            app._startAdminLive = function() {
                this.stopAdminPolling();
                this.startAdminRealtime();
                // Fallback poll every 30s while realtime is active — only fires if
                // realtime events stop arriving for any reason (network drop, server hiccup).
                if (this._adminFallbackTimer) clearInterval(this._adminFallbackTimer);
                this._adminFallbackTimer = setInterval(() => {
                    if (this.state.activeView === 'admin' && this.state.userType === 'planner') {
                        this.refreshBidsFromSupabase(true);
                    }
                }, 30000);
            };

            app._stopAdminLive = function() {
                this.stopAdminRealtime();
                this.stopAdminPolling();
                if (this._adminFallbackTimer) {
                    clearInterval(this._adminFallbackTimer);
                    this._adminFallbackTimer = null;
                }
            };

            app.renderAdminView = function() {
                const content = document.getElementById('contentArea');
                // Use exact same department list as Configure Slots (L3/L46/L5 codes only)
                const employeeDeptsAdmin = [...new Set(this.state.employees.map(e => e.department || 'Unassigned'))];
                const allRawDeptsAdmin = [...new Set([...this.state.departments, ...employeeDeptsAdmin])];
                const filteredDeptsAdmin = allRawDeptsAdmin.filter(d => /^(L3|L46|L5|L3465)[-\s]/i.test(d) || d === 'L3-SA' || d === 'L5 SA' || d === 'L3 SAMB' || d === 'L5 SAMB' || d === 'L46 SAMB').sort();
                const allDepts = filteredDeptsAdmin;
                const depts = ['all', ...filteredDeptsAdmin];
                
                content.innerHTML = `
                    <div class="max-w-6xl mx-auto">
                        <div class="metro-card p-6">
                            <div class="flex items-center justify-between mb-6">
                                <h2 class="text-2xl font-bold" style="font-family:'Barlow Condensed',sans-serif;color:var(--app-text);">Admin Panel</h2>
                                <div id="adminLiveBadge" class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm" style="background:var(--app-green-50);border:1px solid var(--app-border);color:var(--metro-green-dark);">
                                    <span class="inline-block w-2 h-2 rounded-full animate-pulse" style="background:var(--metro-green);"></span>
                                    Live &mdash; auto-refreshes every 15s &nbsp;|&nbsp; Last: <span id="adminLastRefresh">${new Date().toLocaleTimeString()}</span>
                                </div>
                            </div>
                            
                            <div class="mb-6 p-4 rounded-lg" style="background:var(--app-green-50);">
                                <label class="block font-semibold mb-2" style="color:var(--app-text);">Set Bidding Deadline (Ops &amp; Maintenance):</label>
                                <input
                                    type="datetime-local"
                                    id="biddingDeadline"
                                    value="${this.state.biddingDeadline}"
                                    class="w-full px-4 py-2 border-2 rounded-lg"
                                    style="border-color:var(--metro-green-light);"
                                    onchange="app.setBiddingDeadline(this.value)"
                                />
                            </div>

                            <div class="mb-6 p-4 rounded-lg border-2" style="background:var(--app-gold-50);border-color:#f0d78c;">
                                <label class="block font-semibold mb-2" style="color:var(--metro-gold-dark);">⭐ Corporate &amp; Golden Command Bidding Settings (independent):</label>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                    <div>
                                        <label class="block text-sm font-semibold mb-1">Deadline:</label>
                                        <input
                                            type="datetime-local"
                                            id="biddingDeadlineCorp"
                                            value="${this.state.biddingDeadlineCorp}"
                                            class="w-full px-4 py-2 border-2 rounded-lg"
                                            style="border-color:#e0c069;"
                                            onchange="app.setBiddingDeadlineCorp(this.value)"
                                        />
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold mb-1">Bidding Year:</label>
                                        <select
                                            id="biddingYearCorpSelect"
                                            class="w-full px-4 py-2 border-2 rounded-lg font-semibold"
                                            style="border-color:#e0c069;"
                                            onchange="app.setBiddingYearCorp(parseInt(this.value))"
                                        >
                                            ${[this.state.biddingYear - 1, this.state.biddingYear, this.state.biddingYear + 1].map(year => `
                                                <option value="${year}" ${year === this.state.biddingYearCorp ? 'selected' : ''}>${year}</option>
                                            `).join('')}
                                        </select>
                                    </div>
                                </div>
                                <button
                                    onclick="app.toggleCorpLock()"
                                    class="w-full px-6 py-3 rounded-lg font-semibold text-white"
                                    style="background:${this.state.isProcessedCorp ? '#6b7280' : 'linear-gradient(135deg, #8b6914 0%, #b8860b 50%, #d4a017 100%)'};"
                                >
                                    ${this.state.isProcessedCorp ? '🔓 Unlock Corporate &amp; GC Bidding' : '🔒 Lock Corporate &amp; GC Bidding'}
                                </button>
                                <p class="text-xs mt-2" style="color:var(--app-text-muted);">This deadline, year, and lock apply only to Golden Command &amp; Corporate Staff bidding — Ops/Maintenance are unaffected, and vice versa.</p>
                            </div>

                            <div class="mb-6 p-4 rounded-lg" style="background:var(--app-green-50);">
                                <label class="block font-semibold mb-2" style="color:var(--app-text);">Filter by Scheduling Row:</label>
                                <select
                                    id="adminDeptFilter"
                                    class="w-full px-4 py-2 border-2 rounded-lg text-lg font-semibold"
                                    style="border-color:var(--metro-green-light);"
                                    onchange="app.state.selectedDepartment = this.value;"
                                >
                                    ${depts.map(dept => `
                                        <option value="${dept}" ${dept === this.state.selectedDepartment ? 'selected' : ''}>
                                            ${dept === 'all' ? 'All Departments (L3 / L46 / L5)' : dept}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                                <div class="p-4 rounded-lg" style="background:var(--app-green-50);">
                                    <p class="text-2xl font-bold" style="color:var(--metro-green-dark);" id="adminBidCount">${this.state.bids.length}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Total Bids</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background:var(--app-gold-50);">
                                    <p class="text-2xl font-bold" style="color:var(--metro-gold-dark);" id="adminUniqueBidders">${new Set(this.state.bids.map(b => b.employeeId)).size}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Employees Who Bid</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background:#f3f4f6;">
                                    <p class="text-2xl font-bold" style="color:var(--app-text);">${this.state.isProcessed ? 'Yes' : 'No'}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Ops Processed</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background:var(--app-gold-50);">
                                    <p class="text-2xl font-bold" style="color:var(--metro-gold-dark);">${this.state.isProcessedCorp ? '🔒 Locked' : '🔓 Open'}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Corporate &amp; GC Bidding</p>
                                </div>
                            </div>

                            <div class="space-y-4 mb-6">
                                <button
                                    onclick="app.processBids()"
                                    ${this.state.isProcessed || this.state.employees.length === 0 ? 'disabled' : ''}
                                    class="w-full px-6 py-3 rounded-lg font-semibold text-white ${this.state.isProcessed ? 'opacity-50' : ''}"
                                    style="background:${this.state.isProcessed ? '#9ca3af' : 'var(--metro-green)'};"
                                >
                                    ${this.state.isProcessed ? '✅ Bids Already Processed' : '🚀 Process All Bids'}
                                </button>

                                <button
                                    onclick="app.previewAllocation()"
                                    ${this.state.employees.length === 0 ? 'disabled' : ''}
                                    class="w-full px-6 py-3 rounded-lg font-semibold border-2"
                                    style="color:var(--metro-green-dark);border-color:var(--metro-green-dark);background:#fff;"
                                >
                                    🔍 Preview Allocation (read-only, no data written)
                                </button>

                                ${this.state.isProcessed ? `
                                    <button onclick="app.exportResults()" class="w-full px-6 py-3 rounded-lg font-semibold text-white" style="background:var(--metro-green-mid);">
                                        📊 Export Results to Excel
                                    </button>
                                    <button onclick="app.showEmailNotifyModal()" class="w-full px-6 py-3 rounded-lg font-semibold text-white" style="background:var(--metro-green-dark);">
                                        📧 Notify Staff by Email (Results Ready)
                                    </button>
                                    <button onclick="app.setActiveView('manualOverride')" class="w-full px-6 py-3 rounded-lg font-semibold text-white" style="background:#c2620a;">
                                        ✏️ Manual Override Results
                                    </button>
                                ` : ''}
                                ${(this.state.isProcessed || this.state.isMaintProcessed) ? `
                                    <button onclick="app.renderJustificationReport()" class="w-full px-6 py-3 rounded-lg font-semibold text-white" style="background:#4338ca;">
                                        📋 Bid Allocation Justification Report
                                    </button>
                                ` : ''}
                                
                                <button onclick="app.refreshBidsFromSupabase(false)" class="w-full px-6 py-3 rounded-lg font-semibold" style="background:var(--app-green-50);color:var(--metro-green-dark);border:1px solid var(--app-border);">
                                    🔄 Refresh Bids Now
                                </button>
                                
                                <button onclick="app.setActiveView('emailSettings')" class="w-full px-6 py-3 rounded-lg font-semibold" style="background:var(--app-green-50);color:var(--metro-green-dark);border:1px solid var(--app-border);">
                                    ⚙️ Email Settings (OTP &amp; Notifications)
                                </button>

                                <button onclick="app.resetSystem()" class="w-full px-6 py-3 rounded-lg font-semibold" style="background:#ef4444; color:#ffffff;">
                                    🔄 Reset System
                                </button>

                                <div style="margin-top:12px;background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);border:2px solid #fb923c;border-radius:12px;padding:16px;">
                                    <!-- Section header -->
                                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #fed7aa;">
                                        <div style="width:32px;height:32px;background:#ea580c;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                                        </div>
                                        <div>
                                            <p style="font-size:0.85rem;font-weight:700;color:#9a3412;margin:0;line-height:1.2;">Maintenance Staff Processing</p>
                                            <p style="font-size:0.7rem;color:#c2410c;margin:0;">
                                                ${(this.state.maintenanceStaffUsers || []).length} staff loaded &bull; ${Object.keys(this.state.maintSlotCapacities || {}).length} slot keys
                                            </p>
                                        </div>
                                        <div style="margin-left:auto;background:${this.state.isMaintProcessed ? '#dcfce7' : '#fee2e2'};color:${this.state.isMaintProcessed ? '#166534' : '#991b1b'};font-size:0.65rem;font-weight:700;padding:3px 8px;border-radius:20px;white-space:nowrap;">
                                            ${this.state.isMaintProcessed ? '✅ DONE' : '⏳ PENDING'}
                                        </div>
                                    </div>
                                    <!-- Buttons -->
                                    <div style="display:flex;flex-direction:column;gap:8px;">
                                        <button
                                            onclick="app.processMaintBids()"
                                            ${this.state.isMaintProcessed ? 'disabled' : ''}
                                            style="width:100%;padding:10px 16px;background:${this.state.isMaintProcessed ? '#fdba74' : '#ea580c'};color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.85rem;cursor:${this.state.isMaintProcessed ? 'not-allowed' : 'pointer'};opacity:${this.state.isMaintProcessed ? '0.6' : '1'};transition:background 0.2s;"
                                            onmouseover="if(!this.disabled)this.style.background='#c2410c'"
                                            onmouseout="if(!this.disabled)this.style.background='#ea580c'"
                                        >
                                            ${this.state.isMaintProcessed ? '✅ Maintenance Bids Already Processed' : '🔧 Process Maintenance Bids'}
                                        </button>
                                        ${this.state.isMaintProcessed ? `
                                            <button onclick="app.renderMaintResultsView()"
                                                style="width:100%;padding:10px 16px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.85rem;cursor:pointer;"
                                                onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'">
                                                📋 View Maintenance Results
                                            </button>
                                            <button onclick="app.setActiveView('maintManualOverride')"
                                                style="width:100%;padding:10px 16px;background:#ea580c;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.85rem;cursor:pointer;"
                                                onmouseover="this.style.background='#c2410c'" onmouseout="this.style.background='#ea580c'">
                                                ✏️ Manual Override Maintenance Results
                                            </button>
                                            <button onclick="app.exportMaintResults()"
                                                style="width:100%;padding:10px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.85rem;cursor:pointer;"
                                                onmouseover="this.style.background='#15803d'" onmouseout="this.style.background='#16a34a'">
                                                📊 Export Maintenance Results to Excel
                                            </button>
                                            <button onclick="app.resetMaintProcessing()"
                                                style="width:100%;padding:10px 16px;background:#6b7280;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.85rem;cursor:pointer;"
                                                onmouseover="this.style.background='#4b5563'" onmouseout="this.style.background='#6b7280'">
                                                ↩️ Reset Maintenance Processing
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                            
                            <div class="p-4 rounded-lg" style="background:var(--app-green-50);">
                                <h3 class="font-bold mb-2" style="color:var(--app-text);">System Information</h3>
                                <div class="text-sm space-y-1" style="color:var(--app-text-muted);">
                                    <p>&bull; Scheduling Rows configured: ${allDepts.length}</p>
                                    <p>&bull; Slot capacities configured: ${Object.keys(this.state.slotCapacities).length > 0 ? 'Yes' : 'No'}</p>
                                    <p>&bull; Bidding year (Ops/Maint): ${this.state.biddingYear}</p>
                                    <p>&bull; Bidding year (Corporate/GC): ${this.state.biddingYearCorp}</p>
                                    <p>&bull; Last sync: ${this.state.employees.length > 0 ? 'Data loaded' : 'No data'}</p>
                                </div>
                            </div>

                            <!-- Staff Bids Details Section -->
                        <div class="mt-6 rounded-xl overflow-hidden" style="background:var(--app-card);border:2px solid var(--app-border);">
                            <div class="px-6 py-4" style="background:var(--app-green-50);border-bottom:1px solid var(--app-border);">
                                <div class="flex justify-between items-center mb-3">
                                    <div>
                                        <h3 class="text-xl font-bold" style="font-family:'Barlow Condensed',sans-serif;color:var(--metro-green-dark);">📋 Bid Details</h3>
                                        <p class="text-sm mt-1" style="color:var(--app-text-muted);">Bids sorted by seniority. Updates every 15 seconds.</p>
                                    </div>
                                    <span class="px-3 py-1 rounded-full text-sm font-semibold" style="background:var(--app-green-100);color:var(--metro-green-dark);">
                                        <span id="adminBidCount2">${this.state.bids.length}</span> total bids
                                    </span>
                                </div>
                                <!-- Tab switcher -->
                                <div class="flex gap-2 flex-wrap">
                                    <button id="bidTabEmp" onclick="app._switchBidTab('employees')"
                                        style="padding:7px 18px;border-radius:8px;font-size:0.85rem;font-weight:600;border:none;cursor:pointer;background:var(--metro-green);color:#fff;">
                                        👤 Employees
                                        <span style="margin-left:6px;background:rgba(255,255,255,0.25);border-radius:12px;padding:1px 7px;font-size:0.78rem;">
                                            ${this.state.bids.filter(b => !this._isGcOrCs(b.employeeId) && !this._isMaintStaff(b.employeeId, b)).length}
                                        </span>
                                    </button>
                                    <button id="bidTabGcCs" onclick="app._switchBidTab('gccs')"
                                        style="padding:7px 18px;border-radius:8px;font-size:0.85rem;font-weight:600;border:none;cursor:pointer;background:#f3f4f6;color:#374151;">
                                        ⭐ GC & Corporate Staff
                                        <span style="margin-left:6px;background:rgba(0,0,0,0.08);border-radius:12px;padding:1px 7px;font-size:0.78rem;">
                                            ${this.state.bids.filter(b => this._isGcOrCs(b.employeeId) && !this._isHrCorporate(b.employeeId)).length}
                                        </span>
                                    </button>
                                    <button id="bidTabHr" onclick="app._switchBidTab('hrcorp')"
                                        style="padding:7px 18px;border-radius:8px;font-size:0.85rem;font-weight:600;border:none;cursor:pointer;background:#f3f4f6;color:#374151;">
                                        🏢 HR Corporate
                                        <span style="margin-left:6px;background:rgba(0,0,0,0.08);border-radius:12px;padding:1px 7px;font-size:0.78rem;">
                                            ${this.state.bids.filter(b => this._isHrCorporate(b.employeeId)).length}
                                        </span>
                                    </button>
                                    <button id="bidTabMaint" onclick="app._switchBidTab('maint')"
                                        style="padding:7px 18px;border-radius:8px;font-size:0.85rem;font-weight:600;border:none;cursor:pointer;background:#f3f4f6;color:#374151;">
                                        🔧 Maintenance Staff
                                        <span style="margin-left:6px;background:rgba(0,0,0,0.08);border-radius:12px;padding:1px 7px;font-size:0.78rem;">
                                            ${this.state.bids.filter(b => this._isMaintStaff(b.employeeId, b)).length}
                                        </span>
                                    </button>
                                </div>
                            </div>
                            <div class="p-4" id="adminBidsTableContainer">
                                ${this._renderBidsTableHTML('', 'employees')}
                            </div>
                        </div>

                    </div>
                `;
            };

            app.showConfirmModal = function(message) {
                return new Promise(resolve => {
                    document.getElementById('appConfirmModalMessage').textContent = message;
                    document.getElementById('appConfirmModal').style.display = 'flex';
                    this._confirmModalResolve = resolve;
                });
            };

            app._resolveConfirmModal = function(result) {
                document.getElementById('appConfirmModal').style.display = 'none';
                if (this._confirmModalResolve) {
                    this._confirmModalResolve(result);
                    this._confirmModalResolve = null;
                }
            };

            app.previewAllocation = function() {
                if (this.state.employees.length === 0) {
                    alert('No employees to preview. Please upload data first.');
                    return;
                }

                if (Object.keys(this.state.slotCapacities).length === 0) {
                    alert('Please configure slot capacities first in "Configure Slots".');
                    this.setActiveView('configureSlots');
                    return;
                }

                const result = this.computeBidAllocation({ skipUnconfiguredConfirm: true });
                this.renderPreviewAllocationReport(result);
            };

            app.renderPreviewAllocationReport = function(result) {
                const { positionGroups, slotAssignments, unconfiguredDepts } = result;

                // Corporate Staff bid separately via the Corporate Staff bidding flow and
                // are not part of Ops/Maintenance seniority allocation — exclude them here.
                const isCorporateStaffDept = (dept) => /corporate staff/i.test(dept || '');
                const sortedGroupKeys = result.sortedGroupKeys.filter(groupKey => {
                    const [, dept] = groupKey.split('||');
                    return !isCorporateStaffDept(dept);
                });

                // Recompute the summary stats from the filtered groups only, so the
                // cards above the report match what's actually displayed.
                const filteredEmployeeIds = new Set();
                sortedGroupKeys.forEach(groupKey => {
                    (positionGroups[groupKey] || []).forEach(emp => filteredEmployeeIds.add(emp.id));
                });
                const filteredAssignments = slotAssignments.filter(a => filteredEmployeeIds.has(a.employeeId));
                const stats = {
                    totalEmployees: filteredEmployeeIds.size,
                    bidAwarded: filteredAssignments.filter(r => r.type === 'Bid Awarded').length,
                    autoAssigned: filteredAssignments.filter(r => r.type === 'Auto-Assigned').length,
                    datesDrifted: filteredAssignments.filter(r => r.datesDrifted).length
                };

                // Keep a filtered snapshot around so the "Export to Excel" button
                // exports exactly what's shown (Corporate Staff excluded).
                this._lastPreviewExport = { sortedGroupKeys, positionGroups, slotAssignments: filteredAssignments };

                const assignmentsByEmp = {};
                slotAssignments.forEach(a => {
                    if (!assignmentsByEmp[a.employeeId]) assignmentsByEmp[a.employeeId] = [];
                    assignmentsByEmp[a.employeeId].push(a);
                });

                const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

                const summaryHtml = `
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
                        <div style="background:#f0fdf4;border-radius:8px;padding:10px;"><p style="font-size:1.3rem;font-weight:700;color:#166534;">${stats.totalEmployees}</p><p style="font-size:0.7rem;color:#6b7280;">Employees</p></div>
                        <div style="background:#eff6ff;border-radius:8px;padding:10px;"><p style="font-size:1.3rem;font-weight:700;color:#1e40af;">${stats.bidAwarded}</p><p style="font-size:0.7rem;color:#6b7280;">Bid Awards</p></div>
                        <div style="background:#fefce8;border-radius:8px;padding:10px;"><p style="font-size:1.3rem;font-weight:700;color:#854d0e;">${stats.autoAssigned}</p><p style="font-size:0.7rem;color:#6b7280;">Auto-Assigned</p></div>
                    </div>`;

                const warningHtml = unconfiguredDepts.length > 0 ? `
                    <div style="padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:0.78rem;margin-bottom:16px;">
                        ⚠️ No slot capacity configured for: ${unconfiguredDepts.map(esc).join(', ')}
                    </div>` : '';

                // Note: schedule-drift info (bids honored with dates that no longer match
                // the live "Configure Slots" config) is intentionally NOT surfaced here in
                // Preview Allocation — it's noise for a quick preview. It's still tracked on
                // each result (`datesDrifted`) and surfaced where it's actually actionable:
                // the "Process All Bids" completion summary, the console log, and inline on
                // the Manual Override screen.

                const groupsData = sortedGroupKeys.map(groupKey => {
                    const [pos, dept] = groupKey.split('||');
                    const employees = positionGroups[groupKey];
                    const rows = employees.map((emp, idx) => {
                        const assigns = assignmentsByEmp[emp.id] || [];
                        const awardedHtml = assigns.length > 0
                            ? assigns.map(a => `<div>${esc(a.slotName)} · ${esc(this.blockLabel(a.month))} ${esc(a.startDate)}→${esc(a.endDate)} <span style="color:${a.type === 'Bid Awarded' ? '#166534' : '#854d0e'};font-weight:600;">(${esc(a.type)})</span></div>`).join('')
                            : '<span style="color:#dc2626;font-weight:600;">No slot awarded</span>';
                        return `<tr style="border-top:1px solid #f0f0f0;">
                            <td style="padding:6px 10px;font-weight:700;color:#6b7280;">#${idx + 1}</td>
                            <td style="padding:6px 10px;">${esc(emp.name)} <span style="color:#9ca3af;font-size:0.72rem;">(${esc(emp.id)})</span></td>
                            <td style="padding:6px 10px;font-size:0.75rem;color:#6b7280;">${esc(emp.seniorityDate)}</td>
                            <td style="padding:6px 10px;font-size:0.75rem;">${awardedHtml}</td>
                        </tr>`;
                    }).join('');
                    const html = `
                    <div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
                        <div style="background:#f3f4f6;padding:8px 14px;font-weight:700;font-size:0.82rem;">${esc(pos)} — ${esc(dept)} <span style="font-weight:400;color:#6b7280;">(${employees.length} competing)</span></div>
                        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
                            <thead><tr style="background:#fafafa;text-align:left;color:#6b7280;font-size:0.7rem;text-transform:uppercase;position:sticky;top:0;z-index:1;">
                                <th style="padding:6px 10px;background:#fafafa;">Rank</th><th style="padding:6px 10px;background:#fafafa;">Employee</th><th style="padding:6px 10px;background:#fafafa;">Seniority Date</th><th style="padding:6px 10px;background:#fafafa;">Awarded</th>
                            </tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>`;
                    return { pos, dept, html };
                });

                // Keep the summary/warning HTML and per-group data around so the position
                // search box can re-filter and re-render without recomputing the allocation.
                this._lastPreviewGroupsData = groupsData;
                this._lastPreviewSummaryWarningHtml = summaryHtml + warningHtml;

                const searchInput = document.getElementById('previewAllocationPositionSearch');
                if (searchInput) searchInput.value = '';

                document.getElementById('previewAllocationBody').innerHTML = summaryHtml + warningHtml + groupsData.map(g => g.html).join('');
                document.getElementById('previewAllocationModal').style.display = 'flex';
            };

            app._filterPreviewAllocationByPosition = function() {
                const groupsData = this._lastPreviewGroupsData || [];
                const summaryWarningHtml = this._lastPreviewSummaryWarningHtml || '';
                const query = (document.getElementById('previewAllocationPositionSearch')?.value || '').trim().toLowerCase();

                const filtered = query
                    ? groupsData.filter(g => (g.pos || '').toLowerCase().includes(query))
                    : groupsData;

                const noMatchHtml = query && filtered.length === 0
                    ? `<div style="padding:14px;text-align:center;color:#6b7280;font-size:0.85rem;">No positions match "${query.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}".</div>`
                    : '';

                document.getElementById('previewAllocationBody').innerHTML =
                    summaryWarningHtml + noMatchHtml + filtered.map(g => g.html).join('');
            };

            app.exportPreviewAllocationToExcel = function() {
                const snapshot = this._lastPreviewExport;
                if (!snapshot || !snapshot.sortedGroupKeys.length) {
                    alert('Nothing to export yet — run Preview Allocation first.');
                    return;
                }
                const { sortedGroupKeys, positionGroups, slotAssignments } = snapshot;

                const assignmentsByEmp = {};
                slotAssignments.forEach(a => {
                    if (!assignmentsByEmp[a.employeeId]) assignmentsByEmp[a.employeeId] = [];
                    assignmentsByEmp[a.employeeId].push(a);
                });

                const wsData = [
                    ['Position', 'Department', 'Rank', 'Employee ID', 'Employee Name', 'Seniority Date',
                     'Slot Name', 'Month', 'Start Date', 'End Date', 'Assignment Type']
                ];

                sortedGroupKeys.forEach(groupKey => {
                    const [pos, dept] = groupKey.split('||');
                    positionGroups[groupKey].forEach((emp, idx) => {
                        const assigns = assignmentsByEmp[emp.id] || [];
                        if (assigns.length === 0) {
                            wsData.push([pos, dept, idx + 1, emp.id, emp.name, emp.seniorityDate, 'No slot awarded', '', '', '', '']);
                        } else {
                            assigns.forEach(a => {
                                wsData.push([pos, dept, idx + 1, emp.id, emp.name, emp.seniorityDate, a.slotName, a.month, a.startDate, a.endDate, a.type]);
                            });
                        }
                    });
                });

                const ws = XLSX.utils.aoa_to_sheet(wsData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Preview Allocation');
                XLSX.writeFile(wb, `Preview_Allocation_${this.state.biddingYear}.xlsx`);
            };

            app.exportMaintResults = function() {
                const maintResults = this.state.maintResults || [];
                if (!maintResults.length) { alert('No maintenance results to export. Process maintenance bids first.'); return; }
                const empTotalDays = {};
                maintResults.forEach(r => { empTotalDays[r.employeeId] = (empTotalDays[r.employeeId] || 0) + (r.days || 0); });
                const wsData = [['Rank','Staff ID','Name','Position','Department','Slot','Month','Start','End','Days','Type','Total Days']];
                maintResults.forEach(r => wsData.push([
                    r.positionSeniorityRank || r.seniorityRank || '',
                    r.employeeId, r.employeeName, r.position || '', r.department || '',
                    r.slotName || '', r.month || '', r.startDate || '', r.endDate || '',
                    r.days || 0, r.type || '', empTotalDays[r.employeeId] || 0
                ]));
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), 'Maintenance Results');
                XLSX.writeFile(wb, 'maintenance_bid_results_' + this.state.biddingYear + '.xlsx');
            };

            app.resetMaintProcessing = async function() {
                if (!confirm('Reset maintenance processing? This will clear all maintenance results.')) return;
                this.state.maintResults = [];
                this.state.isMaintProcessed = false;
                await this.saveConfigToSupabase();
                this.renderAdminView();
            };

            app.renderMaintResultsView = function() {
                const contentEl = document.getElementById('contentArea');
                const maintResults = this.state.maintResults || [];
                const maintUsers = this.state.maintenanceStaffUsers || [];
                const getUserInfo = (id) => maintUsers.find(u => u.id === id) || {};

                const byEmployee = {};
                maintResults.forEach(r => {
                    if (!byEmployee[r.employeeId]) byEmployee[r.employeeId] = [];
                    byEmployee[r.employeeId].push(r);
                });

                const slotCell = (s) => {
                    if (!s) return '<span class="text-gray-300">&#8212;</span>';
                    const tc = s.type === 'Bid Awarded' ? 'text-green-600' : 'text-blue-600';
                    return '<span class="font-semibold">' + (s.slotName || '') + '</span><br>'
                         + '<span class="text-xs text-gray-500">' + (s.month || '') + ': ' + (s.startDate || '') + ' &#8594; ' + (s.endDate || '') + '</span><br>'
                         + '<span class="text-xs font-semibold ' + tc + '">' + (s.type || '') + '</span>'
                         + ' <span class="text-xs text-gray-400">(' + (s.days || 0) + 'd)</span>';
                };

                let rows = '';
                Object.entries(byEmployee).forEach(([empId, slots], rowIdx) => {
                    const user  = getUserInfo(empId);
                    const slot1 = slots.find(s => s.slotOrder === 1);
                    const slot2 = slots.find(s => s.slotOrder === 2);
                    const total = slots.reduce((s, r) => s + r.days, 0);
                    const rowBg = rowIdx % 2 === 0 ? 'bg-white' : 'bg-orange-50';
                    const tc    = total > 30 ? 'text-red-600' : 'text-gray-800';
                    const rank  = slot1 ? (slot1.positionSeniorityRank || slot1.seniorityRank || '&#8212;') : '&#8212;';
                    rows += '<tr class="' + rowBg + ' hover:bg-yellow-50 border-b border-gray-100">'
                          + '<td class="p-3 text-center font-mono text-gray-500">#' + rank + '</td>'
                          + '<td class="p-3 font-mono text-xs text-gray-600">' + empId + '</td>'
                          + '<td class="p-3 font-semibold text-gray-800">' + (user.name || (slot1 && slot1.employeeName) || 'Unknown') + '</td>'
                          + '<td class="p-3 text-xs text-gray-600">' + (user.position || (slot1 && slot1.position) || '&#8212;')
                          + '<br><span class="text-gray-400">' + (user.department || (slot1 && slot1.department) || '') + '</span></td>'
                          + '<td class="p-3 text-xs text-gray-600">' + ((slot1 && slot1.yearsOfService) || '&#8212;') + ' yrs</td>'
                          + '<td class="p-3 text-xs">' + slotCell(slot1) + '</td>'
                          + '<td class="p-3 text-xs">' + slotCell(slot2) + '</td>'
                          + '<td class="p-3 font-bold text-center ' + tc + '">' + total + 'd'
                          + '<br><span class="text-xs font-normal text-gray-400">/ 30</span></td>'
                          + '</tr>';
                });

                const totalStaff   = Object.keys(byEmployee).length;
                const bidAwarded   = maintResults.filter(r => r.type === 'Bid Awarded').length;
                const autoAssigned = maintResults.filter(r => r.type === 'Auto-Assigned').length;
                const totalDays    = maintResults.reduce((s, r) => s + r.days, 0);

                const emptyHtml =
                    '<div class="text-center py-12">'
                    + '<p class="text-gray-600 font-semibold text-xl mb-2">No maintenance results yet</p>'
                    + '<p class="text-gray-400 text-sm">Process maintenance bids from the Admin panel first.</p>'
                    + '<button onclick="app.setActiveView(\'admin\')" class="mt-4 px-4 py-2 rounded-lg text-sm font-semibold" style="background:#f97316; color:#ffffff;">Go to Admin Panel</button>'
                    + '</div>';

                const statsHtml =
                    '<div class="mb-4 flex flex-wrap gap-3 text-sm">'
                    + '<span class="bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">' + totalStaff + ' staff</span>'
                    + '<span class="bg-green-50 border border-green-200 px-3 py-1 rounded-full">&#10003; ' + bidAwarded + ' bid awards</span>'
                    + '<span class="bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">' + autoAssigned + ' auto-assigned</span>'
                    + '<span class="bg-gray-50 border border-gray-200 px-3 py-1 rounded-full">' + totalDays + ' total days</span>'
                    + '</div>';

                const tableHtml =
                    statsHtml
                    + '<div class="overflow-x-auto"><table class="w-full text-sm border-collapse">'
                    + '<thead class="bg-orange-50"><tr>'
                    + '<th class="p-3 text-left border border-orange-100 font-semibold text-orange-800">Rank</th>'
                    + '<th class="p-3 text-left border border-orange-100 font-semibold text-orange-800">Staff ID</th>'
                    + '<th class="p-3 text-left border border-orange-100 font-semibold text-orange-800">Name</th>'
                    + '<th class="p-3 text-left border border-orange-100 font-semibold text-orange-800">Position</th>'
                    + '<th class="p-3 text-left border border-orange-100 font-semibold text-orange-800">Seniority</th>'
                    + '<th class="p-3 text-left border border-orange-100 font-semibold text-orange-800">Slot 1</th>'
                    + '<th class="p-3 text-left border border-orange-100 font-semibold text-orange-800">Slot 2</th>'
                    + '<th class="p-3 text-left border border-orange-100 font-semibold text-orange-800">Total Days</th>'
                    + '</tr></thead>'
                    + '<tbody>' + rows + '</tbody>'
                    + '</table></div>';

                contentEl.innerHTML =
                    '<div class="max-w-7xl mx-auto"><div class="bg-white rounded-xl shadow-xl p-6">'
                    + '<div class="flex items-center justify-between mb-6">'
                    + '<div><h2 class="text-2xl font-bold">Maintenance Staff Leave Assignments ' + this.state.biddingYear + '</h2>'
                    + '<p class="text-gray-500 text-sm mt-1">Seniority-based per position group. Entitlement: 30 days.</p></div>'
                    + '<div class="flex gap-2">'
                    + '<button onclick="app.exportMaintResults()" class="px-4 py-2 rounded-lg text-sm font-semibold" style="background:#16a34a; color:#ffffff;">Export to Excel</button>'
                    + '<button onclick="app.setActiveView(\'admin\')" class="px-4 py-2 rounded-lg text-sm font-semibold" style="background:#e5e7eb; color:#374151;">Back to Admin</button>'
                    + '</div></div>'
                    + (maintResults.length === 0 ? emptyHtml : tableHtml)
                    + '</div></div>';
            };

            app.exportResults = function() {
                if (this.state.results.length === 0) {
                    alert('No results to export');
                    return;
                }
                
                // Create Excel workbook
                const wsData = [
                    ['Seniority Rank (within Position Group)', 'Employee ID', 'Employee Name', 'Position (Scheduling Row)', 'Department', 'Slot Type', 
                     'Month', 'Start Date', 'End Date', 'Days', 'Assignment Type', 'Total Days (Employee)']
                ];

                // Group results by employee so we can compute total days per employee
                const empTotalDays = {};
                this.state.results.forEach(result => {
                    empTotalDays[result.employeeId] = (empTotalDays[result.employeeId] || 0) + (result.days || 0);
                });
                
                this.state.results.forEach(result => {
                    const emp = this.state.employees.find(e => e.id === result.employeeId);
                    wsData.push([
                        result.seniorityRank,
                        result.employeeId,
                        result.employeeName,
                        emp?.position || result.position || '',
                        result.department,
                        result.slotName,
                        result.month,
                        result.startDate,
                        result.endDate,
                        result.days,
                        result.type,
                        empTotalDays[result.employeeId] || result.days
                    ]);
                });
                
                const ws = XLSX.utils.aoa_to_sheet(wsData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Leave Assignments');
                XLSX.writeFile(wb, `Leave_Assignments_${this.state.biddingYear}.xlsx`);
                
                alert('✅ Results exported to Excel file!');
            };

            app.resetSystem = async function() {
                if (confirm('⚠️ WARNING: This will reset employees, bids, results, and on-call dates. Slot configuration (calendar dates) is NOT affected — use "Reset to Default Dates" on a department if you need to clear that separately. Continue?')) {
                    this.writeAuditLog('SYSTEM_RESET', { employees: this.state.employees.length, bids: this.state.bids.length });
                    localStorage.clear();
                    this.state.employees = [];
                    this.state.bids = [];
                    this.state.results = [];
                    this.state.isProcessed = false;
                    this.state.isProcessedCorp = false;
                    this.state.onCallDates = {};
                    this.state.currentUser = null;
                    this.state.userType = null;
                    this.state.activeView = 'login';
                    await this.saveConfigToSupabase(); // push reset state to Supabase
                    // Reset UI
                    document.getElementById('userInfo').classList.add('hidden');
                    this._syncHeaderOffset();
                    document.getElementById('plannerSidebar').classList.add('hidden');
                    document.getElementById('headerSaveBtn').classList.add('hidden');
                    document.getElementById('plannerNav').classList.add('hidden');
                    document.getElementById('employeeNav').classList.add('hidden');
                    document.getElementById('loginView').classList.remove('hidden');
                    
                    this.updateSystemStatus('System reset');
                    this.renderLoginForm();
                    
                    alert('✅ System has been completely reset!');
                }
            };

            app.setBiddingDeadline = function(val) {
                if (val && /T00:00(:00)?$/.test(val)) {
                    val = val.slice(0, 10) + 'T23:59';
                }
                this.state.biddingDeadline = val;
                this.saveConfigToSupabase();
            };

            app.setBiddingDeadlineCorp = function(val) {
                if (val && /T00:00(:00)?$/.test(val)) {
                    val = val.slice(0, 10) + 'T23:59';
                }
                this.state.biddingDeadlineCorp = val;
                this.saveConfigToSupabase();
            };

            app.setBiddingYearCorp = function(year) {
                this.state.biddingYearCorp = year;
                this.saveConfigToSupabase();
                this.renderAdminView();
            };

            app.toggleCorpLock = function() {
                const turningOn = !this.state.isProcessedCorp;
                if (turningOn && !confirm('Lock Corporate & Golden Command bidding? They will no longer be able to submit or remove bids until unlocked.')) return;
                this.state.isProcessedCorp = turningOn;
                this.writeAuditLog(turningOn ? 'CORP_BIDDING_LOCKED' : 'CORP_BIDDING_UNLOCKED', {});
                this.saveConfigToSupabase();
                this.renderAdminView();
            };

            app.renderManualOverrideView = function() {
                const content = document.getElementById('contentArea');
                if (!this.state.isProcessed || this.state.results.length === 0) {
                    content.innerHTML = `
                        <div class="max-w-2xl mx-auto bg-white rounded-xl shadow-xl p-8 text-center">
                            <p class="text-2xl mb-4">⚠️</p>
                            <p class="text-gray-600">No results to override. Process bids first.</p>
                            <button onclick="app.setActiveView('admin')" class="mt-4 px-6 py-2 rounded-lg" style="background:#3b82f6; color:#ffffff;">Go to Admin Panel</button>
                        </div>`;
                    return;
                }

                // Group results by employee
                const empMap = {};
                this.state.results.forEach(r => {
                    if (!empMap[r.employeeId]) empMap[r.employeeId] = [];
                    empMap[r.employeeId].push(r);
                });

                content.innerHTML = `
                    <div class="max-w-5xl mx-auto">
                        <div class="bg-white rounded-xl shadow-xl p-6">
                            <div class="flex items-center justify-between mb-6">
                                <div>
                                    <h2 class="text-2xl font-bold">✏️ Manual Override</h2>
                                    <p class="text-sm text-gray-500 mt-1">Edit any employee's assigned leave slots directly.</p>
                                </div>
                                <button onclick="app.setActiveView('dashboard')" class="px-4 py-2 rounded-lg text-sm" style="background:#f3f4f6; color:#374151;">← Back</button>
                            </div>
                            <div id="overrideMsg"></div>
                            <div class="overflow-x-auto">
                                <table class="w-full text-sm">
                                    <thead class="bg-gray-50 text-gray-600">
                                        <tr>
                                            <th class="p-3 text-left">Operation Staff</th>
                                            <th class="p-3 text-left">Slot</th>
                                            <th class="p-3 text-left">Slot Name</th>
                                            <th class="p-3 text-left">Start Date</th>
                                            <th class="p-3 text-left">End Date</th>
                                            <th class="p-3 text-left">Days</th>
                                            <th class="p-3 text-left">Type</th>
                                            <th class="p-3 text-left">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${Object.entries(empMap).map(([empId, slots]) => {
                                            const emp = this.state.employees.find(e => e.id === empId);
                                            return slots.sort((a,b)=>(a.slotOrder||0)-(b.slotOrder||0)).map((r, i) => `
                                                <tr class="border-b hover:bg-gray-50" id="row-${empId}-${r.slotOrder}">
                                                    ${i===0 ? `<td class="p-3 font-semibold" rowspan="${slots.length}">${emp?.name||empId}<br><span class="text-xs text-gray-400">${empId}</span></td>` : ''}
                                                    <td class="p-3 text-gray-500">Slot ${r.slotOrder}</td>
                                                    <td class="p-3">
                                                        <input type="text" class="border rounded px-2 py-1 w-28 text-xs" value="${r.slotName||''}" id="ov-slotName-${empId}-${r.slotOrder}" />
                                                    </td>
                                                    <td class="p-3">
                                                        <input type="date" class="border rounded px-2 py-1 text-xs" value="${r.startDate||''}" id="ov-start-${empId}-${r.slotOrder}" />
                                                    </td>
                                                    <td class="p-3">
                                                        <input type="date" class="border rounded px-2 py-1 text-xs" value="${r.endDate||''}" id="ov-end-${empId}-${r.slotOrder}" />
                                                    </td>
                                                    <td class="p-3">
                                                        <input type="number" class="border rounded px-2 py-1 w-16 text-xs" value="${r.days||0}" id="ov-days-${empId}-${r.slotOrder}" min="1" max="60" />
                                                    </td>
                                                    <td class="p-3">
                                                        <select class="border rounded px-2 py-1 text-xs" id="ov-type-${empId}-${r.slotOrder}">
                                                            <option value="Bid Awarded" ${r.type==='Bid Awarded'?'selected':''}>Bid Awarded</option>
                                                            <option value="Auto-Assigned" ${r.type==='Auto-Assigned'?'selected':''}>Auto-Assigned</option>
                                                            <option value="Manual Override" ${r.type==='Manual Override'?'selected':''}>Manual Override</option>
                                                        </select>
                                                    </td>
                                                    <td class="p-3">
                                                        <button onclick="app.saveOverride('${empId}', ${r.slotOrder})" class="px-3 py-1 rounded text-xs font-semibold" style="background:#f97316; color:#ffffff;">Save</button>
                                                    </td>
                                                </tr>
                                            `).join('');
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <div class="mt-6 flex gap-3">
                                <button onclick="app.saveAllOverrides()" class="px-6 py-3 rounded-lg font-semibold" style="background:#22c55e; color:#ffffff;">💾 Save All Changes to Database</button>
                                <button onclick="app.setActiveView('dashboard')" class="px-6 py-3 rounded-lg font-semibold" style="background:#9ca3af; color:#ffffff;">Cancel</button>
                            </div>
                        </div>
                    </div>
                `;
            };

            app.saveOverride = function(empId, slotOrder) {
                const idx = this.state.results.findIndex(r => r.employeeId === empId && r.slotOrder === slotOrder);
                if (idx === -1) { alert('Result not found'); return; }
                this.state.results[idx].slotName  = document.getElementById(`ov-slotName-${empId}-${slotOrder}`)?.value || this.state.results[idx].slotName;
                this.state.results[idx].startDate = document.getElementById(`ov-start-${empId}-${slotOrder}`)?.value || this.state.results[idx].startDate;
                this.state.results[idx].endDate   = document.getElementById(`ov-end-${empId}-${slotOrder}`)?.value   || this.state.results[idx].endDate;
                this.state.results[idx].days      = parseInt(document.getElementById(`ov-days-${empId}-${slotOrder}`)?.value) || this.state.results[idx].days;
                this.state.results[idx].type      = document.getElementById(`ov-type-${empId}-${slotOrder}`)?.value || this.state.results[idx].type;
                this.saveState();
                const msg = document.getElementById('overrideMsg');
                if (msg) { msg.innerHTML = `<div class="mb-3 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">✅ Slot ${slotOrder} for ${this.state.employees.find(e=>e.id===empId)?.name||empId} updated locally. Click "Save All" to push to database.</div>`; }
            };

            app.saveAllOverrides = async function() {
                this.saveState();
                this.writeAuditLog('MANUAL_OVERRIDE', { total_results: this.state.results.length });
                try {
                    if (this.supabase) {
                        const { error } = await this.supabase.from('system_config_82').update({ results: this.state.results }).eq('id', 1);
                        if (error) throw error;
                    }
                    const msg = document.getElementById('overrideMsg');
                    if (msg) msg.innerHTML = `<div class="mb-3 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">✅ All overrides saved to database successfully!</div>`;
                } catch(err) {
                    console.error(err);
                    const msg = document.getElementById('overrideMsg');
                    if (msg) msg.innerHTML = `<div class="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">❌ Database save failed. Changes saved locally only.</div>`;
                }
            };

            app.renderMaintManualOverrideView = function() {
                const content = document.getElementById('contentArea');
                if (!this.state.isMaintProcessed || (this.state.maintResults || []).length === 0) {
                    content.innerHTML = `
                        <div class="max-w-2xl mx-auto bg-white rounded-xl shadow-xl p-8 text-center">
                            <p class="text-2xl mb-4">⚠️</p>
                            <p class="text-gray-600">No maintenance results to override. Process maintenance bids first.</p>
                            <button onclick="app.setActiveView('admin')" class="mt-4 px-6 py-2 rounded-lg" style="background:#3b82f6; color:#ffffff;">Go to Admin Panel</button>
                        </div>`;
                    return;
                }

                // Group maintenance results by employee
                const empMap = {};
                this.state.maintResults.forEach(r => {
                    if (!empMap[r.employeeId]) empMap[r.employeeId] = [];
                    empMap[r.employeeId].push(r);
                });

                content.innerHTML = `
                    <div class="max-w-5xl mx-auto">
                        <div class="bg-white rounded-xl shadow-xl p-6">
                            <div class="flex items-center justify-between mb-6">
                                <div>
                                    <h2 class="text-2xl font-bold">✏️ Maintenance Manual Override</h2>
                                    <p class="text-sm text-gray-500 mt-1">Edit any maintenance employee's assigned leave slots directly.</p>
                                </div>
                                <button onclick="app.setActiveView('dashboard')" class="px-4 py-2 rounded-lg text-sm" style="background:#f3f4f6; color:#374151;">← Back</button>
                            </div>
                            <div id="maintOverrideMsg"></div>
                            <div class="overflow-x-auto">
                                <table class="w-full text-sm">
                                    <thead class="bg-gray-50 text-gray-600">
                                        <tr>
                                            <th class="p-3 text-left">Maintenance Staff</th>
                                            <th class="p-3 text-left">Slot</th>
                                            <th class="p-3 text-left">Slot Name</th>
                                            <th class="p-3 text-left">Start Date</th>
                                            <th class="p-3 text-left">End Date</th>
                                            <th class="p-3 text-left">Days</th>
                                            <th class="p-3 text-left">Type</th>
                                            <th class="p-3 text-left">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${Object.entries(empMap).map(([empId, slots]) => {
                                            const emp = (this.state.maintenanceStaffUsers || []).find(e => e.id === empId);
                                            return slots.sort((a,b)=>(a.slotOrder||0)-(b.slotOrder||0)).map((r, i) => `
                                                <tr class="border-b hover:bg-gray-50" id="maint-row-${empId}-${r.slotOrder}">
                                                    ${i===0 ? `<td class="p-3 font-semibold" rowspan="${slots.length}">${emp?.name||r.employeeName||empId}<br><span class="text-xs text-gray-400">${empId}</span></td>` : ''}
                                                    <td class="p-3 text-gray-500">Slot ${r.slotOrder}</td>
                                                    <td class="p-3">
                                                        <input type="text" class="border rounded px-2 py-1 w-28 text-xs" value="${r.slotName||''}" id="ov-maint-slotName-${empId}-${r.slotOrder}" />
                                                    </td>
                                                    <td class="p-3">
                                                        <input type="date" class="border rounded px-2 py-1 text-xs" value="${r.startDate||''}" id="ov-maint-start-${empId}-${r.slotOrder}" />
                                                    </td>
                                                    <td class="p-3">
                                                        <input type="date" class="border rounded px-2 py-1 text-xs" value="${r.endDate||''}" id="ov-maint-end-${empId}-${r.slotOrder}" />
                                                    </td>
                                                    <td class="p-3">
                                                        <input type="number" class="border rounded px-2 py-1 w-16 text-xs" value="${r.days||0}" id="ov-maint-days-${empId}-${r.slotOrder}" min="1" max="60" />
                                                    </td>
                                                    <td class="p-3">
                                                        <select class="border rounded px-2 py-1 text-xs" id="ov-maint-type-${empId}-${r.slotOrder}">
                                                            <option value="Bid Awarded" ${r.type==='Bid Awarded'?'selected':''}>Bid Awarded</option>
                                                            <option value="Auto-Assigned" ${r.type==='Auto-Assigned'?'selected':''}>Auto-Assigned</option>
                                                            <option value="Manual Override" ${r.type==='Manual Override'?'selected':''}>Manual Override</option>
                                                        </select>
                                                    </td>
                                                    <td class="p-3">
                                                        <button onclick="app.saveMaintOverride('${empId}', ${r.slotOrder})" class="px-3 py-1 rounded text-xs font-semibold" style="background:#f97316; color:#ffffff;">Save</button>
                                                    </td>
                                                </tr>
                                            `).join('');
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <div class="mt-6 flex gap-3">
                                <button onclick="app.saveAllMaintOverrides()" class="px-6 py-3 rounded-lg font-semibold" style="background:#22c55e; color:#ffffff;">💾 Save All Changes to Database</button>
                                <button onclick="app.setActiveView('dashboard')" class="px-6 py-3 rounded-lg font-semibold" style="background:#9ca3af; color:#ffffff;">Cancel</button>
                            </div>
                        </div>
                    </div>
                `;
            };

            app.saveMaintOverride = function(empId, slotOrder) {
                const idx = this.state.maintResults.findIndex(r => r.employeeId === empId && r.slotOrder === slotOrder);
                if (idx === -1) { alert('Result not found'); return; }
                this.state.maintResults[idx].slotName  = document.getElementById(`ov-maint-slotName-${empId}-${slotOrder}`)?.value || this.state.maintResults[idx].slotName;
                this.state.maintResults[idx].startDate = document.getElementById(`ov-maint-start-${empId}-${slotOrder}`)?.value || this.state.maintResults[idx].startDate;
                this.state.maintResults[idx].endDate   = document.getElementById(`ov-maint-end-${empId}-${slotOrder}`)?.value   || this.state.maintResults[idx].endDate;
                this.state.maintResults[idx].days      = parseInt(document.getElementById(`ov-maint-days-${empId}-${slotOrder}`)?.value) || this.state.maintResults[idx].days;
                this.state.maintResults[idx].type      = document.getElementById(`ov-maint-type-${empId}-${slotOrder}`)?.value || this.state.maintResults[idx].type;
                this.saveState();
                const msg = document.getElementById('maintOverrideMsg');
                if (msg) { msg.innerHTML = `<div class="mb-3 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">✅ Slot ${slotOrder} for ${(this.state.maintenanceStaffUsers || []).find(e=>e.id===empId)?.name||empId} updated locally. Click "Save All" to push to database.</div>`; }
            };

            app.saveAllMaintOverrides = async function() {
                this.saveState();
                this.writeAuditLog('MANUAL_OVERRIDE', { action: 'maintenance', total_results: this.state.maintResults.length });
                try {
                    if (this.supabase) {
                        const { error } = await this.supabase.from('system_config_82').update({ maint_results: this.state.maintResults }).eq('id', 1);
                        if (error) throw error;
                    }
                    const msg = document.getElementById('maintOverrideMsg');
                    if (msg) msg.innerHTML = `<div class="mb-3 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">✅ All maintenance overrides saved to database successfully!</div>`;
                } catch(err) {
                    console.error(err);
                    const msg = document.getElementById('maintOverrideMsg');
                    if (msg) msg.innerHTML = `<div class="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">❌ Database save failed. Changes saved locally only.</div>`;
                }
            };

