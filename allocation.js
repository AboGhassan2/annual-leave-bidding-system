// ════════════════════════════════════════════════════════════════════
// core/allocation.js — the seniority-based leave slot allocation engine.
//
// This is the highest-stakes file in the whole app: it decides who gets
// which leave slot and why. Everything here attaches onto the shared
// `app` object (same pattern as utils.js), so it must load AFTER
// app.js. Every existing call site (this.computeBidAllocation(...),
// this.processBids(), this.processMaintBids(), and the Justification
// Report's calls into these) keeps working unchanged.
//
// computeBidAllocation() is the SINGLE source of truth for allocation —
// both processBids() (writes results) and previewAllocation() (the
// read-only preview, still in app.js for now) call this exact function,
// so the preview can never drift out of sync with what actually runs
// for real.
//
// Note: computeBidAllocation() still calls the browser's native
// confirm() once, to warn about departments with no configured slots.
// That's the one place this file isn't pure/DOM-free — worth knowing
// if this ever gets a Node-based regression test, since that one path
// would need to be mocked or skipped via opts.skipUnconfiguredConfirm.
// ════════════════════════════════════════════════════════════════════

            // ==================== OTHER FUNCTIONS ====================
            // ────────────────────────────────────────────────────────────────────────
            // computeBidAllocation() — the SINGLE source of truth for seniority-based
            // slot allocation. Both processBids() (writes results) and
            // previewAllocation() (read-only report) call this exact function, so the
            // preview can never drift out of sync with what actually runs for real.
            //
            // opts.skipUnconfiguredConfirm — when true, skips the blocking confirm()
            // dialog about departments with no configured slots (used by Preview,
            // which is read-only and should never require a decision). The
            // unconfigured departments are still returned in `unconfiguredDepts` so
            // the caller can display a warning.
            //
            // Returns { cancelled: true } if the user cancels the confirm dialog,
            // otherwise { cancelled: false, sortedEmployees, positionGroups,
            // sortedGroupKeys, deptRankMap, slotAssignments, unconfiguredDepts, stats }
            // ────────────────────────────────────────────────────────────────────────
            // ── SHARED: groups an employee/staff member's bids into "choice units" ────
            // for the consecutive-leave-period enhancement. There is no explicit field
            // in the bid data marking two bids as "one linked choice" — a pair is
            // inferred PURELY from the dates being exactly back-to-back (one bid's end
            // date is the calendar day immediately before the other's start date).
            // Bids that don't pair with anything remain standalone "single" units.
            // Original preference order (by submission timestamp) is preserved: a
            // pair unit takes the position of its earlier-submitted half.
            //
            // This only affects Phase 1 (see below, in both engines) — Phase 2 (the
            // pre-existing single-slot matching loop) still considers every individual
            // bid regardless of pairing, unchanged from before this feature existed.
            // An employee whose bids never pair with anything produces zero pair
            // units here, so Phase 1 becomes a complete no-op for them and behavior
            // is identical to before this feature was added.
            app._groupBidsIntoChoiceUnits = function(bids) {
                const isNextDay = (endDate, startDate) => {
                    const diffDays = Math.round((new Date(startDate) - new Date(endDate)) / 86400000);
                    return diffDays === 1;
                };
                const used = new Set();
                const units = [];
                for (let i = 0; i < bids.length; i++) {
                    if (used.has(i)) continue;
                    let pairedWith = -1;
                    for (let j = i + 1; j < bids.length; j++) {
                        if (used.has(j)) continue;
                        if (isNextDay(bids[i].endDate, bids[j].startDate) || isNextDay(bids[j].endDate, bids[i].startDate)) {
                            pairedWith = j;
                            break;
                        }
                    }
                    if (pairedWith >= 0) {
                        used.add(i); used.add(pairedWith);
                        const pairBids = [bids[i], bids[pairedWith]].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
                        units.push({ type: 'pair', bids: pairBids });
                    } else {
                        used.add(i);
                        units.push({ type: 'single', bids: [bids[i]] });
                    }
                }
                return units;
            };


            app.computeBidAllocation = function(opts = {}) {
                const { skipUnconfiguredConfirm = false } = opts;

                // Calculate entitlement for each employee
                const calculateYearsOfService = (seniorityDate) => {
                    const today = new Date();
                    const joinDate = new Date(seniorityDate);
                    return (today - joinDate) / (1000 * 60 * 60 * 24 * 365.25);
                };
                
                const getEmployeeEntitlement = (employee) => {
                    if (!employee || !employee.seniorityDate) return 30;
                    const yearsOfService = calculateYearsOfService(employee.seniorityDate);
                    return yearsOfService >= 5 ? 35 : 30;
                };
                
                // Track slot availability per month per department
                const slotAvailability = {};
                const slotAssignments = [];

                // Build a lookup: slotDates[dept][month][slotId] = { start, end }
                // so assignSlotToEmployee can use the real configured dates
                const slotDates = {};

                // Initialize slot availability from capacities.
                // Key format: cal-{dept}-{month}-{slotId}-{field}
                // e.g. cal-L3-DEP-DC-January-SA-capacity  (dept may contain dashes!)
                //
                // IMPORTANT: We do a TWO-PASS approach so the "enabled" flag is always
                // evaluated before we write anything into slotAvailability.
                // Disabled slots are NEVER loaded — they cannot be auto-assigned.
                const months = this.state.months; // ['January','February',...]

                // Helper to parse any "cal-..." key into its components
                const parseCalKey = (key) => {
                    if (!key.startsWith('cal-')) return null;
                    const withoutPrefix = key.slice(4);
                    const lastDash = withoutPrefix.lastIndexOf('-');
                    const field = withoutPrefix.slice(lastDash + 1);
                    const withoutField = withoutPrefix.slice(0, lastDash);
                    const slotIdDash = withoutField.lastIndexOf('-');
                    const slotId = withoutField.slice(slotIdDash + 1);
                    const withoutSlot = withoutField.slice(0, slotIdDash);
                    const monthDash = withoutSlot.lastIndexOf('-');
                    const month = withoutSlot.slice(monthDash + 1);
                    const dept = withoutSlot.slice(0, monthDash);
                    if (!months.includes(month)) return null;
                    const slotLetter = slotId === 'SA' ? 'A' : slotId === 'SB' ? 'B' : slotId === 'SC' ? 'C' : slotId === 'SD' ? 'D' : null;
                    if (!slotLetter) return null;
                    return { dept, month, slotLetter, field };
                };

                // Pass 1 — collect every field for every slot bucket
                const rawSlotData = {}; // "dept||month||slotLetter" → { dept, month, slotLetter, enabled, capacity, start, end }
                Object.keys(this.state.slotCapacities).forEach(key => {
                    const parsed = parseCalKey(key);
                    if (!parsed) return;
                    const { dept, month, slotLetter, field } = parsed;
                    const bucketKey = `${dept}||${month}||${slotLetter}`;
                    if (!rawSlotData[bucketKey]) {
                        rawSlotData[bucketKey] = { dept, month, slotLetter, enabled: true, capacity: 0, start: null, end: null };
                    }
                    const value = this.state.slotCapacities[key];
                    if (field === 'enabled')   rawSlotData[bucketKey].enabled  = (value === true || value === 'true');
                    else if (field === 'capacity') rawSlotData[bucketKey].capacity = parseInt(value) || 0;
                    else if (field === 'start')    rawSlotData[bucketKey].start    = value;
                    else if (field === 'end')      rawSlotData[bucketKey].end      = value;
                });

                // Pass 2 — only load ENABLED slots that have both start and end dates configured
                Object.values(rawSlotData).forEach(({ dept, month, slotLetter, enabled, capacity, start, end }) => {
                    if (!enabled)        return; // planner disabled this slot — skip entirely
                    if (!start || !end)  return; // dates not configured — skip

                    if (!slotAvailability[month]) slotAvailability[month] = {};
                    if (!slotAvailability[month][dept]) slotAvailability[month][dept] = { A: 0, B: 0, C: 0, D: 0 };
                    slotAvailability[month][dept][slotLetter] = capacity;

                    if (!slotDates[dept]) slotDates[dept] = {};
                    if (!slotDates[dept][month]) slotDates[dept][month] = {};
                    if (!slotDates[dept][month][slotLetter]) slotDates[dept][month][slotLetter] = {};
                    slotDates[dept][month][slotLetter].start = start;
                    slotDates[dept][month][slotLetter].end   = end;
                });
                
                // Build a dept resolver: maps an employee's department value to the
                // best-matching key in slotAvailability (handles cases where the Excel
                // 'Department' column has a display name like 'Depot Controller' instead
                // of the L-code 'L3-DEP-DC' that was used when configuring slots).
                // MUST be defined before assignSlotToEmployee which calls it.
                const configuredDeptKeys = new Set(
                    Object.values(slotAvailability).flatMap(monthObj => Object.keys(monthObj || {}))
                );
                const deptResolveCache = {};
                const resolveEmployeeDept = (empDept) => {
                    if (deptResolveCache[empDept] !== undefined) return deptResolveCache[empDept];
                    if (configuredDeptKeys.has(empDept)) {
                        deptResolveCache[empDept] = empDept;
                        return empDept;
                    }
                    for (const key of configuredDeptKeys) {
                        if (key.toLowerCase() === empDept.toLowerCase()) {
                            deptResolveCache[empDept] = key;
                            return key;
                        }
                    }
                    deptResolveCache[empDept] = empDept;
                    return empDept;
                };

                // Helper function to assign slot to employee using real configured dates.
                // Requires resolveEmployeeDept (defined above).
                const assignSlotToEmployee = (employee, month, slotType, slotNumber) => {
                    const slot = this.state.slotTypes.find(s => s.id === `slot${slotType}`);
                    // Use resolved dept so slotDates lookup matches the configured key
                    const dept = resolveEmployeeDept(employee.department || 'Unassigned');
                    const year = this.state.biddingYear;

                    // Use real configured dates — these are REQUIRED (disabled/unconfigured slots
                    // are never put into slotAvailability, so we should always find dates here)
                    const configuredDates = slotDates[dept]?.[month]?.[slotType];
                    let startDateStr, endDateStr;

                    if (configuredDates?.start && configuredDates?.end) {
                        startDateStr = configuredDates.start;
                        endDateStr   = configuredDates.end;
                    } else {
                        // Should not happen for properly configured slots, but keep a safe fallback
                        const monthIndex = this.state.months.indexOf(month);
                        const startDate = new Date(year, monthIndex, 1);
                        const endDate   = new Date(startDate);
                        endDate.setDate(endDate.getDate() + (slot ? slot.days : 15) - 1);
                        startDateStr = startDate.toISOString().split('T')[0];
                        endDateStr   = endDate.toISOString().split('T')[0];
                    }

                    // Always compute days from actual configured dates
                    const days = Math.ceil((new Date(endDateStr) - new Date(startDateStr)) / (1000 * 60 * 60 * 24)) + 1;

                    return {
                        employeeId: employee.id,
                        employeeName: employee.name,
                        position: employee.position || '',
                        department: dept,
                        slotName: `${slot ? slot.name : slotType}`,
                        slotType: `slot${slotType}`,
                        slotNumber: slotNumber || 1,
                        startDate: startDateStr,
                        endDate: endDateStr,
                        days: days,
                        month: month,
                        year: year,
                        seniorityDate: employee.seniorityDate,
                        yearsOfService: calculateYearsOfService(employee.seniorityDate).toFixed(1)
                    };
                };

                // ── PER-DEPARTMENT SENIORITY ──
                // Group employees by their resolved department, sort each group by seniority,
                // then interleave: rank-1 of every dept goes first, then rank-2, etc.
                // This ensures L3-SAMB #1 and L3-DEP-DC #1 both get priority before anyone's #2.

                // First resolve all departments
                const empWithDept = this.state.employees.map(e => ({
                    ...e,
                    resolvedDept: resolveEmployeeDept(e.department || 'Unassigned')
                }));

                // ── GROUP BY POSITION (SCHEDULING ROW) + DEPARTMENT ──
                // Seniority bidding is run SEPARATELY for each unique
                // position+department combination (i.e. each "scheduling row").
                // Employees in "L5 SA" at dept X compete only among themselves;
                // they do NOT compete with employees in "L5 SA" at dept Y, nor
                // with any other position in their own department.
                const positionGroups = {};
                empWithDept.forEach(e => {
                    // Key = position (scheduling row) + resolved department
                    const pos = (e.position || 'Unassigned').trim();
                    const groupKey = `${pos}||${e.resolvedDept}`;
                    if (!positionGroups[groupKey]) positionGroups[groupKey] = [];
                    positionGroups[groupKey].push(e);
                });

                // Sort each position+department group by seniority (oldest first = most senior)
                Object.keys(positionGroups).forEach(groupKey => {
                    positionGroups[groupKey].sort((a, b) => new Date(a.seniorityDate) - new Date(b.seniorityDate));
                });

                // Build sequential processing order:
                // All employees in position-group A are fully processed before position-group B.
                // Within each group employees are ordered oldest seniority date first.
                const sortedGroupKeys = Object.keys(positionGroups).sort();
                const sortedEmployees = [];
                const deptRankMap = {}; // employeeId → { dept, deptRank }

                sortedGroupKeys.forEach(groupKey => {
                    positionGroups[groupKey].forEach((emp, rankIdx) => {
                        sortedEmployees.push(emp);
                        // deptRank here is the rank within their position+dept group
                        deptRankMap[emp.id] = { dept: emp.resolvedDept, deptRank: rankIdx + 1 };
                    });
                });

                // Warn if any employee departments have no configured slots
                const configuredDepts = new Set(Object.keys(slotAvailability).flatMap(month => Object.keys(slotAvailability[month] || {})));
                const employeeDeptSet = new Set(sortedEmployees.map(e => resolveEmployeeDept(e.department || 'Unassigned')));
                const unconfiguredDepts = [...employeeDeptSet].filter(d => !configuredDepts.has(d));
                if (unconfiguredDepts.length > 0 && !skipUnconfiguredConfirm) {
                    const proceed = confirm(
                        `⚠️ WARNING: The following employee departments have NO slot capacity configured:\n\n` +
                        unconfiguredDepts.map(d => `• ${d}`).join('\n') +
                        `\n\nEmployees in these departments will be auto-assigned using available slots from other configured departments.\n\n` +
                        `It is strongly recommended to Cancel and configure slots for these departments first.\n\nContinue anyway?`
                    );
                    if (!proceed) return { cancelled: true };
                }

                // ═══════════════════════════════════════════════════════════════════
                // BID PROCESSING — CONFLICT-RESOLUTION MODEL
                //
                // The old sequential model decremented capacity as it processed each
                // employee one by one, which meant Employee #2 would find the slot
                // already "gone" even if capacity = 1.  The correct model is:
                //
                //  ROUND 1  — Collect every employee's 1st-choice bid.
                //             Slot key = dept + month + slotType.
                //             If only 1 employee wants a slot → award it.
                //             If multiple employees want the same slot:
                //               • Capacity ≥ number of requesters  → everyone gets it.
                //               • Capacity < number of requesters  → most senior fills up
                //                 to capacity; the rest are marked "unresolved" and their
                //                 1st-choice bid is released back so it no longer blocks
                //                 them from their 2nd-choice in Round 2.
                //
                //  ROUND 2  — For every employee still missing a slot, try their 2nd-
                //             choice bid against the REMAINING capacity (already reduced
                //             by Round 1 awards).  Same conflict resolution applies.
                //
                //  ROUND 3  — Auto-assign: employees who still have < 2 slots get the
                //             next available slot in their dept (any month, any type)
                //             that doesn't duplicate their existing slot or exceed their
                //             entitlement.
                //
                // Within each conflict group seniority rank (oldest date = rank #1) is
                // used to break ties — most senior wins.
                // ═══════════════════════════════════════════════════════════════════

                // awarded[employeeId] = array of assignment objects (max 2)
                const awarded = {};
                sortedEmployees.forEach(e => { awarded[e.id] = []; });

                // Helper: build assignment object from a bid + resolved dates
                const makeBidAssignment = (employee, bid, slotNumber) => {
                    const slotType = bid.slotType.charAt(bid.slotType.length - 1);
                    const bidDept  = resolveEmployeeDept(bid.department || resolveEmployeeDept(employee.department || 'Unassigned'));
                    // Prefer the month captured at bid-submission time (tied directly to the
                    // configured slot the employee actually selected). Only fall back to
                    // deriving it from startDate for legacy bids that never stored .month
                    // (e.g. Golden Command / Corporate Staff free-date bids).
                    const month    = bid.month || this.state.months[new Date(bid.startDate).getMonth()];
                    const slotObj  = this.state.slotTypes.find(s => s.id === `slot${slotType}`);
                    const configuredDates = slotDates[bidDept]?.[month]?.[slotType];

                    // Honor what the employee actually bid on. Winning a slot is decided by
                    // dept + block + slot-type + seniority (the per-employee allocation loop,
                    // below, which processes employees senior-first) — but the
                    // AWARDED DATES should be the dates the employee actually saw and chose at
                    // bid time, not whatever the slot happens to be configured as by the time
                    // bids are processed. Only fall back to the live configured dates when the
                    // bid itself never stored its own dates (legacy bids).
                    const startDate = bid.startDate || configuredDates?.start;
                    const endDate   = bid.endDate   || configuredDates?.end;
                    const days = Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000) + 1;

                    // Still flag when the slot's currently-configured dates have since moved
                    // away from what was awarded — this doesn't change the outcome anymore
                    // (the employee's original dates win), but it's a sign the master schedule
                    // and this employee's honored dates are now out of sync and may need
                    // reconciling (e.g. capacity/roster planning for the new config dates).
                    const datesDrifted = !!(configuredDates &&
                        (configuredDates.start !== startDate || configuredDates.end !== endDate));

                    return {
                        employeeId:     employee.id,
                        employeeName:   employee.name,
                        position:       employee.position || '',
                        department:     bidDept,
                        slotName:       slotObj ? slotObj.name : `Slot ${slotType}`,
                        slotType:       `slot${slotType}`,
                        slotNumber,
                        startDate,
                        endDate,
                        days,
                        month,
                        year:           this.state.biddingYear,
                        seniorityDate:  employee.seniorityDate,
                        yearsOfService: calculateYearsOfService(employee.seniorityDate).toFixed(1),
                        type:           'Bid Awarded',
                        bidChoice:      slotNumber,
                        datesDrifted,
                        currentConfiguredStartDate: configuredDates?.start || null,
                        currentConfiguredEndDate:   configuredDates?.end   || null
                    };
                };

                // Helper: resolve conflicts for a batch of (employee, bid) pairs against
                // the live slotAvailability map.  Returns { won: [...], lost: [...] }
                // where lost employees didn't fit within remaining capacity.
                // NOTE: conflict resolution is now implicit — employees are processed one at
                // a time in strict seniority order (see the allocation loop below), and
                // capacity is checked/decremented directly against `slotAvailability` as each
                // employee's bids are tried. There's no separate "resolve simultaneous
                // candidates" step because there's never more than one candidate for a given
                // slot at the moment it's being decided.

                // Cache sorted bids per employee once, in the order they were submitted
                // (i.e. 1st choice, 2nd choice, 3rd choice...).
                const sortedBidsById = {};
                sortedEmployees.forEach(emp => {
                    sortedBidsById[emp.id] = [...this.state.bids.filter(b => b.employeeId === emp.id)]
                        .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
                });

                // ── DIAGNOSTIC: detect config drift since bids were placed ───────────────
                // Winning a slot is decided by dept + block + slot-type + seniority — never
                // by the exact date range on the bid. The AWARDED DATES, however, are now
                // always the employee's own original bid dates (see makeBidAssignment), so a
                // config change after the fact no longer overrides what the employee agreed
                // to. Two things are still surfaced here:
                //   • 'removed'       — the slot is no longer configured at all; the bid can
                //                       no longer be honored and falls through to the next
                //                       preference / auto-assign instead.
                //   • 'dates_changed' — the slot is still configured, but its dates have since
                //                       moved away from what the employee originally bid on.
                //                       The employee still gets their original dates — this is
                //                       purely a heads-up that the master "Configure Slots"
                //                       schedule and this employee's honored leave dates are
                //                       now out of sync, in case that needs reconciling
                //                       (e.g. rosters/capacity planned around the new dates).
                const driftedBids = [];
                sortedEmployees.forEach(employee => {
                    (sortedBidsById[employee.id] || []).forEach(bid => {
                        const slotType = bid.slotType.charAt(bid.slotType.length - 1);
                        const bidDept  = resolveEmployeeDept(bid.department || resolveEmployeeDept(employee.department || 'Unassigned'));
                        const month    = bid.month || this.state.months[new Date(bid.startDate).getMonth()];
                        const configured = slotDates[bidDept]?.[month]?.[slotType];
                        if (!configured) {
                            driftedBids.push({ employee, bid, reason: 'removed', configured: null });
                        } else if (bid.startDate && bid.endDate &&
                                   (bid.startDate !== configured.start || bid.endDate !== configured.end)) {
                            driftedBids.push({ employee, bid, reason: 'dates_changed', configured });
                        }
                    });
                });
                if (driftedBids.length > 0) {
                    const removed = driftedBids.filter(d => d.reason === 'removed');
                    const datesChanged = driftedBids.filter(d => d.reason === 'dates_changed');
                    if (removed.length > 0) {
                        console.log(`ℹ️ ${removed.length} bid(s) reference a slot that's since been removed/disabled — will fall through to next preference / auto-assign:`,
                            removed.map(d => ({
                                employee: d.employee.name, id: d.employee.id,
                                bidSlot: `${d.bid.slotType} ${d.bid.month || ''} ${d.bid.startDate}→${d.bid.endDate}`
                            }))
                        );
                    }
                    if (datesChanged.length > 0) {
                        console.warn(`ℹ️ ${datesChanged.length} bid(s) will be honored using the employee's original bid dates, which no longer match the slot's current "Configure Slots" dates — schedule may need reconciling:`,
                            datesChanged.map(d => ({
                                employee: d.employee.name, id: d.employee.id,
                                honoredAs: `${d.bid.slotType} ${d.bid.month || ''} ${d.bid.startDate}→${d.bid.endDate}`,
                                currentlyConfiguredAs: `${d.configured.start}→${d.configured.end}`
                            }))
                        );
                    }
                }

                // ── PREFERENCE ALLOCATION (strict seniority order) ────────────────────────
                // Employees are processed ONE AT A TIME in seniority order — this is already
                // the order of `sortedEmployees` (each dept group sorted senior-first by
                // seniorityDate, then dept groups processed in sequence). For each employee,
                // their own bids are tried in the order they were submitted (1st choice, 2nd
                // choice, 3rd choice...), and the FIRST one that still has capacity is awarded
                // immediately, decrementing capacity right away before moving to the next
                // employee.
                //
                // This replaces the old "round-based" approach, which processed all 1st
                // choices together, then all 2nd choices together, etc. That let a JUNIOR
                // employee's 1st choice claim a slot in round 1 before a SENIOR employee's
                // 2nd or 3rd choice for that same slot was even considered in round 2/3 —
                // silently violating seniority. Processing employee-by-employee (senior
                // first) instead guarantees a senior employee's entire preference list is
                // exhausted, in order, before any junior employee gets a shot at the same
                // capacity.
                sortedEmployees.forEach(employee => {
                    const bids        = sortedBidsById[employee.id];
                    const entitlement = getEmployeeEntitlement(employee);

                    // ── PHASE 1: consecutive leave period preference ────────────────────
                    // Tries each of the employee's consecutive-pair choices (inferred by
                    // date adjacency — see _groupBidsIntoChoiceUnits above), in the order
                    // they were submitted, as an ATOMIC all-or-nothing unit: both slots
                    // must have capacity or neither is awarded. If a pair choice is
                    // blocked, we move to the employee's NEXT pair choice rather than
                    // settling for half of this one — an award is never partially
                    // committed here. An employee with no pair choices at all produces
                    // zero pair units, so this phase is a complete no-op for them and
                    // behavior is unchanged from before this feature existed.
                    const choiceUnits = this._groupBidsIntoChoiceUnits(bids);
                    for (const unit of choiceUnits) {
                        if (unit.type !== 'pair') continue;
                        if (awarded[employee.id].length > 0) break; // already fully handled by an earlier pair choice

                        const checks = unit.bids.map(bid => {
                            const slotType = bid.slotType.charAt(bid.slotType.length - 1);
                            const bidDept  = resolveEmployeeDept(bid.department || resolveEmployeeDept(employee.department || 'Unassigned'));
                            const month    = bid.month || this.state.months[new Date(bid.startDate).getMonth()];
                            const cap      = slotAvailability[month]?.[bidDept]?.[slotType] ?? 0;
                            return { bid, slotType, bidDept, month, cap };
                        });

                        if (!checks.every(c => c.cap > 0)) continue; // this pair isn't fully available — try the next pair choice

                        const provisional = checks.map(c => makeBidAssignment(employee, c.bid, 1));
                        const pairDays = provisional.reduce((s, a) => s + a.days, 0);
                        if (pairDays > entitlement) continue; // together they'd exceed entitlement — try the next pair choice

                        // Both available and within entitlement — award atomically.
                        checks.forEach((c, idx) => {
                            const a = makeBidAssignment(employee, c.bid, idx + 1);
                            slotAvailability[c.month][c.bidDept][c.slotType]--;
                            awarded[employee.id].push(a);
                        });
                        break; // fully handled by this pair — done with Phase 1 for this employee
                    }

                    // ── PHASE 2: existing single-slot sequential preference matching ───
                    // Unchanged from before this feature existed. Runs for any employee
                    // Phase 1 didn't fully award (no pair choices at all, or every pair
                    // choice was blocked) — every individual bid, including a surviving
                    // half of a blocked pair, is eligible here on its own merits, exactly
                    // as it always was.
                    for (const bid of bids) {
                        if (awarded[employee.id].length >= 2) break; // fully allocated

                        const assignedDays = awarded[employee.id].reduce((s, a) => s + a.days, 0);
                        if (assignedDays >= entitlement) break; // entitlement exhausted

                        // Skip if this exact slot was already awarded to this employee
                        const alreadyHasSlot = awarded[employee.id].some(
                            a => a.startDate === bid.startDate && a.endDate === bid.endDate
                        );
                        if (alreadyHasSlot) continue;

                        const slotType = bid.slotType.charAt(bid.slotType.length - 1);
                        const bidDept  = resolveEmployeeDept(bid.department || resolveEmployeeDept(employee.department || 'Unassigned'));
                        const month    = bid.month || this.state.months[new Date(bid.startDate).getMonth()];
                        const cap      = slotAvailability[month]?.[bidDept]?.[slotType] ?? 0;

                        if (cap <= 0) continue; // no capacity left for this choice — try next preference

                        const a = makeBidAssignment(employee, bid, awarded[employee.id].length + 1);
                        if (assignedDays + a.days > entitlement) continue; // would exceed entitlement — try next preference

                        slotAvailability[month][bidDept][slotType]--;
                        awarded[employee.id].push(a);
                    }
                });

                // ── AUTO-ASSIGN: fill remaining gaps after all preference rounds ──────────
                // For each employee still needing slots, scan available capacity
                // in their dept across all months/types and assign what fits.

                sortedEmployees.forEach(employee => {
                    const entitlement  = getEmployeeEntitlement(employee);
                    const department   = resolveEmployeeDept(employee.department || 'Unassigned');
                    const assignedDays = awarded[employee.id].reduce((s, a) => s + a.days, 0);
                    const assignedDateKeys = new Set(awarded[employee.id].map(a => `${a.startDate}|${a.endDate}`));
                    let localDays = assignedDays;

                    // Seniority gate: ≤5 years → only Slot A/B eligible for auto-assignment.
                    // >5 years → only Slot C/D eligible. Mirrors the bidding-time restriction.
                    const empYearsForAssign = employee.seniorityDate
                        ? (new Date() - new Date(employee.seniorityDate)) / (1000 * 60 * 60 * 24 * 365.25)
                        : 0;
                    const eligibleSlotTypes = empYearsForAssign > 5 ? ['C', 'D'] : ['A', 'B'];

                    while (awarded[employee.id].length < 2) {
                        let slotAssigned = false;

                        for (const searchMonth of this.state.months) {
                            if (slotAssigned) break;
                            if (!slotAvailability[searchMonth]?.[department]) continue;

                            for (const slotType of eligibleSlotTypes) {
                                if (slotAvailability[searchMonth][department][slotType] <= 0) continue;

                                const potential = assignSlotToEmployee(employee, searchMonth, slotType, awarded[employee.id].length + 1);
                                const dateKey = `${potential.startDate}|${potential.endDate}`;

                                if (assignedDateKeys.has(dateKey)) continue;
                                if (localDays + potential.days > entitlement) continue;

                                potential.type      = 'Auto-Assigned';
                                potential.bidChoice = null;
                                awarded[employee.id].push(potential);
                                localDays += potential.days;
                                assignedDateKeys.add(dateKey);
                                slotAvailability[searchMonth][department][slotType]--;
                                slotAssigned = true;
                                break;
                            }
                        }

                        if (!slotAssigned) break; // no capacity left anywhere
                    }
                });

                // ── Flatten results ──
                slotAssignments.length = 0; // clear the array declared above
                sortedEmployees.forEach((employee, index) => {
                    const deptInfo = deptRankMap[employee.id] || {};
                    const entitlement = getEmployeeEntitlement(employee);
                    awarded[employee.id].forEach((assignment, slotIndex) => {
                        slotAssignments.push({
                            ...assignment,
                            seniorityRank:      deptInfo.deptRank || (index + 1),
                            deptSeniorityRank:  deptInfo.deptRank || (index + 1),
                            totalEmployeeSlots: 2,
                            slotOrder:          slotIndex + 1,
                            entitlement
                        });
                    });
                });
                // Calculate statistics
                const totalSlots = slotAssignments.length;
                const totalEmployees = sortedEmployees.length;
                const bidAwarded = slotAssignments.filter(r => r.type === 'Bid Awarded').length;
                const autoAssigned = slotAssignments.filter(r => r.type === 'Auto-Assigned').length;
                const datesDriftedCount = slotAssignments.filter(r => r.datesDrifted).length;
                const seniorEmployees = sortedEmployees.filter(e => getEmployeeEntitlement(e) === 35).length;
                const juniorEmployees = totalEmployees - seniorEmployees;

                return {
                    cancelled: false,
                    sortedEmployees,
                    positionGroups,
                    sortedGroupKeys,
                    deptRankMap,
                    slotAssignments,
                    unconfiguredDepts,
                    driftedBids,
                    stats: {
                        totalSlots, totalEmployees, bidAwarded, autoAssigned, datesDriftedCount,
                        seniorEmployees, juniorEmployees,
                        totalDays: slotAssignments.reduce((sum, r) => sum + r.days, 0)
                    }
                };
            };

            app.processBids = async function() {
                if (this.state.employees.length === 0) {
                    alert('No employees to process. Please upload data first.');
                    return;
                }

                if (Object.keys(this.state.slotCapacities).length === 0) {
                    alert('Please configure slot capacities first in "Configure Slots".');
                    this.setActiveView('configureSlots');
                    return;
                }

                const confirmed = await this.showConfirmModal('Are you sure you want to process all bids?');
                if (!confirmed) return;

                const result = this.computeBidAllocation({ skipUnconfiguredConfirm: false });
                if (!result || result.cancelled) return;

                const { slotAssignments, stats } = result;

                // Save results
                this.state.results = slotAssignments;
                this.state.isProcessed = true;
                await this.saveConfigToSupabase();

                const message = `✅ Successfully processed ${stats.totalEmployees} employees!\n\n` +
                               `• Seniority: Per-department (each dept processed independently)\n` +
                               `• Total slots assigned: ${stats.totalSlots} (${stats.totalEmployees} × 2)\n` +
                               `• Senior employees (35 days): ${stats.seniorEmployees}\n` +
                               `• Junior employees (30 days): ${stats.juniorEmployees}\n` +
                               `• Bid Awards: ${stats.bidAwarded} slots\n` +
                               `• Auto-Assigned: ${stats.autoAssigned} slots\n` +
                               `• Each employee received exactly 2 slots\n` +
                               `• Total leave days allocated: ${stats.totalDays}` +
                               (stats.datesDriftedCount > 0
                                   ? `\n\nℹ️ ${stats.datesDriftedCount} slot(s) were awarded using the employee's original bid dates, which no longer match what's currently configured in "Configure Slots" for that block. The employee's original dates were honored. Check the console for the full list, and verify the master schedule/rosters are aligned for those dates.`
                                   : '');

                alert(message);

                this.renderAdminView();
            };

            // computeMaintBidAllocation() — the SINGLE source of truth for Maintenance
            // seniority-based slot allocation, mirroring computeBidAllocation()'s role for
            // Ops. Both processMaintBids() (writes results) and previewMaintAllocation()
            // (read-only preview) call this exact function, so the preview can never drift
            // out of sync with what actually runs for real. Pure calculation — no state
            // writes, no Supabase, no alerts.
            app.computeMaintBidAllocation = function(opts = {}) {
                const maintUsers = this.state.maintenanceStaffUsers || [];
                const calculateYearsOfService = (d) => (new Date() - new Date(d)) / (1000 * 60 * 60 * 24 * 365.25);
                const months = this.state.months;
                const maintCaps = this.state.maintSlotCapacities || {};

                // Parse cal-maint-{position}-{month}-{SA|SB|SC}-{field} keys
                const rawSlotData = {};
                Object.keys(maintCaps).forEach(key => {
                    if (!key.startsWith('cal-maint-')) return;
                    const rest = key.slice('cal-maint-'.length);
                    const parts = rest.split('-');
                    // field is last, slotId second-to-last, month is one of the known months
                    const field = parts.pop();
                    const slotId = parts.pop();
                    if (!['SA','SB','SC'].includes(slotId)) return;
                    // remaining parts: position tokens + month
                    const monthIdx = parts.lastIndexOf(parts.find(p => months.includes(p)));
                    // find month from right
                    let monthFound = null, monthPos = -1;
                    for (let i = parts.length - 1; i >= 0; i--) {
                        if (months.includes(parts[i])) { monthFound = parts[i]; monthPos = i; break; }
                    }
                    if (!monthFound) return;
                    const position = parts.slice(0, monthPos).join('-');
                    const slotLetter = slotId === 'SA' ? 'A' : slotId === 'SB' ? 'B' : 'C';
                    const bk = position + '||' + monthFound + '||' + slotLetter;
                    if (!rawSlotData[bk]) rawSlotData[bk] = { position, month: monthFound, slotLetter, enabled: true, capacity: 0, start: null, end: null };
                    const v = maintCaps[key];
                    if (field === 'enabled')   rawSlotData[bk].enabled   = (v === true || v === 'true');
                    else if (field === 'capacity') rawSlotData[bk].capacity = parseInt(v) || 0;
                    else if (field === 'start')    rawSlotData[bk].start    = v;
                    else if (field === 'end')      rawSlotData[bk].end      = v;
                });

                const slotAvailability = {}, slotDates = {};
                Object.values(rawSlotData).forEach(({ position, month, slotLetter, enabled, capacity, start, end }) => {
                    if (!enabled || !start || !end) return;
                    if (!slotAvailability[month]) slotAvailability[month] = {};
                    if (!slotAvailability[month][position]) slotAvailability[month][position] = { A: 0, B: 0, C: 0 };
                    slotAvailability[month][position][slotLetter] = capacity;
                    if (!slotDates[position]) slotDates[position] = {};
                    if (!slotDates[position][month]) slotDates[position][month] = {};
                    slotDates[position][month][slotLetter] = { start, end };
                });

                const configuredPositions = new Set(Object.values(slotAvailability).flatMap(m => Object.keys(m)));
                const posCache = {};
                const resolvePos = (pos) => {
                    if (posCache[pos] !== undefined) return posCache[pos];
                    if (configuredPositions.has(pos)) return (posCache[pos] = pos);
                    for (const k of configuredPositions) {
                        if (k.toLowerCase() === pos.toLowerCase()) return (posCache[pos] = k);
                    }
                    return (posCache[pos] = pos);
                };

                const positionGroups = {};
                maintUsers.forEach(u => {
                    const pos = resolvePos(u.position || 'Unassigned');
                    if (!positionGroups[pos]) positionGroups[pos] = [];
                    positionGroups[pos].push({ ...u, resolvedPosition: pos });
                });
                Object.keys(positionGroups).forEach(pos => {
                    positionGroups[pos].sort((a, b) => new Date(a.seniorityDate) - new Date(b.seniorityDate));
                });

                const posRankMap = {};
                const sortedMaintUsers = [];
                Object.keys(positionGroups).sort().forEach(pos => {
                    positionGroups[pos].forEach((u, i) => {
                        sortedMaintUsers.push(u);
                        posRankMap[u.id] = { position: pos, posRank: i + 1 };
                    });
                });

                const awarded = {};
                sortedMaintUsers.forEach(u => { awarded[u.id] = []; });

                const makeAssignment = (user, startDate, endDate, slotLetter, slotNumber, type, preferredMonth = null) => {
                    const days = Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
                    // Prefer the month captured at bid-submission time (the month label the
                    // employee actually saw and selected) over deriving it from the raw
                    // date — a slot's real dates can drift into the next calendar month
                    // while still being configured/labeled under the earlier block, so
                    // date-derivation alone can silently look up the wrong month's
                    // capacity. Mirrors the same safeguard Ops's engine already has.
                    // Auto-assign calls (no originating bid) omit this and keep the
                    // date-derived month, which is correct there since it's picking from
                    // whatever real slot config it found, not matching against a bid.
                    const month = preferredMonth || months[new Date(startDate).getMonth()];
                    return {
                        employeeId: user.id, employeeName: user.name,
                        position: user.position || '', department: user.department || '',
                        slotType: 'slot' + slotLetter, slotName: 'Slot ' + slotLetter,
                        slotNumber, startDate, endDate, days, month,
                        year: this.state.biddingYear,
                        seniorityDate: user.seniorityDate,
                        yearsOfService: calculateYearsOfService(user.seniorityDate).toFixed(1),
                        type, bidChoice: type === 'Bid Awarded' ? slotNumber : null
                    };
                };

                const sortedBidsById = {};
                sortedMaintUsers.forEach(u => {
                    sortedBidsById[u.id] = [...this.state.bids.filter(b => b.employeeId === u.id)]
                        .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
                });

                // ── DIAGNOSTIC: detect config drift since bids were placed ───────────────
                // Mirrors the same check in computeBidAllocation (Ops). Winning a slot is
                // decided by position + block + slot-type + seniority — never by the exact
                // date range on the bid. The AWARDED DATES are always the employee's own
                // original bid dates (see makeAssignment), so a config change after the fact
                // no longer overrides what the employee agreed to. Two things are still
                // surfaced here:
                //   • 'removed'       — the slot is no longer configured at all; the bid can
                //                       no longer be honored and falls through to the next
                //                       preference / auto-assign instead.
                //   • 'dates_changed' — the slot is still configured, but its dates have since
                //                       moved away from what the employee originally bid on.
                //                       The employee still gets their original dates — this is
                //                       purely a heads-up that the master "Configure Maint
                //                       Slots" schedule and this employee's honored leave
                //                       dates are now out of sync, in case that needs
                //                       reconciling (e.g. rosters/capacity planned around the
                //                       new dates).
                const driftedMaintBids = [];
                sortedMaintUsers.forEach(user => {
                    (sortedBidsById[user.id] || []).forEach(bid => {
                        const slotLetter = bid.slotType ? bid.slotType.charAt(bid.slotType.length - 1) : 'A';
                        const pos = resolvePos(user.position || 'Unassigned');
                        const month = bid.month || months[new Date(bid.startDate).getMonth()];
                        const configured = slotDates[pos]?.[month]?.[slotLetter];
                        if (!configured) {
                            driftedMaintBids.push({ user, bid, reason: 'removed', configured: null });
                        } else if (bid.startDate && bid.endDate &&
                                   (bid.startDate !== configured.start || bid.endDate !== configured.end)) {
                            driftedMaintBids.push({ user, bid, reason: 'dates_changed', configured });
                        }
                    });
                });
                if (driftedMaintBids.length > 0) {
                    const removed = driftedMaintBids.filter(d => d.reason === 'removed');
                    const datesChanged = driftedMaintBids.filter(d => d.reason === 'dates_changed');
                    if (removed.length > 0) {
                        console.log(`ℹ️ [Maintenance] ${removed.length} bid(s) reference a slot that's since been removed/disabled — will fall through to next preference / auto-assign:`,
                            removed.map(d => ({
                                employee: d.user.name, id: d.user.id,
                                bidSlot: `${d.bid.slotType} ${d.bid.month || ''} ${d.bid.startDate}→${d.bid.endDate}`
                            }))
                        );
                    }
                    if (datesChanged.length > 0) {
                        console.warn(`ℹ️ [Maintenance] ${datesChanged.length} bid(s) will be honored using the employee's original bid dates, which no longer match the slot's current "Configure Maint Slots" dates — schedule may need reconciling:`,
                            datesChanged.map(d => ({
                                employee: d.user.name, id: d.user.id,
                                honoredAs: `${d.bid.slotType} ${d.bid.month || ''} ${d.bid.startDate}→${d.bid.endDate}`,
                                currentlyConfiguredAs: `${d.configured.start}→${d.configured.end}`
                            }))
                        );
                    }
                }

                // ── PREFERENCE ALLOCATION (strict seniority order) ────────────────────────
                // Same fix as the Ops engine: process one maintenance staff member at a time,
                // most senior first (posRankMap, already position-grouped and sorted by
                // seniorityDate). For each user, try their own bids in the order submitted
                // (1st choice, 2nd choice, 3rd choice...) and award the first one that still
                // has capacity, decrementing immediately. This guarantees a senior user's
                // later-listed choice is never blocked by a junior user's earlier-round pick
                // for the same slot — the old round-based approach (all 1st choices matched
                // together, then all 2nd choices, etc.) could let that happen.
                sortedMaintUsers.forEach(user => {
                    const bids = sortedBidsById[user.id];
                    const pos  = resolvePos(user.position || 'Unassigned');

                    // ── PHASE 1: consecutive leave period preference ────────────────────
                    // Mirrors the Ops engine's Phase 1 exactly — see the detailed comment
                    // there. Tries each consecutive-pair choice as an atomic unit before
                    // falling through to Phase 2's existing single-slot matching.
                    const choiceUnits = this._groupBidsIntoChoiceUnits(bids);
                    for (const unit of choiceUnits) {
                        if (unit.type !== 'pair') continue;
                        if (awarded[user.id].length > 0) break;

                        const checks = unit.bids.map(bid => {
                            const slotLetter = bid.slotType ? bid.slotType.charAt(bid.slotType.length - 1) : 'A';
                            const month      = bid.month || months[new Date(bid.startDate).getMonth()];
                            const cap        = slotAvailability[month]?.[pos]?.[slotLetter] ?? 0;
                            return { bid, slotLetter, month, cap };
                        });

                        if (!checks.every(c => c.cap > 0)) continue;

                        const provisional = checks.map(c => makeAssignment(user, c.bid.startDate, c.bid.endDate, c.slotLetter, 1, 'Bid Awarded', c.month));
                        const pairDays = provisional.reduce((s, a) => s + a.days, 0);
                        if (pairDays > 30) continue;

                        checks.forEach((c, idx) => {
                            const a = makeAssignment(user, c.bid.startDate, c.bid.endDate, c.slotLetter, idx + 1, 'Bid Awarded', c.month);
                            slotAvailability[c.month][pos][c.slotLetter]--;
                            awarded[user.id].push(a);
                        });
                        break;
                    }

                    // ── PHASE 2: existing single-slot sequential preference matching ───
                    // Unchanged from before this feature existed.
                    for (const bid of bids) {
                        if (awarded[user.id].length >= 2) break; // fully allocated

                        const alreadyHas = awarded[user.id].some(
                            a => a.startDate === bid.startDate && a.endDate === bid.endDate
                        );
                        if (alreadyHas) continue;

                        const slotLetter = bid.slotType ? bid.slotType.charAt(bid.slotType.length - 1) : 'A';
                        const month      = bid.month || months[new Date(bid.startDate).getMonth()];
                        const cap        = slotAvailability[month]?.[pos]?.[slotLetter] ?? 0;

                        if (cap <= 0) continue; // no capacity left for this choice — try next preference

                        const a = makeAssignment(user, bid.startDate, bid.endDate, slotLetter, awarded[user.id].length + 1, 'Bid Awarded', month);
                        const usedDays = awarded[user.id].reduce((s, x) => s + x.days, 0);
                        if (usedDays + a.days > 30) continue; // would exceed entitlement — try next preference

                        slotAvailability[month][pos][slotLetter]--;
                        awarded[user.id].push(a);
                    }
                });

                sortedMaintUsers.forEach(user => {
                    const pos = resolvePos(user.position || 'Unassigned');
                    const assignedKeys = new Set(awarded[user.id].map(a => a.startDate + '|' + a.endDate));
                    while (awarded[user.id].length < 2) {
                        let found = false;
                        for (const month of months) {
                            if (found) break;
                            if (!slotAvailability[month]?.[pos]) continue;
                            for (const letter of ['A', 'B', 'C']) {
                                if (slotAvailability[month][pos][letter] <= 0) continue;
                                const dates = slotDates[pos]?.[month]?.[letter];
                                if (!dates) continue;
                                const dk = dates.start + '|' + dates.end;
                                if (assignedKeys.has(dk)) continue;
                                const usedDays = awarded[user.id].reduce((s, x) => s + x.days, 0);
                                const days = Math.ceil((new Date(dates.end) - new Date(dates.start)) / 86400000) + 1;
                                if (usedDays + days > 30) continue;
                                const a = makeAssignment(user, dates.start, dates.end, letter, awarded[user.id].length + 1, 'Auto-Assigned');
                                awarded[user.id].push(a);
                                assignedKeys.add(dk);
                                slotAvailability[month][pos][letter]--;
                                found = true;
                                break;
                            }
                        }
                        if (!found) break;
                    }
                });

                const maintResults = [];
                sortedMaintUsers.forEach((user, idx) => {
                    const rank = posRankMap[user.id]?.posRank || (idx + 1);
                    awarded[user.id].forEach((a, si) => {
                        maintResults.push({ ...a, seniorityRank: rank, positionSeniorityRank: rank, slotOrder: si + 1, entitlement: 30 });
                    });
                });

                // unconfiguredPositions mirrors Ops's unconfiguredDepts — positions with
                // maintenance staff assigned but zero configured slot capacity anywhere.
                const unconfiguredPositions = Object.keys(positionGroups).filter(pos => !configuredPositions.has(pos));

                return {
                    positionGroups,
                    sortedGroupKeys: Object.keys(positionGroups).sort(),
                    maintResults,
                    unconfiguredPositions,
                    totalEmployees: sortedMaintUsers.length,
                    bidAwarded: maintResults.filter(r => r.type === 'Bid Awarded').length,
                    autoAssigned: maintResults.filter(r => r.type === 'Auto-Assigned').length,
                };
            };

            app.processMaintBids = async function() {
                const maintUsers = this.state.maintenanceStaffUsers || [];
                if (maintUsers.length === 0) {
                    alert('No maintenance staff found.');
                    return;
                }
                if (Object.keys(this.state.maintSlotCapacities || {}).length === 0) {
                    alert('Please configure maintenance slot capacities first.');
                    return;
                }

                const confirmed = await this.showConfirmModal('Are you sure you want to process all bids?');
                if (!confirmed) return;

                const result = this.computeMaintBidAllocation();
                const maintResults = result.maintResults;

                this.state.maintResults = maintResults;
                this.state.isMaintProcessed = true;
                await this.saveConfigToSupabase();

                const bidAwarded = result.bidAwarded;
                const autoAssigned = result.autoAssigned;
                alert('Successfully processed ' + result.totalEmployees + ' maintenance staff!\n\n'
                    + 'Total slots assigned: ' + maintResults.length + '\n'
                    + 'Bid Awards: ' + bidAwarded + '\n'
                    + 'Auto-Assigned: ' + autoAssigned + '\n'
                    + 'Total leave days: ' + maintResults.reduce((s, r) => s + r.days, 0));
                this.renderAdminView();
            };
