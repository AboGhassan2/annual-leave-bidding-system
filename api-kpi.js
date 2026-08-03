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
        const [directorates, deptMap, definitions, results, users, owners] = await Promise.all([
            this.supabase.from('kpi_directorates').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_directorate_departments').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_definitions').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_results').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_users').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_owners').select('*').eq('tenant_id', tid),
        ]);
        if (directorates.error) throw directorates.error;
        if (deptMap.error) throw deptMap.error;
        if (definitions.error) throw definitions.error;
        if (results.error) throw results.error;
        if (users.error) throw users.error;
        if (owners.error) throw owners.error;

        this.state.kpiDirectorates = directorates.data || [];
        this.state.kpiDirectorateDepartments = deptMap.data || [];
        this.state.kpiDefinitions = definitions.data || [];
        this.state.kpiResults = results.data || [];
        this.state.kpiUsers = users.data || [];
        this.state.kpiOwners = owners.data || [];
        console.log(`✅ Loaded KPI data: ${this.state.kpiDirectorates.length} directorates, ${this.state.kpiDefinitions.length} KPIs, ${this.state.kpiResults.length} results, ${this.state.kpiOwners.length} owner records`);
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
// Pure helper: the 4 fixed operational lines every directorate has. Not
// planner-configurable per-directorate the way departments used to be —
// this replaced the old free-text department-mapping concept entirely,
// per explicit correction: KPI structure is Directorate -> Line, not
// Directorate -> arbitrary department.
app._kpiStandardLines = function() {
    return ['L3', 'L4', 'L5', 'L6'];
};

// Idempotent: ensures a directorate has all 4 standard line rows,
// inserting ONLY whichever are missing — deliberately never deletes or
// replaces existing ones, since a line row's id is what KPIs actually
// reference (kpi_definitions.department_id). A delete+recreate approach
// (like saveKpiDirectorateDepartments uses) would generate fresh ids
// every time and silently orphan any KPI already pointing at the old
// ones. Safe to call repeatedly/on every directorate on load.
app.ensureKpiLinesForDirectorate = async function(directorateId) {
    if (!this.supabase) return false;
    const existing = (this.state.kpiDirectorateDepartments || []).filter(d => d.directorate_id === directorateId);
    const existingNames = new Set(existing.map(d => d.department_name));
    const missing = this._kpiStandardLines().filter(line => !existingNames.has(line));
    if (missing.length === 0) return true;

    try {
        const rows = missing.map(line => ({ tenant_id: this._tid(), directorate_id: directorateId, department_name: line }));
        const { data, error } = await this.supabase.from('kpi_directorate_departments').insert(rows).select();
        if (error) throw error;
        this.state.kpiDirectorateDepartments = [...this.state.kpiDirectorateDepartments, ...(data || [])];
        return true;
    } catch (e) {
        console.error('❌ Failed to ensure KPI lines for directorate:', e.message);
        return false;
    }
};

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
            department_id: def.departmentId,
            name: def.name,
            category: def.category || '',
            unit: def.unit || '',
            target_value: def.targetValue,
            period_type: def.periodType || 'monthly',
            direction: def.direction || 'higher_is_better',
            kpi_code: def.kpiCode || null,
            exceptional_value: def.exceptionalValue != null ? def.exceptionalValue : null,
            unacceptable_value: def.unacceptableValue != null ? def.unacceptableValue : null,
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
            // A "super user" kpi_director can browse EVERY directorate
            // (view-only — the UI never gives them edit controls), rather
            // than being locked to a single directorate_id like a normal
            // director. Only meaningful when role is kpi_director.
            can_view_all_directorates: user.role === 'kpi_director' ? !!user.canViewAllDirectorates : false,
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
// Finds the source record for a linked KPI login, searching every roster
// a person might actually belong to — not just Corporate Staff. Directors
// are most commonly Corporate Staff, but the Planner can manually link
// any account (e.g. someone who's actually on the Golden Command roster),
// so this can't assume just one source. Returns the first match found, or
// null.
app._kpiFindLinkedSourceUser = function(id) {
    const rosters = [
        this.state.corporateStaffUsers,
        this.state.goldenCommandUsers,
        this.state.employees,
        this.state.maintenanceStaffUsers,
    ];
    for (const roster of rosters) {
        const match = (roster || []).find(u => u.id === id);
        if (match) return match;
    }
    return null;
};

app._kpiValidPassword = function(user, enteredPassword) {
    if (!user) return false;
    if (user.linked_login) {
        // Directors/managers granted access via another roster's role never
        // get a separately-stored KPI password — their login always checks
        // whatever their password currently is on that source roster, so a
        // password change there is reflected here automatically with no
        // separate update needed.
        const sourceUser = this._kpiFindLinkedSourceUser(user.id);
        return !!sourceUser && sourceUser.password === enteredPassword;
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
            // A KPI's cadence can be edited by the planner after results
            // already exist under the old one (e.g. quarterly -> monthly)
            // — those old rows keep the SAME kpi_definition_id but their
            // OWN, now-stale period_type. Filtering only on the KPI's
            // current period_type (via the outer `kpis` filter above)
            // isn't enough; each individual result must also match, or
            // leftover results from a previous cadence bleed into this
            // one's chart.
            .filter(r => r.kpi_definition_id === k.id && r.year === year && r.period_type === periodType && r.achievement != null)
            .forEach(r => {
                const key = r.period_value || String(year);
                if (!byPeriod[key]) byPeriod[key] = { achievements: [], actuals: [], targets: [] };
                byPeriod[key].achievements.push(r.achievement);
                if (r.actual_value != null) byPeriod[key].actuals.push(r.actual_value);
                if (r.target_value != null) byPeriod[key].targets.push(r.target_value);
            });
    });
    const avg = arr => arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100 : null;
    return Object.entries(byPeriod)
        .map(([period, v]) => ({
            period,
            avgAchievement: avg(v.achievements),
            // With multiple KPIs averaged together, actual/target are
            // themselves averages across KPIs — same treatment as
            // avgAchievement, just applied consistently to the other two
            // figures so the tooltip can show all three regardless of
            // whether one KPI or several are being averaged.
            avgActual: avg(v.actuals),
            avgTarget: avg(v.targets),
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
};

// Multi-year/quarter trend: for every KPI of a given cadence (yearly or
// quarterly), returns its full achievement history across EVERY year that
// has results — not scoped to a single selected year, unlike
// _kpiPerformanceByPeriod above. One series per KPI, aligned to a shared,
// chronologically-sorted label axis so multiple KPIs' trends can be
// plotted together; a KPI missing a given period gets null there rather
// than 0, so a line chart correctly shows a gap instead of a false dip.
// KPIs with zero recorded results anywhere are omitted entirely.
app._kpiMultiYearTrend = function(directorateId, periodType) {
    const kpis = this._kpisForDirectorate(directorateId).filter(k => k.period_type === periodType);
    if (kpis.length === 0) return { labels: [], series: [] };

    const allLabels = new Set();
    const resultsByKpi = {};
    kpis.forEach(k => {
        // Same fix as _kpiPerformanceByPeriod: must also check each
        // result's OWN period_type, not just the KPI's current cadence —
        // a KPI edited from one cadence to another leaves old results
        // behind under the same kpi_definition_id.
        const results = (this.state.kpiResults || []).filter(r => r.kpi_definition_id === k.id && r.period_type === periodType && r.achievement != null);
        resultsByKpi[k.id] = {};
        results.forEach(r => {
            allLabels.add(r.period_label);
            resultsByKpi[k.id][r.period_label] = { achievement: r.achievement, actualValue: r.actual_value, targetValue: r.target_value };
        });
    });
    const labels = Array.from(allLabels).sort();

    const series = kpis
        .map(k => ({
            id: k.id,
            name: k.name,
            data: labels.map(label => (label in resultsByKpi[k.id]) ? resultsByKpi[k.id][label].achievement : null),
            // Parallel, same-length array — details[i] describes data[i].
            // Kept separate from `data` itself so Chart.js's own reading
            // of bar heights (plain numbers) is completely unaffected;
            // only the tooltip callback needs to look this up.
            details: labels.map(label => (label in resultsByKpi[k.id]) ? resultsByKpi[k.id][label] : null),
        }))
        .filter(s => s.data.some(v => v !== null));

    return { labels, series };
};

// The 3 calendar months (as period_value strings, e.g. '01') making up a
// given quarter (1-4) — pure lookup, no state.
app._kpiQuarterMonths = function(quarter) {
    const start = (quarter - 1) * 3 + 1;
    return [start, start + 1, start + 2].map(m => String(m).padStart(2, '0'));
};

// Auto-aggregates a MONTHLY kpi's own results into quarterly and yearly
// achievement figures — summing the actual values across the relevant
// months and comparing that sum against the target scaled the same way
// (3x for a quarter, 12x for a year), so the comparison stays on a
// consistent scale rather than comparing a 3-month sum against a
// single-month target. A quarter/year only appears once EVERY one of its
// months has a real result — no partial/incomplete figures. Computed
// live every call, nothing is written to kpi_results.
app._kpiAutoAggregateFromMonthly = function(kpiDef) {
    if (!kpiDef || kpiDef.period_type !== 'monthly') return { quarterly: [], yearly: [] };

    const byYearMonth = {};
    (this.state.kpiResults || [])
        // Same fix as _kpiPerformanceByPeriod/_kpiMultiYearTrend: must
        // also check each result's OWN period_type, not just the KPI's
        // current cadence, or a leftover result from before this KPI was
        // edited to monthly could corrupt the month-by-month grouping.
        .filter(r => r.kpi_definition_id === kpiDef.id && r.period_type === 'monthly' && r.actual_value != null)
        .forEach(r => {
            const y = String(r.year);
            if (!byYearMonth[y]) byYearMonth[y] = {};
            byYearMonth[y][r.period_value] = r;
        });

    const quarterly = [];
    const yearly = [];

    Object.keys(byYearMonth).forEach(year => {
        const monthsMap = byYearMonth[year];

        for (let q = 1; q <= 4; q++) {
            const monthResults = this._kpiQuarterMonths(q).map(mk => monthsMap[mk]).filter(Boolean);
            if (monthResults.length !== 3) continue; // incomplete quarter - skip entirely, no partial figure
            const sumActual = monthResults.reduce((s, r) => s + Number(r.actual_value), 0);
            const scaledTarget = kpiDef.target_value * 3;
            const { achievement } = this._computeKpiResultFields({ ...kpiDef, target_value: scaledTarget }, sumActual);
            if (achievement != null) quarterly.push({ period: `${year}-Q${q}`, achievement, actualValue: sumActual, targetValue: scaledTarget });
        }

        const allMonthKeys = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
        const yearMonthResults = allMonthKeys.map(mk => monthsMap[mk]).filter(Boolean);
        if (yearMonthResults.length === 12) {
            const sumActual = yearMonthResults.reduce((s, r) => s + Number(r.actual_value), 0);
            const scaledTarget = kpiDef.target_value * 12;
            const { achievement } = this._computeKpiResultFields({ ...kpiDef, target_value: scaledTarget }, sumActual);
            if (achievement != null) yearly.push({ period: year, achievement, actualValue: sumActual, targetValue: scaledTarget });
        }
    });

    return { quarterly, yearly };
};

// Combines genuinely quarterly/yearly-configured KPIs (_kpiMultiYearTrend)
// with monthly KPIs' auto-aggregated figures into one unified trend —
// this is what the dashboard's Quarterly/Yearly trend charts actually
// call, so a monthly KPI's completed quarters/years appear on the same
// chart as any KPI directly configured at that cadence.
//
// filterYear is optional: when provided, restricts the result to just
// that year's labels (e.g. "2027-Q1".."2027-Q4") — used for the
// Quarterly Trend chart, which the user explicitly wants scoped to the
// selected year, unlike Year-over-Year Trend, which is left unscoped
// (multi-year) since comparing across years is the entire point of that
// specific chart.
app._kpiMultiYearTrendWithAutoAggregation = function(directorateId, periodType, filterYear) {
    const base = this._kpiMultiYearTrend(directorateId, periodType);
    const monthlyKpis = this._kpisForDirectorate(directorateId).filter(k => k.period_type === 'monthly');

    const extraSeries = [];
    const extraLabels = new Set(base.labels);
    monthlyKpis.forEach(k => {
        const agg = this._kpiAutoAggregateFromMonthly(k);
        const points = periodType === 'quarterly' ? agg.quarterly : agg.yearly;
        if (points.length === 0) return;
        points.forEach(p => extraLabels.add(p.period));
        extraSeries.push({ id: k.id, name: k.name, points });
    });

    let labels, series;
    if (extraSeries.length === 0) {
        labels = base.labels; series = base.series;
    } else {
        labels = Array.from(extraLabels).sort();
        const rebuiltBaseSeries = base.series.map(s => {
            const byLabel = {}, detailsByLabel = {};
            base.labels.forEach((l, i) => { byLabel[l] = s.data[i]; detailsByLabel[l] = s.details ? s.details[i] : null; });
            return {
                id: s.id, name: s.name,
                data: labels.map(l => (l in byLabel) ? byLabel[l] : null),
                details: labels.map(l => (l in detailsByLabel) ? detailsByLabel[l] : null),
            };
        });
        const rebuiltExtraSeries = extraSeries.map(s => {
            const byLabel = {}, detailsByLabel = {};
            s.points.forEach(p => { byLabel[p.period] = p.achievement; detailsByLabel[p.period] = { achievement: p.achievement, actualValue: p.actualValue, targetValue: p.targetValue }; });
            return {
                id: s.id, name: s.name,
                data: labels.map(l => (l in byLabel) ? byLabel[l] : null),
                details: labels.map(l => (l in detailsByLabel) ? detailsByLabel[l] : null),
            };
        });
        series = [...rebuiltBaseSeries, ...rebuiltExtraSeries];
    }

    if (filterYear == null) return { labels, series };

    const keepIndices = labels.map((l, i) => l.startsWith(`${filterYear}-`) || l === String(filterYear) ? i : -1).filter(i => i !== -1);
    const filteredLabels = keepIndices.map(i => labels[i]);
    const filteredSeries = series
        .map(s => ({
            id: s.id, name: s.name,
            data: keepIndices.map(i => s.data[i]),
            details: keepIndices.map(i => (s.details ? s.details[i] : null)),
        }))
        .filter(s => s.data.some(v => v !== null));

    return { labels: filteredLabels, series: filteredSeries };
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

// ════════════════════════════════════════════════════════════════════
// Per-KPI year detail — powers the new Executive Director KPI Detail
// view. Unlike the directorate-wide dashboard helpers above, everything
// here is scoped to exactly ONE kpi_definition_id, since "best month,"
// "targets met," and a narrative summary are only meaningful for a
// single, specific KPI — averaging them across KPIs with different
// units and targets wouldn't mean anything.
// ════════════════════════════════════════════════════════════════════

// Core stats for one KPI in one year: overall achievement (average of
// every month that HAS data — months with no result are simply excluded,
// not treated as 0), how many months met target, and which month was
// best/worst. Returns null if the KPI has zero monthly results for the
// year at all.
app._kpiSingleYearStats = function(kpiId, year) {
    const kpiDef = (this.state.kpiDefinitions || []).find(k => k.id === kpiId);
    if (!kpiDef) return null;

    const monthResults = (this.state.kpiResults || [])
        .filter(r => r.kpi_definition_id === kpiId && r.year === year && r.period_type === 'monthly' && r.achievement != null)
        .sort((a, b) => a.period_value.localeCompare(b.period_value));

    if (monthResults.length === 0) return null;

    const overallAchievement = Math.round((monthResults.reduce((s, r) => s + r.achievement, 0) / monthResults.length) * 100) / 100;
    const targetsMetCount = monthResults.filter(r => r.status === 'on_target').length;

    const sorted = [...monthResults].sort((a, b) => b.achievement - a.achievement);
    const bestMonth = { period: sorted[0].period_value, achievement: sorted[0].achievement };
    const lowestMonth = { period: sorted[sorted.length - 1].period_value, achievement: sorted[sorted.length - 1].achievement };

    return {
        kpiId, year, kpiName: kpiDef.name,
        overallAchievement, targetsMetCount, totalMonthsWithData: monthResults.length,
        bestMonth, lowestMonth,
        monthlyResults: monthResults.map(r => ({ period: r.period_value, achievement: r.achievement, status: r.status, actualValue: r.actual_value, targetValue: r.target_value })),
    };
};

// Every month with data for a KPI/year, sorted by achievement descending
// — slice(0, N) for top-N, slice(-N).reverse() for bottom-N, same
// pattern as _kpiRankedList uses for the directorate-wide dashboard.
app._kpiMonthsRanked = function(kpiId, year) {
    const stats = this._kpiSingleYearStats(kpiId, year);
    if (!stats) return [];
    return [...stats.monthlyResults].sort((a, b) => b.achievement - a.achievement);
};

// Rule-based narrative summary — deliberately NOT an AI call, computed
// directly from the same stats the cards/charts already show, so the
// summary can never say something the numbers on screen don't support.
app._kpiRuleBasedSummary = function(kpiId, year) {
    const stats = this._kpiSingleYearStats(kpiId, year);
    if (!stats) return [];
    const kpiDef = (this.state.kpiDefinitions || []).find(k => k.id === kpiId);
    const monthName = (periodValue) => this.state.months[parseInt(periodValue, 10) - 1] || periodValue;
    const lines = [];

    lines.push(
        stats.overallAchievement >= 100
            ? `Overall achievement is ${stats.overallAchievement}%, exceeding the annual target.`
            : `Overall achievement is ${stats.overallAchievement}%, below the annual target.`
    );

    lines.push(`${monthName(stats.bestMonth.period)} recorded the highest performance at ${stats.bestMonth.achievement}%.`);

    const belowTargetMonths = stats.monthlyResults.filter(m => m.status === 'below_target');
    if (belowTargetMonths.length > 0) {
        const names = belowTargetMonths.map(m => `${monthName(m.period)} (${m.achievement}%)`).join(', ');
        lines.push(`${names} ${belowTargetMonths.length === 1 ? 'requires' : 'require'} management attention.`);
    }

    lines.push(`${stats.targetsMetCount} of ${stats.totalMonthsWithData} months with recorded results met target so far.`);

    return lines;
};

// Classifies overall year performance into a simple, plain-language
// status — pure threshold logic, no AI call. >=100% is Excellent (the KPI
// is meeting or beating target overall), >=80% is Good (close but under),
// below that is Needs Attention.
app._kpiYearStatusLabel = function(overallAchievement) {
    if (overallAchievement == null) return { label: 'No Data', description: 'No results recorded yet.', color: '#9ca3af' };
    if (overallAchievement >= 100) return { label: 'Excellent', description: 'Performance is above target and on track.', color: '#7c3aed' };
    if (overallAchievement >= 80) return { label: 'Good', description: 'Performance is close to target.', color: '#0891b2' };
    return { label: 'Needs Attention', description: 'Performance is below target.', color: '#dc2626' };
};

// 3-tier color classification for the monthly bar chart — different from
// the 2-tier on_target/below_target status used elsewhere: >=100% is
// "above" (green), 80-99.99% is "near" (orange), below 80% is "below"
// (red). Purely a display classification, does not affect achievement
// math or the on_target/below_target status stored on results.
app._kpiMonthColorTier = function(achievement) {
    if (achievement == null) return 'none';
    if (achievement >= 100) return 'above';
    if (achievement >= 80) return 'near';
    return 'below';
};

// Deterministic, fixed color per KPI — the SAME kpi_definition_id always
// gets the SAME color, on every chart it appears on (Quarterly Trend,
// Year-over-Year Trend, and any future multi-KPI chart), regardless of
// each chart's own array order or which KPIs happen to be filtered in or
// out. Colors are assigned by kpiId modulo the palette length, so the
// mapping is stable without needing to store anything.
//
// Deliberately avoids green/orange/red — those already carry a specific
// meaning elsewhere on this dashboard (the Monthly chart's above/near/
// below-target status colors), and reusing them here for an unrelated
// "which KPI is this" purpose would risk a viewer misreading a bar's
// color as a performance signal it doesn't actually represent.
app._kpiColorPalette = function() {
    // "Modern Executive" palette — an explicit Power BI/Microsoft Fabric
    // -style spec provided directly (exact hex values), superseding the
    // earlier "match Ops exactly" decision. Emerald, Royal Blue, Amber
    // were the original 3, matching the spec's 3 example KPIs exactly.
    // A 4th color was needed after a real, confirmed overflow: a
    // directorate with 4 KPIs on one chart wrapped the 4th back onto the
    // 1st color (Balance Sheet landing on the same green as Closing Year
    // Budget) — 3 colors was never actually enough once a 4th KPI showed
    // up. Rose was tried first but explicitly rejected — red/rose tones
    // are reserved for signaling negative figures specifically, not
    // spent as a generic "which KPI is this" identity color. Slate gray
    // was chosen instead: neutral, so it doesn't compete with or sit
    // near any of the 3 saturated hues already in the palette (unlike
    // teal near emerald, or violet near blue, both avoided for the same
    // "too similar to tell apart" reason found earlier tonight).
    return ['#10B981', '#3B82F6', '#F59E0B', '#64748B'];
};

app._kpiColorForId = function(kpiId) {
    const palette = this._kpiColorPalette();
    if (kpiId == null) return palette[0];
    const idx = ((Number(kpiId) % palette.length) + palette.length) % palette.length; // safe for any integer, including unexpected negatives
    return palette[idx];
};

// A real bug in _kpiColorForId above: kpiId % paletteLength can collide
// for two entirely unrelated KPIs whenever their database ids happen to
// share the same remainder — with only 3 colors, that's not a rare edge
// case, it's common (confirmed: 2 KPIs on the same 3-bar Quarterly Trend
// chart both landed on green). Fixed here by ranking each KPI by its
// position within the FULL, STABLE set of KPIs for its directorate
// (sorted by id, not filtered to whichever subset happens to have data
// on any one chart) — this guarantees zero collisions as long as the
// directorate has no more KPIs of a given cadence than the palette has
// colors, while still giving the same KPI the same color on every chart,
// since the ranking is computed from the directorate's whole KPI list,
// not from what's visible on the specific chart being drawn.
// The previous approach (rank within the WHOLE directorate's KPI list)
// was still not enough: if a directorate has more total KPIs than the
// palette has colors, two KPIs whose ranks differ by exactly the palette
// length still collide — confirmed happening in practice even with only
// 3 KPIs visible on a given chart, because the directorate had more than
// 3 KPIs overall. Fixed properly by ranking within the EXACT set of
// series actually being rendered on a specific chart, not the broader
// directorate list — this guarantees zero collisions for that render as
// long as the number of series on it doesn't exceed the palette size,
// regardless of how many other (not shown here) KPIs exist elsewhere in
// the directorate. Returns a Map from kpi id -> color.
app._kpiColorsForSeries = function(series) {
    const palette = this._kpiColorPalette();
    const sorted = (series || []).slice().sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    const colorMap = new Map();
    sorted.forEach((s, i) => {
        colorMap.set(s.id, palette[i % palette.length]);
    });
    return colorMap;
};

app._kpiColorForIdInDirectorate = function(kpiId, directorateId) {
    const palette = this._kpiColorPalette();
    if (kpiId == null) return palette[0];
    const allKpis = (this.state.kpiDefinitions || [])
        .filter(k => k.directorate_id === directorateId || this._kpiEffectiveDirectorateId(k) === directorateId)
        .slice()
        .sort((a, b) => a.id - b.id);
    const rank = allKpis.findIndex(k => k.id === kpiId);
    if (rank === -1) return this._kpiColorForId(kpiId); // not found in this directorate's list - fall back to the simple version rather than fail
    return palette[rank % palette.length];
};

// Powers the Overview tab's Monthly Performance chart, now that it has a
// KPI selector. selectedKpiId null/undefined keeps the original
// behavior — averaged across every monthly-cadence KPI for the
// directorate (via _kpiPerformanceByPeriod) — which is exactly why the
// chart previously gave no indication of which KPI it represented: it
// wasn't one KPI at all. When a specific kpi id is passed, returns that
// KPI's own monthly results instead, reusing _kpiSingleYearStats so this
// stays consistent with the KPI Detail tab's own monthly data. Both
// paths return the same {period, avgAchievement}[] shape so the
// chart-drawing code doesn't need to branch on which mode is active.
app._kpiOverviewMonthlyChartData = function(directorateId, year, selectedKpiId) {
    if (selectedKpiId == null) {
        return this._kpiPerformanceByPeriod(directorateId, year, 'monthly');
    }
    const stats = this._kpiSingleYearStats(selectedKpiId, year);
    if (!stats) return [];
    // Same field names as the "All KPIs (Average)" mode (avgActual/
    // avgTarget) even though there's only one KPI here — with a single
    // KPI these are just that KPI's own actual/target, not an average of
    // anything, but keeping the field names uniform lets the tooltip
    // read from the same shape regardless of which mode is active.
    return stats.monthlyResults.map(r => ({ period: r.period, avgAchievement: r.achievement, avgActual: r.actualValue, avgTarget: r.targetValue }));
};

// ════════════════════════════════════════════════════════════════════
// KPI/Owner Excel import — bulk-configures KPIs from a spreadsheet
// (columns: Line, Code, KPI Code, KPI Name, Frequency, KPI Weight %,
// Owner Dept, Owner Name, Owner Email, Owner %). Every step below is
// pure and independently testable; only the final save-to-Supabase step
// (elsewhere) actually writes anything.
// ════════════════════════════════════════════════════════════════════

// "Monthly"/"Quarterly"/"Annual" -> this app's period_type values.
// Case/whitespace-insensitive since spreadsheet data is never perfectly
// clean. Returns null for anything unrecognized rather than guessing —
// an unrecognized frequency should be flagged as an import error, not
// silently defaulted to some cadence the source data never specified.
app._kpiMapFrequencyToPeriodType = function(frequency) {
    if (frequency == null) return null;
    const normalized = String(frequency).trim().toLowerCase();
    if (normalized === 'monthly') return 'monthly';
    if (normalized === 'quarterly') return 'quarterly';
    if (normalized === 'annual' || normalized === 'annually' || normalized === 'yearly') return 'yearly';
    return null;
};

// The Excel's numeric Line values (3/4/5/6) map directly onto this
// system's existing fixed Line names (L3/L4/L5/L6) — same underlying
// concept, just Excel stores the bare number. Accepts both a number and
// a numeric string, since spreadsheet cells can come through as either
// depending on formatting. Returns null for anything outside 3-6.
app._kpiMapLineNumberToLineName = function(lineValue) {
    const n = Number(lineValue);
    if (!Number.isInteger(n) || n < 3 || n > 6) return null;
    return `L${n}`;
};

// Percentages in spreadsheets show up in wildly inconsistent forms
// depending on how the source cell was formatted: 0.4, "0.4", "40%",
// "40". This normalizes all of them to a 0-1 fraction (matching how
// owner_percentage/weight are stored elsewhere in this app). A bare
// value >1 is assumed to already be a whole-number percentage (40 means
// 40%, i.e. 0.4) rather than a literal fraction greater than 1, since
// KPI weights and owner splits are never legitimately >100%.
app._kpiParsePercentValue = function(value) {
    if (value == null || value === '') return null;
    const str = String(value).trim();
    const hasPercentSign = str.endsWith('%');
    const numeric = Number(str.replace('%', '').trim());
    if (!Number.isFinite(numeric)) return null;
    if (hasPercentSign) return numeric / 100;
    return numeric > 1 ? numeric / 100 : numeric;
};

// Threshold values (Exceptional/Acceptable/Unacceptable) need DIFFERENT
// handling than _kpiParsePercentValue above. That function divides by
// 100 to store a 0-1 fraction — correct for owner/weight percentages,
// but wrong here: this app's established convention (confirmed against
// real KPI data — e.g. "Budget Reconciliation" stores target=750 and
// actuals like 70/90, never fractions) is to store raw numbers on the
// same scale as whatever a planner types into the "Actual Value (%)"
// field when entering results. A stored target of 0.85 against an
// entered actual of 87 would silently compute a nonsense achievement %
// (87/0.85*100 = 10235%). This function only ever strips a literal %
// character if present — it never divides by 100, regardless of
// magnitude, keeping thresholds on the same scale results are entered on.
app._kpiParseThresholdNumericValue = function(value) {
    if (value == null || value === '') return null;
    const str = String(value).trim();
    const numeric = Number(str.replace('%', '').trim());
    if (!Number.isFinite(numeric)) return null;
    return numeric;
};

// Parses and validates one raw spreadsheet row (keys matching the
// Excel's exact column headers) into a clean, typed structure. Every
// required field is checked explicitly and named in the errors array —
// a row failing here should be shown to the planner with a specific
// reason, not silently skipped or guessed at.
app._kpiParseOwnerImportRow = function(rawRow) {
    const errors = [];
    const lineName = this._kpiMapLineNumberToLineName(rawRow['Line']);
    if (lineName == null) errors.push(`Invalid Line value: "${rawRow['Line']}" (must be 3, 4, 5, or 6)`);

    const periodType = this._kpiMapFrequencyToPeriodType(rawRow['Frequency']);
    if (periodType == null) errors.push(`Invalid Frequency value: "${rawRow['Frequency']}" (must be Monthly, Quarterly, or Annual)`);

    const kpiCode = rawRow['KPI Code'] != null ? String(rawRow['KPI Code']).trim() : '';
    if (!kpiCode) errors.push('Missing KPI Code');

    const kpiName = rawRow['KPI Name'] != null ? String(rawRow['KPI Name']).trim() : '';
    if (!kpiName) errors.push('Missing KPI Name');

    const ownerDept = rawRow['Owner Dept'] != null ? String(rawRow['Owner Dept']).trim() : '';
    if (!ownerDept) errors.push('Missing Owner Dept');

    const ownerPct = this._kpiParsePercentValue(rawRow['Owner %']);
    if (ownerPct == null) errors.push(`Invalid Owner %: "${rawRow['Owner %']}"`);

    const weight = this._kpiParsePercentValue(rawRow['KPI Weight %']);

    return {
        valid: errors.length === 0,
        errors,
        data: {
            line: lineName,
            code: rawRow['Code'] != null ? String(rawRow['Code']).trim() : '',
            kpiCode, kpiName, periodType, weight,
            ownerDept, ownerPct,
            ownerName: rawRow['Owner Name'] != null ? String(rawRow['Owner Name']).trim() : '',
            ownerEmail: rawRow['Owner Email'] != null ? String(rawRow['Owner Email']).trim() : '',
        },
    };
};

// Runs every raw row through the parser above, separating rows that
// parsed cleanly from ones with problems — never silently drops a bad
// row, so the import UI can show the planner exactly which rows need
// fixing and why, alongside successfully importing the rest.
app._kpiParseOwnerImportRows = function(rawRows) {
    const validRows = [], invalidRows = [];
    (rawRows || []).forEach((rawRow, index) => {
        const result = this._kpiParseOwnerImportRow(rawRow);
        if (result.valid) validRows.push(result.data);
        else invalidRows.push({ rowNumber: index + 2, errors: result.errors, raw: rawRow }); // +2: header row + 1-indexing, matching what the planner sees in Excel
    });
    return { validRows, invalidRows };
};

// Groups already-validated rows by (line, kpiCode) — multiple rows can
// describe the SAME KPI-on-a-line split across several owners (e.g. one
// KPI 90% Operations, 10% Finance) — this collapses those into one KPI
// entry with an owners[] array, rather than treating each owner row as
// a separate KPI.
app._kpiGroupImportRowsByLineAndCode = function(validRows) {
    const groups = {};
    const order = [];
    validRows.forEach(row => {
        const key = `${row.line}::${row.kpiCode}`;
        if (!groups[key]) {
            groups[key] = {
                line: row.line, code: row.code, kpiCode: row.kpiCode, kpiName: row.kpiName,
                periodType: row.periodType, weight: row.weight, owners: [],
            };
            order.push(key);
        }
        groups[key].owners.push({ dept: row.ownerDept, name: row.ownerName, email: row.ownerEmail, pct: row.ownerPct });
    });
    return order.map(key => groups[key]);
};

// Given a KPI's list of owners, returns the dept with the highest
// ownership % — used as that KPI's primary directorate assignment when
// a KPI has split ownership. Ties broken by whichever appears first in
// the list (stable, deterministic — not alphabetical), matching the
// order owners were actually listed in the source spreadsheet.
app._kpiDeterminePrimaryOwnerDept = function(owners) {
    if (!owners || owners.length === 0) return null;
    let best = owners[0];
    owners.forEach(o => { if (o.pct > best.pct) best = o; });
    return best.dept;
};

// Orchestrates the actual save: given grouped import rows (from
// _kpiGroupImportRowsByLineAndCode), creates/reuses a directorate per
// distinct primary owner department, ensures each has its 4 standard
// lines, then creates or updates each KPI definition and its owner
// records. Idempotent by kpi_code — re-running the same import (e.g.
// after fixing a row in the spreadsheet) updates existing KPIs rather
// than duplicating them, matched within the same directorate+line.
app.importKpiOwnerData = async function(groupedRows) {
    if (!this.supabase) return { created: 0, updated: 0, failed: 0, errors: ['Not connected to Supabase.'] };

    const summary = { created: 0, updated: 0, failed: 0, errors: [] };
    // Cache directorate lookups within this run — many rows share the
    // same primary dept, no need to re-check/re-create per row.
    const directorateByDeptName = {};

    for (const group of groupedRows) {
        try {
            const primaryDept = this._kpiDeterminePrimaryOwnerDept(group.owners);
            if (!primaryDept) { summary.failed++; summary.errors.push(`${group.kpiCode} (${group.line}): no owner department found`); continue; }

            if (!directorateByDeptName[primaryDept]) {
                let directorate = (this.state.kpiDirectorates || []).find(d => d.name === primaryDept);
                if (!directorate) {
                    directorate = await this.saveKpiDirectorate(primaryDept, null);
                    if (!directorate) { summary.failed++; summary.errors.push(`${group.kpiCode} (${group.line}): could not create directorate "${primaryDept}"`); continue; }
                }
                await this.ensureKpiLinesForDirectorate(directorate.id);
                directorateByDeptName[primaryDept] = directorate;
            }
            const directorate = directorateByDeptName[primaryDept];

            const lineRow = (this.state.kpiDirectorateDepartments || []).find(d => d.directorate_id === directorate.id && d.department_name === group.line);
            if (!lineRow) { summary.failed++; summary.errors.push(`${group.kpiCode} (${group.line}): line "${group.line}" not found under "${primaryDept}"`); continue; }

            const existing = (this.state.kpiDefinitions || []).find(k => k.kpi_code === group.kpiCode && k.directorate_id === directorate.id && k.department_id === lineRow.id);
            const saved = await this.saveKpiDefinition({
                directorateId: directorate.id, departmentId: lineRow.id,
                name: group.kpiName, category: group.code, kpiCode: group.kpiCode,
                periodType: group.periodType, weight: group.weight,
                // Acceptable/Exceptional/Unacceptable thresholds are left
                // blank on import — this spreadsheet doesn't provide
                // them; the planner fills them in manually afterward.
                targetValue: existing ? existing.target_value : null,
                exceptionalValue: existing ? existing.exceptional_value : null,
                unacceptableValue: existing ? existing.unacceptable_value : null,
            }, existing ? existing.id : null);
            if (!saved) { summary.failed++; summary.errors.push(`${group.kpiCode} (${group.line}): failed to save KPI definition`); continue; }

            // Replace this KPI's owner records wholesale on every
            // (re-)import — simpler and safer than trying to diff/merge
            // individual owner rows, and matches how a spreadsheet
            // re-upload is meant to be treated as the new source of truth.
            await this.supabase.from('kpi_owners').delete().eq('kpi_definition_id', saved.id);
            const ownerRows = group.owners.map(o => ({
                tenant_id: this._tid(), kpi_definition_id: saved.id,
                owner_dept: o.dept, owner_name: o.name, owner_email: o.email, owner_percentage: o.pct,
            }));
            const { data: insertedOwners, error: ownerError } = await this.supabase.from('kpi_owners').insert(ownerRows).select();
            if (ownerError) throw ownerError;

            this.state.kpiOwners = [...(this.state.kpiOwners || []).filter(o => o.kpi_definition_id !== saved.id), ...(insertedOwners || [])];

            if (existing) summary.updated++; else summary.created++;
        } catch (e) {
            summary.failed++;
            summary.errors.push(`${group.kpiCode} (${group.line}): ${e.message}`);
        }
    }

    this.showToast(`Import complete: ${summary.created} created, ${summary.updated} updated, ${summary.failed} failed.`, summary.failed > 0 ? 'error' : 'success');
    return summary;
};

// ════════════════════════════════════════════════════════════════════
// KPI Threshold Excel import — a SEPARATE spreadsheet (Line, Code, KPI
// Code, KPI Name, Frequency, Level 3%, Unit, Exceptional, Acceptable,
// Unacceptable) that fills in Exceptional/Acceptable/Unacceptable on
// KPIs already created by the owner import above. This import never
// creates new KPIs — only updates existing ones matched by (KPI Code,
// Line), regardless of which directorate they ended up under.
// ════════════════════════════════════════════════════════════════════

// Given the 3 threshold values for one KPI, infers whether higher or
// lower values are better — Exceptional > Acceptable > Unacceptable
// means higher is better (e.g. satisfaction %); the reverse ordering
// means lower is better (e.g. a complaint count). Returns null when the
// values don't form a strictly consistent ordering either way, since
// that's a genuine data problem in the source file, not something to
// guess through.
app._kpiDeriveDirectionFromThresholds = function(exceptional, acceptable, unacceptable) {
    if (exceptional == null || acceptable == null || unacceptable == null) return null;
    if (exceptional > acceptable && acceptable > unacceptable) return 'higher_is_better';
    if (exceptional < acceptable && acceptable < unacceptable) return 'lower_is_better';
    return null;
};

// Parses and validates one raw row from the threshold spreadsheet.
app._kpiParseThresholdImportRow = function(rawRow) {
    const errors = [];
    const lineName = this._kpiMapLineNumberToLineName(rawRow['Line']);
    if (lineName == null) errors.push(`Invalid Line value: "${rawRow['Line']}" (must be 3, 4, 5, or 6)`);

    const kpiCode = rawRow['KPI Code'] != null ? String(rawRow['KPI Code']).trim() : '';
    if (!kpiCode) errors.push('Missing KPI Code');

    const acceptable = this._kpiParseThresholdNumericValue(rawRow['Acceptable']);
    const unacceptable = this._kpiParseThresholdNumericValue(rawRow['Unacceptable']);
    const parsedExceptional = this._kpiParseThresholdNumericValue(rawRow['Exceptional']);
    if (rawRow['Exceptional'] !== '' && rawRow['Exceptional'] != null && parsedExceptional == null) errors.push(`Invalid Exceptional value: "${rawRow['Exceptional']}"`);
    if (acceptable == null) errors.push(`Invalid/missing Acceptable value: "${rawRow['Acceptable']}"`);
    if (unacceptable == null) errors.push(`Invalid/missing Unacceptable value: "${rawRow['Unacceptable']}"`);

    let direction = null;
    if (errors.length === 0) {
        direction = this._kpiDeriveDirectionFromThresholds(parsedExceptional, acceptable, unacceptable);
        if (direction == null) errors.push(`Exceptional/Acceptable/Unacceptable (${parsedExceptional}/${acceptable}/${unacceptable}) don't form a consistent higher-or-lower-is-better ordering`);
    }

    return {
        valid: errors.length === 0,
        errors,
        data: {
            line: lineName, kpiCode,
            kpiName: rawRow['KPI Name'] != null ? String(rawRow['KPI Name']).trim() : '',
            unit: rawRow['Unit'] != null ? String(rawRow['Unit']).trim() : '',
            exceptional: parsedExceptional, acceptable, unacceptable, direction,
        },
    };
};

// Batch version — same never-silently-drop-a-bad-row philosophy as the
// owner import's row parser.
app._kpiParseThresholdImportRows = function(rawRows) {
    const validRows = [], invalidRows = [];
    (rawRows || []).forEach((rawRow, index) => {
        const result = this._kpiParseThresholdImportRow(rawRow);
        if (result.valid) validRows.push(result.data);
        else invalidRows.push({ rowNumber: index + 2, errors: result.errors, raw: rawRow });
    });
    return { validRows, invalidRows };
};

// Finds an already-imported KPI by (kpi_code, line) ALONE, without
// knowing its directorate — necessary because this spreadsheet has no
// Owner Dept column, unlike the owner import. Searches across every
// directorate's KPIs, matching kpi_code against the definition and the
// requested line name against its department_id's line row. Assumes
// (kpi_code, line) is unique system-wide, which holds as long as the
// owner import is what originally created these KPIs — each KPI code
// only ever gets assigned to one, primary-owner directorate.
app._kpiFindExistingKpiByCodeAndLine = function(kpiCode, lineName) {
    const lineRows = (this.state.kpiDirectorateDepartments || []).filter(d => d.department_name === lineName);
    const lineRowIds = new Set(lineRows.map(l => l.id));
    return (this.state.kpiDefinitions || []).find(k => k.kpi_code === kpiCode && lineRowIds.has(k.department_id)) || null;
};

// Applies parsed threshold rows to already-existing KPIs — matched by
// (kpi_code, line), never creating anything new. A row with no matching
// KPI is reported, not silently skipped, since that usually means the
// owner import hasn't been run for that KPI yet.
app.importKpiThresholdData = async function(validRows) {
    if (!this.supabase) return { updated: 0, notFound: 0, failed: 0, errors: ['Not connected to Supabase.'] };

    const summary = { updated: 0, notFound: 0, failed: 0, errors: [] };
    for (const row of validRows) {
        const existing = this._kpiFindExistingKpiByCodeAndLine(row.kpiCode, row.line);
        if (!existing) {
            summary.notFound++;
            summary.errors.push(`${row.kpiCode} (${row.line}): no matching KPI found — run the owner import first`);
            continue;
        }
        try {
            const saved = await this.saveKpiDefinition({
                directorateId: existing.directorate_id, departmentId: existing.department_id,
                name: existing.name, category: existing.category, kpiCode: existing.kpi_code,
                periodType: existing.period_type, weight: existing.weight,
                unit: row.unit || existing.unit,
                targetValue: row.acceptable, exceptionalValue: row.exceptional, unacceptableValue: row.unacceptable,
                direction: row.direction,
            }, existing.id);
            if (!saved) { summary.failed++; summary.errors.push(`${row.kpiCode} (${row.line}): failed to save`); continue; }
            summary.updated++;
        } catch (e) {
            summary.failed++;
            summary.errors.push(`${row.kpiCode} (${row.line}): ${e.message}`);
        }
    }

    this.showToast(`Threshold import complete: ${summary.updated} updated, ${summary.notFound} not found, ${summary.failed} failed.`, (summary.notFound + summary.failed) > 0 ? 'error' : 'success');
    return summary;
};

// Formats a KPI's display name with its line prefix — e.g. "L3-Staffing
// Level" — so a director browsing their own KPIs can tell apart
// same-named KPIs that exist once per line (the normal case: a KPI code
// like "A1" gets one instance per L3/L4/L5/L6). Falls back to the bare
// name if the line can't be resolved, rather than showing a broken
// prefix like "undefined-Staffing Level".
app._kpiDisplayNameWithLine = function(kpiDef) {
    if (!kpiDef) return '';
    const lineRow = (this.state.kpiDirectorateDepartments || []).find(d => d.id === kpiDef.department_id);
    const linePrefix = lineRow ? lineRow.department_name : null;
    return linePrefix ? `${linePrefix}-${kpiDef.name}` : kpiDef.name;
};

