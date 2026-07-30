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
app.saveKpiResult = async function(kpiDefinitionId, periodLabel, actualValue, source) {
    if (!this.supabase) return null;
    try {
        const row = {
            tenant_id: this._tid(),
            kpi_definition_id: kpiDefinitionId,
            period_label: periodLabel,
            actual_value: actualValue,
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

// Bulk-grants KPI Executive Director access to every Corporate Staff
// member whose role contains "director" and doesn't already have a
// kpi_users record. Created with linked_login=true (their password always
// checks their current Corporate Staff password — see _kpiValidPassword)
// and directorate_id left unassigned, since which directorate each person
// actually oversees can't be determined from their Corporate Staff record
// alone — the planner assigns that afterward via Manage KPI Users.
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
        const saved = await this.saveKpiUser({
            id: d.id, name: d.name, role: 'kpi_director',
            directorateId: null, linkedLogin: true,
        }, null);
        if (saved) created++;
    }
    this.showToast(`Granted KPI Director access to ${created} director${created !== 1 ? 's' : ''}. Assign each to a directorate in Manage KPI Users.`, 'success');
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
// Login — checked against state.kpiUsers, the same client-side
// credential-check pattern every other role in this app already uses
// (employeePasswords, maintenanceStaffPasswords, etc.) — consistent
// with the existing architecture, not a new pattern introduced here.
// ════════════════════════════════════════════════════════════════════
app.kpiLogin = async function(id, password) {
    if (!this.state.kpiUsers || this.state.kpiUsers.length === 0) {
        await this.loadKpiData();
    }
    const user = (this.state.kpiUsers || []).find(u => u.id === id);
    if (!this._kpiValidPassword(user, password)) {
        this.showToast('Invalid KPI login ID or password.', 'error');
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
