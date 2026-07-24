// ════════════════════════════════════════════════════════════════════
// api-swaptrading.js — Bid Trading Platform, Stage 1: data layer.
//
// Attaches onto the shared `app` object, must load AFTER app.js and
// api-supabase.js (uses this._tid()). This is the CRUD layer only —
// creating, listing, accepting, rejecting, and withdrawing swap
// offers/requests. It does NOT perform the automatic validation
// (department match, slot-day compatibility, December-holder check)
// — that's Stage 2, deliberately kept separate so the data layer can
// be tested and trusted on its own first.
//
// State machine for a swap request's `status` field:
//   open                 → posted with no target, awaiting any eligible acceptance
//   pending               → targeted at a specific employee, awaiting their response
//   accepted               → both sides' slots are locked in, ready for Stage 2 validation
//   rejected_by_recipient    → the targeted/accepting employee declined
//   withdrawn                 → the requester cancelled before anyone accepted
//   validated                  → (Stage 2) passed automatic validation, awaiting planner
//   rejected_validation         → (Stage 2) failed automatic validation
//   approved                     → (Stage 4) planner approved, swap executed
//   denied_by_planner             → (Stage 4) planner rejected despite passing validation
//
// Scope: Ops and Maintenance only, per the agreed spec — staff_category
// on each row is 'ops' or 'maintenance', derived from this.state.userType
// at the moment the offer/response is created.
// ════════════════════════════════════════════════════════════════════

// Manual refresh helper — re-fetches swap requests without a full page
// reload. The initial load on login/page-load happens inside
// loadFromSupabase() in api-supabase.js (parallelized with everything
// else); this is for a later UI "Refresh" action, or after an action that
// needs the freshest list (e.g. right after accepting an offer).
app.loadSwapRequests = async function() {
    if (!this.supabase) return;
    try {
        const { data, error } = await this.supabase
            .from('leave_swap_requests')
            .select('*')
            .eq('tenant_id', this._tid())
            .order('created_at', { ascending: false });
        if (error) {
            console.warn('⚠️ Could not load leave_swap_requests:', error.message);
            this.state.swapRequests = this.state.swapRequests || [];
            return;
        }
        this.state.swapRequests = data || [];
        console.log(`✅ Loaded ${this.state.swapRequests.length} swap request(s)`);
    } catch (e) {
        console.warn('⚠️ Could not load leave_swap_requests:', e.message);
        this.state.swapRequests = this.state.swapRequests || [];
    }
};

// Creates a new swap offer. `mySlot` is the requester's own awarded slot
// being offered — { slotType, startDate, endDate, department }, taken
// directly from their entry in this.state.results / this.state.maintResults.
// `targetId` is optional — omit for an open offer anyone eligible can accept,
// or provide a specific employee ID for a direct request.
app.createSwapOffer = async function(mySlot, targetId, targetName) {
    const user = this.state.verifiedEmployee;
    if (!user) { this.showToast('You must be logged in to offer a trade.', 'error'); return null; }

    const isMaint = this.state.userType === 'maintenancestaff';
    const staffCategory = isMaint ? 'maintenance' : 'ops';

    const row = {
        tenant_id: this._tid(),
        staff_category: staffCategory,
        requester_id: user.id,
        requester_name: user.name,
        requester_slot_type: mySlot.slotType,
        requester_start_date: mySlot.startDate,
        requester_end_date: mySlot.endDate,
        requester_department: mySlot.department || '',
        target_id: targetId || null,
        target_name: targetId ? (targetName || '') : null,
        status: targetId ? 'pending' : 'open',
    };

    try {
        const { data, error } = await this.supabase
            .from('leave_swap_requests')
            .insert(row)
            .select();
        if (error) {
            console.error('❌ Failed to create swap offer:', error.message);
            this.showToast('Could not create trade offer: ' + error.message, 'error');
            return null;
        }
        this.state.swapRequests = [data[0], ...(this.state.swapRequests || [])];
        this.showToast(targetId ? `Trade request sent to ${targetName || targetId}.` : 'Trade offer posted.', 'success');
        return data[0];
    } catch (e) {
        console.error('❌ Failed to create swap offer:', e.message);
        this.showToast('Could not create trade offer: ' + e.message, 'error');
        return null;
    }
};

// Accepts an open or pending swap request. `theirSlot` is the accepting
// employee's own awarded slot being offered in return — same shape as
// mySlot in createSwapOffer. Moves status to 'accepted'. Does NOT run
// validation — that happens in Stage 2, triggered separately once a
// request reaches 'accepted'.
app.acceptSwapOffer = async function(requestId, theirSlot) {
    const user = this.state.verifiedEmployee;
    if (!user) { this.showToast('You must be logged in to respond to a trade.', 'error'); return false; }

    const req = (this.state.swapRequests || []).find(r => r.id === requestId);
    if (!req) { this.showToast('Trade request not found.', 'error'); return false; }
    if (req.status !== 'open' && req.status !== 'pending') {
        this.showToast('This trade request is no longer available.', 'error');
        return false;
    }
    if (req.target_id && req.target_id !== user.id) {
        this.showToast('This trade request was sent to a specific employee and cannot be accepted by anyone else.', 'error');
        return false;
    }
    if (req.requester_id === user.id) {
        this.showToast('You cannot accept your own trade offer.', 'error');
        return false;
    }

    const updates = {
        responder_id: user.id,
        responder_name: user.name,
        responder_slot_type: theirSlot.slotType,
        responder_start_date: theirSlot.startDate,
        responder_end_date: theirSlot.endDate,
        responder_department: theirSlot.department || '',
        status: 'accepted',
        responded_at: new Date().toISOString(),
    };

    try {
        const { data, error } = await this.supabase
            .from('leave_swap_requests')
            .update(updates)
            .eq('id', requestId)
            .eq('tenant_id', this._tid())
            .select();
        if (error) {
            console.error('❌ Failed to accept swap offer:', error.message);
            this.showToast('Could not accept trade: ' + error.message, 'error');
            return false;
        }
        this.state.swapRequests = (this.state.swapRequests || []).map(r => r.id === requestId ? data[0] : r);
        this.showToast('Trade accepted — running automatic review...', 'success');
        // Both sides have now agreed — run the compliance check immediately,
        // per the agreed flow (validate right after mutual acceptance, before
        // the planner ever sees it).
        await this.validateSwapRequest(requestId);
        return true;
    } catch (e) {
        console.error('❌ Failed to accept swap offer:', e.message);
        this.showToast('Could not accept trade: ' + e.message, 'error');
        return false;
    }
};

// Rejects a pending (targeted) request. Only the target of a direct
// request, or the requester themself, can reject.
app.rejectSwapOffer = async function(requestId) {
    return await this._updateSwapStatus(requestId, 'rejected_by_recipient');
};

// Withdraws an offer the current user made, before anyone has accepted it.
app.withdrawSwapOffer = async function(requestId) {
    const req = (this.state.swapRequests || []).find(r => r.id === requestId);
    if (!req) { this.showToast('Trade request not found.', 'error'); return false; }
    if (req.status !== 'open' && req.status !== 'pending') {
        this.showToast('This trade can no longer be withdrawn — it has already been accepted or resolved.', 'error');
        return false;
    }
    return await this._updateSwapStatus(requestId, 'withdrawn');
};

// ════════════════════════════════════════════════════════════════════
// STAGE 2 — automatic validation.
//
// _checkSwapCompliance() is a PURE function — no state writes, no
// network calls — same design principle as computeBidAllocation():
// isolate the actual rule logic so it can be tested directly, and so
// the same rules are guaranteed to apply consistently everywhere they're
// checked. Given an already-accepted request (both sides' slots filled
// in), it returns every reason the trade should be blocked, not just
// the first one — a planner reviewing an exception benefits from seeing
// the whole picture at once, not one failure at a time.
//
// The three agreed rules, in order:
//   1. Department/position must match exactly (case-insensitive; both
//      sides' department field already comes from their own resolved
//      result, so this is a straightforward comparison, not a fresh
//      department resolution).
//   2. Slot-day compatibility — Slot A/B/C (15 days each) are mutually
//      interchangeable; Slot D (20 days) can only trade with Slot D.
//   3. December→January rule applies to the SWAPPED dates, not the
//      original ones — after a trade, each person ends up holding the
//      OTHER person's original dates, so each side must be checked
//      against what they're about to receive, not what they're giving up.
//
// Seniority and on-call conflicts are deliberately NOT checked here —
// both were explicitly agreed as non-blockers for a mutually-consented
// trade.
// ════════════════════════════════════════════════════════════════════

const SWAP_COMPATIBLE_GROUPS = [['A', 'B', 'C'], ['D']];

app._checkSwapCompliance = function(request) {
    const reasons = [];

    // ── Rule 1: department/position match ──────────────────────────────
    const reqDept = String(request.requester_department || '').trim().toLowerCase();
    const resDept = String(request.responder_department || '').trim().toLowerCase();
    if (!reqDept || !resDept || reqDept !== resDept) {
        reasons.push(`Department/position mismatch: requester is "${request.requester_department || '(unknown)'}", responder is "${request.responder_department || '(unknown)'}". Trades are only allowed within the same department/position.`);
    }

    // ── Rule 2: slot-day compatibility ──────────────────────────────────
    const letterOf = (slotType) => String(slotType || '').charAt(String(slotType || '').length - 1).toUpperCase();
    const groupOf = (letter) => SWAP_COMPATIBLE_GROUPS.findIndex(g => g.includes(letter));
    const reqLetter = letterOf(request.requester_slot_type);
    const resLetter = letterOf(request.responder_slot_type);
    const reqGroup = groupOf(reqLetter);
    const resGroup = groupOf(resLetter);
    if (reqGroup === -1 || resGroup === -1 || reqGroup !== resGroup) {
        reasons.push(`Slot type incompatible: Slot ${reqLetter} cannot trade with Slot ${resLetter}. Slot A/B/C may trade with each other; Slot D may only trade with Slot D.`);
    }

    // ── Rule 3: December→January rule, checked against the SWAPPED dates ──
    const year = this.state.biddingYear;
    if (this._blocksJanuaryBid(request.requester_id, request.responder_start_date, request.responder_end_date, year)) {
        reasons.push(`${request.requester_name || request.requester_id} has approved December leave and cannot take on a slot that overlaps January.`);
    }
    if (this._blocksJanuaryBid(request.responder_id, request.requester_start_date, request.requester_end_date, year)) {
        reasons.push(`${request.responder_name || request.responder_id} has approved December leave and cannot take on a slot that overlaps January.`);
    }

    return { passed: reasons.length === 0, reasons };
};

// Orchestrator: runs the pure check above against an already-'accepted'
// request, then writes the outcome to Supabase. Called automatically by
// acceptSwapOffer() right after both sides' slots are locked in — nobody
// needs to trigger this manually.
app.validateSwapRequest = async function(requestId) {
    const req = (this.state.swapRequests || []).find(r => r.id === requestId);
    if (!req) { console.warn('validateSwapRequest: request not found', requestId); return null; }
    if (req.status !== 'accepted') { console.warn('validateSwapRequest: request is not in accepted status', req.status); return null; }

    const result = this._checkSwapCompliance(req);
    const newStatus = result.passed ? 'validated' : 'rejected_validation';
    const notes = result.passed
        ? 'Passed automatic validation — awaiting planner approval.'
        : result.reasons.join(' ');

    try {
        const { data, error } = await this.supabase
            .from('leave_swap_requests')
            .update({ status: newStatus, validation_notes: notes, validated_at: new Date().toISOString() })
            .eq('id', requestId)
            .eq('tenant_id', this._tid())
            .select();
        if (error) {
            console.error('❌ Failed to write validation result:', error.message);
            return null;
        }
        this.state.swapRequests = (this.state.swapRequests || []).map(r => r.id === requestId ? data[0] : r);
        if (result.passed) {
            this.showToast('Trade passed automatic validation — awaiting planner approval.', 'success');
        } else {
            this.showToast('Trade did not pass automatic validation: ' + result.reasons[0], 'warn');
        }
        return data[0];
    } catch (e) {
        console.error('❌ Failed to write validation result:', e.message);
        return null;
    }
};

// Shared helper for simple status-only transitions (reject, withdraw).
app._updateSwapStatus = async function(requestId, newStatus) {
    try {
        const { data, error } = await this.supabase
            .from('leave_swap_requests')
            .update({ status: newStatus, resolved_at: new Date().toISOString() })
            .eq('id', requestId)
            .eq('tenant_id', this._tid())
            .select();
        if (error) {
            console.error(`❌ Failed to update swap request to ${newStatus}:`, error.message);
            this.showToast('Could not update trade request: ' + error.message, 'error');
            return false;
        }
        this.state.swapRequests = (this.state.swapRequests || []).map(r => r.id === requestId ? data[0] : r);
        return true;
    } catch (e) {
        console.error(`❌ Failed to update swap request to ${newStatus}:`, e.message);
        this.showToast('Could not update trade request: ' + e.message, 'error');
        return false;
    }
};
