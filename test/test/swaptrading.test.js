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
        responder_id: 'E2', responder_name: 'Responder Two',
        responder_department: 'DEPT-X', responder_slot_type: 'slotB',
        responder_start_date: '2027-02-01', responder_end_date: '2027-02-15',
        status: 'accepted',
        ...overrides,
    };
}

test('passes when department matches and slot types are in the same compatible group (A/B/C)', () => {
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
    const result = app._checkSwapCompliance(baseRequest({ requester_slot_type: 'slotC', responder_slot_type: 'slotA' }));
    assert.equal(result.passed, true, `expected pass, got reasons: ${result.reasons.join(' | ')}`);
});

test('Slot D cannot trade with Slot A/B/C', () => {
    const app = buildSwapApp();
    const result = app._checkSwapCompliance(baseRequest({ requester_slot_type: 'slotD', responder_slot_type: 'slotA' }));
    assert.equal(result.passed, false);
    assert.ok(result.reasons.some(r => r.includes('Slot type incompatible')));
});

test('Slot D can trade with another Slot D', () => {
    const app = buildSwapApp();
    const result = app._checkSwapCompliance(baseRequest({ requester_slot_type: 'slotD', responder_slot_type: 'slotD' }));
    assert.equal(result.passed, true, `expected pass, got reasons: ${result.reasons.join(' | ')}`);
});

test('a December leave holder is blocked if the trade would give them a January slot', () => {
    // E1 has approved December leave. Their own original slot (Jan 1-15) is
    // already January, but that's not what's being checked — what matters is
    // whether the slot they'd RECEIVE via the trade overlaps January. Here
    // the responder's slot (which E1 would receive) is also in January, so
    // this must fail.
    const app = buildSwapApp({ decemberLeaveHolders: ['E1'] });
    const result = app._checkSwapCompliance(baseRequest({
        responder_start_date: '2027-01-16', responder_end_date: '2027-01-30',
    }));
    assert.equal(result.passed, false);
    assert.ok(result.reasons.some(r => r.includes('Requester One') && r.includes('December')));
});

test('a December leave holder trading INTO a non-January slot is allowed', () => {
    // E1 has approved December leave, but the slot they'd receive from this
    // trade is in March, not January — should NOT be blocked.
    const app = buildSwapApp({ decemberLeaveHolders: ['E1'] });
    const result = app._checkSwapCompliance(baseRequest({
        responder_start_date: '2027-03-01', responder_end_date: '2027-03-15',
    }));
    assert.equal(result.passed, true, `expected pass, got reasons: ${result.reasons.join(' | ')}`);
});

test('the December rule is checked for BOTH sides independently', () => {
    // Both E1 and E2 are December leave holders, and BOTH original slots
    // are in January — so after the swap, both sides would still be
    // receiving a January slot. Both reasons should be present.
    const app = buildSwapApp({ decemberLeaveHolders: ['E1', 'E2'] });
    const result = app._checkSwapCompliance(baseRequest({
        requester_start_date: '2027-01-01', requester_end_date: '2027-01-15',
        responder_start_date: '2027-01-16', responder_end_date: '2027-01-30',
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
        responder_start_date: '2027-01-16',              // December rule violation for E1
        responder_end_date: '2027-01-30',
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
