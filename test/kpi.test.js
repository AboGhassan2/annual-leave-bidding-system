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

// ════════════════════════════════════════════════════════════════════
// _deriveDirectorateNameFromRole — used so a director's directorate
// automatically matches the department they're actually appointed over.
// ════════════════════════════════════════════════════════════════════

test('_deriveDirectorateNameFromRole strips a trailing "Director"', () => {
    const app = buildKpiApp();
    assert.equal(app._deriveDirectorateNameFromRole('HR Director'), 'HR');
    assert.equal(app._deriveDirectorateNameFromRole('Operations Director'), 'Operations');
});

test('_deriveDirectorateNameFromRole strips a leading "Director of"', () => {
    const app = buildKpiApp();
    assert.equal(app._deriveDirectorateNameFromRole('Director of Engineering'), 'Engineering');
});

test('_deriveDirectorateNameFromRole is case-insensitive and preserves the remaining text\'s own casing', () => {
    const app = buildKpiApp();
    assert.equal(app._deriveDirectorateNameFromRole('safety director'), 'safety');
});

test('_deriveDirectorateNameFromRole falls back to the original role text if stripping leaves nothing', () => {
    const app = buildKpiApp();
    assert.equal(app._deriveDirectorateNameFromRole('Director'), 'Director');
});

test('_deriveDirectorateNameFromRole returns empty string for empty/missing input', () => {
    const app = buildKpiApp();
    assert.equal(app._deriveDirectorateNameFromRole(''), '');
    assert.equal(app._deriveDirectorateNameFromRole(null), '');
    assert.equal(app._deriveDirectorateNameFromRole(undefined), '');
});

// ════════════════════════════════════════════════════════════════════
// _computeKpiResultFields — achievement % and status, snapshotted at
// entry time. Achievement direction is the nuanced part: beating a
// lower_is_better target should still read as an achievement ABOVE 100%,
// not below it, which requires inverting the ratio for that direction.
// ════════════════════════════════════════════════════════════════════

test('higher_is_better: achievement is actual/target*100, can exceed 100% when over-performing', () => {
    const app = buildKpiApp();
    const kpiDef = { target_value: 90, direction: 'higher_is_better' };
    const result = app._computeKpiResultFields(kpiDef, 99);
    assert.equal(result.status, 'on_target');
    assert.equal(result.achievement, 110); // 99/90*100
});

test('higher_is_better: falling short of target gives achievement below 100%', () => {
    const app = buildKpiApp();
    const kpiDef = { target_value: 90, direction: 'higher_is_better' };
    const result = app._computeKpiResultFields(kpiDef, 72);
    assert.equal(result.status, 'below_target');
    assert.equal(result.achievement, 80); // 72/90*100
});

test('lower_is_better: beating the target (actual below target) gives achievement ABOVE 100%, not below', () => {
    // This is the whole reason the ratio must be inverted for this
    // direction — e.g. 2 incidents against a target of 5 is clearly a
    // GOOD result and must read as an achievement over 100%, not 40%.
    const app = buildKpiApp();
    const kpiDef = { target_value: 5, direction: 'lower_is_better' };
    const result = app._computeKpiResultFields(kpiDef, 2);
    assert.equal(result.status, 'on_target');
    assert.equal(result.achievement, 250); // 5/2*100, inverted
});

test('lower_is_better: missing the target (actual above target) gives achievement below 100%', () => {
    const app = buildKpiApp();
    const kpiDef = { target_value: 5, direction: 'lower_is_better' };
    const result = app._computeKpiResultFields(kpiDef, 10);
    assert.equal(result.status, 'below_target');
    assert.equal(result.achievement, 50); // 5/10*100, inverted
});

test('the SAME actual/target pair gives opposite status AND inverted achievement depending on direction', () => {
    const app = buildKpiApp();
    const higher = app._computeKpiResultFields({ target_value: 8, direction: 'higher_is_better' }, 10);
    const lower = app._computeKpiResultFields({ target_value: 8, direction: 'lower_is_better' }, 10);
    assert.equal(higher.status, 'on_target');
    assert.equal(lower.status, 'below_target');
    assert.ok(higher.achievement > 100);
    assert.ok(lower.achievement < 100);
});

test('returns no_data with null achievement when actual or target is missing', () => {
    const app = buildKpiApp();
    const result = app._computeKpiResultFields({ target_value: null, direction: 'higher_is_better' }, 50);
    assert.equal(result.status, 'no_data');
    assert.equal(result.achievement, null);
});

test('handles a zero target without throwing (division by zero)', () => {
    const app = buildKpiApp();
    const result = app._computeKpiResultFields({ target_value: 0, direction: 'higher_is_better' }, 5);
    assert.equal(result.achievement, null, 'achievement is undefined for a zero target, not Infinity or NaN');
});

test('handles a zero actual value for lower_is_better without throwing (division by zero)', () => {
    const app = buildKpiApp();
    const result = app._computeKpiResultFields({ target_value: 5, direction: 'lower_is_better' }, 0);
    assert.equal(result.achievement, null, 'achievement is undefined when actual is zero for lower_is_better, not Infinity');
});

// ════════════════════════════════════════════════════════════════════
// Stage 4 — Director dashboard pure helpers
// ════════════════════════════════════════════════════════════════════

function buildKpiDashboardApp(stateOverrides = {}) {
    return buildApp(baseState(stateOverrides), ['utils.js', 'api-kpi.js']);
}

test('_kpiEffectiveDirectorateId prefers the department link over the KPI\'s own directorate_id', () => {
    const app = buildKpiDashboardApp({
        kpiDirectorateDepartments: [{ id: 10, directorate_id: 2, department_name: 'HR' }],
    });
    const kpi = { department_id: 10, directorate_id: 1 }; // deliberately mismatched, department_id should win
    assert.equal(app._kpiEffectiveDirectorateId(kpi), 2);
});

test('_kpiEffectiveDirectorateId falls back to the KPI\'s own directorate_id when no department is linked', () => {
    const app = buildKpiDashboardApp({ kpiDirectorateDepartments: [] });
    const kpi = { department_id: null, directorate_id: 5 };
    assert.equal(app._kpiEffectiveDirectorateId(kpi), 5);
});

test('_kpisForDirectorate excludes inactive KPIs', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [
            { id: 1, directorate_id: 1, is_active: true },
            { id: 2, directorate_id: 1, is_active: false },
            { id: 3, directorate_id: 2, is_active: true },
        ],
    });
    const kpis = app._kpisForDirectorate(1);
    assert.equal(kpis.length, 1);
    assert.equal(kpis[0].id, 1);
});

test('_kpiDashboardCards counts achieved, below target, and pending correctly', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [
            { id: 1, directorate_id: 1, is_active: true, direction: 'higher_is_better' },
            { id: 2, directorate_id: 1, is_active: true, direction: 'higher_is_better' },
            { id: 3, directorate_id: 1, is_active: true, direction: 'higher_is_better' }, // no result -> pending
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, status: 'on_target', entered_at: '2027-01-01' },
            { kpi_definition_id: 2, year: 2027, status: 'below_target', entered_at: '2027-01-01' },
        ],
    });
    const cards = app._kpiDashboardCards(1, 2027);
    assert.equal(cards.total, 3);
    assert.equal(cards.achieved, 1);
    assert.equal(cards.belowTarget, 1);
    assert.equal(cards.pending, 1);
});

test('_kpiDashboardCards uses only the MOST RECENT result per KPI, not an average or the first one', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, direction: 'higher_is_better' }],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, status: 'below_target', entered_at: '2027-01-01' },
            { kpi_definition_id: 1, year: 2027, status: 'on_target', entered_at: '2027-06-01' }, // most recent - should win
        ],
    });
    const cards = app._kpiDashboardCards(1, 2027);
    assert.equal(cards.achieved, 1);
    assert.equal(cards.belowTarget, 0);
});

test('_kpiDepartmentRanking sorts departments by average achievement, descending', () => {
    const app = buildKpiDashboardApp({
        kpiDirectorateDepartments: [
            { id: 10, directorate_id: 1, department_name: 'HR' },
            { id: 11, directorate_id: 1, department_name: 'Finance' },
        ],
        kpiDefinitions: [
            { id: 1, department_id: 10, is_active: true },
            { id: 2, department_id: 11, is_active: true },
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, achievement: 70, entered_at: '2027-01-01' },
            { kpi_definition_id: 2, year: 2027, achievement: 95, entered_at: '2027-01-01' },
        ],
    });
    const ranking = app._kpiDepartmentRanking(1, 2027);
    assert.equal(ranking.length, 2);
    assert.equal(ranking[0].departmentName, 'Finance', 'Finance (95%) should rank above HR (70%)');
    assert.equal(ranking[1].departmentName, 'HR');
});

test('_kpiDepartmentRanking excludes departments with no results yet, rather than showing a misleading 0%', () => {
    const app = buildKpiDashboardApp({
        kpiDirectorateDepartments: [{ id: 10, directorate_id: 1, department_name: 'HR' }],
        kpiDefinitions: [{ id: 1, department_id: 10, is_active: true }],
        kpiResults: [],
    });
    const ranking = app._kpiDepartmentRanking(1, 2027);
    assert.equal(ranking.length, 0);
});

test('_kpiRankedList sorts KPIs by achievement descending, for top/bottom-N slicing', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [
            { id: 1, directorate_id: 1, is_active: true, name: 'Low KPI' },
            { id: 2, directorate_id: 1, is_active: true, name: 'High KPI' },
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, achievement: 40, entered_at: '2027-01-01' },
            { kpi_definition_id: 2, year: 2027, achievement: 130, entered_at: '2027-01-01' },
        ],
    });
    const ranked = app._kpiRankedList(1, 2027);
    assert.equal(ranked[0].name, 'High KPI');
    assert.equal(ranked[1].name, 'Low KPI');
});

test('_kpiPerformanceByPeriod averages achievement across KPIs sharing the same period, only for the matching cadence', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [
            { id: 1, directorate_id: 1, is_active: true, period_type: 'monthly' },
            { id: 2, directorate_id: 1, is_active: true, period_type: 'monthly' },
            { id: 3, directorate_id: 1, is_active: true, period_type: 'quarterly' }, // different cadence, must be excluded
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_value: '01', achievement: 80 },
            { kpi_definition_id: 2, year: 2027, period_value: '01', achievement: 100 },
            { kpi_definition_id: 3, year: 2027, period_value: 'Q1', achievement: 200 },
        ],
    });
    const monthly = app._kpiPerformanceByPeriod(1, 2027, 'monthly');
    assert.equal(monthly.length, 1);
    assert.equal(monthly[0].period, '01');
    assert.equal(monthly[0].avgAchievement, 90, 'average of 80 and 100, excluding the quarterly KPI entirely');
});

test('_kpiPerformanceByPeriod sorts periods chronologically', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, period_type: 'monthly' }],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_value: '03', achievement: 50 },
            { kpi_definition_id: 1, year: 2027, period_value: '01', achievement: 60 },
        ],
    });
    const monthly = app._kpiPerformanceByPeriod(1, 2027, 'monthly');
    assert.equal(monthly[0].period, '01');
    assert.equal(monthly[1].period, '03');
});

