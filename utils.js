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

