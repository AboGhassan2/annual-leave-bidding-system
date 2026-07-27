// test/bidTableSafety.test.js
//
// Regression tests for _resolveBidTable() in api-supabase.js — a safety net
// added after two real, unexplained cases of a maintenance-only staff
// member's bid landing in the wrong Supabase table (leave_requests instead
// of maint_leave_requests), despite being correctly logged in moments
// earlier in the same session. The root cause was never identified after
// tracing every place userType can be set, read, or persisted — this
// doesn't fix that; it catches the symptom by cross-checking the table a
// bid is about to be saved to against which roster the person is actually
// registered on, correcting it when there's no ambiguity.
//
// Run with: node --test test/

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, baseState } = require('./harness');

function buildBidTableApp(stateOverrides = {}) {
    return buildApp(baseState(stateOverrides), ['utils.js', 'views-admin.js', 'api-supabase.js']);
}

test('does not correct when userType and the single roster the person is on agree', () => {
    const app = buildBidTableApp({
        employees: [{ id: 'E1', name: 'Ola Ops' }],
        maintenanceStaffUsers: [],
        goldenCommandUsers: [],
        corporateStaffUsers: [],
    });
    const result = app._resolveBidTable('E1', 'employee');
    assert.equal(result.table, 'leave_requests');
    assert.equal(result.corrected, false);
});

test('corrects a maintenance-only staff member whose session userType would misfile them into leave_requests', () => {
    // This is exactly the real scenario found twice tonight: the person is
    // ONLY on the maintenance roster, but userType at save time says
    // something else — should be corrected to maint_leave_requests.
    const app = buildBidTableApp({
        employees: [],
        maintenanceStaffUsers: [{ id: 'M1', name: 'Mo Maint' }],
        goldenCommandUsers: [],
        corporateStaffUsers: [],
    });
    const result = app._resolveBidTable('M1', 'employee');
    assert.equal(result.table, 'maint_leave_requests');
    assert.equal(result.corrected, true);
    assert.equal(result.requestedTable, 'leave_requests');
    assert.equal(result.correctedTable, 'maint_leave_requests');
});

test('corrects an Ops-only staff member whose session userType would misfile them into maint_leave_requests', () => {
    // The reverse direction of the same problem — equally worth guarding.
    const app = buildBidTableApp({
        employees: [{ id: 'E1', name: 'Ola Ops' }],
        maintenanceStaffUsers: [],
        goldenCommandUsers: [],
        corporateStaffUsers: [],
    });
    const result = app._resolveBidTable('E1', 'maintenancestaff');
    assert.equal(result.table, 'leave_requests');
    assert.equal(result.corrected, true);
});

test('corrects a Corporate/GC-only staff member whose session userType would misfile them into leave_requests', () => {
    const app = buildBidTableApp({
        employees: [],
        maintenanceStaffUsers: [],
        goldenCommandUsers: [{ id: 'G1', name: 'Gary GC' }],
        corporateStaffUsers: [],
    });
    const result = app._resolveBidTable('G1', 'employee');
    assert.equal(result.table, 'corporate_leave_request');
    assert.equal(result.corrected, true);
});

test('does NOT correct a genuinely dual-registered person — trusts userType as the intended signal for which role they are acting as', () => {
    // This is the critical guard: someone like a real employee who ALSO
    // holds a Corporate Staff role is legitimately allowed to submit bids
    // as either — the safety net must never "correct" that away, or it
    // would break a real, intended feature of the app.
    const app = buildBidTableApp({
        employees: [{ id: 'R1', name: 'Rhea Dual' }],
        maintenanceStaffUsers: [],
        goldenCommandUsers: [],
        corporateStaffUsers: [{ id: 'R1', name: 'Rhea Dual' }],
    });
    const asEmployee = app._resolveBidTable('R1', 'employee');
    assert.equal(asEmployee.table, 'leave_requests');
    assert.equal(asEmployee.corrected, false, 'dual-registered staff acting as Ops must not be corrected');

    const asCorp = app._resolveBidTable('R1', 'corporatestaff');
    assert.equal(asCorp.table, 'corporate_leave_request');
    assert.equal(asCorp.corrected, false, 'dual-registered staff acting as Corporate Staff must not be corrected');
});

test('falls back to userType unchanged when the person is not found on any roster at all', () => {
    // Shouldn't normally happen post-login, but must fail safe rather than
    // throw or silently do something unexpected.
    const app = buildBidTableApp({
        employees: [],
        maintenanceStaffUsers: [],
        goldenCommandUsers: [],
        corporateStaffUsers: [],
    });
    const result = app._resolveBidTable('UNKNOWN', 'maintenancestaff');
    assert.equal(result.table, 'maint_leave_requests');
    assert.equal(result.corrected, false);
});

test('a planner submitting on someone else\'s behalf is treated the same as employee (no roster match required)', () => {
    const app = buildBidTableApp({
        employees: [{ id: 'E1', name: 'Ola Ops' }],
        maintenanceStaffUsers: [],
    });
    const result = app._resolveBidTable('E1', 'planner');
    // planner isn't one of the three explicit userType checks in
    // _bidTableForUserType, so it falls through to leave_requests — and
    // since E1 is genuinely only on the employees roster, that matches,
    // so no correction should occur.
    assert.equal(result.table, 'leave_requests');
    assert.equal(result.corrected, false);
});
