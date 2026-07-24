// test/swaptrading.test.js
//
// Regression tests for the Bid Trading Platform's validation engine
// (_checkSwapCompliance in api-swaptrading.js). Same principle as
// allocation.test.js: load the REAL, unmodified source files, not a
// rewritten copy, so a passing suite means the actual production rule
// logic is correct.
//
// Run with: node --test test/

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, baseState } = require('./harness');

function buildSwapApp(stateOverrides = {}) {
    return buildApp(baseState(stateOverrides), ['utils.js', 'api-swaptrading.js']);
}

function baseRequest(overrides = {}) {
    return {
        id: 1,
        requester_id: 'E1', requester_name: 'Requester One',
        requester_department: 'DEPT-X', requester_slot_type: 'slotA',
        requester_start_date: '2027-01-01', requester_end_date: '2027-01-15',
        requester_month: 'January',
        desired_slot_type: 'slotB', desired_month: 'February',
        responder_id: 'E2', responder_name: 'Responder Two',
        responder_department: 'DEPT-X', responder_slot_type: 'slotB',
        responder_start_date: '2027-02-01', responder_end_date: '2027-02-15',
        responder_month: 'February',
        status: 'accepted',
        ...overrides,
    };
}

test('passes when department matches, slot types are in the same compatible group, and the exact desired block+letter is matched', () => {
    const app = buildSwapApp();
    const result = app._checkSwapCompliance(baseRequest());
    assert.equal(result.passed, true, `expected pass, got reasons: ${result.reasons.join(' | ')}`);
    assert.equal(result.reasons.length, 0);
});

test('fails when departments do not match', () => {
    const app = buildSwapApp();
    const result = app._checkSwapCompliance(baseRequest({ responder_department: 'DEPT-Y' }));
    assert.equal(result.passed, false);
    assert.ok(result.reasons.some(r => r.includes('Department/position mismatch')));
});

test('department match is case-insensitive', () => {
    const app = buildSwapApp();
    const result = app._checkSwapCompliance(baseRequest({ requester_department: 'dept-x', responder_department: 'DEPT-X' }));
    assert.equal(result.passed, true, `expected pass, got reasons: ${result.reasons.join(' | ')}`);
});

test('Slot A and Slot B are compatible with each other', () => {
    const app = buildSwapApp();
    const result = app._checkSwapCompliance(baseRequest({ requester_slot_type: 'slotA', responder_slot_type: 'slotB' }));
    assert.equal(result.passed, true, `expected pass, got reasons: ${result.reasons.join(' | ')}`);
});

test('Slot C and Slot A are compatible with each other', () => {
    const app = buildSwapApp();
    const result = app._checkSwapCompliance(baseRequest({
        requester_slot_type: 'slotC', responder_slot_type: 'slotA', desired_slot_type: 'slotA',
    }));
    assert.equal(result.passed, true, `expected pass, got reasons: ${result.reasons.join(' | ')}`);
});

test('Slot D cannot trade with Slot A/B/C', () => {
    const app = buildSwapApp();
    const result = app._checkSwapCompliance(baseRequest({
        requester_slot_type: 'slotD', responder_slot_type: 'slotA', desired_slot_type: 'slotD',
    }));
    assert.equal(result.passed, false);
    assert.ok(result.reasons.some(r => r.includes('Slot type incompatible')));
});

test('Slot D can trade with another Slot D, in the exact desired block', () => {
    const app = buildSwapApp();
    const result = app._checkSwapCompliance(baseRequest({
        requester_slot_type: 'slotD', responder_slot_type: 'slotD', desired_slot_type: 'slotD',
        desired_month: 'February', responder_month: 'February',
    }));
    assert.equal(result.passed, true, `expected pass, got reasons: ${result.reasons.join(' | ')}`);
});

test('the requester receives exactly the slot type they asked for, not merely a compatible one', () => {
    // Requester offers Slot A and specifically asked for a Slot C back.
    // The responder offers a Slot B — B is generally compatible with A
    // under Rule 2, but it is NOT the specific type requested, so this
    // must still fail.
    const app = buildSwapApp();
    const result = app._checkSwapCompliance(baseRequest({
        requester_slot_type: 'slotA', desired_slot_type: 'slotC', responder_slot_type: 'slotB',
    }));
    assert.equal(result.passed, false);
    assert.ok(result.reasons.some(r => r.includes('Requested slot type not matched')));
});

test('the responder must offer the EXACT block the requester asked for, not just the right letter in a different month', () => {
    // Requester asked specifically for Slot C in "Block 9". The responder's
    // slot is also a Slot C — same letter, passes Rule 2 and the letter
    // portion of Rule 3 — but it's in a completely different block
    // ("February" instead of "Block 9"), so this must still fail.
    const app = buildSwapApp();
    const result = app._checkSwapCompliance(baseRequest({
        desired_slot_type: 'slotC', desired_month: 'Block 9',
        responder_slot_type: 'slotC', responder_month: 'February',
    }));
    assert.equal(result.passed, false);
    assert.ok(result.reasons.some(r => r.includes('Requested block not matched')));
});

test('a request with no desired slot on record cannot be validated', () => {
    const app = buildSwapApp();
    const result = app._checkSwapCompliance(baseRequest({ desired_slot_type: null, desired_month: null }));
    assert.equal(result.passed, false);
    assert.ok(result.reasons.some(r => r.includes('no desired slot on record')));
});

test('a December leave holder is blocked if the trade would give them a January slot', () => {
    // E1 has approved December leave. Their own original slot (Jan 1-15) is
    // already January, but that's not what's being checked — what matters is
    // whether the slot they'd RECEIVE via the trade overlaps January. Here
    // the responder's slot (which E1 would receive) is also in January, so
    // this must fail.
    const app = buildSwapApp({ decemberLeaveHolders: ['E1'] });
    const result = app._checkSwapCompliance(baseRequest({
        desired_month: 'January', responder_start_date: '2027-01-16', responder_end_date: '2027-01-30', responder_month: 'January',
    }));
    assert.equal(result.passed, false);
    assert.ok(result.reasons.some(r => r.includes('Requester One') && r.includes('December')));
});

test('a December leave holder trading INTO a non-January slot is allowed', () => {
    // E1 has approved December leave, but the slot they'd receive from this
    // trade is in March, not January — should NOT be blocked.
    const app = buildSwapApp({ decemberLeaveHolders: ['E1'] });
    const result = app._checkSwapCompliance(baseRequest({
        desired_month: 'March', responder_start_date: '2027-03-01', responder_end_date: '2027-03-15', responder_month: 'March',
    }));
    assert.equal(result.passed, true, `expected pass, got reasons: ${result.reasons.join(' | ')}`);
});

test('the December rule is checked for BOTH sides independently', () => {
    // Both E1 and E2 are December leave holders, and BOTH original slots
    // are in January — so after the swap, both sides would still be
    // receiving a January slot. Both reasons should be present.
    const app = buildSwapApp({ decemberLeaveHolders: ['E1', 'E2'] });
    const result = app._checkSwapCompliance(baseRequest({
        requester_start_date: '2027-01-01', requester_end_date: '2027-01-15', requester_month: 'January',
        desired_month: 'January', responder_start_date: '2027-01-16', responder_end_date: '2027-01-30', responder_month: 'January',
    }));
    assert.equal(result.passed, false);
    assert.ok(result.reasons.some(r => r.includes('Requester One')));
    assert.ok(result.reasons.some(r => r.includes('Responder Two')));
    assert.equal(result.reasons.length, 2, 'both sides should be flagged independently');
});

test('multiple simultaneous failures are all reported, not just the first one found', () => {
    const app = buildSwapApp({ decemberLeaveHolders: ['E1'] });
    const result = app._checkSwapCompliance(baseRequest({
        responder_department: 'DEPT-Y',              // department mismatch
        requester_slot_type: 'slotD',                  // slot incompatibility
        responder_slot_type: 'slotA',
        desired_slot_type: 'slotA', desired_month: 'January',   // matches what's actually offered — keeps Rule 3 from firing here
        responder_start_date: '2027-01-16', responder_end_date: '2027-01-30', responder_month: 'January', // December rule violation for E1
    }));
    assert.equal(result.passed, false);
    assert.equal(result.reasons.length, 3, `expected exactly 3 reasons, got: ${JSON.stringify(result.reasons)}`);
});

test('seniority is never checked — no reason ever mentions seniority', () => {
    // Explicit regression guard for the agreed rule: once both parties
    // consent, seniority is not a blocker. There is no seniority field on
    // the request at all, so this mostly guards against someone adding a
    // seniority check to this function later without updating the spec.
    const app = buildSwapApp();
    const result = app._checkSwapCompliance(baseRequest());
    assert.ok(!result.reasons.some(r => r.toLowerCase().includes('senior')));
});

// ════════════════════════════════════════════════════════════════════
// _getConfiguredSwapSlotOptions — the picker's real-data source.
// ════════════════════════════════════════════════════════════════════

test('_getConfiguredSwapSlotOptions returns only enabled slots within the offered letter\'s compatible group', () => {
    const app = buildSwapApp({
        months: ['January', 'February', 'March'],
        slotCapacities: {
            'cal-DEPT-X-January-SA-enabled': true, 'cal-DEPT-X-January-SA-start': '2027-01-01', 'cal-DEPT-X-January-SA-end': '2027-01-15',
            'cal-DEPT-X-February-SB-enabled': true, 'cal-DEPT-X-February-SB-start': '2027-02-01', 'cal-DEPT-X-February-SB-end': '2027-02-15',
            'cal-DEPT-X-March-SD-enabled': true, 'cal-DEPT-X-March-SD-start': '2027-03-01', 'cal-DEPT-X-March-SD-end': '2027-03-20',
            'cal-DEPT-X-March-SC-enabled': false, 'cal-DEPT-X-March-SC-start': '2027-03-01', 'cal-DEPT-X-March-SC-end': '2027-03-15',
        },
    });
    const options = app._getConfiguredSwapSlotOptions('DEPT-X', false, 'A');
    // Should include January-A and February-B (same A/B/C group), but NOT
    // March-D (different group) and NOT the disabled March-C.
    assert.equal(options.length, 2);
    assert.ok(options.some(o => o.letter === 'A' && o.month === 'January'));
    assert.ok(options.some(o => o.letter === 'B' && o.month === 'February'));
    assert.ok(!options.some(o => o.letter === 'D'));
});

test('_getConfiguredSwapSlotOptions only returns Slot D options when offering a Slot D', () => {
    const app = buildSwapApp({
        months: ['January', 'March'],
        slotCapacities: {
            'cal-DEPT-X-January-SA-enabled': true, 'cal-DEPT-X-January-SA-start': '2027-01-01', 'cal-DEPT-X-January-SA-end': '2027-01-15',
            'cal-DEPT-X-March-SD-enabled': true, 'cal-DEPT-X-March-SD-start': '2027-03-01', 'cal-DEPT-X-March-SD-end': '2027-03-20',
        },
    });
    const options = app._getConfiguredSwapSlotOptions('DEPT-X', false, 'D');
    assert.equal(options.length, 1);
    assert.equal(options[0].letter, 'D');
    assert.equal(options[0].month, 'March');
});

test('_getConfiguredSwapSlotOptions reads from maintSlotCapacities and the cal-maint- prefix for Maintenance staff', () => {
    const app = buildSwapApp({
        months: ['January'],
        maintSlotCapacities: {
            'cal-maint-Fitter-January-SA-enabled': true, 'cal-maint-Fitter-January-SA-start': '2027-01-01', 'cal-maint-Fitter-January-SA-end': '2027-01-15',
        },
    });
    const options = app._getConfiguredSwapSlotOptions('Fitter', true, 'A');
    assert.equal(options.length, 1);
    assert.equal(options[0].letter, 'A');
    assert.equal(options[0].month, 'January');
});

// ════════════════════════════════════════════════════════════════════
// _computeSwapResultUpdate — Stage 4's core mutation logic.
// This is the highest-stakes function in the whole feature: it rewrites
// the authoritative award records everything else in the app reads from.
// ════════════════════════════════════════════════════════════════════

function makeAward(overrides = {}) {
    return {
        employeeId: 'E1', employeeName: 'Alice', seniorityRank: 3, department: 'DEPT-X', position: 'Controller',
        slotType: 'slotA', slotName: 'Slot A', startDate: '2027-01-01', endDate: '2027-01-15', days: 15, month: 'January',
        type: 'Bid Awarded', slotOrder: 1, entitlement: 30, yearsOfService: '5.0',
        ...overrides,
    };
}

test('a successful swap exchanges only the slot-identifying fields, leaving identity/seniority fields untouched', () => {
    const app = buildSwapApp();
    const requesterAward = makeAward({ employeeId: 'E1', employeeName: 'Alice', seniorityRank: 3 });
    const responderAward = makeAward({
        employeeId: 'E2', employeeName: 'Bob', seniorityRank: 7,
        slotType: 'slotB', slotName: 'Slot B', startDate: '2027-02-01', endDate: '2027-02-15', month: 'February',
    });
    const request = baseRequest({
        requester_id: 'E1', requester_slot_type: 'slotA', requester_start_date: '2027-01-01', requester_end_date: '2027-01-15',
        responder_id: 'E2', responder_slot_type: 'slotB', responder_start_date: '2027-02-01', responder_end_date: '2027-02-15',
        requester_name: 'Alice', responder_name: 'Bob',
    });

    const result = app._computeSwapResultUpdate(request, [requesterAward, responderAward]);
    assert.equal(result.ok, true);

    // Alice now holds what was Bob's slot; identity stays hers.
    assert.equal(result.newRequesterAward.employeeId, 'E1');
    assert.equal(result.newRequesterAward.employeeName, 'Alice');
    assert.equal(result.newRequesterAward.seniorityRank, 3, 'seniority must stay with the person, not move with the slot');
    assert.equal(result.newRequesterAward.slotType, 'slotB');
    assert.equal(result.newRequesterAward.startDate, '2027-02-01');
    assert.equal(result.newRequesterAward.month, 'February');

    // Bob now holds what was Alice's slot; identity stays his.
    assert.equal(result.newResponderAward.employeeId, 'E2');
    assert.equal(result.newResponderAward.employeeName, 'Bob');
    assert.equal(result.newResponderAward.seniorityRank, 7);
    assert.equal(result.newResponderAward.slotType, 'slotA');
    assert.equal(result.newResponderAward.startDate, '2027-01-01');
});

test('a successful swap attaches tradeInfo to both records for the Justification Report to use', () => {
    const app = buildSwapApp();
    const requesterAward = makeAward({ employeeId: 'E1' });
    const responderAward = makeAward({ employeeId: 'E2', slotType: 'slotB', startDate: '2027-02-01', endDate: '2027-02-15' });
    const request = baseRequest({
        requester_id: 'E1', requester_start_date: '2027-01-01', requester_end_date: '2027-01-15',
        responder_id: 'E2', responder_slot_type: 'slotB', responder_start_date: '2027-02-01', responder_end_date: '2027-02-15',
        requester_name: 'Alice', responder_name: 'Bob',
    });

    const result = app._computeSwapResultUpdate(request, [requesterAward, responderAward]);
    assert.equal(result.newRequesterAward.tradeInfo.tradedWith, 'E2');
    assert.equal(result.newRequesterAward.tradeInfo.tradedWithName, 'Bob');
    assert.equal(result.newRequesterAward.tradeInfo.previousStartDate, '2027-01-01', "should record the requester's OWN previous slot, not the new one");
    assert.equal(result.newResponderAward.tradeInfo.tradedWith, 'E1');
    assert.equal(result.newResponderAward.tradeInfo.tradedWithName, 'Alice');
});

test('fails safely, mutating nothing, if the requester\'s original award can no longer be found', () => {
    const app = buildSwapApp();
    const responderAward = makeAward({ employeeId: 'E2', slotType: 'slotB', startDate: '2027-02-01', endDate: '2027-02-15' });
    // No matching requester award in the pool at all — e.g. results were
    // reprocessed since this trade was validated.
    const request = baseRequest({ requester_id: 'E1', responder_id: 'E2', responder_slot_type: 'slotB', responder_start_date: '2027-02-01', responder_end_date: '2027-02-15' });

    const result = app._computeSwapResultUpdate(request, [responderAward]);
    assert.equal(result.ok, false);
    assert.ok(result.reason.includes('could no longer be found'));
});

test('fails safely, mutating nothing, if the responder\'s original award can no longer be found', () => {
    const app = buildSwapApp();
    const requesterAward = makeAward({ employeeId: 'E1' });
    const request = baseRequest({ requester_id: 'E1', responder_id: 'E2' });

    const result = app._computeSwapResultUpdate(request, [requesterAward]);
    assert.equal(result.ok, false);
    assert.ok(result.reason.includes('could no longer be found'));
});

test('the pure swap computation never mutates the original award objects it was given', () => {
    // Defense in depth: even though the orchestrator (approveSwapRequest)
    // is responsible for actually replacing records in state, the pure
    // function itself must never mutate its inputs — callers should be
    // able to trust the originals are untouched until they choose to
    // apply the returned new objects.
    const app = buildSwapApp();
    const requesterAward = makeAward({ employeeId: 'E1' });
    const responderAward = makeAward({ employeeId: 'E2', slotType: 'slotB', startDate: '2027-02-01', endDate: '2027-02-15' });
    const requesterSnapshot = JSON.stringify(requesterAward);
    const responderSnapshot = JSON.stringify(responderAward);

    const request = baseRequest({
        requester_id: 'E1', responder_id: 'E2', responder_slot_type: 'slotB',
        responder_start_date: '2027-02-01', responder_end_date: '2027-02-15',
    });
    app._computeSwapResultUpdate(request, [requesterAward, responderAward]);

    assert.equal(JSON.stringify(requesterAward), requesterSnapshot, 'original requester award object must be untouched');
    assert.equal(JSON.stringify(responderAward), responderSnapshot, 'original responder award object must be untouched');
});

// ════════════════════════════════════════════════════════════════════
// isTradingClosed — the trading window control, separate from the
// bidding deadline. Lives in views-bidding.js, so this file's harness
// call loads that too, alongside utils.js and api-swaptrading.js.
// ════════════════════════════════════════════════════════════════════

function buildFullSwapApp(stateOverrides = {}) {
    return buildApp(baseState(stateOverrides), ['utils.js', 'views-bidding.js', 'api-swaptrading.js']);
}

test('isTradingClosed returns false when no deadline is set', () => {
    const app = buildFullSwapApp({ tradingDeadline: '' });
    assert.equal(app.isTradingClosed(), false);
});

test('isTradingClosed returns true once the deadline has passed', () => {
    const app = buildFullSwapApp({ tradingDeadline: '2020-01-01T00:00' });
    assert.equal(app.isTradingClosed(), true);
});

test('isTradingClosed returns false while the deadline is still in the future', () => {
    const app = buildFullSwapApp({ tradingDeadline: '2099-01-01T00:00' });
    assert.equal(app.isTradingClosed(), false);
});

test('createSwapOffer is blocked once trading is closed', async () => {
    const app = buildFullSwapApp({ tradingDeadline: '2020-01-01T00:00' });
    app.state.verifiedEmployee = { id: 'E1', name: 'Alice' };
    app.state.userType = 'employee';
    let toastLevel = null;
    app.showToast = (msg, level) => { toastLevel = level; };
    const result = await app.createSwapOffer({ slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', department: 'DEPT-X', month: 'January' }, 'slotB', 'February', null, null);
    assert.equal(result, null, 'should refuse to create an offer once trading is closed');
    assert.equal(toastLevel, 'error');
});


