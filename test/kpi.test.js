// test/kpi.test.js
//
// Regression tests for the KPI subsystem's pure logic (api-kpi.js).
// Stage 1 only has one genuinely pure, testable function — kpiStatus() —
// everything else in this file is Supabase I/O, which isn't unit-tested
// the same way (matching how api-swaptrading.js's own CRUD functions
// aren't directly tested either, only _checkSwapCompliance is).
//
// Run with: node --test test/

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, baseState } = require('./harness');

function buildKpiApp(stateOverrides = {}) {
    return buildApp(baseState(stateOverrides), ['utils.js', 'api-kpi.js']);
}

test('on_target when actual meets or beats target, higher_is_better', () => {
    const app = buildKpiApp();
    assert.equal(app.kpiStatus(95, 90, 'higher_is_better'), 'on_target');
    assert.equal(app.kpiStatus(90, 90, 'higher_is_better'), 'on_target', 'exactly meeting the target counts as on target');
});

test('below_target when actual falls short, higher_is_better', () => {
    const app = buildKpiApp();
    assert.equal(app.kpiStatus(85, 90, 'higher_is_better'), 'below_target');
});

test('on_target when actual meets or beats target, lower_is_better (e.g. incident counts)', () => {
    const app = buildKpiApp();
    assert.equal(app.kpiStatus(2, 5, 'lower_is_better'), 'on_target');
    assert.equal(app.kpiStatus(5, 5, 'lower_is_better'), 'on_target', 'exactly meeting the target counts as on target');
});

test('below_target when actual exceeds target, lower_is_better', () => {
    const app = buildKpiApp();
    assert.equal(app.kpiStatus(8, 5, 'lower_is_better'), 'below_target');
});

test('the SAME actual/target pair gives opposite results depending on direction', () => {
    // This is the whole point of tracking direction at all — without it,
    // a KPI card can't correctly color-code status.
    const app = buildKpiApp();
    assert.equal(app.kpiStatus(10, 8, 'higher_is_better'), 'on_target', '10 beats a target of 8 when higher is better');
    assert.equal(app.kpiStatus(10, 8, 'lower_is_better'), 'below_target', '10 misses a target of 8 when lower is better');
});

test('no_data when actual or target is missing', () => {
    const app = buildKpiApp();
    assert.equal(app.kpiStatus(null, 90, 'higher_is_better'), 'no_data');
    assert.equal(app.kpiStatus(90, null, 'higher_is_better'), 'no_data');
    assert.equal(app.kpiStatus(undefined, undefined, 'higher_is_better'), 'no_data');
});

test('no_data when actual or target is not a valid number', () => {
    const app = buildKpiApp();
    assert.equal(app.kpiStatus('not a number', 90, 'higher_is_better'), 'no_data');
});

test('defaults to higher_is_better behavior when direction is missing/unrecognized', () => {
    const app = buildKpiApp();
    assert.equal(app.kpiStatus(95, 90, undefined), 'on_target');
    assert.equal(app.kpiStatus(85, 90, 'some_typo'), 'below_target');
});

// ════════════════════════════════════════════════════════════════════
// kpiPeriodOptions — generates valid period labels for a given cadence.
// Requires views-kpi.js loaded alongside api-kpi.js.
// ════════════════════════════════════════════════════════════════════

function buildKpiViewsApp(stateOverrides = {}) {
    return buildApp(baseState(stateOverrides), ['utils.js', 'api-kpi.js', 'views-kpi.js']);
}

test('kpiPeriodOptions generates 12 monthly labels for a year', () => {
    const app = buildKpiViewsApp();
    const options = app.kpiPeriodOptions('monthly', 2027);
    assert.equal(options.length, 12);
    assert.equal(options[0].value, '2027-01');
    assert.equal(options[0].label, 'January 2027');
    assert.equal(options[11].value, '2027-12');
    assert.equal(options[11].label, 'December 2027');
});

test('kpiPeriodOptions generates 4 quarterly labels for a year', () => {
    const app = buildKpiViewsApp();
    const options = app.kpiPeriodOptions('quarterly', 2027);
    assert.equal(options.length, 4);
    const values = options.map(o => o.value);
    assert.equal(values[0], '2027-Q1');
    assert.equal(values[1], '2027-Q2');
    assert.equal(values[2], '2027-Q3');
    assert.equal(values[3], '2027-Q4');
});

test('kpiPeriodOptions generates a single yearly label', () => {
    const app = buildKpiViewsApp();
    const options = app.kpiPeriodOptions('yearly', 2027);
    assert.equal(options.length, 1);
    assert.equal(options[0].value, '2027');
    assert.equal(options[0].label, '2027');
});

test('kpiPeriodOptions returns an empty list for an unrecognized period type', () => {
    const app = buildKpiViewsApp();
    const options = app.kpiPeriodOptions('fortnightly', 2027);
    assert.equal(options.length, 0);
});

// ════════════════════════════════════════════════════════════════════
// _csDirectors — identifies Corporate Staff records whose role contains
// "director", case-insensitive.
// ════════════════════════════════════════════════════════════════════

test('_csDirectors matches roles containing "director", case-insensitive', () => {
    const app = buildKpiApp({
        corporateStaffUsers: [
            { id: 'C1', name: 'Alice', role: 'Operations Director' },
            { id: 'C2', name: 'Bob', role: 'OCC Duty Manager' },
            { id: 'C3', name: 'Cara', role: 'safety director' },
            { id: 'C4', name: 'Dan', role: 'Director of Engineering' },
        ],
    });
    const directors = app._csDirectors();
    const ids = directors.map(d => d.id);
    assert.equal(directors.length, 3);
    assert.ok(ids.includes('C1'));
    assert.ok(ids.includes('C3'));
    assert.ok(ids.includes('C4'));
    assert.ok(!ids.includes('C2'), 'a non-director role must not match');
});

test('_csDirectors returns an empty list when nobody has a matching role', () => {
    const app = buildKpiApp({ corporateStaffUsers: [{ id: 'C1', name: 'Alice', role: 'OCC Duty Manager' }] });
    assert.equal(app._csDirectors().length, 0);
});

// ════════════════════════════════════════════════════════════════════
// _kpiValidPassword — validates a login attempt, handling the
// linked_login case (check against the live Corporate Staff password,
// not a separately-stored one).
// ════════════════════════════════════════════════════════════════════

test('a normal (non-linked) KPI user is validated against their own stored password', () => {
    const app = buildKpiApp();
    const user = { id: 'K1', password: 'secret123', linked_login: false };
    assert.equal(app._kpiValidPassword(user, 'secret123'), true);
    assert.equal(app._kpiValidPassword(user, 'wrong'), false);
});

test('a linked KPI user is validated against their CURRENT Corporate Staff password, not their own', () => {
    const app = buildKpiApp({
        corporateStaffUsers: [{ id: 'C1', name: 'Alice', role: 'Operations Director', password: 'currentCsPassword' }],
    });
    const user = { id: 'C1', password: '(linked to Corporate Staff)', linked_login: true };
    assert.equal(app._kpiValidPassword(user, 'currentCsPassword'), true, 'must accept the live Corporate Staff password');
    assert.equal(app._kpiValidPassword(user, '(linked to Corporate Staff)'), false, 'must NOT accept the stored placeholder as if it were a real password');
});

test('a linked KPI user whose Corporate Staff record has since been removed cannot log in', () => {
    const app = buildKpiApp({ corporateStaffUsers: [] });
    const user = { id: 'C1', password: '(linked to Corporate Staff)', linked_login: true };
    assert.equal(app._kpiValidPassword(user, 'anything'), false);
});

test('_kpiValidPassword returns false for a missing user rather than throwing', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiValidPassword(null, 'anything'), false);
    assert.equal(app._kpiValidPassword(undefined, 'anything'), false);
});

