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
        const [directorates, deptMap, definitions, results, users, owners, feePeriods, lineFeeSchedule, stationCounts] = await Promise.all([
            this.supabase.from('kpi_directorates').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_directorate_departments').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_definitions').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_results').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_users').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_owners').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_fee_periods').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_line_fee_schedule').select('*').eq('tenant_id', tid),
            this.supabase.from('kpi_line_station_counts').select('*').eq('tenant_id', tid),
        ]);
        if (directorates.error) throw directorates.error;
        if (deptMap.error) throw deptMap.error;
        if (definitions.error) throw definitions.error;
        if (results.error) throw results.error;
        if (users.error) throw users.error;
        if (owners.error) throw owners.error;
        if (feePeriods.error) throw feePeriods.error;
        if (lineFeeSchedule.error) throw lineFeeSchedule.error;
        if (stationCounts.error) throw stationCounts.error;

        this.state.kpiDirectorates = directorates.data || [];
        this.state.kpiDirectorateDepartments = deptMap.data || [];
        this.state.kpiDefinitions = definitions.data || [];
        this.state.kpiResults = results.data || [];
        this.state.kpiUsers = users.data || [];
        this.state.kpiOwners = owners.data || [];
        this.state.kpiFeePeriods = feePeriods.data || [];
        this.state.kpiLineFeeSchedule = lineFeeSchedule.data || [];
        this.state.kpiLineStationCounts = stationCounts.data || [];
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
app.saveKpiDirectorate = async function(name, existingId, company) {
    if (!this.supabase) return null;
    try {
        const row = { tenant_id: this._tid(), name };
        // Company is set on create (defaulting to OMC for the older
        // Excel-import auto-create paths that don't pass one) and only
        // updated when a caller explicitly passes it — editing just the
        // name of an existing directorate must never silently move it to
        // a different company.
        if (!existingId) {
            row.company = company || 'OMC';
        } else if (company !== undefined) {
            row.company = company;
        }
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
            // Area/Level 1/Level 2/Level 3 weighting hierarchy — a
            // SEPARATE layer from directorate_id/department_id (see
            // migration_add_kpi_weight_hierarchy.sql). Undefined means
            // "caller isn't touching this field", not "clear it" — every
            // one of these defaults to the KPI's current value so a
            // partial save (e.g. only updating thresholds) never wipes
            // out previously-entered weight data.
            area: def.area !== undefined ? def.area : undefined,
            area_pct: def.areaPct !== undefined ? def.areaPct : undefined,
            level1: def.level1 !== undefined ? def.level1 : undefined,
            level1_pct: def.level1Pct !== undefined ? def.level1Pct : undefined,
            level2: def.level2 !== undefined ? def.level2 : undefined,
            level2_pct: def.level2Pct !== undefined ? def.level2Pct : undefined,
            level3_pct: def.level3Pct !== undefined ? def.level3Pct : undefined,
            // Partner Allocation (HIT/FS/ALS) — same "undefined = don't
            // touch" contract, a separate layer again from everything
            // above. allocation_pct is this KPI's overall weight (same
            // role as the Level 3 % / Final Weight chain elsewhere);
            // hit_pct/fs_pct/als_pct are the 3-way split of THIS KPI's
            // own result across the three named partners; the
            // allocation_*_pct trio are the pre-multiplied
            // (allocation_pct x partner_pct) company-wide weights.
            allocation_pct: def.allocationPct !== undefined ? def.allocationPct : undefined,
            hit_pct: def.hitPct !== undefined ? def.hitPct : undefined,
            fs_pct: def.fsPct !== undefined ? def.fsPct : undefined,
            als_pct: def.alsPct !== undefined ? def.alsPct : undefined,
            allocation_hit_pct: def.allocationHitPct !== undefined ? def.allocationHitPct : undefined,
            allocation_fs_pct: def.allocationFsPct !== undefined ? def.allocationFsPct : undefined,
            allocation_als_pct: def.allocationAlsPct !== undefined ? def.allocationAlsPct : undefined,
        };
        // Strip undefined keys (Supabase's client sends them as literal
        // JSON nulls otherwise, which WOULD wipe the column) — this is
        // what makes the "undefined = don't touch" contract above work.
        Object.keys(row).forEach(k => { if (row[k] === undefined) delete row[k]; });
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

// Final Weight = Area % x Level 1 % x Level 2 % x Level 3 % — each
// percentage relative to its immediate parent (not the whole company),
// so multiplying down the chain converts it into the KPI's actual share
// of the organization's overall 100% score. Returns null (not 0) when
// any piece of the hierarchy hasn't been filled in yet — a KPI without
// weighting data has NO Final Weight, that's different from a Final
// Weight of 0%, and callers should render that as "—", not "0.0%".
app._kpiFinalWeight = function(kpiDef) {
    if (!kpiDef) return null;
    const parts = [kpiDef.area_pct, kpiDef.level1_pct, kpiDef.level2_pct, kpiDef.level3_pct];
    if (parts.some(p => p == null)) return null;
    return parts.reduce((a, b) => a * b, 1);
};

// Static per-KPI Allocation HIT%/FS%/ALS% breakdown — per explicit
// correction: "Allocation %" in the source Partner Allocation sheet IS
// the same thing as Final Weight in this app (Area % x Level 1 % x
// Level 2 % x Level 3 %), so this is derived LIVE from Final Weight
// rather than trusting the separately-imported allocation_pct/
// allocation_hit_pct/etc. columns, which could drift out of sync if the
// Weight Hierarchy is ever edited after the Partner Allocation import
// ran. This is a STATIC, design-time weighting — how much of the whole
// company scorecard each partner is responsible for via this KPI —
// deliberately separate from _kpiPartnerShares below, which splits a
// SPECIFIC period's actual Final KPI/Factor score instead.
app._kpiAllocationSharesFromFinalWeight = function(kpiDef) {
    const finalWeight = this._kpiFinalWeight(kpiDef);
    if (finalWeight == null || !kpiDef) return { hit: null, fs: null, als: null };
    return {
        hit: kpiDef.hit_pct != null ? finalWeight * kpiDef.hit_pct : null,
        fs: kpiDef.fs_pct != null ? finalWeight * kpiDef.fs_pct : null,
        als: kpiDef.als_pct != null ? finalWeight * kpiDef.als_pct : null,
    };
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
// Bulk copy — duplicates the entire OMC directorate/line/KPI/owner
// STRUCTURE into Audit (per enhancement request). Deliberately built on
// top of the existing save functions (saveKpiDirectorate,
// ensureKpiLinesForDirectorate, saveKpiDefinition) rather than raw
// inserts, so tenant scoping and existing validation/state-sync all stay
// correct automatically.
//
// What this copies: directorates (as new Audit rows with the same
// name), their 4 standard lines (created fresh via the same idempotent
// helper every directorate already uses), every KPI definition under
// them (name, thresholds, unit, period type, direction), and any KPI
// owners.
//
// What this deliberately does NOT copy: kpi_results (actual entered
// values per period). Those are real recorded performance numbers —
// duplicating OMC's historical figures under Audit would create
// fabricated data that looks real. Audit starts with the same KPI
// *structure* but a clean slate of results, same as any newly-set-up
// company would.
//
// Safe to re-run: an OMC directorate whose name already exists under
// Audit is skipped entirely (not re-copied, not merged) to avoid
// creating duplicates if this is ever run more than once.
app.copyKpiOmcStructureToAudit = async function() {
    if (!this.supabase) return { directorates: 0, kpis: 0, owners: 0, skipped: 0 };
    const omcDirectorates = (this.state.kpiDirectorates || []).filter(d => (d.company || 'OMC') === 'OMC');
    const existingAuditNames = new Set(
        (this.state.kpiDirectorates || []).filter(d => (d.company || 'OMC') === 'Audit').map(d => d.name)
    );

    let directoratesCopied = 0, kpisCopied = 0, ownersCopied = 0, skipped = 0;

    for (const omcDir of omcDirectorates) {
        if (existingAuditNames.has(omcDir.name)) {
            skipped++;
            continue;
        }

        const newDir = await this.saveKpiDirectorate(omcDir.name, null, 'Audit');
        if (!newDir) continue;
        directoratesCopied++;

        await this.ensureKpiLinesForDirectorate(newDir.id);
        const newLines = (this.state.kpiDirectorateDepartments || []).filter(l => l.directorate_id === newDir.id);
        const newLineIdByName = {};
        newLines.forEach(l => { newLineIdByName[l.department_name] = l.id; });

        const omcKpis = (this.state.kpiDefinitions || []).filter(k => k.directorate_id === omcDir.id);
        for (const k of omcKpis) {
            const omcLine = (this.state.kpiDirectorateDepartments || []).find(l => l.id === k.department_id);
            const newDeptId = omcLine ? newLineIdByName[omcLine.department_name] : null;
            if (!newDeptId) continue; // every directorate always has the same 4 standard lines, so this shouldn't happen

            const savedKpi = await this.saveKpiDefinition({
                directorateId: newDir.id,
                departmentId: newDeptId,
                name: k.name,
                category: k.category,
                unit: k.unit,
                targetValue: k.target_value,
                exceptionalValue: k.exceptional_value,
                unacceptableValue: k.unacceptable_value,
                periodType: k.period_type,
                direction: k.direction,
                kpiCode: k.kpi_code,
            }, null);
            if (!savedKpi) continue;
            kpisCopied++;

            const owners = (this.state.kpiOwners || []).filter(o => o.kpi_definition_id === k.id);
            if (owners.length > 0) {
                const ownerRows = owners.map(o => ({
                    tenant_id: this._tid(),
                    kpi_definition_id: savedKpi.id,
                    owner_name: o.owner_name,
                    owner_dept: o.owner_dept,
                    owner_percentage: o.owner_percentage,
                }));
                const { data: insertedOwners, error: ownerError } = await this.supabase.from('kpi_owners').insert(ownerRows).select();
                if (!ownerError) {
                    this.state.kpiOwners = [...(this.state.kpiOwners || []), ...(insertedOwners || [])];
                    ownersCopied += insertedOwners.length;
                }
            }
        }
    }

    return { directorates: directoratesCopied, kpis: kpisCopied, owners: ownersCopied, skipped };
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

// Factor Score — a 0-2 scale scoring an actual result against its three
// thresholds, per the exact formula in Levels_Formula.xlsx:
//   0   at/beyond Unacceptable (the worst end)
//   0-1 linear between Unacceptable and Acceptable
//   1   exactly at Acceptable (= the target)
//   1-2 linear between Acceptable and Exceptional
//   2   at/beyond Exceptional (the best end)
// This is a SEPARATE scale from achievement % (which is a simple ratio,
// can exceed 200%+ with no ceiling) — Factor Score is deliberately
// bounded and threshold-shaped, matching how the source spreadsheet
// weights KPI performance into the Area/Level rollups. Direction-aware,
// using the same stored `direction` field as everything else (mirrors
// the two formula shapes confirmed in the source file — higher_is_better
// and lower_is_better are exact mirror images of each other).
// Returns null when any of the four inputs is missing (a KPI without
// Exceptional/Acceptable/Unacceptable configured has no Factor Score
// yet), or when the thresholds are degenerate (Acceptable equals
// Exceptional or Unacceptable, making the linear portion undefined).
app._kpiFactorScore = function(actual, exceptional, acceptable, unacceptable, direction) {
    if (actual == null || exceptional == null || acceptable == null || unacceptable == null) return null;
    const R = Number(actual), S = Number(exceptional), T = Number(acceptable), U = Number(unacceptable);
    if (!Number.isFinite(R) || !Number.isFinite(S) || !Number.isFinite(T) || !Number.isFinite(U)) return null;
    if (T === U || S === T) return null; // degenerate thresholds, linear portion undefined

    if (direction === 'lower_is_better') {
        if (R >= U) return 0;
        if (R > T && R < U) return (U - R) / (U - T);
        if (R === T) return 1;
        if (R > S && R < T) return 1 + (T - R) / (T - S);
        return 2; // R <= S
    }
    // higher_is_better (default)
    if (R <= U) return 0;
    if (R > U && R < T) return (R - U) / (T - U);
    if (R === T) return 1;
    if (R > T && R < S) return 1 + (R - T) / (S - T);
    return 2; // R >= S
};


// Benchmark label — Exceptional/Acceptable/Unacceptable, per the exact
// formula in Levels_Formula.xlsx's "Benchmark" column (V):
//   =IF(R>=S,"Exceptional",IF(AND(R<S,R>U),"Acceptable",IF(R<=U,"Unacceptable")))
// Note this only compares against Exceptional (S) and Unacceptable (U)
// — Acceptable/target isn't referenced at all, matching the source file
// exactly. This is a separate, finer-grained 3-tier categorization from
// the existing on_target/below_target status (which stays as-is
// everywhere else in the app) — used only where this specific
// Exceptional/Acceptable/Unacceptable labeling was explicitly requested.
// Direction-aware, mirroring the same two formula shapes as
// _kpiFactorScore. Returns null when Exceptional or Unacceptable isn't
// configured for this KPI.
app._kpiBenchmarkLabel = function(actual, exceptional, unacceptable, direction) {
    if (actual == null || exceptional == null || unacceptable == null) return null;
    const R = Number(actual), S = Number(exceptional), U = Number(unacceptable);
    if (!Number.isFinite(R) || !Number.isFinite(S) || !Number.isFinite(U)) return null;
    if (direction === 'lower_is_better') {
        if (R <= S) return 'Exceptional';
        if (R > S && R < U) return 'Acceptable';
        return 'Unacceptable'; // R >= U
    }
    if (R >= S) return 'Exceptional';
    if (R < S && R > U) return 'Acceptable';
    return 'Unacceptable'; // R <= U
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

        const factorScore = this._kpiFactorScore(actualValue, kpiDef.exceptional_value, kpiDef.target_value, kpiDef.unacceptable_value, kpiDef.direction);
        // Final KPI auto-follows the freshly computed Factor Score UNLESS
        // it was already manually overridden on a previous save of this
        // same result (i.e. its stored value no longer matches its own
        // last factor_score) — matching the source spreadsheet, where
        // "Final KPI" starts as "=Factor Score" but stays wherever
        // someone typed a literal override, even if the underlying
        // result is corrected afterward.
        const existing = (this.state.kpiResults || []).find(r => r.kpi_definition_id === kpiDefinitionId && r.period_label === periodLabel);
        const wasOverridden = existing && existing.final_kpi != null && existing.factor_score != null && Math.abs(existing.final_kpi - existing.factor_score) > 1e-9;
        const finalKpi = wasOverridden ? existing.final_kpi : factorScore;

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
            factor_score: factorScore,
            final_kpi: finalKpi,
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

// Manually overrides ONLY the Final KPI value on an already-saved
// result — never touches actual_value, factor_score, achievement, or
// status. This is the "must remain editable" override the source
// spreadsheet's Final KPI column allows (typing a literal number over
// what was "=Factor Score"). Passing null resets it back to auto-follow
// factor_score again.
app.overrideKpiFinalScore = async function(resultId, newValue) {
    if (!this.supabase) return null;
    try {
        const { data, error } = await this.supabase
            .from('kpi_results')
            .update({ final_kpi: newValue })
            .eq('id', resultId)
            .select();
        if (error) throw error;
        const saved = data[0];
        this.state.kpiResults = this.state.kpiResults.map(r => r.id === resultId ? saved : r);
        return saved;
    } catch (e) {
        console.error('❌ Failed to update Final KPI:', e.message);
        this.showToast('Could not update Final KPI: ' + e.message, 'error');
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

// Every active KPI belonging to a directorate as its HOME directorate —
// unaffected by ownership splitting. This is what Enter Results and the
// KPIs tab use: a director only ever enters/manages results for KPIs
// actually defined under their own directorate, never for ones they
// merely hold a minority ownership share in via another directorate's
// KPI (see _kpisForDirectorateDashboard below for that, dashboard-only,
// concern).
app._kpisForDirectorate = function(directorateId) {
    return (this.state.kpiDefinitions || []).filter(k =>
        k.is_active !== false && this._kpiEffectiveDirectorateId(k) === directorateId
    );
};

// The fraction (0-1) of a KPI's result that belongs to `directorateId`,
// per the multi-owner allocation enhancement: when a KPI has recorded
// owners (kpi_owners), each owner's percentage is attributed to whichever
// directorate is NAMED by their owner_dept — e.g. Kamrul Islam (95%,
// dept "Operations") attributes 0.95 to the Operations directorate,
// Michael Barry (5%, dept "Contracts") attributes 0.05 to Contracts,
// regardless of which directorate the KPI is actually DEFINED under.
// Matching is scoped to the KPI's own company (OMC/Audit) so an owner
// dept name can never accidentally match a same-named directorate on the
// other side. An owner_dept that doesn't match any directorate's name
// contributes nothing to anyone — it isn't auto-created here.
//
// A KPI with NO owner records at all (the common case — every manually
// added KPI, and any KPI imported with a single 100% owner where that
// owner IS the KPI's home directorate) is treated as fully (weight 1)
// owned by its home directorate and 0 everywhere else — completely
// unaffected by this feature, identical to behavior before it existed.
app._kpiOwnershipWeight = function(kpiDef, directorateId) {
    const owners = (this.state.kpiOwners || []).filter(o => o.kpi_definition_id === kpiDef.id);
    if (owners.length === 0) {
        return this._kpiEffectiveDirectorateId(kpiDef) === directorateId ? 1 : 0;
    }
    const homeDirId = this._kpiEffectiveDirectorateId(kpiDef);
    const homeDir = (this.state.kpiDirectorates || []).find(d => d.id === homeDirId);
    const company = homeDir ? (homeDir.company || 'OMC') : 'OMC';
    let weight = 0;
    owners.forEach(o => {
        const match = (this.state.kpiDirectorates || []).find(d => d.name === o.owner_dept && (d.company || 'OMC') === company);
        if (match && match.id === directorateId) weight += (o.owner_percentage || 0);
    });
    return weight;
};

// Returns a KPI's result rows scaled by `weight` (a 0-1 ownership
// fraction) — both actual_value and target_value scaled equally, so the
// achievement % (a ratio of the two) comes out mathematically identical
// to the unscaled figure; only the raw actual/target MAGNITUDES shrink
// to reflect this directorate's partial share, matching the same
// "proportionally-scaled target" convention _kpiAutoAggregateFromMonthly
// already uses for monthly->quarterly/yearly rollups. weight defaults to
// 1 (the ordinary single-owner case), which returns the real rows
// completely unchanged — every existing call site behaves byte-for-byte
// as before whenever no ownership split is involved.
app._kpiScopedResults = function(kpiId, weight) {
    const w = weight == null ? 1 : weight;
    const rows = (this.state.kpiResults || []).filter(r => r.kpi_definition_id === kpiId);
    if (w === 1) return rows;
    return rows.map(r => ({
        ...r,
        actual_value: r.actual_value != null ? r.actual_value * w : r.actual_value,
        target_value: r.target_value != null ? r.target_value * w : r.target_value,
        // achievement/status are left untouched — they're ratios, so
        // scaling both sides by the same weight leaves them unchanged;
        // reusing the already-stored figures avoids re-deriving them
        // (and any edge-case rounding _computeKpiResultFields applied).
    }));
};

// DASHBOARD-ONLY variant of _kpisForDirectorate: every active KPI with a
// nonzero ownership share in this directorate — its home directorate
// (weight 1, the ordinary case) OR a partial owner via kpi_owners (see
// _kpiOwnershipWeight above). Used exclusively by the dashboard
// aggregation functions below (cards, rankings, trends) — NEVER by Enter
// Results or the KPIs tab, which must stay scoped to _kpisForDirectorate
// (home-only), since there's only one real data-entry point per KPI.
// Each returned KPI is a clone carrying its resolved `_ownershipWeight`,
// with target_value/exceptional_value/unacceptable_value pre-scaled by
// that weight — so code reading k.target_value directly (e.g. the
// monthly->quarterly/yearly rollup) automatically gets the correctly-
// scaled baseline, while code reading individual RESULT rows should call
// _kpiScopedResults(k.id, k._ownershipWeight) for equally-scaled actual/
// target figures.
app._kpisForDirectorateDashboard = function(directorateId) {
    return (this.state.kpiDefinitions || [])
        .filter(k => k.is_active !== false)
        .map(k => ({ kpi: k, weight: this._kpiOwnershipWeight(k, directorateId) }))
        .filter(x => x.weight > 0)
        .map(x => ({
            ...x.kpi,
            _ownershipWeight: x.weight,
            target_value: x.kpi.target_value != null ? x.kpi.target_value * x.weight : x.kpi.target_value,
            exceptional_value: x.kpi.exceptional_value != null ? x.kpi.exceptional_value * x.weight : x.kpi.exceptional_value,
            unacceptable_value: x.kpi.unacceptable_value != null ? x.kpi.unacceptable_value * x.weight : x.kpi.unacceptable_value,
        }));
};

// Dashboard summary cards: total KPIs, how many have their most recent
// result on_target vs below_target for the given year, and how many have
// no result recorded at all yet for that year ("pending").
app._kpiDashboardCards = function(directorateId, year) {
    const kpis = this._kpisForDirectorateDashboard(directorateId);
    let achieved = 0, belowTarget = 0, pending = 0;
    kpis.forEach(k => {
        const results = this._kpiScopedResults(k.id, k._ownershipWeight)
            .filter(r => r.year === year)
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
    const kpis = this._kpisForDirectorateDashboard(directorateId);
    const withAchievement = kpis.map(k => {
        const results = this._kpiScopedResults(k.id, k._ownershipWeight)
            .filter(r => r.year === year && r.achievement != null)
            .sort((a, b) => (b.entered_at || '').localeCompare(a.entered_at || ''));
        return { kpiId: k.id, name: k.name, achievement: results.length > 0 ? results[0].achievement : null, weight: k._ownershipWeight };
    }).filter(k => k.achievement !== null);
    withAchievement.sort((a, b) => b.achievement - a.achievement);
    return withAchievement;
};

app._kpiPerformanceByPeriod = function(directorateId, year, periodType) {
    const kpis = this._kpisForDirectorateDashboard(directorateId).filter(k => k.period_type === periodType);
    const byPeriod = {};
    kpis.forEach(k => {
        this._kpiScopedResults(k.id, k._ownershipWeight)
            // A KPI's cadence can be edited by the planner after results
            // already exist under the old one (e.g. quarterly -> monthly)
            // — those old rows keep the SAME kpi_definition_id but their
            // OWN, now-stale period_type. Filtering only on the KPI's
            // current period_type (via the outer `kpis` filter above)
            // isn't enough; each individual result must also match, or
            // leftover results from a previous cadence bleed into this
            // one's chart.
            .filter(r => r.year === year && r.period_type === periodType && r.achievement != null)
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
    const kpis = this._kpisForDirectorateDashboard(directorateId).filter(k => k.period_type === periodType);
    if (kpis.length === 0) return { labels: [], series: [] };

    const allLabels = new Set();
    const resultsByKpi = {};
    kpis.forEach(k => {
        // Same fix as _kpiPerformanceByPeriod: must also check each
        // result's OWN period_type, not just the KPI's current cadence —
        // a KPI edited from one cadence to another leaves old results
        // behind under the same kpi_definition_id.
        const results = this._kpiScopedResults(k.id, k._ownershipWeight).filter(r => r.period_type === periodType && r.achievement != null);
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
    this._kpiScopedResults(kpiDef.id, kpiDef._ownershipWeight)
        // Same fix as _kpiPerformanceByPeriod/_kpiMultiYearTrend: must
        // also check each result's OWN period_type, not just the KPI's
        // current cadence, or a leftover result from before this KPI was
        // edited to monthly could corrupt the month-by-month grouping.
        .filter(r => r.period_type === 'monthly' && r.actual_value != null)
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
    const monthlyKpis = this._kpisForDirectorateDashboard(directorateId).filter(k => k.period_type === 'monthly');

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
app._kpiSingleYearStats = function(kpiId, year, weight) {
    const kpiDef = (this.state.kpiDefinitions || []).find(k => k.id === kpiId);
    if (!kpiDef) return null;

    const monthResults = this._kpiScopedResults(kpiId, weight)
        .filter(r => r.year === year && r.period_type === 'monthly' && r.achievement != null)
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
app._kpiMonthsRanked = function(kpiId, year, weight) {
    const stats = this._kpiSingleYearStats(kpiId, year, weight);
    if (!stats) return [];
    return [...stats.monthlyResults].sort((a, b) => b.achievement - a.achievement);
};

// Rule-based narrative summary — deliberately NOT an AI call, computed
// directly from the same stats the cards/charts already show, so the
// summary can never say something the numbers on screen don't support.
app._kpiRuleBasedSummary = function(kpiId, year, weight) {
    const stats = this._kpiSingleYearStats(kpiId, year, weight);
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
    const kpiDef = (this.state.kpiDefinitions || []).find(k => k.id === selectedKpiId);
    const weight = kpiDef ? this._kpiOwnershipWeight(kpiDef, directorateId) : 1;
    const stats = this._kpiSingleYearStats(selectedKpiId, year, weight);
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
//
// SAFETY CHECK: if two rows share the same (line, kpiCode) key but have
// DIFFERENT KPI Names, that's not a legitimate multi-owner split — it
// means the same code was reused for two unrelated KPIs (e.g. numbering
// restarting per department in the source spreadsheet), and blindly
// merging them would combine unrelated owners under one KPI, silently
// misattributing whichever owner has the higher % as if they owned the
// OTHER KPI too. Those keys are pulled out into `conflicts` instead of
// being merged, so the caller can surface them as errors rather than
// import corrupted data.
app._kpiGroupImportRowsByLineAndCode = function(validRows) {
    const groups = {};
    const order = [];
    validRows.forEach(row => {
        const key = `${row.line}::${row.kpiCode}`;
        if (!groups[key]) {
            groups[key] = {
                line: row.line, code: row.code, kpiCode: row.kpiCode, kpiName: row.kpiName,
                periodType: row.periodType, weight: row.weight, owners: [],
                names: new Set([row.kpiName]),
            };
            order.push(key);
        } else {
            groups[key].names.add(row.kpiName);
        }
        groups[key].owners.push({ dept: row.ownerDept, name: row.ownerName, email: row.ownerEmail, pct: row.ownerPct });
    });

    const clean = [], conflicts = [];
    order.forEach(key => {
        const g = groups[key];
        if (g.names.size > 1) {
            conflicts.push({ line: g.line, kpiCode: g.kpiCode, names: Array.from(g.names) });
        } else {
            delete g.names;
            clean.push(g);
        }
    });
    return { groups: clean, conflicts };
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
app.importKpiOwnerData = async function(groupedRows, company) {
    if (!this.supabase) return { created: 0, updated: 0, failed: 0, errors: ['Not connected to Supabase.'] };
    const targetCompany = company || 'OMC';

    const summary = { created: 0, updated: 0, failed: 0, errors: [] };
    // Cache directorate lookups within this run — many rows share the
    // same primary dept, no need to re-check/re-create per row.
    const directorateByDeptName = {};

    for (const group of groupedRows) {
        try {
            const primaryDept = this._kpiDeterminePrimaryOwnerDept(group.owners);
            if (!primaryDept) { summary.failed++; summary.errors.push(`${group.kpiCode} (${group.line}): no owner department found`); continue; }

            if (!directorateByDeptName[primaryDept]) {
                // Scoped to the target company — without this, a name match
                // against a directorate belonging to the OTHER company would
                // silently import into the wrong side.
                let directorate = (this.state.kpiDirectorates || []).find(d => d.name === primaryDept && (d.company || 'OMC') === targetCompany);
                if (!directorate) {
                    directorate = await this.saveKpiDirectorate(primaryDept, null, targetCompany);
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

// Finds an already-imported KPI by (kpi_code, line) within a specific
// company — necessary because this spreadsheet has no Owner Dept column,
// unlike the owner import. Searches across that company's directorates'
// KPIs, matching kpi_code against the definition and the requested line
// name against its department_id's line row. Assumes (kpi_code, line) is
// unique WITHIN a company, which holds as long as the owner import is
// what originally created these KPIs — each KPI code only ever gets
// assigned to one, primary-owner directorate per company. Company
// scoping matters here specifically: OMC and Audit can each have their
// own KPI using the same code+line (e.g. both imported from similar
// spreadsheets), and without this a threshold update meant for one
// company could silently land on the other's KPI instead.
app._kpiFindExistingKpiByCodeAndLine = function(kpiCode, lineName, company) {
    const targetCompany = company || 'OMC';
    const dirCompanyById = {};
    (this.state.kpiDirectorates || []).forEach(d => { dirCompanyById[d.id] = d.company || 'OMC'; });
    const lineRows = (this.state.kpiDirectorateDepartments || []).filter(d => {
        if (d.department_name !== lineName) return false;
        // If there's no directorate record for this line at all (e.g.
        // kpiDirectorates isn't loaded), don't exclude it — only exclude
        // when we positively know it belongs to the OTHER company.
        const dirCompany = dirCompanyById[d.directorate_id];
        return dirCompany === undefined || dirCompany === targetCompany;
    });
    const lineRowIds = new Set(lineRows.map(l => l.id));
    return (this.state.kpiDefinitions || []).find(k => k.kpi_code === kpiCode && lineRowIds.has(k.department_id)) || null;
};

// Applies parsed threshold rows to already-existing KPIs — matched by
// (kpi_code, line) within the given company, never creating anything
// new. A row with no matching KPI is reported, not silently skipped,
// since that usually means the owner import hasn't been run for that
// KPI (in that company) yet.
app.importKpiThresholdData = async function(validRows, company) {
    if (!this.supabase) return { updated: 0, notFound: 0, failed: 0, errors: ['Not connected to Supabase.'] };
    const targetCompany = company || 'OMC';

    const summary = { updated: 0, notFound: 0, failed: 0, errors: [] };
    for (const row of validRows) {
        const existing = this._kpiFindExistingKpiByCodeAndLine(row.kpiCode, row.line, targetCompany);
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

// ════════════════════════════════════════════════════════════════════
// Weight hierarchy import ("Level" spreadsheet) — Area/Level 1/Level 2/
// Level 3 %, used to compute each KPI's Final Weight. This is a
// SEPARATE layer from Directorate/Line/Owner — it never creates a KPI,
// only attaches weighting data to one that already exists (same
// match-by-code-and-line, never-create philosophy as the threshold
// importer above).
// ════════════════════════════════════════════════════════════════════

// Percentages here (Area %/Level 1 %/Level 2 %/Level 3 %) are TRUE
// percentages of a parent share, stored as fractions (30% -> 0.30) —
// unlike _kpiParseThresholdNumericValue, which deliberately does NOT
// divide by 100 (thresholds are raw values on the same scale as entered
// results, not a percentage of something).
app._kpiParseWeightPercentValue = function(value) {
    if (value == null || value === '') return null;
    const numeric = Number(String(value).replace('%', '').trim());
    if (!Number.isFinite(numeric)) return null;
    return numeric / 100;
};

// Area/Area %/Level 1/Level 1 %/Level 2/Level 2 % are only entered on
// each group's first row in this file's own convention (confirmed
// against the actual uploaded file) — every row under it leaves those
// cells blank, meaning "same as the nearest row above", not "not
// applicable". This function processes rows IN ORDER, carrying the last
// seen value/percentage forward — unlike the other importers' parsers,
// this one can't validate rows independently of each other. Level 3 %
// (the KPI's own share within its Level 2 group) IS entered on every
// row, no fill-down needed for it.
//
// Line is OPTIONAL here, unlike the owner/threshold imports — the
// weighting hierarchy describes what a KPI CODE represents in the
// overall scorecard, not a specific line's instance of it, and the
// actual "Level" spreadsheet this was built against leaves the Line
// column blank throughout. When Line is blank, the row applies to every
// existing line-instance of that KPI code; when a valid Line IS given,
// it's scoped to just that one instance (in case a future file needs
// per-line weights after all).
app._kpiParseWeightImportRows = function(rawRows) {
    const validRows = [], invalidRows = [];
    const cur = { area: null, areaPct: null, level1: null, level1Pct: null, level2: null, level2Pct: null };

    (rawRows || []).forEach((rawRow, index) => {
        const errors = [];
        const rawLineValue = rawRow['Line'];
        const lineProvided = rawLineValue != null && String(rawLineValue).trim() !== '';
        let lineName = null;
        if (lineProvided) {
            lineName = this._kpiMapLineNumberToLineName(rawLineValue);
            if (lineName == null) errors.push(`Invalid Line value: "${rawLineValue}" (must be 3, 4, 5, or 6, or left blank to apply to every line)`);
        }

        const kpiCode = rawRow['KPI Code'] != null ? String(rawRow['KPI Code']).trim() : '';
        if (!kpiCode) errors.push('Missing KPI Code');

        const rawArea = rawRow['Area'] != null ? String(rawRow['Area']).trim() : '';
        if (rawArea) cur.area = rawArea;
        if (rawRow['Area %'] !== '' && rawRow['Area %'] != null) {
            const p = this._kpiParseWeightPercentValue(rawRow['Area %']);
            if (p == null) errors.push(`Invalid Area % value: "${rawRow['Area %']}"`);
            else cur.areaPct = p;
        }

        const rawLevel1 = rawRow['Level 1'] != null ? String(rawRow['Level 1']).trim() : '';
        if (rawLevel1) cur.level1 = rawLevel1;
        if (rawRow['Level 1 %'] !== '' && rawRow['Level 1 %'] != null) {
            const p = this._kpiParseWeightPercentValue(rawRow['Level 1 %']);
            if (p == null) errors.push(`Invalid Level 1 % value: "${rawRow['Level 1 %']}"`);
            else cur.level1Pct = p;
        }

        const rawLevel2 = rawRow['Level 2'] != null ? String(rawRow['Level 2']).trim() : '';
        if (rawLevel2) cur.level2 = rawLevel2;
        if (rawRow['Level 2 %'] !== '' && rawRow['Level 2 %'] != null) {
            const p = this._kpiParseWeightPercentValue(rawRow['Level 2 %']);
            if (p == null) errors.push(`Invalid Level 2 % value: "${rawRow['Level 2 %']}"`);
            else cur.level2Pct = p;
        }

        // Column header varies slightly by export ("Level 3%" vs "Level 3 %").
        const level3PctRaw = rawRow['Level 3%'] != null && rawRow['Level 3%'] !== '' ? rawRow['Level 3%'] : rawRow['Level 3 %'];
        const level3Pct = this._kpiParseWeightPercentValue(level3PctRaw);
        if (level3Pct == null) errors.push(`Invalid/missing Level 3 % value: "${level3PctRaw}"`);

        if (!cur.area) errors.push('No Area resolved for this row (blank, with nothing above it to inherit)');
        if (cur.areaPct == null) errors.push('No Area % resolved for this row');
        if (!cur.level1) errors.push('No Level 1 resolved for this row');
        if (cur.level1Pct == null) errors.push('No Level 1 % resolved for this row');
        if (!cur.level2) errors.push('No Level 2 resolved for this row');
        if (cur.level2Pct == null) errors.push('No Level 2 % resolved for this row');

        const data = {
            line: lineName, kpiCode,
            kpiName: rawRow['KPI Name'] != null ? String(rawRow['KPI Name']).trim() : '',
            area: cur.area, areaPct: cur.areaPct,
            level1: cur.level1, level1Pct: cur.level1Pct,
            level2: cur.level2, level2Pct: cur.level2Pct,
            level3Pct,
        };
        if (errors.length === 0) validRows.push(data);
        else invalidRows.push({ rowNumber: index + 2, errors, raw: rawRow });
    });

    return { validRows, invalidRows };
};

// Same matching as _kpiFindExistingKpiByCodeAndLine, but for when NO
// line was specified — returns every existing KPI (across all 4 lines)
// with this kpi_code within the company, since the weighting hierarchy
// applies uniformly to a KPI code regardless of which line it's on.
app._kpiFindExistingKpisByCode = function(kpiCode, company) {
    const targetCompany = company || 'OMC';
    const dirIds = new Set((this.state.kpiDirectorates || []).filter(d => (d.company || 'OMC') === targetCompany).map(d => d.id));
    return (this.state.kpiDefinitions || []).filter(k => {
        if (k.kpi_code !== kpiCode) return false;
        const homeDirId = this._kpiEffectiveDirectorateId(k);
        // Same "don't exclude on missing data" safety as the single-line
        // version: only exclude when we positively know it's the other company.
        return homeDirId == null || dirIds.has(homeDirId) || !(this.state.kpiDirectorates || []).some(d => d.id === homeDirId);
    });
};

// Applies parsed weight rows to already-existing KPIs, matched by
// kpi_code (and Line, when the row specifies one) within the given
// company — same never-create contract as importKpiThresholdData.
// Rebuilds every field explicitly from the existing record (rather than
// relying on partial-update semantics) so this behaves identically
// regardless of how saveKpiDefinition's undefined-field handling evolves.
app.importKpiWeightData = async function(validRows, company) {
    if (!this.supabase) return { updated: 0, notFound: 0, failed: 0, errors: ['Not connected to Supabase.'] };
    const targetCompany = company || 'OMC';

    const summary = { updated: 0, notFound: 0, failed: 0, errors: [] };
    for (const row of validRows) {
        const matches = row.line
            ? [this._kpiFindExistingKpiByCodeAndLine(row.kpiCode, row.line, targetCompany)].filter(Boolean)
            : this._kpiFindExistingKpisByCode(row.kpiCode, targetCompany);

        if (matches.length === 0) {
            summary.notFound++;
            summary.errors.push(`${row.kpiCode}${row.line ? ' (' + row.line + ')' : ''}: no matching KPI found — run the owner import first`);
            continue;
        }

        for (const existing of matches) {
            try {
                const saved = await this.saveKpiDefinition({
                    directorateId: existing.directorate_id, departmentId: existing.department_id,
                    name: existing.name, category: existing.category, kpiCode: existing.kpi_code,
                    periodType: existing.period_type, unit: existing.unit, direction: existing.direction,
                    targetValue: existing.target_value, exceptionalValue: existing.exceptional_value, unacceptableValue: existing.unacceptable_value,
                    area: row.area, areaPct: row.areaPct,
                    level1: row.level1, level1Pct: row.level1Pct,
                    level2: row.level2, level2Pct: row.level2Pct,
                    level3Pct: row.level3Pct,
                }, existing.id);
                if (!saved) { summary.failed++; summary.errors.push(`${row.kpiCode} (id ${existing.id}): failed to save`); continue; }
                summary.updated++;
            } catch (e) {
                summary.failed++;
                summary.errors.push(`${row.kpiCode} (id ${existing.id}): ${e.message}`);
            }
        }
    }

    this.showToast(`Weight import complete: ${summary.updated} updated, ${summary.notFound} not found, ${summary.failed} failed.`, (summary.notFound + summary.failed) > 0 ? 'error' : 'success');
    return summary;
};

// ════════════════════════════════════════════════════════════════════
// Financial calendar & Partner Allocation — per Master_File.xlsx.
// Three pieces, all sharing the goal of computing each partner's
// (HIT/FS/ALS) allocated share of a KPI's actual score:
//
//   1. Partner Allocation — HIT%/FS%/ALS% split on each KPI, attached
//      directly to kpi_definitions (same match-by-code pattern as the
//      Weight import above).
//   2. kpi_fee_periods — reference table mapping each KPI Month to its
//      Fixed Fee Month (always 1 month ahead).
//   3. kpi_line_fee_schedule — reference table of each line's lag and
//      Active/Pre-project status per KPI Month.
//
// (2) and (3) are pure reference/lookup data with no per-row editing —
// re-importing wholesale-replaces the tenant's copy rather than
// matching/merging row by row, since there's nothing to preserve
// (nobody hand-edits a fiscal calendar).
// ════════════════════════════════════════════════════════════════════

app._kpiParsePercentGeneric = function(value) {
    if (value == null || value === '') return null;
    const n = Number(String(value).replace('%', '').trim());
    if (!Number.isFinite(n)) return null;
    return n / 100;
};

// Excel exports these as "26-Nov-2023"-style strings (via raw:false) —
// parsed explicitly rather than trusting new Date(string), whose
// handling of non-ISO formats varies by JS engine.
app._kpiParseDateCell = function(value) {
    if (!value || typeof value !== 'string') return null;
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const m = value.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (!m) return null;
    const mon = months[m[2].toLowerCase()];
    if (!mon) return null;
    return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`;
};

// Partner Allocation sheet — every row is fully populated (Line, Code,
// KPI Code all present on every row, unlike the sparse Level Weight
// sheet), so no fill-down needed. HIT%/FS%/ALS% can individually be
// blank when a KPI only involves 2 of the 3 partners (e.g. "Station
// environment" splits only HIT/FS, ALS blank) — left as null, not 0, so
// _kpiPartnerShares can tell "no share" apart from "explicitly 0%".
app._kpiParsePartnerAllocationRows = function(rawRows) {
    const validRows = [], invalidRows = [];
    (rawRows || []).forEach((rawRow, index) => {
        const errors = [];
        const lineName = this._kpiMapLineNumberToLineName(rawRow['Line']);
        if (lineName == null) errors.push(`Invalid Line value: "${rawRow['Line']}"`);
        const kpiCode = rawRow['KPI Code'] != null ? String(rawRow['KPI Code']).trim() : '';
        if (!kpiCode) errors.push('Missing KPI Code');

        const data = {
            line: lineName, kpiCode,
            kpiName: rawRow['KPI Name'] != null ? String(rawRow['KPI Name']).trim() : '',
            allocationPct: this._kpiParsePercentGeneric(rawRow['Allocation %']),
            hitPct: this._kpiParsePercentGeneric(rawRow['HIT%']),
            fsPct: this._kpiParsePercentGeneric(rawRow['FS%']),
            alsPct: this._kpiParsePercentGeneric(rawRow['ALS%']),
            allocationHitPct: this._kpiParsePercentGeneric(rawRow['Allocation HIT%']),
            allocationFsPct: this._kpiParsePercentGeneric(rawRow['Allocation FS%']),
            allocationAlsPct: this._kpiParsePercentGeneric(rawRow['Allocation ALS%']),
        };
        if (errors.length === 0) validRows.push(data);
        else invalidRows.push({ rowNumber: index + 2, errors, raw: rawRow });
    });
    return { validRows, invalidRows };
};

// Matched by (kpi_code, line) — same never-create contract as the
// threshold/weight importers.
app.importKpiPartnerAllocation = async function(validRows, company) {
    if (!this.supabase) return { updated: 0, notFound: 0, failed: 0, errors: ['Not connected to Supabase.'] };
    const targetCompany = company || 'OMC';
    const summary = { updated: 0, notFound: 0, failed: 0, errors: [] };
    for (const row of validRows) {
        const existing = this._kpiFindExistingKpiByCodeAndLine(row.kpiCode, row.line, targetCompany);
        if (!existing) {
            summary.notFound++;
            summary.errors.push(`${row.kpiCode} (${row.line}): no matching KPI found — run the owner import first`);
            continue;
        }
        try {
            const saved = await this.saveKpiDefinition({
                directorateId: existing.directorate_id, departmentId: existing.department_id,
                name: existing.name, category: existing.category, kpiCode: existing.kpi_code,
                periodType: existing.period_type, unit: existing.unit, direction: existing.direction,
                targetValue: existing.target_value, exceptionalValue: existing.exceptional_value, unacceptableValue: existing.unacceptable_value,
                allocationPct: row.allocationPct, hitPct: row.hitPct, fsPct: row.fsPct, alsPct: row.alsPct,
                allocationHitPct: row.allocationHitPct, allocationFsPct: row.allocationFsPct, allocationAlsPct: row.allocationAlsPct,
            }, existing.id);
            if (!saved) { summary.failed++; summary.errors.push(`${row.kpiCode} (id ${existing.id}): failed to save`); continue; }
            summary.updated++;
        } catch (e) {
            summary.failed++;
            summary.errors.push(`${row.kpiCode} (id ${existing.id}): ${e.message}`);
        }
    }
    this.showToast(`Partner Allocation import complete: ${summary.updated} updated, ${summary.notFound} not found, ${summary.failed} failed.`, (summary.notFound + summary.failed) > 0 ? 'error' : 'success');
    return summary;
};

// Given a partner-split KPI and a score (typically its Final KPI, the
// "official" figure — Factor Score works the same way since both are on
// the same 0-2 scale), splits it across HIT/FS/ALS by their raw
// percentage share of THIS KPI's own result (hit_pct/fs_pct/als_pct —
// NOT allocation_hit_pct/etc., which are a different, company-wide-
// weighted figure — see the comment on saveKpiDefinition's row builder
// above). A partner with no configured share on this KPI gets null, not
// 0, so "uninvolved" stays visually distinct from "involved at 0%".
app._kpiPartnerShares = function(kpiDef, score) {
    if (!kpiDef || score == null) return { hit: null, fs: null, als: null };
    return {
        hit: kpiDef.hit_pct != null ? score * kpiDef.hit_pct : null,
        fs: kpiDef.fs_pct != null ? score * kpiDef.fs_pct : null,
        als: kpiDef.als_pct != null ? score * kpiDef.als_pct : null,
    };
};

// "Period KPI vs Fees" sheet — a straightforward 1-row-per-KPI-Month
// reference table, no fill-down or grouping needed.
app._kpiParseFeePeriodRows = function(rawRows) {
    return (rawRows || []).map(r => ({
        kpi_month_no: parseInt(r['KPI Month No'], 10),
        kpi_fiscal_month: r['KPI Fiscal Month'] || null,
        kpi_period_start: this._kpiParseDateCell(r['KPI Month Period Start']),
        kpi_period_end: this._kpiParseDateCell(r['KPI Month Period End']),
        kpi_year: parseInt(r['KPI Month Year'], 10) || null,
        kpi_cal_month: parseInt(r['KPI Cal Month'], 10) || null,
        kpi_month_name: r['KPI Month Name'] || null,
        kpi_cal_quarter: r['KPI Cal Quarter'] || null,
        kpi_fiscal_year: parseInt(r['KPI Fiscal Year'], 10) || null,
        kpi_fiscal_quarter: r['KPI Fiscal Quarter'] || null,
        fee_month_no: parseInt(r['KPI Fixed Fee No'], 10) || null,
        fee_fiscal_month: r['KPI Fixed Fee Month'] || null,
        fee_period_start: this._kpiParseDateCell(r['KPI Fixed Fee Period Start']),
        fee_period_end: this._kpiParseDateCell(r['KPI Fixed Fee Period End']),
        fee_year: parseInt(r['KPI Fixed Fee Year'], 10) || null,
        fee_cal_month: parseInt(r['KPI Fixed Fee Cal Month'], 10) || null,
        fee_month_name: r['KPI Fixed Fee Name'] || null,
        fee_cal_quarter: r['KPI Fixed Fee Cal Quarter'] || null,
        fee_fiscal_year: parseInt(r['KPI Fixed Fee Fiscal Year'], 10) || null,
        fee_fiscal_quarter: r['KPI Fixed Fee Fiscal Quarter'] || null,
        fee_diff_months: parseInt(r['KPI Fixed Fee Difference (Months)'], 10) || null,
    })).filter(r => Number.isFinite(r.kpi_month_no));
};

// Wholesale replace — this is fiscal-calendar reference data, not
// something anyone hand-edits row by row, so re-importing simply
// replaces the tenant's whole set rather than matching/merging.
app.importKpiFeePeriods = async function(rows) {
    if (!this.supabase) return { imported: 0, errors: ['Not connected to Supabase.'] };
    try {
        const tid = this._tid();
        const { error: delError } = await this.supabase.from('kpi_fee_periods').delete().eq('tenant_id', tid);
        if (delError) throw delError;
        const insertRows = rows.map(r => ({ tenant_id: tid, ...r }));
        const { data, error } = await this.supabase.from('kpi_fee_periods').insert(insertRows).select();
        if (error) throw error;
        this.state.kpiFeePeriods = data || [];
        this.showToast(`Fee period calendar imported: ${data.length} KPI months.`, 'success');
        return { imported: data.length, errors: [] };
    } catch (e) {
        console.error('❌ Failed to import fee periods:', e.message);
        this.showToast('Could not import fee periods: ' + e.message, 'error');
        return { imported: 0, errors: [e.message] };
    }
};

// "Line FFt" sheet — one row per (report month x fee stream). "KPI
// Month No"/"Fixed Fee Month No" can be "-" (literal dash) during a
// line's pre-lag setup period, meaning not yet applicable — kept as
// null, not parsed as a number.
app._kpiParseLineFeeScheduleRows = function(rawRows) {
    const dashOrNull = (v) => (v == null || v === '' || v === '-') ? null : v;
    return (rawRows || []).map(r => ({
        report_month_no: parseInt(r['Report Month No'], 10),
        report_fiscal_month: r['Report Fiscal Month'] || null,
        cal_year: parseInt(r['Year'], 10) || null,
        fiscal_year: parseInt(r['Fiscal Year'], 10) || null,
        fiscal_quarter: r['KPI Fiscal Quarter'] || null,
        fee_stream: r['Fee Stream'] != null ? String(r['Fee Stream']).trim() : '',
        lag_months: parseInt(r['Lag (Months)'], 10) || 0,
        kpi_month_no: dashOrNull(r['KPI Month No']) != null ? parseInt(r['KPI Month No'], 10) : null,
        kpi_fiscal_month: dashOrNull(r['KPI Fiscal Month']),
        fixed_fee_month_no: dashOrNull(r['Fixed Fee Month No']) != null ? parseInt(r['Fixed Fee Month No'], 10) : null,
        fixed_fee_fiscal_month: dashOrNull(r['Fixed Fee Fiscal Month']),
        status: r['Status'] || null,
    })).filter(r => Number.isFinite(r.report_month_no) && r.fee_stream);
};

app.importKpiLineFeeSchedule = async function(rows) {
    if (!this.supabase) return { imported: 0, errors: ['Not connected to Supabase.'] };
    try {
        const tid = this._tid();
        const { error: delError } = await this.supabase.from('kpi_line_fee_schedule').delete().eq('tenant_id', tid);
        if (delError) throw delError;
        const insertRows = rows.map(r => ({ tenant_id: tid, ...r }));
        const { data, error } = await this.supabase.from('kpi_line_fee_schedule').insert(insertRows).select();
        if (error) throw error;
        this.state.kpiLineFeeSchedule = data || [];
        this.showToast(`Line fee schedule imported: ${data.length} rows.`, 'success');
        return { imported: data.length, errors: [] };
    } catch (e) {
        console.error('❌ Failed to import line fee schedule:', e.message);
        this.showToast('Could not import line fee schedule: ' + e.message, 'error');
        return { imported: 0, errors: [e.message] };
    }
};

// Looks up a KPI Month's fee-period info by CALENDAR year+month (1-12)
// — simpler and more robust than trying to re-derive which fiscal
// (26th-to-25th) period a calendar date falls in, since the imported
// data already carries each KPI Month's anchoring calendar year/month
// directly (KPI Month Year / KPI Cal Month).
app._kpiFeePeriodForCalendarDate = function(calYear, calMonth) {
    const y = Number(calYear), m = Number(calMonth);
    return (this.state.kpiFeePeriods || []).find(r => Number(r.kpi_year) === y && Number(r.kpi_cal_month) === m) || null;
};

// Translates this app's line naming ("L3") to the Line FFt sheet's fee
// stream naming ("Line 3 FFt").
app._kpiLineNameToFeeStream = function(lineName) {
    const m = (lineName || '').match(/^L(\d+)$/i);
    return m ? `Line ${m[1]} FFt` : null;
};

// Active/Pre-project status for a given line at a given KPI Month No.
app._kpiLineFeeStatus = function(lineName, kpiMonthNo) {
    const feeStream = this._kpiLineNameToFeeStream(lineName);
    if (!feeStream || kpiMonthNo == null) return null;
    const target = Number(kpiMonthNo);
    const row = (this.state.kpiLineFeeSchedule || []).find(r => r.fee_stream === feeStream && Number(r.kpi_month_no) === target);
    return row ? row.status : null;
};

// ════════════════════════════════════════════════════════════════════
// MGT Ratio Per Line — per AMEEN (1).xlsx's M31_IWF sheet. Converts
// each line's overall performance into a management bonus percentage,
// weighted by that line's share of the network's station count. Verified
// byte-exact against the real M31_IWF snapshot for KPI Month 31.
// ════════════════════════════════════════════════════════════════════

// "Stations"/"Station Open Month" sheet — one row per (KPI Month x
// Line). Wholesale-replace on import, same pattern as fee periods and
// the line fee schedule (physical network data, nobody hand-edits it).
app._kpiParseStationCountRows = function(rawRows) {
    return (rawRows || []).map(r => ({
        kpi_month_no: parseInt(r['Fiscal Month No'], 10),
        line: this._kpiMapLineNumberToLineName(r['Line']),
        station_count: parseInt(r['No. of Stations'], 10) || 0,
    })).filter(r => Number.isFinite(r.kpi_month_no) && r.line);
};

app.importKpiLineStationCounts = async function(rows) {
    if (!this.supabase) return { imported: 0, errors: ['Not connected to Supabase.'] };
    try {
        const tid = this._tid();
        const { error: delError } = await this.supabase.from('kpi_line_station_counts').delete().eq('tenant_id', tid);
        if (delError) throw delError;
        const insertRows = rows.map(r => ({ tenant_id: tid, ...r }));
        const { data, error } = await this.supabase.from('kpi_line_station_counts').insert(insertRows).select();
        if (error) throw error;
        this.state.kpiLineStationCounts = data || [];
        this.showToast(`Station counts imported: ${data.length} rows.`, 'success');
        return { imported: data.length, errors: [] };
    } catch (e) {
        console.error('❌ Failed to import station counts:', e.message);
        this.showToast('Could not import station counts: ' + e.message, 'error');
        return { imported: 0, errors: [e.message] };
    }
};

// M%erc — converts a line's overall Factor Score (KPIFt, 0-2 scale)
// into a management bonus percentage. Exact piecewise formula from
// M31_IWF, verified byte-exact: G5=1.6839 -> H5=0.066839.
app._kpiMPercFromFactor = function(kpiFt) {
    if (kpiFt == null) return null;
    const g = Number(kpiFt);
    if (!Number.isFinite(g)) return null;
    if (g > 0 && g < 1) return 0.01 + (g * 0.05);
    if (g === 1) return 0.06;
    if (g === 0) return 0.01;
    if (g > 1 && g < 2) return 0.06 + ((g - 1) * 0.01);
    return 0.07; // g >= 2
};

// A line's overall Factor Score (KPIFt) for a given KPI Month — a
// weighted average of that line's own KPIs' Factor Scores for the
// matching calendar month, weighted by each KPI's Final Weight (Area% x
// Level1% x Level2% x Level3%). This is mathematically equivalent to the
// source spreadsheet's explicit Area->Level1->Level2->KPI tree rollup,
// since Final Weight is already that full chain multiplied down to each
// individual KPI — no need to separately model Area/Level as their own
// entities. Normalizes by the weight of KPIs that actually HAVE a result
// this month (rather than zeroing the whole line out if one KPI hasn't
// reported yet) — the source spreadsheet doesn't handle partial data
// explicitly, so this is a deliberate, documented judgment call.
// directorateId: pass a directorate to scope to just that directorate's
// own KPIs on this line (matches this app's per-directorate L3-L6
// structure); pass null/omit for a company-wide figure across every
// directorate's KPIs on that line.
app._kpiLineFactorScore = function(lineName, kpiMonthNo, directorateId) {
    const feePeriod = (this.state.kpiFeePeriods || []).find(p => Number(p.kpi_month_no) === Number(kpiMonthNo));
    if (!feePeriod) return null;
    const calMonthStr = String(feePeriod.kpi_cal_month).padStart(2, '0');

    const deptFilter = directorateId != null
        ? (d) => d.directorate_id === directorateId && d.department_name === lineName
        : (d) => d.department_name === lineName;
    const lineDeptIds = new Set((this.state.kpiDirectorateDepartments || []).filter(deptFilter).map(d => d.id));
    if (lineDeptIds.size === 0) return null;

    const lineKpis = (this.state.kpiDefinitions || []).filter(k => k.is_active !== false && lineDeptIds.has(k.department_id) && this._kpiFinalWeight(k) != null);

    let weightedSum = 0, weightTotal = 0;
    lineKpis.forEach(k => {
        const w = this._kpiFinalWeight(k);
        const result = (this.state.kpiResults || []).find(r => r.kpi_definition_id === k.id && Number(r.year) === feePeriod.kpi_year && r.period_value === calMonthStr);
        if (result && result.factor_score != null) {
            weightedSum += w * Number(result.factor_score);
            weightTotal += w;
        }
    });
    if (weightTotal === 0) return null;
    return weightedSum / weightTotal;
};

// A line's share of the network's total station count for a given KPI
// Month — always company-wide (physical station counts aren't scoped to
// a directorate), matching the source sheet's Ratio column exactly.
app._kpiLineStationRatio = function(lineName, kpiMonthNo) {
    const rows = (this.state.kpiLineStationCounts || []).filter(r => Number(r.kpi_month_no) === Number(kpiMonthNo));
    const total = rows.reduce((sum, r) => sum + (r.station_count || 0), 0);
    const thisLine = rows.find(r => r.line === lineName);
    if (!thisLine || total === 0) return null;
    return thisLine.station_count / total;
};

// The full MGT Ratio Per Line table for a given KPI Month — Line,
// Stations, Ratio, KPIFt, M%erc, and each line's Weighted Contribution,
// plus the total (the headline company- or directorate-wide bonus %).
app._kpiMgtRatioPerLine = function(kpiMonthNo, directorateId) {
    const lines = ['L3', 'L4', 'L5', 'L6'];
    const rows = lines.map(line => {
        const stationRow = (this.state.kpiLineStationCounts || []).find(r => Number(r.kpi_month_no) === Number(kpiMonthNo) && r.line === line);
        const stations = stationRow ? stationRow.station_count : null;
        const ratio = this._kpiLineStationRatio(line, kpiMonthNo);
        const kpiFt = this._kpiLineFactorScore(line, kpiMonthNo, directorateId);
        const mPerc = this._kpiMPercFromFactor(kpiFt);
        const weighted = (ratio != null && mPerc != null) ? ratio * mPerc : null;
        return { line, stations, ratio, kpiFt, mPerc, weighted };
    });
    const total = rows.reduce((sum, r) => sum + (r.weighted || 0), 0);
    return { rows, total };
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

