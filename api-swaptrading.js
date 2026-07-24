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
        this.showToast('Trade accepted — pending automatic review and planner approval.', 'success');
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
