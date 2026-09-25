// ════════════════════════════════════════════════════════════════════
// utils.js — shared helper functions used across the app.
//
// `app` is declared as one big object literal inside app.js, so this
// file must load AFTER app.js (there'd be no `app` to attach to
// otherwise). This is safe: app.init() only runs on the page's
// `load` event, which fires after every script tag — including this
// one — has already finished executing. Every existing `this.xxx()`
// call site inside app.js keeps working unchanged, since by the time
// any of them actually run (on click, on load, etc.) these functions
// are already attached to the same shared `app` object.
//
// Functions here are either fully pure (no `this` dependency) or
// only touch small pieces of `this.state` for simple formatting —
// none of them talk to Supabase, the DOM beyond toast rendering, or
// hold any state of their own.
// ════════════════════════════════════════════════════════════════════

// XSS-safe HTML escaping — always wrap user-supplied strings before innerHTML
app._escHtml = function(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// Non-blocking toast — replaces alert() for notifications (level: 'success'|'error'|'warn'|'info')
app.showToast = function(message, level = 'info', duration = 4000) {
    const colors = {
        success: { bg: '#d1fae5', border: '#6ee7b7', text: '#065f46', icon: '✅' },
        error:   { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', icon: '❌' },
        warn:    { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', icon: '⚠️' },
        info:    { bg: '#e0e7ff', border: '#a5b4fc', text: '#3730a3', icon: 'ℹ️' },
    };
    const c = colors[level] || colors.info;
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.style.cssText = `position:fixed;bottom:84px;right:24px;z-index:9999;max-width:360px;padding:12px 16px;border-radius:12px;border:1.5px solid ${c.border};background:${c.bg};color:${c.text};font-size:0.875rem;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,0.12);opacity:0;transform:translateY(8px);transition:opacity 0.2s,transform 0.2s;white-space:pre-wrap;`;
    el.textContent = `${c.icon}  ${message}`;
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
    setTimeout(() => {
        el.style.opacity = '0'; el.style.transform = 'translateY(8px)';
        setTimeout(() => el.remove(), 250);
    }, duration);
};

// Converts a stored month name — which was only ever a label, not a real
// calendar month, and must never change — into a "Block N" label for
// anything a person reads. A slot's dates often drift into the following
// calendar month by the time you reach Slot C/D within a row, so labeling
// rows by month implied a promise the data never kept. "Block N" carries
// no such promise.
app.blockLabel = function(month) {
    const idx = this.state.months.indexOf(month);
    return idx >= 0 ? `Block ${idx + 1}` : (month || '—');
};

// "1st" / "2nd" / "3rd" / "4th"... used by the Bid Allocation Justification Report
app._ordinal = function(n) {
    if (n === 1) return '1st';
    if (n === 2) return '2nd';
    if (n === 3) return '3rd';
    return `${n}th`;
};

// Simple inclusive date-range overlap check
app.checkDateOverlap = function(startDate1, endDate1, startDate2, endDate2) {
    const start1 = new Date(startDate1);
    const end1 = new Date(endDate1);
    const start2 = new Date(startDate2);
    const end2 = new Date(endDate2);

    return (start1 <= end2 && end1 >= start2);
};

// Converts an ISO week number + year into a Sun-Sat calendar date range.
// Uses local date parts (not UTC) to avoid timezone offset shifting the
// date (e.g. UTC+3 can turn midnight into the previous day in UTC).
app.weekNumberToDateRange = function(weekNum, year) {
    const fmt = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    const jan1 = new Date(year, 0, 1);
    const jan1Day = jan1.getDay(); // 0=Sun, 6=Sat
    // Roll back to the Sunday on or before Jan 1
    const week1Sun = new Date(jan1);
    week1Sun.setDate(jan1.getDate() - jan1Day);
    // Week N starts (weekNum-1)*7 days after week1Sun
    const weekSun = new Date(week1Sun);
    weekSun.setDate(week1Sun.getDate() + (weekNum - 1) * 7);
    const weekSat = new Date(weekSun);
    weekSat.setDate(weekSun.getDate() + 6);
    return { from: fmt(weekSun), to: fmt(weekSat) };
};

// Converts a stored deadline value — which may come back from Supabase as a
// full ISO timestamp with seconds and a timezone offset (e.g.
// "2026-07-19T17:00:00+00:00") — into the exact "yyyy-MM-ddThh:mm" format
// <input type="datetime-local"> requires. Without this, the browser silently
// rejects the value (logs a console warning, leaves the field blank) instead
// of showing the deadline that's actually saved. Values already in the plain
// local-datetime format used by App aren't stored with timezone offsets, but
// this handles the Supabase round-trip that produces them.
app._toDatetimeLocal = function(val) {
    if (!val) return '';
    // Already in the exact required format
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val)) return val;
    // Strip seconds and any trailing timezone offset/Z, keep local date+time as-is
    // (deadlines are treated as local wall-clock time throughout this app, so this
    // is a format strip, not a timezone conversion).
    const m = val.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    return m ? m[1] : '';
};


// array of individual week numbers (1-53). Used by the On-Call Manager's
// multi-week entry fields.
app._parseMultiWeekInput = function(raw, year) {
    const tokens = raw.split(/[\s,;]+/).filter(Boolean);
    const weeks = new Set();
    for (const tok of tokens) {
        const m = tok.match(/^(\d+)-(\d+)$/);
        if (m) { for (let w = Math.max(1, +m[1]); w <= Math.min(53, +m[2]); w++) weeks.add(w); }
        else { const n = +tok; if (!isNaN(n) && n >= 1 && n <= 53) weeks.add(n); }
    }
    return [...weeks].sort((a, b) => a - b);
};

// Blocks leave continuity across the December→January year-end transition:
// staff who already have approved leave in the prior December (tracked in the
// december_leave_holders table, loaded into this.state.decemberLeaveHolders)
// cannot submit a bid for any slot whose dates overlap January of the given
// bidding year. Checked against the bid's REAL dates, not any stored month
// label — the same lesson learned the hard way with the allocation engine's
// date-drift bug: labels can be missing or wrong, real dates are authoritative.
// `year` is passed explicitly by the caller rather than assumed, since Ops/
// Maintenance use this.state.biddingYear while GC/CS use
// this.state.biddingYearCorp — a different field that can hold a different year.
app._blocksJanuaryBid = function(employeeId, startDate, endDate, year) {
    const holders = this.state.decemberLeaveHolders || [];
    if (!holders.includes(employeeId)) return false;
    if (!startDate || !endDate || !year) return false;

    const janStart = new Date(year, 0, 1);   // Jan 1
    const janEnd   = new Date(year, 0, 31);  // Jan 31
    const s = new Date(startDate);
    const e = new Date(endDate);

    return s <= janEnd && e >= janStart; // any overlap with January counts
};

// ════════════════════════════════════════════════════════════════════
// Leave Entitlement & Accrual Engine (Annual Leave Entitlement Balance
// module) — per explicit spec:
//   < 5 years of service: 30 days/year (0.0833/day, 2.5/month — DISPLAY
//     rates only, see below)
//   >= 5 years of service: 35 days/year (0.0972/day, 2.9166/month)
// The 5-year step takes effect exactly on the employee's 5th service
// anniversary (from their seniority/joining date — this app already
// uses seniority_date as the joining-date basis for entitlement, see
// the existing flat getEmployeeEntitlement in views-bidding.js).
//
// "Leave year" = calendar year (Jan 1 - Dec 31) of the year in
// question — consistent with how bidding/results are already
// year-scoped everywhere else in this app (results/bids carry a plain
// `year` field, "My Leave Results — 2027" etc.), not an anniversary-
// based year. Flagging this as the one real assumption in here: if the
// leave year should instead run anniversary-to-anniversary, the
// proration math below would need a different year-boundary, not just
// a tweak.
//
// Accuracy requirement: every calculation here uses the AUTHORITATIVE
// annual entitlement (30 or 35) directly — daily/monthly figures are
// derived by fraction-of-year math (days/daysInYear x 30, etc.), never
// by multiplying a rounded 0.0833/2.5/0.0972/2.9166 constant. Those
// rounded constants are exposed ONLY as display-only "applicable rate"
// fields (_leaveDisplayRates), exactly matching the two constants in
// the spec table, never fed back into any balance math.

app._leaveYearsOfService = function(seniorityDate, asOfDate) {
    if (!seniorityDate) return 0;
    const join = new Date(seniorityDate);
    const asOf = asOfDate ? new Date(asOfDate) : new Date();
    if (isNaN(join.getTime()) || isNaN(asOf.getTime())) return 0;
    return (asOf - join) / (1000 * 60 * 60 * 24 * 365.25);
};

// The exact calendar date of an employee's Nth service anniversary —
// exact date math (setFullYear), not a 365.25-day approximation, so
// this stays correct across leap years.
app._leaveAnniversaryDate = function(seniorityDate, n) {
    if (!seniorityDate) return null;
    const join = new Date(seniorityDate);
    if (isNaN(join.getTime())) return null;
    const anniv = new Date(join);
    anniv.setFullYear(join.getFullYear() + n);
    return anniv;
};

// Days in the leave year — fixed at 365 (365-day basis), per the
// corrected accrual table: Daily = 30/365 = 0.08219, 35/365 = 0.09589.
// Deliberately NOT leap-year-adjusted (this used to vary 365/366) so
// every calculation in this engine — proration, accrual, and the
// display-only daily/monthly rates below — sits on the exact same
// fixed 365-day convention; mixing a variable actual-days-in-year
// denominator here with a fixed 365 in the display rates would make
// the two silently drift apart.
app._leaveDaysInYear = function(date) {
    return 365;
};

// The authoritative annual entitlement (30 or 35) applicable AT a
// specific date, with no proration — the single source of truth every
// other calculation below is built from.
app._leaveAnnualRateAt = function(seniorityDate, date) {
    return this._leaveYearsOfService(seniorityDate, date) >= 5 ? 35 : 30;
};

// Entitlement for a full calendar year, correctly prorated across the
// 5-year anniversary if it falls inside that year: days before the
// anniversary accrue at 30/year, days from the anniversary onward
// accrue at 35/year, each as an exact fraction of the year — not the
// rounded daily constant. If the anniversary isn't in this year at
// all, this collapses to a flat 30 or 35 exactly.
app._leaveEntitlementForYear = function(seniorityDate, year) {
    if (!seniorityDate) return 30;
    const yearStart = new Date(year, 0, 1);
    const yearEndExclusive = new Date(year + 1, 0, 1);
    const daysInYear = this._leaveDaysInYear(yearStart);
    const fifthAnniv = this._leaveAnniversaryDate(seniorityDate, 5);

    if (!fifthAnniv || fifthAnniv <= yearStart) {
        return 35; // already 5+ years for the entire year
    }
    if (fifthAnniv >= yearEndExclusive) {
        return 30; // won't reach 5 years until a later year
    }
    // Anniversary falls inside this year — split proportionally. Rounded
    // to 2 decimals for clean display everywhere this value is shown
    // (bidding screens, allocation records, the balance report) — the
    // rounding happens once, here, at the source, rather than
    // differently at each place that displays it.
    const daysBefore = Math.round((fifthAnniv - yearStart) / (1000 * 60 * 60 * 24));
    const daysAfter = daysInYear - daysBefore;
    return Math.round(((daysBefore / daysInYear) * 30 + (daysAfter / daysInYear) * 35) * 100) / 100;
};

// Accrued balance as of a specific date within its calendar year —
// same before/after-anniversary split as _leaveEntitlementForYear, but
// only up through `asOfDate` instead of the full year.
app._leaveAccruedAsOf = function(seniorityDate, asOfDate) {
    if (!seniorityDate) return 0;
    const asOf = new Date(asOfDate);
    const year = asOf.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const daysInYear = this._leaveDaysInYear(yearStart);
    const daysElapsed = Math.round((asOf - yearStart) / (1000 * 60 * 60 * 24)) + 1; // inclusive of asOfDate itself
    const fifthAnniv = this._leaveAnniversaryDate(seniorityDate, 5);
    const round2 = (n) => Math.round(n * 100) / 100;

    if (!fifthAnniv || fifthAnniv <= yearStart) {
        return round2((daysElapsed / daysInYear) * 35);
    }
    if (fifthAnniv > asOf) {
        return round2((daysElapsed / daysInYear) * 30); // anniversary hasn't happened yet as of this date
    }
    // Anniversary already passed within this same year, before asOfDate.
    const daysBefore = Math.round((fifthAnniv - yearStart) / (1000 * 60 * 60 * 24));
    const daysAfterElapsed = daysElapsed - daysBefore;
    return round2((daysBefore / daysInYear) * 30 + (daysAfterElapsed / daysInYear) * 35);
};

// The next scheduled entitlement increase strictly after `asOfDate` —
// this 2-tier system only has ONE step (at 5 years), so once an
// employee has passed it, there is no further scheduled increase and
// this returns null (display this as "—" / "None scheduled").
app._leaveNextIncreaseDate = function(seniorityDate, asOfDate) {
    const fifthAnniv = this._leaveAnniversaryDate(seniorityDate, 5);
    const asOf = asOfDate ? new Date(asOfDate) : new Date();
    if (!fifthAnniv || fifthAnniv <= asOf) return null;
    return fifthAnniv;
};

// Display-only rates — the corrected table (365-day basis):
//   30 days/year -> daily 30/365 = 0.08219, monthly 30/12 = 2.50000
//   35 days/year -> daily 35/365 = 0.09589, monthly 35/12 = 2.91667
// Never used in any balance/accrual math above; purely what's shown to
// the user as "your applicable daily/monthly rate".
app._leaveDisplayRates = function(seniorityDate, asOfDate) {
    const isSenior = this._leaveYearsOfService(seniorityDate, asOfDate) >= 5;
    return isSenior ? { daily: 0.09589, monthly: 2.91667 } : { daily: 0.08219, monthly: 2.50000 };
};

// Full balance summary for one employee as of a given date — this is
// the one function a report/screen should actually call; it bundles
// everything the spec asks to be displayed. `awardedSlots` is that
// employee's own awarded leave records for the current leave year
// (from state.results / state.maintResults — each with startDate,
// endDate, days) so "already taken" vs "approved future" can be split
// by whether the slot has fully passed `asOfDate` yet.
app._leaveBalanceSummary = function(seniorityDate, asOfDate, awardedSlots) {
    const asOf = asOfDate ? new Date(asOfDate) : new Date();
    const year = asOf.getFullYear();
    const entitlement = this._leaveEntitlementForYear(seniorityDate, year);
    const accrued = this._leaveAccruedAsOf(seniorityDate, asOf);
    const rates = this._leaveDisplayRates(seniorityDate, asOf);
    const nextIncrease = this._leaveNextIncreaseDate(seniorityDate, asOf);

    let taken = 0, approvedFuture = 0;
    (awardedSlots || []).forEach(slot => {
        const end = new Date(slot.endDate);
        const start = new Date(slot.startDate);
        if (isNaN(end.getTime()) || isNaN(start.getTime())) return;
        if (end <= asOf) taken += slot.days; // fully in the past (or ending today)
        else if (start > asOf) approvedFuture += slot.days; // hasn't started yet
        else taken += slot.days; // in progress as of today — already underway
    });

    const remaining = accrued - taken - approvedFuture;

    return {
        yearsOfService: this._leaveYearsOfService(seniorityDate, asOf),
        annualEntitlement: entitlement,
        accruedBalance: accrued,
        leaveTaken: taken,
        approvedFutureLeave: approvedFuture,
        remainingBalance: remaining,
        dailyRate: rates.daily,
        monthlyRate: rates.monthly,
        nextIncreaseDate: nextIncrease,
    };
};


