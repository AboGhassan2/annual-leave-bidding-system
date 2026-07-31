// ════════════════════════════════════════════════════════════════════
// api-kpi.js — Data layer for the KPI subsystem.
//
// This is a fully separate module from leave/bidding — its own tables, its
// own login (kpi_users), its own state fields (state.kpi*). Nothing here
// reads or writes any leave-bidding data; the only connection to the rest
// of the app is that kpi_directorate_departments references the SAME
// department name strings used elsewhere (e.g. "L3-DEP-DM"), purely as a
// text match — there is no foreign key into the employees table.
//
// Two roles, both logging in via kpi_users:
//   - kpi_planner: full access — defines directorates, maps departments to
//     them, defines KPIs, enters/imports results. directorate_id is NULL.
//   - kpi_director: view-only, scoped to exactly one directorate_id.
//
// Attaches onto the shared `app` object, must load AFTER app.js and
// api-supabase.js (uses this._tid()).
// ════════════════════════════════════════════════════════════════════

// ── Load — pulls all 5 KPI tables in parallel (same lesson learned from
// loadFromSupabase's earlier parallelization: sequential awaits here
// would be needlessly slow for no benefit, since none of these tables
// depend on each other to load). ──────────────────────────────────────
app.loadKpiData = async function() {
    if (!this.supabase) return false;
    try {
        const tid = this._tid();
        const [directorates, deptMap, definitions, results, users] = await Promise.all([
            this.supabase.from('kpi_directorates').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_directorate_departments').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_definitions').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_results').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_users').select('*').eq('tenant_id', tid),
        ]);
        if (directorates.error) throw directorates.error;
        if (deptMap.error) throw deptMap.error;
        if (definitions.error) throw definitions.error;
        if (results.error) throw results.error;
        if (users.error) throw users.error;

        this.state.kpiDirectorates = directorates.data || [];
        this.state.kpiDirectorateDepartments = deptMap.data || [];
        this.state.kpiDefinitions = definitions.data || [];
        this.state.kpiResults = results.data || [];
        this.state.kpiUsers = users.data || [];
        console.log(`✅ Loaded KPI data: ${this.state.kpiDirectorates.length} directorates, ${this.state.kpiDefinitions.length} KPIs, ${this.state.kpiResults.length} results`);
        return true;
    } catch (e) {
        console.error('❌ Failed to load KPI data:', e.message);
        return false;
    }
};

// ════════════════════════════════════════════════════════════════════
// Directorates
// ════════════════════════════════════════════════════════════════════
app.saveKpiDirectorate = async function(name, existingId) {
    if (!this.supabase) return null;
    try {
        const row = { tenant_id: this._tid(), name };
        let query;
        if (existingId) {
            query = this.supabase.from('kpi_directorates').update(row).eq('id', existingId).select();
        } else {
            query = this.supabase.from('kpi_directorates').insert(row).select();
        }
        const { data, error } = await query;
        if (error) throw error;
        const saved = data[0];
        if (existingId) {
            this.state.kpiDirectorates = this.state.kpiDirectorates.map(d => d.id === existingId ? saved : d);
        } else {
            this.state.kpiDirectorates = [...this.state.kpiDirectorates, saved];
        }
        this.showToast(existingId ? 'Directorate updated.' : 'Directorate created.', 'success');
        return saved;
    } catch (e) {
        console.error('❌ Failed to save directorate:', e.message);
        this.showToast('Could not save directorate: ' + e.message, 'error');
        return null;
    }
};

app.deleteKpiDirectorate = async function(id) {
    if (!this.supabase) return false;
    try {
        // ON DELETE CASCADE on kpi_directorate_departments and
        // kpi_definitions (and kpi_results transitively) means removing
        // a directorate also removes its department mappings and every
        // KPI defined under it — this is a genuinely destructive action,
        // callers should confirm with the user before calling this.
        const { error } = await this.supabase.from('kpi_directorates').delete().eq('id', id);
        if (error) throw error;
        this.state.kpiDirectorates = this.state.kpiDirectorates.filter(d => d.id !== id);
        this.state.kpiDirectorateDepartments = this.state.kpiDirectorateDepartments.filter(d => d.directorate_id !== id);
        this.state.kpiDefinitions = this.state.kpiDefinitions.filter(d => d.directorate_id !== id);
        this.showToast('Directorate deleted.', 'success');
        return true;
    } catch (e) {
        console.error('❌ Failed to delete directorate:', e.message);
        this.showToast('Could not delete directorate: ' + e.message, 'error');
        return false;
    }
};

// Replaces the FULL set of departments mapped to a directorate — the
// simplest correct approach for a checkbox-style "which departments
// belong here" picker UI: delete what's there, insert the new list.
app.saveKpiDirectorateDepartments = async function(directorateId, departmentNames) {
    if (!this.supabase) return false;
    try {
        const { error: delError } = await this.supabase
            .from('kpi_directorate_departments')
            .delete()
            .eq('directorate_id', directorateId);
        if (delError) throw delError;

        let inserted = [];
        if (departmentNames.length > 0) {
            const rows = departmentNames.map(name => ({ tenant_id: this._tid(), directorate_id: directorateId, department_name: name }));
            const { data, error: insError } = await this.supabase.from('kpi_directorate_departments').insert(rows).select();
            if (insError) throw insError;
            inserted = data || [];
        }
        this.state.kpiDirectorateDepartments = [
            ...this.state.kpiDirectorateDepartments.filter(d => d.directorate_id !== directorateId),
            ...inserted,
        ];
        this.showToast('Department mapping updated.', 'success');
        return true;
    } catch (e) {
        console.error('❌ Failed to save directorate departments:', e.message);
        this.showToast('Could not save department mapping: ' + e.message, 'error');
        return false;
    }
};

// ════════════════════════════════════════════════════════════════════
// KPI Definitions
// ════════════════════════════════════════════════════════════════════
app.saveKpiDefinition = async function(def, existingId) {
    if (!this.supabase) return null;
    try {
        const row = {
            tenant_id: this._tid(),
            directorate_id: def.directorateId,
            name: def.name,
            category: def.category || '',
            unit: def.unit || '',
            target_value: def.targetValue,
            period_type: def.periodType || 'monthly',
            direction: def.direction || 'higher_is_better',
        };
        let query;
        if (existingId) {
            query = this.supabase.from('kpi_definitions').update(row).eq('id', existingId).select();
        } else {
            query = this.supabase.from('kpi_definitions').insert(row).select();
        }
        const { data, error } = await query;
        if (error) throw error;
        const saved = data[0];
        if (existingId) {
            this.state.kpiDefinitions = this.state.kpiDefinitions.map(d => d.id === existingId ? saved : d);
        } else {
            this.state.kpiDefinitions = [...this.state.kpiDefinitions, saved];
        }
        this.showToast(existingId ? 'KPI updated.' : 'KPI created.', 'success');
        return saved;
    } catch (e) {
        console.error('❌ Failed to save KPI definition:', e.message);
        this.showToast('Could not save KPI: ' + e.message, 'error');
        return null;
    }
};

app.deleteKpiDefinition = async function(id) {
    if (!this.supabase) return false;
    try {
        // ON DELETE CASCADE removes every result recorded under this KPI
        // too — callers should confirm with the user first.
        const { error } = await this.supabase.from('kpi_definitions').delete().eq('id', id);
        if (error) throw error;
        this.state.kpiDefinitions = this.state.kpiDefinitions.filter(d => d.id !== id);
        this.state.kpiResults = this.state.kpiResults.filter(r => r.kpi_definition_id !== id);
        this.showToast('KPI deleted.', 'success');
        return true;
    } catch (e) {
        console.error('❌ Failed to delete KPI definition:', e.message);
        this.showToast('Could not delete KPI: ' + e.message, 'error');
        return false;
    }
};

// ════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════
// Pure helper: computes a result's achievement % and status from a KPI
// definition and an actual value. Split out from saveKpiResult so this
// can be tested directly without Supabase.
//
// Achievement direction matters: for higher_is_better, beating the target
// means actual > target, so achievement = actual/target*100 (can exceed
// 100% when over-performing). For lower_is_better (e.g. incident counts),
// beating the target means actual < target, so achievement is INVERTED —
// target/actual*100 — so that under-shooting a lower-is-better target
// still reads as an achievement above 100%, matching the intuition that
// "beat the target" should always read as a good, >100% number regardless
// of which direction "good" means for this particular KPI.
// ════════════════════════════════════════════════════════════════════
app._computeKpiResultFields = function(kpiDef, actualValue) {
    const status = this.kpiStatus(actualValue, kpiDef?.target_value, kpiDef?.direction);
    if (status === 'no_data') return { achievement: null, status };

    const a = Number(actualValue), t = Number(kpiDef.target_value);
    let achievement = null;
    if (t !== 0) {
        achievement = kpiDef.direction === 'lower_is_better'
            ? (a !== 0 ? Math.round((t / a) * 10000) / 100 : null)
            : Math.round((a / t) * 10000) / 100;
    }
    return { achievement, status };
};

app.saveKpiResult = async function(kpiDefinitionId, { year, periodType, periodValue, actualValue, remarks, source }) {
    if (!this.supabase) return null;
    try {
        const kpiDef = (this.state.kpiDefinitions || []).find(k => k.id === kpiDefinitionId);
        if (!kpiDef) { this.showToast('Could not find that KPI definition.', 'error'); return null; }

        const { achievement, status } = this._computeKpiResultFields(kpiDef, actualValue);
        // period_label kept for backward compatibility with anything still
        // reading the old combined-string format (e.g. "2027-01", "2027-Q1").
        const periodLabel = periodType === 'yearly' ? `${year}` : `${year}-${periodValue}`;

        const row = {
            tenant_id: this._tid(),
            kpi_definition_id: kpiDefinitionId,
            directorate_id: kpiDef.directorate_id || null,
            department_id: kpiDef.department_id || null,
            year,
            period_type: periodType,
            period_value: periodType === 'yearly' ? null : String(periodValue),
            period_label: periodLabel,
            actual_value: actualValue,
            // Snapshotted at entry time — this result's status/achievement
            // must stay historically accurate even if the KPI's own target
            // is edited later, so the target is copied here rather than
            // always re-read live from kpi_definitions.
            target_value: kpiDef.target_value,
            achievement,
            status,
            remarks: remarks || '',
            source: source || 'manual',
            entered_by: this.state.verifiedKpiUser ? this.state.verifiedKpiUser.name : '',
            entered_at: new Date().toISOString(),
        };
        const { data, error } = await this.supabase
            .from('kpi_results')
            .upsert(row, { onConflict: 'kpi_definition_id,period_label' })
            .select();
        if (error) throw error;
        const saved = data[0];
        const already = this.state.kpiResults.find(r => r.kpi_definition_id === kpiDefinitionId && r.period_label === periodLabel);
        if (already) {
            this.state.kpiResults = this.state.kpiResults.map(r => (r.kpi_definition_id === kpiDefinitionId && r.period_label === periodLabel) ? saved : r);
        } else {
            this.state.kpiResults = [...this.state.kpiResults, saved];
        }
        return saved;
    } catch (e) {
        console.error('❌ Failed to save KPI result:', e.message);
        this.showToast('Could not save result: ' + e.message, 'error');
        return null;
    }
};

app.deleteKpiResult = async function(id) {
    if (!this.supabase) return false;
    try {
        const { error } = await this.supabase.from('kpi_results').delete().eq('id', id);
        if (error) throw error;
        this.state.kpiResults = this.state.kpiResults.filter(r => r.id !== id);
        return true;
    } catch (e) {
        console.error('❌ Failed to delete KPI result:', e.message);
        this.showToast('Could not delete result: ' + e.message, 'error');
        return false;
    }
};

// Approves an already-entered result — only Administrator (kpi_planner)
// and Department Manager may do this (see _kpiCanApproveResults). Checked
// here too, not just hidden in the UI, so this can't be called successfully
// by a role that shouldn't have access even if someone finds another way
// to trigger it.
app.approveKpiResult = async function(id) {
    const actingUser = this.state.verifiedKpiUser;
    if (!actingUser || !this._kpiCanApproveResults(actingUser.role)) {
        this.showToast('You do not have permission to approve results.', 'error');
        return false;
    }
    if (!this.supabase) return false;
    try {
        const row = { approved_by: actingUser.name, approved_at: new Date().toISOString() };
        const { data, error } = await this.supabase.from('kpi_results').update(row).eq('id', id).select();
        if (error) throw error;
        const saved = data[0];
        this.state.kpiResults = this.state.kpiResults.map(r => r.id === id ? saved : r);
        this.showToast('Result approved.', 'success');
        return true;
    } catch (e) {
        console.error('❌ Failed to approve KPI result:', e.message);
        this.showToast('Could not approve result: ' + e.message, 'error');
        return false;
    }
};

// ════════════════════════════════════════════════════════════════════
// KPI Users (login credentials for both roles)
// ════════════════════════════════════════════════════════════════════
app.saveKpiUser = async function(user, existingId) {
    if (!this.supabase) return null;
    try {
        const row = {
            tenant_id: this._tid(),
            name: user.name,
            // Linked accounts (see grantKpiDirectorAccessToCsDirectors) never
            // store a real password — their login always checks the Corporate
            // Staff record's current password instead (_kpiValidPassword
            // handles this). A placeholder is stored here only because the
            // column is NOT NULL; it's never actually compared against.
            password: user.linkedLogin ? '(linked to Corporate Staff)' : user.password,
            role: user.role,
            directorate_id: user.role === 'kpi_director' ? user.directorateId : null,
            linked_login: !!user.linkedLogin,
        };
        let query;
        if (existingId) {
            query = this.supabase.from('kpi_users').update(row).eq('id', existingId).select();
        } else {
            query = this.supabase.from('kpi_users').insert({ id: user.id, ...row }).select();
        }
        const { data, error } = await query;
        if (error) throw error;
        const saved = data[0];
        if (existingId) {
            this.state.kpiUsers = this.state.kpiUsers.map(u => u.id === existingId ? saved : u);
        } else {
            this.state.kpiUsers = [...this.state.kpiUsers, saved];
        }
        this.showToast(existingId ? 'User updated.' : 'User created.', 'success');
        return saved;
    } catch (e) {
        console.error('❌ Failed to save KPI user:', e.message);
        this.showToast('Could not save user: ' + e.message, 'error');
        return null;
    }
};

// ════════════════════════════════════════════════════════════════════
// Pure helper: which Corporate Staff records count as "directors" — role
// field contains the word "director", case-insensitive (e.g. "Operations
// Director", "OCC Duty Manager" does NOT match). No state writes, safe to
// test directly.
// ════════════════════════════════════════════════════════════════════
app._csDirectors = function() {
    return (this.state.corporateStaffUsers || []).filter(u => (u.role || '').toLowerCase().includes('director'));
};

// Pure helper: derives a directorate name from a role title by stripping
// "director"/"director of" — e.g. "HR Director" -> "HR", "Director of
// Engineering" -> "Engineering", "safety director" -> "safety". This is
// what makes a director's directorate match the department they're
// actually appointed over, rather than being left generically unassigned.
// No state reads/writes, safe to test directly.
app._deriveDirectorateNameFromRole = function(role) {
    if (!role) return '';
    const cleaned = role
        .replace(/^director\s+of\s+/i, '')
        .replace(/\s*director\s*$/i, '')
        .trim();
    return cleaned || role.trim();
};

// Bulk-grants KPI Executive Director access to every Corporate Staff
// member whose role contains "director" and doesn't already have a
// kpi_users record. Created with linked_login=true (their password always
// checks their current Corporate Staff password — see _kpiValidPassword).
// Each director's directorate is auto-derived from their role title (e.g.
// "HR Director" -> a directorate named "HR") — reusing a matching
// existing directorate by name if one already exists (case-insensitive),
// or creating a new one if not. The planner can still rename or reassign
// it afterward in Manage KPI Users if the auto-derived name isn't quite
// right.
app.grantKpiDirectorAccessToCsDirectors = async function() {
    const directors = this._csDirectors();
    const existingIds = new Set((this.state.kpiUsers || []).map(u => u.id));
    const toCreate = directors.filter(d => !existingIds.has(d.id));

    if (toCreate.length === 0) {
        this.showToast('No new directors to grant access to — everyone matching is already set up.', 'success');
        return { created: 0, skipped: directors.length };
    }

    let created = 0;
    for (const d of toCreate) {
        const derivedName = this._deriveDirectorateNameFromRole(d.role);
        let directorate = (this.state.kpiDirectorates || []).find(dir => dir.name.toLowerCase() === derivedName.toLowerCase());
        if (!directorate && derivedName) {
            directorate = await this.saveKpiDirectorate(derivedName, null);
        }
        const saved = await this.saveKpiUser({
            id: d.id, name: d.name, role: 'kpi_director',
            directorateId: directorate ? directorate.id : null, linkedLogin: true,
        }, null);
        if (saved) created++;
    }
    this.showToast(`Granted KPI Director access to ${created} director${created !== 1 ? 's' : ''}, matched to their departments by role title.`, 'success');
    return { created, skipped: directors.length - created };
};

app.deleteKpiUser = async function(id) {
    if (!this.supabase) return false;
    try {
        const { error } = await this.supabase.from('kpi_users').delete().eq('id', id);
        if (error) throw error;
        this.state.kpiUsers = this.state.kpiUsers.filter(u => u.id !== id);
        this.showToast('User deleted.', 'success');
        return true;
    } catch (e) {
        console.error('❌ Failed to delete KPI user:', e.message);
        this.showToast('Could not delete user: ' + e.message, 'error');
        return false;
    }
};

// ════════════════════════════════════════════════════════════════════
// Pure helper: decides whether an entered password is correct for a given
// kpi_users record. Split out from kpiLogin specifically so the
// linked_login behavior (validate against the person's CURRENT Corporate
// Staff password instead of a separately-stored one) can be tested
// directly, without mocking Supabase. No state writes.
// ════════════════════════════════════════════════════════════════════
app._kpiValidPassword = function(user, enteredPassword) {
    if (!user) return false;
    if (user.linked_login) {
        // Directors granted access via Corporate Staff role never get a
        // separately-stored KPI password — their login always checks
        // whatever their Corporate Staff password currently is, so a
        // password change there is reflected here automatically with no
        // separate update needed.
        const csUser = (this.state.corporateStaffUsers || []).find(u => u.id === user.id);
        return !!csUser && csUser.password === enteredPassword;
    }
    return user.password === enteredPassword;
};

// ════════════════════════════════════════════════════════════════════
// Pure helper: decides whether a login attempt is allowed through a
// SPECIFIC entry point — the Planner header modal or the Director card.
// Both password AND role must match: entering valid Director credentials
// into the Planner modal (or vice versa) is rejected outright, even
// though the account itself is real and the password is correct. This is
// deliberately stricter than "log in, then route by whatever role is
// stored" — each entry point is dedicated to exactly one role, not a
// shared gateway that happens to redirect differently afterward.
// No state writes, safe to test directly.
// ════════════════════════════════════════════════════════════════════
app._kpiLoginAllowed = function(user, enteredPassword, expectedRole) {
    if (!user) return { ok: false, reason: 'No account found with that ID.' };
    if (!this._kpiValidPassword(user, enteredPassword)) {
        return { ok: false, reason: 'Incorrect password.' };
    }
    if (user.role !== expectedRole) {
        const roleLabel = { kpi_planner: 'KPI Planner', kpi_director: 'KPI Executive Director' };
        return { ok: false, reason: `This ID is registered as ${roleLabel[user.role] || user.role}, not ${roleLabel[expectedRole] || expectedRole}. Please use the correct login.` };
    }
    return { ok: true };
};

// ════════════════════════════════════════════════════════════════════
// Login — checked against state.kpiUsers, the same client-side
// credential-check pattern every other role in this app already uses
// (employeePasswords, maintenanceStaffPasswords, etc.) — consistent
// with the existing architecture, not a new pattern introduced here.
// expectedRole is REQUIRED — the Planner modal always passes
// 'kpi_planner', the Director card always passes 'kpi_director', so each
// entry point only ever admits its own role (see _kpiLoginAllowed above).
// ════════════════════════════════════════════════════════════════════
app.kpiLogin = async function(id, password, expectedRole) {
    if (!this.state.kpiUsers || this.state.kpiUsers.length === 0) {
        await this.loadKpiData();
    }
    const user = (this.state.kpiUsers || []).find(u => u.id === id);
    const check = this._kpiLoginAllowed(user, password, expectedRole);
    if (!check.ok) {
        this.showToast(check.reason, 'error');
        return false;
    }
    this.state.verifiedKpiUser = user;
    this.state.userType = user.role; // 'kpi_planner' or 'kpi_director'
    if (this.writeAuditLog) {
        this.writeAuditLog('LOGIN', { name: user.name, id: user.id, role: user.role });
    }
    return true;
};

// ════════════════════════════════════════════════════════════════════
// Pure helper: computes a KPI's status given its actual value, target,
// and direction. No state reads/writes — safe to unit test directly,
// and reused by both the Planner's entry screen and the Director's
// card dashboard in later stages.
// ════════════════════════════════════════════════════════════════════
app.kpiStatus = function(actualValue, targetValue, direction) {
    if (actualValue === null || actualValue === undefined || targetValue === null || targetValue === undefined) {
        return 'no_data';
    }
    const a = Number(actualValue), t = Number(targetValue);
    if (Number.isNaN(a) || Number.isNaN(t)) return 'no_data';
    const meetsOrBeats = direction === 'lower_is_better' ? a <= t : a >= t;
    return meetsOrBeats ? 'on_target' : 'below_target';
};

// ════════════════════════════════════════════════════════════════════
// Stage 4 — Director dashboard pure helpers. All take state as an
// explicit dataset via `this`, no DOM/Supabase access, safe to unit test.
// ════════════════════════════════════════════════════════════════════

// A KPI's effective directorate: prefers the department it's owned by
// (department_id -> that department's own directorate_id), falling back
// to the KPI's own directorate_id directly for older KPIs saved before
// department_id existed.
app._kpiEffectiveDirectorateId = function(kpiDef) {
    if (kpiDef.department_id) {
        const dept = (this.state.kpiDirectorateDepartments || []).find(d => d.id === kpiDef.department_id);
        if (dept) return dept.directorate_id;
    }
    return kpiDef.directorate_id ?? null;
};

// Every active KPI belonging to a directorate, via the resolver above.
app._kpisForDirectorate = function(directorateId) {
    return (this.state.kpiDefinitions || []).filter(k =>
        k.is_active !== false && this._kpiEffectiveDirectorateId(k) === directorateId
    );
};

// Dashboard summary cards: total KPIs, how many have their most recent
// result on_target vs below_target for the given year, and how many have
// no result recorded at all yet for that year ("pending").
app._kpiDashboardCards = function(directorateId, year) {
    const kpis = this._kpisForDirectorate(directorateId);
    let achieved = 0, belowTarget = 0, pending = 0;
    kpis.forEach(k => {
        const results = (this.state.kpiResults || [])
            .filter(r => r.kpi_definition_id === k.id && r.year === year)
            .sort((a, b) => (b.entered_at || '').localeCompare(a.entered_at || ''));
        if (results.length === 0) { pending++; return; }
        const latestStatus = results[0].status || this.kpiStatus(results[0].actual_value, results[0].target_value, k.direction);
        if (latestStatus === 'on_target') achieved++;
        else if (latestStatus === 'below_target') belowTarget++;
        else pending++;
    });
    return { total: kpis.length, achieved, belowTarget, pending };
};

// Ranks the departments mapped to this directorate by their average
// achievement % across their KPIs' most recent result for the given year.
// Departments with no results yet are excluded from the ranking (nothing
// to rank), not shown with a misleading 0%.
app._kpiDepartmentRanking = function(directorateId, year) {
    const departments = (this.state.kpiDirectorateDepartments || []).filter(d => d.directorate_id === directorateId);
    const ranking = departments.map(dept => {
        const kpis = (this.state.kpiDefinitions || []).filter(k => k.is_active !== false && k.department_id === dept.id);
        const achievements = [];
        kpis.forEach(k => {
            const results = (this.state.kpiResults || [])
                .filter(r => r.kpi_definition_id === k.id && r.year === year && r.achievement != null)
                .sort((a, b) => (b.entered_at || '').localeCompare(a.entered_at || ''));
            if (results.length > 0) achievements.push(results[0].achievement);
        });
        const avgAchievement = achievements.length > 0
            ? Math.round((achievements.reduce((s, v) => s + v, 0) / achievements.length) * 100) / 100
            : null;
        return { departmentId: dept.id, departmentName: dept.department_name, avgAchievement, kpiCount: kpis.length };
    }).filter(d => d.avgAchievement !== null);
    ranking.sort((a, b) => b.avgAchievement - a.avgAchievement);
    return ranking;
};

// Average achievement % per period value, across all of a directorate's
// KPIs matching the given cadence (monthly/quarterly/yearly) — the data
// source for each of the 3 separate performance charts. Periods with no
// results from any KPI are omitted rather than shown as a misleading 0%.
// Returns every KPI in this directorate with its most recent achievement %
// for the given year, sorted descending (call .slice/.reverse for
// top-N/bottom-N — kept as one list so both views stay consistent with
// each other rather than computed by two separate, potentially-diverging
// queries).
app._kpiRankedList = function(directorateId, year) {
    const kpis = this._kpisForDirectorate(directorateId);
    const withAchievement = kpis.map(k => {
        const results = (this.state.kpiResults || [])
            .filter(r => r.kpi_definition_id === k.id && r.year === year && r.achievement != null)
            .sort((a, b) => (b.entered_at || '').localeCompare(a.entered_at || ''));
        return { kpiId: k.id, name: k.name, achievement: results.length > 0 ? results[0].achievement : null };
    }).filter(k => k.achievement !== null);
    withAchievement.sort((a, b) => b.achievement - a.achievement);
    return withAchievement;
};

app._kpiPerformanceByPeriod = function(directorateId, year, periodType) {
    const kpis = this._kpisForDirectorate(directorateId).filter(k => k.period_type === periodType);
    const byPeriod = {};
    kpis.forEach(k => {
        (this.state.kpiResults || [])
            .filter(r => r.kpi_definition_id === k.id && r.year === year && r.achievement != null)
            .forEach(r => {
                const key = r.period_value || String(year);
                if (!byPeriod[key]) byPeriod[key] = [];
                byPeriod[key].push(r.achievement);
            });
    });
    return Object.entries(byPeriod)
        .map(([period, values]) => ({
            period,
            avgAchievement: Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
};

// ════════════════════════════════════════════════════════════════════
// Stage 5 — the 3 new fine-grained roles: Department Manager and Data
// Entry (both scoped to ONE department within a directorate — narrower
// than Directorate Manager's whole-directorate scope), and Viewer (same
// whole-directorate scope as Directorate Manager, read-only). All pure,
// no state writes, safe to test directly.
// ════════════════════════════════════════════════════════════════════

// Whether this role can enter/edit KPI results at all.
app._kpiCanEnterResults = function(role) {
    return role === 'kpi_planner' || role === 'department_manager' || role === 'data_entry';
};

// Whether this role can approve an already-entered result. Only
// Administrator (kpi_planner) and Department Manager can — Data Entry can
// enter results but never approve them, and Directorate Manager/Viewer
// are read-only entirely.
app._kpiCanApproveResults = function(role) {
    return role === 'kpi_planner' || role === 'department_manager';
};

// Resolves what a user is allowed to see: which directorate, and — for
// the two department-scoped roles — which single department within it.
// department_manager/data_entry -> exactly one department (their own).
// kpi_director/viewer -> the whole directorate (department: null means
// "no department-level restriction", not "no access").
// kpi_planner -> unrestricted (directorate: null means "sees everything").
app._kpiUserScope = function(user) {
    if (!user) return { directorateId: null, departmentId: null, unrestricted: false };
    if (user.role === 'kpi_planner') {
        return { directorateId: null, departmentId: null, unrestricted: true };
    }
    if (user.role === 'department_manager' || user.role === 'data_entry') {
        const dept = (this.state.kpiDirectorateDepartments || []).find(d => d.id === user.department_id);
        return { directorateId: dept ? dept.directorate_id : null, departmentId: user.department_id ?? null, unrestricted: false };
    }
    // kpi_director / viewer: whole directorate, no department restriction
    return { directorateId: user.directorate_id ?? null, departmentId: null, unrestricted: false };
};

// KPIs visible to a user given their resolved scope — department-scoped
// roles see only their own department's KPIs; directorate-scoped roles
// see everything under the directorate (reuses _kpisForDirectorate).
app._kpisForUserScope = function(user) {
    const scope = this._kpiUserScope(user);
    if (scope.unrestricted) return (this.state.kpiDefinitions || []).filter(k => k.is_active !== false);
    if (scope.departmentId) {
        return (this.state.kpiDefinitions || []).filter(k => k.is_active !== false && k.department_id === scope.departmentId);
    }
    if (scope.directorateId) return this._kpisForDirectorate(scope.directorateId);
    return [];
};

