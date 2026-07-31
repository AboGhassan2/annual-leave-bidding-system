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
// _kpiLoginAllowed — enforces that each login entry point (Planner
// modal vs Director card) only accepts its own role, even for a real
// account with the correct password.
// ════════════════════════════════════════════════════════════════════

test('allows login when password is correct AND role matches the entry point used', () => {
    const app = buildKpiApp();
    const user = { id: 'K1', password: 'secret', role: 'kpi_planner', linked_login: false };
    const result = app._kpiLoginAllowed(user, 'secret', 'kpi_planner');
    assert.equal(result.ok, true);
});

test('rejects a real Planner account logging in through the Director entry point, even with the correct password', () => {
    // This is the exact scenario the user found: kpiplanner1's real
    // credentials, entered into the Director card, must be rejected
    // outright — not silently logged in and routed to the Planner screen
    // anyway.
    const app = buildKpiApp();
    const user = { id: 'kpiplanner1', password: 'changeme123', role: 'kpi_planner', linked_login: false };
    const result = app._kpiLoginAllowed(user, 'changeme123', 'kpi_director');
    assert.equal(result.ok, false);
    assert.ok(result.reason.includes('KPI Planner'), 'should clearly say what this account actually is');
});

test('rejects a real Director account logging in through the Planner entry point', () => {
    const app = buildKpiApp();
    const user = { id: 'K2', password: 'secret', role: 'kpi_director', linked_login: false };
    const result = app._kpiLoginAllowed(user, 'secret', 'kpi_planner');
    assert.equal(result.ok, false);
    assert.ok(result.reason.includes('KPI Executive Director'));
});

test('rejects an incorrect password before even checking role', () => {
    const app = buildKpiApp();
    const user = { id: 'K1', password: 'secret', role: 'kpi_planner', linked_login: false };
    const result = app._kpiLoginAllowed(user, 'wrongpassword', 'kpi_planner');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'Incorrect password.');
});

test('rejects a missing user with a clear reason rather than throwing', () => {
    const app = buildKpiApp();
    const result = app._kpiLoginAllowed(null, 'anything', 'kpi_planner');
    assert.equal(result.ok, false);
    assert.ok(result.reason.length > 0);
});

test('role enforcement also applies correctly to linked (Corporate Staff) Director accounts', () => {
    const app = buildKpiApp({
        corporateStaffUsers: [{ id: 'C1', name: 'Alice', role: 'Operations Director', password: 'csPassword' }],
    });
    const user = { id: 'C1', password: '(linked to Corporate Staff)', role: 'kpi_director', linked_login: true };
    const wrongEntry = app._kpiLoginAllowed(user, 'csPassword', 'kpi_planner');
    assert.equal(wrongEntry.ok, false);
    const rightEntry = app._kpiLoginAllowed(user, 'csPassword', 'kpi_director');
    assert.equal(rightEntry.ok, true);
});

// ════════════════════════════════════════════════════════════════════
// _kpiFindLinkedSourceUser / linked login across every roster, not just
// Corporate Staff — reproduces the real gap found: a KPI user manually
// linked to someone on the Golden Command roster couldn't log in at all,
// because the check only ever searched Corporate Staff.
// ════════════════════════════════════════════════════════════════════

test('_kpiFindLinkedSourceUser finds a match on the Golden Command roster, not just Corporate Staff', () => {
    const app = buildKpiApp({
        corporateStaffUsers: [],
        goldenCommandUsers: [{ id: 'G1', name: 'Bob', password: 'gcPassword' }],
    });
    const found = app._kpiFindLinkedSourceUser('G1');
    assert.ok(found, 'must find the person even though they are not in Corporate Staff');
    assert.equal(found.password, 'gcPassword');
});

test('a linked KPI user whose source is Golden Command (not Corporate Staff) can log in with their GC password', () => {
    // This is the exact scenario reported: a manually-added kpi_users
    // record for someone who only exists on the Golden Command roster.
    const app = buildKpiApp({
        corporateStaffUsers: [],
        goldenCommandUsers: [{ id: 'G1', name: 'Bob', password: 'gcPassword' }],
    });
    const user = { id: 'G1', password: '(linked to Corporate Staff)', linked_login: true };
    assert.equal(app._kpiValidPassword(user, 'gcPassword'), true);
    assert.equal(app._kpiValidPassword(user, 'wrongpassword'), false);
});

test('_kpiFindLinkedSourceUser also finds a match on Employees and Maintenance rosters', () => {
    const app = buildKpiApp({
        corporateStaffUsers: [],
        goldenCommandUsers: [],
        employees: [{ id: 'E1', name: 'Cara', password: 'empPassword' }],
        maintenanceStaffUsers: [{ id: 'M1', name: 'Dan', password: 'maintPassword' }],
    });
    assert.equal(app._kpiFindLinkedSourceUser('E1').password, 'empPassword');
    assert.equal(app._kpiFindLinkedSourceUser('M1').password, 'maintPassword');
});

test('_kpiFindLinkedSourceUser returns null when the ID exists on no roster at all', () => {
    const app = buildKpiApp({ corporateStaffUsers: [], goldenCommandUsers: [], employees: [], maintenanceStaffUsers: [] });
    assert.equal(app._kpiFindLinkedSourceUser('nobody'), null);
});

test('linked login still fails correctly (not throws) when the source has since been removed from every roster', () => {
    const app = buildKpiApp({ corporateStaffUsers: [], goldenCommandUsers: [], employees: [], maintenanceStaffUsers: [] });
    const user = { id: 'gone', password: '(linked to Corporate Staff)', linked_login: true };
    assert.equal(app._kpiValidPassword(user, 'anything'), false);
});

// ════════════════════════════════════════════════════════════════════
// Stage 5 — the 3 new fine-grained roles' permission and scoping logic
// ════════════════════════════════════════════════════════════════════

test('_kpiCanEnterResults: planner, department_manager, and data_entry can; director and viewer cannot', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiCanEnterResults('kpi_planner'), true);
    assert.equal(app._kpiCanEnterResults('department_manager'), true);
    assert.equal(app._kpiCanEnterResults('data_entry'), true);
    assert.equal(app._kpiCanEnterResults('kpi_director'), false);
    assert.equal(app._kpiCanEnterResults('viewer'), false);
});

test('_kpiCanApproveResults: only planner and department_manager can — NOT data_entry', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiCanApproveResults('kpi_planner'), true);
    assert.equal(app._kpiCanApproveResults('department_manager'), true);
    assert.equal(app._kpiCanApproveResults('data_entry'), false, 'Data Entry can enter results but must never be able to approve them');
    assert.equal(app._kpiCanApproveResults('kpi_director'), false);
    assert.equal(app._kpiCanApproveResults('viewer'), false);
});

test('_kpiUserScope: kpi_planner is unrestricted, sees everything', () => {
    const app = buildKpiApp();
    const scope = app._kpiUserScope({ role: 'kpi_planner' });
    assert.equal(scope.unrestricted, true);
});

test('_kpiUserScope: department_manager and data_entry are scoped to their ONE department, narrower than a directorate', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [{ id: 10, directorate_id: 1, department_name: 'HR' }],
    });
    const deptManagerScope = app._kpiUserScope({ role: 'department_manager', department_id: 10 });
    assert.equal(deptManagerScope.departmentId, 10);
    assert.equal(deptManagerScope.directorateId, 1, 'directorate is still resolved, for context/breadcrumbs, but departmentId is the real restriction');
    assert.equal(deptManagerScope.unrestricted, false);

    const dataEntryScope = app._kpiUserScope({ role: 'data_entry', department_id: 10 });
    assert.equal(dataEntryScope.departmentId, 10);
});

test('_kpiUserScope: kpi_director and viewer are scoped to the WHOLE directorate, no department restriction', () => {
    const app = buildKpiApp();
    const directorScope = app._kpiUserScope({ role: 'kpi_director', directorate_id: 5 });
    assert.equal(directorScope.directorateId, 5);
    assert.equal(directorScope.departmentId, null, 'no department-level restriction for this role — the whole directorate is visible');

    const viewerScope = app._kpiUserScope({ role: 'viewer', directorate_id: 5 });
    assert.equal(viewerScope.directorateId, 5);
    assert.equal(viewerScope.departmentId, null);
});

test('_kpiUserScope handles a missing user without throwing', () => {
    const app = buildKpiApp();
    const scope = app._kpiUserScope(null);
    assert.equal(scope.unrestricted, false);
    assert.equal(scope.directorateId, null);
});

test('_kpisForUserScope: a department-scoped user sees ONLY their own department\'s KPIs, not the whole directorate\'s', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [
            { id: 10, directorate_id: 1, department_name: 'HR' },
            { id: 11, directorate_id: 1, department_name: 'Finance' },
        ],
        kpiDefinitions: [
            { id: 1, department_id: 10, is_active: true, name: 'HR KPI' },
            { id: 2, department_id: 11, is_active: true, name: 'Finance KPI' },
        ],
    });
    const kpis = app._kpisForUserScope({ role: 'department_manager', department_id: 10 });
    assert.equal(kpis.length, 1);
    assert.equal(kpis[0].name, 'HR KPI');
});

test('_kpisForUserScope: a directorate-scoped user (director/viewer) sees ALL departments\' KPIs under their directorate', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [
            { id: 10, directorate_id: 1, department_name: 'HR' },
            { id: 11, directorate_id: 1, department_name: 'Finance' },
        ],
        kpiDefinitions: [
            { id: 1, department_id: 10, directorate_id: 1, is_active: true, name: 'HR KPI' },
            { id: 2, department_id: 11, directorate_id: 1, is_active: true, name: 'Finance KPI' },
        ],
    });
    const kpis = app._kpisForUserScope({ role: 'kpi_director', directorate_id: 1 });
    assert.equal(kpis.length, 2);
});

test('_kpisForUserScope: kpi_planner (unrestricted) sees every active KPI regardless of directorate', () => {
    const app = buildKpiApp({
        kpiDefinitions: [
            { id: 1, directorate_id: 1, is_active: true },
            { id: 2, directorate_id: 2, is_active: true },
            { id: 3, directorate_id: 1, is_active: false },
        ],
    });
    const kpis = app._kpisForUserScope({ role: 'kpi_planner' });
    assert.equal(kpis.length, 2, 'sees KPIs across both directorates, but still excludes inactive ones');
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

test('_kpiStandardLines returns exactly the 4 fixed operational lines', () => {
    const app = buildKpiApp();
    const lines = app._kpiStandardLines();
    assert.equal(lines.length, 4);
    assert.equal(lines[0], 'L3');
    assert.equal(lines[1], 'L4');
    assert.equal(lines[2], 'L5');
    assert.equal(lines[3], 'L6');
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
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 80 },
            { kpi_definition_id: 2, year: 2027, period_type: 'monthly', period_value: '01', achievement: 100 },
            { kpi_definition_id: 3, year: 2027, period_type: 'quarterly', period_value: 'Q1', achievement: 200 },
        ],
    });
    const monthly = app._kpiPerformanceByPeriod(1, 2027, 'monthly');
    assert.equal(monthly.length, 1);
    assert.equal(monthly[0].period, '01');
    assert.equal(monthly[0].avgAchievement, 90, 'average of 80 and 100, excluding the quarterly KPI entirely');
});

test('_kpiPerformanceByPeriod excludes a result whose OWN period_type no longer matches its KPI\'s current cadence', () => {
    // Reproduces the real bug found: a KPI's cadence gets edited by the
    // planner after some results already exist under the OLD cadence.
    // Those old rows keep the same kpi_definition_id but a stale
    // period_type — they must never bleed into the new cadence's chart.
    const app = buildKpiDashboardApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, period_type: 'monthly' }], // now monthly...
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 90 },
            { kpi_definition_id: 1, year: 2027, period_type: 'quarterly', period_value: 'Q1', achievement: 999 }, // ...but this is a leftover from when it was quarterly
        ],
    });
    const monthly = app._kpiPerformanceByPeriod(1, 2027, 'monthly');
    assert.equal(monthly.length, 1, 'only the genuinely monthly result must appear');
    assert.equal(monthly[0].period, '01');
    assert.equal(monthly[0].avgAchievement, 90, 'the leftover quarterly-tagged result must not be averaged in');
});

test('_kpiPerformanceByPeriod sorts periods chronologically', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, period_type: 'monthly' }],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '03', achievement: 50 },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 60 },
        ],
    });
    const monthly = app._kpiPerformanceByPeriod(1, 2027, 'monthly');
    assert.equal(monthly[0].period, '01');
    assert.equal(monthly[1].period, '03');
});

// ════════════════════════════════════════════════════════════════════
// _kpiMultiYearTrend — full history across every year for yearly/
// quarterly KPIs, not scoped to a single selected year.
// ════════════════════════════════════════════════════════════════════

test('_kpiMultiYearTrend spans multiple years for a yearly KPI, not just one', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, period_type: 'yearly', name: 'Employee Satisfaction' }],
        kpiResults: [
            { kpi_definition_id: 1, period_type: 'yearly', period_label: '2024', achievement: 70 },
            { kpi_definition_id: 1, period_type: 'yearly', period_label: '2025', achievement: 85 },
            { kpi_definition_id: 1, period_type: 'yearly', period_label: '2026', achievement: 92 },
        ],
    });
    const trend = app._kpiMultiYearTrend(1, 'yearly');
    assert.equal(trend.labels.length, 3);
    assert.equal(trend.labels[0], '2024');
    assert.equal(trend.labels[2], '2026');
    assert.equal(trend.series.length, 1);
    assert.equal(trend.series[0].name, 'Employee Satisfaction');
    assert.equal(trend.series[0].data[0], 70);
    assert.equal(trend.series[0].data[2], 92);
});

test('_kpiMultiYearTrend labels are sorted chronologically regardless of insertion order', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, period_type: 'yearly', name: 'K1' }],
        kpiResults: [
            { kpi_definition_id: 1, period_type: 'yearly', period_label: '2026', achievement: 90 },
            { kpi_definition_id: 1, period_type: 'yearly', period_label: '2024', achievement: 70 },
            { kpi_definition_id: 1, period_type: 'yearly', period_label: '2025', achievement: 80 },
        ],
    });
    const trend = app._kpiMultiYearTrend(1, 'yearly');
    assert.equal(trend.labels[0], '2024');
    assert.equal(trend.labels[1], '2025');
    assert.equal(trend.labels[2], '2026');
});

test('_kpiMultiYearTrend gives multiple KPIs each their own series, aligned to a shared label axis', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [
            { id: 1, directorate_id: 1, is_active: true, period_type: 'quarterly', name: 'OT Cost' },
            { id: 2, directorate_id: 1, is_active: true, period_type: 'quarterly', name: 'Turnover' },
        ],
        kpiResults: [
            { kpi_definition_id: 1, period_type: 'quarterly', period_label: '2026-Q1', achievement: 60 },
            { kpi_definition_id: 1, period_type: 'quarterly', period_label: '2026-Q2', achievement: 75 },
            { kpi_definition_id: 2, period_type: 'quarterly', period_label: '2026-Q2', achievement: 95 },
        ],
    });
    const trend = app._kpiMultiYearTrend(1, 'quarterly');
    assert.equal(trend.labels.length, 2);
    assert.equal(trend.series.length, 2);
    const otCost = trend.series.find(s => s.name === 'OT Cost');
    const turnover = trend.series.find(s => s.name === 'Turnover');
    assert.equal(otCost.data[0], 60);
    assert.equal(otCost.data[1], 75);
    assert.equal(turnover.data[0], null, 'Turnover has no Q1 result — must be null, not 0 or missing');
    assert.equal(turnover.data[1], 95);
});

test('_kpiMultiYearTrend excludes a KPI with zero recorded results anywhere', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [
            { id: 1, directorate_id: 1, is_active: true, period_type: 'yearly', name: 'Has Data' },
            { id: 2, directorate_id: 1, is_active: true, period_type: 'yearly', name: 'No Data Yet' },
        ],
        kpiResults: [
            { kpi_definition_id: 1, period_type: 'yearly', period_label: '2026', achievement: 88 },
        ],
    });
    const trend = app._kpiMultiYearTrend(1, 'yearly');
    assert.equal(trend.series.length, 1);
    assert.equal(trend.series[0].name, 'Has Data');
});

test('_kpiMultiYearTrend only includes KPIs matching the requested cadence', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [
            { id: 1, directorate_id: 1, is_active: true, period_type: 'yearly', name: 'Yearly KPI' },
            { id: 2, directorate_id: 1, is_active: true, period_type: 'monthly', name: 'Monthly KPI' },
        ],
        kpiResults: [
            { kpi_definition_id: 1, period_type: 'yearly', period_label: '2026', achievement: 80 },
            { kpi_definition_id: 2, period_type: 'monthly', period_label: '2026-01', achievement: 80 },
        ],
    });
    const trend = app._kpiMultiYearTrend(1, 'yearly');
    assert.equal(trend.series.length, 1);
    assert.equal(trend.series[0].name, 'Yearly KPI');
});

test('_kpiMultiYearTrend excludes a result whose OWN period_type no longer matches its KPI\'s current cadence', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, period_type: 'quarterly', name: 'K' }],
        kpiResults: [
            { kpi_definition_id: 1, period_type: 'quarterly', period_label: '2027-Q1', achievement: 95 },
            { kpi_definition_id: 1, period_type: 'monthly', period_label: '2027-01', achievement: 999 }, // leftover from before it was edited to quarterly
        ],
    });
    const trend = app._kpiMultiYearTrend(1, 'quarterly');
    assert.equal(trend.labels.length, 1);
    assert.equal(trend.series[0].data[0], 95, 'the leftover monthly-tagged result must not appear on the quarterly trend');
});

test('_kpiMultiYearTrend returns empty labels/series when no KPIs match the cadence', () => {
    const app = buildKpiDashboardApp({ kpiDefinitions: [], kpiResults: [] });
    const trend = app._kpiMultiYearTrend(1, 'yearly');
    assert.equal(trend.labels.length, 0);
    assert.equal(trend.series.length, 0);
});

// ════════════════════════════════════════════════════════════════════
// _kpiAutoAggregateFromMonthly — automatically computes quarterly/yearly
// achievement from a monthly KPI's own results, without any manual entry.
// ════════════════════════════════════════════════════════════════════

test('computes a quarterly figure by SUMMING the 3 months\' actuals against a 3x-scaled target', () => {
    const kpiDef = { id: 1, period_type: 'monthly', direction: 'higher_is_better', target_value: 100 };
    const app = buildKpiDashboardApp({
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', actual_value: 90 },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '02', actual_value: 100 },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '03', actual_value: 110 },
        ],
    });
    const result = app._kpiAutoAggregateFromMonthly(kpiDef);
    assert.equal(result.quarterly.length, 1);
    assert.equal(result.quarterly[0].period, '2027-Q1');
    // sum = 90+100+110 = 300, scaled target = 100*3 = 300 -> 100%
    assert.equal(result.quarterly[0].achievement, 100);
});

test('does NOT produce a quarterly figure when only 2 of 3 months are present', () => {
    const app = buildKpiDashboardApp({
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', actual_value: 90 },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '02', actual_value: 100 },
            // March missing
        ],
    });
    const kpiDef = { id: 1, period_type: 'monthly', direction: 'higher_is_better', target_value: 100 };
    const result = app._kpiAutoAggregateFromMonthly(kpiDef);
    assert.equal(result.quarterly.length, 0, 'an incomplete quarter must produce no figure at all, not a partial one');
});

test('computes a yearly figure only once all 12 months are present', () => {
    const kpiDef = { id: 1, period_type: 'monthly', direction: 'higher_is_better', target_value: 100 };
    const results = [];
    for (let m = 1; m <= 12; m++) {
        results.push({ kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: String(m).padStart(2, '0'), actual_value: 100 });
    }
    const app = buildKpiDashboardApp({ kpiResults: results });
    const result = app._kpiAutoAggregateFromMonthly(kpiDef);
    assert.equal(result.yearly.length, 1);
    assert.equal(result.yearly[0].period, '2027');
    // sum = 1200, scaled target = 100*12 = 1200 -> 100%
    assert.equal(result.yearly[0].achievement, 100);
});

test('does NOT produce a yearly figure when only 11 of 12 months are present', () => {
    const kpiDef = { id: 1, period_type: 'monthly', direction: 'higher_is_better', target_value: 100 };
    const results = [];
    for (let m = 1; m <= 11; m++) {
        results.push({ kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: String(m).padStart(2, '0'), actual_value: 100 });
    }
    const app = buildKpiDashboardApp({ kpiResults: results });
    const result = app._kpiAutoAggregateFromMonthly(kpiDef);
    assert.equal(result.yearly.length, 0);
});

test('a non-monthly KPI produces no auto-aggregated figures at all', () => {
    const app = buildKpiDashboardApp();
    const kpiDef = { id: 1, period_type: 'quarterly', direction: 'higher_is_better', target_value: 100 };
    const result = app._kpiAutoAggregateFromMonthly(kpiDef);
    assert.equal(result.quarterly.length, 0);
    assert.equal(result.yearly.length, 0);
});

test('quarters/years across multiple different years are each computed independently', () => {
    const kpiDef = { id: 1, period_type: 'monthly', direction: 'higher_is_better', target_value: 100 };
    const app = buildKpiDashboardApp({
        kpiResults: [
            { kpi_definition_id: 1, year: 2026, period_type: 'monthly', period_value: '01', actual_value: 100 },
            { kpi_definition_id: 1, year: 2026, period_type: 'monthly', period_value: '02', actual_value: 100 },
            { kpi_definition_id: 1, year: 2026, period_type: 'monthly', period_value: '03', actual_value: 100 },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', actual_value: 50 },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '02', actual_value: 50 },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '03', actual_value: 50 },
        ],
    });
    const result = app._kpiAutoAggregateFromMonthly(kpiDef);
    assert.equal(result.quarterly.length, 2);
    const q2026 = result.quarterly.find(q => q.period === '2026-Q1');
    const q2027 = result.quarterly.find(q => q.period === '2027-Q1');
    assert.equal(q2026.achievement, 100);
    assert.equal(q2027.achievement, 50);
});

test('_kpiMultiYearTrendWithAutoAggregation merges a monthly KPI\'s completed quarter alongside a genuinely quarterly KPI', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [
            { id: 1, directorate_id: 1, is_active: true, period_type: 'monthly', direction: 'higher_is_better', target_value: 100, name: 'Monthly KPI' },
            { id: 2, directorate_id: 1, is_active: true, period_type: 'quarterly', direction: 'higher_is_better', target_value: 90, name: 'Real Quarterly KPI' },
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', actual_value: 100 },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '02', actual_value: 100 },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '03', actual_value: 100 },
            { kpi_definition_id: 2, period_type: 'quarterly', period_label: '2027-Q1', achievement: 95 },
        ],
    });
    const trend = app._kpiMultiYearTrendWithAutoAggregation(1, 'quarterly');
    assert.equal(trend.series.length, 2);
    const names = trend.series.map(s => s.name);
    assert.ok(names.includes('Monthly KPI'));
    assert.ok(names.includes('Real Quarterly KPI'));
});

test('_kpiMultiYearTrendWithAutoAggregation excludes a monthly KPI with no completed quarters', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [
            { id: 1, directorate_id: 1, is_active: true, period_type: 'monthly', direction: 'higher_is_better', target_value: 100, name: 'Monthly KPI' },
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_value: '01', actual_value: 100 }, // only 1 of 3 months
        ],
    });
    const trend = app._kpiMultiYearTrendWithAutoAggregation(1, 'quarterly');
    assert.equal(trend.series.length, 0);
});

// ════════════════════════════════════════════════════════════════════
// _kpiSingleYearStats / _kpiMonthsRanked / _kpiRuleBasedSummary — the
// new Executive Director per-KPI detail view's data layer.
// ════════════════════════════════════════════════════════════════════

function buildKpiSingleApp(stateOverrides = {}) {
    return buildApp(baseState(stateOverrides), ['utils.js', 'api-kpi.js']);
}

test('_kpiSingleYearStats computes overall achievement as the average of months WITH data, excluding months with none', () => {
    const app = buildKpiSingleApp({
        kpiDefinitions: [{ id: 1, name: 'Budget Reconciliation', direction: 'higher_is_better', target_value: 100 }],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 90, status: 'below_target' },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '02', achievement: 110, status: 'on_target' },
            // only 2 months have data - March through December have none
        ],
    });
    const stats = app._kpiSingleYearStats(1, 2027);
    assert.equal(stats.totalMonthsWithData, 2, 'must count only months that actually have data, not all 12');
    assert.equal(stats.overallAchievement, 100, 'average of 90 and 110, not divided by 12');
});

test('_kpiSingleYearStats correctly identifies best and lowest month', () => {
    const app = buildKpiSingleApp({
        kpiDefinitions: [{ id: 1, name: 'K', direction: 'higher_is_better', target_value: 100 }],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 90, status: 'below_target' },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '05', achievement: 141, status: 'on_target' },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '11', achievement: 31, status: 'below_target' },
        ],
    });
    const stats = app._kpiSingleYearStats(1, 2027);
    assert.equal(stats.bestMonth.period, '05');
    assert.equal(stats.bestMonth.achievement, 141);
    assert.equal(stats.lowestMonth.period, '11');
    assert.equal(stats.lowestMonth.achievement, 31);
});

test('_kpiSingleYearStats counts targets met correctly', () => {
    const app = buildKpiSingleApp({
        kpiDefinitions: [{ id: 1, name: 'K', direction: 'higher_is_better', target_value: 100 }],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 90, status: 'below_target' },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '02', achievement: 105, status: 'on_target' },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '03', achievement: 120, status: 'on_target' },
        ],
    });
    const stats = app._kpiSingleYearStats(1, 2027);
    assert.equal(stats.targetsMetCount, 2);
});

test('_kpiSingleYearStats returns null when the KPI has zero monthly results for that year', () => {
    const app = buildKpiSingleApp({
        kpiDefinitions: [{ id: 1, name: 'K', direction: 'higher_is_better', target_value: 100 }],
        kpiResults: [],
    });
    assert.equal(app._kpiSingleYearStats(1, 2027), null);
});

test('_kpiSingleYearStats returns null for an unknown KPI id rather than throwing', () => {
    const app = buildKpiSingleApp({ kpiDefinitions: [], kpiResults: [] });
    assert.equal(app._kpiSingleYearStats(999, 2027), null);
});

test('_kpiSingleYearStats ignores non-monthly results for the same KPI', () => {
    const app = buildKpiSingleApp({
        kpiDefinitions: [{ id: 1, name: 'K', direction: 'higher_is_better', target_value: 100 }],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 90, status: 'below_target' },
            { kpi_definition_id: 1, year: 2027, period_type: 'quarterly', period_value: 'Q1', achievement: 999, status: 'on_target' },
        ],
    });
    const stats = app._kpiSingleYearStats(1, 2027);
    assert.equal(stats.totalMonthsWithData, 1, 'the quarterly result must not be counted as a month');
    assert.equal(stats.overallAchievement, 90);
});

test('_kpiMonthsRanked sorts months by achievement descending', () => {
    const app = buildKpiSingleApp({
        kpiDefinitions: [{ id: 1, name: 'K', direction: 'higher_is_better', target_value: 100 }],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 90, status: 'below_target' },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '02', achievement: 141, status: 'on_target' },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '03', achievement: 31, status: 'below_target' },
        ],
    });
    const ranked = app._kpiMonthsRanked(1, 2027);
    assert.equal(ranked[0].achievement, 141);
    assert.equal(ranked[1].achievement, 90);
    assert.equal(ranked[2].achievement, 31);
});

test('_kpiMonthsRanked returns an empty list when there is no data', () => {
    const app = buildKpiSingleApp({ kpiDefinitions: [{ id: 1, name: 'K' }], kpiResults: [] });
    assert.equal(app._kpiMonthsRanked(1, 2027).length, 0);
});

test('_kpiRuleBasedSummary says "exceeding" when overall achievement is at or above 100%', () => {
    const app = buildKpiSingleApp({
        kpiDefinitions: [{ id: 1, name: 'K', direction: 'higher_is_better', target_value: 100 }],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 110, status: 'on_target' },
        ],
    });
    const summary = app._kpiRuleBasedSummary(1, 2027);
    assert.ok(summary[0].includes('exceeding'));
});

test('_kpiRuleBasedSummary says "below" when overall achievement is under 100%', () => {
    const app = buildKpiSingleApp({
        kpiDefinitions: [{ id: 1, name: 'K', direction: 'higher_is_better', target_value: 100 }],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 60, status: 'below_target' },
        ],
    });
    const summary = app._kpiRuleBasedSummary(1, 2027);
    assert.ok(summary[0].includes('below'));
});

test('_kpiRuleBasedSummary names the below-target months by their actual month name', () => {
    const app = buildKpiSingleApp({
        kpiDefinitions: [{ id: 1, name: 'K', direction: 'higher_is_better', target_value: 100 }],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '03', achievement: 40, status: 'below_target' },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '06', achievement: 120, status: 'on_target' },
        ],
    });
    const summary = app._kpiRuleBasedSummary(1, 2027);
    const belowLine = summary.find(l => l.includes('management attention'));
    assert.ok(belowLine, 'must include a line naming the below-target months');
    assert.ok(belowLine.includes('March'));
    assert.ok(!belowLine.includes('June'), 'June was on target and must not be listed as needing attention');
});

test('_kpiRuleBasedSummary omits the below-target line entirely when nothing is below target', () => {
    const app = buildKpiSingleApp({
        kpiDefinitions: [{ id: 1, name: 'K', direction: 'higher_is_better', target_value: 100 }],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 110, status: 'on_target' },
        ],
    });
    const summary = app._kpiRuleBasedSummary(1, 2027);
    assert.ok(!summary.some(l => l.includes('management attention')));
});

test('_kpiRuleBasedSummary returns an empty list when there is no data at all', () => {
    const app = buildKpiSingleApp({ kpiDefinitions: [{ id: 1, name: 'K' }], kpiResults: [] });
    assert.equal(app._kpiRuleBasedSummary(1, 2027).length, 0);
});

test('_kpiYearStatusLabel classifies >=100% as Excellent', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiYearStatusLabel(109.84).label, 'Excellent');
    assert.equal(app._kpiYearStatusLabel(100).label, 'Excellent');
});

test('_kpiYearStatusLabel classifies 80-99% as Good', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiYearStatusLabel(85).label, 'Good');
    assert.equal(app._kpiYearStatusLabel(80).label, 'Good');
});

test('_kpiYearStatusLabel classifies below 80% as Needs Attention', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiYearStatusLabel(79.9).label, 'Needs Attention');
    assert.equal(app._kpiYearStatusLabel(20).label, 'Needs Attention');
});

test('_kpiYearStatusLabel handles missing input without throwing', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiYearStatusLabel(null).label, 'No Data');
    assert.equal(app._kpiYearStatusLabel(undefined).label, 'No Data');
});

test('_kpiMonthColorTier classifies achievement into above/near/below/none correctly', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiMonthColorTier(125.71), 'above');
    assert.equal(app._kpiMonthColorTier(100), 'above');
    assert.equal(app._kpiMonthColorTier(95.64), 'near');
    assert.equal(app._kpiMonthColorTier(80), 'near');
    assert.equal(app._kpiMonthColorTier(35.71), 'below');
    assert.equal(app._kpiMonthColorTier(0), 'below');
    assert.equal(app._kpiMonthColorTier(null), 'none');
    assert.equal(app._kpiMonthColorTier(undefined), 'none');
});


