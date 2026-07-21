// test/harness.js
//
// Loads the REAL utils.js and allocation.js files — unmodified, exactly as
// deployed — into a sandboxed environment so their logic can be tested with
// plain Node, with no browser required. This is what makes the tests a true
// regression check: they run the actual production code, not a re-written
// copy of it that could quietly drift out of sync.
//
// Browser globals these files touch (document, window, localStorage,
// confirm, alert) are stubbed out with harmless no-ops, since the
// allocation engine doesn't need a real DOM to compute a result — it only
// touches those in specific side-effect paths (e.g. the "unconfigured
// departments" confirm() dialog) that tests can route around via
// { skipUnconfiguredConfirm: true }.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

/**
 * Builds a fresh `app` object with the given initial state, loads the real
 * utils.js + allocation.js source into it, and returns the app object ready
 * to call app.computeBidAllocation(...) / app.computeMaintBidAllocation(...) on.
 */
function buildApp(initialState) {
    const app = { state: initialState };

    const sandbox = {
        app,
        console,
        Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp,
        // Minimal no-op browser stubs — the allocation engine's core math never
        // touches these; only side-effect paths (toasts, the unconfigured-depts
        // confirm dialog) do, and tests avoid triggering those.
        document: {
            getElementById: () => null,
            createElement: () => ({ style: {}, setAttribute() {}, remove() {} }),
            body: { appendChild() {} },
        },
        window: { addEventListener() {} },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
        confirm: () => true,
        alert: () => {},
        requestAnimationFrame: (fn) => fn(),
        setTimeout: () => {},
    };
    vm.createContext(sandbox);

    for (const file of ['utils.js', 'allocation.js']) {
        const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
        vm.runInContext(code, sandbox, { filename: file });
    }

    return app;
}

// A minimal, valid base state — every field computeBidAllocation /
// computeMaintBidAllocation actually reads. Individual tests override just
// the pieces they care about (employees, bids, slotCapacities, ...).
function baseState(overrides = {}) {
    return {
        months: ['January', 'February', 'March', 'April', 'May', 'June',
                 'July', 'August', 'September', 'October', 'November', 'December'],
        biddingYear: 2027,
        slotTypes: [
            { id: 'slotA', name: 'Slot A', days: 15, color: 'green' },
            { id: 'slotB', name: 'Slot B', days: 15, color: 'blue' },
            { id: 'slotC', name: 'Slot C', days: 15, color: 'purple' },
            { id: 'slotD', name: 'Slot D', days: 20, color: 'orange' },
        ],
        employees: [],
        maintenanceStaffUsers: [],
        bids: [],
        slotCapacities: {},
        maintSlotCapacities: {},
        ...overrides,
    };
}

// Builds a "cal-{dept}-{month}-{slotId}-{field}" capacity key exactly as
// Configure OPS Slots writes it.
function opsSlotKeys(dept, month, slotId, { enabled = true, capacity, start, end }) {
    const p = `cal-${dept}-${month}-${slotId}`;
    return {
        [`${p}-enabled`]: enabled,
        [`${p}-capacity`]: capacity,
        [`${p}-start`]: start,
        [`${p}-end`]: end,
    };
}

// Builds a "cal-maint-{position}-{month}-{slotId}-{field}" capacity key
// exactly as Configure Maint Slots writes it.
function maintSlotKeys(position, month, slotId, { enabled = true, capacity, start, end }) {
    const p = `cal-maint-${position}-${month}-${slotId}`;
    return {
        [`${p}-enabled`]: enabled,
        [`${p}-capacity`]: capacity,
        [`${p}-start`]: start,
        [`${p}-end`]: end,
    };
}

module.exports = { buildApp, baseState, opsSlotKeys, maintSlotKeys };
