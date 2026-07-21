// test/allocation.test.js
//
// Regression tests for the seniority-based leave allocation engine
// (computeBidAllocation / computeMaintBidAllocation in allocation.js).
//
// These load the REAL, unmodified allocation.js — not a rewritten copy —
// so a passing test suite means the actual production logic behaves
// correctly, not just that a re-implementation of it does.
//
// Run with:  node --test test/
// (Node 18+ has a built-in test runner — no npm install needed.)

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, baseState, opsSlotKeys, maintSlotKeys } = require('./harness');

// ════════════════════════════════════════════════════════════════════
// OPS ENGINE — computeBidAllocation
// ════════════════════════════════════════════════════════════════════

test('Ops: most senior employee wins their 1st choice when capacity allows', () => {
    const app = buildApp(baseState({
        employees: [
            { id: 'E1', name: 'Senior Sam', department: 'DEPT-X', position: 'Controller', seniorityDate: '2010-01-01' },
            { id: 'E2', name: 'Junior Jo',   department: 'DEPT-X', position: 'Controller', seniorityDate: '2020-01-01' },
        ],
        bids: [
            { employeeId: 'E1', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:00:00Z' },
            { employeeId: 'E2', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:01:00Z' },
        ],
        slotCapacities: {
            // The contested slot — capacity 1, both bid on it.
            ...opsSlotKeys('DEPT-X', 'January', 'SA', { capacity: 1, start: '2027-01-01', end: '2027-01-15' }),
            // A second slot so the loser has genuine fallback capacity to be
            // auto-assigned from — a real leave calendar always has more than
            // one slot; a single-slot fixture would make "loses everything"
            // indistinguishable from "correctly lost the contested slot".
            ...opsSlotKeys('DEPT-X', 'February', 'SC', { capacity: 1, start: '2027-02-01', end: '2027-02-15' }),
        },
    }));

    const result = app.computeBidAllocation({ skipUnconfiguredConfirm: true });
    const e1 = result.slotAssignments.find(r => r.employeeId === 'E1');
    const e2AwardedJan = result.slotAssignments.find(r => r.employeeId === 'E2' && r.month === 'January');

    assert.equal(e1.type, 'Bid Awarded', 'the senior employee should win the only slot');
    assert.equal(e2AwardedJan, undefined, 'the junior employee should NOT win the January slot — capacity was 1 and it went to the senior employee');
});

test('Ops: capacity is strictly enforced — a slot with capacity 1 is never awarded to 2 people', () => {
    const app = buildApp(baseState({
        employees: [
            { id: 'E1', name: 'A', department: 'DEPT-X', position: 'Controller', seniorityDate: '2015-01-01' },
            { id: 'E2', name: 'B', department: 'DEPT-X', position: 'Controller', seniorityDate: '2016-01-01' },
            { id: 'E3', name: 'C', department: 'DEPT-X', position: 'Controller', seniorityDate: '2017-01-01' },
        ],
        bids: [
            { employeeId: 'E1', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:00:00Z' },
            { employeeId: 'E2', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:01:00Z' },
            { employeeId: 'E3', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:02:00Z' },
        ],
        slotCapacities: {
            ...opsSlotKeys('DEPT-X', 'January', 'SA', { capacity: 1, start: '2027-01-01', end: '2027-01-15' }),
        },
    }));

    const result = app.computeBidAllocation({ skipUnconfiguredConfirm: true });
    const awardedForThisSlot = result.slotAssignments.filter(
        r => r.type === 'Bid Awarded' && r.month === 'January' && r.slotType === 'slotA'
    );
    assert.equal(awardedForThisSlot.length, 1, 'exactly one person should win a slot with capacity 1, never zero or two+');
});

test('Ops: an employee who submits no bid is auto-assigned, never "Bid Awarded"', () => {
    const app = buildApp(baseState({
        employees: [
            // Recent seniority date (<5 years) — auto-assignment eligibility for
            // Slot A/B vs C/D depends on years of service, so this must match
            // the slot type actually configured below.
            { id: 'E1', name: 'No Bid Nora', department: 'DEPT-X', position: 'Controller', seniorityDate: '2023-01-01' },
        ],
        bids: [], // nobody bid at all
        slotCapacities: {
            ...opsSlotKeys('DEPT-X', 'January', 'SA', { capacity: 2, start: '2027-01-01', end: '2027-01-15' }),
        },
    }));

    const result = app.computeBidAllocation({ skipUnconfiguredConfirm: true });
    const own = result.slotAssignments.filter(r => r.employeeId === 'E1');
    assert.ok(own.length > 0, 'should still receive a leftover assignment');
    assert.ok(own.every(r => r.type === 'Auto-Assigned'), 'every assignment for a non-bidder must be Auto-Assigned, never Bid Awarded');
});

test('Ops: a lost 1st choice correctly falls through to the 2nd choice bid', () => {
    const app = buildApp(baseState({
        employees: [
            { id: 'E1', name: 'Senior Sam', department: 'DEPT-X', position: 'Controller', seniorityDate: '2010-01-01' },
            { id: 'E2', name: 'Junior Jo',   department: 'DEPT-X', position: 'Controller', seniorityDate: '2020-01-01' },
        ],
        bids: [
            // Both want January Slot A first; Junior Jo's 2nd choice is February Slot A.
            { employeeId: 'E1', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:00:00Z' },
            { employeeId: 'E2', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:01:00Z' },
            { employeeId: 'E2', slotType: 'slotA', startDate: '2027-02-01', endDate: '2027-02-15', timestamp: '2027-01-01T09:02:00Z' },
        ],
        slotCapacities: {
            ...opsSlotKeys('DEPT-X', 'January',  'SA', { capacity: 1, start: '2027-01-01', end: '2027-01-15' }),
            ...opsSlotKeys('DEPT-X', 'February', 'SA', { capacity: 1, start: '2027-02-01', end: '2027-02-15' }),
        },
    }));

    const result = app.computeBidAllocation({ skipUnconfiguredConfirm: true });
    const jo = result.slotAssignments.filter(r => r.employeeId === 'E2');
    const joFeb = jo.find(r => r.month === 'February');
    assert.ok(joFeb, 'Junior Jo should have an assignment in February');
    assert.equal(joFeb.type, 'Bid Awarded', "Junior Jo's 2nd choice should be honored as a real bid award, not treated as leftover");
});

test('Ops: identical seniority dates still produce a deterministic (repeatable) outcome', () => {
    // This is the scenario a manual "does it look right today" check can't catch:
    // two employees tied on seniority date. There's no business rule dictating who
    // "should" win a tie — what matters is that the SAME input always produces the
    // SAME output. If a future change made the ordering depend on something
    // non-deterministic (object key iteration order, an unstable sort, etc.), this
    // test would start failing intermittently and catch it immediately.
    const makeState = () => baseState({
        employees: [
            { id: 'E1', name: 'Tied A', department: 'DEPT-X', position: 'Controller', seniorityDate: '2015-06-01' },
            { id: 'E2', name: 'Tied B', department: 'DEPT-X', position: 'Controller', seniorityDate: '2015-06-01' },
        ],
        bids: [
            { employeeId: 'E1', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:00:00Z' },
            { employeeId: 'E2', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:01:00Z' },
        ],
        slotCapacities: {
            ...opsSlotKeys('DEPT-X', 'January', 'SA', { capacity: 1, start: '2027-01-01', end: '2027-01-15' }),
        },
    });

    const run1 = buildApp(makeState()).computeBidAllocation({ skipUnconfiguredConfirm: true });
    const run2 = buildApp(makeState()).computeBidAllocation({ skipUnconfiguredConfirm: true });

    const winner1 = run1.slotAssignments.find(r => r.type === 'Bid Awarded')?.employeeId;
    const winner2 = run2.slotAssignments.find(r => r.type === 'Bid Awarded')?.employeeId;

    assert.equal(winner1, winner2, 'the same tied input must produce the same winner every time it is run');
});

test('Ops: a disabled slot is never awarded or auto-assigned, even with staff and bids present', () => {
    const app = buildApp(baseState({
        employees: [
            { id: 'E1', name: 'Solo', department: 'DEPT-X', position: 'Controller', seniorityDate: '2015-01-01' },
        ],
        bids: [
            { employeeId: 'E1', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:00:00Z' },
        ],
        slotCapacities: {
            ...opsSlotKeys('DEPT-X', 'January', 'SA', { enabled: false, capacity: 5, start: '2027-01-01', end: '2027-01-15' }),
        },
    }));

    const result = app.computeBidAllocation({ skipUnconfiguredConfirm: true });
    const jan = result.slotAssignments.filter(r => r.employeeId === 'E1' && r.month === 'January');
    assert.equal(jan.length, 0, 'a disabled slot must never be awarded or auto-assigned from, regardless of configured capacity');
});

// ════════════════════════════════════════════════════════════════════
// MAINTENANCE ENGINE — computeMaintBidAllocation
// Mirrors the Ops tests above, verifying the two engines (which are
// separate implementations, not shared code) actually behave the same way.
// ════════════════════════════════════════════════════════════════════

test('Maintenance: most senior staff member wins their 1st choice when capacity allows', () => {
    const app = buildApp(baseState({
        maintenanceStaffUsers: [
            { id: 'M1', name: 'Senior Fitter', position: 'Fitter', seniorityDate: '2010-01-01' },
            { id: 'M2', name: 'Junior Fitter', position: 'Fitter', seniorityDate: '2020-01-01' },
        ],
        bids: [
            { employeeId: 'M1', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:00:00Z' },
            { employeeId: 'M2', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:01:00Z' },
        ],
        maintSlotCapacities: {
            ...maintSlotKeys('Fitter', 'January', 'SA', { capacity: 1, start: '2027-01-01', end: '2027-01-15' }),
            // Fallback capacity so the loser has somewhere to be auto-assigned —
            // same reasoning as the equivalent Ops test above.
            ...maintSlotKeys('Fitter', 'February', 'SB', { capacity: 1, start: '2027-02-01', end: '2027-02-15' }),
        },
    }));

    const result = app.computeMaintBidAllocation();
    const m1 = result.maintResults.find(r => r.employeeId === 'M1');
    const m2AwardedJan = result.maintResults.find(r => r.employeeId === 'M2' && r.month === 'January');

    assert.equal(m1.type, 'Bid Awarded', 'the senior staff member should win the only slot');
    assert.equal(m2AwardedJan, undefined, 'the junior staff member should NOT win the January slot — capacity was 1 and it went to the senior staff member');
});

test('Maintenance: a staff member with no bid is auto-assigned, never "Bid Awarded"', () => {
    const app = buildApp(baseState({
        maintenanceStaffUsers: [
            { id: 'M1', name: 'No Bid', position: 'Fitter', seniorityDate: '2018-01-01' },
        ],
        bids: [],
        maintSlotCapacities: {
            ...maintSlotKeys('Fitter', 'January', 'SA', { capacity: 2, start: '2027-01-01', end: '2027-01-15' }),
        },
    }));

    const result = app.computeMaintBidAllocation();
    const own = result.maintResults.filter(r => r.employeeId === 'M1');
    assert.ok(own.length > 0, 'should still receive a leftover assignment');
    assert.ok(own.every(r => r.type === 'Auto-Assigned'), 'every assignment for a non-bidder must be Auto-Assigned, never Bid Awarded');
});

test('Maintenance: capacity is strictly enforced — a slot with capacity 1 is never awarded to 2 people', () => {
    const app = buildApp(baseState({
        maintenanceStaffUsers: [
            { id: 'M1', name: 'A', position: 'Fitter', seniorityDate: '2015-01-01' },
            { id: 'M2', name: 'B', position: 'Fitter', seniorityDate: '2016-01-01' },
        ],
        bids: [
            { employeeId: 'M1', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:00:00Z' },
            { employeeId: 'M2', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:01:00Z' },
        ],
        maintSlotCapacities: {
            ...maintSlotKeys('Fitter', 'January', 'SA', { capacity: 1, start: '2027-01-01', end: '2027-01-15' }),
        },
    }));

    const result = app.computeMaintBidAllocation();
    const awarded = result.maintResults.filter(r => r.type === 'Bid Awarded' && r.month === 'January' && r.slotType === 'slotA');
    assert.equal(awarded.length, 1, 'exactly one person should win a slot with capacity 1, never zero or two+');
});

// ════════════════════════════════════════════════════════════════════
// CONSECUTIVE LEAVE PERIOD PREFERENCE (Phase 1)
// ════════════════════════════════════════════════════════════════════

test('Ops: a full consecutive pair (Slot A + Slot B, back-to-back dates) is awarded together when both are available', () => {
    const app = buildApp(baseState({
        employees: [
            { id: 'E1', name: 'Solo', department: 'DEPT-X', position: 'Controller', seniorityDate: '2015-01-01' },
        ],
        bids: [
            // Slot A Jan 1-15, Slot B Jan 16-30 — back-to-back, one continuous period.
            { employeeId: 'E1', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:00:00Z' },
            { employeeId: 'E1', slotType: 'slotB', startDate: '2027-01-16', endDate: '2027-01-30', timestamp: '2027-01-01T09:01:00Z' },
        ],
        slotCapacities: {
            ...opsSlotKeys('DEPT-X', 'January', 'SA', { capacity: 1, start: '2027-01-01', end: '2027-01-15' }),
            ...opsSlotKeys('DEPT-X', 'January', 'SB', { capacity: 1, start: '2027-01-16', end: '2027-01-30' }),
        },
    }));

    const result = app.computeBidAllocation({ skipUnconfiguredConfirm: true });
    const mine = result.slotAssignments.filter(r => r.employeeId === 'E1');
    assert.equal(mine.length, 2, 'should be awarded both halves of the consecutive pair');
    assert.ok(mine.every(r => r.type === 'Bid Awarded'), 'both halves should be real bid awards, not leftover/auto-assign');
});

test('Ops: when 1st choice pair is blocked, the engine skips to the 2nd choice pair rather than taking a lone half', () => {
    const app = buildApp(baseState({
        employees: [
            { id: 'E1', name: 'Senior Sam', department: 'DEPT-X', position: 'Controller', seniorityDate: '2010-01-01' },
            { id: 'E2', name: 'Junior Jo',   department: 'DEPT-X', position: 'Controller', seniorityDate: '2020-01-01' },
        ],
        bids: [
            // Senior Sam only wants January Slot A (blocks Jo's 1st-choice pair).
            { employeeId: 'E1', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T08:00:00Z' },
            // Junior Jo's 1st choice: January A+B pair (A will be lost to Sam).
            { employeeId: 'E2', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:00:00Z' },
            { employeeId: 'E2', slotType: 'slotB', startDate: '2027-01-16', endDate: '2027-01-30', timestamp: '2027-01-01T09:01:00Z' },
            // Junior Jo's 2nd choice: February A+B pair (fully available).
            { employeeId: 'E2', slotType: 'slotA', startDate: '2027-02-01', endDate: '2027-02-15', timestamp: '2027-01-01T09:02:00Z' },
            { employeeId: 'E2', slotType: 'slotB', startDate: '2027-02-16', endDate: '2027-03-02', timestamp: '2027-01-01T09:03:00Z' },
        ],
        slotCapacities: {
            ...opsSlotKeys('DEPT-X', 'January',  'SA', { capacity: 1, start: '2027-01-01', end: '2027-01-15' }),
            ...opsSlotKeys('DEPT-X', 'January',  'SB', { capacity: 1, start: '2027-01-16', end: '2027-01-30' }),
            ...opsSlotKeys('DEPT-X', 'February', 'SA', { capacity: 1, start: '2027-02-01', end: '2027-02-15' }),
            ...opsSlotKeys('DEPT-X', 'February', 'SB', { capacity: 1, start: '2027-02-16', end: '2027-03-02' }),
        },
    }));

    const result = app.computeBidAllocation({ skipUnconfiguredConfirm: true });
    const jo = result.slotAssignments.filter(r => r.employeeId === 'E2');

    assert.equal(jo.length, 2, 'Jo should get a full pair, not a lone leftover half');
    assert.ok(jo.every(r => r.month === 'February'), "Jo's award should come entirely from the 2nd choice (February) pair, not a mix including the blocked January half");
    assert.ok(jo.every(r => r.type === 'Bid Awarded'), 'both halves of the 2nd-choice pair should be real bid awards');

    const joJanuary = jo.find(r => r.month === 'January');
    assert.equal(joJanuary, undefined, 'Jo should NOT hold the lone surviving January Slot B — the engine should have moved on to the full February pair instead');
});

test('Ops: when no full pair is available anywhere, a surviving half of a blocked pair is still awarded via normal fallback', () => {
    const app = buildApp(baseState({
        employees: [
            { id: 'E1', name: 'Senior Sam', department: 'DEPT-X', position: 'Controller', seniorityDate: '2010-01-01' },
            { id: 'E2', name: 'Junior Jo',   department: 'DEPT-X', position: 'Controller', seniorityDate: '2020-01-01' },
        ],
        bids: [
            { employeeId: 'E1', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T08:00:00Z' },
            // Jo's only choice is the January A+B pair — no 2nd choice submitted.
            { employeeId: 'E2', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:00:00Z' },
            { employeeId: 'E2', slotType: 'slotB', startDate: '2027-01-16', endDate: '2027-01-30', timestamp: '2027-01-01T09:01:00Z' },
        ],
        slotCapacities: {
            ...opsSlotKeys('DEPT-X', 'January', 'SA', { capacity: 1, start: '2027-01-01', end: '2027-01-15' }),
            ...opsSlotKeys('DEPT-X', 'January', 'SB', { capacity: 1, start: '2027-01-16', end: '2027-01-30' }),
        },
    }));

    const result = app.computeBidAllocation({ skipUnconfiguredConfirm: true });
    const jo = result.slotAssignments.filter(r => r.employeeId === 'E2');
    const joB = jo.find(r => r.startDate === '2027-01-16');

    assert.ok(joB, 'with no alternative pair available anywhere, Jo should still be awarded the surviving Slot B on its own merits');
    assert.equal(joB.type, 'Bid Awarded', 'the surviving half should be honored as a real bid award via the normal fallback, not treated as leftover');
});

test('Ops: an employee with only ordinary (non-consecutive) bids behaves exactly as before this feature existed', () => {
    // Regression guard: Phase 1 must be a complete no-op when nothing pairs up.
    const app = buildApp(baseState({
        employees: [
            { id: 'E1', name: 'Senior Sam', department: 'DEPT-X', position: 'Controller', seniorityDate: '2010-01-01' },
        ],
        bids: [
            // Two unrelated, non-adjacent slots — nothing here should be treated as a pair.
            { employeeId: 'E1', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:00:00Z' },
            { employeeId: 'E1', slotType: 'slotA', startDate: '2027-05-01', endDate: '2027-05-15', timestamp: '2027-01-01T09:01:00Z' },
        ],
        slotCapacities: {
            ...opsSlotKeys('DEPT-X', 'January', 'SA', { capacity: 1, start: '2027-01-01', end: '2027-01-15' }),
            ...opsSlotKeys('DEPT-X', 'May',     'SA', { capacity: 1, start: '2027-05-01', end: '2027-05-15' }),
        },
    }));

    const result = app.computeBidAllocation({ skipUnconfiguredConfirm: true });
    const mine = result.slotAssignments.filter(r => r.employeeId === 'E1');
    assert.equal(mine.length, 2, 'should still be awarded both of their unrelated bids, same as before this feature existed');
    assert.ok(mine.every(r => r.type === 'Bid Awarded'));
});

test('Maintenance: when 1st choice pair is blocked, the engine skips to the 2nd choice pair (mirrors Ops)', () => {
    const app = buildApp(baseState({
        maintenanceStaffUsers: [
            { id: 'M1', name: 'Senior Fitter', position: 'Fitter', seniorityDate: '2010-01-01' },
            { id: 'M2', name: 'Junior Fitter', position: 'Fitter', seniorityDate: '2020-01-01' },
        ],
        bids: [
            { employeeId: 'M1', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T08:00:00Z' },
            { employeeId: 'M2', slotType: 'slotA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:00:00Z' },
            { employeeId: 'M2', slotType: 'slotB', startDate: '2027-01-16', endDate: '2027-01-30', timestamp: '2027-01-01T09:01:00Z' },
            { employeeId: 'M2', slotType: 'slotA', startDate: '2027-02-01', endDate: '2027-02-15', timestamp: '2027-01-01T09:02:00Z' },
            { employeeId: 'M2', slotType: 'slotB', startDate: '2027-02-16', endDate: '2027-03-02', timestamp: '2027-01-01T09:03:00Z' },
        ],
        maintSlotCapacities: {
            ...maintSlotKeys('Fitter', 'January',  'SA', { capacity: 1, start: '2027-01-01', end: '2027-01-15' }),
            ...maintSlotKeys('Fitter', 'January',  'SB', { capacity: 1, start: '2027-01-16', end: '2027-01-30' }),
            ...maintSlotKeys('Fitter', 'February', 'SA', { capacity: 1, start: '2027-02-01', end: '2027-02-15' }),
            ...maintSlotKeys('Fitter', 'February', 'SB', { capacity: 1, start: '2027-02-16', end: '2027-03-02' }),
        },
    }));

    const result = app.computeMaintBidAllocation();
    const m2 = result.maintResults.filter(r => r.employeeId === 'M2');

    assert.equal(m2.length, 2, 'should get a full pair, not a lone leftover half');
    assert.ok(m2.every(r => r.month === 'February'), 'award should come entirely from the 2nd choice (February) pair');
});

test('Maintenance: a bid whose real dates drift into an earlier calendar month than its stored label still matches its own configured capacity correctly (regression for a real production bug)', () => {
    // Reproduces a real case: an employee's "Block 2" bid has startDate
    // 2027-01-31 (JS reads this as January), but the capacity for "Block 2"
    // is genuinely configured under 'February' (matching the stored bid.month
    // label the employee actually selected). Before the fix, the engine
    // derived the lookup month purely from the raw date (January) instead of
    // trusting bid.month, so it could never find the real February capacity —
    // the bid fell through to auto-assign instead of matching as a real
    // "Bid Awarded", even though the exact slot the employee wanted was
    // genuinely available.
    const app = buildApp(baseState({
        maintenanceStaffUsers: [
            { id: 'M1', name: 'Solo', position: 'Fitter', seniorityDate: '2015-01-01' },
        ],
        bids: [
            {
                employeeId: 'M1', slotType: 'slotA',
                startDate: '2027-01-31', endDate: '2027-02-14', // real dates read as January by Date.getMonth()
                month: 'February', // but this is the label the employee actually selected and saw
                timestamp: '2027-01-01T09:00:00Z',
            },
        ],
        maintSlotCapacities: {
            // Capacity is genuinely configured under 'February', matching bid.month.
            ...maintSlotKeys('Fitter', 'February', 'SA', { capacity: 1, start: '2027-01-31', end: '2027-02-14' }),
        },
    }));

    const result = app.computeMaintBidAllocation();
    const mine = result.maintResults.find(r => r.employeeId === 'M1');

    assert.ok(mine, 'should receive an assignment at all');
    assert.equal(mine.type, 'Bid Awarded', 'should be honored as a real bid award — the employee did bid on this exact, available slot — not fall through to Auto-Assigned');
    assert.equal(mine.month, 'February', 'the displayed month/block label should match what the employee actually selected, not a raw date-derived value');
});

test('Maintenance: a bid with NO month field at all (real-world legacy/imported data) still matches its own configured capacity correctly', () => {
    // This is the actual scenario found in production: bids on real staff had
    // no "month" property whatsoever (not null, not empty — entirely absent
    // as a key), confirmed by inspecting app.state.bids directly. A fix that
    // only prefers bid.month over date-math is a no-op for data like this —
    // it still falls through to the same broken date derivation every time.
    // The real fix has to work without relying on bid.month being present at
    // all: match the bid's actual dates against every configured month's
    // dates for that position+letter, and use whichever month's config
    // exactly matches — the authoritative signal, regardless of any label.
    const app = buildApp(baseState({
        maintenanceStaffUsers: [
            { id: 'M1', name: 'Senior', position: 'MEP-OCC', seniorityDate: '2015-01-01' },
            { id: 'M2', name: 'Third Senior', position: 'MEP-OCC', seniorityDate: '2023-06-18' },
        ],
        bids: [
            // Senior takes the January pair entirely, so M2's January pair is blocked
            // and Phase 1 must fall through to trying the February pair choice.
            { employeeId: 'M1', slotType: 'SA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T08:00:00Z' },
            { employeeId: 'M1', slotType: 'SB', startDate: '2027-01-16', endDate: '2027-01-30', timestamp: '2027-01-01T08:01:00Z' },
            // M2's bids — note: no `month` field at all, exactly like the real data found.
            { employeeId: 'M2', slotType: 'SA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:00:00Z' },
            { employeeId: 'M2', slotType: 'SB', startDate: '2027-01-16', endDate: '2027-01-30', timestamp: '2027-01-01T09:01:00Z' },
            { employeeId: 'M2', slotType: 'SA', startDate: '2027-01-31', endDate: '2027-02-14', timestamp: '2027-01-01T09:02:00Z' },
            { employeeId: 'M2', slotType: 'SB', startDate: '2027-02-15', endDate: '2027-03-01', timestamp: '2027-01-01T09:03:00Z' },
        ],
        maintSlotCapacities: {
            ...maintSlotKeys('MEP-OCC', 'January',  'SA', { capacity: 1, start: '2027-01-01', end: '2027-01-15' }),
            ...maintSlotKeys('MEP-OCC', 'January',  'SB', { capacity: 1, start: '2027-01-16', end: '2027-01-30' }),
            // "Block 2" capacity is configured under 'February', even though the
            // Slot A half of it (2027-01-31) reads as January by raw date math.
            ...maintSlotKeys('MEP-OCC', 'February', 'SA', { capacity: 2, start: '2027-01-31', end: '2027-02-14' }),
            ...maintSlotKeys('MEP-OCC', 'February', 'SB', { capacity: 2, start: '2027-02-15', end: '2027-03-01' }),
        },
    }));

    const result = app.computeMaintBidAllocation();
    const m2 = result.maintResults.filter(r => r.employeeId === 'M2');

    assert.equal(m2.length, 2, 'M2 should get a full pair from their 2nd choice');
    assert.ok(m2.every(r => r.type === 'Bid Awarded'), 'both halves should be real bid awards, not one Bid Awarded + one Auto-Assigned');
    assert.ok(m2.every(r => r.month === 'February'), 'both should be correctly attributed to February, matching the real configured capacity bucket, not January from raw date math');
});

test('Ops: a bid with NO month field at all (confirmed present in real production data) still matches its own configured capacity correctly', () => {
    // Same class of real bug as the Maintenance case above, confirmed present
    // in Ops's own real bid data too (checked via the browser console —
    // app.state.bids.filter(b => !b.month) returned real results). A slot
    // whose real dates start in one calendar month but is genuinely
    // configured under the next month must still be found correctly.
    const app = buildApp(baseState({
        employees: [
            { id: 'E1', name: 'Senior', department: 'DEPT-X', position: 'Controller', seniorityDate: '2015-01-01' },
            { id: 'E2', name: 'Junior', department: 'DEPT-X', position: 'Controller', seniorityDate: '2023-06-18' },
        ],
        bids: [
            { employeeId: 'E1', slotType: 'SA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T08:00:00Z' },
            { employeeId: 'E1', slotType: 'SB', startDate: '2027-01-16', endDate: '2027-01-30', timestamp: '2027-01-01T08:01:00Z' },
            // No `month` field on any of these — matches real production data exactly.
            { employeeId: 'E2', slotType: 'SA', startDate: '2027-01-01', endDate: '2027-01-15', timestamp: '2027-01-01T09:00:00Z' },
            { employeeId: 'E2', slotType: 'SB', startDate: '2027-01-16', endDate: '2027-01-30', timestamp: '2027-01-01T09:01:00Z' },
            { employeeId: 'E2', slotType: 'SA', startDate: '2027-01-31', endDate: '2027-02-14', timestamp: '2027-01-01T09:02:00Z' },
            { employeeId: 'E2', slotType: 'SB', startDate: '2027-02-15', endDate: '2027-03-01', timestamp: '2027-01-01T09:03:00Z' },
        ],
        slotCapacities: {
            ...opsSlotKeys('DEPT-X', 'January',  'SA', { capacity: 1, start: '2027-01-01', end: '2027-01-15' }),
            ...opsSlotKeys('DEPT-X', 'January',  'SB', { capacity: 1, start: '2027-01-16', end: '2027-01-30' }),
            ...opsSlotKeys('DEPT-X', 'February', 'SA', { capacity: 2, start: '2027-01-31', end: '2027-02-14' }),
            ...opsSlotKeys('DEPT-X', 'February', 'SB', { capacity: 2, start: '2027-02-15', end: '2027-03-01' }),
        },
    }));

    const result = app.computeBidAllocation({ skipUnconfiguredConfirm: true });
    const e2 = result.slotAssignments.filter(r => r.employeeId === 'E2');

    assert.equal(e2.length, 2, 'should get a full pair from their 2nd choice');
    assert.ok(e2.every(r => r.type === 'Bid Awarded'), 'both halves should be real bid awards, not one Bid Awarded + one Auto-Assigned');
    assert.ok(e2.every(r => r.month === 'February'), 'both should be correctly attributed to February, matching the real configured capacity bucket, not January from raw date math');
});
