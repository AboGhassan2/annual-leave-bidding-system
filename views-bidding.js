// ════════════════════════════════════════════════════════════════════
// views-bidding.js — the Ops, Golden Command, and Corporate Staff
// leave-bid submission screens. This is the highest-traffic code in
// the app: real staff picking their real leave dates.
//
// Attaches onto the shared `app` object, must load AFTER app.js AND
// after utils.js (uses this.checkDateOverlap() from utils.js) and
// api-supabase.js (uses this.saveBidToSupabase()).
//
// Covers:
//   - Ops: renderEmployeeBiddingView, refreshAvailableSlots,
//     selectConfiguredSlot, isBiddingClosed, submitBid, removeBid,
//     renderMyResultsView, renderResultsView.
//   - Golden Command: renderGoldenCommandBiddingView,
//     setGCSelectedSlot, updateGCEndDate, updateGCDateInfo,
//     submitGCBid, removeGCBid.
//   - Corporate Staff: renderCorporateStaffBiddingView,
//     csSetSelectedSlot, csUpdateEndDate, _csCheckOnCallWarning,
//     submitCSBid, removeCSBid.
//   - isBiddingClosedCorp (shared deadline check for GC + CS).
//
// NOT included here (deliberately): setBiddingDeadline,
// setBiddingDeadlineCorp, setBiddingYearCorp, toggleCorpLock — these
// are admin actions (setting the deadline/year/lock state), not
// employee bidding actions, so they stay in app.js for now and will
// move to views-admin.js in the next batch.
// ════════════════════════════════════════════════════════════════════

            app.renderEmployeeBiddingView = function() {
                const content = document.getElementById('contentArea');
                if (!this.state.verifiedEmployee) {
                    content.innerHTML = '<p class="text-center">Please login first.</p>';
                    return;
                }
            
                // Calculate employee's leave entitlement
                const calculateYearsOfService = (seniorityDate) => {
                    const today = new Date();
                    const joinDate = new Date(seniorityDate);
                    const years = (today - joinDate) / (1000 * 60 * 60 * 24 * 365.25);
                    return years;
                };
            
                const getEmployeeEntitlement = (employee) => {
                    if (!employee || !employee.seniorityDate) return 30;
                    const yearsOfService = calculateYearsOfService(employee.seniorityDate);
                    return yearsOfService >= 5 ? 35 : 30;
                };
            
                const entitlement = getEmployeeEntitlement(this.state.verifiedEmployee);
                const yearsOfService = calculateYearsOfService(this.state.verifiedEmployee.seniorityDate);
                
                // Get employee's bids
                const userBids = this.state.bids.filter(bid => bid.employeeId === this.state.verifiedEmployee.id);
                const totalBidDays = userBids.reduce((sum, bid) => sum + bid.days, 0);
                const remainingLeave = entitlement - totalBidDays;
            
                // Countdown timer helper
                const deadlineCountdown = (() => {
                    if (!this.state.biddingDeadline) return '';
                    const dl = new Date(this.state.biddingDeadline);
                    const now = new Date();
                    const diff = dl - now;
                    if (diff <= 0) return `<div class="mb-4 bg-red-50 border border-red-300 rounded-xl p-3 text-center"><span class="text-red-700 font-bold">⛔ Bidding deadline has passed</span></div>`;
                    const days = Math.floor(diff / 86400000);
                    const hrs  = Math.floor((diff % 86400000) / 3600000);
                    const mins = Math.floor((diff % 3600000) / 60000);
                    const secs = Math.floor((diff % 60000) / 1000);
                    const urgency = diff < 3600000 ? 'bg-red-50 border-red-300 text-red-700' : diff < 86400000 ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'bg-green-50 border-green-300 text-green-700';
                    return `<div class="mb-4 border rounded-xl p-3 text-center ${urgency}">
                        <p class="text-xs font-semibold uppercase tracking-wide mb-1">⏰ Bidding Closes In</p>
                        <p class="text-2xl font-bold font-mono" id="countdownTimer">${days}d ${hrs}h ${mins}m ${secs}s</p>
                        <p class="text-xs mt-1">Deadline: ${dl.toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
                    </div>`;
                })();

                content.innerHTML = `
                    <div class="max-w-6xl mx-auto">
                        ${deadlineCountdown}
                        <!-- Header with leave entitlement -->
                        <div class="metro-card p-6 mb-6">
                            <h2 class="text-2xl font-bold mb-4" style="font-family:'Barlow Condensed',sans-serif;color:var(--app-text);">Leave Bidding for ${this.state.biddingYear}</h2>
                            
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div class="p-4 rounded-lg" style="background:var(--app-green-50);">
                                    <p class="text-2xl font-bold" style="color:var(--app-text);">${entitlement}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Total Leave Days</p>
                                    <p class="text-xs" style="color:var(--app-text-muted);">${yearsOfService.toFixed(1)} years of service</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background:var(--app-green-50);">
                                    <p class="text-2xl font-bold" style="color:var(--metro-green-dark);">${userBids.length}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Preferences Submitted</p>
                                    <p class="text-xs" style="color:var(--app-text-muted);">Max 2 per block</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background:var(--app-gold-50);">
                                    <p class="text-2xl font-bold" style="color:var(--metro-gold-dark);">${totalBidDays}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Days Requested</p>
                                    <p class="text-xs" style="color:var(--app-text-muted);">Across all preferences</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background:var(--app-green-50);">
                                    <p class="text-2xl font-bold" style="color:var(--app-text);">${entitlement}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Leave Entitlement</p>
                                    <p class="text-xs" style="color:var(--app-text-muted);">Final allocation by seniority</p>
                                </div>
                            </div>
            
                        </div>
            
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <!-- Left: Place New Bid -->
                            <div class="metro-card p-6">
                                <h3 class="text-xl font-bold mb-4" style="font-family:'Barlow Condensed',sans-serif;color:var(--app-text);">Place New Bid</h3>
                                
                                ${this.state.isProcessed ? `
                                    <div class="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
                                        <p class="font-semibold">⚠️ Bidding has been processed. No more bids allowed.</p>
                                    </div>
                                ` : ''}
                                
                                ${userBids.length >= 2 ? `
                                    <div class="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                                        <p class="font-semibold text-blue-800">ℹ️ You have submitted ${userBids.length} preference(s) total.</p>
                                        <p class="text-sm text-blue-700 mt-1">You may still add preferences in other blocks — max 2 per block. Final allocation is based on seniority.</p>
                                    </div>
                                ` : ''}
                                
                                <!-- Month Selection -->
                                <div class="mb-5">
                                    <label class="block font-semibold mb-2" style="color:var(--app-text);">Select Block:</label>
                                    <select id="selectedMonth" class="w-full px-4 py-2 border-2 rounded-lg" style="border-color:var(--app-border);" onchange="app.refreshAvailableSlots()">
                                        ${this.state.months.map((month, i) => `
                                            <option value="${month}">Block ${i + 1} · ${this.state.biddingYear}</option>
                                        `).join('')}
                                    </select>
                                </div>
            
                                <!-- Available Slots for selected month (planner-configured) -->
                                <div class="mb-5">
                                    <label class="block font-semibold mb-2" style="color:var(--app-text);">Select Available Slot:</label>
                                    <div id="availableSlotCards" class="space-y-3">
                                        <!-- Populated by refreshAvailableSlots() -->
                                    </div>
                                </div>

                                <!-- Selected slot confirmation panel -->
                                <div id="selectedSlotConfirm" class="hidden mb-5 p-4 rounded-xl border-2" style="border-color:var(--metro-green-light);background:var(--app-green-50);">
                                    <p class="font-semibold mb-1" style="color:var(--metro-green-dark);">📌 Selected: <span id="confirmSlotName"></span></p>
                                    <p class="text-sm" style="color:var(--metro-green-dark);">📅 <span id="confirmSlotDates"></span></p>
                                    <p class="text-sm" style="color:var(--metro-green-dark);">⏱ <span id="confirmSlotDays"></span> days</p>
                                </div>
            
                                <!-- Submit Button -->
                                <button
                                    id="submitBidBtn"
                                    onclick="app.submitBid()"
                                    class="w-full px-6 py-3 text-white rounded-lg font-semibold disabled:opacity-50"
                                    style="background:var(--metro-green);"
                                    onmouseover="if(!this.disabled)this.style.background='var(--metro-green-dark)'"
                                    onmouseout="if(!this.disabled)this.style.background='var(--metro-green)'"
                                    ${(this.state.isProcessed || this.isBiddingClosed()) ? 'disabled' : ''}
                                >
                                    Submit Bid
                                </button>
                                <div id="bidSuccessToast" class="hidden mt-4 p-3 bg-green-50 border border-green-300 rounded-xl text-center">
                                    <p class="text-green-800 font-semibold text-sm" id="bidSuccessMsg"></p>
                                </div>
                            </div>
            
                            <!-- Right: My Current Bids -->
                            <div class="metro-card p-6">
                                <h3 class="text-xl font-bold mb-4" style="font-family:'Barlow Condensed',sans-serif;color:var(--app-text);">My Current Bids</h3>
                                
                                ${userBids.length === 0 ? `
                                    <div class="text-center py-8 text-gray-500">
                                        <p>No bids placed yet</p>
                                        <p class="text-sm mt-2">Place your first bid on the left</p>
                                    </div>
                                ` : `
                                    <div class="space-y-4">
                                        ${userBids.map(bid => {
                                            const slotLabel = bid.slotType === 'SA' || bid.slotType === 'slotA' ? 'Slot A' :
                                                              bid.slotType === 'SB' || bid.slotType === 'slotB' ? 'Slot B' :
                                                              bid.slotType === 'SC' || bid.slotType === 'slotC' ? 'Slot C' :
                                                              bid.slotType === 'SD' || bid.slotType === 'slotD' ? 'Slot D' :
                                                              (this.state.slotTypes.find(s => s.id === bid.slotType)?.name || bid.slotType);
                                            const badgeColor = (bid.slotType === 'SA' || bid.slotType === 'slotA') ? 'bg-green-100 text-green-800 border-green-300' :
                                                               (bid.slotType === 'SB' || bid.slotType === 'slotB') ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                                               (bid.slotType === 'SD' || bid.slotType === 'slotD') ? 'bg-orange-100 text-orange-800 border-orange-300' :
                                                               'bg-purple-100 text-purple-800 border-purple-300';
                                            return `
                                                <div class="border border-gray-200 rounded-xl p-4">
                                                    <div class="flex justify-between items-start">
                                                        <div>
                                                            <span class="inline-block px-2 py-0.5 rounded text-xs font-bold border ${badgeColor} mb-2">${slotLabel}</span>
                                                            <p class="text-sm text-gray-700 font-semibold">📅 ${bid.startDate} → ${bid.endDate}</p>
                                                            <p class="text-sm text-gray-500">⏱ ${bid.days} days</p>
                                                        </div>
                                                        <button
                                                            onclick="app.removeBid('${bid.employeeId}', '${bid.slotType}', '${bid.startDate}')"
                                                            class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 font-semibold"
                                                            ${this.state.isProcessed ? 'disabled' : ''}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                `}
                                
                                <!-- Bid Summary -->
                                <div class="mt-6 p-4 rounded-lg" style="background:var(--app-green-50);">
                                    <p class="font-semibold mb-2" style="color:var(--app-text);">Bid Summary:</p>
                                    <p class="text-sm" style="color:var(--app-text);">Preferences submitted: ${userBids.length}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Limit: max 2 bids per block</p>
                                    <p class="text-sm" style="color:var(--app-text);">Days requested: ${totalBidDays} days</p>
                                    <p class="text-sm" style="color:var(--app-text);">Leave entitlement: ${entitlement} days (applied at allocation)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            
                // Initialize selected slot state
                if (!window.selectedSlot) {
                    window.selectedSlot    = null;
                    window.selectedSlotDef = null;
                }
                window._lastSlotMonth = null; // force reset on first render
                
                // Populate the slot cards for the default month
                this.refreshAvailableSlots();

                // Show success toast if a bid was just submitted
                if (this._lastBidSuccess) {
                    const toast = document.getElementById('bidSuccessToast');
                    const msg   = document.getElementById('bidSuccessMsg');
                    if (toast && msg) {
                        msg.textContent = this._lastBidSuccess;
                        toast.classList.remove('hidden');
                        setTimeout(() => toast.classList.add('hidden'), 5000);
                    }
                    this._lastBidSuccess = null;
                }

                // Live countdown ticker
                if (this.state.biddingDeadline) {
                    clearInterval(window._countdownInterval);
                    window._countdownInterval = setInterval(() => {
                        const el = document.getElementById('countdownTimer');
                        if (!el) { clearInterval(window._countdownInterval); return; }
                        const diff = new Date(this.state.biddingDeadline) - new Date();
                        if (diff <= 0) { el.textContent = 'EXPIRED'; clearInterval(window._countdownInterval); return; }
                        const d = Math.floor(diff/86400000), h = Math.floor((diff%86400000)/3600000),
                              m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
                        el.textContent = `${d}d ${h}h ${m}m ${s}s`;
                    }, 1000);
                }
            };

            app.renderGoldenCommandBiddingView = function() {
                const content = document.getElementById('contentArea');
                const gcUser = this.state.verifiedEmployee;
                if (!gcUser) { content.innerHTML = '<p class="text-center">Please login first.</p>'; return; }

                // Filter bids for THIS specific GC user
                const gcBids = this.state.bids.filter(bid => bid.employeeId === gcUser.id);
                const totalBidDays = gcBids.reduce((sum, bid) => sum + bid.days, 0);
                const entitlement = 30; // Golden Command entitlement

                // Countdown
                const deadlineCountdownGC = (() => {
                    if (!this.state.biddingDeadlineCorp) return '';
                    const dl = new Date(this.state.biddingDeadlineCorp);
                    const diff = dl - new Date();
                    if (diff <= 0) return `<div class="mb-4 bg-red-50 border border-red-300 rounded-xl p-3 text-center"><span class="text-red-700 font-bold">⛔ Bidding deadline has passed</span></div>`;
                    const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
                    const urgency = diff<3600000?'bg-red-50 border-red-300 text-red-700':diff<86400000?'bg-yellow-50 border-yellow-300 text-yellow-700':'bg-green-50 border-green-300 text-green-700';
                    return `<div class="mb-4 border rounded-xl p-3 text-center ${urgency}"><p class="text-xs font-semibold uppercase tracking-wide mb-1">⏰ Bidding Closes In</p><p class="text-2xl font-bold font-mono" id="gcCountdownTimer">${d}d ${h}h ${m}m ${s}s</p></div>`;
                })();
            
                content.innerHTML = `
                    <div class="max-w-6xl mx-auto">
                        ${deadlineCountdownGC}
                        <!-- Header with GC styling -->
                        <div class="bg-white rounded-xl shadow-xl p-6 mb-6 border-t-4 border-yellow-400">
                            <div class="flex items-center gap-3 mb-4">
                                <span class="text-3xl">⭐</span>
                                <h2 class="text-2xl font-bold">Golden Command — ${gcUser.name} — Leave Bidding ${this.state.biddingYearCorp}</h2>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div class="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                    <p class="text-2xl font-bold text-yellow-800">${entitlement}</p>
                                    <p class="text-sm text-gray-600">Total Leave Days</p>
                                    <p class="text-xs text-yellow-600">Golden Command Entitlement</p>
                                </div>
                                <div class="bg-green-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold">${gcBids.length} <span class="text-sm font-normal text-gray-500">unlimited</span></p>
                                    <p class="text-sm text-gray-600">Bids Placed</p>
                                </div>
                                <div class="bg-blue-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold">${totalBidDays}</p>
                                    <p class="text-sm text-gray-600">Days Bid</p>
                                </div>
                                <div class="bg-purple-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold text-purple-700">∞</p>
                                    <p class="text-sm text-gray-600">GC Privilege — No Limit</p>
                                </div>
                            </div>
            
                            <!-- Slot types summary -->
                            <div class="border-t pt-4">
                                <div class="flex items-center gap-2 mb-2">
                                    <p class="font-semibold">Available Slot Types:</p>
                                    <span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-semibold">⭐ GC: Unlimited selections, free date range</span>
                                </div>
                                <div class="flex gap-4">
                                    ${this.state.slotTypes.map(slot => `
                                        <div class="flex-1 p-3 rounded-lg border ${slot.color === 'green' ? 'border-green-300 bg-green-50' : slot.color === 'blue' ? 'border-blue-300 bg-blue-50' : 'border-purple-300 bg-purple-50'}">
                                            <p class="font-bold">${slot.name}</p>
                                            <p class="text-sm">${slot.days} consecutive days</p>
                                        </div>
                                    `).join('')}
                                    <div class="flex-1 p-3 rounded-lg border border-yellow-400 bg-yellow-50">
                                        <p class="font-bold text-yellow-800">⭐ Custom</p>
                                        <p class="text-sm text-yellow-700">Any date range — free choice</p>
                                    </div>
                                </div>
                            </div>
                        </div>
            
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <!-- Left: Place New Bid -->
                            <div class="bg-white rounded-xl shadow-xl p-6 border-l-4 border-yellow-400">
                                <h3 class="text-xl font-bold mb-4">⭐ Place New GC Bid</h3>
                                
                                ${this.state.isProcessedCorp ? `
                                    <div class="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
                                        <p class="font-semibold">⚠️ Bidding has been processed. No more bids allowed.</p>
                                    </div>
                                ` : ''}

                                <!-- Slot Type Selection -->
                                <div class="mb-5">
                                    <label class="block font-semibold mb-2">Select Slot Type:</label>
                                    <div class="space-y-2">
                                        ${this.state.slotTypes.map(slot => {
                                            const colorMap = { green: 'border-green-300 bg-green-50 hover:bg-green-100 text-green-900', blue: 'border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900', purple: 'border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900' };
                                            const activeMap = { green: 'bg-green-500 text-white border-green-600', blue: 'bg-blue-500 text-white border-blue-600', purple: 'bg-purple-500 text-white border-purple-600' };
                                            const isActive = window.gcSelectedSlot === slot.id;
                                            return `
                                                <button
                                                    data-slot="${slot.id}"
                                                    onclick="app.setGCSelectedSlot('${slot.id}')"
                                                    class="gc-slot-btn w-full p-3 rounded-lg font-semibold text-left transition-all border ${this.state.isProcessedCorp ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : (isActive ? (activeMap[slot.color] || 'bg-yellow-400 text-yellow-900 border-yellow-500') : (colorMap[slot.color] || 'bg-yellow-50 hover:bg-yellow-100 text-gray-800 border-yellow-300'))}"
                                                    ${this.state.isProcessedCorp ? 'disabled' : ''}
                                                >
                                                    ${slot.name} — ${slot.days} consecutive days
                                                    ${isActive ? '<span class="float-right">✓ Selected</span>' : ''}
                                                </button>
                                            `;
                                        }).join('')}
                                        <!-- Custom / Free Choice option -->
                                        <button
                                            data-slot="gcCustom"
                                            onclick="app.setGCSelectedSlot('gcCustom')"
                                            class="gc-slot-btn w-full p-3 rounded-lg font-semibold text-left transition-all border ${this.state.isProcessedCorp ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : (window.gcSelectedSlot === 'gcCustom' ? 'bg-yellow-400 text-yellow-900 border-yellow-500' : 'bg-yellow-50 hover:bg-yellow-100 text-yellow-900 border-yellow-400')}"
                                            ${this.state.isProcessedCorp ? 'disabled' : ''}
                                        >
                                            ⭐ Custom — Choose any start &amp; end date freely
                                            ${window.gcSelectedSlot === 'gcCustom' ? '<span class="float-right">✓ Selected</span>' : ''}
                                        </button>
                                    </div>
                                </div>
            
                                <!-- Date Selection -->
                                <div class="mb-6">
                                    <div class="mb-3 p-3 bg-yellow-50 border border-yellow-300 rounded">
                                        <p class="font-semibold text-yellow-800 text-sm" id="gcSlotInfoText">
                                            ${window.gcSelectedSlot === 'gcCustom' ? '⭐ Custom: Pick any start and end date' : (this.state.slotTypes.find(s=>s.id===window.gcSelectedSlot) ? `${this.state.slotTypes.find(s=>s.id===window.gcSelectedSlot).name} — end date auto-calculated (${this.state.slotTypes.find(s=>s.id===window.gcSelectedSlot).days} days)` : 'Select a slot type above')}
                                        </p>
                                    </div>

                                    ${(() => {
                                        // On-Call schedule notice for this GC user
                                        const myOnCall = this.state.onCallDates[gcUser.id] || [];
                                        if (myOnCall.length === 0) return '';
                                        // Group consecutive dates into ranges
                                        const sorted = [...myOnCall].sort();
                                        const ranges = [];
                                        let rangeStart = sorted[0], rangeEnd = sorted[0];
                                        for (let k = 1; k < sorted.length; k++) {
                                            const prev = new Date(sorted[k-1]);
                                            const curr = new Date(sorted[k]);
                                            const diffDays = (curr - prev) / 86400000;
                                            if (diffDays === 1) {
                                                rangeEnd = sorted[k];
                                            } else {
                                                ranges.push(rangeStart === rangeEnd ? rangeStart : `${rangeStart} → ${rangeEnd}`);
                                                rangeStart = sorted[k]; rangeEnd = sorted[k];
                                            }
                                        }
                                        ranges.push(rangeStart === rangeEnd ? rangeStart : `${rangeStart} → ${rangeEnd}`);
                                        return `<div class="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg">
                                            <p class="font-bold text-red-800 text-sm mb-2">🚫 Your On-Call Dates (leave cannot be selected on these dates):</p>
                                            <div class="flex flex-wrap gap-1">${ranges.map(r => `<span class="inline-block bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded border border-red-200">${r}</span>`).join('')}</div>
                                        </div>`;
                                    })()}
            
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label class="block font-semibold mb-2">Start Date:</label>
                                            <input
                                                type="date"
                                                id="gcStartDate"
                                                class="w-full px-4 py-2 border-2 border-yellow-300 rounded-lg focus:border-yellow-500 focus:outline-none"
                                                min="${this.state.biddingYearCorp}-01-01"
                                                max="${this.state.biddingYearCorp}-12-31"
                                                onchange="app.updateGCEndDate()"
                                            />
                                        </div>
                                        <div>
                                            <label class="block font-semibold mb-2">End Date:</label>
                                            <input
                                                type="date"
                                                id="gcEndDate"
                                                class="w-full px-4 py-2 border-2 border-yellow-300 rounded-lg focus:border-yellow-500 focus:outline-none"
                                                min="${this.state.biddingYearCorp}-01-01"
                                                max="${this.state.biddingYearCorp}-12-31"
                                                onchange="app.updateGCDateInfo()"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div id="gcDateInfo" class="hidden mt-2"></div>
                                </div>
            
                                <!-- Submit Button -->
                                <button
                                    onclick="app.submitGCBid()"
                                    class="w-full px-6 py-3 bg-yellow-400 text-yellow-900 rounded-lg font-semibold hover:bg-yellow-500 transition-colors shadow-sm"
                                    ${(this.state.isProcessedCorp || this.isBiddingClosedCorp()) ? 'disabled' : ''}
                                >
                                    ⭐ Submit Golden Command Bid
                                </button>
                            </div>
            
                            <!-- Right: My Current Bids -->
                            <div class="bg-white rounded-xl shadow-xl p-6">
                                <div class="flex justify-between items-center mb-4">
                                    <h3 class="text-xl font-bold">⭐ My GC Bids</h3>
                                    <span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">${gcBids.length} bid${gcBids.length !== 1 ? 's' : ''}</span>
                                </div>
                                
                                ${gcBids.length === 0 ? `
                                    <div class="text-center py-8 text-gray-500">
                                        <p class="text-4xl mb-2">⭐</p>
                                        <p class="font-semibold">No bids placed yet</p>
                                        <p class="text-sm mt-2">Use the form on the left — no limit on bids</p>
                                    </div>
                                ` : `
                                    <div class="space-y-3 max-h-96 overflow-y-auto pr-1">
                                        ${gcBids.map((bid, i) => {
                                            const slot = this.state.slotTypes.find(s => s.id === bid.slotType);
                                            const slotLabel = bid.slotType === 'gcCustom' ? '⭐ Custom' : (slot?.name || bid.slotType);
                                            const colorBadge = bid.slotType === 'gcCustom' ? 'bg-yellow-100 text-yellow-800' : (bid.slotType === 'slotA' ? 'bg-green-100 text-green-800' : bid.slotType === 'slotB' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800');
                                            return `
                                                <div class="border border-yellow-200 rounded-lg p-3 bg-yellow-50">
                                                    <div class="flex justify-between items-start">
                                                        <div>
                                                            <div class="flex items-center gap-2 mb-1">
                                                                <span class="text-xs font-bold text-gray-500">#${i+1}</span>
                                                                <span class="px-2 py-0.5 rounded text-xs font-semibold ${colorBadge}">${slotLabel}</span>
                                                            </div>
                                                            <p class="text-sm text-gray-700 font-semibold">${bid.startDate} → ${bid.endDate}</p>
                                                            <p class="text-xs text-gray-500 mt-0.5">${bid.days} day${bid.days !== 1 ? 's' : ''}</p>
                                                        </div>
                                                        <button
                                                            onclick="app.removeGCBid('${bid.slotType}', '${bid.startDate}')"
                                                            class="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                                            ${this.state.isProcessedCorp ? 'disabled' : ''}
                                                        >
                                                            ✕ Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                `}
                                
                                <!-- Bid Summary -->
                                <div class="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                    <p class="font-semibold mb-2 text-yellow-800">GC Bid Summary:</p>
                                    <div class="grid grid-cols-2 gap-2 text-sm">
                                        <p class="text-gray-600">Total bids:</p><p class="font-semibold">${gcBids.length} <span class="text-yellow-600 text-xs">(unlimited)</span></p>
                                        <p class="text-gray-600">Total days bid:</p><p class="font-semibold">${totalBidDays} days</p>
                                        <p class="text-gray-600">Leave entitlement:</p><p class="font-semibold">${entitlement} days</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            
                // Initialize GC slot state — default to Custom (free selection)
                if (!window.gcSelectedSlot) {
                    window.gcSelectedSlot = 'gcCustom';
                }

                // Live countdown ticker for GC
                if (this.state.biddingDeadlineCorp) {
                    clearInterval(window._gcCountdownInterval);
                    window._gcCountdownInterval = setInterval(() => {
                        const el = document.getElementById('gcCountdownTimer');
                        if (!el) { clearInterval(window._gcCountdownInterval); return; }
                        const diff = new Date(this.state.biddingDeadlineCorp) - new Date();
                        if (diff <= 0) { el.textContent = 'EXPIRED'; clearInterval(window._gcCountdownInterval); return; }
                        const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
                        el.textContent = `${d}d ${h}h ${m}m ${s}s`;
                    }, 1000);
                }
            };

            app.setGCSelectedSlot = function(slotId) {
                window.gcSelectedSlot = slotId;
                
                // Update button styles
                const buttons = document.querySelectorAll('.gc-slot-btn');
                buttons.forEach(btn => {
                    const isSelected = btn.dataset.slot === slotId;
                    if (this.state.isProcessedCorp) {
                        btn.className = 'gc-slot-btn w-full p-3 rounded-lg font-semibold text-left transition-all border bg-gray-200 text-gray-500 cursor-not-allowed';
                    } else if (isSelected) {
                        btn.className = 'gc-slot-btn w-full p-3 rounded-lg font-semibold text-left transition-all border bg-yellow-400 text-yellow-900 border-yellow-500';
                    } else {
                        btn.className = 'gc-slot-btn w-full p-3 rounded-lg font-semibold text-left transition-all border bg-yellow-50 hover:bg-yellow-100 text-yellow-900 border-yellow-300';
                    }
                });

                // Update info text
                const infoEl = document.getElementById('gcSlotInfoText');
                if (infoEl) {
                    if (slotId === 'gcCustom') {
                        infoEl.textContent = '⭐ Custom: Pick any start and end date freely';
                    } else {
                        const slot = this.state.slotTypes.find(s => s.id === slotId);
                        infoEl.textContent = slot
                            ? `${slot.name} — end date auto-calculated (${slot.days} days)`
                            : 'Select a slot type above';
                    }
                }

                // Clear date inputs when switching slots
                const startDate = document.getElementById('gcStartDate');
                const endDate = document.getElementById('gcEndDate');
                const dateInfo = document.getElementById('gcDateInfo');
                if (startDate) startDate.value = '';
                if (endDate) {
                    endDate.value = '';
                    // Custom slot: end date is freely editable; others: readonly
                    endDate.readOnly = slotId !== 'gcCustom';
                    endDate.className = `w-full px-4 py-2 border-2 border-yellow-300 rounded-lg focus:border-yellow-500 focus:outline-none ${slotId !== 'gcCustom' ? 'bg-gray-50' : ''}`;
                }
                if (dateInfo) dateInfo.classList.add('hidden');
            };

            app.updateGCEndDate = function() {
                const startDateInput = document.getElementById('gcStartDate');
                const endDateInput = document.getElementById('gcEndDate');
                
                if (!startDateInput || !startDateInput.value) {
                    if (endDateInput) endDateInput.value = '';
                    return;
                }

                if (window.gcSelectedSlot === 'gcCustom') {
                    // Custom: end date is free — just update info if both dates set
                    this.updateGCDateInfo();
                    return;
                }

                if (!window.gcSelectedSlot) return;
                
                const slot = this.state.slotTypes.find(s => s.id === window.gcSelectedSlot);
                if (!slot) return;
                
                const startDate = new Date(startDateInput.value);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + slot.days - 1);
                
                if (endDateInput) {
                    endDateInput.value = endDate.toISOString().split('T')[0];
                }
                
                this.updateGCDateInfo();
            };

            app.updateGCDateInfo = function() {
                const startDateInput = document.getElementById('gcStartDate');
                const endDateInput = document.getElementById('gcEndDate');
                const dateInfo = document.getElementById('gcDateInfo');

                if (!startDateInput?.value || !endDateInput?.value || !dateInfo) return;

                const days = Math.ceil(Math.abs(new Date(endDateInput.value) - new Date(startDateInput.value)) / (1000 * 60 * 60 * 24)) + 1;

                // ── On-Call conflict live check ──────────────────────────────
                const gcUser = this.state.verifiedEmployee;
                const onCallSet = new Set(gcUser ? (this.state.onCallDates[gcUser.id] || []) : []);
                const conflictDates = [];
                if (onCallSet.size > 0 && startDateInput.value && endDateInput.value) {
                    const cur = new Date(startDateInput.value);
                    const end = new Date(endDateInput.value);
                    while (cur <= end) {
                        const iso = cur.toISOString().slice(0, 10);
                        if (onCallSet.has(iso)) conflictDates.push(iso);
                        cur.setDate(cur.getDate() + 1);
                    }
                }
                const onCallWarning = conflictDates.length > 0
                    ? `<p class="font-semibold text-red-700 mt-2">🚫 On-Call conflict on: ${conflictDates.join(', ')}</p>`
                    : (onCallSet.size > 0 ? `<p class="text-green-700 text-sm mt-1">✅ No On-Call conflicts in this range</p>` : '');
                // ────────────────────────────────────────────────────────────

                let validMsg = '';
                if (window.gcSelectedSlot === 'gcCustom') {
                    validMsg = `<p class="font-semibold text-yellow-800">⭐ Custom selection: ${days} day${days !== 1 ? 's' : ''} ✓</p>`;
                    dateInfo.className = conflictDates.length > 0 ? 'p-3 rounded mb-2 bg-red-50 border border-red-300' : 'p-3 rounded mb-2 bg-yellow-50 border border-yellow-300';
                } else {
                    const slot = this.state.slotTypes.find(s => s.id === window.gcSelectedSlot);
                    const ok = slot && days === slot.days;
                    validMsg = `<p class="font-semibold ${ok ? 'text-green-800' : 'text-red-800'}">${days} day${days !== 1 ? 's' : ''} selected ${ok ? '✓' : `(${slot?.name} requires exactly ${slot?.days} days)`}</p>`;
                    dateInfo.className = conflictDates.length > 0 ? 'p-3 rounded mb-2 bg-red-50 border border-red-300'
                        : `p-3 rounded mb-2 ${ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`;
                }
                dateInfo.innerHTML = validMsg + `<p class="text-sm text-gray-600 mt-1">${startDateInput.value} → ${endDateInput.value}</p>` + onCallWarning;
                dateInfo.classList.remove('hidden');
            };

            app.submitGCBid = function() {
                if (this.state.isProcessedCorp) {
                    alert('Bidding has been processed. No more bids allowed.');
                    return;
                }

                if (this.isBiddingClosedCorp()) {
                    alert('⛔ The bidding deadline has passed. You can no longer submit bids.');
                    return;
                }

                const gcUser = this.state.verifiedEmployee;
                if (!gcUser) { alert('Please login first.'); return; }

                if (!window.gcSelectedSlot) {
                    alert('Please select a slot type first.');
                    return;
                }

                const startDate = document.getElementById('gcStartDate')?.value;
                const endDate = document.getElementById('gcEndDate')?.value;

                if (!startDate) {
                    alert('Please select a start date.');
                    return;
                }
                if (!endDate) {
                    alert('Please select an end date.');
                    return;
                }

                const days = Math.ceil(Math.abs(new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

                if (days < 1) {
                    alert('End date must be on or after start date.');
                    return;
                }

                // Block leave continuity across the Dec→Jan year-end transition: staff
                // with already-approved December leave cannot bid on a January slot.
                if (this._blocksJanuaryBid(gcUser.id, startDate, endDate, this.state.biddingYearCorp)) {
                    alert('⛔ You already have approved leave in December. To avoid continuous leave across the year-end, you cannot bid on a January slot. Please contact the planner if you believe this is incorrect.');
                    return;
                }

                // For fixed slot types, validate exact day count
                if (window.gcSelectedSlot !== 'gcCustom') {
                    const slot = this.state.slotTypes.find(s => s.id === window.gcSelectedSlot);
                    if (slot && days !== slot.days) {
                        alert(`${slot.name} requires exactly ${slot.days} days. Your selection is ${days} days.\n\nTo choose a free date range, select the "⭐ Custom" option instead.`);
                        return;
                    }
                }

                // Check date overlap with existing GC bids
                const gcBids = this.state.bids.filter(bid => bid.employeeId === gcUser.id);
                for (const bid of gcBids) {
                    if (this.checkDateOverlap(startDate, endDate, bid.startDate, bid.endDate)) {
                        alert(`Date overlap with an existing bid (${bid.startDate} → ${bid.endDate}). Please choose non-overlapping dates.`);
                        return;
                    }
                }

                // ── On-Call Conflict Check ──────────────────────────────────────
                // Build a set of all dates in the requested leave range
                const onCallDatesForUser = new Set(this.state.onCallDates[gcUser.id] || []);
                if (onCallDatesForUser.size > 0) {
                    const conflictingOnCallDates = [];
                    const cursor = new Date(startDate);
                    const rangeEnd = new Date(endDate);
                    while (cursor <= rangeEnd) {
                        const iso = cursor.toISOString().slice(0, 10);
                        if (onCallDatesForUser.has(iso)) conflictingOnCallDates.push(iso);
                        cursor.setDate(cursor.getDate() + 1);
                    }
                    if (conflictingOnCallDates.length > 0) {
                        const conflictList = conflictingOnCallDates.join(', ');
                        alert(`⚠️ On-Call Conflict Detected!\n\nYour selected leave period (${startDate} → ${endDate}) overlaps with your scheduled On-Call duties on the following date${conflictingOnCallDates.length > 1 ? 's' : ''}:\n\n${conflictList}\n\nPlease choose dates that do not conflict with your On-Call schedule.`);
                        return;
                    }
                }
                // ───────────────────────────────────────────────────────────────

                const slotLabel = window.gcSelectedSlot === 'gcCustom'
                    ? 'Custom'
                    : (this.state.slotTypes.find(s => s.id === window.gcSelectedSlot)?.name || window.gcSelectedSlot);

                const newBid = {
                    employeeId: gcUser.id,
                    employeeName: gcUser.name,
                    seniorityDate: gcUser.seniorityDate || '2000-01-01',
                    department: 'Golden Command',
                    slotType: window.gcSelectedSlot,
                    startDate,
                    endDate,
                    days,
                    timestamp: new Date().toISOString()
                };

                this.state.bids.push(newBid);
                this.saveState();
                this.writeAuditLog('BID_PLACED', { type: 'GC', slot: window.gcSelectedSlot, start: startDate, end: endDate, days });

                // Save bid immediately to Supabase so it survives refresh
                this.saveBidToSupabase(newBid).then(saved => {
                    if (saved) console.log('✅ GC Bid saved to Supabase');
                });

                alert(`⭐ GC Bid placed!\n${slotLabel} — ${startDate} → ${endDate} (${days} day${days !== 1 ? 's' : ''})`);
                this.renderGoldenCommandBiddingView();
            };

            app.removeGCBid = async function(slotType, startDate) {
                if (this.state.isProcessedCorp) {
                    alert('Cannot remove bids after processing.');
                    return;
                }
                if (!confirm('Remove this Golden Command bid?')) return;
                const gcUser = this.state.verifiedEmployee;

                // 1. Optimistically remove from local state and persist immediately
                const idx = this.state.bids.findIndex(bid =>
                    bid.employeeId === gcUser.id && bid.slotType === slotType && bid.startDate === startDate
                );
                if (idx !== -1) this.state.bids.splice(idx, 1);
                this.saveState();
                this.renderGoldenCommandBiddingView();

                // 2. Delete from Supabase and AWAIT the result so a failure is surfaced
                if (!this.supabase) {
                    this.writeAuditLog('BID_REMOVED', { employee_id: gcUser.id, slot_type: slotType, start_date: startDate, section: 'golden_command' });
                    return;
                }
                const { error } = await this.supabase
                    .from('corporate_leave_request')
                    .delete()
                    .eq('tenant_id', this._tid())
                    .eq('employee_id', gcUser.id)
                    .eq('slot_type', slotType)
                    .eq('start_date', startDate);

                if (error) {
                    console.error('❌ GC Bid delete failed:', error.message);
                    alert('Could not delete from server — please retry.');
                    return;
                }
                console.log('✅ GC Bid deleted from Supabase');
                this.writeAuditLog('BID_REMOVED', { employee_id: gcUser.id, slot_type: slotType, start_date: startDate, section: 'golden_command' });
            };

            app.renderCorporateStaffBiddingView = function() {
                const content = document.getElementById('contentArea');
                const csUser = this.state.verifiedEmployee;
                if (!csUser) { content.innerHTML = '<p class="text-center">Please login first.</p>'; return; }

                const csBids = this.state.bids.filter(bid => bid.employeeId === csUser.id);
                const totalBidDays = csBids.reduce((sum, bid) => sum + bid.days, 0);
                // Corporate Staff entitlement: 35 days if 5+ years of service, else 30
                const calculateCsYearsOfService = (seniorityDate) => {
                    if (!seniorityDate) return 0;
                    const today = new Date();
                    const joinDate = new Date(seniorityDate);
                    return (today - joinDate) / (1000 * 60 * 60 * 24 * 365.25);
                };
                const csYearsOfService = calculateCsYearsOfService(csUser.seniorityDate);
                const entitlement = csYearsOfService >= 5 ? 35 : 30;

                // Countdown
                const deadlineCountdownCS = (() => {
                    if (!this.state.biddingDeadlineCorp) return '';
                    const dl = new Date(this.state.biddingDeadlineCorp);
                    const diff = dl - new Date();
                    if (diff <= 0) return `<div class="mb-4 bg-red-50 border border-red-300 rounded-xl p-3 text-center"><span class="text-red-700 font-bold">⛔ Bidding deadline has passed</span></div>`;
                    const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
                    const urgency = diff<3600000?'bg-red-50 border-red-300 text-red-700':diff<86400000?'bg-yellow-50 border-yellow-300 text-yellow-700':'bg-green-50 border-green-300 text-green-700';
                    return `<div class="mb-4 border rounded-xl p-3 text-center ${urgency}"><p class="text-xs font-semibold uppercase tracking-wide mb-1">⏰ Bidding Closes In</p><p class="text-2xl font-bold font-mono" id="csCountdownTimer">${d}d ${h}h ${m}m ${s}s</p></div>`;
                })();

                content.innerHTML = `
                    <div class="max-w-6xl mx-auto">
                        ${deadlineCountdownCS}
                        <!-- Header -->
                        <div class="bg-white rounded-xl shadow-xl p-6 mb-6 border-t-4 border-blue-500">
                            <div class="flex items-center gap-3 mb-4">
                                <span class="text-3xl">🏢</span>
                                <h2 class="text-2xl font-bold">Corporate Staff — ${csUser.name} — Leave Bidding ${this.state.biddingYearCorp}</h2>
                            </div>

                            ${(() => {
                                const uid = csUser.id;
                                // Collect on-call dates from all 4 dept groups this user belongs to
                                const deptGroups = [
                                    { key: uid,               label: '🏢 Corporate Staff' },
                                    { key: 'l456inm::' + uid, label: '📋 L456 INM' },
                                    { key: 'l3inm::' + uid,   label: '📋 L3 INM' },
                                    { key: 'l3tsm::' + uid,   label: '📋 L3 TSM' },
                                    { key: 'hseq::' + uid,    label: '🔰 HSEQ' },
                                ].filter(g => (this.state.onCallDates[g.key] || []).length > 0);

                                if (deptGroups.length === 0) return '';

                                const getWN = (ds) => {
                                    const dt2 = new Date(ds + 'T00:00:00');
                                    const j1 = new Date(dt2.getFullYear(), 0, 1);
                                    const w1s = new Date(j1); w1s.setDate(j1.getDate() - j1.getDay());
                                    const wn = Math.floor((dt2 - w1s) / (7*24*60*60*1000)) + 1;
                                    return wn >= 53 ? 1 : wn;
                                };
                                const makeChips = (dates) => {
                                    const sorted = [...dates].sort();
                                    const weekGroups = {};
                                    sorted.forEach(d => {
                                        const dt = new Date(d + 'T00:00:00');
                                        const ws = new Date(dt); ws.setDate(dt.getDate() - dt.getDay());
                                        const k = ws.getFullYear() + '-' + String(ws.getMonth()+1).padStart(2,'0') + '-' + String(ws.getDate()).padStart(2,'0');
                                        if (!weekGroups[k]) weekGroups[k] = [];
                                        weekGroups[k].push(d);
                                    });
                                    return Object.entries(weekGroups).map(([, wDates]) => {
                                        const wNum = getWN(wDates[0]);
                                        const label = wDates.length >= 7
                                            ? `Week ${wNum} (${wDates[0]} → ${wDates[wDates.length-1]})`
                                            : `Week ${wNum} — ${wDates.join(', ')}`;
                                        return `<span class="inline-block bg-red-100 text-red-700 border border-red-300 text-xs font-semibold px-2 py-1 rounded whitespace-nowrap">${label}</span>`;
                                    }).join('');
                                };

                                const sections = deptGroups.map(g => `
                                    <div class="mb-3">
                                        <p class="text-xs font-bold text-red-700 mb-1">${g.label}</p>
                                        <div class="flex flex-wrap gap-1">${makeChips(this.state.onCallDates[g.key])}</div>
                                    </div>`).join('');

                                return `<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                                    <p class="font-bold text-red-800 text-sm mb-3">🚫 Your On-Call Dates (leave cannot be selected on these dates):</p>
                                    ${sections}
                                </div>`;
                            })()}
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <p class="text-2xl font-bold text-blue-800">${entitlement}</p>
                                    <p class="text-sm text-gray-600">Total Leave Days</p>
                                    <p class="text-xs text-blue-600">${csYearsOfService >= 5 ? 'Corporate Staff (5+ yrs service)' : 'Corporate Staff Entitlement'}</p>
                                </div>
                                <div class="bg-green-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold">${csBids.length} <span class="text-sm font-normal text-gray-500">unlimited</span></p>
                                    <p class="text-sm text-gray-600">Bids Placed</p>
                                </div>
                                <div class="bg-indigo-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold">${totalBidDays}</p>
                                    <p class="text-sm text-gray-600">Days Bid</p>
                                </div>
                                <div class="bg-purple-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold text-purple-700">∞</p>
                                    <p class="text-sm text-gray-600">No Bid Limit</p>
                                </div>
                            </div>
                            <div class="border-t pt-4">
                                <div class="flex items-center gap-2 mb-2">
                                    <p class="font-semibold">Available Slot Types:</p>
                                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">🏢 Corp Staff: Unlimited selections, free date range</span>
                                </div>
                                <div class="flex gap-4">
                                    ${this.state.slotTypes.map(slot => `
                                        <div class="flex-1 p-3 rounded-lg border ${slot.color === 'green' ? 'border-green-300 bg-green-50' : slot.color === 'blue' ? 'border-blue-300 bg-blue-50' : 'border-purple-300 bg-purple-50'}">
                                            <p class="font-bold">${slot.name}</p>
                                            <p class="text-sm">${slot.days} consecutive days</p>
                                        </div>
                                    `).join('')}
                                    <div class="flex-1 p-3 rounded-lg border border-blue-400 bg-blue-50">
                                        <p class="font-bold text-blue-800">🏢 Custom</p>
                                        <p class="text-sm text-blue-700">Any date range — free choice</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <!-- Left: Place New Bid -->
                            <div class="bg-white rounded-xl shadow-xl p-6 border-l-4 border-blue-500">
                                <h3 class="text-xl font-bold mb-4">🏢 Place New Corporate Staff Bid</h3>
                                ${this.state.isProcessedCorp ? `
                                    <div class="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                                        <p class="font-semibold">⚠️ Bidding has been processed. No more bids allowed.</p>
                                    </div>` : ''}

                                <!-- Slot Type Selection -->
                                <div class="mb-5">
                                    <label class="block font-semibold mb-2">Select Slot Type:</label>
                                    <div class="space-y-2">
                                        ${this.state.slotTypes.map(slot => `
                                            <button
                                                onclick="app.csSetSelectedSlot('${slot.id}')"
                                                data-csslot="${slot.id}"
                                                class="cs-slot-btn w-full p-3 rounded-lg font-semibold text-left transition-all bg-gray-100 hover:bg-gray-200 text-gray-800 ${this.state.isProcessedCorp ? 'opacity-50 cursor-not-allowed' : ''}"
                                                ${this.state.isProcessedCorp ? 'disabled' : ''}
                                            >
                                                ${slot.name} — ${slot.days} consecutive days
                                            </button>
                                        `).join('')}
                                        <button
                                            onclick="app.csSetSelectedSlot('csCustom')"
                                            data-csslot="csCustom"
                                            class="cs-slot-btn w-full p-3 rounded-lg font-semibold text-left transition-all bg-blue-50 border border-blue-300 hover:bg-blue-100 text-blue-800 ${this.state.isProcessedCorp ? 'opacity-50 cursor-not-allowed' : ''}"
                                            ${this.state.isProcessedCorp ? 'disabled' : ''}
                                        >
                                            🏢 Custom — Any date range (free choice)
                                        </button>
                                    </div>
                                </div>

                                <!-- Date Selection -->
                                <div class="mb-5">
                                    <label class="block font-semibold mb-2">Select Dates:</label>
                                    <div id="csSlotInfo" class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800 font-medium">
                                        Select a slot type above first
                                    </div>
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-sm font-semibold mb-1">Start Date</label>
                                            <input type="date" id="csStartDate"
                                                class="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none"
                                                min="${this.state.biddingYearCorp}-01-01" max="${this.state.biddingYearCorp}-12-31"
                                                onchange="app.csUpdateEndDate()" />
                                        </div>
                                        <div>
                                            <label class="block text-sm font-semibold mb-1">End Date <span class="text-gray-400 font-normal">(auto)</span></label>
                                            <input type="date" id="csEndDate"
                                                class="w-full px-3 py-2 border-2 border-gray-200 rounded-lg bg-gray-50"
                                                onchange="app._csCheckOnCallWarning()"
                                                readonly />
                                        </div>
                                    </div>
                                    <div id="csOnCallWarning" class="mt-1 text-sm"></div>
                                </div>

                                <button onclick="app.submitCSBid()"
                                    class="w-full px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition ${(this.state.isProcessedCorp || this.isBiddingClosedCorp()) ? 'opacity-50 cursor-not-allowed' : ''}"
                                    ${(this.state.isProcessedCorp || this.isBiddingClosedCorp()) ? 'disabled' : ''}>
                                    🏢 Submit Corporate Staff Bid
                                </button>
                            </div>

                            <!-- Right: My Current Bids -->
                            <div class="bg-white rounded-xl shadow-xl p-6 border-l-4 border-indigo-400">
                                <h3 class="text-xl font-bold mb-4">📋 My Current Bids (${csBids.length})</h3>
                                ${csBids.length === 0 ? `
                                    <div class="text-center py-8 text-gray-500">
                                        <p class="text-4xl mb-3">📭</p>
                                        <p class="font-semibold">No bids placed yet</p>
                                        <p class="text-sm mt-1">Place your first bid on the left</p>
                                    </div>
                                ` : `
                                    <div class="space-y-3 max-h-96 overflow-y-auto">
                                        ${csBids.map(bid => {
                                            const slot = this.state.slotTypes.find(s => s.id === bid.slotType);
                                            const slotLabel = bid.slotType === 'csCustom' ? '🏢 Custom' : (slot?.name || bid.slotType);
                                            return `
                                                <div class="border border-blue-200 rounded-lg p-4 bg-blue-50">
                                                    <div class="flex justify-between items-start">
                                                        <div>
                                                            <p class="font-bold text-blue-900">${slotLabel}</p>
                                                            <p class="text-sm text-gray-600">${bid.startDate} → ${bid.endDate}</p>
                                                            <p class="text-sm font-semibold text-blue-700">${bid.days} days</p>
                                                        </div>
                                                        <button onclick="app.removeCSBid('${bid.slotType}','${bid.startDate}')"
                                                            class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 font-semibold">
                                                            ✕ Remove
                                                        </button>
                                                    </div>
                                                </div>`;
                                        }).join('')}
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                `;

                // Start countdown timer
                clearInterval(window._csCountdownTimer);
                window._csCountdownTimer = setInterval(() => {
                    const el = document.getElementById('csCountdownTimer');
                    if (!el) { clearInterval(window._csCountdownTimer); return; }
                    const diff = new Date(this.state.biddingDeadlineCorp) - new Date();
                    if (diff <= 0) { el.textContent = 'EXPIRED'; clearInterval(window._csCountdownTimer); return; }
                    const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
                    el.textContent = `${d}d ${h}h ${m}m ${s}s`;
                }, 1000);
            };

            app.csSetSelectedSlot = function(slotId) {
                window.csSelectedSlot = slotId;
                // Highlight selected
                document.querySelectorAll('.cs-slot-btn').forEach(btn => {
                    const isSelected = btn.dataset.csslot === slotId;
                    btn.classList.toggle('ring-2', isSelected);
                    btn.classList.toggle('ring-blue-500', isSelected);
                    btn.classList.toggle('bg-blue-100', isSelected);
                });
                const infoEl = document.getElementById('csSlotInfo');
                if (!infoEl) return;
                if (slotId === 'csCustom') {
                    infoEl.textContent = '🏢 Custom — Choose any start and end date freely';
                } else {
                    const slot = this.state.slotTypes.find(s => s.id === slotId);
                    infoEl.textContent = slot ? `${slot.name} — exactly ${slot.days} consecutive days. Pick a start date.` : '';
                }
                // Recalculate end date if start already filled
                this.csUpdateEndDate();
            };

            app.csUpdateEndDate = function() {
                const startInput = document.getElementById('csStartDate');
                const endInput = document.getElementById('csEndDate');
                if (!startInput || !endInput || !startInput.value) return;
                if (!window.csSelectedSlot || window.csSelectedSlot === 'csCustom') {
                    endInput.value = '';
                    endInput.removeAttribute('readonly');
                    endInput.classList.remove('bg-gray-50');
                    endInput.classList.add('border-blue-300');
                    const w = document.getElementById('csOnCallWarning');
                    if (w) w.innerHTML = '';
                    return;
                }
                const slot = this.state.slotTypes.find(s => s.id === window.csSelectedSlot);
                if (!slot) return;
                const start = new Date(startInput.value + 'T00:00:00');
                const end = new Date(start);
                end.setDate(end.getDate() + slot.days - 1);
                endInput.value = end.toISOString().split('T')[0];
                endInput.setAttribute('readonly', true);
                endInput.classList.add('bg-gray-50');
                endInput.classList.remove('border-blue-300');
                this._csCheckOnCallWarning();
            };

            app._csCheckOnCallWarning = function() {
                const warningEl = document.getElementById('csOnCallWarning');
                if (!warningEl) return;
                const csUser = this.state.verifiedEmployee;
                if (!csUser) return;
                const uid = csUser.id;
                const allOnCall = [
                    ...(this.state.onCallDates[uid] || []),
                    ...(this.state.onCallDates['l456inm::' + uid] || []),
                    ...(this.state.onCallDates['l3inm::' + uid] || []),
                    ...(this.state.onCallDates['l3tsm::' + uid] || []),
                    ...(this.state.onCallDates['hseq::' + uid] || []),
                ];
                const onCallSet = new Set(allOnCall);
                const startVal = document.getElementById('csStartDate')?.value;
                const endVal   = document.getElementById('csEndDate')?.value;
                if (!startVal || !endVal) { warningEl.innerHTML = ''; return; }
                // Guard: end must not be before start
                if (endVal < startVal) {
                    warningEl.innerHTML = '<p class="text-red-600 text-sm mt-1">⚠️ End date cannot be before start date.</p>';
                    return;
                }
                if (onCallSet.size === 0) { warningEl.innerHTML = ''; return; }
                const conflicts = [];
                const cur  = new Date(startVal + 'T00:00:00');
                const endD = new Date(endVal   + 'T00:00:00');
                while (cur <= endD) {
                    const iso = cur.getFullYear() + '-' + String(cur.getMonth()+1).padStart(2,'0') + '-' + String(cur.getDate()).padStart(2,'0');
                    if (onCallSet.has(iso)) conflicts.push(iso);
                    cur.setDate(cur.getDate() + 1);
                }
                warningEl.innerHTML = conflicts.length > 0
                    ? `<p class="font-semibold text-red-700 mt-2">🚫 On-Call conflict on: ${conflicts.slice(0,5).join(', ')}${conflicts.length > 5 ? ` +${conflicts.length - 5} more` : ''}</p>`
                    : `<p class="text-green-700 text-sm mt-1">✅ No On-Call conflicts in this range</p>`;
            };

            app.submitCSBid = function() {
                if (this.state.isProcessedCorp) { alert('Bidding has been processed. No more bids.'); return; }
                if (this.isBiddingClosedCorp()) { alert('⛔ The bidding deadline has passed. You can no longer submit bids.'); return; }
                const csUser = this.state.verifiedEmployee;
                if (!csUser) return;
                if (!window.csSelectedSlot) { alert('⚠️ Please select a slot type first.'); return; }

                const startDate = document.getElementById('csStartDate')?.value;
                let endDate = document.getElementById('csEndDate')?.value;
                if (!startDate) { alert('⚠️ Please select a start date.'); return; }

                if (window.csSelectedSlot === 'csCustom') {
                    if (!endDate) { alert('⚠️ Please enter an end date for Custom slot.'); return; }
                    if (endDate < startDate) { alert('⚠️ End date must be after start date.'); return; }
                }

                const days = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1;

                if (window.csSelectedSlot !== 'csCustom') {
                    const slot = this.state.slotTypes.find(s => s.id === window.csSelectedSlot);
                    if (slot && days !== slot.days) {
                        alert(`${slot.name} requires exactly ${slot.days} days. Select "Custom" for free range.`);
                        return;
                    }
                }

                // Block leave continuity across the Dec→Jan year-end transition: staff
                // with already-approved December leave cannot bid on a January slot.
                if (this._blocksJanuaryBid(csUser.id, startDate, endDate, this.state.biddingYearCorp)) {
                    alert('⛔ You already have approved leave in December. To avoid continuous leave across the year-end, you cannot bid on a January slot. Please contact the planner if you believe this is incorrect.');
                    return;
                }

                // Check overlap with existing CS bids
                const csBids = this.state.bids.filter(bid => bid.employeeId === csUser.id);
                for (const bid of csBids) {
                    if (this.checkDateOverlap(startDate, endDate, bid.startDate, bid.endDate)) {
                        alert(`Date overlap with an existing bid (${bid.startDate} → ${bid.endDate}).`);
                        return;
                    }
                }

                // ── On-Call Conflict Check ────────────────────────────────────
                const uid = csUser.id;
                const allOnCallForCS = new Set([
                    ...(this.state.onCallDates[uid] || []),
                    ...(this.state.onCallDates['l456inm::' + uid] || []),
                    ...(this.state.onCallDates['l3inm::' + uid] || []),
                    ...(this.state.onCallDates['l3tsm::' + uid] || []),
                    ...(this.state.onCallDates['hseq::' + uid] || []),
                ]);
                const onCallDatesForCS = allOnCallForCS;
                if (onCallDatesForCS.size > 0) {
                    const conflictingOnCallDates = [];
                    const cur = new Date(startDate + 'T00:00:00');
                    const end2 = new Date(endDate + 'T00:00:00');
                    while (cur <= end2) {
                        const iso = cur.getFullYear() + '-' + String(cur.getMonth()+1).padStart(2,'0') + '-' + String(cur.getDate()).padStart(2,'0');
                        if (onCallDatesForCS.has(iso)) conflictingOnCallDates.push(iso);
                        cur.setDate(cur.getDate() + 1);
                    }
                    if (conflictingOnCallDates.length > 0) {
                        const conflictList = conflictingOnCallDates.join(', ');
                        alert(`⚠️ On-Call Conflict Detected!\n\nYour selected leave period (${startDate} → ${endDate}) overlaps with your scheduled On-Call duties on the following date${conflictingOnCallDates.length > 1 ? 's' : ''}:\n\n${conflictList}\n\nPlease choose dates that do not conflict with your On-Call schedule.`);
                        return;
                    }
                }

                const slotLabel = window.csSelectedSlot === 'csCustom'
                    ? 'Custom' : (this.state.slotTypes.find(s => s.id === window.csSelectedSlot)?.name || window.csSelectedSlot);

                const newBid = {
                    employeeId: csUser.id,
                    employeeName: csUser.name,
                    seniorityDate: csUser.seniorityDate || '2000-01-01',
                    department: 'Corporate Staff',
                    slotType: window.csSelectedSlot,
                    startDate,
                    endDate,
                    days,
                    timestamp: new Date().toISOString()
                };

                this.state.bids.push(newBid);
                this.saveState();
                this.writeAuditLog('BID_PLACED', { type: 'CS', slot: window.csSelectedSlot, start: startDate, end: endDate, days });

                this.saveBidToSupabase(newBid).then(saved => {
                    if (saved) console.log('✅ CS Bid saved to Supabase');
                });

                alert(`🏢 Corporate Staff Bid placed!\n${slotLabel} — ${startDate} → ${endDate} (${days} day${days !== 1 ? 's' : ''})`);
                this.renderCorporateStaffBiddingView();
            };

            app.removeCSBid = async function(slotType, startDate) {
                if (this.state.isProcessedCorp) { alert('Cannot remove bids after processing.'); return; }
                if (!confirm('Remove this Corporate Staff bid?')) return;
                const csUser = this.state.verifiedEmployee;

                // 1. Optimistically remove from local state and persist immediately
                const idx = this.state.bids.findIndex(bid =>
                    bid.employeeId === csUser.id && bid.slotType === slotType && bid.startDate === startDate
                );
                if (idx !== -1) this.state.bids.splice(idx, 1);
                this.saveState();
                this.renderCorporateStaffBiddingView();

                // 2. Delete from Supabase and AWAIT the result so a failure is surfaced
                if (!this.supabase) {
                    this.writeAuditLog('BID_REMOVED', { employee_id: csUser.id, slot_type: slotType, start_date: startDate, section: 'corporate_staff' });
                    return;
                }
                const { error } = await this.supabase
                    .from('corporate_leave_request')
                    .delete()
                    .eq('tenant_id', this._tid())
                    .eq('employee_id', csUser.id)
                    .eq('slot_type', slotType)
                    .eq('start_date', startDate);

                if (error) {
                    console.error('❌ CS Bid delete failed:', error.message);
                    alert('Could not delete from server — please retry.');
                    return;
                }
                console.log('✅ CS Bid deleted from Supabase');
                this.writeAuditLog('BID_REMOVED', { employee_id: csUser.id, slot_type: slotType, start_date: startDate, section: 'corporate_staff' });
            };

            app.refreshAvailableSlots = function() {
                const monthSelect = document.getElementById('selectedMonth');
                if (!monthSelect) return;
                const month = monthSelect.value;
                const container = document.getElementById('availableSlotCards');
                if (!container) return;

                const emp   = this.state.verifiedEmployee;
                const userBids = this.state.bids.filter(b => b.employeeId === emp?.id);
                const isProcessed = this.state.isProcessed;
                // Route to the correct store based on user type
                const isMaint = this.state.userType === 'maintenancestaff';
                const storeOptions = isMaint
                    ? [{ caps: this.state.maintSlotCapacities, prefix: 'cal-maint-' }]
                    : [{ caps: this.state.slotCapacities,      prefix: 'cal-' }];
                let caps        = storeOptions[0].caps;
                let activePrefix = storeOptions[0].prefix;

                const fullEmp = this.state.employees.find(e => e.id === emp?.id) || emp || {};

                const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const normalizeDept = (d) => {
                    if (!d) return '';
                    return d.replace(/\.\d+(\s*\(.*?\))?$/, '').replace(/\s+/g, ' ').trim().toLowerCase();
                };
                const rawCandidates = [fullEmp.department, fullEmp.position, emp?.department, emp?.position].filter(Boolean);
                const normalizedCandidates = rawCandidates.map(d =>
                    d.replace(/\.\d+(\s*\(.*?\))?$/, '').replace(/\s+/g, ' ').trim()
                );
                const deptCandidates = [...new Set([...rawCandidates, ...normalizedCandidates].filter(Boolean))];

                const colorMap = {
                    SA: { border:'border-green-400', bg:'bg-green-50', badge:'bg-green-600', text:'text-green-800', label:'Slot A' },
                    SB: { border:'border-blue-400',  bg:'bg-blue-50',  badge:'bg-blue-600',  text:'text-blue-800',  label:'Slot B' },
                    SC: { border:'border-purple-400',bg:'bg-purple-50',badge:'bg-purple-600',text:'text-purple-800',label:'Slot C' },
                    SD: { border:'border-orange-400',bg:'bg-orange-50',badge:'bg-orange-600',text:'text-orange-800',label:'Slot D' }
                };

                const isEnabledIn = (store, prefix, dept, sid) => {
                    const raw = store[prefix + dept + '-' + month + '-' + sid + '-enabled'];
                    if (raw === undefined || raw === null)
                        return !!(store[prefix + dept + '-' + month + '-' + sid + '-start'] &&
                                  store[prefix + dept + '-' + month + '-' + sid + '-end']);
                    return typeof raw === 'string' ? raw === 'true' : !!raw;
                };

                const buildSlotDefsIn = (store, prefix, deptKey) => {
                    return ['SA','SB','SC','SD'].map(sid => {
                        if (!isEnabledIn(store, prefix, deptKey, sid)) return null;
                        const start = store[prefix + deptKey + '-' + month + '-' + sid + '-start'];
                        const end   = store[prefix + deptKey + '-' + month + '-' + sid + '-end'];
                        if (!start || !end) return null;
                        const capacity = parseInt(store[prefix + deptKey + '-' + month + '-' + sid + '-capacity']) || 1;
                        const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
                        return { sid, start, end, capacity, days, colors: colorMap[sid] };
                    }).filter(Boolean);
                };

                // Pass 1: exact key lookup
                let resolvedDept = null;
                let slotDefs = [];
                outer1: for (const { caps: store, prefix } of storeOptions) {
                    for (const deptTry of deptCandidates) {
                        const defs = buildSlotDefsIn(store, prefix, deptTry);
                        if (defs.length > 0) {
                            caps = store; activePrefix = prefix;
                            resolvedDept = deptTry; slotDefs = defs;
                            break outer1;
                        }
                    }
                }

                // Pass 2: full key scan with scoring
                if (slotDefs.length === 0) {
                    const suffix = '-' + month + '-';
                    const empNorms = [...new Set([...rawCandidates, ...normalizedCandidates].map(normalizeDept).filter(Boolean))];
                    const scoreMatch = (dk) => {
                        const dn = normalizeDept(dk);
                        for (const c of empNorms) {
                            if (dn === c) return 3;
                            if (c.startsWith(dn)) return 2;
                            if (dn.startsWith(c)) return 1;
                        }
                        return 0;
                    };
                    outer2: for (const { caps: store, prefix } of storeOptions) {
                        const foundDepts = new Set();
                        Object.keys(store).forEach(k => {
                            if (!k.startsWith(prefix)) return;
                            const mid = k.indexOf(suffix);
                            if (mid === -1) return;
                            if (!/^(SA|SB|SC)-start$/.test(k.slice(mid + suffix.length))) return;
                            const dp = k.slice(prefix.length, mid);
                            if (dp) foundDepts.add(dp);
                        });
                        const ranked = [...foundDepts].map(d => ({ d, score: scoreMatch(d) }))
                            .filter(x => x.score > 0).sort((a, b) => b.score - a.score);
                        for (const { d: deptTry } of ranked) {
                            const defs = buildSlotDefsIn(store, prefix, deptTry);
                            if (defs.length > 0) {
                                caps = store; activePrefix = prefix;
                                resolvedDept = deptTry; slotDefs = defs;
                                break outer2;
                            }
                        }
                    }
                }

                const bidCount = {};
                if (resolvedDept) {
                    this.state.bids.forEach(b => {
                        ['SA','SB','SC','SD'].forEach(sid => {
                            const s = caps[activePrefix + resolvedDept + '-' + month + '-' + sid + '-start'];
                            const e = caps[activePrefix + resolvedDept + '-' + month + '-' + sid + '-end'];
                            if (s && e && b.startDate === s && b.endDate === e)
                                bidCount[sid] = (bidCount[sid] || 0) + 1;
                        });
                    });
                }
                // Attach bid counts; capacity is planner-set seats — used only during allocation, not bidding
                slotDefs = slotDefs.map(s => ({
                    ...s,
                    bidsPlaced: bidCount[s.sid] || 0
                }));

                // Seniority gate (OPS staff only — Maintenance is unaffected):
                //   ≤5 years of service → can only see/bid Slot A & Slot B
                //   >5 years of service → can only see/bid Slot C & Slot D
                const slotDefsBeforeGate = slotDefs;
                let empYearsForGate = 0;
                if (!isMaint) {
                    empYearsForGate = emp?.seniorityDate
                        ? (new Date() - new Date(emp.seniorityDate)) / (1000 * 60 * 60 * 24 * 365.25)
                        : 0;
                    if (empYearsForGate > 5) {
                        slotDefs = slotDefs.filter(s => s.sid === 'SC' || s.sid === 'SD');
                    } else {
                        slotDefs = slotDefs.filter(s => s.sid === 'SA' || s.sid === 'SB');
                    }
                }

                // Reset selected slot ONLY when the month has changed
                const currentMonth = window._lastSlotMonth;
                if (currentMonth !== month) {
                    window.selectedSlot    = null;
                    window.selectedSlotDef = null;
                    const confirmBox = document.getElementById('selectedSlotConfirm');
                    if (confirmBox) confirmBox.classList.add('hidden');
                }
                window._lastSlotMonth = month;

                if (slotDefs.length === 0) {
                    if (!isMaint && slotDefsBeforeGate.length > 0) {
                        const eligibleLabel = empYearsForGate > 5 ? 'Slot C / Slot D' : 'Slot A / Slot B';
                        const ineligibleLabel = empYearsForGate > 5 ? 'Slot A / Slot B' : 'Slot C / Slot D';
                        container.innerHTML =
                            '<div class="p-4 bg-orange-50 border border-orange-200 rounded-lg text-center">'
                            + '<p class="text-orange-700 font-semibold">No ' + eligibleLabel + ' configured for ' + this.blockLabel(month) + '</p>'
                            + '<p class="text-xs text-orange-600 mt-1">Based on ' + empYearsForGate.toFixed(1) + ' years of service, you can only bid into ' + eligibleLabel + '. '
                            + 'The planner has configured ' + ineligibleLabel + ' for this block, but not ' + eligibleLabel + '.</p>'
                            + '</div>';
                        return;
                    }
                    const diagDept = deptCandidates.join(' / ') || '(no department on record)';
                    const monthKeys = Object.keys(caps).filter(k => k.includes('-' + month + '-') && k.endsWith('-start'));
                    const diagKeys = monthKeys.length > 0
                        ? [...new Set(monthKeys.map(k => k.replace('-' + month + '-SA-start','').replace('-' + month + '-SB-start','').replace('-' + month + '-SC-start','').replace('-' + month + '-SD-start','').replace(/^cal-maint-/,'').replace(/^cal-/,'')))].join(', ')
                        : 'none';
                    const allStartKeys = Object.keys(caps).filter(k => /-(SA|SB|SC|SD)-start$/.test(k));
                    const allConfigDepts = [...new Set(allStartKeys.map(k => k.replace(/^cal-maint-/,'').replace(/^cal-/,'').replace(/-(SA|SB|SC|SD)-start$/,'').replace(/-(January|February|March|April|May|June|July|August|September|October|November|December)-/,' -> ')))].slice(0,20);
                    const allDeptsHtml = allConfigDepts.length > 0 ? allConfigDepts.join('<br>') : 'No slots configured anywhere yet';
                    container.innerHTML =
                        '<div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">'
                        + '<p class="text-yellow-700 font-semibold">No slots configured for ' + this.blockLabel(month) + '</p>'
                        + '<p class="text-xs text-yellow-600 mt-1">The planner has not opened any slots for this block yet.</p>'
                        + '<p class="text-xs text-gray-400 mt-2">Dept lookup tried: <code>' + diagDept + '</code></p>'
                        + '<p class="text-xs text-gray-400 mt-1">Configured depts for ' + month + ': <code>' + diagKeys + '</code></p>'
                        + '<details class="mt-2 text-left"><summary class="text-xs text-gray-400 cursor-pointer">All configured dept/month combinations (' + allConfigDepts.length + ')</summary>'
                        + '<div class="mt-1 text-xs text-gray-500 font-mono bg-white border rounded p-2 max-h-32 overflow-y-auto">' + allDeptsHtml + '</div></details>'
                        + '</div>';
                    return;
                }

                container.innerHTML = slotDefs.map(s => {
                    const alreadyBid      = userBids.some(b => b.startDate === s.start && b.endDate === s.end);
                    // Per-month cap: count bids for the currently selected month
                    const bidsThisMonth   = userBids.filter(b => b.month === month).length;
                    const monthLimitHit   = !alreadyBid && bidsThisMonth >= 2;
                    // Slots are NEVER blocked by how many others have bid — open preference model
                    const disabled        = alreadyBid || monthLimitHit || isProcessed;
                    const isSelected      = window.selectedSlot === s.sid;
                    const isCompetitive   = s.bidsPlaced >= s.capacity; // more bids than seats → seniority decides

                    let stateLabel = '';
                    let cardClass  = `border-2 rounded-xl p-4 cursor-pointer transition-all ${s.colors.border} ${s.colors.bg}`;
                    if (alreadyBid)        { stateLabel = '<span class="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded font-semibold ml-2">✓ Bid Placed</span>';           cardClass = 'border-2 rounded-xl p-4 border-green-300 bg-green-50 opacity-60 cursor-not-allowed'; }
                    else if (monthLimitHit){ stateLabel = '<span class="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded font-semibold ml-2">Month limit reached</span>'; cardClass = 'border-2 rounded-xl p-4 border-orange-200 bg-orange-50 opacity-50 cursor-not-allowed'; }
                    else if (isSelected)   { cardClass  = `border-2 rounded-xl p-4 border-blue-500 bg-blue-50 ring-2 ring-blue-300 cursor-pointer`; }

                    // Badge: show competitive warning if oversubscribed, otherwise show available seats
                    const badge = isCompetitive
                        ? `<span class="text-xs px-2 py-1 rounded font-semibold bg-orange-100 text-orange-700">⚡ ${s.bidsPlaced} bid${s.bidsPlaced !== 1 ? 's' : ''} · ${s.capacity} seat${s.capacity !== 1 ? 's' : ''}</span>`
                        : `<span class="text-xs px-2 py-1 rounded font-semibold ${s.colors.badge} text-white">${s.capacity} seat${s.capacity !== 1 ? 's' : ''} available</span>`;

                    const competitiveNote = isCompetitive && !alreadyBid && !monthLimitHit
                        ? ' · <span class="text-orange-600 font-medium">Awarded by seniority</span>'
                        : '';

                    return `
                        <div class="${cardClass}"
                             onclick="${disabled ? '' : `app.selectConfiguredSlot('${s.sid}','${s.start}','${s.end}',${s.days},'${s.colors.label}','${resolvedDept}')`}">
                            <div class="flex items-center justify-between mb-2">
                                <span class="font-bold text-gray-800">${s.colors.label}${stateLabel}</span>
                                ${badge}
                            </div>
                            <div class="text-sm ${s.colors.text}">
                                📅 ${s.start} → ${s.end}
                            </div>
                            <div class="text-xs text-gray-500 mt-1">⏱ ${s.days} days${competitiveNote}</div>
                        </div>`;
                }).join('');
            };

            app.selectConfiguredSlot = function(sid, start, end, days, label, resolvedDept) {
                window.selectedSlot    = sid;
                window.selectedSlotDef = { sid, start, end, days, label, resolvedDept };

                // Highlight selected card
                this.refreshAvailableSlots();

                // Show confirmation panel
                const box = document.getElementById('selectedSlotConfirm');
                if (box) {
                    document.getElementById('confirmSlotName').textContent  = label;
                    document.getElementById('confirmSlotDates').textContent = `${start} → ${end}`;
                    document.getElementById('confirmSlotDays').textContent  = days;
                    box.classList.remove('hidden');
                }
            };

            app.isBiddingClosed = function() {
                if (!this.state.biddingDeadline) return false;
                return (new Date(this.state.biddingDeadline) - new Date()) <= 0;
            };

            app.isBiddingClosedCorp = function() {
                if (!this.state.biddingDeadlineCorp) return false;
                return (new Date(this.state.biddingDeadlineCorp) - new Date()) <= 0;
            };

            app.submitBid = function() {
                if (!this.state.verifiedEmployee) {
                    alert('Please login first');
                    return;
                }

                if (this.state.isProcessed) {
                    alert('Bidding has been processed. No more bids allowed.');
                    return;
                }

                if (this.isBiddingClosed()) {
                    alert('⛔ The bidding deadline has passed. You can no longer submit bids.');
                    return;
                }

                // Use configured slot definition
                const slotDef = window.selectedSlotDef;
                if (!slotDef) {
                    alert('Please select an available slot first.');
                    return;
                }

                const startDate = slotDef.start;
                const endDate   = slotDef.end;
                const days      = slotDef.days;
                const monthSelect = document.getElementById('selectedMonth');
                const month = monthSelect ? monthSelect.value : this.state.months[0];

                if (!startDate || !endDate) {
                    alert('Slot has no configured dates. Please contact the planner.');
                    return;
                }

                // Block leave continuity across the Dec→Jan year-end transition: staff
                // with already-approved December leave cannot bid on a January slot.
                if (this._blocksJanuaryBid(this.state.verifiedEmployee.id, startDate, endDate, this.state.biddingYear)) {
                    alert('⛔ You already have approved leave in December. To avoid continuous leave across the year-end, you cannot bid on a January slot. Please contact the planner if you believe this is incorrect.');
                    return;
                }

                // Use the configured slot's label as the slotType key (SA/SB/SC/SD)
                const slotTypeKey = slotDef.sid; // 'SA', 'SB', 'SC', 'SD'

                // Seniority gate (OPS staff only): ≤5 years → Slot A/B only, >5 years → Slot C/D only.
                // Maintenance staff are routed through a different bidding flow and are unaffected.
                if (this.state.userType !== 'maintenancestaff') {
                    const empForGuard = this.state.employees.find(e => e.id === this.state.verifiedEmployee?.id) || this.state.verifiedEmployee;
                    const guardYears = empForGuard?.seniorityDate
                        ? (new Date() - new Date(empForGuard.seniorityDate)) / (1000 * 60 * 60 * 24 * 365.25)
                        : 0;
                    const isSeniorSlot = (slotTypeKey === 'SC' || slotTypeKey === 'SD');
                    const isJuniorSlot = (slotTypeKey === 'SA' || slotTypeKey === 'SB');
                    if (isSeniorSlot && guardYears <= 5) {
                        alert('⛔ Slot C and Slot D are only available to staff with more than 5 years of service.');
                        return;
                    }
                    if (isJuniorSlot && guardYears > 5) {
                        alert('⛔ Slot A and Slot B are only available to staff with 5 years of service or less. Staff with more than 5 years should bid into Slot C or Slot D.');
                        return;
                    }
                }

                const existingBid = this.state.bids.find(
                    bid => bid.employeeId === this.state.verifiedEmployee.id && bid.startDate === startDate && bid.endDate === endDate
                );
                
                if (existingBid) {
                    alert(`You have already placed a bid for this slot (${startDate} to ${endDate}).`);
                    return;
                }

                const userBids = this.state.bids.filter(bid => bid.employeeId === this.state.verifiedEmployee.id);
                
                // Calculate entitlement
                const calculateYearsOfService = (seniorityDate) => {
                    const today = new Date();
                    const joinDate = new Date(seniorityDate);
                    const years = (today - joinDate) / (1000 * 60 * 60 * 24 * 365.25);
                    return years;
                };
                
                const getEmployeeEntitlement = (employee) => {
                    if (!employee || !employee.seniorityDate) return 30;
                    const yearsOfService = calculateYearsOfService(employee.seniorityDate);
                    return yearsOfService >= 5 ? 35 : 30;
                };
                
                const entitlement = getEmployeeEntitlement(this.state.verifiedEmployee);

                // Enforce max 2 bids per calendar month (no cap on total preferences)
                const bidsThisMonth = userBids.filter(bid => bid.month === month);
                if (bidsThisMonth.length >= 2) {
                    alert(`You have already placed 2 bids for ${this.blockLabel(month)}. Maximum of 2 bids are allowed per block.\n\nYou may still bid in other blocks.`);
                    return;
                }

                const totalBidDays = userBids.reduce((sum, bid) => sum + bid.days, 0);
                // NOTE: No entitlement cap enforced here — bids are preferences only.
                // Entitlement limits are applied by the planner during seniority-based allocation.

                // Check for date overlaps with existing bids
                for (const bid of userBids) {
                    if (this.checkDateOverlap(startDate, endDate, bid.startDate, bid.endDate)) {
                        alert(`Date overlap detected with your existing bid (${bid.startDate} to ${bid.endDate})`);
                        return;
                    }
                }

                // Resolve department for bid record (capacity is enforced at allocation time, not here)
                const dept = slotDef.resolvedDept || 
                    ((this.state.verifiedEmployee.department && this.state.verifiedEmployee.department !== 'Unassigned')
                        ? this.state.verifiedEmployee.department
                        : (this.state.verifiedEmployee.position || ''));

                const newBid = {
                    employeeId: this.state.verifiedEmployee.id,
                    employeeName: this.state.verifiedEmployee.name,
                    seniorityDate: this.state.verifiedEmployee.seniorityDate,
                    position: this.state.verifiedEmployee.position || '',
                    department: dept, // use resolvedDept so planner sees correct dept
                    slotType: slotTypeKey,
                    slotLabel: slotDef.label, // 'Slot A' / 'Slot B' / 'Slot C' for display
                    month,
                    startDate,
                    endDate,
                    days,
                    timestamp: new Date().toISOString()
                };

                this.state.bids.push(newBid);
                this.saveState();
                this.writeAuditLog('BID_PLACED', { slot: slotTypeKey, start: startDate, end: endDate, days, department: newBid.department });

                // Store success message so re-rendered view can display it
                this._lastBidSuccess = `✅ Bid placed: ${slotDef.label} — ${startDate} → ${endDate} (${days} days)`;

                // Clear selection and refresh the view IMMEDIATELY (before async Supabase)
                window.selectedSlotDef = null;
                window.selectedSlot    = null;
                this.renderEmployeeBiddingView();

                // Save to Supabase in the background — UI already updated
                this.saveBidToSupabase(newBid).then(saved => {
                    if (!saved) {
                        console.warn('⚠️ Bid saved locally only — Supabase unavailable');
                        const statusEl = document.getElementById('systemStatus');
                        if (statusEl) statusEl.textContent = '⚠️ Bid saved locally — database sync pending';
                    } else {
                        const statusEl = document.getElementById('systemStatus');
                        if (statusEl) statusEl.textContent = '✅ Bid saved to database';
                    }
                });
            };

            app.removeBid = async function(employeeId, slotType, startDate) {
                if (this.state.isProcessed) {
                    alert('Cannot remove bids after processing');
                    return;
                }
                if (!confirm('Are you sure you want to remove this bid?')) return;

                // 1. Optimistically remove from local state and persist immediately
                this.state.bids = this.state.bids.filter(bid =>
                    !(bid.employeeId === employeeId &&
                      bid.slotType === slotType &&
                      bid.startDate === startDate)
                );
                this.saveState();
                this.renderEmployeeBiddingView();

                // 2. Delete from Supabase and AWAIT the result so a failure is surfaced
                if (!this.supabase) {
                    this.writeAuditLog('BID_REMOVED', { employee_id: employeeId, slot_type: slotType, start_date: startDate });
                    return;
                }
                const table = this._bidTableForUserType(this.state.userType);
                const { error } = await this.supabase
                    .from(table)
                    .delete()
                    .eq('tenant_id', this._tid())
                    .eq('employee_id', employeeId)
                    .eq('slot_type', slotType)
                    .eq('start_date', startDate);

                if (error) {
                    console.error(`❌ Delete failed [${table}]:`, error.message);
                    alert('Could not delete from server — please retry.');
                    return;
                }
                console.log(`✅ Bid deleted from ${table}`);
                this.writeAuditLog('BID_REMOVED', { employee_id: employeeId, slot_type: slotType, start_date: startDate });
            };

            app.renderMyResultsView = function() {
                const content = document.getElementById('contentArea');
                const user = this.state.verifiedEmployee;
                // Route to the correct results store based on user type — Maintenance
                // staff's awarded slots live entirely in maintResults/isMaintProcessed,
                // completely separate from Ops's results/isProcessed. Without this check,
                // a Maintenance staff member would always see "not processed yet" (or "no
                // assignment found") even after Process Maintenance Bids has genuinely run,
                // since their real results were never in the array this view was checking.
                const isMaint = this.state.userType === 'maintenancestaff';
                const myResultsPool = isMaint ? (this.state.maintResults || []) : this.state.results;
                const myIsProcessed = isMaint ? this.state.isMaintProcessed : this.state.isProcessed;

                const myResults = myResultsPool.filter(r => r.employeeId === user?.id)
                    .sort((a, b) => (a.slotOrder || 0) - (b.slotOrder || 0));

                const totalDays = myResults.reduce((sum, r) => sum + (r.days || 0), 0);
                const entitlement = myResults[0]?.entitlement || (user ? (myResultsPool.find(r => r.employeeId === user.id)?.entitlement) : 0) || '—';
                const rank = myResults[0]?.seniorityRank || '—';
                const yos = myResults[0]?.yearsOfService || '—';
                const allAwarded = myResults.length > 0 && myResults.every(r => r.type === 'Bid Awarded');
                const anyAwarded = myResults.some(r => r.type === 'Bid Awarded');

                // Format date nicely
                const fmtDate = (d) => {
                    if (!d) return '—';
                    try { return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }); }
                    catch(e) { return d; }
                };

                // Slot color config
                const slotColors = {
                    'Bid Awarded': { bg: 'bg-green-50', border: 'border-green-300', badge: 'bg-green-100 text-green-800', icon: '✅', label: 'Bid Awarded' },
                    'Auto-Assigned': { bg: 'bg-blue-50', border: 'border-blue-300', badge: 'bg-blue-100 text-blue-800', icon: '📋', label: 'Auto-Assigned' }
                };

                content.innerHTML = `
                    <div class="max-w-3xl mx-auto">

                        <!-- Page Header -->
                        <div class="mb-6">
                            <h2 class="text-2xl font-bold text-gray-800">📋 My Leave Results — ${this.state.biddingYear}</h2>
                            <p class="text-gray-500 text-sm mt-1">Your annual leave assignments for ${this.state.biddingYear}</p>
                        </div>

                        ${!myIsProcessed ? `
                            <!-- Not processed yet -->
                            <div class="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
                                <div class="text-5xl mb-4">⏳</div>
                                <h3 class="text-xl font-bold text-yellow-800 mb-2">Results Not Yet Available</h3>
                                <p class="text-yellow-700 text-sm">The planner has not processed the bids yet. Please check back later.</p>
                            </div>
                        ` : myResults.length === 0 ? `
                            <!-- Processed but no results for this user -->
                            <div class="bg-orange-50 border-2 border-orange-200 rounded-xl p-8 text-center">
                                <div class="text-5xl mb-4">🔍</div>
                                <h3 class="text-xl font-bold text-orange-800 mb-2">No Assignment Found</h3>
                                <p class="text-orange-700 text-sm">Bids have been processed but no assignment was found for your ID. Please contact the planner.</p>
                            </div>
                        ` : `

                            <!-- Summary Cards -->
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                <div class="bg-white rounded-xl shadow p-4 text-center border-t-4 border-blue-400">
                                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Dept. Seniority Rank</p>
                                    <p class="text-2xl font-bold text-blue-600">#${rank}</p>
                                </div>
                                <div class="bg-white rounded-xl shadow p-4 text-center border-t-4 border-purple-400">
                                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Years of Service</p>
                                    <p class="text-2xl font-bold text-purple-600">${yos}</p>
                                </div>
                                <div class="bg-white rounded-xl shadow p-4 text-center border-t-4 border-green-400">
                                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Days</p>
                                    <p class="text-2xl font-bold text-green-600">${totalDays}</p>
                                </div>
                                <div class="bg-white rounded-xl shadow p-4 text-center border-t-4 border-yellow-400">
                                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Entitlement</p>
                                    <p class="text-2xl font-bold text-yellow-600">${entitlement} days</p>
                                </div>
                            </div>

                            <!-- Overall Status Banner -->
                            <div class="mb-6 rounded-xl p-4 text-center font-semibold text-sm
                                ${allAwarded ? 'bg-green-100 border border-green-300 text-green-800' :
                                  anyAwarded ? 'bg-yellow-100 border border-yellow-300 text-yellow-800' :
                                  'bg-blue-100 border border-blue-300 text-blue-800'}">
                                ${allAwarded ? '🎉 All your bids were awarded!' :
                                  anyAwarded ? '⚡ Partial bid award — one slot bid awarded, one auto-assigned.' :
                                  '📋 Both slots were auto-assigned by the system.'}
                            </div>

                            <!-- Slot Cards -->
                            <div class="space-y-4 mb-6">
                                ${myResults.map((result, i) => {
                                    const colors = slotColors[result.type] || slotColors['Auto-Assigned'];
                                    return `
                                    <div class="bg-white rounded-xl shadow-md border-l-4 ${result.type === 'Bid Awarded' ? 'border-green-400' : 'border-blue-400'} overflow-hidden">
                                        <div class="p-5">
                                            <div class="flex items-center justify-between mb-3">
                                                <div class="flex items-center gap-2">
                                                    <span class="text-lg font-bold text-gray-700">Slot ${result.slotOrder || i + 1}</span>
                                                    <span class="px-3 py-1 rounded-full text-xs font-bold ${result.type === 'Bid Awarded' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}">
                                                        ${colors.icon} ${colors.label}
                                                    </span>
                                                </div>
                                                <span class="text-2xl font-bold text-gray-800">${result.days} <span class="text-sm font-normal text-gray-500">days</span></span>
                                            </div>

                                            <h3 class="text-xl font-bold text-gray-800 mb-3">${result.slotName || '—'}</h3>

                                            <div class="grid grid-cols-2 gap-4">
                                                <div class="bg-gray-50 rounded-lg p-3">
                                                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Start Date</p>
                                                    <p class="font-semibold text-gray-800">${fmtDate(result.startDate)}</p>
                                                </div>
                                                <div class="bg-gray-50 rounded-lg p-3">
                                                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">End Date</p>
                                                    <p class="font-semibold text-gray-800">${fmtDate(result.endDate)}</p>
                                                </div>
                                            </div>

                                            ${result.type === 'Bid Awarded' ? `
                                                <p class="text-xs text-green-600 mt-3 font-medium">✓ This slot matched your bid preference (choice ${result.bidChoice || i + 1})</p>
                                            ` : `
                                                <p class="text-xs text-blue-600 mt-3 font-medium">ℹ This slot was automatically assigned based on availability</p>
                                            `}
                                        </div>

                                        <!-- Calendar mini-bar -->
                                        <div class="bg-gray-50 border-t px-5 py-3 flex items-center gap-2 text-xs text-gray-500">
                                            <span>📅</span>
                                            <span>${fmtDate(result.startDate)} → ${fmtDate(result.endDate)}</span>
                                            <span class="ml-auto font-semibold text-gray-700">${result.days} calendar days</span>
                                        </div>
                                    </div>
                                    `;
                                }).join('')}
                            </div>

                            <!-- Note -->
                            <div class="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
                                <p class="font-semibold text-gray-700 mb-1">📌 Important Notes</p>
                                <ul class="list-disc list-inside space-y-1 text-xs">
                                    <li>Leave assignments are final once processed by the planner.</li>
                                    <li>If you have questions about your assignment, contact your planner directly.</li>
                                    <li>Total allocated: <strong>${totalDays} days</strong> out of your <strong>${entitlement}-day</strong> entitlement.</li>
                                </ul>
                            </div>
                        `}
                    </div>
                `;
            };

            app.renderResultsView = function() {
                const content = document.getElementById('contentArea');
                
                // Group results by employee
                const employeeResults = {};
                this.state.results.forEach(result => {
                    if (!employeeResults[result.employeeId]) {
                        employeeResults[result.employeeId] = [];
                    }
                    employeeResults[result.employeeId].push(result);
                });
                
                content.innerHTML = `
                    <div class="max-w-7xl mx-auto">
                        <div class="bg-white rounded-xl shadow-xl p-6">
                            <h2 class="text-2xl font-bold mb-6">Leave Assignments for ${this.state.biddingYear}</h2>
                            <p class="text-gray-600 mb-6">
                                Each employee receives exactly 2 slots. Senior employees (5+ years) get 35 days total,
                                others get 30 days total.
                            </p>
                            
                            ${this.state.results.length === 0 ? `
                                <div class="text-center py-8">
                                    <p class="text-gray-600">No results yet. Process bids first.</p>
                                    <button onclick="app.setActiveView('admin')" class="mt-4 px-4 py-2 rounded-lg" style="background:#3b82f6; color:#ffffff;">
                                        Go to Admin Panel
                                    </button>
                                </div>
                            ` : `
                                <div class="overflow-x-auto">
                                    <table class="w-full text-sm">
                                        <thead class="bg-gray-100">
                                            <tr>
                                                <th class="p-3 text-left">Position Rank</th>
                                                <th class="p-3 text-left">Operation Staff</th>
                                                <th class="p-3 text-left">Position / Dept</th>
                                                <th class="p-3 text-left">Seniority</th>
                                                <th class="p-3 text-left">Slot 1</th>
                                                <th class="p-3 text-left">Slot 2</th>
                                                <th class="p-3 text-left">Total Days</th>
                                                <th class="p-3 text-left">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${Object.entries(employeeResults).map(([empId, slots]) => {
                                                const employee = this.state.employees.find(e => e.id === empId);
                                                const slot1 = slots.find(s => s.slotOrder === 1);
                                                const slot2 = slots.find(s => s.slotOrder === 2);
                                                const totalDays = slots.reduce((sum, s) => sum + s.days, 0);
                                                const allAwarded = slots.every(s => s.type === 'Bid Awarded');
                                                const anyAwarded = slots.some(s => s.type === 'Bid Awarded');
                                                
                                                return `
                                                    <tr class="border-b hover:bg-gray-50">
                                                        <td class="p-3 font-mono text-sm">#${slot1?.deptSeniorityRank || slot1?.seniorityRank || 'N/A'}</td>
                                                        <td class="p-3">${employee?.name || 'Unknown'}<br>
                                                            <span class="text-xs text-gray-500">${empId}</span>
                                                        </td>
                                                        <td class="p-3 text-xs">${employee?.position || slot1?.position || '—'}<br><span class="text-gray-400">${slot1?.department || employee?.department || '—'}</span></td>
                                                        <td class="p-3">${slot1?.yearsOfService || 'N/A'} yrs</td>
                                                        <td class="p-3">
                                                            ${slot1?.slotName || 'N/A'}<br>
                                                            <span class="text-xs text-gray-500">${slot1?.startDate || ''} to ${slot1?.endDate || ''}</span><br>
                                                            <span class="text-xs ${slot1?.type === 'Bid Awarded' ? 'text-green-600' : 'text-blue-600'}">
                                                                ${slot1?.type || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td class="p-3">
                                                            ${slot2?.slotName || 'N/A'}<br>
                                                            <span class="text-xs text-gray-500">${slot2?.startDate || ''} to ${slot2?.endDate || ''}</span><br>
                                                            <span class="text-xs ${slot2?.type === 'Bid Awarded' ? 'text-green-600' : 'text-blue-600'}">
                                                                ${slot2?.type || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td class="p-3 font-bold">
                                                            ${(() => {
                                                                const empEntitlement = slot1?.entitlement ||
                                                                    (parseFloat(slot1?.yearsOfService || 0) >= 5 ? 35 : 30);
                                                                const overLimit = totalDays > empEntitlement;
                                                                return `
                                                                    <span class="${overLimit ? 'text-red-600' : 'text-gray-800'}">${totalDays} days</span>
                                                                    <br>
                                                                    <span class="text-xs font-normal ${overLimit ? 'text-red-500' : 'text-gray-400'}">
                                                                        limit: ${empEntitlement} days
                                                                    </span>
                                                                `;
                                                            })()}
                                                        </td>
                                                        <td class="p-3">
                                                            <span class="px-2 py-1 rounded text-xs ${
                                                                allAwarded ? 'bg-green-100 text-green-800' : 
                                                                anyAwarded ? 'bg-yellow-100 text-yellow-800' : 
                                                                'bg-blue-100 text-blue-800'
                                                            }">
                                                                ${allAwarded ? 'All Bids Awarded' : 
                                                                  anyAwarded ? 'Partial Award' : 
                                                                  'Auto-Assigned'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            `}
                        </div>
                    </div>
                `;
            };

