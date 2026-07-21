[README.md](https://github.com/user-attachments/files/30226425/README.md)
# Regression tests — allocation engine

Automated tests for `computeBidAllocation` (Ops) and `computeMaintBidAllocation`
(Maintenance) — the seniority-based leave allocation logic in `allocation.js`.

## How to run

```
npm test
```

No install needed — this uses Node's built-in test runner (Node 18+), not an
external testing framework. If `npm test` isn't available, the equivalent
direct command is:

```
node --test test/allocation.test.js
```

A clean run looks like this:

```
# tests 9
# pass 9
# fail 0
```

## What this actually tests

These tests load the **real, unmodified `utils.js` and `allocation.js`**
files — not a rewritten copy of the logic — into a sandboxed Node
environment (see `test/harness.js`). A passing suite means the actual
production code behaves correctly, not just that some separate
re-implementation of it does.

Covered scenarios, for both the Ops and Maintenance engines:
- The most senior person wins a contested slot when capacity is limited
- Capacity is never exceeded — a slot with capacity 1 never goes to 2 people
- Someone who submits no bid is always Auto-Assigned, never shown as "Bid Awarded"
- A lost 1st-choice bid correctly falls through and honors the 2nd choice
- Two employees tied on the exact same seniority date still produce a
  **deterministic** result — the same input always produces the same output,
  every time it's run (this is the scenario a one-off manual Preview
  Allocation check can't catch, since it only ever looks at today's real
  data — see the note below)
- A disabled slot is never awarded from or auto-assigned to, regardless of
  its configured capacity

## When to run this

- **Before deploying any change to `allocation.js`** — even a change that
  looks unrelated to the core matching logic. This is the single
  highest-stakes file in the whole app.
- **After any change to `utils.js`**, since `allocation.js` depends on a few
  of its helpers.
- Anytime something about allocation results looks off and you want to rule
  out (or confirm) a logic bug, independent of what today's real data
  happens to contain.

## How this differs from Preview Allocation

Preview Allocation (the button in the Admin panel) runs the real engine
against **today's real data** — genuinely useful, but it can only ever prove
the engine works for whatever situations exist in the data *right now*. If
no one has a tied seniority date today, Preview Allocation can't tell you
whether tie-breaking is handled correctly. This test suite uses deliberately
constructed scenarios — including edge cases that may not exist in today's
real data at all — so it can catch a regression *before* a real bidding
cycle ever produces the situation that would have exposed it.

They're complementary: Preview Allocation for "does this look right for what's
happening today", this suite for "does the core logic still behave correctly
in every situation it needs to handle, every time the code changes."

## Adding more scenarios later

Each test in `test/allocation.test.js` follows the same shape: build a
minimal `state` (employees, bids, slot capacities) with `baseState()` and
the `opsSlotKeys()` / `maintSlotKeys()` helpers from `test/harness.js`, call
`computeBidAllocation()` / `computeMaintBidAllocation()`, and assert on the
result. Copy the shape of an existing test as a starting point.

One thing worth knowing if you add a test involving **auto-assignment**
specifically: the Ops engine restricts auto-assignment eligibility by years
of service (≤5 years → Slot A/B only, >5 years → Slot C/D only) — this
restriction does **not** apply to direct bid-matching, only to the
leftover/auto-assign fallback. Make sure a test employee's `seniorityDate`
and the slot type(s) configured in the fixture are consistent with this
rule, or the test will show zero assignments for reasons that have nothing
to do with a real bug (this bit us once while first building this suite —
see the git history / conversation this was built in for the full story).
