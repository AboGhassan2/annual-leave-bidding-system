// ════════════════════════════════════════════════════════════════════
// api-supabase.js — all direct reads/writes to Supabase.
//
// This is the data layer: connecting to Supabase, loading employees/
// bids/config/on-call dates/GC & CS & sub-group users on startup,
// saving bids and config back, and refreshing bid data for the admin
// panel. Attaches onto the shared `app` object (same pattern as
// utils.js and allocation.js), so it must load AFTER app.js. Every
// existing call site (this.loadFromSupabase(), this.saveBidToSupabase(),
// etc.) keeps working unchanged.
//
// NOT included here (deliberately, to keep this step scoped and
// verifiable): writeAuditLog, the forgot-password/OTP Supabase calls,
// and the public_holidays admin functions. Those also touch Supabase,
// but are smaller and more tangled with other concerns (auth flow,
// audit logging) — good candidates for a later, separate pass rather
// than folding them into this already-large extraction.
// ════════════════════════════════════════════════════════════════════

            app.initSupabase = async function() {
                try {
                    this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                    console.log('✅ Supabase initialized');

                    // Check for existing Supabase Auth session
                    const { data: { session } } = await this.supabase.auth.getSession();
                    if (session?.user) await this._applyAuthSession(session);

                    // Listen for auth state changes
                    this.supabase.auth.onAuthStateChange(async (event, session) => {
                        if (session?.user) await this._applyAuthSession(session);
                        else if (event === 'SIGNED_OUT') {
                            this.state.authUser = null;
                            this.state.tenantId = '00000000-0000-0000-0000-000000000001';
                        }
                    });
                    return true;
                } catch (error) {
                    console.error('❌ Supabase init failed:', error);
                    return false;
                }
            };

            app._applyAuthSession = async function(session) {
                this.state.authUser = session.user;
                const claims = session.access_token
                    ? JSON.parse(atob(session.access_token.split('.')[1]))
                    : {};
                if (claims.tenant_id) this.state.tenantId = claims.tenant_id;
                if (claims.user_role)  this.state.userType  = claims.user_role;
            };

            app.loadFromSupabase = async function() {
                if (!this.supabase) {
                    console.log('Supabase not initialized');
                    return false;
                }

                try {
                    this.updateSystemStatus('Loading from Supabase...');
                    
                    // FIX FOR 1000 STAFF LIMIT: Use range queries with pagination
                    console.log('Loading employees with pagination to avoid 1000 limit...');
                    let allEmployees = [];
                    let from = 0;
                    const batchSize = 1000;
                    let hasMore = true;

                    // Load employees with pagination
                    while (hasMore) {
                        const { data: employeesBatch, error: empError } = await this.supabase
                            .from('employees')
                            .select('*')
                            .eq('tenant_id', this._tid())
                            .range(from, from + batchSize - 1);
                        
                        if (empError) throw empError;
                        
                        if (employeesBatch && employeesBatch.length > 0) {
                            allEmployees = [...allEmployees, ...employeesBatch];
                            hasMore = employeesBatch.length === batchSize;
                            from += batchSize;
                        } else {
                            hasMore = false;
                        }
                    }
                    
                    // Load bids from leave_requests (Ops), maint_leave_requests (Maintenance),
                    // and corporate_leave_request (GC & Corporate Staff)
                    const _fetchBidTable = async (tableName) => {
                        let rows = [], pg = 0, more = true;
                        while (more) {
                            const { data: batch, error: err } = await this.supabase
                                .from(tableName).select('*')
                                .eq('tenant_id', this._tid())
                                .range(pg, pg + batchSize - 1);
                            if (err) {
                                if (err.code !== 'PGRST116') console.warn(`No bids / error [${tableName}]:`, err);
                                more = false;
                            } else if (batch && batch.length > 0) {
                                rows = [...rows, ...batch];
                                more = batch.length === batchSize;
                                pg += batchSize;
                            } else { more = false; }
                        }
                        return rows;
                    };
                    const [regularBids, maintBids, corporateBids] = await Promise.all([
                        _fetchBidTable('leave_requests'),
                        _fetchBidTable('maint_leave_requests'),
                        _fetchBidTable('corporate_leave_request')
                    ]);
                    let allBids = [...regularBids, ...maintBids, ...corporateBids];
                    console.log(`✅ Initial load: ${regularBids.length} regular + ${maintBids.length} maintenance + ${corporateBids.length} corporate bids`);
                    
                    // Load system config
                    const { data: config, error: configError } = await this.supabase
                        .from('system_config_82')
                        .select('*')
                        .eq('tenant_id', this._tid())
                        .single();

                    // Load Corporate/GC config from its own dedicated table (isolated
                    // from Ops/Maintenance settings, which live in system_config_82)
                    const { data: configCorp, error: configCorpError } = await this.supabase
                        .from('system_config')
                        .select('*')
                        .eq('tenant_id', this._tid())
                        .single();

                    if (configCorpError && configCorpError.code !== 'PGRST116') {
                        console.warn('Corp config error:', configCorpError);
                    }
                    
                    if (configError && configError.code !== 'PGRST116') {
                        console.warn('Config error:', configError);
                    }
                    
                    // Update state
                    if (allEmployees && allEmployees.length > 0) {
                        this.state.employees = allEmployees.map(emp => ({
                            id: emp.id,
                            name: emp.name,
                            seniorityDate: emp.seniority_date,
                            position: emp.department || emp.position || '',
                            department: emp.department || 'Unassigned',
                            gender: emp.gender || '',
                            nationality: emp.nationality || '',
                            email: emp.email || '',
                            password: emp.password || ''
                        }));
                        
                        // Load passwords from Supabase (source of truth for cross-device sync).
                        // Falls back to any existing local cache, then to employee ID as the default.
                        this.state.employees.forEach(emp => {
                            this.state.employeePasswords[emp.id] = emp.password || this.state.employeePasswords[emp.id] || emp.id;
                        });
                        
                        console.log(`✅ Loaded ${this.state.employees.length} employees from Supabase (with pagination)`);
                    }
                    
                    // Load bids — Supabase is source of truth
                    // Map Supabase rows to app bid format (look up name/dept from both employee and maintenance lists)
                    const supabaseBids = (allBids || []).map(bid => {
                        const emp  = this.state.employees.find(e => e.id === bid.employee_id);
                        const mEmp = (this.state.maintenanceStaffUsers || []).find(e => e.id === bid.employee_id);
                        return {
                            employeeId:   bid.employee_id,
                            employeeName: bid.employee_name || emp?.name || mEmp?.name || '',
                            seniorityDate: emp?.seniorityDate || mEmp?.seniorityDate || '',
                            department:   bid.department || emp?.department || mEmp?.department || '',
                            position:     emp?.position  || mEmp?.position  || '',
                            slotType:     bid.slot_type || 'slotA',
                            leaveType:    bid.leave_type || 'Annual Leave',
                            startDate:    bid.start_date,
                            endDate:      bid.end_date,
                            days:         bid.days_requested,
                            timestamp:    bid.created_at
                        };
                    });

                    // Also grab any locally-stored bids not yet in Supabase (safety net)
                    const localBids = JSON.parse(localStorage.getItem('bids') || '[]');
                    const supabaseKeys = new Set(supabaseBids.map(b => `${b.employeeId}|${b.slotType}|${b.startDate}`));
                    const localOnly = localBids.filter(b => !supabaseKeys.has(`${b.employeeId}|${b.slotType}|${b.startDate}`));

                    // Only re-push bids created within the last 60 seconds — older
                    // entries in localStorage are either already synced or were
                    // intentionally deleted, so we must NOT resurrect them.
                    const freshLocalOnly = localOnly.filter(b => {
                        const ts = new Date(b.timestamp || 0).getTime();
                        return Date.now() - ts < 60_000;
                    });

                    if (freshLocalOnly.length > 0) {
                        console.log(`ℹ️ Found ${freshLocalOnly.length} recent local bid(s) not yet in Supabase — pushing now...`);
                        freshLocalOnly.forEach(bid => this.saveBidToSupabase(bid));
                    }

                    this.state.bids = [...supabaseBids, ...freshLocalOnly];
                    console.log(`✅ Loaded ${supabaseBids.length} bids from Supabase + ${freshLocalOnly.length} recent local-only bid(s)`);
                    this.saveState();
                    
                    if (config) {
                        this.state.biddingDeadline = config.bidding_deadline || '';
                        this.state.biddingYear = config.bidding_year || 2026;
                        this.state.isProcessed = config.is_processed || false;
                        this.state.plannerPassword = config.planner_password || 'admin123';
                        this.state.plannerEmail    = config.planner_email    || 'a_abdulqader@outlook.com';
                        this.state.slotCapacities = config.slot_capacities || {};
                        this.state.maintSlotCapacities = config.maint_slot_capacities || {};
                        this.state.maintResults     = config.maint_results || [];
                        this.state.isMaintProcessed = config.is_maint_processed || false;
                        this.state.results = config.results || [];
                        // Load EmailJS keys from Supabase into localStorage so OTP works on any device
                        if (config.ejs_service)  { this.state.ejsServiceId  = config.ejs_service;  localStorage.setItem('ejs_service',        config.ejs_service); }
                        if (config.ejs_template) { this.state.ejsTemplateId = config.ejs_template; localStorage.setItem('ejs_template',       config.ejs_template); }
                        if (config.ejs_pubkey)   { this.state.ejsPublicKey  = config.ejs_pubkey;   localStorage.setItem('ejs_pubkey',         config.ejs_pubkey); }
                        if (config.smtp_fallback_url) { this.state.smtpFallbackUrl = config.smtp_fallback_url; localStorage.setItem('smtp_fallback_url', config.smtp_fallback_url); }
                        if (config.smtp_fallback_key) { this.state.smtpFallbackKey = config.smtp_fallback_key; localStorage.setItem('smtp_fallback_key', config.smtp_fallback_key); }
                        if (config.planner_email){ this.state.plannerEmail  = config.planner_email; localStorage.setItem('ejs_planner_email', config.planner_email); }
                        console.log('✅ Loaded system config from Supabase — ejs_service:', config.ejs_service || '(empty)', '| ejs_template:', config.ejs_template || '(empty)', '| ejs_pubkey:', config.ejs_pubkey ? config.ejs_pubkey.substring(0,6)+'…' : '(empty)');
                    }

                    // Corporate/GC settings live in their own table (system_config),
                    // completely separate from Ops/Maintenance (system_config_82)
                    if (configCorp) {
                        this.state.biddingDeadlineCorp = configCorp.bidding_deadline || '';
                        this.state.biddingYearCorp = configCorp.bidding_year || 2026;
                        this.state.isProcessedCorp = configCorp.is_processed || false;
                        console.log('✅ Loaded Corporate/GC config from system_config table');
                    }

                    // Load on-call dates from dedicated oncall_dates table
                    // Load on-call dates with pagination (bypass 1000-row Supabase limit)
                    let ocRows = [];
                    let ocFrom = 0;
                    const ocBatch = 1000;
                    while (true) {
                        const { data: batch, error: ocError } = await this.supabase
                            .from('oncall_dates')
                            .select('employee_id, date')
                            .eq('tenant_id', this._tid())
                            .range(ocFrom, ocFrom + ocBatch - 1);
                        if (ocError) { console.warn('⚠️ Could not load oncall_dates:', ocError.message); break; }
                        if (!batch || batch.length === 0) break;
                        ocRows = [...ocRows, ...batch];
                        if (batch.length < ocBatch) break;
                        ocFrom += ocBatch;
                    }

                    if (ocRows.length > 0) {
                        const built = {};
                        for (const row of ocRows) {
                            if (!built[row.employee_id]) built[row.employee_id] = [];
                            const dateStr = row.date ? String(row.date).substring(0, 10) : null;
                            if (dateStr) built[row.employee_id].push(dateStr);
                        }
                        for (const id of Object.keys(built)) built[id].sort();
                        this.state.onCallDates = { ...(this.state.onCallDates || {}), ...built };
                        console.log(`✅ Loaded on-call dates: ${ocRows.length} rows, ${Object.keys(built).length} staff entries`);
                    } else {
                        console.log('ℹ️ No on-call dates in oncall_dates table yet');
                    }

                    // Load the December-leave-holders list — staff with already-approved
                    // leave in the prior December, blocked from bidding January slots in
                    // the current cycle to avoid leave continuity across two calendar
                    // years. Stored as a plain array of employee IDs on state for a fast
                    // lookup at bid-submission time (see isDecemberLeaveHolder()).
                    try {
                        const { data: decRows, error: decError } = await this.supabase
                            .from('december_leave_holders')
                            .select('employee_id')
                            .eq('tenant_id', this._tid());
                        if (decError) {
                            console.warn('⚠️ Could not load december_leave_holders:', decError.message);
                            this.state.decemberLeaveHolders = this.state.decemberLeaveHolders || [];
                        } else {
                            this.state.decemberLeaveHolders = (decRows || []).map(r => r.employee_id);
                            console.log(`✅ Loaded December leave holders: ${this.state.decemberLeaveHolders.length} staff`);
                        }
                    } catch (e) {
                        console.warn('⚠️ Could not load december_leave_holders:', e.message);
                        this.state.decemberLeaveHolders = this.state.decemberLeaveHolders || [];
                    }

                    // Load Golden Command users from dedicated table
                    const { data: gcUsers, error: gcError } = await this.supabase
                        .from('golden_command_users')
                        .select('*')
                        .eq('tenant_id', this._tid())
                        .order('created_at', { ascending: true });

                    if (gcError) {
                        console.warn('⚠️ Could not load GC users:', gcError.message);
                    } else if (gcUsers && gcUsers.length > 0) {
                        this.state.goldenCommandUsers = gcUsers.map(u => ({
                            id: u.id,
                            name: u.name,
                            password: u.password,
                            email: u.email || ''
                        }));
                        console.log(`✅ Loaded ${gcUsers.length} Golden Command users from dedicated table`);
                    } else {
                        // Table exists but is empty — keep whatever is in localStorage
                        console.log('ℹ️ No GC users found in dedicated table');
                    }

                    // Load Corporate Staff roster from dedicated table (paginated, like Maintenance staff)
                    let allCsStaff = [];
                    let csFrom = 0;
                    let csHasMore = true;
                    while (csHasMore) {
                        const { data: csBatch, error: csError } = await this.supabase
                            .from('corporate_staff_employees')
                            .select('*')
                            .eq('tenant_id', this._tid())
                            .range(csFrom, csFrom + batchSize - 1);
                        if (csError) {
                            console.warn('⚠️ Could not load corporate_staff_employees:', csError.message);
                            csHasMore = false;
                        } else if (csBatch && csBatch.length > 0) {
                            allCsStaff = [...allCsStaff, ...csBatch];
                            csHasMore = csBatch.length === batchSize;
                            csFrom += batchSize;
                        } else {
                            csHasMore = false;
                        }
                    }
                    if (allCsStaff.length > 0) {
                        this.state.corporateStaffUsers = allCsStaff.map(u => ({
                            id:            String(u.id),
                            name:          u.name         || '',
                            department:    u.department   || 'Corporate Staff',
                            position:      u.position     || '',
                            role:          u.role         || '',
                            nationality:   u.nationality  || '',
                            gender:        u.gender       || '',
                            seniorityDate: u.seniority_date || '2000-01-01',
                            totalLeaveDays: u.total_leave_days ?? 30,
                            usedLeaveDays:  u.used_leave_days  ?? 0,
                            password:      u.password || String(u.id),
                            email:         u.email || ''
                        }));
                        console.log(`✅ Corporate Staff roster loaded from Supabase: ${this.state.corporateStaffUsers.length} records`);
                    } else {
                        console.log('ℹ️ No Corporate Staff records found in corporate_staff_employees table');
                    }

                    // ── Load CS sub-group users (L456 INM, L3 INM, L3 TSM, HSEQ) from Supabase ──
                    const subGroups = [
                        { table: 'l456inm_users',  stateKey: 'l456InmUsers'  },
                        { table: 'l3inm_users',    stateKey: 'l3InmUsers'    },
                        { table: 'l3tsm_users',    stateKey: 'l3TsmUsers'    },
                        { table: 'hseq_users',     stateKey: 'hseqUsers'     },
                    ];
                    for (const sg of subGroups) {
                        try {
                            const { data: sgRows, error: sgErr } = await this.supabase
                                .from(sg.table)
                                .select('id, name, password, email')
                                .eq('tenant_id', this._tid());
                            if (sgErr) {
                                console.error(`❌ ${sg.table} load failed:`, sgErr.message);
                            } else if (sgRows && sgRows.length > 0) {
                                this.state[sg.stateKey] = sgRows.map(u => ({ id: u.id, name: u.name, password: u.password || u.id, email: u.email || '' }));
                                console.log(`✅ ${sg.table}: ${sgRows.length} rows loaded`);
                            } else {
                                console.log(`ℹ️ ${sg.table}: 0 rows for this tenant`);
                            }
                        } catch (sgEx) {
                            console.error(`❌ ${sg.table} load exception:`, sgEx.message);
                        }
                    }
                    this.saveState();
                    this.updateSystemStatus(`✅ ${this.state.employees.length} employees loaded`);
                    // ===== MAINTENANCE STAFF DATA (loaded from Supabase) =====
                    let allMaintStaff = [];
                    let maintFrom = 0;
                    let maintHasMore = true;
                    while (maintHasMore) {
                        const { data: maintBatch, error: maintError } = await this.supabase
                            .from('maintenance_employees')
                            .select('*')
                            .eq('tenant_id', this._tid())
                            .range(maintFrom, maintFrom + batchSize - 1);
                        if (maintError) {
                            console.warn('⚠️ Could not load maintenance_employees:', maintError.message);
                            maintHasMore = false;
                        } else if (maintBatch && maintBatch.length > 0) {
                            allMaintStaff = [...allMaintStaff, ...maintBatch];
                            maintHasMore = maintBatch.length === batchSize;
                            maintFrom += batchSize;
                        } else {
                            maintHasMore = false;
                        }
                    }
                    // Map Supabase columns → internal shape used throughout the app
                    app.state.maintenanceStaffUsers = allMaintStaff.map(u => ({
                        id:           String(u.id),
                        name:         u.name         || '',
                        department:   u.department   || '',
                        position:     u.position     || '',
                        role:         u.role         || '',
                        nationality:  u.nationality  || '',
                        gender:       u.gender       || '',
                        seniorityDate: u.seniority_date || '',
                        totalLeaveDays: u.total_leave_days ?? 25,
                        usedLeaveDays:  u.used_leave_days  ?? 0,
                    }));
                    // Default password = employee ID (same as before)
                    const maintPwds = {};
                    app.state.maintenanceStaffUsers.forEach(u => { maintPwds[u.id] = u.id; });
                    app.state.maintenanceStaffPasswords = maintPwds;
                    console.log(`✅ Maintenance staff loaded from Supabase: ${app.state.maintenanceStaffUsers.length} records`);
                    this.saveState();

                this.renderLoginForm();
                    this._updateLandingStats();
                    return true;
                    
                } catch (error) {
                    console.error('❌ Error loading from Supabase:', error);
                    this.updateSystemStatus('⚠️ Could not load from database');
                    return false;
                }
            };

            app.publishToSupabase = async function() {
                if (!this.supabase) {
                    alert('Supabase not connected');
                    return;
                }

                if (this.state.employees.length === 0) {
                    alert('⚠️ No employee data to save');
                    return;
                }

                if (!confirm(`Save all data to Supabase database?\n\n• ${this.state.employees.length} employees\n• ${this.state.bids.length} bids\n• System configuration`)) return;

                // Helper: split array into chunks
                const chunk = (arr, size) => {
                    const chunks = [];
                    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
                    return chunks;
                };

                try {
                    // ── 1. Save employees in batches of 500 ──
                    const empTotal = this.state.employees.length;
                    const empChunks = chunk(this.state.employees, 500);
                    this.updateSystemStatus(`Saving employees (0/${empTotal})...`);

                    for (let i = 0; i < empChunks.length; i++) {
                        const batch = empChunks[i].map(emp => ({
                            id: emp.id,
                            tenant_id: this._tid(),
                            name: emp.name,
                            seniority_date: emp.seniorityDate,
                            position: emp.position || '',
                            department: emp.department || '',
                            gender: emp.gender || '',
                            nationality: emp.nationality || '',
                            email: emp.email || '',
                            updated_at: new Date().toISOString()
                        }));

                        const { error } = await this.supabase
                            .from('employees')
                            .upsert(batch, { onConflict: 'id' });

                        if (error) throw new Error(`Employee batch ${i + 1} failed: ${error.message}`);

                        const saved = Math.min((i + 1) * 500, empTotal);
                        this.updateSystemStatus(`Saving employees (${saved}/${empTotal})...`);
                    }

                    // ── 2. Save system config (Ops/Maintenance) ──
                    this.updateSystemStatus('Saving system config...');
                    const { error: configError } = await this.supabase
                        .from('system_config_82')
                        .upsert({
                            id: 1,
                            tenant_id: this._tid(),
                            bidding_deadline: this.state.biddingDeadline,
                            bidding_year: this.state.biddingYear,
                            is_processed: this.state.isProcessed,
                            planner_password: this.state.plannerPassword,
                            planner_email:    this.state.plannerEmail,
                            slot_capacities:  this.state.slotCapacities,
                            maint_slot_capacities: this.state.maintSlotCapacities || {},
                            results: this.state.results,
                            last_updated: new Date().toISOString()
                            // on_call_dates intentionally omitted — stored in oncall_dates table
                        }, { onConflict: 'id' });

                    if (configError) console.warn('Config save warning:', configError.message);

                    // ── 2b. Save Corporate/GC system config to its own dedicated table ──
                    this.updateSystemStatus('Saving Corporate/GC config...');
                    const { error: configCorpError } = await this.supabase
                        .from('system_config')
                        .upsert({
                            id: 1,
                            tenant_id: this._tid(),
                            bidding_deadline: this.state.biddingDeadlineCorp,
                            bidding_year: this.state.biddingYearCorp,
                            is_processed: this.state.isProcessedCorp,
                            last_updated: new Date().toISOString()
                        }, { onConflict: 'id' });

                    if (configCorpError) console.warn('Corp config save warning:', configCorpError.message);

                    // ── 2b. Save on-call dates to dedicated table ──
                    this.updateSystemStatus('Saving on-call dates...');
                    await this.saveOnCallDatesToSupabase();

                    // ── 3. Save bids in batches of 500, routed to the correct table per bid ──
                    if (this.state.bids.length > 0) {
                        const bidTotal = this.state.bids.length;
                        this.updateSystemStatus(`Saving bids (0/${bidTotal})...`);

                        // Group bids by destination table (Ops / Maintenance / Corporate)
                        const bidsByTable = { leave_requests: [], maint_leave_requests: [], corporate_leave_request: [] };
                        this.state.bids.forEach(bid => {
                            const table = this._isMaintStaff(bid.employeeId, bid)
                                ? 'maint_leave_requests'
                                : this._isCorporateStaff(bid.employeeId, bid)
                                    ? 'corporate_leave_request'
                                    : 'leave_requests';
                            bidsByTable[table].push(bid);
                        });

                        let savedSoFar = 0;
                        for (const [table, bidsForTable] of Object.entries(bidsByTable)) {
                            if (bidsForTable.length === 0) continue;
                            const bidChunks = chunk(bidsForTable, 500);
                            for (let i = 0; i < bidChunks.length; i++) {
                                const batch = bidChunks[i].map(bid => ({
                                    tenant_id: this._tid(),
                                    employee_id: bid.employeeId,
                                    employee_name: bid.employeeName || '',
                                    department: bid.department || '',
                                    start_date: bid.startDate,
                                    end_date: bid.endDate,
                                    days_requested: bid.days,
                                    status: 'pending',
                                    slot_type: bid.slotType,
                                    created_at: bid.timestamp || new Date().toISOString()
                                }));

                                const { error } = await this.supabase
                                    .from(table)
                                    .upsert(batch, { onConflict: 'employee_id,slot_type,start_date' });

                                if (error) throw new Error(`Bid batch failed [${table}]: ${error.message}`);

                                savedSoFar += batch.length;
                                this.updateSystemStatus(`Saving bids (${savedSoFar}/${bidTotal})...`);
                            }
                        }
                    }

                    this.updateSystemStatus(`✅ Saved: ${empTotal} employees, ${this.state.bids.length} bids`);
                    alert(`✅ All data saved to Supabase!\n\n• ${empTotal} employees\n• ${this.state.bids.length} bids\n• System configuration\n• ${Object.keys(this.state.onCallDates || {}).length} on-call staff entries`);
                    setTimeout(() => this.updateSystemStatus('Ready'), 4000);

                } catch (error) {
                    console.error('❌ Error saving to Supabase:', error);
                    this.updateSystemStatus('❌ Save failed — check console');
                    alert(`❌ Save failed:\n${error.message}\n\nCheck browser console (F12) for details.`);
                }
            };

            app.syncWithSupabase = async function() {
                this.updateSystemStatus('Syncing with Supabase...');
                
                // First try to load from Supabase
                const loaded = await this.loadFromSupabase();
                
                if (!loaded) {
                    // If Supabase fails, try localStorage
                    const localLoaded = this.loadFromLocalStorage();
                    if (localLoaded) {
                        this.updateSystemStatus(`✅ ${this.state.employees.length} employees from local storage`);
                    } else {
                        this.updateSystemStatus('⚠️ No data found locally or in database');
                    }
                }
                
                this.renderLoginForm();
            };

            app.refreshBidsFromSupabase = async function(silent = false) {
                if (!this.supabase) {
                    if (!silent) alert('⚠️ Not connected to database.');
                    return false;
                }
                if (!silent) this.updateSystemStatus('Refreshing bids...');
                try {
                    // Helper: paginate-fetch all rows from a given table
                    const fetchAllFromTable = async (tableName) => {
                        let rows = [], from = 0;
                        const batchSize = 1000;
                        while (true) {
                            const { data: batch, error } = await this.supabase
                                .from(tableName)
                                .select('*')
                                .eq('tenant_id', this._tid())
                                .range(from, from + batchSize - 1);
                            if (error) { console.error(`❌ Bids fetch error [${tableName}]:`, error.message); break; }
                            if (!batch || batch.length === 0) break;
                            rows = [...rows, ...batch];
                            if (batch.length < batchSize) break;
                            from += batchSize;
                        }
                        return rows;
                    };

                    // Fetch regular, maintenance, AND corporate (GC/CS) bids in parallel
                    const [regularRows, maintRows, corporateRows] = await Promise.all([
                        fetchAllFromTable('leave_requests'),
                        fetchAllFromTable('maint_leave_requests'),
                        fetchAllFromTable('corporate_leave_request')
                    ]);

                    const allBids = [...regularRows, ...maintRows, ...corporateRows];
                    console.log(`✅ Fetched ${regularRows.length} regular + ${maintRows.length} maintenance + ${corporateRows.length} corporate bids from Supabase`);

                    this.state.bids = [
                        ...regularRows.map(b => this._mapRemoteBid(b, 'leave_requests')),
                        ...maintRows.map(b => this._mapRemoteBid(b, 'maint_leave_requests')),
                        ...corporateRows.map(b => this._mapRemoteBid(b, 'corporate_leave_request'))
                    ];

                    this.saveState();
                    this.updateSystemStatus(`✅ ${this.state.bids.length} bid${this.state.bids.length !== 1 ? 's' : ''} loaded`);

                    if (silent) {
                        // Silent auto-poll: update only the live elements without full re-render
                        this._liveUpdateAdminPanel();
                    } else {
                        this.renderAdminView();
                    }
                    return true;
                } catch (e) {
                    console.error('Refresh bids error:', e);
                    this.updateSystemStatus('⚠️ Refresh failed');
                    if (!silent) alert('Failed to refresh bids: ' + e.message);
                    return false;
                }
            };

            app.saveGCUsersToSupabase = async function() {
                // Syncs the full golden_command_users table with current state:
                // 1. Upsert every user in state (add new, update existing)
                // 2. Delete any rows in the table that are no longer in state
                if (!this.supabase) return;
                try {
                    const currentUsers = this.state.goldenCommandUsers || [];

                    // Step 1: Upsert all current users
                    if (currentUsers.length > 0) {
                        const { error: upsertError } = await this.supabase
                            .from('golden_command_users')
                            .upsert(
                                currentUsers.map(u => ({
                                    id: u.id,
                                    tenant_id: this._tid(),
                                    name: u.name,
                                    password: u.password,
                                    updated_at: new Date().toISOString()
                                })),
                                { onConflict: 'id' }
                            );
                        if (upsertError) throw upsertError;
                    }

                    // Step 2: Delete rows no longer in state
                    // Fetch all IDs currently in the table
                    const { data: tableRows, error: fetchError } = await this.supabase
                        .from('golden_command_users')
                        .select('id')
                        .eq('tenant_id', this._tid());
                    if (fetchError) throw fetchError;

                    const currentIds = currentUsers.map(u => u.id);
                    const toDelete = (tableRows || []).map(r => r.id).filter(id => !currentIds.includes(id));

                    if (toDelete.length > 0) {
                        const { error: deleteError } = await this.supabase
                            .from('golden_command_users')
                            .delete()
                            .in('id', toDelete);
                        if (deleteError) throw deleteError;
                    }

                    console.log(`✅ GC users synced to dedicated table (${currentUsers.length} users)`);
                } catch (e) {
                    console.warn('⚠️ GC users sync failed:', e.message);
                }
            };

            app.saveCorporateStaffUsersToSupabase = async function() {
                if (!this.supabase) return;
                try {
                    const currentUsers = this.state.corporateStaffUsers || [];
                    // Delete-then-insert (same reliable pattern as oncall_dates)
                    const { error: delError } = await this.supabase
                        .from('corporate_staff_employees')
                        .delete()
                        .eq('tenant_id', this._tid());
                    if (delError) throw delError;
                    if (currentUsers.length > 0) {
                        const { error: insError } = await this.supabase
                            .from('corporate_staff_employees')
                            .insert(currentUsers.map(u => ({
                                tenant_id:        this._tid(),
                                id:               u.id,
                                name:             u.name,
                                department:       u.department || 'Corporate Staff',
                                position:         u.position || '',
                                role:             u.role || '',
                                nationality:      u.nationality || '',
                                gender:           u.gender || '',
                                seniority_date:   u.seniorityDate || '2000-01-01',
                                total_leave_days: u.totalLeaveDays ?? 30,
                                used_leave_days:  u.usedLeaveDays ?? 0,
                                password:         u.password || u.id,
                                email:            u.email || '',
                            })));
                        if (insError) throw insError;
                    }
                    console.log(`✅ Corporate Staff roster saved (${currentUsers.length} records)`);
                } catch (e) {
                    console.warn('⚠️ Corporate Staff users save failed:', e.message);
                }
            };

            app.saveSubGroupUsersToSupabase = async function(groupKey) {
                if (!this.supabase) return;
                const allGroups = [
                    { key: 'l456inm', table: 'l456inm_users', stateKey: 'l456InmUsers' },
                    { key: 'l3inm',   table: 'l3inm_users',   stateKey: 'l3InmUsers'   },
                    { key: 'l3tsm',   table: 'l3tsm_users',   stateKey: 'l3TsmUsers'   },
                    { key: 'hseq',    table: 'hseq_users',    stateKey: 'hseqUsers'    },
                ];
                const toSave = groupKey
                    ? allGroups.filter(g => g.key === groupKey)
                    : allGroups;
                for (const sg of toSave) {
                    try {
                        const users = this.state[sg.stateKey] || [];
                        const { error: delError } = await this.supabase
                            .from(sg.table).delete().eq('tenant_id', this._tid());
                        if (delError) { console.error(`❌ ${sg.table} delete failed:`, delError.message); continue; }
                        if (users.length > 0) {
                            const { error: insError } = await this.supabase
                                .from(sg.table)
                                .upsert(
                                    users.map(u => ({
                                        id:        u.id,
                                        tenant_id: this._tid(),
                                        name:      u.name,
                                        password:  u.password || u.id,
                                    })),
                                    { onConflict: 'id', ignoreDuplicates: false }
                                );
                            if (insError) { console.error(`❌ ${sg.table} insert failed:`, insError.message); continue; }
                        }
                        console.log(`✅ ${sg.table} saved (${users.length} users)`);
                    } catch (e) {
                        console.error(`❌ ${sg.table} save exception:`, e.message);
                    }
                }
            };

            app.saveBidToSupabase = async function(bid) {
                if (!this.supabase) {
                    console.warn('⚠️ Supabase not initialised — bid saved locally only');
                    return false;
                }
                try {
                    // Route to the correct table based on the acting user's type:
                    // employee/planner -> leave_requests, maintenancestaff -> maint_leave_requests,
                    // goldencommand/corporatestaff -> corporate_leave_request
                    const table = this._bidTableForUserType(this.state.userType);

                    const row = {
                        tenant_id: this._tid(),
                        employee_id: bid.employeeId,
                        start_date: bid.startDate,
                        end_date: bid.endDate,
                        days_requested: bid.days,
                        status: 'pending',
                        slot_type: bid.slotType,
                        department: bid.department || '',
                        employee_name: bid.employeeName || '',
                        created_at: bid.timestamp || new Date().toISOString()
                    };

                    // Upsert: if a row with same employee_id + start_date already exists, update it.
                    // This avoids the race condition from delete-then-insert.
                    const { data, error: upsertError } = await this.supabase
                        .from(table)
                        .upsert(row, { onConflict: 'employee_id,start_date' })
                        .select();

                    if (upsertError) {
                        // Fallback: try plain insert if upsert fails (e.g. constraint not set up)
                        console.warn('⚠️ Upsert failed, trying insert:', upsertError.message);
                        const { error: insertError } = await this.supabase
                            .from(table)
                            .insert(row);
                        if (insertError) {
                            console.error('❌ Supabase bid insert error:', insertError.message);
                            return false;
                        }
                    }

                    console.log(`✅ Bid saved to Supabase [${table}]:`, data);
                    return true;
                } catch (e) {
                    console.error('❌ Supabase bid save exception:', e.message);
                    return false;
                }
            };

            app.saveConfigToSupabase = async function() {
                this.saveState(); // always write localStorage first
                if (!this.supabase) return;
                try {
                    const ejsPayload = {
                        ejs_service:   localStorage.getItem('ejs_service')       || this.state.ejsServiceId  || '',
                        ejs_template:  localStorage.getItem('ejs_template')      || this.state.ejsTemplateId || '',
                        ejs_pubkey:    localStorage.getItem('ejs_pubkey')        || this.state.ejsPublicKey  || '',
                        smtp_fallback_url: localStorage.getItem('smtp_fallback_url') || this.state.smtpFallbackUrl || '',
                        smtp_fallback_key: localStorage.getItem('smtp_fallback_key') || this.state.smtpFallbackKey || '',
                        planner_email: localStorage.getItem('ejs_planner_email') || this.state.plannerEmail  || '',
                        bidding_deadline: this.state.biddingDeadline,
                        bidding_year: this.state.biddingYear,
                        is_processed: this.state.isProcessed,
                        planner_password: this.state.plannerPassword,
                        slot_capacities: this.state.slotCapacities,
                        maint_slot_capacities: this.state.maintSlotCapacities || {},
                        maint_results: this.state.maintResults || [],
                        is_maint_processed: this.state.isMaintProcessed || false,
                        results: this.state.results,
                        last_updated: new Date().toISOString()
                    };
                    // Try UPDATE first (row already exists for this tenant)
                    const { error } = await this.supabase
                        .from('system_config_82')
                        .upsert(
                            { id: 1, tenant_id: this._tid(), ...ejsPayload },
                            { onConflict: 'id' }
                        );
                    if (error) {
                        console.error('❌ Could not save config to Supabase:', error.message);
                        this.updateSystemStatus('⚠️ Save failed — data saved locally only');
                        setTimeout(() => this.updateSystemStatus('Ready'), 5000);
                        this.showToast('Config save to server failed: ' + error.message + ' — your changes are only saved on this device until this is fixed.', 'error', 10000);
                    } else {
                        console.log('✅ Config (incl. on-call dates) saved to Supabase:', Object.keys(this.state.onCallDates || {}).length, 'staff entries');
                    }

                    // Corporate/GC settings save to their own dedicated table,
                    // fully isolated from Ops/Maintenance (system_config_82)
                    const { error: corpError } = await this.supabase
                        .from('system_config')
                        .upsert(
                            {
                                id: 1,
                                tenant_id: this._tid(),
                                bidding_deadline: this.state.biddingDeadlineCorp,
                                bidding_year: this.state.biddingYearCorp,
                                is_processed: this.state.isProcessedCorp,
                                last_updated: new Date().toISOString()
                            },
                            { onConflict: 'id' }
                        );
                    if (corpError) {
                        console.error('❌ Could not save Corporate/GC config to Supabase:', corpError.message);
                        this.showToast('Corporate/GC config save to server failed: ' + corpError.message, 'error', 10000);
                    } else {
                        console.log('✅ Corporate/GC config saved to system_config table');
                    }
                } catch (e) {
                    console.warn('⚠️ Supabase config save error:', e.message);
                    this.updateSystemStatus('⚠️ On-call save failed — data saved locally only');
                    setTimeout(() => this.updateSystemStatus('Ready'), 5000);
                    this.showToast('Config save to server failed: ' + e.message + ' — your changes are only saved on this device until this is fixed.', 'error', 10000);
                }
            };

            app.saveOnCallDatesToSupabase = async function() {
                this.saveState(); // always write localStorage first
                if (!this.supabase) return;
                try {
                    const onCallDates = this.state.onCallDates || {};
                    const rows = [];
                    for (const [empId, dates] of Object.entries(onCallDates)) {
                        for (const date of dates) {
                            const d = new Date(date + 'T00:00:00');
                            const jan1 = new Date(d.getFullYear(), 0, 1);
                            const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
                            rows.push({ tenant_id: this._tid(), employee_id: empId, date: date, week_number: weekNum, year: d.getFullYear() });
                        }
                    }
                    if (rows.length === 0) {
                        console.log('ℹ️ No on-call dates to save');
                        return;
                    }
                    // Delete only the employee_ids present in current state, then re-insert
                    // This prevents wiping groups that aren't loaded in this session
                    const empIds = [...new Set(rows.map(r => r.employee_id))];
                    for (let i = 0; i < empIds.length; i += 100) {
                        const batch = empIds.slice(i, i + 100);
                        const { error: delError } = await this.supabase
                            .from('oncall_dates')
                            .delete()
                            .eq('tenant_id', this._tid())
                            .in('employee_id', batch);
                        if (delError) {
                            console.error('❌ oncall_dates clear error:', delError.message);
                            this.updateSystemStatus('⚠️ On-call save failed — check console');
                            setTimeout(() => this.updateSystemStatus('Ready'), 5000);
                            return;
                        }
                    }
                    // Insert all rows in chunks of 500
                    const chunkSize = 500;
                    for (let i = 0; i < rows.length; i += chunkSize) {
                        const batch = rows.slice(i, i + chunkSize);
                        const { error } = await this.supabase
                            .from('oncall_dates')
                            .insert(batch);
                        if (error) {
                            console.error('❌ oncall_dates insert error:', error.message);
                            this.updateSystemStatus('⚠️ On-call save failed — check console');
                            setTimeout(() => this.updateSystemStatus('Ready'), 5000);
                            return;
                        }
                    }
                    console.log(`✅ Saved ${rows.length} on-call date rows to oncall_dates table`);
                    this.updateSystemStatus(`✅ On-call dates saved (${rows.length} rows)`);
                    setTimeout(() => this.updateSystemStatus('Ready'), 3000);
                } catch (e) {
                    console.error('❌ oncall_dates save exception:', e.message);
                    this.updateSystemStatus('⚠️ On-call save failed — data saved locally only');
                    setTimeout(() => this.updateSystemStatus('Ready'), 5000);
                }
            };

