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

// Builds a minimal object shaped like a real SheetJS worksheet — cells
// keyed by absolute address (e.g. "D13") with a { w: '<text>' } value,
// plus a "!ref" used-range string. `rows` is an array of row-arrays;
// `originCol`/`originRow` place row 0/col 0 of that array at that real
// sheet address — this is what lets a test reproduce the actual bug
// (a real file's used range starting at column B, not A) rather than
// only ever testing the case that happened to already work.
function colLetterToIndex(letter) {
    let n = 0;
    for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1; // 0-based
}
function colIndexToLetter(idx) {
    let n = idx + 1, s = '';
    while (n > 0) { const rem = (n - 1) % 26; s = String.fromCharCode(65 + rem) + s; n = Math.floor((n - 1) / 26); }
    return s;
}
function mockWorksheet(rows, originCol = 'A', originRow = 1) {
    const sheet = {};
    const originColIdx = colLetterToIndex(originCol);
    let maxColIdx = originColIdx, maxRow = originRow;
    rows.forEach((row, ri) => {
        (row || []).forEach((val, ci) => {
            if (val === null || val === undefined || val === '') return;
            const colIdx = originColIdx + ci;
            const rowNum = originRow + ri;
            const addr = `${colIndexToLetter(colIdx)}${rowNum}`;
            sheet[addr] = { w: String(val), v: val };
            if (colIdx > maxColIdx) maxColIdx = colIdx;
            if (rowNum > maxRow) maxRow = rowNum;
        });
    });
    sheet['!ref'] = `${originCol}${originRow}:${colIndexToLetter(maxColIdx)}${maxRow}`;
    return sheet;
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
// _kpiMultiYearTrendWithAutoAggregation's optional filterYear param —
// used to scope Quarterly Trend to just the selected year, per explicit
// request, while Year-over-Year Trend stays unscoped (multi-year is the
// entire point of that chart, so it's simply never passed a filterYear).
// ════════════════════════════════════════════════════════════════════

test('filterYear restricts a genuinely quarterly KPI\'s trend to only that year\'s quarters', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, period_type: 'quarterly', name: 'K' }],
        kpiResults: [
            { kpi_definition_id: 1, period_type: 'quarterly', period_label: '2026-Q4', achievement: 50 },
            { kpi_definition_id: 1, period_type: 'quarterly', period_label: '2027-Q1', achievement: 90 },
            { kpi_definition_id: 1, period_type: 'quarterly', period_label: '2027-Q2', achievement: 95 },
        ],
    });
    const trend = app._kpiMultiYearTrendWithAutoAggregation(1, 'quarterly', 2027);
    assert.equal(trend.labels.length, 2, '2026-Q4 must be excluded, only the two 2027 quarters remain');
    assert.ok(trend.labels.every(l => l.startsWith('2027')));
    assert.equal(trend.series[0].data[0], 90);
    assert.equal(trend.series[0].data[1], 95);
});

test('filterYear also restricts a monthly KPI\'s auto-aggregated quarters to only that year', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, period_type: 'monthly', direction: 'higher_is_better', target_value: 100, name: 'Monthly KPI' }],
        kpiResults: [
            { kpi_definition_id: 1, year: 2026, period_type: 'monthly', period_value: '01', actual_value: 100 },
            { kpi_definition_id: 1, year: 2026, period_type: 'monthly', period_value: '02', actual_value: 100 },
            { kpi_definition_id: 1, year: 2026, period_type: 'monthly', period_value: '03', actual_value: 100 },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', actual_value: 100 },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '02', actual_value: 100 },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '03', actual_value: 100 },
        ],
    });
    const trend2027 = app._kpiMultiYearTrendWithAutoAggregation(1, 'quarterly', 2027);
    assert.equal(trend2027.labels.length, 1);
    assert.equal(trend2027.labels[0], '2027-Q1');
});

test('without filterYear, the trend stays unscoped across every year with data (unchanged default behavior)', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, period_type: 'quarterly', name: 'K' }],
        kpiResults: [
            { kpi_definition_id: 1, period_type: 'quarterly', period_label: '2026-Q4', achievement: 50 },
            { kpi_definition_id: 1, period_type: 'quarterly', period_label: '2027-Q1', achievement: 90 },
        ],
    });
    const trend = app._kpiMultiYearTrendWithAutoAggregation(1, 'quarterly');
    assert.equal(trend.labels.length, 2, 'both years must still appear when filterYear is not passed at all');
});

test('filterYear on a year with no matching data returns an empty trend, not an error', () => {
    const app = buildKpiDashboardApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, period_type: 'quarterly', name: 'K' }],
        kpiResults: [
            { kpi_definition_id: 1, period_type: 'quarterly', period_label: '2027-Q1', achievement: 90 },
        ],
    });
    const trend = app._kpiMultiYearTrendWithAutoAggregation(1, 'quarterly', 2030);
    assert.equal(trend.labels.length, 0);
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

// ════════════════════════════════════════════════════════════════════
// _kpiColorForId — a fixed, deterministic color per KPI, so the same KPI
// shows the same color on every chart regardless of array order.
// ════════════════════════════════════════════════════════════════════

test('_kpiColorForId returns the SAME color for the same id, called repeatedly', () => {
    const app = buildKpiApp();
    const first = app._kpiColorForId(7);
    const second = app._kpiColorForId(7);
    const third = app._kpiColorForId(7);
    assert.equal(first, second);
    assert.equal(second, third);
});

test('_kpiColorForId does not throw for a null/undefined id, returns a valid fallback color', () => {
    const app = buildKpiApp();
    const palette = app._kpiColorPalette();
    assert.ok(palette.includes(app._kpiColorForId(null)));
    assert.ok(palette.includes(app._kpiColorForId(undefined)));
});

// ════════════════════════════════════════════════════════════════════
// _kpiColorForIdInDirectorate — reproduces and fixes the exact reported
// bug: two unrelated KPIs on the same 3-color chart both showed green,
// because kpiId % 3 collided for their specific ids.
// ════════════════════════════════════════════════════════════════════

test('reproduces the exact reported bug: ids that collide under simple modulo get the SAME color from _kpiColorForId', () => {
    // Derives colliding ids from the palette's ACTUAL current length,
    // rather than hardcoding 3/6 (which assumed a 3-color palette and
    // stopped demonstrating anything once a 4th color was added) — this
    // is the confirmed mechanism behind "why both KPI same color"
    // regardless of how many colors the palette happens to have.
    const app = buildKpiApp();
    const paletteLength = app._kpiColorPalette().length;
    assert.equal(app._kpiColorForId(paletteLength), app._kpiColorForId(paletteLength * 2), 'demonstrates the bug this fix addresses');
});

test('_kpiColorForIdInDirectorate gives 3 KPIs with colliding-under-modulo ids 3 genuinely different colors', () => {
    const app = buildKpiApp({
        kpiDefinitions: [
            { id: 3, directorate_id: 1, is_active: true, name: 'Closing Year Budget' },
            { id: 6, directorate_id: 1, is_active: true, name: 'Financial Statement Result' },
            { id: 9, directorate_id: 1, is_active: true, name: 'Budget Reconciliation' },
        ],
    });
    const c1 = app._kpiColorForIdInDirectorate(3, 1);
    const c2 = app._kpiColorForIdInDirectorate(6, 1);
    const c3 = app._kpiColorForIdInDirectorate(9, 1);
    assert.notEqual(c1, c2);
    assert.notEqual(c2, c3);
    assert.notEqual(c1, c3);
});

test('_kpiColorForIdInDirectorate gives the SAME KPI the SAME color regardless of which subset of the directorate is passed/visible', () => {
    // The key cross-chart consistency property: Quarterly might only
    // show 2 of a directorate's 3 KPIs (the third has no quarterly
    // data), but the one that DOES appear must still get the same color
    // it would get if all 3 were visible together.
    const app = buildKpiApp({
        kpiDefinitions: [
            { id: 3, directorate_id: 1, is_active: true, name: 'A' },
            { id: 6, directorate_id: 1, is_active: true, name: 'B' },
            { id: 9, directorate_id: 1, is_active: true, name: 'C' },
        ],
    });
    // Ranking is computed from the full directorate list regardless of
    // which chart is asking, so this must be stable no matter what.
    const colorForB_call1 = app._kpiColorForIdInDirectorate(6, 1);
    const colorForB_call2 = app._kpiColorForIdInDirectorate(6, 1);
    assert.equal(colorForB_call1, colorForB_call2);
});

test('_kpiColorForIdInDirectorate ranks by id (stable, deterministic order), not insertion order', () => {
    const app = buildKpiApp({
        kpiDefinitions: [
            { id: 9, directorate_id: 1, is_active: true, name: 'Inserted first, highest id' },
            { id: 3, directorate_id: 1, is_active: true, name: 'Inserted second, lowest id' },
        ],
    });
    const palette = app._kpiColorPalette();
    // id 3 has the lower id, so it must rank 0 (first color) regardless
    // of array insertion order.
    assert.equal(app._kpiColorForIdInDirectorate(3, 1), palette[0]);
    assert.equal(app._kpiColorForIdInDirectorate(9, 1), palette[1]);
});

test('_kpiColorForIdInDirectorate falls back to the simple function when the KPI isn\'t found in that directorate', () => {
    const app = buildKpiApp({ kpiDefinitions: [] });
    const result = app._kpiColorForIdInDirectorate(3, 1);
    assert.equal(result, app._kpiColorForId(3));
});

test('_kpiColorForIdInDirectorate wraps gracefully (no error) when a directorate has more KPIs than the palette has colors', () => {
    const app = buildKpiApp({
        kpiDefinitions: [
            { id: 1, directorate_id: 1, is_active: true, name: 'A' },
            { id: 2, directorate_id: 1, is_active: true, name: 'B' },
            { id: 3, directorate_id: 1, is_active: true, name: 'C' },
            { id: 4, directorate_id: 1, is_active: true, name: 'D' },
        ],
    });
    const palette = app._kpiColorPalette();
    // 4th KPI (rank 3) wraps back to palette[0] with a 3-color palette --
    // acceptable since it's a genuine overflow, not an avoidable
    // collision like the reported bug.
    assert.equal(app._kpiColorForIdInDirectorate(4, 1), palette[3 % palette.length]);
});

test('_kpiColorForIdInDirectorate does not throw for a null/undefined id', () => {
    const app = buildKpiApp();
    const palette = app._kpiColorPalette();
    assert.ok(palette.includes(app._kpiColorForIdInDirectorate(null, 1)));
    assert.ok(palette.includes(app._kpiColorForIdInDirectorate(undefined, 1)));
});

// ════════════════════════════════════════════════════════════════════
// _kpiColorsForSeries — the definitive fix. Ranks within the EXACT set
// of series being rendered on a specific chart, not the whole
// directorate's KPI list — this is what actually guarantees no
// collision, since the earlier directorate-wide ranking could still
// wrap and collide whenever the directorate had more total KPIs than
// the palette, even with only a few actually shown on any one chart.
// ════════════════════════════════════════════════════════════════════

test('reproduces why the directorate-wide ranking still wasn\'t enough: an unrelated KPI elsewhere in the directorate can still cause 2 SHOWN KPIs to collide', () => {
    // Builds exactly paletteLength+1 KPIs — enough to guarantee an
    // overflow under the old directorate-wide ranking regardless of how
    // many colors the palette actually has, rather than a hardcoded
    // count that assumed a specific (now-stale) palette size.
    const app = buildKpiApp();
    const paletteLength = app._kpiColorPalette().length;
    const kpiDefinitions = Array.from({ length: paletteLength + 1 }, (_, i) => ({
        id: i + 1, directorate_id: 1, is_active: true, name: i === 0 ? 'Not shown on this chart' : `KPI ${i + 1}`,
    }));
    const app2 = buildKpiApp({ kpiDefinitions });
    // Under the old directorate-wide ranking: id 1 -> rank 0, id
    // (paletteLength+1) -> rank paletteLength -> both rank%paletteLength = 0
    // -> SAME color, even though id 1 isn't even on this chart.
    const lastId = paletteLength + 1;
    const oldWay = app2._kpiColorForIdInDirectorate(lastId, 1);
    assert.equal(oldWay, app2._kpiColorForIdInDirectorate(1, 1), 'demonstrates the directorate-wide approach can still collide due to an unrelated, unshown KPI');
});

test('_kpiColorsForSeries gives 3 different colors to exactly the 3 series actually being rendered, ignoring unrelated KPIs elsewhere in the directorate', () => {
    // The same scenario as above, but only the 3 series that ACTUALLY
    // appear on the chart are passed in — id 1 (not shown) is excluded
    // entirely, so it can't cause a collision for the other 3.
    const app = buildKpiApp();

    const series = [
        { id: 2, name: 'Closing Year Budget' },
        { id: 3, name: 'Financial Statement Result' },
        { id: 4, name: 'Budget Reconciliation' },
    ];
    const colors = app._kpiColorsForSeries(series);
    const c2 = colors.get(2), c3 = colors.get(3), c4 = colors.get(4);
    assert.notEqual(c2, c3);
    assert.notEqual(c3, c4);
    assert.notEqual(c2, c4, 'the exact reported bug: these two must not both be green');
});

test('_kpiColorsForSeries ranks by id (stable order), not array/insertion order', () => {
    const app = buildKpiApp();
    const palette = app._kpiColorPalette();
    const series = [
        { id: 9, name: 'Passed first, highest id' },
        { id: 3, name: 'Passed second, lowest id' },
    ];
    const colors = app._kpiColorsForSeries(series);
    assert.equal(colors.get(3), palette[0], 'lowest id must rank first regardless of array position');
    assert.equal(colors.get(9), palette[1]);
});

test('_kpiColorsForSeries wraps gracefully when there are genuinely more series than palette colors', () => {
    const app = buildKpiApp();
    const palette = app._kpiColorPalette();
    const series = [1, 2, 3, 4].map(id => ({ id, name: `KPI ${id}` }));
    const colors = app._kpiColorsForSeries(series);
    assert.equal(colors.get(4), palette[3 % palette.length], 'a genuine overflow (4 series, 3 colors) is expected to wrap');
});

test('_kpiColorsForSeries handles an empty or null series list without throwing', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiColorsForSeries([]).size, 0);
    assert.equal(app._kpiColorsForSeries(null).size, 0);
    assert.equal(app._kpiColorsForSeries(undefined).size, 0);
});

test('_kpiColorPalette contains the Modern Executive spec\'s 3 original colors plus a 4th, added after a confirmed overflow', () => {
    const app = buildKpiApp();
    const palette = app._kpiColorPalette();
    const specColors = ['#10B981', '#3B82F6', '#F59E0B']; // Emerald, Royal Blue, Amber
    assert.equal(palette.length, 4);
    specColors.forEach(color => {
        assert.ok(palette.includes(color), `${color} from the Modern Executive spec must be present`);
    });
});

test('_kpiColorPalette contains no red/rose tone at all — reserved for signaling negative figures, not spent as a generic KPI identity color', () => {
    const app = buildKpiApp();
    const palette = app._kpiColorPalette();
    const redRoseFamily = ['#dc2626', '#ef4444', '#f43f5e', '#F43F5E', '#be123c', '#9f1239', '#e11d48'];
    redRoseFamily.forEach(shade => {
        assert.ok(!palette.includes(shade), `${shade} is a red/rose tone and must not appear in the general KPI palette`);
    });
});

test('_kpiColorsForSeries gives 4 KPIs 4 genuinely different colors, reproducing and confirming the fix for the exact reported overflow (Balance Sheet landing on the same green as Closing Year Budget)', () => {
    const app = buildKpiApp();
    const series = [
        { id: 1, name: 'Closing Year Budget' },
        { id: 2, name: 'Financial Statement Result' },
        { id: 3, name: 'Balance Sheet' },
        { id: 4, name: 'Budget Reconciliation' },
    ];
    const colors = app._kpiColorsForSeries(series);
    const values = [1, 2, 3, 4].map(id => colors.get(id));
    const uniqueValues = new Set(values);
    assert.equal(uniqueValues.size, 4, 'all 4 KPIs, including Balance Sheet, must get genuinely distinct colors now that the palette has 4');
});

test('_kpiMultiYearTrend attaches the KPI id to each series, needed for consistent coloring', () => {
    const app = buildKpiApp({
        kpiDefinitions: [{ id: 42, directorate_id: 1, is_active: true, period_type: 'yearly', name: 'K' }],
        kpiResults: [{ kpi_definition_id: 42, period_type: 'yearly', period_label: '2027', achievement: 90 }],
    });
    const trend = app._kpiMultiYearTrend(1, 'yearly');
    assert.equal(trend.series[0].id, 42);
});

test('_kpiMultiYearTrendWithAutoAggregation preserves the KPI id through auto-aggregated monthly series too', () => {
    const app = buildKpiApp({
        kpiDefinitions: [{ id: 99, directorate_id: 1, is_active: true, period_type: 'monthly', direction: 'higher_is_better', target_value: 100, name: 'Monthly KPI' }],
        kpiResults: [
            { kpi_definition_id: 99, year: 2027, period_type: 'monthly', period_value: '01', actual_value: 100 },
            { kpi_definition_id: 99, year: 2027, period_type: 'monthly', period_value: '02', actual_value: 100 },
            { kpi_definition_id: 99, year: 2027, period_type: 'monthly', period_value: '03', actual_value: 100 },
        ],
    });
    const trend = app._kpiMultiYearTrendWithAutoAggregation(1, 'quarterly');
    assert.equal(trend.series[0].id, 99);
});

// ════════════════════════════════════════════════════════════════════
// details array — actual/target values carried alongside achievement,
// for the rich hover tooltip (Value / Achievement / Target) that
// replaced always-visible bar labels.
// ════════════════════════════════════════════════════════════════════

test('_kpiMultiYearTrend\'s details array carries actual and target values matching each data point', () => {
    const app = buildKpiApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, period_type: 'quarterly', name: 'Closing Year Budget' }],
        kpiResults: [{ kpi_definition_id: 1, period_type: 'quarterly', period_label: '2027-Q1', achievement: 244, actual_value: 244, target_value: 100 }],
    });
    const trend = app._kpiMultiYearTrend(1, 'quarterly');
    assert.equal(trend.series[0].data[0], 244, 'data itself stays a plain number for Chart.js');
    assert.equal(trend.series[0].details[0].actualValue, 244);
    assert.equal(trend.series[0].details[0].targetValue, 100);
    assert.equal(trend.series[0].details[0].achievement, 244);
});

test('a label with no result for a given KPI has a null entry in both data AND details at that index', () => {
    const app = buildKpiApp({
        kpiDefinitions: [
            { id: 1, directorate_id: 1, is_active: true, period_type: 'quarterly', name: 'Has Q1' },
            { id: 2, directorate_id: 1, is_active: true, period_type: 'quarterly', name: 'Has Q2' },
        ],
        kpiResults: [
            { kpi_definition_id: 1, period_type: 'quarterly', period_label: '2027-Q1', achievement: 90, actual_value: 90, target_value: 100 },
            { kpi_definition_id: 2, period_type: 'quarterly', period_label: '2027-Q2', achievement: 80, actual_value: 80, target_value: 100 },
        ],
    });
    const trend = app._kpiMultiYearTrend(1, 'quarterly');
    const series1 = trend.series.find(s => s.id === 1);
    const q2Index = trend.labels.indexOf('2027-Q2');
    assert.equal(series1.data[q2Index], null);
    assert.equal(series1.details[q2Index], null);
});

test('_kpiAutoAggregateFromMonthly\'s quarterly/yearly points include the summed actual and scaled target values', () => {
    const kpiDef = { id: 1, period_type: 'monthly', direction: 'higher_is_better', target_value: 100 };
    const app = buildKpiApp({
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', actual_value: 90 },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '02', actual_value: 100 },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '03', actual_value: 110 },
        ],
    });
    const result = app._kpiAutoAggregateFromMonthly(kpiDef);
    assert.equal(result.quarterly[0].actualValue, 300, 'sum of 90+100+110');
    assert.equal(result.quarterly[0].targetValue, 300, '3x the monthly target of 100');
});

test('_kpiMultiYearTrendWithAutoAggregation preserves details through the merge with genuinely quarterly KPIs', () => {
    const app = buildKpiApp({
        kpiDefinitions: [
            { id: 1, directorate_id: 1, is_active: true, period_type: 'monthly', direction: 'higher_is_better', target_value: 100, name: 'Monthly KPI' },
            { id: 2, directorate_id: 1, is_active: true, period_type: 'quarterly', name: 'Real Quarterly KPI' },
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', actual_value: 100 },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '02', actual_value: 100 },
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '03', actual_value: 100 },
            { kpi_definition_id: 2, period_type: 'quarterly', period_label: '2027-Q1', achievement: 95, actual_value: 95, target_value: 100 },
        ],
    });
    const trend = app._kpiMultiYearTrendWithAutoAggregation(1, 'quarterly');
    const monthlyKpiSeries = trend.series.find(s => s.id === 1);
    const realQuarterlySeries = trend.series.find(s => s.id === 2);
    assert.ok(monthlyKpiSeries.details.some(d => d != null), 'the auto-aggregated series must have real detail data, not all nulls');
    assert.ok(realQuarterlySeries.details.some(d => d != null), 'the genuinely-quarterly series must also keep its detail data after the merge');
});

test('_kpiMultiYearTrendWithAutoAggregation preserves details through the filterYear step too', () => {
    const app = buildKpiApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, period_type: 'quarterly', name: 'K' }],
        kpiResults: [
            { kpi_definition_id: 1, period_type: 'quarterly', period_label: '2026-Q4', achievement: 50, actual_value: 50, target_value: 100 },
            { kpi_definition_id: 1, period_type: 'quarterly', period_label: '2027-Q1', achievement: 90, actual_value: 90, target_value: 100 },
        ],
    });
    const trend = app._kpiMultiYearTrendWithAutoAggregation(1, 'quarterly', 2027);
    assert.equal(trend.labels.length, 1);
    assert.equal(trend.series[0].details[0].actualValue, 90, 'details must survive the year-filtering step, not just data');
});

// ════════════════════════════════════════════════════════════════════
// _kpiOverviewMonthlyChartData — powers the Overview tab's Monthly
// Performance chart's new KPI selector. null/undefined selectedKpiId
// keeps the original averaged-across-all-KPIs behavior; a specific id
// switches to that one KPI's own monthly data.
// ════════════════════════════════════════════════════════════════════

test('with no selectedKpiId, behaves identically to the original averaged-across-all-KPIs function', () => {
    const app = buildKpiApp({
        kpiDefinitions: [
            { id: 1, directorate_id: 1, is_active: true, period_type: 'monthly' },
            { id: 2, directorate_id: 1, is_active: true, period_type: 'monthly' },
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 80 },
            { kpi_definition_id: 2, year: 2027, period_type: 'monthly', period_value: '01', achievement: 100 },
        ],
    });
    const original = app._kpiPerformanceByPeriod(1, 2027, 'monthly');
    const viaSelector = app._kpiOverviewMonthlyChartData(1, 2027, null);
    assert.deepStrictEqual(viaSelector, original);
});

test('with a specific selectedKpiId, returns ONLY that KPI\'s own monthly data, not averaged with others', () => {
    const app = buildKpiApp({
        kpiDefinitions: [
            { id: 1, directorate_id: 1, is_active: true, period_type: 'monthly', name: 'Budget Reconciliation' },
            { id: 2, directorate_id: 1, is_active: true, period_type: 'monthly', name: 'Financial Statement Result' },
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 80 },
            { kpi_definition_id: 2, year: 2027, period_type: 'monthly', period_value: '01', achievement: 100 },
        ],
    });
    const result = app._kpiOverviewMonthlyChartData(1, 2027, 1);
    assert.equal(result.length, 1);
    assert.equal(result[0].period, '01');
    assert.equal(result[0].avgAchievement, 80, 'must be KPI 1\'s own value (80), not averaged with KPI 2\'s 100');
});

test('a selected KPI with no results for the year returns an empty array, not an error', () => {
    const app = buildKpiApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, period_type: 'monthly', name: 'K' }],
        kpiResults: [],
    });
    const result = app._kpiOverviewMonthlyChartData(1, 2027, 1);
    assert.equal(result.length, 0);
});

test('both modes return the same {period, avgAchievement} shape', () => {
    const app = buildKpiApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, period_type: 'monthly', name: 'K' }],
        kpiResults: [{ kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 90 }],
    });
    const allMode = app._kpiOverviewMonthlyChartData(1, 2027, null);
    const singleMode = app._kpiOverviewMonthlyChartData(1, 2027, 1);
    assert.deepStrictEqual(Object.keys(allMode[0]).sort(), Object.keys(singleMode[0]).sort());
});

// ════════════════════════════════════════════════════════════════════
// avgActual / avgTarget — added to the Monthly chart's data so its
// tooltip can show Value/Achievement/Target, matching the Quarterly and
// Year-over-Year trend charts.
// ════════════════════════════════════════════════════════════════════

test('_kpiPerformanceByPeriod computes avgActual and avgTarget as averages across KPIs sharing a period, alongside avgAchievement', () => {
    const app = buildKpiApp({
        kpiDefinitions: [
            { id: 1, directorate_id: 1, is_active: true, period_type: 'monthly' },
            { id: 2, directorate_id: 1, is_active: true, period_type: 'monthly' },
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 80, actual_value: 80, target_value: 100 },
            { kpi_definition_id: 2, year: 2027, period_type: 'monthly', period_value: '01', achievement: 120, actual_value: 120, target_value: 100 },
        ],
    });
    const result = app._kpiPerformanceByPeriod(1, 2027, 'monthly');
    assert.equal(result[0].avgAchievement, 100, 'average of 80 and 120');
    assert.equal(result[0].avgActual, 100, 'average of 80 and 120');
    assert.equal(result[0].avgTarget, 100, 'both KPIs share the same target of 100');
});

test('_kpiPerformanceByPeriod\'s avgActual/avgTarget are null when no result has those fields recorded, without throwing', () => {
    const app = buildKpiApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, period_type: 'monthly' }],
        kpiResults: [{ kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 90 }], // no actual_value/target_value
    });
    const result = app._kpiPerformanceByPeriod(1, 2027, 'monthly');
    assert.equal(result[0].avgAchievement, 90, 'achievement itself is unaffected by missing actual/target');
    assert.equal(result[0].avgActual, null);
    assert.equal(result[0].avgTarget, null);
});

test('_kpiOverviewMonthlyChartData\'s single-KPI mode carries that KPI\'s own actual/target values (not averaged, since there\'s only one)', () => {
    const app = buildKpiApp({
        kpiDefinitions: [{ id: 1, directorate_id: 1, is_active: true, period_type: 'monthly', name: 'Budget Reconciliation' }],
        kpiResults: [{ kpi_definition_id: 1, year: 2027, period_type: 'monthly', period_value: '01', achievement: 102.04, actual_value: 750, target_value: 735 }],
    });
    const result = app._kpiOverviewMonthlyChartData(1, 2027, 1);
    assert.equal(result[0].avgActual, 750);
    assert.equal(result[0].avgTarget, 735);
});

// ════════════════════════════════════════════════════════════════════
// KPI/Owner Excel import — pure mapping and parsing helpers.
// ════════════════════════════════════════════════════════════════════

test('_kpiMapFrequencyToPeriodType maps Monthly/Quarterly/Annual correctly, case/whitespace-insensitive', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiMapFrequencyToPeriodType('Monthly'), 'monthly');
    assert.equal(app._kpiMapFrequencyToPeriodType('  quarterly '), 'quarterly');
    assert.equal(app._kpiMapFrequencyToPeriodType('ANNUAL'), 'yearly');
    assert.equal(app._kpiMapFrequencyToPeriodType('Annually'), 'yearly');
});

test('_kpiMapFrequencyToPeriodType returns null for unrecognized values, rather than guessing a default', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiMapFrequencyToPeriodType('Weekly'), null);
    assert.equal(app._kpiMapFrequencyToPeriodType(''), null);
    assert.equal(app._kpiMapFrequencyToPeriodType(null), null);
    assert.equal(app._kpiMapFrequencyToPeriodType(undefined), null);
});

test('_kpiMapLineNumberToLineName maps 3-6 to L3-L6, accepting both numbers and numeric strings', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiMapLineNumberToLineName(3), 'L3');
    assert.equal(app._kpiMapLineNumberToLineName('4'), 'L4');
    assert.equal(app._kpiMapLineNumberToLineName(5), 'L5');
    assert.equal(app._kpiMapLineNumberToLineName(6), 'L6');
});

test('_kpiMapLineNumberToLineName returns null for anything outside 3-6', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiMapLineNumberToLineName(2), null);
    assert.equal(app._kpiMapLineNumberToLineName(7), null);
    assert.equal(app._kpiMapLineNumberToLineName('not a number'), null);
    assert.equal(app._kpiMapLineNumberToLineName(null), null);
});

test('_kpiParsePercentValue normalizes every real-world spreadsheet form to a 0-1 fraction', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiParsePercentValue(0.4), 0.4);
    assert.equal(app._kpiParsePercentValue('0.4'), 0.4);
    assert.equal(app._kpiParsePercentValue('40%'), 0.4);
    assert.equal(app._kpiParsePercentValue('40'), 0.4);
    assert.equal(app._kpiParsePercentValue(1), 1);
    assert.equal(app._kpiParsePercentValue('100%'), 1);
});

test('_kpiParsePercentValue returns null for empty/invalid input rather than throwing', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiParsePercentValue(null), null);
    assert.equal(app._kpiParsePercentValue(undefined), null);
    assert.equal(app._kpiParsePercentValue(''), null);
    assert.equal(app._kpiParsePercentValue('not a number'), null);
});

test('_kpiParseOwnerImportRow parses a genuinely valid row correctly', () => {
    const app = buildKpiApp();
    const result = app._kpiParseOwnerImportRow({
        'Line': 3, 'Code': 'A', 'KPI Code': 'A1', 'KPI Name': 'Passenger satisfaction',
        'Frequency': 'Quarterly', 'KPI Weight %': 0.4, 'Owner Dept': 'Operations',
        'Owner Name': 'HANI ALHARBI', 'Owner Email': 'Hani.Alharbi@flow-metro.com', 'Owner %': 1,
    });
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.data.line, 'L3');
    assert.equal(result.data.periodType, 'quarterly');
    assert.equal(result.data.kpiCode, 'A1');
    assert.equal(result.data.ownerPct, 1);
});

test('_kpiParseOwnerImportRow reports specific, named errors for each missing/invalid required field', () => {
    const app = buildKpiApp();
    const result = app._kpiParseOwnerImportRow({ 'Line': 99, 'Frequency': 'Weekly', 'Owner %': 'bogus' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Line')));
    assert.ok(result.errors.some(e => e.includes('Frequency')));
    assert.ok(result.errors.some(e => e.includes('KPI Code')));
    assert.ok(result.errors.some(e => e.includes('KPI Name')));
    assert.ok(result.errors.some(e => e.includes('Owner Dept')));
    assert.ok(result.errors.some(e => e.includes('Owner %')));
});

test('_kpiParseOwnerImportRows separates valid from invalid rows and tracks the correct spreadsheet row number', () => {
    const app = buildKpiApp();
    const rawRows = [
        { 'Line': 3, 'KPI Code': 'A1', 'KPI Name': 'K', 'Frequency': 'Monthly', 'Owner Dept': 'Operations', 'Owner %': 1 }, // valid, row 2
        { 'Line': 99, 'KPI Code': 'A2', 'KPI Name': 'K', 'Frequency': 'Monthly', 'Owner Dept': 'Operations', 'Owner %': 1 }, // invalid line, row 3
    ];
    const { validRows, invalidRows } = app._kpiParseOwnerImportRows(rawRows);
    assert.equal(validRows.length, 1);
    assert.equal(invalidRows.length, 1);
    assert.equal(invalidRows[0].rowNumber, 3, 'row 0 in the array is spreadsheet row 2 (header), so index 1 is row 3');
});

test('_kpiGroupImportRowsByLineAndCode collapses multi-owner rows into one KPI entry with an owners array — reproduces the real "A3" 90/10 split', () => {
    const app = buildKpiApp();
    const validRows = [
        { line: 'L3', code: 'A', kpiCode: 'A3', kpiName: 'Complaints per boarding', periodType: 'monthly', weight: 0.2, ownerDept: 'Operations', ownerName: 'HANI ALHARBI', ownerEmail: 'h@x.com', ownerPct: 0.9 },
        { line: 'L3', code: 'A', kpiCode: 'A3', kpiName: 'Complaints per boarding', periodType: 'monthly', weight: 0.2, ownerDept: 'Finance', ownerName: 'TARIQ MANSOUR', ownerEmail: 't@x.com', ownerPct: 0.1 },
    ];
    const { groups, conflicts } = app._kpiGroupImportRowsByLineAndCode(validRows);
    assert.equal(conflicts.length, 0, 'identical KPI Name across both rows -> no conflict');
    assert.equal(groups.length, 1, 'both rows describe the same KPI on the same line, must collapse into ONE entry');
    assert.equal(groups[0].owners.length, 2);
    assert.equal(groups[0].owners[0].dept, 'Operations');
    assert.equal(groups[0].owners[0].pct, 0.9);
    assert.equal(groups[0].owners[1].dept, 'Finance');
});

test('_kpiGroupImportRowsByLineAndCode keeps the SAME KPI code on DIFFERENT lines as separate entries, not merged', () => {
    const app = buildKpiApp();
    const validRows = [
        { line: 'L3', code: 'A', kpiCode: 'A1', kpiName: 'K', periodType: 'monthly', weight: 0.4, ownerDept: 'Operations', ownerName: '', ownerEmail: '', ownerPct: 1 },
        { line: 'L4', code: 'A', kpiCode: 'A1', kpiName: 'K', periodType: 'monthly', weight: 0.4, ownerDept: 'Operations', ownerName: '', ownerEmail: '', ownerPct: 1 },
    ];
    const { groups, conflicts } = app._kpiGroupImportRowsByLineAndCode(validRows);
    assert.equal(conflicts.length, 0);
    assert.equal(groups.length, 2, 'A1 on L3 and A1 on L4 are genuinely different KPI instances, must stay separate');
});

test('_kpiGroupImportRowsByLineAndCode flags a CONFLICT instead of silently merging when the same (Line, KPI Code) is reused for two unrelated KPIs with different names', () => {
    // This reproduces the actual reported bug: if KPI code numbering
    // restarts per department in the source spreadsheet (e.g. both
    // Public Relations and Operations independently use "L3/A1" for
    // their own first KPI), naively merging by (line, kpiCode) alone
    // would combine two unrelated owners into one KPI — silently
    // misattributing one department's KPI to the other's directorate.
    const app = buildKpiApp();
    const validRows = [
        { line: 'L3', code: 'A', kpiCode: 'A1', kpiName: 'Passenger satisfaction', periodType: 'quarterly', weight: 0.4, ownerDept: 'Public Relations', ownerName: 'HANI ALHARBI', ownerEmail: 'h@x.com', ownerPct: 1 },
        { line: 'L3', code: 'A', kpiCode: 'A1', kpiName: 'Track maintenance backlog', periodType: 'monthly', weight: 0.3, ownerDept: 'Operations', ownerName: 'SOME MANAGER', ownerEmail: 'm@x.com', ownerPct: 1 },
    ];
    const { groups, conflicts } = app._kpiGroupImportRowsByLineAndCode(validRows);
    assert.equal(groups.length, 0, 'the conflicting key must NOT be merged into a group at all');
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].line, 'L3');
    assert.equal(conflicts[0].kpiCode, 'A1');
    assert.deepEqual(conflicts[0].names.sort(), ['Passenger satisfaction', 'Track maintenance backlog'].sort());
});

// ════════════════════════════════════════════════════════════════════
// Weight hierarchy (Area / Level 1 / Level 2 / Level 3 %) and Final
// Weight — a separate layer from Directorate/Line/Owner, per explicit
// correction: it must never change dashboards, Enter Results, or the
// existing directorate structure, only feed each KPI's Final Weight.
// ════════════════════════════════════════════════════════════════════

test('_kpiFinalWeight multiplies Area % x Level 1 % x Level 2 % x Level 3 % — reproduces the real "Condition of Trains" (D1) example', () => {
    const app = buildKpiApp();
    const kpiDef = { area_pct: 0.25, level1_pct: 1, level2_pct: 0.3, level3_pct: 1 };
    assert.equal(app._kpiFinalWeight(kpiDef), 0.25 * 1 * 0.3 * 1);
    assert.equal(Math.round(app._kpiFinalWeight(kpiDef) * 1000) / 1000, 0.075, 'matches the verified 7.5% from the source file');
});

test('_kpiFinalWeight returns null (not 0) when any part of the hierarchy is missing', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiFinalWeight({ area_pct: 0.3, level1_pct: 0.5, level2_pct: null, level3_pct: 1 }), null);
    assert.equal(app._kpiFinalWeight({ area_pct: null, level1_pct: null, level2_pct: null, level3_pct: null }), null);
    assert.equal(app._kpiFinalWeight(null), null);
});

test('_kpiParseWeightImportRows forward-fills Area/Level 1/Level 2 across blank rows, matching the source file\'s own convention', () => {
    const app = buildKpiApp();
    const rawRows = [
        { Line: '', 'KPI Code': 'A1', Area: 'Operations', 'Area %': '30%', 'Level 1': 'Passenger Satisfaction', 'Level 1 %': '50%', 'Level 2': 'Passenger Satisfaction', 'Level 2 %': '50%', 'KPI Name': 'Passenger satisfaction', 'Level 3%': '40%' },
        { Line: '', 'KPI Code': 'A2', Area: '', 'Area %': '', 'Level 1': '', 'Level 1 %': '', 'Level 2': '', 'Level 2 %': '', 'KPI Name': 'Complaints resolution', 'Level 3%': '20%' },
    ];
    const { validRows, invalidRows } = app._kpiParseWeightImportRows(rawRows);
    assert.equal(invalidRows.length, 0);
    assert.equal(validRows.length, 2);
    assert.equal(validRows[1].area, 'Operations', 'A2 inherits Area from A1 above it');
    assert.equal(validRows[1].areaPct, 0.3);
    assert.equal(validRows[1].level2, 'Passenger Satisfaction');
    assert.equal(validRows[1].level3Pct, 0.2, 'Level 3 % is NOT forward-filled — always its own row value');
});

test('_kpiParseWeightImportRows treats a blank Line as "applies to every line", not an error — unlike the owner/threshold imports', () => {
    const app = buildKpiApp();
    const rawRows = [
        { Line: '', 'KPI Code': 'D1', Area: 'Transit System Maintenance', 'Area %': '25%', 'Level 1': 'Transit system maintenance', 'Level 1 %': '100%', 'Level 2': 'Trains inspection', 'Level 2 %': '30%', 'KPI Name': 'Condition of Trains', 'Level 3%': '100%' },
    ];
    const { validRows, invalidRows } = app._kpiParseWeightImportRows(rawRows);
    assert.equal(invalidRows.length, 0);
    assert.equal(validRows[0].line, null);
});

test('_kpiParseWeightImportRows still validates an explicit invalid Line when one IS given', () => {
    const app = buildKpiApp();
    const rawRows = [
        { Line: '9', 'KPI Code': 'A1', Area: 'Operations', 'Area %': '30%', 'Level 1': 'X', 'Level 1 %': '50%', 'Level 2': 'Y', 'Level 2 %': '50%', 'KPI Name': 'K', 'Level 3%': '40%' },
    ];
    const { validRows, invalidRows } = app._kpiParseWeightImportRows(rawRows);
    assert.equal(validRows.length, 0);
    assert.equal(invalidRows.length, 1);
    assert.match(invalidRows[0].errors[0], /Invalid Line value/);
});

test('importKpiWeightData with no Line updates EVERY existing line-instance of that KPI code', async () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Transit System Maintenance', company: 'OMC' }],
        kpiDefinitions: [
            { id: 1, directorate_id: 10, department_id: null, kpi_code: 'D1', name: 'Condition of Trains', category: '', unit: '', direction: 'higher_is_better', period_type: 'monthly', target_value: 95 },
            { id: 2, directorate_id: 10, department_id: null, kpi_code: 'D1', name: 'Condition of Trains', category: '', unit: '', direction: 'higher_is_better', period_type: 'monthly', target_value: 95 },
        ],
        kpiOwners: [],
    });
    app.supabase = {};
    const saveCalls = [];
    app.saveKpiDefinition = async (def, existingId) => { saveCalls.push({ def, existingId }); return { id: existingId, ...def }; };
    app.showToast = () => {};

    const result = await app.importKpiWeightData([
        { line: null, kpiCode: 'D1', area: 'Transit System Maintenance', areaPct: 0.25, level1: 'Transit system maintenance', level1Pct: 1, level2: 'Trains inspection', level2Pct: 0.3, level3Pct: 1 },
    ], 'OMC');

    assert.equal(result.updated, 2, 'both line-instances of D1 got updated');
    assert.equal(saveCalls.length, 2);
    assert.equal(saveCalls[0].def.areaPct, 0.25);
});

test('importKpiWeightData with a Line specified updates ONLY that one line-instance', async () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [
            { id: 100, directorate_id: 10, department_name: 'L3' },
            { id: 101, directorate_id: 10, department_name: 'L4' },
        ],
        kpiDefinitions: [
            { id: 1, directorate_id: 10, department_id: 100, kpi_code: 'A1', name: 'K', category: '', unit: '', direction: 'higher_is_better', period_type: 'monthly', target_value: 90 },
            { id: 2, directorate_id: 10, department_id: 101, kpi_code: 'A1', name: 'K', category: '', unit: '', direction: 'higher_is_better', period_type: 'monthly', target_value: 90 },
        ],
        kpiOwners: [],
    });
    app.supabase = {};
    const saveCalls = [];
    app.saveKpiDefinition = async (def, existingId) => { saveCalls.push({ def, existingId }); return { id: existingId, ...def }; };
    app.showToast = () => {};

    const result = await app.importKpiWeightData([
        { line: 'L3', kpiCode: 'A1', area: 'Operations', areaPct: 0.3, level1: 'X', level1Pct: 1, level2: 'Y', level2Pct: 1, level3Pct: 1 },
    ], 'OMC');

    assert.equal(result.updated, 1);
    assert.equal(saveCalls.length, 1);
    assert.equal(saveCalls[0].existingId, 1, 'only the L3 instance (id 1) was touched, not L4 (id 2)');
});

test('importKpiWeightData reports notFound for a KPI code with no match, rather than silently skipping', async () => {
    const app = buildKpiApp({ kpiDirectorates: [], kpiDefinitions: [], kpiOwners: [] });
    app.supabase = {};
    app.showToast = () => {};
    const result = await app.importKpiWeightData([
        { line: null, kpiCode: 'ZZZ', area: 'A', areaPct: 1, level1: 'B', level1Pct: 1, level2: 'C', level2Pct: 1, level3Pct: 1 },
    ], 'OMC');
    assert.equal(result.notFound, 1);
    assert.equal(result.updated, 0);
});

// ════════════════════════════════════════════════════════════════════
// Factor Score / Final KPI — the piecewise 0-2 scoring formula from
// Levels_Formula.xlsx, plus the "auto-calculated but user-overridable"
// Final KPI requirement. Test values below are taken directly from real
// rows in the source spreadsheet to confirm the JS matches Excel exactly.
// ════════════════════════════════════════════════════════════════════

test('_kpiFactorScore matches the source spreadsheet exactly for higher_is_better KPIs (A2, D2)', () => {
    const app = buildKpiApp();
    // A2: Complaints resolution — S=1, T=0.83, U=0.58, R=0.9927 -> ~1.9571
    assert.equal(Math.round(app._kpiFactorScore(0.9927, 1, 0.83, 0.58, 'higher_is_better') * 10000) / 10000, 1.9571);
    // D2: Transit System Preventive Maintenance — S=1, T=0.95, U=0.85, R=0.9943 -> ~1.886
    assert.equal(Math.round(app._kpiFactorScore(0.9943, 1, 0.95, 0.85, 'higher_is_better') * 1000) / 1000, 1.886);
});

test('_kpiFactorScore matches the source spreadsheet exactly for lower_is_better KPIs (A3, F1)', () => {
    const app = buildKpiApp();
    // A3: Complaints per boarding — S=5, T=20, U=50, R=16.02 -> ~1.2653
    assert.equal(Math.round(app._kpiFactorScore(16.02, 5, 20, 50, 'lower_is_better') * 10000) / 10000, 1.2653);
    // F1: Injury Frequency Rate — S=1.8, T=3.8, U=6.2, R=0.09 (way below Exceptional) -> capped at 2
    assert.equal(app._kpiFactorScore(0.09, 1.8, 3.8, 6.2, 'lower_is_better'), 2);
});

test('_kpiFactorScore hits all five bands: at/beyond Unacceptable=0, linear 0-1, exactly Acceptable=1, linear 1-2, at/beyond Exceptional=2', () => {
    const app = buildKpiApp();
    // higher_is_better: S=0.95, T=0.85 (Acceptable/target), U=0.75
    assert.equal(app._kpiFactorScore(0.75, 0.95, 0.85, 0.75, 'higher_is_better'), 0, 'at Unacceptable');
    assert.equal(app._kpiFactorScore(0.70, 0.95, 0.85, 0.75, 'higher_is_better'), 0, 'below Unacceptable');
    assert.equal(Math.round(app._kpiFactorScore(0.80, 0.95, 0.85, 0.75, 'higher_is_better') * 1000) / 1000, 0.5, 'halfway between Unacceptable and Acceptable');
    assert.equal(app._kpiFactorScore(0.85, 0.95, 0.85, 0.75, 'higher_is_better'), 1, 'exactly Acceptable');
    assert.equal(Math.round(app._kpiFactorScore(0.90, 0.95, 0.85, 0.75, 'higher_is_better') * 1000) / 1000, 1.5, 'halfway between Acceptable and Exceptional');
    assert.equal(app._kpiFactorScore(0.95, 0.95, 0.85, 0.75, 'higher_is_better'), 2, 'at Exceptional');
    assert.equal(app._kpiFactorScore(1.00, 0.95, 0.85, 0.75, 'higher_is_better'), 2, 'beyond Exceptional, capped at 2');
});

test('_kpiFactorScore returns null when any threshold or the result is missing, rather than throwing or guessing', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiFactorScore(null, 1, 0.95, 0.85, 'higher_is_better'), null);
    assert.equal(app._kpiFactorScore(0.9, null, 0.95, 0.85, 'higher_is_better'), null);
    assert.equal(app._kpiFactorScore(0.9, 1, null, 0.85, 'higher_is_better'), null);
    assert.equal(app._kpiFactorScore(0.9, 1, 0.95, null, 'higher_is_better'), null);
});

test('_kpiFactorScore returns null for degenerate thresholds (Acceptable equal to Exceptional or Unacceptable) instead of dividing by zero', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiFactorScore(0.9, 0.95, 0.95, 0.85, 'higher_is_better'), null, 'Acceptable == Exceptional');
    assert.equal(app._kpiFactorScore(0.9, 0.95, 0.85, 0.85, 'higher_is_better'), null, 'Acceptable == Unacceptable');
});

test('saveKpiResult: Final KPI auto-follows a freshly computed Factor Score when there is no prior override', async () => {
    const app = buildKpiApp({
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: null, target_value: 0.85, exceptional_value: 0.95, unacceptable_value: 0.75, direction: 'higher_is_better', name: 'K' }],
        kpiResults: [],
    });
    app.supabase = { from: () => ({ upsert: () => ({ select: async () => ({ data: [{ id: 1, kpi_definition_id: 1, period_label: '2027-01', factor_score: 1, final_kpi: 1 }], error: null }) }) }) };
    app._tid = () => 'tenant1';
    app.showToast = () => {};

    const saved = await app.saveKpiResult(1, { year: 2027, periodType: 'monthly', periodValue: '01', actualValue: 0.85, remarks: '' });
    assert.equal(saved.factor_score, 1);
    assert.equal(saved.final_kpi, 1, 'no prior override exists, so Final KPI follows the computed Factor Score');
});

test('saveKpiResult: re-saving a result PRESERVES a manually overridden Final KPI instead of resetting it', async () => {
    const app = buildKpiApp({
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: null, target_value: 0.85, exceptional_value: 0.95, unacceptable_value: 0.75, direction: 'higher_is_better', name: 'K' }],
        // Existing result whose Final KPI (1.9) was manually overridden away from its last Factor Score (1.0)
        kpiResults: [{ id: 1, kpi_definition_id: 1, period_label: '2027-01', factor_score: 1, final_kpi: 1.9 }],
    });
    let upsertedRow = null;
    app.supabase = { from: () => ({ upsert: (row) => { upsertedRow = row; return { select: async () => ({ data: [{ id: 1, ...row }], error: null }) }; } }) };
    app._tid = () => 'tenant1';
    app.showToast = () => {};

    // Planner corrects the actual value slightly — Factor Score recomputes, but the override must survive.
    const saved = await app.saveKpiResult(1, { year: 2027, periodType: 'monthly', periodValue: '01', actualValue: 0.86, remarks: '' });
    assert.notEqual(upsertedRow.factor_score, 1.9, 'factor_score itself is freshly recomputed, not frozen');
    assert.equal(saved.final_kpi, 1.9, 'the manual override survives a re-save of the underlying result');
});

test('overrideKpiFinalScore updates ONLY final_kpi, leaving factor_score/actual_value/achievement untouched', async () => {
    const app = buildKpiApp({
        kpiResults: [{ id: 1, kpi_definition_id: 1, period_label: '2027-01', actual_value: 0.9, factor_score: 1.5, final_kpi: 1.5, achievement: 105.88 }],
    });
    let updatePayload = null;
    app.supabase = { from: () => ({ update: (payload) => { updatePayload = payload; return { eq: () => ({ select: async () => ({ data: [{ id: 1, kpi_definition_id: 1, period_label: '2027-01', actual_value: 0.9, factor_score: 1.5, final_kpi: 1.9, achievement: 105.88 }], error: null }) }) }; } }) };
    app.showToast = () => {};

    const saved = await app.overrideKpiFinalScore(1, 1.9);
    assert.deepEqual(Object.keys(updatePayload), ['final_kpi'], 'only final_kpi is sent to the database');
    assert.equal(saved.final_kpi, 1.9);
    assert.equal(saved.factor_score, 1.5, 'factor_score is unchanged');
    assert.equal(saved.actual_value, 0.9, 'actual_value is unchanged');
});

test('_kpiBenchmarkLabel matches the source spreadsheet\'s Benchmark column exactly for higher_is_better KPIs (A2, A4)', () => {
    const app = buildKpiApp();
    // A2: S=1, U=0.58, R=0.9927 -> below Exceptional, above Unacceptable -> Acceptable
    assert.equal(app._kpiBenchmarkLabel(0.9927, 1, 0.58, 'higher_is_better'), 'Acceptable');
    // A4: S=0.98, U=0.9, R=0.9996 -> at/beyond Exceptional
    assert.equal(app._kpiBenchmarkLabel(0.9996, 0.98, 0.9, 'higher_is_better'), 'Exceptional');
});

test('_kpiBenchmarkLabel matches the source spreadsheet exactly for lower_is_better KPIs (A3, F1)', () => {
    const app = buildKpiApp();
    // A3: S=5, U=50, R=16.02 -> between Exceptional and Unacceptable -> Acceptable
    assert.equal(app._kpiBenchmarkLabel(16.02, 5, 50, 'lower_is_better'), 'Acceptable');
    // F1: S=1.8, U=6.2, R=0.09 -> at/beyond Exceptional (lower is better, so <= S)
    assert.equal(app._kpiBenchmarkLabel(0.09, 1.8, 6.2, 'lower_is_better'), 'Exceptional');
});

test('_kpiBenchmarkLabel: Unacceptable at and beyond the threshold, both directions', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiBenchmarkLabel(90, 100, 90, 'higher_is_better'), 'Unacceptable', 'exactly at U counts as Unacceptable');
    assert.equal(app._kpiBenchmarkLabel(25, 100, 90, 'higher_is_better'), 'Unacceptable', 'well below U');
    assert.equal(app._kpiBenchmarkLabel(50, 5, 50, 'lower_is_better'), 'Unacceptable', 'exactly at U counts as Unacceptable (lower_is_better)');
});

test('_kpiBenchmarkLabel returns null when Exceptional or Unacceptable is missing, never guesses', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiBenchmarkLabel(90, null, 85, 'higher_is_better'), null);
    assert.equal(app._kpiBenchmarkLabel(90, 100, null, 'higher_is_better'), null);
    assert.equal(app._kpiBenchmarkLabel(null, 100, 85, 'higher_is_better'), null);
});

// ════════════════════════════════════════════════════════════════════
// MGT Ratio Per Line (AMEEN (1).xlsx, M31_IWF sheet) — verified
// byte-exact against the real KPI Month 31 snapshot.
// ════════════════════════════════════════════════════════════════════

test('_kpiMPercFromFactor matches all four real M31_IWF values exactly', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiMPercFromFactor(1.6839), 0.066839);
    assert.equal(app._kpiMPercFromFactor(1.7984), 0.067984);
    assert.equal(app._kpiMPercFromFactor(1.7778), 0.067778);
    assert.equal(app._kpiMPercFromFactor(1.8028), 0.068028);
});

test('_kpiMPercFromFactor hits all five bands: 0=1%, 0-1 linear, 1=6%, 1-2 linear, >=2=7%', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiMPercFromFactor(0), 0.01);
    assert.equal(Math.round(app._kpiMPercFromFactor(0.5) * 100000) / 100000, 0.035);
    assert.equal(app._kpiMPercFromFactor(1), 0.06);
    assert.equal(Math.round(app._kpiMPercFromFactor(1.5) * 100000) / 100000, 0.065);
    assert.equal(app._kpiMPercFromFactor(2), 0.07);
    assert.equal(app._kpiMPercFromFactor(2.5), 0.07, 'capped at 7% beyond 2');
});

test('_kpiMPercFromFactor returns null for a missing/non-numeric input, not a guess', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiMPercFromFactor(null), null);
    assert.equal(app._kpiMPercFromFactor(undefined), null);
});

test('_kpiLineStationRatio matches the real M31 station split exactly (22/9/12/11 of 54 total)', () => {
    const app = buildKpiApp({
        kpiLineStationCounts: [
            { kpi_month_no: 31, line: 'L3', station_count: 22 },
            { kpi_month_no: 31, line: 'L4', station_count: 9 },
            { kpi_month_no: 31, line: 'L5', station_count: 12 },
            { kpi_month_no: 31, line: 'L6', station_count: 11 },
        ],
    });
    assert.equal(Math.round(app._kpiLineStationRatio('L3', 31) * 1e6) / 1e6, 0.407407);
    assert.equal(Math.round(app._kpiLineStationRatio('L4', 31) * 1e6) / 1e6, 0.166667);
    assert.equal(app._kpiLineStationRatio('L3', 99), null, 'no station data for that month');
});

test('_kpiLineFactorScore: a weighted average by Final Weight, normalized by the weight of KPIs that actually reported this month', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [
            { id: 1, directorate_id: 10, department_id: 100, is_active: true, area_pct: 0.6, level1_pct: 1, level2_pct: 1, level3_pct: 1 }, // Final Weight 0.6
            { id: 2, directorate_id: 10, department_id: 100, is_active: true, area_pct: 0.4, level1_pct: 1, level2_pct: 1, level3_pct: 1 }, // Final Weight 0.4
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2026, period_value: '05', factor_score: 2.0 },
            { kpi_definition_id: 2, year: 2026, period_value: '05', factor_score: 1.0 },
        ],
        kpiFeePeriods: [{ kpi_month_no: 31, kpi_year: 2026, kpi_cal_month: 5 }],
    });
    // (0.6*2.0 + 0.4*1.0) / (0.6+0.4) = 1.6
    assert.equal(app._kpiLineFactorScore('L3', 31, 10), 1.6);
});

test('_kpiLineFactorScore excludes a KPI with no result this month from the average, rather than treating it as 0', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [
            { id: 1, directorate_id: 10, department_id: 100, is_active: true, area_pct: 0.5, level1_pct: 1, level2_pct: 1, level3_pct: 1 },
            { id: 2, directorate_id: 10, department_id: 100, is_active: true, area_pct: 0.5, level1_pct: 1, level2_pct: 1, level3_pct: 1 },
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2026, period_value: '05', factor_score: 2.0 },
            // KPI 2 has no result for this month at all
        ],
        kpiFeePeriods: [{ kpi_month_no: 31, kpi_year: 2026, kpi_cal_month: 5 }],
    });
    assert.equal(app._kpiLineFactorScore('L3', 31, 10), 2.0, 'normalized by the weight actually present (0.5), not diluted to 1.0 by a missing KPI');
});

test('_kpiLineFactorScore is scoped per-directorate when a directorateId is given, and company-wide when omitted', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [
            { id: 100, directorate_id: 10, department_name: 'L3' },
            { id: 200, directorate_id: 20, department_name: 'L3' },
        ],
        kpiDefinitions: [
            { id: 1, directorate_id: 10, department_id: 100, is_active: true, area_pct: 1, level1_pct: 1, level2_pct: 1, level3_pct: 1 },
            { id: 2, directorate_id: 20, department_id: 200, is_active: true, area_pct: 1, level1_pct: 1, level2_pct: 1, level3_pct: 1 },
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2026, period_value: '05', factor_score: 2.0 },
            { kpi_definition_id: 2, year: 2026, period_value: '05', factor_score: 0.0 },
        ],
        kpiFeePeriods: [{ kpi_month_no: 31, kpi_year: 2026, kpi_cal_month: 5 }],
    });
    assert.equal(app._kpiLineFactorScore('L3', 31, 10), 2.0, 'directorate 10 only sees its own KPI');
    assert.equal(app._kpiLineFactorScore('L3', 31, 20), 0.0, 'directorate 20 only sees its own KPI');
    assert.equal(app._kpiLineFactorScore('L3', 31, null), 1.0, 'company-wide averages across both directorates');
});

test('_kpiMgtRatioPerLine reproduces the real M31_IWF table exactly, including the 6.7481% total', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [
            { id: 100, directorate_id: 10, department_name: 'L3' },
            { id: 101, directorate_id: 10, department_name: 'L4' },
            { id: 102, directorate_id: 10, department_name: 'L5' },
            { id: 103, directorate_id: 10, department_name: 'L6' },
        ],
        kpiDefinitions: [
            { id: 1, directorate_id: 10, department_id: 100, is_active: true, area_pct: 1, level1_pct: 1, level2_pct: 1, level3_pct: 1 },
            { id: 2, directorate_id: 10, department_id: 101, is_active: true, area_pct: 1, level1_pct: 1, level2_pct: 1, level3_pct: 1 },
            { id: 3, directorate_id: 10, department_id: 102, is_active: true, area_pct: 1, level1_pct: 1, level2_pct: 1, level3_pct: 1 },
            { id: 4, directorate_id: 10, department_id: 103, is_active: true, area_pct: 1, level1_pct: 1, level2_pct: 1, level3_pct: 1 },
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2026, period_value: '05', factor_score: 1.6839 },
            { kpi_definition_id: 2, year: 2026, period_value: '05', factor_score: 1.7984 },
            { kpi_definition_id: 3, year: 2026, period_value: '05', factor_score: 1.7778 },
            { kpi_definition_id: 4, year: 2026, period_value: '05', factor_score: 1.8028 },
        ],
        kpiFeePeriods: [{ kpi_month_no: 31, kpi_year: 2026, kpi_cal_month: 5 }],
        kpiLineStationCounts: [
            { kpi_month_no: 31, line: 'L3', station_count: 22 },
            { kpi_month_no: 31, line: 'L4', station_count: 9 },
            { kpi_month_no: 31, line: 'L5', station_count: 12 },
            { kpi_month_no: 31, line: 'L6', station_count: 11 },
        ],
    });
    const { rows, total } = app._kpiMgtRatioPerLine(31, 10);
    assert.equal(rows.length, 4);
    assert.equal(rows[0].line, 'L3');
    assert.equal(rows[0].stations, 22);
    assert.equal(Math.round(rows[0].weighted * 1e6) / 1e6, 0.027231, 'Line 3 weighted contribution');
    assert.equal(Math.round(total * 1e4) / 1e4, 0.0675, 'total rounds to the real 6.75%');
});

test('_kpiParseStationCountRows matches the real Stations sheet format exactly', () => {
    const app = buildKpiApp();
    const rows = app._kpiParseStationCountRows([
        { 'Fiscal Month': 'M31', 'Fiscal Month No': '31', 'Line': '3', 'No. of Stations': '22', 'Remarks': '', 'Key': 'M31|3' },
        { 'Fiscal Month': 'M31', 'Fiscal Month No': '31', 'Line': '4', 'No. of Stations': '9', 'Remarks': '', 'Key': 'M31|4' },
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].kpi_month_no, 31);
    assert.equal(rows[0].line, 'L3');
    assert.equal(rows[0].station_count, 22);
});

test('_kpiMgtRatioPerLineAnnual sums (not averages) each month\'s Weighted Contribution across the whole year — identical data in 2 months doubles the total', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, is_active: true, area_pct: 1, level1_pct: 1, level2_pct: 1, level3_pct: 1 }],
        kpiResults: [
            { kpi_definition_id: 1, year: 2026, period_value: '05', factor_score: 1.5 },
            { kpi_definition_id: 1, year: 2026, period_value: '06', factor_score: 1.5 },
        ],
        kpiFeePeriods: [
            { kpi_month_no: 31, kpi_year: 2026, kpi_cal_month: 5, kpi_fiscal_month: 'M31' },
            { kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6, kpi_fiscal_month: 'M32' },
        ],
        kpiLineStationCounts: [
            { kpi_month_no: 31, line: 'L3', station_count: 10 },
            { kpi_month_no: 32, line: 'L3', station_count: 10 },
        ],
    });
    const singleMonth = app._kpiMgtRatioPerLine(31, 10);
    const annual = app._kpiMgtRatioPerLineAnnual(2026, 10);
    // Both months are identical, so the annual sum should be exactly 2x one month's total
    assert.equal(Math.round(annual.total * 1e8) / 1e8, Math.round(singleMonth.total * 2 * 1e8) / 1e8);
    assert.equal(annual.rows[0].monthsCounted, 2);
    assert.equal(annual.monthsInYearCount, 2);
});

test('_kpiMgtRatioPerLineAnnual only counts months that actually have both a station count and a KPIFt', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, is_active: true, area_pct: 1, level1_pct: 1, level2_pct: 1, level3_pct: 1 }],
        kpiResults: [
            { kpi_definition_id: 1, year: 2026, period_value: '05', factor_score: 1.5 },
            // No result at all for month 32
        ],
        kpiFeePeriods: [
            { kpi_month_no: 31, kpi_year: 2026, kpi_cal_month: 5, kpi_fiscal_month: 'M31' },
            { kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6, kpi_fiscal_month: 'M32' },
        ],
        kpiLineStationCounts: [
            { kpi_month_no: 31, line: 'L3', station_count: 10 },
            { kpi_month_no: 32, line: 'L3', station_count: 10 },
        ],
    });
    const annual = app._kpiMgtRatioPerLineAnnual(2026, 10);
    assert.equal(annual.rows[0].monthsCounted, 1, 'only May counted, June had no KPIFt');
    assert.equal(annual.monthsInYearCount, 2, 'but the year still has 2 KPI Months in the calendar');
});

test('_kpiMgtRatioPerLineAnnual returns zero totals with monthsInYearCount 0 for a year with no imported fee calendar', () => {
    const app = buildKpiApp();
    const annual = app._kpiMgtRatioPerLineAnnual(2099, 10);
    assert.equal(annual.total, 0);
    assert.equal(annual.monthsInYearCount, 0);
});

// ════════════════════════════════════════════════════════════════════
// Financial Calendar & Partner Allocation (Master_File.xlsx) — Period
// KPI vs Fees, Line FFt lag/status schedule, and the HIT/FS/ALS partner
// split. End goal: compute each partner's allocated share of a KPI's
// actual Final KPI/Factor score.
// ════════════════════════════════════════════════════════════════════

test('_kpiParseDateCell parses the source file\'s "26-Nov-2023" format into ISO, not via ambiguous Date parsing', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiParseDateCell('26-Nov-2023'), '2023-11-26');
    assert.equal(app._kpiParseDateCell('5-Jan-2024'), '2024-01-05');
    assert.equal(app._kpiParseDateCell(''), null);
    assert.equal(app._kpiParseDateCell('garbage'), null);
});

test('_kpiParseFeePeriodRows: the fee month is always 1 month ahead of the KPI month, per the real file\'s first row', () => {
    const app = buildKpiApp();
    const rows = app._kpiParseFeePeriodRows([{
        'KPI Month No': '1', 'KPI Fiscal Month': 'M1', 'KPI Month Period Start': '26-Nov-2023', 'KPI Month Period End': '25-Dec-2023',
        'KPI Month Year': '2023', 'KPI Cal Month': '11', 'KPI Month Name': 'Nov', 'KPI Cal Quarter': 'Q4', 'KPI Fiscal Year': '1', 'KPI Fiscal Quarter': 'Q1',
        'KPI Fixed Fee No': '2', 'KPI Fixed Fee Month': 'M2', 'KPI Fixed Fee Period Start': '26-Dec-2023', 'KPI Fixed Fee Period End': '25-Jan-2024',
        'KPI Fixed Fee Year': '2024', 'KPI Fixed Fee Cal Month': '12', 'KPI Fixed Fee Name': 'Dec', 'KPI Fixed Fee Cal Quarter': 'Q4',
        'KPI Fixed Fee Fiscal Year': '1', 'KPI Fixed Fee Fiscal Quarter': 'Q1', 'KPI Fixed Fee Difference (Months)': '1',
    }]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].kpi_month_no, 1);
    assert.equal(rows[0].fee_month_no, 2);
    assert.equal(rows[0].kpi_period_start, '2023-11-26');
    assert.equal(rows[0].fee_diff_months, 1);
});

test('_kpiFeePeriodForCalendarDate looks up by calendar year+month, not fiscal date-range math', () => {
    const app = buildKpiApp({
        kpiFeePeriods: [{ kpi_year: 2023, kpi_cal_month: 11, kpi_month_no: 1, fee_month_no: 2 }],
    });
    const found = app._kpiFeePeriodForCalendarDate(2023, 11);
    assert.equal(found.fee_month_no, 2);
    assert.equal(app._kpiFeePeriodForCalendarDate(2023, 12), null, 'no match for a month not in the calendar');
});

test('_kpiFeePeriodForCalendarDate matches even when Supabase returns kpi_year/kpi_cal_month as strings, or the caller passes a string year — this exact mismatch was silently breaking every KPI Month/Fee Month lookup in Enter Results', () => {
    const app = buildKpiApp({
        // Reproduces Supabase's real behavior for some numeric column types
        kpiFeePeriods: [{ kpi_year: '2027', kpi_cal_month: '1', kpi_month_no: 39, fee_month_no: 40 }],
    });
    // Caller side: r.year from a saved kpi_results row could also arrive as a string
    const found = app._kpiFeePeriodForCalendarDate('2027', 1);
    assert.notEqual(found, null, 'must match despite the string/number type mismatch on both sides');
    assert.equal(found.fee_month_no, 40);
});

test('_kpiLineFeeStatus matches even when kpi_month_no comes back as a string from Supabase', () => {
    const app = buildKpiApp({
        kpiLineFeeSchedule: [{ fee_stream: 'Line 3 FFt', kpi_month_no: '-12', status: 'Pre-project' }],
    });
    assert.equal(app._kpiLineFeeStatus('L3', -12), 'Pre-project');
});

test('_kpiParseLineFeeScheduleRows: "-" placeholder cells become null, not the string "-" or NaN', () => {
    const app = buildKpiApp();
    const rows = app._kpiParseLineFeeScheduleRows([{
        'Report Month No': '1', 'Report Fiscal Month': 'M1', 'Year': '2023', 'Fiscal Year': '1', 'KPI Fiscal Quarter': 'Q1',
        'Fee Stream': 'Line 3 FFt', 'Lag (Months)': '13', 'KPI Month No': '-12', 'KPI Fiscal Month': '-',
        'Fixed Fee Month No': '-11', 'Fixed Fee Fiscal Month': '-', 'Status': 'Pre-project',
    }]);
    assert.equal(rows[0].kpi_month_no, -12, 'negative KPI Month No parses correctly, not treated as invalid');
    assert.equal(rows[0].kpi_fiscal_month, null, '"-" placeholder becomes null');
    assert.equal(rows[0].status, 'Pre-project');
});

test('_kpiLineNameToFeeStream translates this app\'s "L3" naming to the source file\'s "Line 3 FFt"', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiLineNameToFeeStream('L3'), 'Line 3 FFt');
    assert.equal(app._kpiLineNameToFeeStream('L6'), 'Line 6 FFt');
    assert.equal(app._kpiLineNameToFeeStream('Management'), null, 'not a line, no translation');
});

test('_kpiLineFeeStatus finds a line\'s Active/Pre-project status at a given KPI Month, reproducing the real Line 3 pre-project period', () => {
    const app = buildKpiApp({
        kpiLineFeeSchedule: [
            { fee_stream: 'Line 3 FFt', kpi_month_no: -12, status: 'Pre-project' },
            { fee_stream: 'Line 4 FFt', kpi_month_no: 1, status: 'Active' },
        ],
    });
    assert.equal(app._kpiLineFeeStatus('L3', -12), 'Pre-project');
    assert.equal(app._kpiLineFeeStatus('L4', 1), 'Active');
    assert.equal(app._kpiLineFeeStatus('L3', 999), null, 'no schedule row for that month');
});

test('_kpiParsePartnerAllocationRows matches the real A1 row exactly, including the pre-multiplied Allocation HIT/FS/ALS %', () => {
    const app = buildKpiApp();
    const { validRows, invalidRows } = app._kpiParsePartnerAllocationRows([{
        Line: '3', Code: 'A', 'KPI Code': 'A1', 'KPI Name': 'Passenger satisfaction', Frequency: 'Quarterly',
        'Level 3 %': '40%', 'Allocation %': '3.00%', 'HIT%': '25.00%', 'FS%': '25.00%', 'ALS%': '50.00%',
        'Allocation HIT%': '0.75%', 'Allocation FS%': '0.75%', 'Allocation ALS%': '1.50%',
    }]);
    assert.equal(invalidRows.length, 0);
    assert.equal(validRows[0].hitPct, 0.25);
    assert.equal(validRows[0].fsPct, 0.25);
    assert.equal(validRows[0].alsPct, 0.5);
    assert.equal(Math.round(validRows[0].allocationHitPct * 10000) / 10000, 0.0075);
});

test('_kpiParsePartnerAllocationRows: a blank partner % (KPI only involves 2 of 3 partners) parses as null, not 0', () => {
    const app = buildKpiApp();
    const { validRows } = app._kpiParsePartnerAllocationRows([{
        Line: '3', Code: 'A', 'KPI Code': 'A5', 'KPI Name': 'Station environment', Frequency: 'Monthly',
        'Level 3 %': '50%', 'Allocation %': '2.25%', 'HIT%': '50.00%', 'FS%': '50.00%', 'ALS%': '',
        'Allocation HIT%': '1.13%', 'Allocation FS%': '1.13%', 'Allocation ALS%': '0.00%',
    }]);
    assert.equal(validRows[0].alsPct, null, 'ALS is not involved in this KPI at all');
});

test('_kpiPartnerShares splits Final KPI by each partner\'s raw percentage, summing back to the original score', () => {
    const app = buildKpiApp();
    const kpiDef = { hit_pct: 0.25, fs_pct: 0.25, als_pct: 0.5 };
    const shares = app._kpiPartnerShares(kpiDef, 1.5);
    assert.equal(shares.hit, 0.375);
    assert.equal(shares.fs, 0.375);
    assert.equal(shares.als, 0.75);
    assert.equal(shares.hit + shares.fs + shares.als, 1.5, 'the three shares always sum back to the original score');
});

test('_kpiPartnerShares: a partner with no configured share gets null, not 0, distinguishing "uninvolved" from "0%"', () => {
    const app = buildKpiApp();
    const kpiDef = { hit_pct: 0.5, fs_pct: 0.5, als_pct: null };
    const shares = app._kpiPartnerShares(kpiDef, 1.5);
    assert.equal(shares.als, null);
    assert.equal(shares.hit, 0.75);
});

test('_kpiPartnerShares returns all-null when the score itself is missing, rather than guessing', () => {
    const app = buildKpiApp();
    const shares = app._kpiPartnerShares({ hit_pct: 0.25, fs_pct: 0.25, als_pct: 0.5 }, null);
    assert.equal(shares.hit, null);
    assert.equal(shares.fs, null);
    assert.equal(shares.als, null);
});

test('importKpiPartnerAllocation matched by (kpi_code, line), never creates a new KPI, reports notFound for a miss', async () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'A1', name: 'K', category: '', unit: '', direction: 'higher_is_better', period_type: 'monthly', target_value: 90 }],
        kpiOwners: [],
    });
    const saveCalls = [];
    app.supabase = {};
    app.saveKpiDefinition = async (def, existingId) => { saveCalls.push({ def, existingId }); return { id: existingId, ...def }; };
    app.showToast = () => {};

    const result = await app.importKpiPartnerAllocation([
        { line: 'L3', kpiCode: 'A1', allocationPct: 0.03, hitPct: 0.25, fsPct: 0.25, alsPct: 0.5, allocationHitPct: 0.0075, allocationFsPct: 0.0075, allocationAlsPct: 0.015 },
        { line: 'L3', kpiCode: 'ZZZ', hitPct: 1, fsPct: 0, alsPct: 0 },
    ], 'OMC');

    assert.equal(result.updated, 1);
    assert.equal(result.notFound, 1);
    assert.equal(saveCalls.length, 1);
    assert.equal(saveCalls[0].def.hitPct, 0.25);
});

test('_kpiAllocationSharesFromFinalWeight matches the real A1 example exactly: Final Weight (=Allocation %) x each partner % = Allocation HIT/FS/ALS %', () => {
    const app = buildKpiApp();
    // A1: Area 30% x Level1 50% x Level2 50% x Level3 40% = Final Weight 3.00%, matching Allocation % in the sheet
    const kpiDef = { area_pct: 0.30, level1_pct: 0.50, level2_pct: 0.50, level3_pct: 0.40, hit_pct: 0.25, fs_pct: 0.25, als_pct: 0.50 };
    assert.equal(app._kpiFinalWeight(kpiDef), 0.03);
    const shares = app._kpiAllocationSharesFromFinalWeight(kpiDef);
    assert.equal(Math.round(shares.hit * 10000) / 10000, 0.0075);
    assert.equal(Math.round(shares.fs * 10000) / 10000, 0.0075);
    assert.equal(Math.round(shares.als * 10000) / 10000, 0.015);
});

test('_kpiAllocationSharesFromFinalWeight returns all-null when Final Weight itself has no value yet (Weight Hierarchy not configured)', () => {
    const app = buildKpiApp();
    const shares = app._kpiAllocationSharesFromFinalWeight({ area_pct: null, level1_pct: 0.5, level2_pct: 0.5, level3_pct: 0.4, hit_pct: 0.25, fs_pct: 0.25, als_pct: 0.5 });
    assert.equal(shares.hit, null);
    assert.equal(shares.fs, null);
    assert.equal(shares.als, null);
});

test('_kpiAllocationSharesFromFinalWeight is a SEPARATE, static figure from _kpiPartnerShares (which splits a period\'s actual score, not the design-time weight)', () => {
    const app = buildKpiApp();
    const kpiDef = { area_pct: 0.30, level1_pct: 0.50, level2_pct: 0.50, level3_pct: 0.40, hit_pct: 0.25, fs_pct: 0.25, als_pct: 0.50 };
    const staticShares = app._kpiAllocationSharesFromFinalWeight(kpiDef);
    const periodShares = app._kpiPartnerShares(kpiDef, 1.5); // a period's actual Final KPI score
    assert.notEqual(staticShares.hit, periodShares.hit, 'these answer different questions and must not collapse to the same number');
});

test('_kpiDeterminePrimaryOwnerDept returns the dept with the highest ownership %', () => {
    const app = buildKpiApp();
    const owners = [{ dept: 'Operations', pct: 0.9 }, { dept: 'Finance', pct: 0.1 }];
    assert.equal(app._kpiDeterminePrimaryOwnerDept(owners), 'Operations');
});

test('_kpiDeterminePrimaryOwnerDept ties are broken by first-in-list, not alphabetically', () => {
    const app = buildKpiApp();
    const owners = [{ dept: 'Zebra Dept', pct: 0.5 }, { dept: 'Alpha Dept', pct: 0.5 }];
    assert.equal(app._kpiDeterminePrimaryOwnerDept(owners), 'Zebra Dept', 'first in the array wins a tie, alphabetical order must not matter');
});

test('_kpiDeterminePrimaryOwnerDept handles an empty/missing owners list without throwing', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiDeterminePrimaryOwnerDept([]), null);
    assert.equal(app._kpiDeterminePrimaryOwnerDept(null), null);
});

// ════════════════════════════════════════════════════════════════════
// KPI Threshold Excel import — a separate spreadsheet that fills in
// Exceptional/Acceptable/Unacceptable on already-imported KPIs, and
// reveals each KPI's direction from the threshold ordering itself.
// ════════════════════════════════════════════════════════════════════

test('_kpiDeriveDirectionFromThresholds infers higher_is_better when Exceptional > Acceptable > Unacceptable', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiDeriveDirectionFromThresholds(0.95, 0.85, 0.75), 'higher_is_better');
});

test('_kpiDeriveDirectionFromThresholds infers lower_is_better when Exceptional < Acceptable < Unacceptable — reproduces the real "Complaints per boarding" case (5/20/50)', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiDeriveDirectionFromThresholds(5, 20, 50), 'lower_is_better');
});

test('_kpiDeriveDirectionFromThresholds returns null for a non-monotonic or missing ordering, rather than guessing', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiDeriveDirectionFromThresholds(0.85, 0.95, 0.75), null, 'not a consistent order either direction');
    assert.equal(app._kpiDeriveDirectionFromThresholds(0.9, 0.9, 0.9), null, 'all equal is not a valid ordering');
    assert.equal(app._kpiDeriveDirectionFromThresholds(null, 0.85, 0.75), null);
});

test('_kpiParseThresholdImportRow parses a genuinely valid higher-is-better row correctly', () => {
    const app = buildKpiApp();
    const result = app._kpiParseThresholdImportRow({
        'Line': 3, 'Code': 'A', 'KPI Code': 'A1', 'KPI Name': 'Passenger satisfaction',
        'Frequency': 'Quarterly', 'Level 3%': 0.4, 'Unit': '%', 'Exceptional': 0.95, 'Acceptable': 0.85, 'Unacceptable': 0.75,
    });
    assert.equal(result.valid, true);
    assert.equal(result.data.line, 'L3');
    assert.equal(result.data.direction, 'higher_is_better');
    assert.equal(result.data.acceptable, 0.85);
});

test('_kpiParseThresholdNumericValue strips a literal % character but does NOT divide by 100 — keeps values on the same scale a planner would type into the Actual Value field when entering results', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiParseThresholdNumericValue('95.00%'), 95);
    assert.equal(app._kpiParseThresholdNumericValue('83.00%'), 83);
    assert.equal(app._kpiParseThresholdNumericValue('58.00%'), 58);
});

test('_kpiParseThresholdNumericValue treats a plain numeric string with NO % sign as a raw value too — real "Number"-unit case: "20.00" stays 20', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiParseThresholdNumericValue('5.00'), 5);
    assert.equal(app._kpiParseThresholdNumericValue('20.00'), 20);
    assert.equal(app._kpiParseThresholdNumericValue('50.00'), 50);
});

test('_kpiParseThresholdImportRow correctly parses a real-shaped row exactly as the browser\'s SheetJS library actually produces it (percent-formatted strings, not raw decimals)', () => {
    const app = buildKpiApp();
    const result = app._kpiParseThresholdImportRow({
        'Line': '3', 'Code': 'A', 'KPI Code': 'A1', 'KPI Name': 'Passenger satisfaction',
        'Frequency': 'Quarterly', 'Level 3%': '40%', 'Unit': '%',
        'Exceptional': '95.00%', 'Acceptable': '85.00%', 'Unacceptable': '75.00%',
    });
    assert.equal(result.valid, true, `must parse successfully; errors were: ${JSON.stringify(result.errors)}`);
    assert.equal(result.data.acceptable, 85, 'must stay 85, matching the scale a planner enters actual results on — not 0.85');
    assert.equal(result.data.direction, 'higher_is_better');
});

test('_kpiParseThresholdImportRow correctly parses a real-shaped lower-is-better "Number" unit row (A3: "5.00"/"20.00"/"50.00", no % signs)', () => {
    const app = buildKpiApp();
    const result = app._kpiParseThresholdImportRow({
        'Line': '3', 'Code': 'A', 'KPI Code': 'A3', 'KPI Name': 'Complaints per boarding',
        'Frequency': 'Monthly', 'Level 3%': '40%', 'Unit': 'Number',
        'Exceptional': '5.00', 'Acceptable': '20.00', 'Unacceptable': '50.00',
    });
    assert.equal(result.valid, true, `must parse successfully; errors were: ${JSON.stringify(result.errors)}`);
    assert.equal(result.data.acceptable, 20, 'must stay 20, not be divided down to 0.2');
    assert.equal(result.data.direction, 'lower_is_better');
});


test('_kpiParseThresholdImportRow parses a genuinely valid lower-is-better row correctly (real "A3" data: 5/20/50)', () => {
    const app = buildKpiApp();
    const result = app._kpiParseThresholdImportRow({
        'Line': 3, 'Code': 'A', 'KPI Code': 'A3', 'KPI Name': 'Complaints per boarding',
        'Frequency': 'Monthly', 'Level 3%': 0.4, 'Unit': 'Number', 'Exceptional': 5, 'Acceptable': 20, 'Unacceptable': 50,
    });
    assert.equal(result.valid, true);
    assert.equal(result.data.direction, 'lower_is_better');
    assert.equal(result.data.unit, 'Number');
});

test('_kpiParseThresholdImportRow reports an error for missing Acceptable/Unacceptable rather than silently defaulting', () => {
    const app = buildKpiApp();
    const result = app._kpiParseThresholdImportRow({ 'Line': 3, 'KPI Code': 'A1', 'Exceptional': 0.95 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Acceptable')));
    assert.ok(result.errors.some(e => e.includes('Unacceptable')));
});

test('_kpiParseThresholdImportRows separates valid from invalid rows across a batch', () => {
    const app = buildKpiApp();
    const rawRows = [
        { 'Line': 3, 'KPI Code': 'A1', 'Exceptional': 0.95, 'Acceptable': 0.85, 'Unacceptable': 0.75 }, // valid
        { 'Line': 3, 'KPI Code': 'A2', 'Exceptional': 0.5, 'Acceptable': 0.9, 'Unacceptable': 0.6 }, // non-monotonic, invalid
    ];
    const { validRows, invalidRows } = app._kpiParseThresholdImportRows(rawRows);
    assert.equal(validRows.length, 1);
    assert.equal(invalidRows.length, 1);
});

test('_kpiFindExistingKpiByCodeAndLine finds the right KPI by (kpi_code, line) regardless of which directorate it\'s under', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [
            { id: 10, directorate_id: 1, department_name: 'L3' },
            { id: 11, directorate_id: 1, department_name: 'L4' },
            { id: 20, directorate_id: 2, department_name: 'L3' }, // a DIFFERENT directorate's L3 line
        ],
        kpiDefinitions: [
            { id: 100, kpi_code: 'A1', department_id: 10, directorate_id: 1 }, // A1 on L3 under directorate 1
            { id: 101, kpi_code: 'A1', department_id: 11, directorate_id: 1 }, // A1 on L4 under directorate 1
            { id: 102, kpi_code: 'B1', department_id: 20, directorate_id: 2 }, // B1 on L3 under directorate 2
        ],
    });
    const found = app._kpiFindExistingKpiByCodeAndLine('A1', 'L3');
    assert.equal(found.id, 100, 'must find the A1/L3 KPI regardless of not knowing its directorate upfront');
});

test('_kpiFindExistingKpiByCodeAndLine returns null when no matching KPI exists, rather than throwing', () => {
    const app = buildKpiApp({ kpiDirectorateDepartments: [], kpiDefinitions: [] });
    assert.equal(app._kpiFindExistingKpiByCodeAndLine('ZZZ', 'L3'), null);
});

test('_kpiDisplayNameWithLine formats "L3-Staffing Level" — reproduces the exact requested example', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [{ id: 10, directorate_id: 1, department_name: 'L3' }],
    });
    const kpiDef = { name: 'Staffing Level', department_id: 10 };
    assert.equal(app._kpiDisplayNameWithLine(kpiDef), 'L3-Staffing Level');
});

test('_kpiDisplayNameWithLine correctly distinguishes the same KPI name across different lines', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [
            { id: 10, directorate_id: 1, department_name: 'L3' },
            { id: 11, directorate_id: 1, department_name: 'L4' },
        ],
    });
    const kpiOnL3 = { name: 'Staffing Level', department_id: 10 };
    const kpiOnL4 = { name: 'Staffing Level', department_id: 11 };
    assert.equal(app._kpiDisplayNameWithLine(kpiOnL3), 'L3-Staffing Level');
    assert.equal(app._kpiDisplayNameWithLine(kpiOnL4), 'L4-Staffing Level');
});

test('_kpiDisplayNameWithLine falls back to the bare name when the line can\'t be resolved, rather than showing a broken prefix', () => {
    const app = buildKpiApp({ kpiDirectorateDepartments: [] });
    const kpiDef = { name: 'Staffing Level', department_id: 999 };
    assert.equal(app._kpiDisplayNameWithLine(kpiDef), 'Staffing Level');
});

test('_kpiDisplayNameWithLine handles a null/missing KPI without throwing', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiDisplayNameWithLine(null), '');
});

// ════════════════════════════════════════════════════════════════════
// Multi-owner directorate weighting — a KPI's result is allocated across
// each owner's OWN directorate by their ownership percentage (e.g. 95%
// to Operations, 5% to Contracts), matched by owner_dept naming a real
// directorate, scoped to the KPI's company so it can never cross OMC/
// Audit by accident.
// ════════════════════════════════════════════════════════════════════

test('_kpiOwnershipWeight: a KPI with NO owner records is 100% its home directorate, 0 elsewhere', () => {
    const app = buildKpiApp({
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: null }],
        kpiOwners: [],
    });
    const kpiDef = app.state.kpiDefinitions[0];
    assert.equal(app._kpiOwnershipWeight(kpiDef, 10), 1, 'home directorate gets full weight');
    assert.equal(app._kpiOwnershipWeight(kpiDef, 99), 0, 'any other directorate gets none');
});

test('_kpiOwnershipWeight: splits by owner_dept matching directorate name (95%/5% example)', () => {
    const app = buildKpiApp({
        kpiDirectorates: [
            { id: 10, name: 'Operations', company: 'OMC' },
            { id: 20, name: 'Contracts', company: 'OMC' },
        ],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: null, name: 'Condition of Trains (D)' }],
        kpiOwners: [
            { kpi_definition_id: 1, owner_name: 'KAMRUL ISLAM', owner_dept: 'Operations', owner_percentage: 0.95 },
            { kpi_definition_id: 1, owner_name: 'MICHAEL BARRY', owner_dept: 'Contracts', owner_percentage: 0.05 },
        ],
    });
    const kpiDef = app.state.kpiDefinitions[0];
    assert.equal(app._kpiOwnershipWeight(kpiDef, 10), 0.95, 'Operations gets Kamrul\'s 95% share');
    assert.equal(app._kpiOwnershipWeight(kpiDef, 20), 0.05, 'Contracts gets Michael\'s 5% share');
});

test('_kpiOwnershipWeight: an owner_dept that matches no directorate contributes to nobody', () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: null }],
        kpiOwners: [{ kpi_definition_id: 1, owner_dept: 'Nonexistent Dept', owner_percentage: 0.05 }],
    });
    const kpiDef = app.state.kpiDefinitions[0];
    assert.equal(app._kpiOwnershipWeight(kpiDef, 10), 0, 'no owner row named "Operations" -> its home directorate gets nothing either, since the only owner row present is unmatched');
});

test('_kpiOwnershipWeight: owner_dept matching is scoped to the KPI\'s own company, never crosses OMC/Audit', () => {
    const app = buildKpiApp({
        kpiDirectorates: [
            { id: 10, name: 'HSEQ', company: 'OMC' },
            { id: 20, name: 'HSEQ', company: 'Audit' }, // same name, other company
        ],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: null }], // OMC KPI
        kpiOwners: [{ kpi_definition_id: 1, owner_dept: 'HSEQ', owner_percentage: 1 }],
    });
    const kpiDef = app.state.kpiDefinitions[0];
    assert.equal(app._kpiOwnershipWeight(kpiDef, 10), 1, 'matches the OMC HSEQ directorate');
    assert.equal(app._kpiOwnershipWeight(kpiDef, 20), 0, 'does NOT match the Audit HSEQ directorate, despite the same name');
});

test('_kpisForDirectorateDashboard: a shared KPI appears under BOTH owner directorates, each with its own weight', () => {
    const app = buildKpiApp({
        kpiDirectorates: [
            { id: 10, name: 'Operations', company: 'OMC' },
            { id: 20, name: 'Contracts', company: 'OMC' },
        ],
        kpiDefinitions: [
            { id: 1, directorate_id: 10, department_id: null, name: 'Condition of Trains (D)', target_value: 95, is_active: true },
        ],
        kpiOwners: [
            { kpi_definition_id: 1, owner_dept: 'Operations', owner_percentage: 0.95 },
            { kpi_definition_id: 1, owner_dept: 'Contracts', owner_percentage: 0.05 },
        ],
    });
    const opsKpis = app._kpisForDirectorateDashboard(10);
    const contractsKpis = app._kpisForDirectorateDashboard(20);
    assert.equal(opsKpis.length, 1);
    assert.equal(opsKpis[0]._ownershipWeight, 0.95);
    assert.equal(opsKpis[0].target_value, 95 * 0.95, 'target_value is pre-scaled by the weight');
    assert.equal(contractsKpis.length, 1);
    assert.equal(contractsKpis[0]._ownershipWeight, 0.05);
    assert.equal(contractsKpis[0].target_value, 95 * 0.05);
});

test('_kpisForDirectorate (home-only, used by Enter Results/KPIs tab) is NOT affected by ownership splitting', () => {
    // Enter Results must only ever show a KPI under its home directorate
    // — Contracts owning a 5% share doesn't mean Contracts can enter its
    // result too; there is exactly one entry point per KPI.
    const app = buildKpiApp({
        kpiDirectorates: [
            { id: 10, name: 'Operations', company: 'OMC' },
            { id: 20, name: 'Contracts', company: 'OMC' },
        ],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: null, is_active: true }],
        kpiOwners: [
            { kpi_definition_id: 1, owner_dept: 'Operations', owner_percentage: 0.95 },
            { kpi_definition_id: 1, owner_dept: 'Contracts', owner_percentage: 0.05 },
        ],
    });
    assert.equal(app._kpisForDirectorate(10).length, 1, 'still shows under its real home directorate');
    assert.equal(app._kpisForDirectorate(20).length, 0, 'never shows under a minority-owner directorate');
});

test('_kpiScopedResults: scales actual_value/target_value by weight, leaves achievement/status untouched', () => {
    const app = buildKpiApp({
        kpiResults: [
            { id: 1, kpi_definition_id: 1, actual_value: 100, target_value: 95, achievement: 105.26, status: 'on_target' },
        ],
    });
    const scaled = app._kpiScopedResults(1, 0.05);
    assert.equal(scaled[0].actual_value, 5, 'actual scaled to the 5% share');
    assert.equal(scaled[0].target_value, 4.75, 'target scaled the same way');
    assert.equal(scaled[0].achievement, 105.26, 'achievement (a ratio) is unchanged by scaling');
    assert.equal(scaled[0].status, 'on_target', 'status is unchanged by scaling');
});

test('_kpiScopedResults: weight of 1 (or omitted) returns the real rows completely unchanged', () => {
    const app = buildKpiApp({
        kpiResults: [{ id: 1, kpi_definition_id: 1, actual_value: 100, target_value: 95, achievement: 105.26 }],
    });
    const real = app.state.kpiResults;
    assert.deepEqual(app._kpiScopedResults(1, 1), real);
    assert.deepEqual(app._kpiScopedResults(1, undefined), real, 'omitted weight defaults to 1, no scaling');
});

test('_kpiDashboardCards counts a shared KPI toward BOTH owner directorates\' totals, each scoped by weight', () => {
    const app = buildKpiApp({
        kpiDirectorates: [
            { id: 10, name: 'Operations', company: 'OMC' },
            { id: 20, name: 'Contracts', company: 'OMC' },
        ],
        kpiDefinitions: [
            { id: 1, directorate_id: 10, department_id: null, name: 'Condition of Trains (D)', target_value: 95, direction: 'higher_is_better', is_active: true },
        ],
        kpiOwners: [
            { kpi_definition_id: 1, owner_dept: 'Operations', owner_percentage: 0.95 },
            { kpi_definition_id: 1, owner_dept: 'Contracts', owner_percentage: 0.05 },
        ],
        kpiResults: [
            { id: 1, kpi_definition_id: 1, year: 2027, actual_value: 100, target_value: 95, status: 'on_target', entered_at: '2027-01-01' },
        ],
    });
    const opsCards = app._kpiDashboardCards(10, 2027);
    const contractsCards = app._kpiDashboardCards(20, 2027);
    assert.equal(opsCards.total, 1, 'Operations sees the KPI as one of its own');
    assert.equal(opsCards.achieved, 1);
    assert.equal(contractsCards.total, 1, 'Contracts ALSO sees it as one of its own, via its 5% share');
    assert.equal(contractsCards.achieved, 1, 'status is on_target for Contracts too — a ratio, unaffected by the smaller share');
});

test('_kpiParseAvailabilityFactorRows matches the real M32_AFctr data exactly, including the raw/adjusted duplicate-header split', () => {
    const app = buildKpiApp();
    const rows = [
        [null, null, null, 'Line', null, 'PSA', 'TSA', 'FOSA', null, 'Line', null, 'PSA', 'TSA', 'FOSA', null],
        [null, null, null, 'Line 3', null, 0, 0, 0, null, 'Line 3', null, 99.944, 100, 100, 'PSA Raw 99.822%; PSA QE 99.944%'],
        [null, null, null, 'Line 4', null, 0, 0, 0, null, 'Line 4', null, 99.994, 99.99, 100, 'PSA Raw 99.98%; PSA QE 99.994%'],
        [null, null, null, 'Line 5', null, 0, 0, 0, null, 'Line 5', null, 99.909, 100, 100, 'PSA Raw 99.907%; PSA QE 99.909%'],
        [null, null, null, 'Line 6', null, 0, 0, 0, null, 'Line 6', null, 99.995, 100, 100, 'PSA Raw 99.983%; PSA QE 99.995%'],
    ];
    const sheet = mockWorksheet(rows, 'A', 1);
    const parsed = app._kpiParseAvailabilityFactorRows(sheet, 32);
    assert.equal(parsed.length, 12, '4 lines x 3 metrics (PSA/TSA/FOSA)');
    const l3psa = parsed.find(r => r.line === 'L3' && r.metric === 'PSA');
    assert.equal(l3psa.raw_value, 0);
    assert.equal(l3psa.adjusted_value, 99.944);
    assert.ok(l3psa.remark.includes('99.822%'));
    assert.equal(l3psa.kpi_month_no, 32);
    const l4tsa = parsed.find(r => r.line === 'L4' && r.metric === 'TSA');
    assert.equal(l4tsa.adjusted_value, 99.99);
});

test("_kpiParseAvailabilityFactorRows ignores rows that aren't a Line-N row (headers, blank rows, etc.)", () => {
    const app = buildKpiApp();
    const rows = [
        [null, null, null, 'Line', null, 'PSA', 'TSA', 'FOSA'],
        [null, null, null, '', null, '', '', ''],
        [null, null, null, 'Line 3', null, 1, 2, 3, null, 'Line 3', null, 4, 5, 6],
        [null, null, null, 'Something Else', null, 99, 99, 99],
    ];
    const sheet = mockWorksheet(rows, 'A', 1);
    const parsed = app._kpiParseAvailabilityFactorRows(sheet, 1);
    assert.equal(parsed.length, 3, 'only the real "Line 3" row produces rows');
});

test('_kpiParseAvailabilityFactorRows is immune to the used range not starting at column A (real bug: a real file used B1:AV213 as its range, silently shifting array-index reads by one column)', () => {
    const app = buildKpiApp();
    // Identical content to the first test, but anchored starting at
    // column B instead of A — reproducing the exact real-file layout
    // that broke the old array-index-based parser.
    const rows = [
        [null, null, 'Line', null, 'PSA', 'TSA', 'FOSA', null, 'Line', null, 'PSA', 'TSA', 'FOSA', null],
        [null, null, 'Line 3', null, 0, 0, 0, null, 'Line 3', null, 99.944, 100, 100, 'PSA Raw 99.822%; PSA QE 99.944%'],
    ];
    const sheet = mockWorksheet(rows, 'B', 1);
    assert.equal(sheet['!ref'].split(':')[0], 'B1', 'sanity check: this mock really does start at column B, matching the real file');
    const parsed = app._kpiParseAvailabilityFactorRows(sheet, 32);
    assert.equal(parsed.length, 3, 'PSA/TSA/FOSA for the one Line 3 row — same result regardless of which column the sheet happens to start at');
    const l3psa = parsed.find(r => r.metric === 'PSA');
    assert.equal(l3psa.adjusted_value, 99.944, 'reads the correct value even with the column-B offset that broke the old parser');
});

test('importKpiLineAvailability is scoped to just the imported month — does NOT wipe out previously-imported months (unlike the wholesale-replace pieces)', async () => {
    const app = buildKpiApp({
        kpiLineAvailability: [
            { id: 1, kpi_month_no: 31, line: 'L3', metric: 'PSA', raw_value: 1, adjusted_value: 1, remark: null },
        ],
    });
    let deleteFilters = [];
    app.supabase = {
        from: () => ({
            delete: () => ({ eq: (col, val) => { deleteFilters.push([col, val]); return { eq: (col2, val2) => { deleteFilters.push([col2, val2]); return { then: (cb) => Promise.resolve({ error: null }).then(cb) }; } }; } }),
            insert: (rows) => ({ select: async () => ({ data: rows.map((r, i) => ({ id: 100 + i, ...r })), error: null }) }),
        }),
    };
    app._tid = () => 'tenant1';
    app.showToast = () => {};

    await app.importKpiLineAvailability([{ kpi_month_no: 32, line: 'L3', metric: 'PSA', raw_value: 0, adjusted_value: 99.944, remark: 'x' }], 32);

    assert.ok(deleteFilters.some(f => f[0] === 'kpi_month_no' && f[1] === 32), 'delete was scoped to kpi_month_no=32');
    const month31Row = app.state.kpiLineAvailability.find(r => Number(r.kpi_month_no) === 31);
    assert.ok(month31Row, 'month 31 data was NOT wiped out by importing month 32');
    const month32Row = app.state.kpiLineAvailability.find(r => Number(r.kpi_month_no) === 32);
    assert.ok(month32Row, 'month 32 data was added');
});

test('_kpiLineAvailabilityForMonth filters correctly by line and month', () => {
    const app = buildKpiApp({
        kpiLineAvailability: [
            { line: 'L3', kpi_month_no: 32, metric: 'PSA', adjusted_value: 99.9 },
            { line: 'L3', kpi_month_no: 31, metric: 'PSA', adjusted_value: 88.8 },
            { line: 'L4', kpi_month_no: 32, metric: 'PSA', adjusted_value: 77.7 },
        ],
    });
    const rows = app._kpiLineAvailabilityForMonth('L3', 32);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].adjusted_value, 99.9);
});

test('_kpiLineCostPool reproduces the real M32 numbers exactly: Management Allocation = Total x Station Ratio, Total Pool = Allocation + Line Cost', () => {
    const app = buildKpiApp({
        kpiLineStationCounts: [
            { kpi_month_no: 32, line: 'L3', station_count: 22 },
            { kpi_month_no: 32, line: 'L4', station_count: 9 },
            { kpi_month_no: 32, line: 'L5', station_count: 12 },
            { kpi_month_no: 32, line: 'L6', station_count: 11 },
        ],
        kpiLineMonthlyCosts: [
            { kpi_month_no: 32, total_management_cost: -61161.91, line_l3_cost: -84299.39, line_l4_cost: -18234.60, line_l5_cost: -26167.68, line_l6_cost: -12645.15 },
        ],
    });
    const l3 = app._kpiLineCostPool('L3', 32);
    assert.equal(Math.round(l3.managementAllocation * 100) / 100, -24917.82);
    assert.equal(l3.lineCost, -84299.39);
    assert.equal(Math.round(l3.totalPool * 100) / 100, -109217.21);

    const l6 = app._kpiLineCostPool('L6', 32);
    assert.equal(Math.round(l6.managementAllocation * 100) / 100, -12458.91);
});

test('_kpiLineCostPool returns null when no monthly cost inputs have been entered for that month', () => {
    const app = buildKpiApp({ kpiLineStationCounts: [{ kpi_month_no: 1, line: 'L3', station_count: 10 }] });
    assert.equal(app._kpiLineCostPool('L3', 1), null);
});

test('_kpiPenaltyAllocationForLine only includes KPIs below the max score (Final KPI < 2), excludes ones that hit the cap', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [
            { id: 1, directorate_id: 10, department_id: 100, kpi_code: 'A1', name: 'Underperformer', is_active: true, area_pct: 0.5, level1_pct: 1, level2_pct: 1, level3_pct: 1, hit_pct: 0.5, fs_pct: 0.5 },
            { id: 2, directorate_id: 10, department_id: 100, kpi_code: 'A2', name: 'Perfect score', is_active: true, area_pct: 0.5, level1_pct: 1, level2_pct: 1, level3_pct: 1, hit_pct: 1 },
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2026, period_value: '05', final_kpi: 1.5 },
            { kpi_definition_id: 2, year: 2026, period_value: '05', final_kpi: 2.0 },
        ],
        kpiFeePeriods: [{ kpi_month_no: 31, kpi_year: 2026, kpi_cal_month: 5 }],
        kpiLineStationCounts: [{ kpi_month_no: 31, line: 'L3', station_count: 10 }],
        kpiLineMonthlyCosts: [{ kpi_month_no: 31, total_management_cost: -1000, line_l3_cost: -500 }],
    });
    const result = app._kpiPenaltyAllocationForLine('L3', 31, 10);
    assert.equal(result.rows.length, 1, 'only the underperforming KPI appears');
    assert.equal(result.rows[0].kpiCode, 'A1');
    assert.equal(result.rows[0].distribution, 1, 'the only underperformer gets 100% of the penalty pool');
});

test('_kpiPenaltyAllocationForLine distributes proportionally to Final Weight among multiple underperformers', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [
            { id: 1, directorate_id: 10, department_id: 100, kpi_code: 'A1', name: 'K1', is_active: true, area_pct: 0.6, level1_pct: 1, level2_pct: 1, level3_pct: 1, hit_pct: 0.5, fs_pct: 0.5 },
            { id: 2, directorate_id: 10, department_id: 100, kpi_code: 'A2', name: 'K2', is_active: true, area_pct: 0.4, level1_pct: 1, level2_pct: 1, level3_pct: 1, hit_pct: 1 },
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2026, period_value: '05', final_kpi: 1.0 },
            { kpi_definition_id: 2, year: 2026, period_value: '05', final_kpi: 1.5 },
        ],
        kpiFeePeriods: [{ kpi_month_no: 31, kpi_year: 2026, kpi_cal_month: 5 }],
        kpiLineStationCounts: [{ kpi_month_no: 31, line: 'L3', station_count: 10 }],
        kpiLineMonthlyCosts: [{ kpi_month_no: 31, total_management_cost: 0, line_l3_cost: -1000 }],
    });
    const result = app._kpiPenaltyAllocationForLine('L3', 31, 10);
    assert.equal(result.rows.length, 2);
    const a1 = result.rows.find(r => r.kpiCode === 'A1');
    const a2 = result.rows.find(r => r.kpiCode === 'A2');
    assert.equal(a1.distribution, 0.6, 'A1 has 0.6 of the 1.0 combined weight');
    assert.equal(a2.distribution, 0.4);
    assert.equal(Math.round(a1.totalCost * 100) / 100, -600, '60% of the -1000 pool');
    assert.equal(Math.round(a2.totalCost * 100) / 100, -400);
    // shares should sum back to totalCost for each row
    assert.equal(Math.round((a1.hit + a1.fs) * 100) / 100, Math.round(a1.totalCost * 100) / 100);
});

test('_kpiPenaltyAllocationForLine returns no rows when nobody underperformed this month', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'A1', is_active: true, area_pct: 1, level1_pct: 1, level2_pct: 1, level3_pct: 1 }],
        kpiResults: [{ kpi_definition_id: 1, year: 2026, period_value: '05', final_kpi: 2.0 }],
        kpiFeePeriods: [{ kpi_month_no: 31, kpi_year: 2026, kpi_cal_month: 5 }],
        kpiLineStationCounts: [{ kpi_month_no: 31, line: 'L3', station_count: 10 }],
        kpiLineMonthlyCosts: [{ kpi_month_no: 31, total_management_cost: 0, line_l3_cost: -1000 }],
    });
    const result = app._kpiPenaltyAllocationForLine('L3', 31, 10);
    assert.equal(result.rows.length, 0);
    assert.equal(result.totalPool, -1000, 'the pool is still reported even with nothing to distribute it to');
});

test('saveKpiLineMonthlyCosts upserts by kpi_month_no and updates in-memory state without wiping other months', async () => {
    const app = buildKpiApp({
        kpiLineMonthlyCosts: [{ id: 1, kpi_month_no: 31, total_management_cost: -100, line_l3_cost: -50, line_l4_cost: null, line_l5_cost: null, line_l6_cost: null }],
    });
    let upsertedRow = null, upsertOptions = null;
    app.supabase = {
        from: () => ({
            upsert: (row, opts) => { upsertedRow = row; upsertOptions = opts; return { select: async () => ({ data: [{ id: 2, ...row }], error: null }) }; },
        }),
    };
    app._tid = () => 'tenant1';
    app.showToast = () => {};

    await app.saveKpiLineMonthlyCosts(32, { totalManagementCost: -61161.91, l3Cost: -84299.39, l4Cost: -18234.60, l5Cost: -26167.68, l6Cost: -12645.15 });

    assert.equal(upsertOptions.onConflict, 'tenant_id,kpi_month_no');
    assert.equal(upsertedRow.kpi_month_no, 32);
    assert.equal(upsertedRow.total_management_cost, -61161.91);
    // month 31 must still be present, month 32 added
    assert.equal(app.state.kpiLineMonthlyCosts.length, 2);
    assert.ok(app.state.kpiLineMonthlyCosts.find(r => Number(r.kpi_month_no) === 31));
    assert.ok(app.state.kpiLineMonthlyCosts.find(r => Number(r.kpi_month_no) === 32));
});

test('_kpiParseIWFResultsRows reproduces the real M32_IWF sheet exactly: 128 rows (32 x 4 lines), skips A1/A6 ("-"), correct per-line frequency for C1', () => {
    const app = buildKpiApp();
    const fs = require('fs');
    const path = require('path');
    const fixturePath = path.join(__dirname, '..', 'm32_iwf_sheet.json');
    if (!fs.existsSync(fixturePath)) return; // real-file fixture not present in this environment, skip
    const sheet = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const parsed = app._kpiParseIWFResultsRows(sheet, 32);
    assert.equal(parsed.length, 128);
    const byLine = {};
    parsed.forEach(r => { byLine[r.line] = (byLine[r.line] || 0) + 1; });
    assert.equal(byLine.L3, 32);
    assert.equal(byLine.L4, 32);
    assert.equal(byLine.L5, 32);
    assert.equal(byLine.L6, 32);
    assert.equal(parsed.find(r => r.line === 'L3' && r.code === 'A2').actualValue, 0.9987);
    assert.equal(parsed.find(r => r.line === 'L3' && r.code === 'A3').actualValue, 14.55);
    assert.equal(parsed.find(r => r.line === 'L3' && r.code === 'A1'), undefined, 'A1 was "-", correctly skipped');
    assert.equal(parsed.find(r => r.line === 'L3' && r.code === 'A6'), undefined, 'A6 was "-", correctly skipped');
    assert.equal(parsed.find(r => r.line === 'L3' && r.code === 'C1').periodType, 'monthly');
    assert.equal(parsed.find(r => r.line === 'L4' && r.code === 'C1').periodType, 'quarterly');
});

test('_kpiParseIWFResultsRows correctly tracks LINE section boundaries with a small synthetic sheet', () => {
    const app = buildKpiApp();
    const rows = [
        [null, 'LINE 3'],
        [null, null, null, null, null, null, null, null, null, null, null, null, 'Monthly', 'A1: Test KPI', null, null, null, 5],
        [null, 'LINE 4'],
        [null, null, null, null, null, null, null, null, null, null, null, null, 'Quarterly', 'A1: Test KPI', null, null, null, 10],
    ];
    const sheet = mockWorksheet(rows, 'A', 1);
    const parsed = app._kpiParseIWFResultsRows(sheet, 1);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].line, 'L3');
    assert.equal(parsed[0].actualValue, 5);
    assert.equal(parsed[1].line, 'L4');
    assert.equal(parsed[1].actualValue, 10);
});

test('_kpiParseIWFResultsRows is immune to the used range NOT starting at column A — same real bug as Availability Factor: the real M32_IWF sheet has !ref "B2:BD171"', () => {
    const app = buildKpiApp();
    // Same absolute-column content as the "LINE section boundaries" test
    // above (LINE marker in col B, Frequency in col M, KPI name in col N,
    // Result in col R) — but built by slicing off the column-A placeholder
    // and anchoring at 'B' instead, reproducing a sheet whose used range
    // genuinely starts at column B, like the real file.
    const rowsAtA = [
        [null, 'LINE 3'],
        [null, null, null, null, null, null, null, null, null, null, null, null, 'Monthly', 'A1: Test KPI', null, null, null, 5],
    ];
    const rows = rowsAtA.map(r => r.slice(1));
    const sheet = mockWorksheet(rows, 'B', 1);
    assert.equal(sheet['!ref'].split(':')[0], 'B1', 'sanity check: this mock starts at column B, matching the real file');
    const parsed = app._kpiParseIWFResultsRows(sheet, 1);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].line, 'L3');
    assert.equal(parsed[0].actualValue, 5, 'reads the correct value even with the column-B offset that broke the old parser');
});

test('_kpiParseIWFResultsRows reads the raw numeric value, not percentage-formatted display text — the real bug: a real KPI Result cell had .w "99.87%" (unparseable) but .v 0.9987 (correct)', () => {
    const app = buildKpiApp();
    const sheet = {
        'B2': { w: 'LINE 3', v: 'LINE 3' },
        'M3': { w: 'Monthly', v: 'Monthly' },
        'N3': { w: 'A2: Test KPI', v: 'A2: Test KPI' },
        // Percentage-formatted cell: SheetJS gives .w as "99.87%" but the
        // real underlying number in .v is 0.9987 — this is exactly what
        // broke every percentage-styled KPI Result in the real file.
        'R3': { t: 'n', v: 0.9987, w: '99.87%' },
        '!ref': 'B2:R3',
    };
    const parsed = app._kpiParseIWFResultsRows(sheet, 1);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].actualValue, 0.9987, 'reads .v (0.9987), not a failed parse of .w ("99.87%")');
});

test('importKpiIWFResults resolves each period from the real fee calendar mapping and matches by (code, line)', async () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'A2', name: 'K', category: '', unit: '', direction: 'higher_is_better', period_type: 'monthly', target_value: 0.9 }],
        kpiResults: [],
        kpiFeePeriods: [{ kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6 }],
    });
    let nextId = 1;
    app.supabase = { from: () => ({ upsert: (row) => ({ select: async () => ({ data: [{ id: nextId++, ...row }], error: null }) }) }) };
    app._tid = () => 'tenant1';
    app.showToast = () => {};

    const summary = await app.importKpiIWFResults([{ line: 'L3', code: 'A2', periodType: 'monthly', actualValue: 0.9987 }], 32, 'OMC');
    assert.equal(summary.updated, 1);
    assert.equal(app.state.kpiResults[0].year, 2026);
    assert.equal(app.state.kpiResults[0].period_value, '06');
    assert.equal(app.state.kpiResults[0].actual_value, 0.9987);
});

test('importKpiIWFResults fails cleanly with a clear error when the fee calendar has no entry for that KPI Month', async () => {
    const app = buildKpiApp({ kpiFeePeriods: [] });
    app.supabase = {};
    app.showToast = () => {};
    const summary = await app.importKpiIWFResults([{ line: 'L3', code: 'A2', periodType: 'monthly', actualValue: 1 }], 99, 'OMC');
    assert.equal(summary.updated, 0);
    assert.ok(summary.errors[0].includes('99'));
});

test('_kpiLatestMonthWithMgtData finds the latest month with real MGT data, not just the last row in the full fee calendar', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, is_active: true, area_pct: 1, level1_pct: 1, level2_pct: 1, level3_pct: 1 }],
        kpiResults: [{ kpi_definition_id: 1, year: 2026, period_value: '06', factor_score: 1.5 }], // only month 32 (June) has a real result
        kpiFeePeriods: [
            { kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6 },
            { kpi_month_no: 121, kpi_year: 2033, kpi_cal_month: 11 }, // the far-future last calendar row, no data
        ],
    });
    const feePeriods = [...app.state.kpiFeePeriods].sort((a, b) => a.kpi_month_no - b.kpi_month_no);
    // The real bug: naively picking the LAST calendar row would return 121 (empty).
    // The fix must scan backwards and find 32 instead, since that's the latest month with real data.
    assert.equal(app._kpiLatestMonthWithMgtData(feePeriods, 10), 32);
});

test('_kpiLatestMonthWithMgtData falls back to the calendar\'s last entry when NOTHING has data anywhere (brand-new tenant)', () => {
    const app = buildKpiApp({
        kpiFeePeriods: [{ kpi_month_no: 1, kpi_year: 2023, kpi_cal_month: 11 }, { kpi_month_no: 121, kpi_year: 2033, kpi_cal_month: 11 }],
    });
    const feePeriods = [...app.state.kpiFeePeriods].sort((a, b) => a.kpi_month_no - b.kpi_month_no);
    assert.equal(app._kpiLatestMonthWithMgtData(feePeriods, 10), 121, 'falls back to the last row rather than returning null/crashing');
});

test('_kpiLatestMonthWithAvailabilityData finds the latest month with real Availability Factor rows, same pattern as MGT data', () => {
    const app = buildKpiApp({
        kpiLineAvailability: [{ line: 'L3', kpi_month_no: 32, metric: 'PSA', adjusted_value: 99.9 }],
        kpiFeePeriods: [
            { kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6 },
            { kpi_month_no: 121, kpi_year: 2033, kpi_cal_month: 11 },
        ],
    });
    const feePeriods = [...app.state.kpiFeePeriods].sort((a, b) => a.kpi_month_no - b.kpi_month_no);
    assert.equal(app._kpiLatestMonthWithAvailabilityData(feePeriods), 32);
});

test('_kpiLatestMonthWithMgtData is directorate-scoped: two directorates with data in different months each get their own correct latest month', () => {
    const app = buildKpiApp({
        kpiDirectorateDepartments: [
            { id: 100, directorate_id: 10, department_name: 'L3' },
            { id: 200, directorate_id: 20, department_name: 'L3' },
        ],
        kpiDefinitions: [
            { id: 1, directorate_id: 10, department_id: 100, is_active: true, area_pct: 1, level1_pct: 1, level2_pct: 1, level3_pct: 1 },
            { id: 2, directorate_id: 20, department_id: 200, is_active: true, area_pct: 1, level1_pct: 1, level2_pct: 1, level3_pct: 1 },
        ],
        kpiResults: [
            { kpi_definition_id: 1, year: 2026, period_value: '05', factor_score: 1.5 }, // directorate 10 has data in month 31
            { kpi_definition_id: 2, year: 2026, period_value: '06', factor_score: 1.5 }, // directorate 20 has data in month 32
        ],
        kpiFeePeriods: [
            { kpi_month_no: 31, kpi_year: 2026, kpi_cal_month: 5 },
            { kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6 },
        ],
    });
    const feePeriods = [...app.state.kpiFeePeriods].sort((a, b) => a.kpi_month_no - b.kpi_month_no);
    assert.equal(app._kpiLatestMonthWithMgtData(feePeriods, 10), 31);
    assert.equal(app._kpiLatestMonthWithMgtData(feePeriods, 20), 32);
});

test('_kpiParseMPercentCostRows reproduces the real M% sheet exactly: 96 rows (12 months x 4 lines x 2 companies), M32/L3/OMC matches the already-verified figures to the cent', () => {
    const app = buildKpiApp();
    const fs = require('fs');
    const path = require('path');
    const fixturePath = path.join(__dirname, '..', 'mpercent_sheet.json');
    if (!fs.existsSync(fixturePath)) return; // real-file fixture not present in this environment, skip
    const sheet = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const parsed = app._kpiParseMPercentCostRows(sheet);
    assert.equal(parsed.length, 96);
    assert.deepEqual([...new Set(parsed.map(r => r.company))].sort(), ['Audit', 'OMC'], 'ER mapped to Audit');
    const m32l3 = parsed.find(r => r.kpi_month_no === 32 && r.line === 'L3' && r.company === 'OMC');
    assert.equal(Math.round(m32l3.management_allocation * 100) / 100, -24917.82);
    assert.equal(Math.round(m32l3.line_cost * 100) / 100, -84299.39);
    assert.equal(Math.round(m32l3.total_pool * 100) / 100, -109217.20);
});

test('_kpiParseMPercentCostRows handles a partial #N/A gracefully: keeps the Line Cost that IS available, leaves Management Allocation and Total null rather than dropping the whole row', () => {
    const app = buildKpiApp();
    const fs = require('fs');
    const path = require('path');
    const fixturePath = path.join(__dirname, '..', 'mpercent_sheet.json');
    if (!fs.existsSync(fixturePath)) return;
    const sheet = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const parsed = app._kpiParseMPercentCostRows(sheet);
    const m27l3 = parsed.find(r => r.kpi_month_no === 27 && r.line === 'L3' && r.company === 'OMC');
    assert.ok(m27l3, 'row is kept even though Management Allocation is #N/A in the source');
    assert.equal(m27l3.management_allocation, null);
    assert.equal(Math.round(m27l3.line_cost * 100) / 100, -72459.52);
    assert.equal(m27l3.total_pool, null);
});

test('_kpiParseMPercentCostRows only takes MONTHLY rows, ignoring the Quarterly/Annual duplicates of the same data', () => {
    const app = buildKpiApp();
    const sheet = {
        'A1': { w: 'Report Fiscal Month' }, 'B1': { w: 'Report Fiscal Month No' }, 'C1': { w: 'COMPANY' }, 'D1': { w: 'REPORT' }, 'E1': { w: 'Line' },
        'L1': { w: 'Mngmnt Per Line' }, 'M1': { w: 'Line Cost' }, 'N1': { w: 'Total' },
        'B2': { t: 'n', v: 25 }, 'C2': { w: 'OMC' }, 'D2': { w: 'MONTHLY' }, 'E2': { t: 'n', v: 3 },
        'L2': { t: 'n', v: -100 }, 'M2': { t: 'n', v: -200 }, 'N2': { t: 'n', v: -300 },
        'B3': { t: 'n', v: 25 }, 'C3': { w: 'OMC' }, 'D3': { w: 'QUARTERLY' }, 'E3': { t: 'n', v: 3 },
        'L3': { t: 'n', v: -999 }, 'M3': { t: 'n', v: -999 }, 'N3': { t: 'n', v: -999 },
        '!ref': 'A1:N3',
    };
    const parsed = app._kpiParseMPercentCostRows(sheet);
    assert.equal(parsed.length, 1, 'only the Monthly row is included');
    assert.equal(parsed[0].management_allocation, -100);
});

test('_kpiLineCostPool prefers imported cost pool data over manual entry when both exist for the same month/line', () => {
    const app = buildKpiApp({
        kpiLineCostPools: [
            { kpi_month_no: 32, line: 'L3', company: 'OMC', management_allocation: -24917.82, line_cost: -84299.39, total_pool: -109217.21 },
        ],
        kpiLineMonthlyCosts: [
            { kpi_month_no: 32, total_management_cost: -999, line_l3_cost: -999 }, // deliberately different, should be ignored
        ],
        kpiLineStationCounts: [{ kpi_month_no: 32, line: 'L3', station_count: 22 }],
    });
    const pool = app._kpiLineCostPool('L3', 32, 'OMC');
    assert.equal(pool.source, 'imported');
    assert.equal(pool.managementAllocation, -24917.82);
    assert.equal(pool.lineCost, -84299.39);
});

test('_kpiLineCostPool falls back to manual entry when no imported data covers that month/line', () => {
    const app = buildKpiApp({
        kpiLineCostPools: [],
        kpiLineMonthlyCosts: [{ kpi_month_no: 32, total_management_cost: -61161.91, line_l3_cost: -84299.39 }],
        kpiLineStationCounts: [
            { kpi_month_no: 32, line: 'L3', station_count: 22 }, { kpi_month_no: 32, line: 'L4', station_count: 9 },
            { kpi_month_no: 32, line: 'L5', station_count: 12 }, { kpi_month_no: 32, line: 'L6', station_count: 11 },
        ],
    });
    const pool = app._kpiLineCostPool('L3', 32, 'OMC');
    assert.equal(pool.source, 'manual');
    assert.equal(Math.round(pool.managementAllocation * 100) / 100, -24917.82);
});

test('importKpiLineCostPools upserts by (tenant, month, line, company) without wiping unrelated months', async () => {
    const app = buildKpiApp({
        kpiLineCostPools: [{ id: 1, kpi_month_no: 25, line: 'L3', company: 'OMC', management_allocation: -1, line_cost: -1, total_pool: -2 }],
    });
    let upsertedRows = null, upsertOptions = null;
    app.supabase = {
        from: () => ({
            upsert: (rows, opts) => {
                upsertedRows = rows; upsertOptions = opts;
                return { select: async () => ({ data: rows.map((r, i) => ({ id: 100 + i, ...r })), error: null }) };
            },
        }),
    };
    app._tid = () => 'tenant1';
    app.showToast = () => {};

    await app.importKpiLineCostPools([{ kpi_month_no: 32, line: 'L3', company: 'OMC', management_allocation: -24917.82, line_cost: -84299.39, total_pool: -109217.21 }]);

    assert.equal(upsertOptions.onConflict, 'tenant_id,kpi_month_no,line,company');
    assert.equal(app.state.kpiLineCostPools.length, 2, 'month 25 preserved, month 32 added');
    assert.ok(app.state.kpiLineCostPools.find(r => Number(r.kpi_month_no) === 25));
    assert.ok(app.state.kpiLineCostPools.find(r => Number(r.kpi_month_no) === 32));
});

test('_kpiParseFullKpiResultsSheet matches the real "KPI Results" sheet exactly: only MONTHLY rows, correct value + remark, both companies', () => {
    const app = buildKpiApp();
    const fs = require('fs');
    const path = require('path');
    const fixturePath = path.join(__dirname, '..', 'kpi_results_history_sample.json');
    if (!fs.existsSync(fixturePath)) return; // real-file fixture not present in this environment, skip
    const sheet = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const parsed = app._kpiParseFullKpiResultsSheet(sheet);
    assert.ok(parsed.length > 0);
    const m25l3a2 = parsed.find(r => r.kpi_month_no === 25 && r.line === 'L3' && r.code === 'A2' && r.company === 'OMC');
    assert.ok(m25l3a2, 'the real A2 row is present');
    assert.equal(m25l3a2.actualValue, 0.9769, 'reads .v (0.9769), not the % formatted .w text');
    assert.ok(m25l3a2.remarks.includes('C2: 97.69%'));
    assert.equal(m25l3a2.periodType, 'monthly');
    // A1 in the real sample is "-" (not yet reported) — must be excluded
    assert.equal(parsed.find(r => r.kpi_month_no === 25 && r.line === 'L3' && r.code === 'A1' && r.company === 'OMC'), undefined);
});

test('_kpiParseFullKpiResultsSheet only takes MONTHLY rows, skipping the QUARTERLY/ANNUAL duplicates of the same underlying data', () => {
    const app = buildKpiApp();
    const sheet = {
        'B2': { w: 'M25' }, 'C2': { t: 'n', v: 25 }, 'G2': { t: 'n', v: 3 }, 'H2': { w: 'A2' },
        'J2': { w: 'OMC' }, 'K2': { w: 'MONTHLY' }, 'M2': { w: 'Monthly' }, 'P2': { t: 'n', v: 0.5, w: '50%' }, 'Q2': { w: 'note' },
        'B3': { w: 'M25' }, 'C3': { t: 'n', v: 25 }, 'G3': { t: 'n', v: 3 }, 'H3': { w: 'A2' },
        'J3': { w: 'OMC' }, 'K3': { w: 'QUARTERLY' }, 'M3': { w: 'Monthly' }, 'P3': { t: 'n', v: 0.5, w: '50%' }, 'Q3': { w: 'note' },
        '!ref': 'A1:Q3',
    };
    const parsed = app._kpiParseFullKpiResultsSheet(sheet);
    assert.equal(parsed.length, 1, 'only the MONTHLY row is included');
});

test('_kpiParseFullKpiResultsSheet maps company ER -> Audit, same convention as the M% importer', () => {
    const app = buildKpiApp();
    const sheet = {
        'B2': { w: 'M25' }, 'C2': { t: 'n', v: 25 }, 'G2': { t: 'n', v: 3 }, 'H2': { w: 'A2' },
        'J2': { w: 'ER' }, 'K2': { w: 'MONTHLY' }, 'M2': { w: 'Monthly' }, 'P2': { t: 'n', v: 1 }, 'Q2': { w: '' },
        '!ref': 'A1:Q2',
    };
    const parsed = app._kpiParseFullKpiResultsSheet(sheet);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].company, 'Audit');
});

test('importKpiFullResultsHistory resolves each row\'s own calendar period independently, unlike importKpiIWFResults which is anchored to one month for the whole call', async () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'A2', name: 'K', category: '', unit: '', direction: 'higher_is_better', period_type: 'monthly', target_value: 0.9 }],
        kpiResults: [],
        kpiFeePeriods: [
            { kpi_month_no: 25, kpi_year: 2025, kpi_cal_month: 11 },
            { kpi_month_no: 26, kpi_year: 2025, kpi_cal_month: 12 },
        ],
    });
    let nextId = 1;
    app.supabase = { from: () => ({ upsert: (row) => ({ select: async () => ({ data: [{ id: nextId++, ...row }], error: null }) }) }) };
    app._tid = () => 'tenant1';
    app.showToast = () => {};

    const summary = await app.importKpiFullResultsHistory([
        { kpi_month_no: 25, line: 'L3', code: 'A2', company: 'OMC', periodType: 'monthly', actualValue: 0.97, remarks: 'r1' },
        { kpi_month_no: 26, line: 'L3', code: 'A2', company: 'OMC', periodType: 'monthly', actualValue: 0.98, remarks: 'r2' },
    ]);
    assert.equal(summary.updated, 2);
    const r25 = app.state.kpiResults.find(r => r.period_value === '11');
    const r26 = app.state.kpiResults.find(r => r.period_value === '12');
    assert.equal(r25.actual_value, 0.97);
    assert.equal(r26.actual_value, 0.98);
});

test('_kpiParseFullKpiResultsSheet extracts precomputed Factor Score (T) and Benchmark (AA) when present', () => {
    const app = buildKpiApp();
    const sheet = {
        'B2': { w: 'M25' }, 'C2': { t: 'n', v: 25 }, 'G2': { t: 'n', v: 3 }, 'H2': { w: 'A2' },
        'J2': { w: 'OMC' }, 'K2': { w: 'MONTHLY' }, 'M2': { w: 'Monthly' }, 'P2': { t: 'n', v: 0.9769, w: '97.69%' },
        'Q2': { w: 'note' }, 'T2': { t: 'n', v: 1.8641176470588237 }, 'AA2': { w: 'Acceptable' },
        '!ref': 'A1:AA2',
    };
    const parsed = app._kpiParseFullKpiResultsSheet(sheet);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].precomputedFactorScore, 1.8641176470588237);
    assert.equal(parsed[0].precomputedBenchmark, 'Acceptable');
});

test('_kpiParseFullKpiResultsSheet leaves precomputed fields null for a KPI with no thresholds configured (e.g. real PSA row)', () => {
    const app = buildKpiApp();
    const sheet = {
        'B2': { w: 'M25' }, 'C2': { t: 'n', v: 25 }, 'G2': { t: 'n', v: 3 }, 'H2': { w: 'PSA' },
        'J2': { w: 'OMC' }, 'K2': { w: 'MONTHLY' }, 'M2': { w: 'Monthly' }, 'P2': { t: 'n', v: 99.539 },
        // T and AA both genuinely blank, matching the real file
        '!ref': 'A1:AA2',
    };
    const parsed = app._kpiParseFullKpiResultsSheet(sheet);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].precomputedFactorScore, null);
    assert.equal(parsed[0].precomputedBenchmark, null);
});

test('saveKpiResult stores a precomputed Factor Score/Benchmark directly, bypassing this system\'s own threshold-based calculation', async () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        // No thresholds configured for this KPI, per the real PSA scenario
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'PSA', name: 'PSA', period_type: 'monthly', direction: 'higher_is_better' }],
        kpiResults: [],
    });
    let savedRow = null;
    app.supabase = { from: () => ({ upsert: (row) => { savedRow = row; return { select: async () => ({ data: [{ id: 1, ...row }], error: null }) }; } }) };
    app._tid = () => 'tenant1';

    const saved = await app.saveKpiResult(1, {
        year: 2026, periodType: 'monthly', periodValue: '05', actualValue: 99.539,
        precomputedFactorScore: 1.8641176470588237, precomputedBenchmark: 'Acceptable',
    });
    assert.equal(saved.factor_score, 1.8641176470588237, 'trusts the precomputed value, not a recomputation from (missing) thresholds');
    assert.equal(saved.imported_benchmark, 'Acceptable');
    assert.equal(saved.final_kpi, 1.8641176470588237, 'Final KPI auto-follows the precomputed Factor Score, same as a normal save');
});

test('saveKpiResult behaves exactly as before for every normal caller that doesn\'t pass precomputed values', async () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'A1', name: 'K', period_type: 'monthly', direction: 'higher_is_better', target_value: 90, exceptional_value: 100, unacceptable_value: 80 }],
        kpiResults: [],
    });
    let savedRow = null;
    app.supabase = { from: () => ({ upsert: (row) => { savedRow = row; return { select: async () => ({ data: [{ id: 1, ...row }], error: null }) }; } }) };
    app._tid = () => 'tenant1';

    await app.saveKpiResult(1, { year: 2026, periodType: 'monthly', periodValue: '05', actualValue: 95 });
    assert.equal(savedRow.imported_benchmark, null, 'a normal save never sets an imported_benchmark override');
    assert.ok(savedRow.factor_score != null, 'factor_score is still computed normally from real thresholds');
});

test('_kpiResultBenchmark prefers a stored imported_benchmark override, falls back to live threshold computation when null', () => {
    const app = buildKpiApp();
    const kpiDef = { exceptional_value: 100, unacceptable_value: 80, direction: 'higher_is_better' };
    const overriddenResult = { actual_value: 50, imported_benchmark: 'Acceptable' }; // would compute to Unacceptable live
    assert.equal(app._kpiResultBenchmark(overriddenResult, kpiDef), 'Acceptable', 'trusts the override, not the live computation');
    const normalResult = { actual_value: 90, imported_benchmark: null };
    assert.equal(app._kpiResultBenchmark(normalResult, kpiDef), 'Acceptable', 'falls back to live computation when no override is stored');
});

test('_kpiParseFullKpiResultsSheet does not trust a Final Factor of 0 when Benchmark is blank — Excel\'s own formula falls back to 0 for a KPI with no thresholds, matching the real PSA row exactly', () => {
    const app = buildKpiApp();
    const sheet = {
        'B2': { w: 'M25' }, 'C2': { t: 'n', v: 25 }, 'G2': { t: 'n', v: 3 }, 'H2': { w: 'PSA' },
        'J2': { w: 'OMC' }, 'K2': { w: 'MONTHLY' }, 'M2': { w: 'Monthly' }, 'P2': { t: 'n', v: 99.539 },
        'T2': { t: 'n', v: 0 }, // Excel's own meaningless fallback, exactly like the real file
        // AA2 (Benchmark) genuinely absent, exactly like the real file
        '!ref': 'A1:AA2',
    };
    const parsed = app._kpiParseFullKpiResultsSheet(sheet);
    assert.equal(parsed[0].precomputedFactorScore, null, 'the 0 is NOT trusted since Benchmark is blank');
    assert.equal(parsed[0].precomputedBenchmark, null);
});

test('_kpiParseWFAvailabilityCostRows finds all 4 lines despite non-uniform row offsets between sections (real bug caught: L6 sits one row later than L3/L4/L5)', () => {
    const app = buildKpiApp();
    const sheet = {
        'B101': { w: 'LINE 3 MVFt' },
        'B174': { w: 'PSAAF3t-1 PMAF3t-1' }, 'C174': { w: 'TSAAF3t-1 PMAF3t-1' }, 'D174': { w: 'FOSAAF3t-1 PMAF3t-1' }, 'E174': { w: 'PMAF3t-1 exc AVL' },
        'B175': { t: 'n', v: 0 }, 'C175': { t: 'n', v: 0 }, 'D175': { t: 'n', v: 0 }, 'E175': { t: 'n', v: -73417.09546773508 },
        'B181': { w: 'LINE 4 MVFt' },
        'B341': { w: 'LINE 6 MVFt' },
        // L6's label sits one row LATER than the L3/L4/L5 pattern (real offset difference)
        'B415': { w: 'PSAAF6t-1 PMAF6t-1' }, 'C415': { w: 'TSAAF6t-1 PMAF6t-1' }, 'D415': { w: 'FOSAAF6t-1 PMAF6t-1' }, 'E415': { w: 'PMAF6t-1 exc AVL' },
        'B416': { t: 'n', v: 0 }, 'C416': { t: 'n', v: 0 }, 'D416': { t: 'n', v: 0 }, 'E416': { t: 'n', v: -26484.773929628078 },
        '!ref': 'A1:E430',
    };
    const parsed = app._kpiParseWFAvailabilityCostRows(sheet);
    const l3 = parsed.find(r => r.line === 'L3');
    const l6 = parsed.find(r => r.line === 'L6');
    assert.ok(l3, 'L3 found despite section starting far from its label row');
    assert.equal(Math.round(l3.remainder * 100) / 100, -73417.10);
    assert.ok(l6, 'L6 found even though its label sits one row later than L3s pattern');
    assert.equal(Math.round(l6.remainder * 100) / 100, -26484.77);
});

test('importKpiLineAvailabilityCost resolves the correct KPI Month automatically by matching against already-imported Cost Pool (M%) data, without any month being stated in the WF sheet itself', async () => {
    const app = buildKpiApp({
        kpiLineCostPools: [
            { kpi_month_no: 25, line: 'L3', company: 'OMC', line_cost: -73417.09546773508 },
            { kpi_month_no: 26, line: 'L3', company: 'OMC', line_cost: -99999 }, // a different month, must NOT match
        ],
    });
    let upsertedRows = null;
    app.supabase = { from: () => ({ upsert: (rows) => { upsertedRows = rows; return { select: async () => ({ data: rows.map((r, i) => ({ id: i + 1, ...r })), error: null }) }; } }) };
    app._tid = () => 'tenant1';
    app.showToast = () => {};

    const summary = await app.importKpiLineAvailabilityCost([{ line: 'L3', psaCost: 0, tsaCost: 0, fosaCost: 0, remainder: -73417.09546773508 }], 'OMC');
    assert.equal(summary.imported, 1);
    assert.equal(upsertedRows[0].kpi_month_no, 25, 'correctly resolved to month 25, not the other candidate month 26');
});

test('importKpiLineAvailabilityCost reports a clear error, not a silent skip, when no matching Cost Pool data exists to resolve the month from', async () => {
    const app = buildKpiApp({ kpiLineCostPools: [] });
    app.supabase = {};
    app.showToast = () => {};
    const summary = await app.importKpiLineAvailabilityCost([{ line: 'L3', psaCost: 0, tsaCost: 0, fosaCost: 0, remainder: -73417.1 }], 'OMC');
    assert.equal(summary.imported, 0);
    assert.ok(summary.errors[0].includes('M% Cost Pool import first'));
});

test('_kpiAvailabilityMetricCost computes KPIF x Base Cost, reproducing the real FOSA/L3 formula exactly (FOSAF x MFOSF) — falls back to threshold-based Factor Score when no bracket table is imported', () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'FOSA', name: 'FOSA', period_type: 'monthly', direction: 'higher_is_better' }],
        kpiResults: [{ kpi_definition_id: 1, year: 2026, period_value: '06', actual_value: 99.9, factor_score: 1.5 }],
        kpiFeePeriods: [{ kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6 }],
        kpiLineAvailabilityBaseCost: [{ line: 'L3', metric: 'FOSA', company: 'OMC', base_cost: 3555552.8236633237 }],
    });
    const cost = app._kpiAvailabilityMetricCost('FOSA', 'L3', 32, 'OMC');
    assert.equal(Math.round(cost * 100) / 100, Math.round(1.5 * 3555552.8236633237 * 100) / 100);
});

test('_kpiAvailabilityMetricCost is null when KPIF is null (no thresholds configured yet), even if a Base Cost exists', () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'PSA', name: 'PSA', period_type: 'monthly' }],
        kpiResults: [{ kpi_definition_id: 1, year: 2026, period_value: '06', factor_score: null }],
        kpiFeePeriods: [{ kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6 }],
        kpiLineAvailabilityBaseCost: [{ line: 'L3', metric: 'PSA', company: 'OMC', base_cost: 5961118.38 }],
    });
    assert.equal(app._kpiAvailabilityMetricCost('PSA', 'L3', 32, 'OMC'), null, 'no KPIF means no KPI Cost, regardless of Base Cost being present');
});

test('_kpiAvailabilityMetricCost recalculates automatically as KPIF changes month to month, using the SAME Base Cost figure', () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'TSA', name: 'TSA', period_type: 'monthly' }],
        kpiResults: [
            { kpi_definition_id: 1, year: 2026, period_value: '05', actual_value: 90, factor_score: 1.0 },
            { kpi_definition_id: 1, year: 2026, period_value: '06', actual_value: 95, factor_score: 2.0 },
        ],
        kpiFeePeriods: [
            { kpi_month_no: 31, kpi_year: 2026, kpi_cal_month: 5 },
            { kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6 },
        ],
        kpiLineAvailabilityBaseCost: [{ line: 'L3', metric: 'TSA', company: 'OMC', base_cost: 1000000 }],
    });
    assert.equal(app._kpiAvailabilityMetricCost('TSA', 'L3', 31, 'OMC'), 1000000, 'KPIF 1.0 x base 1,000,000');
    assert.equal(app._kpiAvailabilityMetricCost('TSA', 'L3', 32, 'OMC'), 2000000, 'KPIF 2.0 (a NEW result, no re-import needed) x the same base');
});

test('_kpiParseWFBaseCostRows applies the correct combination rule per metric (PSA: D+E, TSA: D-E, FOSA: D alone), matching the real formulas', () => {
    const app = buildKpiApp();
    const sheet = {
        'B101': { w: 'LINE 3 MVFt' },
        'B124': { w: 'PSAAF3t-1' }, 'D125': { t: 'n', v: 943667.2799190901 }, 'E125': { t: 'n', v: 5017451.101168305 },
        'B128': { w: 'TSAAF3t-1' }, 'D129': { t: 'n', v: 14839928.4320413 }, 'E129': { t: 'n', v: 0 },
        'B132': { w: 'FOSAAF3t-1' }, 'D133': { t: 'n', v: 3555552.8236633237 },
        'B181': { w: 'LINE 4 MVFt' },
        '!ref': 'A1:E200',
    };
    const parsed = app._kpiParseWFBaseCostRows(sheet);
    const psa = parsed.find(r => r.line === 'L3' && r.metric === 'PSA');
    const tsa = parsed.find(r => r.line === 'L3' && r.metric === 'TSA');
    const fosa = parsed.find(r => r.line === 'L3' && r.metric === 'FOSA');
    assert.equal(Math.round(psa.baseCost * 100) / 100, 5961118.38, 'PSA = MTOF + MSOF (D+E)');
    assert.equal(Math.round(tsa.baseCost * 100) / 100, 14839928.43, 'TSA = MTSF - KTVF (D-E)');
    assert.equal(Math.round(fosa.baseCost * 100) / 100, 3555552.82, 'FOSA = MFOSF (D alone)');
});

test('_kpiParseWFBaseCostRows treats a "-" placeholder cell (not a real number) as 0 in the combination, matching the real L5 TSA row', () => {
    const app = buildKpiApp();
    const sheet = {
        'B261': { w: 'LINE 5 MVFt' },
        'B288': { w: 'TSAAF5t-1' }, 'D289': { t: 'n', v: 4331932.276712662 }, 'E289': { w: '-' }, // real file: E289 is literally "-"
        '!ref': 'A1:E300',
    };
    const parsed = app._kpiParseWFBaseCostRows(sheet);
    const tsa = parsed.find(r => r.line === 'L5' && r.metric === 'TSA');
    assert.equal(Math.round(tsa.baseCost * 100) / 100, 4331932.28, '"-" treated as 0, not NaN or a dropped row');
});

test('_kpiAvailabilityMetricResult reads the live Enter Results value, not the imported static Availability Factor figure', () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'PSA', name: 'PSA', period_type: 'monthly' }],
        kpiResults: [{ kpi_definition_id: 1, year: 2026, period_value: '06', actual_value: 99.944 }],
        kpiFeePeriods: [{ kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6 }],
    });
    assert.equal(app._kpiAvailabilityMetricResult('PSA', 'L3', 32, 'OMC'), 99.944);
    assert.equal(app._kpiAvailabilityMetricResult('PSA', 'L3', 31, 'OMC'), null, 'no result entered for month 31');
});

test('_kpiAvailabilityMetricFactorScore and _kpiAvailabilityMetricResult read from the SAME underlying result row, staying consistent with each other', () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'TSA', name: 'TSA', period_type: 'monthly' }],
        kpiResults: [{ kpi_definition_id: 1, year: 2026, period_value: '06', actual_value: 100, factor_score: 1.75 }],
        kpiFeePeriods: [{ kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6 }],
    });
    assert.equal(app._kpiAvailabilityMetricResult('TSA', 'L3', 32, 'OMC'), 100);
    assert.equal(app._kpiAvailabilityMetricFactorScore('TSA', 'L3', 32, 'OMC'), 1.75);
});

test('_kpiAvailabilityMetricDiagnostic identifies "no thresholds configured" as the specific reason, matching the real PSA/TSA/FOSA scenario', () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'PSA', name: 'PSA', period_type: 'monthly' }], // no exceptional/unacceptable set
        kpiResults: [{ kpi_definition_id: 1, year: 2026, period_value: '06', actual_value: 99.5 }],
        kpiFeePeriods: [{ kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6 }],
    });
    const diag = app._kpiAvailabilityMetricDiagnostic('PSA', 'L3', 32, 'OMC');
    assert.ok(diag.includes('thresholds'), 'correctly identifies the missing thresholds, matching the real diagnosed cause');
});

test('_kpiAvailabilityMetricDiagnostic identifies "no KPI configured" when the metric isn\'t even set up as a KPI for that line', () => {
    const app = buildKpiApp({ kpiDirectorateDepartments: [], kpiDefinitions: [] });
    const diag = app._kpiAvailabilityMetricDiagnostic('PSA', 'L3', 32, 'OMC');
    assert.ok(diag.includes("isn't configured"));
});

test('_kpiAvailabilityMetricDiagnostic identifies "no result entered" when the KPI exists but nothing was entered this month', () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'PSA', name: 'PSA', period_type: 'monthly', exceptional_value: 100, unacceptable_value: 80 }],
        kpiResults: [],
        kpiFeePeriods: [{ kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6 }],
    });
    const diag = app._kpiAvailabilityMetricDiagnostic('PSA', 'L3', 32, 'OMC');
    assert.ok(diag.includes('No result entered'));
});

test('_kpiAvailabilityMetricDiagnostic identifies "no Base Cost imported" as the last-mile reason when KPIF is genuinely already computed', () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'PSA', name: 'PSA', period_type: 'monthly', exceptional_value: 100, unacceptable_value: 80 }],
        kpiResults: [{ kpi_definition_id: 1, year: 2026, period_value: '06', actual_value: 99.5, factor_score: 1.9 }],
        kpiFeePeriods: [{ kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6 }],
        kpiLineAvailabilityBaseCost: [],
    });
    const diag = app._kpiAvailabilityMetricDiagnostic('PSA', 'L3', 32, 'OMC');
    assert.ok(diag.includes('Base Cost'));
    assert.ok(diag.includes('1.9000'), 'shows the real computed KPIF value in the message, not just a generic complaint');
});

test('_kpiAvailabilityMetricDiagnostic returns null when everything is genuinely present (nothing to diagnose)', () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'PSA', name: 'PSA', period_type: 'monthly', exceptional_value: 100, unacceptable_value: 80 }],
        kpiResults: [{ kpi_definition_id: 1, year: 2026, period_value: '06', actual_value: 99.5, factor_score: 1.9 }],
        kpiFeePeriods: [{ kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6 }],
        kpiLineAvailabilityBaseCost: [{ line: 'L3', metric: 'PSA', company: 'OMC', base_cost: 1000000 }],
    });
    assert.equal(app._kpiAvailabilityMetricDiagnostic('PSA', 'L3', 32, 'OMC'), null);
});

test('_kpiParseAvailabilityFactorBrackets reproduces the real "Availability Factor" sheet exactly: 12 (Line x Metric) tables found, correct bracket values', () => {
    const app = buildKpiApp();
    const fs = require('fs');
    const path = require('path');
    const fixturePath = path.join(__dirname, '..', 'avail_factor_sheet.json');
    if (!fs.existsSync(fixturePath)) return; // real-file fixture not present in this environment, skip
    const sheet = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const parsed = app._kpiParseAvailabilityFactorBrackets(sheet);
    assert.equal(parsed.length, 2376);
    const combos = new Set(parsed.map(r => r.line + '/' + r.metric));
    assert.equal(combos.size, 12, 'all 4 lines x 3 metrics found');
    const psaL3Top = parsed.find(r => r.line === 'L3' && r.metric === 'PSA' && r.lo === 99.3 && r.hi === 100);
    assert.equal(psaL3Top.factor, 0, 'the top bracket (99.3-100) gives Factor 0, matching the real sheet');
});

test('_kpiParseAvailabilityFactorBrackets uses a self-contained column-letter converter, not a dependency on the XLSX global being present (real bug caught: only worked in the browser, silently returned 0 rows in a plain Node context)', () => {
    const app = buildKpiApp();
    // Minimal synthetic sheet with no XLSX global needed
    const sheet = {
        'B3': { w: 'PSA (Line 3)' },
        'B6': { t: 'n', v: 99.3 }, 'C6': { t: 'n', v: 100 }, 'D6': { t: 'n', v: 0 },
        'B7': { t: 'n', v: 99.2 }, 'C7': { t: 'n', v: 99.29 }, 'D7': { t: 'n', v: -0.01 },
        '!ref': 'B1:D10',
    };
    const parsed = app._kpiParseAvailabilityFactorBrackets(sheet);
    assert.equal(parsed.length, 2, 'correctly parses without any XLSX global in scope');
    assert.equal(parsed[0].line, 'L3');
    assert.equal(parsed[0].metric, 'PSA');
});

test('_kpiAvailabilityFactorFromBracket finds the correct bracket via range match, normalizing regardless of whether the row is listed ascending or descending', () => {
    const app = buildKpiApp({
        kpiAvailabilityFactorBrackets: [
            { line: 'L3', metric: 'PSA', lo: 99.3, hi: 100, factor: 0 },
            { line: 'L3', metric: 'PSA', lo: 99.2, hi: 99.29, factor: -0.01 },
        ],
    });
    assert.equal(app._kpiAvailabilityFactorFromBracket('PSA', 'L3', 99.944), 0);
    assert.equal(app._kpiAvailabilityFactorFromBracket('PSA', 'L3', 99.25), -0.01);
    assert.equal(app._kpiAvailabilityFactorFromBracket('PSA', 'L3', 50), null, 'no bracket covers this value');
});

test('_kpiAvailabilityMetricFactorScore prefers the bracket-based lookup over the standard threshold-based Factor Score when both are available', () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'PSA', name: 'PSA', period_type: 'monthly', exceptional_value: 100, unacceptable_value: 80 }],
        kpiResults: [{ kpi_definition_id: 1, year: 2026, period_value: '06', actual_value: 99.944, factor_score: 1.9 }], // standard computation would give 1.9
        kpiFeePeriods: [{ kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6 }],
        kpiAvailabilityFactorBrackets: [{ line: 'L3', metric: 'PSA', lo: 99.3, hi: 100, factor: 0 }], // real bracket gives 0
    });
    assert.equal(app._kpiAvailabilityMetricFactorScore('PSA', 'L3', 32, 'OMC'), 0, 'bracket-based Factor (0) wins over the standard threshold-based Factor Score (1.9)');
});

test('_kpiAvailabilityMetricFactorScore falls back to the standard threshold-based Factor Score when no bracket table is imported', () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'PSA', name: 'PSA', period_type: 'monthly', exceptional_value: 100, unacceptable_value: 80 }],
        kpiResults: [{ kpi_definition_id: 1, year: 2026, period_value: '06', actual_value: 99.944, factor_score: 1.9 }],
        kpiFeePeriods: [{ kpi_month_no: 32, kpi_year: 2026, kpi_cal_month: 6 }],
        kpiAvailabilityFactorBrackets: [],
    });
    assert.equal(app._kpiAvailabilityMetricFactorScore('PSA', 'L3', 32, 'OMC'), 1.9);
});

test('KPIs tab "All Directorates" filter shows KPIs from every directorate at once, and does not crash the ownership-weight calculation', () => {
    const app = buildKpiApp({
        kpiDirectorates: [
            { id: 10, name: 'Operations', company: 'OMC' },
            { id: 20, name: 'Maintenance', company: 'OMC' },
        ],
        kpiDirectorateDepartments: [
            { id: 100, directorate_id: 10, department_name: 'L3' },
            { id: 200, directorate_id: 20, department_name: 'L4' },
        ],
        kpiDefinitions: [
            { id: 1, directorate_id: 10, department_id: 100, kpi_code: 'A1', name: 'Ops KPI', period_type: 'monthly', is_active: true },
            { id: 2, directorate_id: 20, department_id: 200, kpi_code: 'A2', name: 'Maint KPI', period_type: 'monthly', is_active: true },
        ],
        kpiOwners: [],
    });
    app._escHtml = (s) => String(s == null ? '' : s);
    app.state._kpiSelectedCompany = 'OMC';
    app.state._kpiDefFilterDirectorateId = null;
    const fs = require('fs');
    const vm = require('vm');
    vm.runInThisContext('(function(app){' + fs.readFileSync(require('path').join(__dirname, '..', 'views-kpi.js'), 'utf8') + '})')(app);
    const html = app._renderKpiDefinitionsSection();
    assert.ok(html.includes('Ops KPI') && html.includes('Maint KPI'), 'both directorates KPIs show at once');
    assert.ok(html.includes('All Directorates'));
});

test('_kpiAvailabilityFactorBracketDetail returns the full matched bracket (not just the factor), for the positive-confirmation tooltip on a genuine 0 value', () => {
    const app = buildKpiApp({
        kpiAvailabilityFactorBrackets: [
            { line: 'L3', metric: 'PSA', lo: 99.3, hi: 100, factor: 0 },
            { line: 'L3', metric: 'PSA', lo: 99.2, hi: 99.29, factor: -0.01 },
        ],
    });
    const detail = app._kpiAvailabilityFactorBracketDetail('PSA', 'L3', 99.944);
    assert.equal(detail.lo, 99.3);
    assert.equal(detail.hi, 100);
    assert.equal(detail.factor, 0);
    assert.equal(app._kpiAvailabilityFactorBracketDetail('PSA', 'L3', 50), null, 'no bracket covers this value');
});

test('_kpiAvailabilityAllRowsForMonth always returns all 12 (Line,Metric) rows, even when NO raw M{N}_AFctr import exists for that month — reproduces the real reported bug: a genuine entered result + working bracket table for a month with no raw import', () => {
    const app = buildKpiApp({ kpiLineAvailability: [] }); // no raw import at all for any month
    const rows = app._kpiAvailabilityAllRowsForMonth(33);
    assert.equal(rows.length, 12, '4 lines x 3 metrics, regardless of the missing raw import');
    const l5psa = rows.find(r => r.line === 'L5' && r.metric === 'PSA');
    assert.equal(l5psa.raw_value, null, 'raw is null since no import exists for this month, but the row itself is still present');
});

test('_kpiAvailabilityAllRowsForMonth merges in real Raw/Remark data where the import DOES exist, leaving other months/lines as null placeholders', () => {
    const app = buildKpiApp({
        kpiLineAvailability: [{ line: 'L3', kpi_month_no: 32, metric: 'PSA', raw_value: 0, adjusted_value: 99.944, remark: 'note' }],
    });
    const rows32 = app._kpiAvailabilityAllRowsForMonth(32);
    assert.equal(rows32.length, 12);
    const l3psa = rows32.find(r => r.line === 'L3' && r.metric === 'PSA');
    assert.equal(l3psa.adjusted_value, 99.944);
    assert.equal(l3psa.remark, 'note');
    const l4psa = rows32.find(r => r.line === 'L4' && r.metric === 'PSA');
    assert.equal(l4psa.raw_value, null, 'no import for L4/PSA this month, correctly null, but still present as a row');

    const rows33 = app._kpiAvailabilityAllRowsForMonth(33);
    assert.equal(rows33.length, 12, 'month 33 still returns all 12 rows even with zero raw import rows for it');
});

test('Availability Factor table shows real KPIF/Cost for a month with a genuine entered result and bracket data but NO raw M{N}_AFctr import — the exact real reported scenario', () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L5' }],
        kpiDefinitions: [{ id: 1, directorate_id: 10, department_id: 100, kpi_code: 'PSA', name: 'PSA', period_type: 'monthly', direction: 'higher_is_better', exceptional_value: 99.3, target_value: 99.299, unacceptable_value: 89.9 }],
        kpiResults: [{ kpi_definition_id: 1, year: 2026, period_value: '07', actual_value: 95.01, factor_score: 0.54 }],
        kpiFeePeriods: [{ kpi_month_no: 33, kpi_year: 2026, kpi_cal_month: 7, kpi_fiscal_month: 'M33' }],
        kpiLineAvailability: [], // NO raw import for this month at all, matching the real report
        kpiAvailabilityFactorBrackets: [{ line: 'L5', metric: 'PSA', lo: 90, hi: 96, factor: 0.54 }],
        kpiLineAvailabilityBaseCost: [{ line: 'L5', metric: 'PSA', company: 'OMC', base_cost: 1000000 }],
    });
    app._escHtml = (s) => String(s == null ? '' : s);
    app.state._kpiSelectedCompany = 'OMC';
    const fs = require('fs');
    const vm = require('vm');
    vm.runInThisContext('(function(app){' + fs.readFileSync(require('path').join(__dirname, '..', 'views-kpi.js'), 'utf8') + '})')(app);
    const html = app._renderKpiFinancialReportingSection();
    assert.ok(!html.includes('No Availability Factor data imported yet'), 'table no longer bails out just because the raw import is missing');
    assert.ok(html.includes('95.010%'), 'shows the real entered result');
    assert.ok(html.includes('0.5400'), 'shows the real computed KPIF');
});

test('_kpiMatchReferenceCode matches a KPI name against the original A1-I1 reference, stripping a leading Line prefix and normalizing case', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiMatchReferenceCode('L3-Passenger satisfaction'), 'A1');
    assert.equal(app._kpiMatchReferenceCode('L5-Public Announcements'), 'B3');
    assert.equal(app._kpiMatchReferenceCode('Reporting'), 'I1');
    assert.equal(app._kpiMatchReferenceCode('Something not in the list'), null);
    assert.equal(app._kpiMatchReferenceCode(null), null);
});

test('auditKpiMissingCodes finds KPIs with no code, proposes a match where the name matches the reference, and leaves genuinely unmatched ones separate', () => {
    const app = buildKpiApp({
        kpiDirectorates: [{ id: 10, name: 'Operations', company: 'OMC' }],
        kpiDirectorateDepartments: [{ id: 100, directorate_id: 10, department_name: 'L3' }],
        kpiDefinitions: [
            { id: 1, directorate_id: 10, department_id: 100, name: 'L3-Passenger satisfaction', is_active: true, kpi_code: null },
            { id: 2, directorate_id: 10, department_id: 100, name: 'L3-Some Custom KPI', is_active: true, kpi_code: null },
            { id: 3, directorate_id: 10, department_id: 100, name: 'L3-Complaints resolution', is_active: true, kpi_code: 'A2' }, // already has a code, should be skipped entirely
        ],
    });
    const audit = app.auditKpiMissingCodes('OMC');
    assert.equal(audit.matches.length, 1);
    assert.equal(audit.matches[0].proposedCode, 'A1');
    assert.equal(audit.unmatched.length, 1);
    assert.equal(audit.unmatched[0].kpiName, 'L3-Some Custom KPI');
});

test('applyKpiCodeMatches writes the proposed code and updates in-memory state, only for the rows actually passed (simulating unchecked rows being excluded)', async () => {
    const app = buildKpiApp({
        kpiDefinitions: [{ id: 1, name: 'L3-Passenger satisfaction', kpi_code: null }],
    });
    let updatedRow = null;
    app.supabase = { from: () => ({ update: (row) => { updatedRow = row; return { eq: async () => ({ error: null }) }; } }) };
    app.showToast = () => {};

    const summary = await app.applyKpiCodeMatches([{ kpiId: 1, kpiName: 'L3-Passenger satisfaction', proposedCode: 'A1' }]);
    assert.equal(summary.updated, 1);
    assert.equal(updatedRow.kpi_code, 'A1');
    assert.equal(app.state.kpiDefinitions[0].kpi_code, 'A1', 'in-memory state updated too, not just the DB');
});

test('_kpiMatchReferenceCode now matches the verified PSA/TSA/FOSA full names, confirmed directly against the real KPI Results sheet data', () => {
    const app = buildKpiApp();
    assert.equal(app._kpiMatchReferenceCode('Passenger Service Availability'), 'PSA');
    assert.equal(app._kpiMatchReferenceCode('Transit System Availability'), 'TSA', 'real KPI found missing this exact mapping');
    assert.equal(app._kpiMatchReferenceCode('Facilities and Other System Availability'), 'FOSA');
});

test('auditKpiMissingCodes scans ALL companies at once, not scoped to whichever one happens to be selected — a real gap that could hide a KPI like the reported "Complaints per boarding" under a different company than expected', () => {
    const app = buildKpiApp({
        kpiDirectorates: [
            { id: 10, name: 'Operations', company: 'OMC' },
            { id: 20, name: 'Public Relations', company: 'Audit' },
        ],
        kpiDirectorateDepartments: [
            { id: 100, directorate_id: 10, department_name: 'L3' },
            { id: 200, directorate_id: 20, department_name: 'L3' },
        ],
        kpiDefinitions: [
            { id: 1, directorate_id: 10, department_id: 100, name: 'L3-Passenger satisfaction', is_active: true, kpi_code: null },
            { id: 2, directorate_id: 20, department_id: 200, name: 'Complaints per boarding', is_active: true, kpi_code: null },
        ],
    });
    const audit = app.auditKpiMissingCodes();
    assert.equal(audit.matches.length, 2, 'both KPIs found, regardless of which company each belongs to');
    const audit2 = audit.matches.find(m => m.kpiId === 2);
    assert.equal(audit2.proposedCode, 'A3');
    assert.equal(audit2.company, 'Audit');
});

test('applyKpiCodeMatches accepts a manually-typed code for an unmatched KPI, same write path as a proposed match', async () => {
    const app = buildKpiApp({
        kpiDefinitions: [{ id: 1, name: 'Some Custom KPI With No Reference Match', kpi_code: null }],
    });
    let updatedRow = null;
    app.supabase = { from: () => ({ update: (row) => { updatedRow = row; return { eq: async () => ({ error: null }) }; } }) };
    app.showToast = () => {};
    const summary = await app.applyKpiCodeMatches([{ kpiId: 1, kpiName: 'Some Custom KPI With No Reference Match', proposedCode: 'Z9' }]);
    assert.equal(summary.updated, 1);
    assert.equal(updatedRow.kpi_code, 'Z9');
});
