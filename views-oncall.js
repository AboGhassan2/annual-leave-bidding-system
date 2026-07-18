// ════════════════════════════════════════════════════════════════════
// views-oncall.js — the On-Call Manager screen.
//
// Attaches onto the shared `app` object, must load AFTER app.js AND
// after utils.js (uses this.weekNumberToDateRange() and
// this._parseMultiWeekInput() from utils.js).
//
// Covers: renderManageOnCallView and all the ways staff get added to
// on-call — single range, single week, multi-week (both the "Typed"
// and "Keyed" input variants), staff search/select, week preview, and
// removing/deleting on-call entries.
// ════════════════════════════════════════════════════════════════════

            app.renderManageOnCallView = function() {
                const content = document.getElementById('contentArea');
                const onCallDates = this.state.onCallDates || {};
                const year = this.state.biddingYearCorp;
                const gcUsers = this.state.goldenCommandUsers || [];
                const csUsers = this.state.corporateStaffUsers || [];
                const l456InmUsers = this.state.l456InmUsers || [];
                const l3InmUsers   = this.state.l3InmUsers   || [];
                const l3TsmUsers   = this.state.l3TsmUsers   || [];
                const hseqUsers    = this.state.hseqUsers    || [];

                if (!window._ocTab) window._ocTab = 'gc';

                const getStaffName = (id) => {
                    const gc = gcUsers.find(u => u.id === id); if (gc) return gc.name;
                    const cs = csUsers.find(u => u.id === id); if (cs) return cs.name;
                    const l456 = l456InmUsers.find(u => u.id === id); if (l456) return l456.name;
                    const l3inm = l3InmUsers.find(u => u.id === id); if (l3inm) return l3inm.name;
                    const l3tsm = l3TsmUsers.find(u => u.id === id); if (l3tsm) return l3tsm.name;
                    const hseqU = hseqUsers.find(u => u.id === id); if (hseqU) return hseqU.name;
                    const emp = (this.state.employees || []).find(e => e.id === id); if (emp) return emp.name;
                    return id;
                };

                const getWeekNum = (dateStr) => {
                    const dt = new Date(dateStr + 'T00:00:00');
                    const jan1 = new Date(dt.getFullYear(), 0, 1);
                    const week1Sun = new Date(jan1); week1Sun.setDate(jan1.getDate() - jan1.getDay());
                    const wn = Math.floor((dt - week1Sun) / (7*24*60*60*1000)) + 1;
                    return wn >= 53 ? 1 : wn;
                };

                const buildAudit = (ids, deptPfx) => {
                    const dateOwners = {};
                    ids.forEach(id => {
                        const key = deptPfx ? deptPfx + '::' + id : id;
                        (onCallDates[key] || []).forEach(raw => {
                            const d = String(raw).substring(0,10);
                            if (!dateOwners[d]) dateOwners[d] = [];
                            dateOwners[d].push(id);
                        });
                    });
                    const uncovered = [], overlapping = [];
                    for (let w = 1; w <= 52; w++) {
                        const r = this.weekNumberToDateRange(w, year);
                        const cur = new Date(r.from + 'T00:00:00'), end = new Date(r.to + 'T00:00:00');
                        const fmt = d2 => d2.getFullYear()+'-'+String(d2.getMonth()+1).padStart(2,'0')+'-'+String(d2.getDate()).padStart(2,'0');
                        let covered = false, overlap = false;
                        while (cur <= end) {
                            const iso = fmt(cur); const owners = dateOwners[iso] || [];
                            if (owners.length > 0) covered = true;
                            if (owners.length > 1) overlap  = true;
                            cur.setDate(cur.getDate() + 1);
                        }
                        if (!covered) uncovered.push(w);
                        if (overlap)  overlapping.push(w);
                    }
                    return { dateOwners, uncovered, overlapping };
                };

                const renderAuditBanner = (audit) => {
                    const { uncovered, overlapping } = audit;
                    const cov = uncovered.length === 0, ovl = overlapping.length === 0;
                    return `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div class="rounded-xl p-4 border ${cov ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-lg">${cov ? '✅' : '⚠️'}</span>
                                <span class="font-bold text-sm ${cov ? 'text-green-800' : 'text-red-800'}">Coverage — ${cov ? 'All weeks covered' : uncovered.length + ' week(s) not covered'}</span>
                            </div>
                            ${cov ? `<p class="text-xs text-green-700">Every week in ${year} has at least one staff member assigned.</p>`
                                   : `<p class="text-xs text-red-700 mb-1">Weeks with no On-Call assignment:</p><div class="flex flex-wrap gap-1">${uncovered.map(w => `<span class="bg-red-200 text-red-800 text-xs font-bold px-2 py-0.5 rounded">Wk ${w}</span>`).join('')}</div>`}
                        </div>
                        <div class="rounded-xl p-4 border ${ovl ? 'bg-green-50 border-green-300' : 'bg-orange-50 border-orange-300'}">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-lg">${ovl ? '✅' : '⚠️'}</span>
                                <span class="font-bold text-sm ${ovl ? 'text-green-800' : 'text-orange-800'}">Overlaps — ${ovl ? 'No overlapping weeks' : overlapping.length + ' week(s) overlap'}</span>
                            </div>
                            ${ovl ? `<p class="text-xs text-green-700">No two staff members share the same On-Call dates.</p>`
                                   : `<p class="text-xs text-orange-700 mb-1">Multiple staff assigned on same dates:</p><div class="flex flex-wrap gap-1">${overlapping.map(w => `<span class="bg-orange-200 text-orange-800 text-xs font-bold px-2 py-0.5 rounded">Wk ${w}</span>`).join('')}</div>`}
                        </div>
                    </div>`;
                };

                const renderCard = (id, dateOwners, isGCPanel, colorTheme, deptPfx) => {
                    const ocKey = deptPfx ? deptPfx + '::' + id : id;
                    const dates = (onCallDates[ocKey] || []).slice().sort();
                    const grouped = {};
                    dates.forEach(d => {
                        const dt = new Date(d + 'T00:00:00');
                        const ws = new Date(dt); ws.setDate(dt.getDate() - dt.getDay());
                        const key = ws.getFullYear()+'-'+String(ws.getMonth()+1).padStart(2,'0')+'-'+String(ws.getDate()).padStart(2,'0');
                        if (!grouped[key]) grouped[key] = [];
                        grouped[key].push(d);
                    });
                    const chipBase  = isGCPanel ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
                                    : colorTheme === 'orange' ? 'bg-orange-50 border-orange-300 text-orange-800'
                                    : colorTheme === 'purple' ? 'bg-purple-50 border-purple-300 text-purple-800'
                                    : colorTheme === 'teal'   ? 'bg-teal-50 border-teal-300 text-teal-800'
                                    : colorTheme === 'rose'   ? 'bg-rose-50 border-rose-300 text-rose-800'
                                    : 'bg-blue-50 border-blue-300 text-blue-800';
                    const btnCol    = isGCPanel ? 'bg-yellow-500 hover:bg-yellow-600'
                                    : colorTheme === 'orange' ? 'bg-orange-500 hover:bg-orange-600'
                                    : colorTheme === 'purple' ? 'bg-purple-500 hover:bg-purple-600'
                                    : colorTheme === 'teal'   ? 'bg-teal-500 hover:bg-teal-600'
                                    : colorTheme === 'rose'   ? 'bg-rose-500 hover:bg-rose-600'
                                    : 'bg-blue-600 hover:bg-blue-700';
                    const inputBdr  = isGCPanel ? 'border-yellow-300 focus:border-yellow-500'
                                    : colorTheme === 'orange' ? 'border-orange-300 focus:border-orange-500'
                                    : colorTheme === 'purple' ? 'border-purple-300 focus:border-purple-500'
                                    : colorTheme === 'teal'   ? 'border-teal-300 focus:border-teal-500'
                                    : colorTheme === 'rose'   ? 'border-rose-300 focus:border-rose-500'
                                    : 'border-blue-300 focus:border-blue-500';
                    const prevBg    = isGCPanel ? 'bg-yellow-100 border-yellow-200'
                                    : colorTheme === 'orange' ? 'bg-orange-100 border-orange-200'
                                    : colorTheme === 'purple' ? 'bg-purple-100 border-purple-200'
                                    : colorTheme === 'teal'   ? 'bg-teal-100 border-teal-200'
                                    : colorTheme === 'rose'   ? 'bg-rose-100 border-rose-200'
                                    : 'bg-blue-100 border-blue-200';
                    const cardBorder = isGCPanel ? 'border-yellow-200'
                                    : colorTheme === 'orange' ? 'border-orange-200'
                                    : colorTheme === 'purple' ? 'border-purple-200'
                                    : colorTheme === 'teal'   ? 'border-teal-200'
                                    : colorTheme === 'rose'   ? 'border-rose-200'
                                    : 'border-blue-200';
                    const pfx       = isGCPanel ? 'gc'
                                    : colorTheme === 'orange' ? 'l456inm'
                                    : colorTheme === 'purple' ? 'l3inm'
                                    : colorTheme === 'teal'   ? 'l3tsm'
                                    : colorTheme === 'rose'   ? 'hseq'
                                    : 'cs';
                    const dateChips = dates.length === 0
                        ? '<p class="text-sm text-gray-400 italic">No On-Call dates assigned.</p>'
                        : Object.entries(grouped).map(([, wDates]) => {
                            const wNum = getWeekNum(wDates[0]);
                            const isOv = wDates.some(d2 => (dateOwners[d2] || []).length > 1);
                            const cc   = isOv ? 'bg-orange-100 text-orange-800 border-orange-300' : chipBase;
                            const lbl  = wDates.length >= 7
                                ? `Week ${wNum} (${wDates[0]} → ${wDates[wDates.length-1]})`
                                : `Week ${wNum} — ${wDates.join(', ')}`;
                            return `<div class="flex items-center gap-2 flex-wrap mb-1">
                                <span class="inline-block ${cc} text-xs font-semibold px-2 py-1 rounded border whitespace-nowrap">${lbl}${isOv?' ⚠️':''}</span>
                                <button onclick="app.deleteOnCallBlock('${ocKey}','${wDates[0]}','${wDates[wDates.length-1]}')"
                                    class="text-xs text-red-500 hover:text-red-700 underline whitespace-nowrap">🗑 Delete block</button>
                            </div>`;
                        }).join('');
                    const cardEid = ocKey.replace(/[^a-zA-Z0-9_-]/g, '_');
                    return `
                    <div class="bg-white rounded-xl shadow border ${cardBorder} p-5 mb-4" id="staff-card-${cardEid}">
                        <div class="flex items-center justify-between mb-3">
                            <div>
                                <p class="font-bold text-gray-800">${getStaffName(id)}</p>
                                <p class="text-xs text-gray-400">ID: ${id}</p>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-full">${dates.length} date${dates.length!==1?'s':''}</span>
                                <button onclick="app.removeFromOnCallList('${ocKey}','${pfx}')"
                                    class="text-xs font-semibold px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition">✕ Remove</button>
                            </div>
                        </div>
                        <div class="mb-4">${dateChips}</div>
                        <details class="mt-2">
                            <summary class="cursor-pointer text-sm font-semibold text-blue-600 hover:text-blue-800 select-none">➕ Add On-Call dates for this person</summary>
                            <div class="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                <div class="flex gap-2 mb-3">
                                    <button type="button" id="ocDateBtn-${cardEid}"
                                        onclick="document.getElementById('ocDateMode-${cardEid}').value='date';['ocDateFields','ocWeekFields','ocMultiFields'].forEach((f,i)=>{document.getElementById(f+'-${cardEid}').classList.toggle('hidden',i!==0);});['ocDateBtn','ocWeekBtn','ocMultiBtn'].forEach((b,i)=>{const el=document.getElementById(b+'-${cardEid}');el.classList.toggle('${btnCol.split(' ')[0]}',i===0);el.classList.toggle('text-white',i===0);el.classList.toggle('bg-white',i!==0);});"
                                        class="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border ${inputBdr} ${btnCol.split(' ')[0]} text-white transition-colors">📅 Date Range</button>
                                    <button type="button" id="ocWeekBtn-${cardEid}"
                                        onclick="document.getElementById('ocDateMode-${cardEid}').value='week';['ocDateFields','ocWeekFields','ocMultiFields'].forEach((f,i)=>{document.getElementById(f+'-${cardEid}').classList.toggle('hidden',i!==1);});['ocDateBtn','ocWeekBtn','ocMultiBtn'].forEach((b,i)=>{const el=document.getElementById(b+'-${cardEid}');el.classList.toggle('${btnCol.split(' ')[0]}',i===1);el.classList.toggle('text-white',i===1);el.classList.toggle('bg-white',i!==1);});"
                                        class="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border ${inputBdr} bg-white text-gray-700 transition-colors">🗓 Week Number</button>
                                    <button type="button" id="ocMultiBtn-${cardEid}"
                                        onclick="document.getElementById('ocDateMode-${cardEid}').value='multi';['ocDateFields','ocWeekFields','ocMultiFields'].forEach((f,i)=>{document.getElementById(f+'-${cardEid}').classList.toggle('hidden',i!==2);});['ocDateBtn','ocWeekBtn','ocMultiBtn'].forEach((b,i)=>{const el=document.getElementById(b+'-${cardEid}');el.classList.toggle('${btnCol.split(' ')[0]}',i===2);el.classList.toggle('text-white',i===2);el.classList.toggle('bg-white',i!==2);});"
                                        class="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border ${inputBdr} bg-white text-gray-700 transition-colors">📋 Multi-Week ✨</button>
                                </div>
                                <input type="hidden" id="ocDateMode-${cardEid}" value="date" />
                                <div id="ocDateFields-${cardEid}">
                                    <div class="grid grid-cols-2 gap-3 mb-3">
                                        <div><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">From</label>
                                            <input type="date" id="ocFrom-${cardEid}" class="w-full px-3 py-2 border ${inputBdr} rounded-lg text-sm focus:outline-none" /></div>
                                        <div><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">To</label>
                                            <input type="date" id="ocTo-${cardEid}" class="w-full px-3 py-2 border ${inputBdr} rounded-lg text-sm focus:outline-none" /></div>
                                    </div>
                                    <button onclick="app.addOnCallRangeKeyed('${ocKey}','${cardEid}')" class="w-full px-4 py-2 ${btnCol} text-white rounded-lg text-sm font-semibold transition-colors">✅ Add Block</button>
                                </div>
                                <div id="ocWeekFields-${cardEid}" class="hidden">
                                    <div class="grid grid-cols-2 gap-3 mb-2">
                                        <div><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Week Number</label>
                                            <input type="number" id="ocWeek-${cardEid}" min="1" max="52" placeholder="e.g. 10"
                                                oninput="(function(el,eid){const w=parseInt(el.value);const y=parseInt(document.getElementById('ocWeekYear-'+eid).value)||app.state.biddingYearCorp;if(w>=1&&w<=52){const r=app.weekNumberToDateRange(w,y);document.getElementById('ocWeekPreview-'+eid).textContent='→ '+r.from+' to '+r.to;}else{document.getElementById('ocWeekPreview-'+eid).textContent='';}})(this,'${cardEid}')"
                                                class="w-full px-3 py-2 border ${inputBdr} rounded-lg text-sm focus:outline-none" /></div>
                                        <div><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Year</label>
                                            <input type="number" id="ocWeekYear-${cardEid}" value="${this.state.biddingYearCorp}" min="2020" max="2040"
                                                oninput="(function(el,eid){const w=parseInt(document.getElementById('ocWeek-'+eid).value);const y=parseInt(el.value);if(w>=1&&w<=52&&y>=2020){const r=app.weekNumberToDateRange(w,y);document.getElementById('ocWeekPreview-'+eid).textContent='→ '+r.from+' to '+r.to;}else{document.getElementById('ocWeekPreview-'+eid).textContent='';}})(this,'${cardEid}')"
                                                class="w-full px-3 py-2 border ${inputBdr} rounded-lg text-sm focus:outline-none" /></div>
                                    </div>
                                    <p id="ocWeekPreview-${cardEid}" class="text-xs font-semibold mb-3 min-h-[1.2em] text-gray-600"></p>
                                    <button onclick="app.addOnCallWeekKeyed('${ocKey}','${cardEid}')" class="w-full px-4 py-2 ${btnCol} text-white rounded-lg text-sm font-semibold transition-colors">✅ Add Week Block</button>
                                </div>
                                <div id="ocMultiFields-${cardEid}" class="hidden">
                                    <div class="mb-2 p-2 bg-gray-100 border border-gray-200 rounded text-xs text-gray-700">
                                        e.g. <span class="font-mono bg-white px-1 rounded border">1-4, 10, 22-26</span>
                                    </div>
                                    <div class="grid grid-cols-3 gap-2 mb-2">
                                        <div class="col-span-2"><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Weeks / Ranges</label>
                                            <input type="text" id="ocMultiWeekInput-${cardEid}" placeholder="e.g. 1-4, 10, 22-26"
                                                oninput="_previewOcMultiChips('${cardEid}')"
                                                class="w-full px-2 py-2 border ${inputBdr} rounded-lg text-xs focus:outline-none font-mono"/></div>
                                        <div><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Year</label>
                                            <input type="number" id="ocMultiWeekYear-${cardEid}" value="${this.state.biddingYearCorp}" min="2020" max="2040"
                                                class="w-full px-2 py-2 border ${inputBdr} rounded-lg text-xs"/></div>
                                    </div>
                                    <div id="ocMultiPreview-${cardEid}" class="flex flex-wrap gap-1 mb-2 min-h-[26px] p-1.5 ${prevBg} rounded border">
                                        <span style="font-size:0.7rem;color:#93c5fd;font-style:italic;">Chips appear here…</span>
                                    </div>
                                    <button onclick="app.addOnCallMultiWeekKeyed('${ocKey}','${cardEid}')" class="w-full px-4 py-2 ${btnCol} text-white rounded-lg text-sm font-semibold transition-colors">✅ Add All Weeks</button>
                                </div>
                            </div>
                        </details>
                    </div>`;
                };

                const renderDeptPanel = (pfx, users, isGCPanel, label, icon, audit) => {
                    const btnCol  = isGCPanel ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700';
                    const inputCol = isGCPanel ? 'border-yellow-400 focus:border-yellow-500' : 'border-blue-400 focus:border-blue-500';
                    const panelBg  = isGCPanel ? 'bg-yellow-50 border-yellow-300' : 'bg-blue-50 border-blue-300';
                    const titleCol = isGCPanel ? 'text-yellow-800' : 'text-blue-800';
                    const prevBg   = isGCPanel ? 'bg-yellow-100 border-yellow-200' : 'bg-blue-100 border-blue-200';

                    return `
                    <div class="border-2 ${panelBg} rounded-xl p-5 mb-6">
                        <h3 class="font-bold ${titleCol} mb-1">${icon} Manage On-Call Dates — ${label}</h3>
                        <p class="text-xs text-gray-500 mb-4">Search or select a staff member to view and assign their On-Call dates.</p>

                        <!-- Search + Dropdown row -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            <div>
                                <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">&#128269; Search Staff</label>
                                <input type="text" id="ocSearch-${pfx}" placeholder="Type name or ID..."
                                    oninput="app._ocSearchFilter(this.value,'${pfx}')"
                                    class="w-full px-3 py-2 border ${inputCol} rounded-lg text-sm focus:outline-none bg-white" />
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Select Staff Member</label>
                                <select id="newOcSelect-${pfx}"
                                    onchange="app._ocSelectStaff(this.value,'${pfx}')"
                                    class="w-full px-3 py-2 border ${inputCol} rounded-lg text-sm focus:outline-none bg-white">
                                    <option value="">— Choose user —</option>
                                    ${users.map(u => `<option value="${u.id}">${icon} ${u.name} (${u.id})</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <input type="hidden" id="newOcId-${pfx}" />

                        <!-- Selected person's current dates -->
                        <div id="ocSelectedPreview-${pfx}" class="mb-4 min-h-[24px]"></div>

                        <!-- Mode toggle -->
                        <div class="flex gap-2 mb-3">
                            <button type="button" id="newOcDateBtn-${pfx}"
                                onclick="app._ocSetMode('${pfx}','date')"
                                class="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border ${inputCol} ${btnCol.split(' ')[0]} text-white transition-colors">&#128197; Date Range</button>
                            <button type="button" id="newOcWeekBtn-${pfx}"
                                onclick="app._ocSetMode('${pfx}','week')"
                                class="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border ${inputCol} bg-white text-gray-700 transition-colors">&#128197; Week Number</button>
                            <button type="button" id="newOcMultiBtn-${pfx}"
                                onclick="app._ocSetMode('${pfx}','multi')"
                                class="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border ${inputCol} bg-white text-gray-700 transition-colors">&#128203; Multi-Week</button>
                        </div>
                        <input type="hidden" id="newOcMode-${pfx}" value="date" />

                        <!-- Date Range fields -->
                        <div id="newOcDateFields-${pfx}">
                            <div class="grid grid-cols-2 gap-3 mb-3">
                                <div><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">From Date</label>
                                    <input type="date" id="newOcFrom-${pfx}" class="w-full px-3 py-2 border ${inputCol} rounded-lg text-sm focus:outline-none" /></div>
                                <div><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">To Date</label>
                                    <input type="date" id="newOcTo-${pfx}" class="w-full px-3 py-2 border ${inputCol} rounded-lg text-sm focus:outline-none" /></div>
                            </div>
                            <button onclick="app.addOnCallRangeNewTyped('${pfx}')" class="px-6 py-2 ${btnCol} text-white rounded-lg text-sm font-semibold transition-colors">&#10003; Add Block</button>
                        </div>

                        <!-- Week Number fields -->
                        <div id="newOcWeekFields-${pfx}" class="hidden">
                            <div class="grid grid-cols-2 gap-3 mb-2">
                                <div><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Week Number</label>
                                    <input type="number" id="newOcWeekNum-${pfx}" min="1" max="52" placeholder="e.g. 10"
                                        oninput="app._ocWeekPreview('${pfx}')"
                                        class="w-full px-3 py-2 border ${inputCol} rounded-lg text-sm focus:outline-none" /></div>
                                <div><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Year</label>
                                    <input type="number" id="newOcWeekYear-${pfx}" value="${this.state.biddingYearCorp}" min="2020" max="2040"
                                        oninput="app._ocWeekPreview('${pfx}')"
                                        class="w-full px-3 py-2 border ${inputCol} rounded-lg text-sm focus:outline-none" /></div>
                            </div>
                            <p id="newOcWeekPreview-${pfx}" class="text-xs font-semibold mb-3 min-h-[1.2em] text-gray-600"></p>
                            <button onclick="app.addOnCallWeekNewTyped('${pfx}')" class="px-6 py-2 ${btnCol} text-white rounded-lg text-sm font-semibold transition-colors">&#10003; Add Week Block</button>
                        </div>

                        <!-- Multi-Week fields -->
                        <div id="newOcMultiFields-${pfx}" class="hidden">
                            <div class="mb-2 p-2 bg-white border border-gray-200 rounded text-xs text-gray-600">
                                <strong>How to use:</strong> e.g. <span class="font-mono bg-gray-50 px-1 rounded border">1-4, 10, 22-26, 40</span>
                            </div>
                            <div class="grid grid-cols-3 gap-3 mb-3">
                                <div class="col-span-2"><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Week Numbers / Ranges</label>
                                    <input type="text" id="newOcMultiInput-${pfx}" placeholder="e.g. 1-4, 10, 22-26, 40"
                                        oninput="app._previewOcMultiChipsTyped('${pfx}')"
                                        class="w-full px-3 py-2 border-2 ${inputCol} rounded-lg text-sm focus:outline-none font-mono" /></div>
                                <div><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Year</label>
                                    <input type="number" id="newOcMultiYear-${pfx}" value="${this.state.biddingYearCorp}" min="2020" max="2040"
                                        class="w-full px-3 py-2 border ${inputCol} rounded-lg text-sm focus:outline-none" /></div>
                            </div>
                            <div id="newOcMultiPreview-${pfx}" class="flex flex-wrap gap-1 mb-3 min-h-[34px] p-2 ${prevBg} rounded-lg border">
                                <span class="text-xs text-gray-400 italic">Week chips appear here...</span>
                            </div>
                            <button onclick="app.addOnCallMultiWeekNewTyped('${pfx}')" class="px-8 py-2.5 ${btnCol} text-white rounded-lg text-sm font-bold transition-colors shadow">&#10003; Add All Weeks</button>
                        </div>
                    </div>`;
                };

                // keep renderAddSection as alias for GC panel
                const renderAddSection = (pfx, users, isGCPanel, customLabel, customIcon, colorTheme) => {
                    return renderDeptPanel(pfx, users, isGCPanel,
                        customLabel || (isGCPanel ? 'Golden Command' : 'Corporate Staff'),
                        customIcon  || (isGCPanel ? '⭐' : '🏢'),
                        null);
                };

                const gcIds    = new Set([...gcUsers.map(u => u.id),       ...Object.keys(onCallDates).filter(id => !id.includes('::') && gcUsers.find(u => u.id === id))]);
                const csIds    = new Set([...csUsers.map(u => u.id),       ...Object.keys(onCallDates).filter(id => !id.includes('::') && csUsers.find(u => u.id === id))]);
                const l456Ids  = new Set([...l456InmUsers.map(u => u.id),  ...Object.keys(onCallDates).filter(k => k.startsWith('l456inm::')).map(k => k.split('::')[1])]);
                const l3InmIds = new Set([...l3InmUsers.map(u => u.id),    ...Object.keys(onCallDates).filter(k => k.startsWith('l3inm::')).map(k => k.split('::')[1])]);
                const l3TsmIds = new Set([...l3TsmUsers.map(u => u.id),    ...Object.keys(onCallDates).filter(k => k.startsWith('l3tsm::')).map(k => k.split('::')[1])]);
                const hseqIds  = new Set([...hseqUsers.map(u => u.id),     ...Object.keys(onCallDates).filter(k => k.startsWith('hseq::')).map(k => k.split('::')[1])]);
                const gcAudit    = buildAudit([...gcIds]);
                const csAudit    = buildAudit([...csIds]);
                const l456Audit  = buildAudit([...l456Ids],  'l456inm');
                const l3InmAudit = buildAudit([...l3InmIds], 'l3inm');
                const l3TsmAudit = buildAudit([...l3TsmIds], 'l3tsm');
                const hseqAudit  = buildAudit([...hseqIds],  'hseq');
                const isGC = window._ocTab === 'gc';

                content.innerHTML = `
                <div class="max-w-4xl mx-auto">
                    <div class="flex items-center justify-between mb-6">
                        <div>
                            <h2 class="text-2xl font-bold text-gray-800">📅 On-Call Date Manager</h2>
                            <p class="text-sm text-gray-500 mt-1">Add or remove On-Call dates per staff member. Leave bids that conflict with these dates will be blocked.</p>
                        </div>
                        <button onclick="app.setActiveView('admin')" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200">← Back</button>
                    </div>

                    <div class="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
                        <button onclick="window._ocTab='gc'; app.renderManageOnCallView();"
                            class="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${window._ocTab === 'gc' ? 'bg-yellow-500 text-white shadow' : 'text-gray-500 hover:text-gray-700'}">
                            ⭐ Golden Command
                        </button>
                        <button onclick="window._ocTab='cs'; app.renderManageOnCallView();"
                            class="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${window._ocTab === 'cs' ? 'bg-blue-500 text-white shadow' : 'text-gray-500 hover:text-gray-700'}">
                            🏢 Corporate Staff
                        </button>
                    </div>

                    <!-- Golden Command Panel -->
                    <div id="ocPanel-gc" class="${window._ocTab === 'gc' ? '' : 'hidden'}">
                        ${renderAuditBanner(gcAudit)}
                        ${renderAddSection('gc', gcUsers, true)}
                        <div id="onCallStaffList-gc">
                            ${gcIds.size === 0
                                ? '<p class="text-center text-gray-400 py-12">No Golden Command users. Add GC users in the Admin panel first.</p>'
                                : [...gcIds].map(id => renderCard(id, gcAudit.dateOwners, true)).join('')
                            }
                        </div>
                    </div>

                    <!-- Corporate Staff Panel — contains CS + 3 sub-departments all using same staff -->
                    <div id="ocPanel-cs" class="${window._ocTab === 'cs' ? '' : 'hidden'}">

                    <!-- Corporate Staff group -->
                        <div class="mb-8">
                            <div class="flex items-center gap-2 mb-4 pb-2 border-b-2 border-blue-200">
                                <span class="text-xl">🏢</span>
                                <h3 class="text-lg font-bold text-blue-800">Corporate Staff</h3>
                            </div>
                            ${renderAuditBanner(csAudit)}
                            ${renderDeptPanel('cs', csUsers, false, 'Corporate Staff', '🏢', csAudit)}
                            <div id="onCallStaffList-cs">
                                ${csIds.size === 0
                                    ? '<p class="text-center text-gray-400 py-8">No Corporate Staff users. Add them in 👥 Manage Users first.</p>'
                                    : [...csIds].filter(id => (onCallDates[id]||[]).length > 0).map(id => renderCard(id, csAudit.dateOwners, false, null, null)).join('') || '<p class="text-center text-gray-400 py-4 text-sm italic">No staff assigned to On-Call yet. Use the panel above to add someone.</p>'
                                }
                            </div>
                        </div>

                        <!-- L456 INM group — same staff, separate schedule -->
                        <div class="mb-8">
                            <div class="flex items-center gap-2 mb-4 pb-2 border-b-2 border-blue-200">
                                <span class="text-xl">📋</span>
                                <h3 class="text-lg font-bold text-blue-800">L456 INM</h3>
                            </div>
                            ${renderAuditBanner(l456Audit)}
                            ${renderDeptPanel('l456inm', l456InmUsers, false, 'L456 INM', '📋', l456Audit)}
                            <div id="onCallStaffList-l456inm">
                                ${l456Ids.size === 0
                                    ? '<p class="text-center text-gray-400 py-8">No L456 INM users. Add them in 👥 Manage Users first.</p>'
                                    : [...l456Ids].filter(id => (onCallDates['l456inm::'+id]||[]).length > 0).map(id => renderCard(id, l456Audit.dateOwners, false, null, 'l456inm')).join('') || '<p class="text-center text-gray-400 py-4 text-sm italic">No staff assigned to On-Call yet.</p>'
                                }
                            </div>
                        </div>

                        <!-- L3 INM group — same staff, separate schedule -->
                        <div class="mb-8">
                            <div class="flex items-center gap-2 mb-4 pb-2 border-b-2 border-blue-200">
                                <span class="text-xl">📋</span>
                                <h3 class="text-lg font-bold text-blue-800">L3 INM</h3>
                            </div>
                            ${renderAuditBanner(l3InmAudit)}
                            ${renderDeptPanel('l3inm', l3InmUsers, false, 'L3 INM', '📋', l3InmAudit)}
                            <div id="onCallStaffList-l3inm">
                                ${l3InmIds.size === 0
                                    ? '<p class="text-center text-gray-400 py-8">No L3 INM users. Add them in 👥 Manage Users first.</p>'
                                    : [...l3InmIds].filter(id => (onCallDates['l3inm::'+id]||[]).length > 0).map(id => renderCard(id, l3InmAudit.dateOwners, false, null, 'l3inm')).join('') || '<p class="text-center text-gray-400 py-4 text-sm italic">No staff assigned to On-Call yet.</p>'
                                }
                            </div>
                        </div>

                        <!-- L3 TSM group — same staff, separate schedule -->
                        <div class="mb-8">
                            <div class="flex items-center gap-2 mb-4 pb-2 border-b-2 border-blue-200">
                                <span class="text-xl">📋</span>
                                <h3 class="text-lg font-bold text-blue-800">L3 TSM</h3>
                            </div>
                            ${renderAuditBanner(l3TsmAudit)}
                            ${renderDeptPanel('l3tsm', l3TsmUsers, false, 'L3 TSM', '📋', l3TsmAudit)}
                            <div id="onCallStaffList-l3tsm">
                                ${l3TsmIds.size === 0
                                    ? '<p class="text-center text-gray-400 py-8">No L3 TSM users. Add them in 👥 Manage Users first.</p>'
                                    : [...l3TsmIds].filter(id => (onCallDates['l3tsm::'+id]||[]).length > 0).map(id => renderCard(id, l3TsmAudit.dateOwners, false, null, 'l3tsm')).join('') || '<p class="text-center text-gray-400 py-4 text-sm italic">No staff assigned to On-Call yet.</p>'
                                }
                            </div>
                        </div>

                        <!-- HSEQ group — separate On-Call schedule -->
                        <div class="mb-8">
                            <div class="flex items-center gap-2 mb-4 pb-2 border-b-2 border-rose-200">
                                <span class="text-xl">🔰</span>
                                <h3 class="text-lg font-bold text-rose-800">HSEQ</h3>
                            </div>
                            ${renderAuditBanner(hseqAudit)}
                            ${renderDeptPanel('hseq', hseqUsers, false, 'HSEQ', '🔰', hseqAudit)}
                            <div id="onCallStaffList-hseq">
                                ${hseqIds.size === 0
                                    ? '<p class="text-center text-gray-400 py-8">No HSEQ users. Add them in 👥 Manage Users first.</p>'
                                    : [...hseqIds].filter(id => (onCallDates['hseq::'+id]||[]).length > 0).map(id => renderCard(id, hseqAudit.dateOwners, false, 'rose', 'hseq')).join('') || '<p class="text-center text-gray-400 py-4 text-sm italic">No staff assigned to On-Call yet.</p>'
                                }
                            </div>
                        </div>

                    </div>
                </div>`;
            };
            app.addOnCallRangeNewTyped = function(pfx) {
                const empId   = document.getElementById('newOcId-' + pfx)?.value?.trim();
                const dateFrom = document.getElementById('newOcFrom-' + pfx)?.value;
                const dateTo   = document.getElementById('newOcTo-'   + pfx)?.value;
                if (!empId) { alert('⚠️ Please select a staff member first.'); return; }
                const ocKey = (pfx === 'gc' || pfx === 'cs') ? empId : pfx + '::' + empId;
                this._applyOnCallRange(ocKey, dateFrom, dateTo);
                setTimeout(() => this._ocSelectStaff(empId, pfx), 200);
            };
            app.addOnCallWeekNewTyped = function(pfx) {
                const empId   = document.getElementById('newOcId-' + pfx)?.value?.trim();
                const weekNum = parseInt(document.getElementById('newOcWeekNum-' + pfx)?.value);
                const yr      = parseInt(document.getElementById('newOcWeekYear-' + pfx)?.value) || this.state.biddingYearCorp;
                if (!empId) { alert('⚠️ Please select a staff member first.'); return; }
                if (!weekNum || weekNum < 1 || weekNum > 52) { alert('⚠️ Enter a valid week (1–52).'); return; }
                const ocKey = (pfx === 'gc' || pfx === 'cs') ? empId : pfx + '::' + empId;
                const r = this.weekNumberToDateRange(weekNum, yr);
                this._applyOnCallRange(ocKey, r.from, r.to);
                setTimeout(() => this._ocSelectStaff(empId, pfx), 200);
            };
            app.addOnCallMultiWeekNewTyped = function(pfx) {
                const empId = document.getElementById('newOcId-' + pfx)?.value?.trim();
                const raw   = document.getElementById('newOcMultiInput-' + pfx)?.value || '';
                const yr    = parseInt(document.getElementById('newOcMultiYear-' + pfx)?.value) || this.state.biddingYearCorp;
                if (!empId) { alert('⚠️ Please select a staff member first.'); return; }
                const ocKey = (pfx === 'gc' || pfx === 'cs') ? empId : pfx + '::' + empId;
                const tokens = raw.split(/[\s,;]+/).filter(Boolean);
                const weeks  = new Set();
                for (const t of tokens) {
                    const m = t.match(/^(\d+)-(\d+)$/);
                    if (m) { for (let w = Math.max(1,+m[1]); w <= Math.min(52,+m[2]); w++) weeks.add(w); }
                    else { const n = +t; if (!isNaN(n) && n >= 1 && n <= 52) weeks.add(n); }
                }
                if (weeks.size === 0) { alert('⚠️ No valid week numbers found.'); return; }
                if (!this.state.onCallDates[ocKey]) this.state.onCallDates[ocKey] = [];
                const existing = new Set(this.state.onCallDates[ocKey]);
                let added = 0;
                [...weeks].forEach(w => {
                    const r = this.weekNumberToDateRange(w, yr);
                    const cur = new Date(r.from+'T00:00:00'), end = new Date(r.to+'T00:00:00');
                    while (cur <= end) {
                        const iso = cur.getFullYear()+'-'+String(cur.getMonth()+1).padStart(2,'0')+'-'+String(cur.getDate()).padStart(2,'0');
                        if (!existing.has(iso)) { existing.add(iso); added++; }
                        cur.setDate(cur.getDate()+1);
                    }
                });
                this.state.onCallDates[ocKey] = [...existing].sort();
                this.saveOnCallDatesToSupabase();
                alert(`✅ Added ${added} new date${added!==1?'s':''} for "${empId}".`);
                this.renderManageOnCallView();
            };
            app.addOnCallRangeKeyed = function(ocKey, cardEid) {
                const dateFrom = document.getElementById('ocFrom-' + cardEid)?.value;
                const dateTo   = document.getElementById('ocTo-'   + cardEid)?.value;
                this._applyOnCallRange(ocKey, dateFrom, dateTo);
            };
            app.addOnCallWeekKeyed = function(ocKey, cardEid) {
                const weekNum = parseInt(document.getElementById('ocWeek-' + cardEid)?.value);
                const yr      = parseInt(document.getElementById('ocWeekYear-' + cardEid)?.value) || this.state.biddingYearCorp;
                if (!weekNum || weekNum < 1 || weekNum > 52) { alert('⚠️ Enter a valid week (1–52).'); return; }
                const r = this.weekNumberToDateRange(weekNum, yr);
                this._applyOnCallRange(ocKey, r.from, r.to);
            };
            app.addOnCallMultiWeekKeyed = function(ocKey, cardEid) {
                const raw = document.getElementById('ocMultiWeekInput-' + cardEid)?.value || '';
                const yr  = parseInt(document.getElementById('ocMultiWeekYear-' + cardEid)?.value) || this.state.biddingYearCorp;
                const tokens = raw.split(/[\s,;]+/).filter(Boolean);
                const weeks  = new Set();
                for (const t of tokens) {
                    const m = t.match(/^(\d+)-(\d+)$/);
                    if (m) { for (let w = Math.max(1,+m[1]); w <= Math.min(52,+m[2]); w++) weeks.add(w); }
                    else { const n = +t; if (!isNaN(n) && n >= 1 && n <= 52) weeks.add(n); }
                }
                if (weeks.size === 0) { alert('⚠️ No valid week numbers found.'); return; }
                if (!this.state.onCallDates[ocKey]) this.state.onCallDates[ocKey] = [];
                const existing = new Set(this.state.onCallDates[ocKey]);
                let added = 0;
                [...weeks].forEach(w => {
                    const r = this.weekNumberToDateRange(w, yr);
                    const cur = new Date(r.from+'T00:00:00'), end = new Date(r.to+'T00:00:00');
                    while (cur <= end) {
                        const iso = cur.getFullYear()+'-'+String(cur.getMonth()+1).padStart(2,'0')+'-'+String(cur.getDate()).padStart(2,'0');
                        if (!existing.has(iso)) { existing.add(iso); added++; }
                        cur.setDate(cur.getDate()+1);
                    }
                });
                this.state.onCallDates[ocKey] = [...existing].sort();
                this.saveOnCallDatesToSupabase();
                alert(`✅ Added ${added} new dates.`);
                this.renderManageOnCallView();
            };
            app._previewOcMultiChipsTyped = function(pfx) {
                const raw = document.getElementById('newOcMultiInput-' + pfx)?.value || '';
                const yr  = parseInt(document.getElementById('newOcMultiYear-' + pfx)?.value) || (this.state?.biddingYearCorp || new Date().getFullYear());
                const box = document.getElementById('newOcMultiPreview-' + pfx);
                if (!box) return;
                const tokens = raw.split(/[\s,;]+/).filter(Boolean);
                const weeks  = new Set();
                for (const t of tokens) {
                    const m = t.match(/^(\d+)-(\d+)$/);
                    if (m) { for (let w = Math.max(1,+m[1]); w <= Math.min(52,+m[2]); w++) weeks.add(w); }
                    else { const n = +t; if (!isNaN(n) && n >= 1 && n <= 52) weeks.add(n); }
                }
                const arr = [...weeks].sort((a,b)=>a-b);
                if (!arr.length) { box.innerHTML = '<span class="text-xs text-gray-400 italic">Week chips appear here…</span>'; return; }
                box.innerHTML = arr.map(w => {
                    const r = app.weekNumberToDateRange(w, yr);
                    return `<span style="display:inline-flex;align-items:center;gap:4px;background:#fef3c7;border:1px solid #f59e0b;color:#92400e;font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:20px;margin:2px;">Wk ${w} <span style="opacity:.6;font-weight:400">${r.from}→${r.to}</span></span>`;
                }).join('');
            };
            app.removeFromOnCallList = function(ocKey, pfx) {
                const empId = ocKey.includes('::') ? ocKey.split('::')[1] : ocKey;
                const name = [...(this.state.goldenCommandUsers||[]), ...(this.state.corporateStaffUsers||[])].find(u => u.id === empId)?.name || empId;
                const deptLabel = pfx==='gc' ? 'Golden Command' : pfx==='cs' ? 'Corporate Staff' : pfx==='l456inm' ? 'L456 INM' : pfx==='l3inm' ? 'L3 INM' : pfx==='l3tsm' ? 'L3 TSM' : pfx==='hseq' ? 'HSEQ' : pfx;
                if (!confirm(`Clear all On-Call dates for "${name}" in ${deptLabel}?\n\nThis only removes their schedule for this department.`)) return;
                delete this.state.onCallDates[ocKey];
                this.saveOnCallDatesToSupabase();
                this.renderManageOnCallView();
            };
            app._ocSelectStaff = function(val, pfx) {
                const idEl = document.getElementById('newOcId-' + pfx);
                if (idEl) idEl.value = val;
                const preview = document.getElementById('ocSelectedPreview-' + pfx);
                if (!preview) return;
                if (!val) { preview.innerHTML = ''; return; }
                const ocKey = (pfx === 'gc' || pfx === 'cs') ? val : pfx + '::' + val;
                const dates = (this.state.onCallDates[ocKey] || []).slice().sort();
                if (!dates.length) {
                    preview.innerHTML = '<p class="text-sm text-gray-400 italic mb-2">No On-Call dates assigned yet.</p>';
                    return;
                }
                const grouped = {};
                dates.forEach(d => {
                    const dt = new Date(d + 'T00:00:00');
                    const ws = new Date(dt); ws.setDate(dt.getDate() - dt.getDay());
                    const k = ws.getFullYear() + '-' + String(ws.getMonth()+1).padStart(2,'0') + '-' + String(ws.getDate()).padStart(2,'0');
                    if (!grouped[k]) grouped[k] = [];
                    grouped[k].push(d);
                });
                const getWN = ds => {
                    const dt2 = new Date(ds + 'T00:00:00');
                    const j1 = new Date(dt2.getFullYear(), 0, 1);
                    const w1s = new Date(j1); w1s.setDate(j1.getDate() - j1.getDay());
                    return Math.min(52, Math.floor((dt2 - w1s) / (7*24*60*60*1000)) + 1);
                };
                const rows = Object.entries(grouped).map(([, wDates]) => {
                    const wNum = getWN(wDates[0]);
                    const lbl = wDates.length >= 7
                        ? 'Week ' + wNum + ' (' + wDates[0] + ' to ' + wDates[wDates.length-1] + ')'
                        : 'Week ' + wNum + ' - ' + wDates.join(', ');
                    const btn = document.createElement('button');
                    btn.className = 'text-xs text-red-500 hover:text-red-700 underline whitespace-nowrap ml-2';
                    btn.textContent = '🗑 Delete';
                    btn.onclick = () => {
                        this.deleteOnCallBlock(ocKey, wDates[0], wDates[wDates.length-1]);
                        setTimeout(() => this._ocSelectStaff(val, pfx), 150);
                    };
                    const chip = document.createElement('span');
                    chip.className = 'inline-block bg-blue-50 border border-blue-300 text-blue-800 text-xs font-semibold px-2 py-1 rounded whitespace-nowrap';
                    chip.textContent = lbl;
                    const row = document.createElement('div');
                    row.className = 'flex items-center gap-2 flex-wrap mb-1';
                    row.appendChild(chip); row.appendChild(btn);
                    return row;
                });
                preview.innerHTML = '';
                rows.forEach(r => preview.appendChild(r));
            };
            app._ocSearchFilter = function(q, pfx) {
                const sel = document.getElementById('newOcSelect-' + pfx);
                if (!sel) return;
                for (let i = 1; i < sel.options.length; i++) {
                    const txt = sel.options[i].text.toLowerCase();
                    sel.options[i].style.display = (!q || txt.includes(q.toLowerCase())) ? '' : 'none';
                }
            };
            app._ocSetMode = function(pfx, mode) {
                ['date','week','multi'].forEach(m => {
                    const fields = document.getElementById('newOc' + m.charAt(0).toUpperCase() + m.slice(1) + 'Fields-' + pfx);
                    if (fields) fields.classList.toggle('hidden', m !== mode);
                });
                document.getElementById('newOcMode-' + pfx).value = mode;
                const isGC = pfx === 'gc';
                const activeClass = isGC ? 'bg-yellow-500' : 'bg-blue-600';
                ['Date','Week','Multi'].forEach(m => {
                    const btn = document.getElementById('newOc' + m + 'Btn-' + pfx);
                    if (!btn) return;
                    const isActive = m.toLowerCase() === mode || (m === 'Multi' && mode === 'multi');
                    btn.classList.toggle(activeClass, isActive);
                    btn.classList.toggle('text-white', isActive);
                    btn.classList.toggle('bg-white', !isActive);
                    btn.classList.toggle('text-gray-700', !isActive);
                });
            };
            app._ocWeekPreview = function(pfx) {
                const w = parseInt(document.getElementById('newOcWeekNum-' + pfx)?.value);
                const y = parseInt(document.getElementById('newOcWeekYear-' + pfx)?.value) || this.state.biddingYearCorp;
                const el = document.getElementById('newOcWeekPreview-' + pfx);
                if (!el) return;
                if (w >= 1 && w <= 52) {
                    const r = this.weekNumberToDateRange(w, y);
                    el.textContent = '→ ' + r.from + ' to ' + r.to;
                } else {
                    el.textContent = '';
                }
            };
            app._applyOnCallRange = function(empId, from, to, isNew = false) {
                if (!from || !to) { alert('Please select both a start and end date.'); return; }
                if (from > to)    { alert('Start date must be on or before end date.'); return; }

                if (!this.state.onCallDates) this.state.onCallDates = {};
                if (!this.state.onCallDates[empId]) this.state.onCallDates[empId] = [];

                const existing = new Set(this.state.onCallDates[empId]);
                const cur = new Date(from + 'T00:00:00');
                const end = new Date(to   + 'T00:00:00');
                let added = 0;
                while (cur <= end) {
                    const iso = cur.getFullYear() + '-' + String(cur.getMonth()+1).padStart(2,'0') + '-' + String(cur.getDate()).padStart(2,'0');
                    if (!existing.has(iso)) { existing.add(iso); added++; }
                    cur.setDate(cur.getDate() + 1);
                }
                this.state.onCallDates[empId] = [...existing].sort();
                this.saveOnCallDatesToSupabase();
                this.writeAuditLog('MANUAL_OVERRIDE', { action: 'on_call_add', empId, from, to, added });
                alert(`✅ Added ${added} date${added !== 1 ? 's' : ''} to On-Call schedule for ${empId}.`);
                this.renderManageOnCallView();
            };
            app.deleteOnCallBlock = function(empId, blockFrom, blockTo) {
                if (!confirm(`Remove all On-Call dates from ${blockFrom} to ${blockTo} for ${empId}?`)) return;
                if (!this.state.onCallDates?.[empId]) return;

                const dateFrom = new Date(blockFrom + 'T00:00:00');
                const dateTo   = new Date(blockTo   + 'T00:00:00');
                const toDelete = new Set();
                const cur = new Date(dateFrom);
                while (cur <= dateTo) {
                    toDelete.add(cur.getFullYear() + '-' + String(cur.getMonth()+1).padStart(2,'0') + '-' + String(cur.getDate()).padStart(2,'0'));
                    cur.setDate(cur.getDate() + 1);
                }

                const before = this.state.onCallDates[empId].length;
                this.state.onCallDates[empId] = this.state.onCallDates[empId].filter(d => !toDelete.has(d));
                const removed = before - this.state.onCallDates[empId].length;

                // Update Supabase by re-saving the full state (delete + re-insert approach)
                this.saveOnCallDatesToSupabase();
                this.writeAuditLog('MANUAL_OVERRIDE', { action: 'on_call_delete', empId, blockFrom, blockTo, removed });
                alert(`🗑 Removed ${removed} date${removed !== 1 ? 's' : ''} from On-Call schedule.`);
                this.renderManageOnCallView();
            };
