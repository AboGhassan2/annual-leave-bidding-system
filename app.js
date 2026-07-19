        // SUPABASE_URL and SUPABASE_KEY moved to config.js (loaded before this file)

        // ==================== APP OBJECT ====================
        const app = {
            supabase: null,
            
            // ==================== STATE ====================
            state: {
                tenantId: '00000000-0000-0000-0000-000000000001',
                authUser: null,
                employees: [],
                employeePasswords: {},
                bids: [],
                biddingDeadline: '',
                biddingYear: 2026,
                isProcessed: false,
                isMaintProcessed: false,
                biddingDeadlineCorp: '',
                biddingYearCorp: 2026,
                isProcessedCorp: false,
                activeView: 'login',
                selectedEmployeeId: '',
                verifiedEmployee: null,
                currentUser: null,
                userType: null,
                plannerPassword: 'admin123',
                plannerEmail: 'a_abdulqader@outlook.com', // recovery email for OTP
                ejsServiceId: '',  // EmailJS — set once in Admin → Email Settings
                ejsTemplateId: '',
                ejsPublicKey: '',
                smtpFallbackUrl: '',   // SMTP fallback — HTTP relay endpoint (e.g. Supabase Edge Function) used when EmailJS fails
                smtpFallbackKey: '',   // optional bearer token / shared secret for the relay
                goldenCommandPassword: 'gc123',
                goldenCommandUsers: [
                    { id: 'GC001', name: 'Golden Command 1', password: 'GC001' },
                    { id: 'GC002', name: 'Golden Command 2', password: 'GC002' }
                ],
                corporateStaffUsers: [],
                maintenanceStaffUsers: [],
                maintenanceStaffPasswords: {},
                l456InmUsers: [],
                l3InmUsers: [],
                l3TsmUsers: [],
                hseqUsers: [],
                results: [],
                maintResults: [],

                // On-Call dates per employee (extracted from Director_On-Call.xlsx)
                // Keyed by Employee ID → array of 'YYYY-MM-DD' strings (loaded from Supabase)
                onCallDates: {},
                selectedDepartment: 'all',
                slotCapacities: {},
                maintSlotCapacities: {},
                
                // OPS-only departments list (L3/L46/L5 groups — maintenance positions are separate)
                departments: [
                    'L3-DEP-DC', 'L3-DEP-TC', 'L3-DEP-DM', 'L3-DEP- LTSS/TSS',
                    'L3-DEP-EFC', 'L3-DEP-GSM', 'L3-TA-T', 'L3-DS', 'L3-P&R',
                    'L3-LSS/SS', 'L3-DEP-SC', 'L3-SA', 'L3 SAMB',
                    'L46-DEP-TC', 'L46-DEP- LTSS/TSS', 'L46-TA-T', 'L46-DEP-DC',
                    'L46-LSS/SS', 'L46-DEP-GSM', 'L46-DEP-SC', 'L46 SAMB',
                    'L46-P&R', 'L46-AOCC',
                    'L5-LSS/SS', 'L5-DEP-DC', 'L5-DEP-DM', 'L5-DEP-GSM', 'L5-DEP-SC',
                    'L5-DEP- LTSS/TSS', 'L5-DEP-TC', 'L5-DEP-EFC', 'L5 SA', 'L5 SAMB',
                    'L5 - TA-T',
                    'L3465-DEP-TCC'
                ],
                
                slotTypes: [
                    { id: 'slotA', name: 'Slot A', days: 15, color: 'green' },
                    { id: 'slotB', name: 'Slot B', days: 15, color: 'blue' },
                    { id: 'slotC', name: 'Slot C', days: 15, color: 'purple' },
                    { id: 'slotD', name: 'Slot D', days: 20, color: 'orange' }
                ],
                
                months: [
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                ],
                loginType: 'employee',

                // Security: auto-logout after this many minutes of user inactivity
                sessionTimeoutMinutes: 15
            },

            // Idle/session-timeout tracking (not part of reactive state; internal bookkeeping only)
            _lastActivityTs: Date.now(),
            _idleCheckInterval: null,

            // ==================== SUPABASE FUNCTIONS ====================
            // initSupabase moved to api-supabase.js (loaded after this file)

            // _applyAuthSession moved to api-supabase.js (loaded after this file)

            _tid() {
                return this.state.tenantId || '00000000-0000-0000-0000-000000000001';
            },

            // loadFromSupabase moved to api-supabase.js (loaded after this file)

            // _escHtml and showToast moved to utils.js (loaded after this file)

            // publishToSupabase moved to api-supabase.js (loaded after this file)

            // syncWithSupabase moved to api-supabase.js (loaded after this file)

            // ==================== UTILITY FUNCTIONS ====================
            saveState() {
                try {
                    localStorage.setItem('employees', JSON.stringify(this.state.employees));
                    localStorage.setItem('employeePasswords', JSON.stringify(this.state.employeePasswords));
                    localStorage.setItem('bids', JSON.stringify(this.state.bids));
                    localStorage.setItem('biddingDeadline', this.state.biddingDeadline);
                    localStorage.setItem('biddingYear', this.state.biddingYear.toString());
                    localStorage.setItem('isProcessed', JSON.stringify(this.state.isProcessed));
                    localStorage.setItem('biddingDeadlineCorp', this.state.biddingDeadlineCorp);
                    localStorage.setItem('biddingYearCorp', this.state.biddingYearCorp.toString());
                    localStorage.setItem('isProcessedCorp', JSON.stringify(this.state.isProcessedCorp));
                    localStorage.setItem('plannerPassword', this.state.plannerPassword);
                    localStorage.setItem('plannerEmail',    this.state.plannerEmail || 'a_abdulqader@outlook.com');
                    localStorage.setItem('results', JSON.stringify(this.state.results));
                    localStorage.setItem('slotCapacities', JSON.stringify(this.state.slotCapacities));
                    localStorage.setItem('maintSlotCapacities', JSON.stringify(this.state.maintSlotCapacities || {}));
                    localStorage.setItem('goldenCommandUsers', JSON.stringify(this.state.goldenCommandUsers || []));
                    localStorage.setItem('corporateStaffUsers', JSON.stringify(this.state.corporateStaffUsers || []));
                    localStorage.setItem('maintenanceStaffUsers', JSON.stringify(this.state.maintenanceStaffUsers || []));
                    localStorage.setItem('maintenanceStaffPasswords', JSON.stringify(this.state.maintenanceStaffPasswords || {}));
                    localStorage.setItem('l456InmUsers', JSON.stringify(this.state.l456InmUsers || []));
                    localStorage.setItem('l3InmUsers', JSON.stringify(this.state.l3InmUsers || []));
                    localStorage.setItem('l3TsmUsers', JSON.stringify(this.state.l3TsmUsers || []));
                    localStorage.setItem('hseqUsers', JSON.stringify(this.state.hseqUsers || []));
                    localStorage.setItem('onCallDates', JSON.stringify(this.state.onCallDates || {}));
                } catch (e) {
                    console.error('Error saving state:', e);
                }
            },

            loadFromLocalStorage() {
                try {
                    const saved = localStorage.getItem('employees');
                    if (saved) {
                        this.state.employees = JSON.parse(saved);
                        this.state.employeePasswords = JSON.parse(localStorage.getItem('employeePasswords') || '{}');
                        this.state.bids = JSON.parse(localStorage.getItem('bids') || '[]');
                        this.state.biddingDeadline = localStorage.getItem('biddingDeadline') || '';
                        this.state.biddingYear = parseInt(localStorage.getItem('biddingYear')) || 2026;
                        this.state.isProcessed = JSON.parse(localStorage.getItem('isProcessed') || 'false');
                        this.state.biddingDeadlineCorp = localStorage.getItem('biddingDeadlineCorp') || '';
                        this.state.biddingYearCorp = parseInt(localStorage.getItem('biddingYearCorp')) || 2026;
                        this.state.isProcessedCorp = JSON.parse(localStorage.getItem('isProcessedCorp') || 'false');
                        this.state.plannerPassword = localStorage.getItem('plannerPassword') || 'admin123';
                        if (!this.state.plannerPassword) this.state.plannerPassword = 'admin123';
                        this.state.plannerEmail    = localStorage.getItem('plannerEmail')    || 'a_abdulqader@outlook.com';
                        this.state.results = JSON.parse(localStorage.getItem('results') || '[]');
                        this.state.slotCapacities = JSON.parse(localStorage.getItem('slotCapacities') || '{}');
                        this.state.maintSlotCapacities = JSON.parse(localStorage.getItem('maintSlotCapacities') || '{}');
                        this.state.goldenCommandUsers = JSON.parse(localStorage.getItem('goldenCommandUsers') || '[]');
                        this.state.corporateStaffUsers = JSON.parse(localStorage.getItem('corporateStaffUsers') || '[]');
                        this.state.maintenanceStaffUsers = JSON.parse(localStorage.getItem('maintenanceStaffUsers') || '[]');
                        this.state.maintenanceStaffPasswords = JSON.parse(localStorage.getItem('maintenanceStaffPasswords') || '{}');
                        this.state.l456InmUsers = JSON.parse(localStorage.getItem('l456InmUsers') || '[]');
                        this.state.l3InmUsers = JSON.parse(localStorage.getItem('l3InmUsers') || '[]');
                        this.state.l3TsmUsers = JSON.parse(localStorage.getItem('l3TsmUsers') || '[]');
                        this.state.hseqUsers  = JSON.parse(localStorage.getItem('hseqUsers')  || '[]');
                        this.state.onCallDates = JSON.parse(localStorage.getItem('onCallDates') || '{}');
                        return true;
                    }
                } catch (e) {
                    console.error('Error loading from localStorage:', e);
                }
                return false;
            },

            updateSystemStatus(message) {
                const el = document.getElementById('systemStatus');
                if (el) el.textContent = message;
            },

            // ==================== VIEW FUNCTIONS ====================
            // setLoginType moved to views-auth.js (loaded after this file)

            // renderLoginForm moved to views-auth.js (loaded after this file)

            // handleLogin moved to views-auth.js (loaded after this file)

            // Watches for user activity and auto-logs-out after `sessionTimeoutMinutes`
            // of inactivity (security requirement). Safe to call once at init().
            // startIdleWatcher moved to views-auth.js (loaded after this file)

            // Force-closes every modal overlay in the app, regardless of which one is
            // open or how it toggles (inline style="display:none" vs a CSS "open" class).
            // Called on every logout path so a stale modal (e.g. Preview Allocation left
            // open by the admin) never lingers on screen after the session has ended —
            // this was the bug where the idle timeout signed the user out but the modal
            // stayed visible on top of the login screen.
            // _closeAllModals moved to views-auth.js (loaded after this file)

            // handleLogout moved to views-auth.js (loaded after this file)

            // Keeps --topbar-h in sync with the real header height so the fixed
            // header never leaves a gap or overlaps the content below it.
            _syncHeaderOffset() {
                const topbar = document.getElementById('userInfo');
                if (!topbar) return;
                const isHidden = topbar.classList.contains('hidden') || getComputedStyle(topbar).display === 'none';
                const h = isHidden ? 0 : topbar.offsetHeight;
                document.documentElement.style.setProperty('--topbar-h', h + 'px');
            },

            // sendEmailWithFallback() has moved to api-email.js (EmailJS + SMTP fallback).

            // ==================== LIGHT/DARK THEME (login page) ====================
            toggleTheme() {
                const isLight = document.body.classList.toggle('light-theme');
                localStorage.setItem('lp_theme', isLight ? 'light' : 'dark');
                const btn = document.getElementById('lpThemeBtn');
                if (btn) btn.textContent = isLight ? '☀️' : '🌙';
            },

            applySavedTheme() {
                const isLight = localStorage.getItem('lp_theme') === 'light';
                document.body.classList.toggle('light-theme', isLight);
                const btn = document.getElementById('lpThemeBtn');
                if (btn) btn.textContent = isLight ? '☀️' : '🌙';
            },

            setActiveView(view) {
                console.log('Setting view to:', view);
                // Stop any existing admin polling when navigating away
                if (view !== 'admin') this._stopAdminLive();
                // Stop Leave Dashboard realtime when navigating away
                if (view !== 'leaveDashboard') this.stopLcRealtime();
                this.state.activeView = view;
                this._syncNavHighlight(view);
                // Reset scroll to top so the new view's content isn't hidden above
                // the sticky header (which otherwise stays anchored mid-scroll).
                window.scrollTo(0, 0);
                // Auto-refresh bids from Supabase when planner opens Admin Panel
                if (view === 'admin' && this.state.userType === 'planner' && this.supabase) {
                    this.refreshBidsFromSupabase(false).then(() => this._startAdminLive());
                } else {
                    this.renderView();
                }
            },

            // Mobile slide-out sidebar control
            toggleMobileSidebar(force) {
                const sb = document.getElementById('plannerSidebar');
                const bd = document.getElementById('sidebarBackdrop');
                if (!sb || !bd) return;
                const open = typeof force === 'boolean' ? force : !sb.classList.contains('mobile-open');
                sb.classList.toggle('mobile-open', open);
                bd.classList.toggle('show', open);
            },

            // Highlights the active item in both the top tab bar and the planner sidebar
            _syncNavHighlight(view) {
                document.querySelectorAll('[data-nav]').forEach(el => {
                    el.classList.toggle('metro-tab-active', el.dataset.nav === view);
                });
                document.querySelectorAll('[data-snav]').forEach(el => {
                    el.classList.toggle('sb-active', el.dataset.snav === view);
                });
                // Auto-expand whichever sidebar group contains the active view
                const activeItem = document.querySelector(`.app-sidebar [data-snav="${view}"]`);
                const group = activeItem ? activeItem.closest('.sb-group') : null;
                if (group) group.open = true;
                // On mobile, close the slide-out sidebar after navigating
                if (window.innerWidth <= 1000) this.toggleMobileSidebar(false);
            },

            // Keeps the header notification bell and sidebar deadline card in sync,
            // regardless of which view is currently open. Safe to call for any role.
            _updateGlobalChrome() {
                if (this.state.userType !== 'planner') return;
                const box = document.getElementById('sidebarDeadlineBox');
                if (box) {
                    let inner = '<p style="margin:0;font-size:0.78rem;color:#9ca3af;">No deadline set</p>';
                    if (this.state.biddingDeadline) {
                        const dl = new Date(this.state.biddingDeadline);
                        const diff = dl - new Date();
                        if (diff <= 0) {
                            inner = '<p style="margin:0;color:#ef4444;font-weight:700;font-size:0.95rem;">⛔ Deadline Passed</p>';
                        } else {
                            const d = Math.floor(diff/86400000), h = Math.floor((diff%86400000)/3600000), m = Math.floor((diff%3600000)/60000);
                            const color = diff < 86400000 ? '#ef4444' : diff < 259200000 ? '#f59e0b' : '#10b981';
                            inner = `<p style="margin:0;font-size:1.1rem;font-weight:700;color:${color};">${d}d ${h}h ${m}m</p>
                                <p style="font-size:0.7rem;color:#9ca3af;margin:3px 0 0;">${dl.toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>`;
                        }
                    }
                    box.innerHTML = `<div class="app-sidebar-deadline-label">⏰ Bidding Deadline</div>${inner}`;
                }
            },

            renderView() {
                const content = document.getElementById('contentArea');
                if (!content) return;
                
                content.innerHTML = '';
                this._updateGlobalChrome();
                this._syncNavHighlight(this.state.activeView);
                // Always land at the top of the page for the freshly rendered view —
                // covers navigation, login, logout, and any other direct renderView() call.
                window.scrollTo(0, 0);
                requestAnimationFrame(() => this._syncHeaderOffset());

                // Show/hide results ready badge
                const userId = this.state.verifiedEmployee?.id;
                const hasMyResults = userId && this.state.isProcessed && this.state.results.some(r => r.employeeId === userId);
                ['resultsReadyBadge', 'gcResultsReadyBadge', 'csResultsReadyBadge'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.classList.toggle('hidden', !hasMyResults);
                });
                
                switch(this.state.activeView) {
                    case 'dashboard':
                        this.renderDashboardView();
                        break;
                    case 'upload':
                        this.renderUploadView();
                        break;
                    case 'configureSlots':
                        this.renderConfigureSlotsView();
                        break;
                    case 'seniorityReport':
                        this.renderSeniorityReportView();
                        break;
                    case 'configureMaintSlots':
                        this.renderConfigureMaintSlotsView();
                        break;
                    case 'admin':
                        this.renderAdminView();
                        break;
                    case 'employee':
                        this.renderEmployeeBiddingView();
                        break;
                    case 'myResults':
                        this.renderMyResultsView();
                        break;
                    case 'results':
                        this.renderResultsView();
                        break;
                    case 'manualOverride':
                        this.renderManualOverrideView();
                        break;
                    case 'maintManualOverride':
                        this.renderMaintManualOverrideView();
                        break;
                    case 'auditLog':
                        this.renderAuditLogView();
                        break;
                    case 'changePassword':
                        this.renderChangePasswordView();
                        break;
                    case 'changePlannerPassword':
                        this.renderChangePlannerPasswordView();
                        break;
                    case 'emailSettings':
                        this.renderEmailSettingsView();
                        break;
                    case 'manageOnCall':
                        this.renderManageOnCallView();
                        break;
                    case 'manageUsers':
                        this.renderManageUsersView();
                        break;
                    case 'goldenCommand':
                        this.renderGoldenCommandBiddingView();
                        break;
                    case 'corporateStaff':
                        this.renderCorporateStaffBiddingView();
                        break;
                    case 'leaveDashboard':
                        this.renderLeaveDashboardView();
                        break;
                    case 'hrCorpDashboard':
                        this.renderHrCorpDashboardView();
                        break;
                }
                
                this.saveState();
            },

            // ==================== VIEW RENDERING ====================
            async renderUploadView() {
                const content = document.getElementById('contentArea');
                content.innerHTML = `
                    <div class="max-w-4xl mx-auto">
                        <div class="bg-white rounded-xl shadow-xl p-8 mb-6">
                            <div class="mb-6 p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                                <label class="block font-semibold mb-2 text-lg">Select Bidding Year:</label>
                                <select
                                    id="biddingYearSelect"
                                    class="w-full px-4 py-3 border-2 border-purple-300 rounded-lg text-lg font-semibold"
                                    ${this.state.isProcessed ? 'disabled' : ''}
                                >
                                    ${[2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map(year => `
                                        <option value="${year}" ${year === this.state.biddingYear ? 'selected' : ''}>${year}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="bg-white rounded-xl shadow-xl p-8">
                            <h2 class="text-2xl font-bold mb-4">Upload Employee Data</h2>
                            <p class="text-gray-600 mb-6">
                                Upload an Excel file with employee information. The file should have columns like:
                                "Personnel number", "Name", "Seniority Date", "Department" (Position), "Scheduling row" (L-code), etc.
                            </p>
                            
                            <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4">
                                <p class="mb-4 text-gray-600">
                                    Drag and drop your Excel file here or click to browse
                                </p>
                                <label class="cursor-pointer">
                                    <input
                                        type="file"
                                        id="excelFile"
                                        accept=".xlsx,.xls"
                                        class="hidden"
                                        onchange="app.handleFileUpload(event)"
                                    />
                                    <span class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 inline-block">
                                        📁 Browse Files
                                    </span>
                                </label>
                            </div>

                            ${this.state.employees.length > 0 ? `
                                <div class="mt-6">
                                    <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                                        <span class="text-green-800 font-semibold">
                                            ✓ ${this.state.employees.length} employees loaded for ${this.state.biddingYear}
                                        </span>
                                        <div class="text-xs text-green-600 mt-1">
                                            Positions found: ${[...new Set(this.state.employees.map(e => e.position || e.department || 'Unassigned'))].join(', ')}
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>

                        <!-- Golden Command User Management -->
                        <div class="bg-white rounded-xl shadow-xl p-8 mt-6">
                            <div class="flex items-center gap-3 mb-1">
                                <span class="text-2xl">⭐</span>
                                <h2 class="text-2xl font-bold text-yellow-800">Golden Command Users</h2>
                            </div>
                            <p class="text-sm text-gray-500 mb-6">Manage Golden Command accounts. Their default password is their GC ID. Changes are saved directly to Supabase.</p>
                            <div class="space-y-2 mb-6" id="gcUserList">
                                ${(this.state.goldenCommandUsers || []).map((u, i) => `
                                    <div class="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                        <div class="flex items-center gap-3 flex-wrap">
                                            <span class="font-semibold text-yellow-900">⭐ ${u.name}</span>
                                            <span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-mono border border-yellow-300">ID: ${u.id}</span>
                                            <span class="text-xs text-gray-400">Password: ${u.password || u.id}</span>
                                        </div>
                                        <button onclick="app.removeGCUser(${i})" class="px-3 py-1.5 text-sm rounded-lg font-semibold" style="background:#fee2e2; color:#b91c1c;">✕ Remove</button>
                                    </div>
                                `).join('')}
                                ${(this.state.goldenCommandUsers || []).length === 0 ? `<p class="text-sm text-yellow-600 italic py-2">No Golden Command users yet. Add one below.</p>` : ''}
                            </div>
                            <div class="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-5">
                                <p class="font-semibold text-yellow-800 mb-3">➕ Add New GC User</p>
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">GC ID (username)</label>
                                        <input type="text" id="newGCId" placeholder="e.g. GC001" class="w-full px-3 py-2 border-2 border-yellow-300 rounded-lg text-sm focus:border-yellow-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Full Name</label>
                                        <input type="text" id="newGCName" placeholder="e.g. John Smith" class="w-full px-3 py-2 border-2 border-yellow-300 rounded-lg text-sm focus:border-yellow-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Password (optional)</label>
                                        <input type="text" id="newGCPassword" placeholder="Leave blank = same as ID" class="w-full px-3 py-2 border-2 border-yellow-300 rounded-lg text-sm focus:border-yellow-500 focus:outline-none" />
                                    </div>
                                </div>
                                <button onclick="app.addGCUser()" class="px-6 py-2.5 rounded-lg font-bold text-sm transition" style="background:#facc15; color:#713f12;">
                                    ⭐ Add Golden Command User
                                </button>
                            </div>
                        </div>

                        <!-- Corporate Staff User Management -->
                        <div class="bg-white rounded-xl shadow-xl p-8 mt-6">
                            <div class="flex items-center gap-3 mb-1">
                                <span class="text-2xl">🏢</span>
                                <h2 class="text-2xl font-bold text-blue-800">Corporate Staff Users</h2>
                            </div>
                            <p class="text-sm text-gray-500 mb-6">Manage Corporate Staff accounts. Their default password is their Staff ID. Changes are saved directly to Supabase.</p>
                            <div class="space-y-2 mb-6" id="csUserList">
                                ${(this.state.corporateStaffUsers || []).map((u, i) => `
                                    <div class="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <div class="flex items-center gap-3 flex-wrap">
                                            <span class="font-semibold text-blue-900">🏢 ${u.name}</span>
                                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono border border-blue-300">ID: ${u.id}</span>
                                            ${u.department && !['Corporate Staff', 'Human Resource', 'Human Resources'].includes(u.department) ? `<span class="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">${u.department}</span>` : ''}
                                            ${u.position ? `<span class="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">${u.position}</span>` : ''}
                                            <span class="text-xs text-gray-400">Password: ${u.password || u.id}</span>
                                        </div>
                                        <button onclick="app.removeCSUser(${i})" class="px-3 py-1.5 text-sm rounded-lg font-semibold" style="background:#fee2e2; color:#b91c1c;">✕ Remove</button>
                                    </div>
                                `).join('')}
                                ${(this.state.corporateStaffUsers || []).length === 0 ? `<p class="text-sm text-blue-600 italic py-2">No Corporate Staff users yet. Add one below.</p>` : ''}
                            </div>
                            <div class="bg-blue-50 border-2 border-blue-300 rounded-xl p-5">
                                <p class="font-semibold text-blue-800 mb-3">➕ Add New Corporate Staff User</p>
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Staff ID (username)</label>
                                        <input type="text" id="newCSId" placeholder="e.g. CS001" class="w-full px-3 py-2 border-2 border-blue-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Full Name</label>
                                        <input type="text" id="newCSName" placeholder="e.g. Jane Doe" class="w-full px-3 py-2 border-2 border-blue-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Password (optional)</label>
                                        <input type="text" id="newCSPassword" placeholder="Leave blank = same as ID" class="w-full px-3 py-2 border-2 border-blue-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
                                    </div>
                                </div>
                                <button onclick="app.addCSUser()" class="px-6 py-2.5 rounded-lg font-bold text-sm transition" style="background:#3b82f6; color:#ffffff;">
                                    🏢 Add Corporate Staff User
                                </button>
                            </div>
                        </div>

                        <!-- L456 INM User Management -->
                        <div class="bg-white rounded-xl shadow-xl p-8 mt-6">
                            <div class="flex items-center gap-3 mb-1">
                                <span class="text-2xl">📋</span>
                                <h2 class="text-2xl font-bold text-orange-800">L456 INM Users</h2>
                            </div>
                            <p class="text-sm text-gray-500 mb-6">Manage L456 INM department accounts for On-Call scheduling.</p>
                            <div class="space-y-2 mb-6" id="l456InmUserList">
                                ${(this.state.l456InmUsers || []).map((u, i) => `
                                    <div class="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg p-3">
                                        <div class="flex items-center gap-3 flex-wrap">
                                            <span class="font-semibold text-orange-900">📋 ${u.name}</span>
                                            <span class="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded font-mono border border-orange-300">ID: ${u.id}</span>
                                        </div>
                                        <button onclick="app.removeL456InmUser(${i})" class="px-3 py-1.5 text-sm rounded-lg font-semibold" style="background:#fee2e2; color:#b91c1c;">✕ Remove</button>
                                    </div>
                                `).join('')}
                                ${(this.state.l456InmUsers || []).length === 0 ? `<p class="text-sm text-orange-600 italic py-2">No L456 INM users yet. Add one below.</p>` : ''}
                            </div>
                            <div class="bg-orange-50 border-2 border-orange-300 rounded-xl p-5">
                                <p class="font-semibold text-orange-800 mb-3">➕ Add New L456 INM User</p>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                    <div><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Staff ID</label>
                                        <input type="text" id="newL456InmId" placeholder="e.g. L456-001" class="w-full px-3 py-2 border-2 border-orange-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none" /></div>
                                    <div><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Full Name</label>
                                        <input type="text" id="newL456InmName" placeholder="e.g. John Smith" class="w-full px-3 py-2 border-2 border-orange-300 rounded-lg text-sm focus:border-orange-500 focus:outline-none" /></div>
                                </div>
                                <button onclick="app.addL456InmUser()" class="px-6 py-2.5 rounded-lg font-bold text-sm transition" style="background:#f97316; color:#ffffff;">📋 Add L456 INM User</button>
                            </div>
                        </div>

                        <!-- L3 INM User Management -->
                        <div class="bg-white rounded-xl shadow-xl p-8 mt-6">
                            <div class="flex items-center gap-3 mb-1">
                                <span class="text-2xl">📋</span>
                                <h2 class="text-2xl font-bold text-purple-800">L3 INM Users</h2>
                            </div>
                            <p class="text-sm text-gray-500 mb-6">Manage L3 INM department accounts for On-Call scheduling.</p>
                            <div class="space-y-2 mb-6" id="l3InmUserList">
                                ${(this.state.l3InmUsers || []).map((u, i) => `
                                    <div class="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg p-3">
                                        <div class="flex items-center gap-3 flex-wrap">
                                            <span class="font-semibold text-purple-900">📋 ${u.name}</span>
                                            <span class="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded font-mono border border-purple-300">ID: ${u.id}</span>
                                        </div>
                                        <button onclick="app.removeL3InmUser(${i})" class="px-3 py-1.5 text-sm rounded-lg font-semibold" style="background:#fee2e2; color:#b91c1c;">✕ Remove</button>
                                    </div>
                                `).join('')}
                                ${(this.state.l3InmUsers || []).length === 0 ? `<p class="text-sm text-purple-600 italic py-2">No L3 INM users yet. Add one below.</p>` : ''}
                            </div>
                            <div class="bg-purple-50 border-2 border-purple-300 rounded-xl p-5">
                                <p class="font-semibold text-purple-800 mb-3">➕ Add New L3 INM User</p>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                    <div><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Staff ID</label>
                                        <input type="text" id="newL3InmId" placeholder="e.g. L3INM-001" class="w-full px-3 py-2 border-2 border-purple-300 rounded-lg text-sm focus:border-purple-500 focus:outline-none" /></div>
                                    <div><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Full Name</label>
                                        <input type="text" id="newL3InmName" placeholder="e.g. Jane Doe" class="w-full px-3 py-2 border-2 border-purple-300 rounded-lg text-sm focus:border-purple-500 focus:outline-none" /></div>
                                </div>
                                <button onclick="app.addL3InmUser()" class="px-6 py-2.5 rounded-lg font-bold text-sm transition" style="background:#a855f7; color:#ffffff;">📋 Add L3 INM User</button>
                            </div>
                        </div>

                        <!-- L3 TSM User Management -->
                        <div class="bg-white rounded-xl shadow-xl p-8 mt-6">
                            <div class="flex items-center gap-3 mb-1">
                                <span class="text-2xl">📋</span>
                                <h2 class="text-2xl font-bold text-teal-800">L3 TSM Users</h2>
                            </div>
                            <p class="text-sm text-gray-500 mb-6">Manage L3 TSM department accounts for On-Call scheduling.</p>
                            <div class="space-y-2 mb-6" id="l3TsmUserList">
                                ${(this.state.l3TsmUsers || []).map((u, i) => `
                                    <div class="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-lg p-3">
                                        <div class="flex items-center gap-3 flex-wrap">
                                            <span class="font-semibold text-teal-900">📋 ${u.name}</span>
                                            <span class="text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded font-mono border border-teal-300">ID: ${u.id}</span>
                                        </div>
                                        <button onclick="app.removeL3TsmUser(${i})" class="px-3 py-1.5 text-sm rounded-lg font-semibold" style="background:#fee2e2; color:#b91c1c;">✕ Remove</button>
                                    </div>
                                `).join('')}
                                ${(this.state.l3TsmUsers || []).length === 0 ? `<p class="text-sm text-teal-600 italic py-2">No L3 TSM users yet. Add one below.</p>` : ''}
                            </div>
                            <div class="bg-teal-50 border-2 border-teal-300 rounded-xl p-5">
                                <p class="font-semibold text-teal-800 mb-3">➕ Add New L3 TSM User</p>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                    <div><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Staff ID</label>
                                        <input type="text" id="newL3TsmId" placeholder="e.g. L3TSM-001" class="w-full px-3 py-2 border-2 border-teal-300 rounded-lg text-sm focus:border-teal-500 focus:outline-none" /></div>
                                    <div><label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Full Name</label>
                                        <input type="text" id="newL3TsmName" placeholder="e.g. Alex Johnson" class="w-full px-3 py-2 border-2 border-teal-300 rounded-lg text-sm focus:border-teal-500 focus:outline-none" /></div>
                                </div>
                                <button onclick="app.addL3TsmUser()" class="px-6 py-2.5 bg-teal-500 text-white rounded-lg font-bold hover:bg-teal-600 text-sm transition">📋 Add L3 TSM User</button>
                            </div>
                        </div>
                    </div>
                `;
                
                // Add year select listener
                const yearSelect = document.getElementById('biddingYearSelect');
                if (yearSelect) {
                    yearSelect.addEventListener('change', async (e) => {
                        const newYear = parseInt(e.target.value);
                        if (newYear === this.state.biddingYear) return;
                        if (this.state.bids.length > 0) {
                            if (!confirm(`Changing the year will clear ${this.state.bids.length} existing bids for ${this.state.biddingYear}. Continue?`)) {
                                e.target.value = this.state.biddingYear; // revert dropdown
                                return;
                            }
                            this.state.bids = [];
                        }
                        this.state.biddingYear = newYear;
                        this.state.slotCapacities = {}; // clear slot config for new year
                        await this.saveConfigToSupabase();
                        this.renderUploadView();
                    });
                }
            },

            handleFileUpload(event) {
                const file = event.target.files[0];
                if (!file) return;

                if (!file.name.match(/\.(xlsx|xls)$/)) {
                    alert('Please upload a valid Excel file (.xlsx or .xls)');
                    return;
                }

                if (this.state.employees.length > 0) {
                    const ok = confirm(
                        `⚠️ This will replace all ${this.state.employees.length} existing employee records and clear their passwords.\n\nAre you sure you want to continue?`
                    );
                    if (!ok) { event.target.value = ''; return; }
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: '' });
                        
                        console.log('Excel data loaded:', jsonData.length, 'rows');
                        
                        // Process data - more robust parsing
                        const employees = jsonData.map((row, idx) => {
                            // Find ID from common column names
                            let id = '';
                            const idColumns = ['Personnel number', 'Personnel Number', 'Personnel_number', 
                                              'Personnelnumber', 'ID', 'id', 'EmployeeID', 'Employee ID', 
                                              'Employee No', 'Employee Number'];
                            
                            for (const col of idColumns) {
                                if (row[col] !== undefined && row[col] !== '') {
                                    id = String(row[col]).trim();
                                    break;
                                }
                            }
                            
                            // Find name from common column names
                            let name = '';
                            const nameColumns = ['Name', 'Employee Name', 'Full Name', 
                                                'FORENAME SURNAME', 'Forename Surname'];
                            
                            for (const col of nameColumns) {
                                if (row[col] !== undefined && row[col] !== '') {
                                    name = String(row[col]).trim();
                                    break;
                                }
                            }
                            
                            // If name not found, try forename + surname
                            if (!name) {
                                const forename = row['Forename'] || row['FORENAME'] || '';
                                const surname = row['Surname'] || row['SURNAME'] || '';
                                name = `${forename} ${surname}`.trim();
                            }
                            
                            // Read position (display name, e.g. 'Depot Controller') from Department column
                            let position = '';
                            const positionColumns = ['Department', 'DEPARTMENT', 'Position', 'Job Title', 'Role'];
                            for (const col of positionColumns) {
                                if (row[col] !== undefined && row[col] !== '') {
                                    position = String(row[col]).trim().split('.')[0].trim();
                                    break;
                                }
                            }

                            // Read department (L-code, e.g. 'L3-DEP-DC') from Scheduling row column
                            let department = '';
                            const deptColumns = [
                                'Scheduling row', 'Scheduling_row', 'SchedulingRow',
                                'Org. Unit', 'Org Unit', 'OrgUnit'
                            ];
                            for (const col of deptColumns) {
                                if (row[col] !== undefined && row[col] !== '') {
                                    const raw = String(row[col]).trim().split('.')[0].trim();
                                    if (/^(L3|L46|L5|L3465)[-\s]/i.test(raw) || /^(L3-SA|L5 SA|L3 SAMB|L5 SAMB|L46 SAMB)$/i.test(raw)) {
                                        department = raw;
                                        break;
                                    }
                                }
                            }
                            // Fallback: if no L-code found, use position as department
                            if (!department) department = position;
                            
                            // Find seniority date
                            let seniorityDate = '';
                            const dateColumns = ['Seniority Date', 'SeniorityDate', 'seniorityDate',
                                                'Start of staff membership', 'Start_of_staff_membership',
                                                'Start Date', 'StartDate', 'Joining Date', 'JoiningDate'];
                            
                            for (const col of dateColumns) {
                                if (row[col] !== undefined && row[col] !== '') {
                                    const dateVal = row[col];
                                    if (typeof dateVal === 'number') {
                                        // Excel date number
                                        const excelEpoch = new Date(1899, 11, 30);
                                        const jsDate = new Date(excelEpoch.getTime() + dateVal * 24 * 60 * 60 * 1000);
                                        seniorityDate = jsDate.toISOString();
                                    } else {
                                        // String date — try DD/MM/YYYY and DD-MM-YYYY before falling back
                                        // to new Date() which is locale-sensitive and silently wrong
                                        const dmyMatch = String(dateVal).match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
                                        let jsDate;
                                        if (dmyMatch) {
                                            jsDate = new Date(`${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`);
                                        } else {
                                            jsDate = new Date(dateVal);
                                        }
                                        if (!isNaN(jsDate.getTime())) {
                                            seniorityDate = jsDate.toISOString();
                                        }
                                    }
                                    break;
                                }
                            }
                            
                            // If no date found, use default
                            if (!seniorityDate) {
                                seniorityDate = new Date('2020-01-01').toISOString();
                            }
                            
                            // Use default ID if none found
                            if (!id) {
                                id = `EMP${idx + 1000}`;
                            }
                            
                            // Use default name if none found
                            if (!name) {
                                name = `Employee ${idx + 1}`;
                            }
                            
                            // Use default department if none found
                            if (!department) {
                                department = 'Unassigned';
                            }
                            
                            return {
                                id: id,
                                name: name,
                                seniorityDate: seniorityDate,
                                department: department,
                                position: position,
                                gender: row['Gender'] || row['gender'] || '',
                                nationality: row['Nationality'] || row['nationality'] || ''
                            };
                        }).filter(emp => emp.id && emp.name); // Remove empty rows
                        
                        if (employees.length > 0) {
                            this.state.employees = employees;
                            employees.forEach(emp => {
                                this.state.employeePasswords[emp.id] = emp.id;
                            });
                            
                            this.saveState();
                            this.writeAuditLog('DATA_UPLOADED', { count: employees.length, year: this.state.biddingYear });
                            
                            // Show summary of departments found
                            const departmentsFound = [...new Set(employees.map(e => e.position || e.department))];
                            const message = `✅ Successfully loaded ${employees.length} employees\n\n` +
                                          `Positions found (${departmentsFound.length}):\n` +
                                          departmentsFound.join(', ');
                            
                            alert(message);
                            this.renderUploadView();
                            this.renderLoginForm(); // Update login form with new IDs
                        } else {
                            alert('⚠️ No valid employee data found in the file. Please check the format.');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        alert('Error processing Excel file. Please check the format and try again.');
                    }
                };
                
                reader.readAsArrayBuffer(file);
            },

            // ==================== VIEW RENDERING ====================
            // renderEmployeeBiddingView moved to views-bidding.js (loaded after this file)

            // renderGoldenCommandBiddingView moved to views-bidding.js (loaded after this file)

            // setGCSelectedSlot moved to views-bidding.js (loaded after this file)

            // updateGCEndDate moved to views-bidding.js (loaded after this file)

            // updateGCDateInfo moved to views-bidding.js (loaded after this file)

            // submitGCBid moved to views-bidding.js (loaded after this file)

            // removeGCBid moved to views-bidding.js (loaded after this file)

            // ==================== CORPORATE STAFF BIDDING ====================
            // renderCorporateStaffBiddingView moved to views-bidding.js (loaded after this file)

            // csSetSelectedSlot moved to views-bidding.js (loaded after this file)

            // csUpdateEndDate moved to views-bidding.js (loaded after this file)

            // _csCheckOnCallWarning moved to views-bidding.js (loaded after this file)

            // submitCSBid moved to views-bidding.js (loaded after this file)

            // removeCSBid moved to views-bidding.js (loaded after this file)

            // Display-only helper: converts an internal month-name key (e.g. 'May') —
            // which is still the actual bucket used everywhere for bid matching / storage
            // blockLabel moved to utils.js (loaded after this file)

            // renderConfigureSlotsView moved to views-configure.js (loaded after this file)
            
            // filterDepartments moved to views-configure.js (loaded after this file)

            // ===== MAINTENANCE SLOT CONFIGURATION =====
            // renderConfigureMaintSlotsView moved to views-configure.js (loaded after this file)

            // filterMaintDepartments moved to views-configure.js (loaded after this file)

            // renderMaintDeptConfig moved to views-configure.js (loaded after this file)

            // _toggleMaintSlotOpacity moved to views-configure.js (loaded after this file)

            // _markAllMaintSlot moved to views-configure.js (loaded after this file)

            // saveMaintSlotConfiguration moved to views-configure.js (loaded after this file)

            // Clears all saved date/capacity/on-off overrides for one roster group, restoring
            // the auto-computed default dates (30-day blocks) that show when nothing is saved.
            // resetMaintDeptSlotsToDefault moved to views-configure.js (loaded after this file)

            // Parses pasted rows (tab or comma separated) into maintSlotCapacities for one roster
            // group (3 slots: SA/SB/SC), then saves to Supabase in a single call.
            // bulkImportMaintDeptSlots moved to views-configure.js (loaded after this file)

            
            // renderDeptConfig moved to views-configure.js (loaded after this file)
            
            // ===== SENIORITY DATE REPORT (OPS Staff only — excludes Maintenance) =====
            // renderSeniorityReportView moved to views-reports.js (loaded after this file)

            // _seniorityReportRow moved to views-reports.js (loaded after this file)

            // _filterSeniorityReport moved to views-reports.js (loaded after this file)

            // exportSeniorityReportCSV moved to views-reports.js (loaded after this file)

            // copyToAllMonths moved to views-configure.js (loaded after this file)

            // Clears all saved date/capacity/on-off overrides for one department, restoring
            // the auto-computed default dates (30-day blocks) that show when nothing is saved.
            // resetDeptSlotsToDefault moved to views-configure.js (loaded after this file)

            // Parses pasted rows (tab or comma separated) into slotCapacities for one department,
            // then saves to Supabase in a single call — avoids re-typing every field by hand.
            // bulkImportDeptSlots moved to views-configure.js (loaded after this file)
            
            // saveSlotConfiguration moved to views-configure.js (loaded after this file)

            // Dims/undims the date+capacity cells when the enabled checkbox is toggled
            // _toggleSlotRowOpacity moved to views-configure.js (loaded after this file)

            // Checks/unchecks all 12 month "enabled" checkboxes for a given dept+slot,
            // and fires _toggleSlotRowOpacity on each so row dimming stays in sync.
            // _markAllSlot moved to views-configure.js (loaded after this file)

            // Syncs the "All" header checkbox: checked=all on, unchecked=all off, indeterminate=mixed.
            // _syncMarkAllState moved to views-configure.js (loaded after this file)

            // refreshBidsFromSupabase moved to api-supabase.js (loaded after this file)

            // _liveUpdateAdminPanel moved to views-admin.js (loaded after this file)

            // _isGcOrCs moved to views-admin.js (loaded after this file)

            // Fixed roster of Staff IDs that belong to the "HR Corporate" bid section.
            // Sourced from the corporate_staff_employees_rows.csv upload — any other
            // Corporate Staff records (added later / not on this list) remain grouped
            // under the general "GC & Corporate Staff" tab.
            _HR_CORPORATE_IDS: ['1000052','1000060','1000072','1000081','1000092','1000095','1000104','1000123','1000129','1000160','1000167','1000181','1000215','1000228','1000278','1000285','1000307','1000399','1000442','1000516','1000547','1000565','1000604','1000617','1000664','1000675','1000743','1000769','1000775','1000784','1000804','1000834','1000847','1000945','1000956','1001236','1002247','1002280','1002438','1002885','1003687','1004522','1004831','1004962','1005101','1005263','1005708','1006476','1006806','1006807','1006869','1006894','1006895','1006912','1006938','1006959','1007062','1007063','1007064','1007088','1007113','1007114','1007115','1007116','1007117','1007122','1007134','1007135','1007151'],

            // _isHrCorporate moved to views-admin.js (loaded after this file)

            // _isMaintStaff moved to views-admin.js (loaded after this file)

            // Returns true for Golden Command (GC) and Corporate Staff (CS) employee IDs —
            // these route to the dedicated `corporate_leave_request` table, kept separate
            // from Ops (`leave_requests`) and Maintenance (`maint_leave_requests`).
            // _isCorporateStaff moved to views-admin.js (loaded after this file)

            // Central place that decides which Supabase table a bid belongs to,
            // based on the acting user's userType. Used by every read/write path
            // so the routing rule only has to be maintained in one spot.
            // _bidTableForUserType moved to views-admin.js (loaded after this file)

            // _switchBidTab moved to views-admin.js (loaded after this file)

            // _renderBidsTableHTML moved to views-admin.js (loaded after this file)

            // adminDeleteBid moved to views-admin.js (loaded after this file)

            // _filterBidsTable moved to views-admin.js (loaded after this file)

            // deleteAllBidsByTab moved to views-admin.js (loaded after this file)

            // deleteAllBids moved to views-admin.js (loaded after this file)

            // stopAdminPolling moved to views-admin.js (loaded after this file)

            // ==================== ADMIN REALTIME (Supabase postgres_changes) ====================
            // Replaces the 15-second polling loop with push-based updates. Falls back
            // to a 30-second poll if Realtime disconnects, so the admin view still
            // refreshes. Used by the planner/admin view only — employee/GC/CS/maintenance
            // bidding views are unchanged.

            // _mapRemoteBid moved to views-admin.js (loaded after this file)

            // startAdminRealtime moved to views-admin.js (loaded after this file)

            // stopAdminRealtime moved to views-admin.js (loaded after this file)

            // startLcRealtime moved to views-admin.js (loaded after this file)

            // stopLcRealtime moved to views-admin.js (loaded after this file)

            // _setLcStatus moved to views-admin.js (loaded after this file)

            // _setAdminStatus moved to views-admin.js (loaded after this file)

            // _startAdminLive moved to views-admin.js (loaded after this file)

            // _stopAdminLive moved to views-admin.js (loaded after this file)

            // renderAdminView moved to views-admin.js (loaded after this file)

            // addGCUser moved to views-users.js (loaded after this file)

            // removeGCUser moved to views-users.js (loaded after this file)

            // addCSUser moved to views-users.js (loaded after this file)

            // removeCSUser moved to views-users.js (loaded after this file)

            // addL456InmUser moved to views-users.js (loaded after this file)

            // removeL456InmUser moved to views-users.js (loaded after this file)

            // addL3InmUser moved to views-users.js (loaded after this file)

            // removeL3InmUser moved to views-users.js (loaded after this file)

            // addL3TsmUser moved to views-users.js (loaded after this file)

            // removeL3TsmUser moved to views-users.js (loaded after this file)

            // saveGCUsersToSupabase moved to api-supabase.js (loaded after this file)

            // saveCorporateStaffUsersToSupabase moved to api-supabase.js (loaded after this file)

            // ── Save L456 INM / L3 INM / L3 TSM users to Supabase ──────────────────
            // Pass a groupKey ('l456inm','l3inm','l3tsm') to save only that group,
            // or omit to save all three.
            // saveSubGroupUsersToSupabase moved to api-supabase.js (loaded after this file)
            // ────────────────────────────────────────────────────────────────────────

            // ==================== OTHER FUNCTIONS ====================

            // computeBidAllocation moved to core/allocation.js (loaded after this file)


            // ────────────────────────────────────────────────────────────────────────
            // processBids() — runs computeBidAllocation() and WRITES the result:
            // saves to this.state.results / Supabase and marks bidding as processed.
            // ────────────────────────────────────────────────────────────────────────
            // Generic Proceed/Cancel confirmation modal (styled, matches app design) — used
            // instead of the native browser confirm() for critical/irreversible actions where
            // a plain OK/Cancel isn't explicit enough. Returns a Promise<boolean>.
            // showConfirmModal moved to views-admin.js (loaded after this file)
            // _resolveConfirmModal moved to views-admin.js (loaded after this file)

            // processBids moved to core/allocation.js (loaded after this file)


            // ────────────────────────────────────────────────────────────────────────
            // previewAllocation() — READ-ONLY dry run of the exact same allocation
            // logic (computeBidAllocation), rendered as a report. Does NOT write to
            // this.state.results, does NOT mark bidding as processed, does NOT save
            // to Supabase, and does NOT send any staff notification email. Use this
            // to regression-check seniority grouping (e.g. confirm L3-DEP-DM only
            // competes against L3-DEP-DM) before running the real "Process Bids".
            // ────────────────────────────────────────────────────────────────────────
            // previewAllocation moved to views-admin.js (loaded after this file)

            // Builds the read-only HTML report and shows it in the preview modal.
            // renderPreviewAllocationReport moved to views-admin.js (loaded after this file)

            // Re-renders the Preview Allocation report filtered to positions whose name
            // contains the search box text (case-insensitive). Read-only — just narrows
            // which already-computed groups are shown, nothing is recomputed.
            // _filterPreviewAllocationByPosition moved to views-admin.js (loaded after this file)

            // Exports the currently-shown Preview Allocation report to an Excel file.
            // Uses the same filtered (Corporate Staff excluded) snapshot that was
            // just rendered — nothing is recomputed and nothing is saved/written.
            // exportPreviewAllocationToExcel moved to views-admin.js (loaded after this file)

            // processMaintBids moved to core/allocation.js (loaded after this file)


            // exportMaintResults moved to views-admin.js (loaded after this file)

            // resetMaintProcessing moved to views-admin.js (loaded after this file)

            // renderMaintResultsView moved to views-admin.js (loaded after this file)

            // exportResults moved to views-admin.js (loaded after this file)

            // ════════════════════════════════════════════════════════════════════
            // BID ALLOCATION JUSTIFICATION REPORT
            //
            // Builds a per-employee, per-awarded-slot transparency report explaining
            // WHY each slot was awarded the way it was: which choice number it was
            // (1st/2nd/3rd...), and — when an earlier preference was lost — WHO won
            // it instead (by seniority). Covers both Ops (this.state.results) and
            // Maintenance (this.state.maintResults), since both use the same
            // seniority + ranked-choice + auto-assign allocation model. Golden
            // Command / Corporate Staff use a different free-date bidding flow
            // without ranked discrete slot choices, so they're intentionally not
            // included here.
            //
            // Does not recompute allocation — it explains the actual saved results
            // (this.state.results / maintResults) against the actual submitted bids
            // (this.state.bids), so it always matches what employees were told.
            // ════════════════════════════════════════════════════════════════════
            // _ordinal moved to utils.js (loaded after this file)

            // Shared builder — works for both Ops and Maintenance since their result
            // objects have the same shape (employeeId, department/position, month,
            // slotType, startDate/endDate, seniorityRank, slotOrder, type, ...).
            // `groupField` is 'department' for Ops (capacity pooled per dept) or
            // 'position' for Maintenance (capacity pooled per position).
            // _buildJustificationRowsForResults moved to views-reports.js (loaded after this file)

            // buildJustificationReport moved to views-reports.js (loaded after this file)

            // renderJustificationReport moved to views-reports.js (loaded after this file)

            // _filterJustificationReport moved to views-reports.js (loaded after this file)

            // exportJustificationReport moved to views-reports.js (loaded after this file)

            // Email Settings admin view (renderEmailSettingsView, doSaveEmailSettings,
            // doTestOtpEmail, doTestSmtpFallback) has moved to api-email.js.

            // ==================== RESET SYSTEM ====================
            // Independent from Configure Slots (Ops & Maintenance): this resets employees, bids,
            // results, and on-call dates only. Slot configuration (calendar dates/capacities for
            // both Ops and Maintenance) is NOT affected — use "Reset to Default Dates" on a
            // department/roster group in Configure Slots if you need to clear that separately.
            // resetSystem moved to views-admin.js (loaded after this file)

            // ==================== BIDDING FUNCTIONS ====================
            // ── NEW: Populates the available-slot cards for the employee bidding view ──
            // refreshAvailableSlots moved to views-bidding.js (loaded after this file)

            // selectConfiguredSlot moved to views-bidding.js (loaded after this file)


            // checkDateOverlap moved to utils.js (loaded after this file)

            // Centralized deadline check — used to gate bid submission everywhere
            // isBiddingClosed moved to views-bidding.js (loaded after this file)

            // Independent deadline check for Golden Command & Corporate Staff bidding
            // isBiddingClosedCorp moved to views-bidding.js (loaded after this file)

            // Sets the bidding deadline, ensuring a date-only pick (defaults to 00:00)
            // closes at the END of that day rather than the very start of it.
            // setBiddingDeadline moved to views-admin.js (loaded after this file)

            // Sets the Corporate/GC bidding deadline independently from Ops/Maintenance
            // setBiddingDeadlineCorp moved to views-admin.js (loaded after this file)

            // Sets the Corporate/GC bidding year independently from Ops/Maintenance
            // setBiddingYearCorp moved to views-admin.js (loaded after this file)

            // Manually lock/unlock Corporate & GC bidding (mirrors isProcessed for Ops,
            // but GC/CS bids aren't run through the seniority allocation engine, so this
            // is a direct toggle rather than a "process" step).
            // toggleCorpLock moved to views-admin.js (loaded after this file)

            // submitBid moved to views-bidding.js (loaded after this file)

            // saveBidToSupabase moved to api-supabase.js (loaded after this file)

            // removeBid moved to views-bidding.js (loaded after this file)
               
            // renderMyResultsView moved to views-bidding.js (loaded after this file)

            // renderResultsView moved to views-bidding.js (loaded after this file)

            // renderChangePasswordView moved to views-auth.js (loaded after this file)

            // doChangePassword moved to views-auth.js (loaded after this file)

            // ==================== PLANNER DASHBOARD ====================
            // renderDashboardView moved to views-dashboard.js (loaded after this file)

            // ==================== MANUAL OVERRIDE ====================
            // renderManualOverrideView moved to views-admin.js (loaded after this file)

            // saveOverride moved to views-admin.js (loaded after this file)

            // saveAllOverrides moved to views-admin.js (loaded after this file)

            // ==================== MAINTENANCE MANUAL OVERRIDE ====================
            // renderMaintManualOverrideView moved to views-admin.js (loaded after this file)

            // saveMaintOverride moved to views-admin.js (loaded after this file)

            // saveAllMaintOverrides moved to views-admin.js (loaded after this file)

            // ==================== MANAGE USERS ====================
            // renderManageUsersView moved to views-users.js (loaded after this file)

            // Add a user to a group from the Manage Users view
            // _muAddUser moved to views-users.js (loaded after this file)

            // Remove a user from a group from the Manage Users view
            // _muRemoveUser moved to views-users.js (loaded after this file)
            // ==================== END MANAGE USERS ====================

            // ==================== ON-CALL MANAGER ====================
            // renderManageOnCallView moved to views-oncall.js (loaded after this file)

            // addOnCallRangeNewTyped moved to views-oncall.js (loaded after this file)

            // addOnCallWeekNewTyped moved to views-oncall.js (loaded after this file)

            // addOnCallMultiWeekNewTyped moved to views-oncall.js (loaded after this file)

            // addOnCallRangeKeyed moved to views-oncall.js (loaded after this file)

            // addOnCallWeekKeyed moved to views-oncall.js (loaded after this file)

            // addOnCallMultiWeekKeyed moved to views-oncall.js (loaded after this file)

            // _previewOcMultiChipsTyped moved to views-oncall.js (loaded after this file)

            // removeFromOnCallList moved to views-oncall.js (loaded after this file)


            // ── Dept Panel helpers ──────────────────────────────────────────
            // _ocSelectStaff moved to views-oncall.js (loaded after this file)

            // _ocSearchFilter moved to views-oncall.js (loaded after this file)

            // _ocSetMode moved to views-oncall.js (loaded after this file)

            // _ocWeekPreview moved to views-oncall.js (loaded after this file)

            // Returns { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } for a Sun-Sat week number.
            // Week 1 starts on the Sunday on or before Jan 1 of the given year.
            // e.g. for 2026: Jan 1 is Thursday → Week 1 = Dec 28 2025 (Sun) → Jan 3 2026 (Sat).
            // Always 52 weeks max. What would be Week 53 is labelled Week 1 of the next year.
            // weekNumberToDateRange and _parseMultiWeekInput moved to utils.js (loaded after this file)

            // Saves all system_config fields (deadline, year, slots, on-call, password, results) to Supabase + localStorage
            // saveConfigToSupabase moved to api-supabase.js (loaded after this file)

            // Persists onCallDates to dedicated oncall_dates table + localStorage
            // saveOnCallDatesToSupabase moved to api-supabase.js (loaded after this file)

            // _applyOnCallRange moved to views-oncall.js (loaded after this file)

            // deleteOnCallBlock moved to views-oncall.js (loaded after this file)

            // renderChangePlannerPasswordView moved to views-auth.js (loaded after this file)

            // doChangePlannerPassword moved to views-auth.js (loaded after this file)

            // ==================== FORGOT PASSWORD (OTP via EmailJS) ====================
            // Internal OTP state — not part of app.state (no persistence needed)
            _fpOtp: null, _fpOtpExpiry: null, _fpRole: null, _fpIdentifier: null, _fpTokenId: null,

            // renderForgotPasswordView moved to views-auth.js (loaded after this file)

            // closeForgotPasswordView moved to views-auth.js (loaded after this file)

            // fpGoBack moved to views-auth.js (loaded after this file)

            // _fpFindByEmail moved to views-auth.js (loaded after this file)

            // fpSendOtp moved to views-auth.js (loaded after this file)

            // fpVerifyOtp moved to views-auth.js (loaded after this file)

            // Email Notification (showEmailNotifyModal, sendResultsNotification) has
            // moved to api-email.js.

            // ==================== AUDIT LOG ====================
            // writeAuditLog moved to views-reports.js (loaded after this file)

            // renderLeaveDashboardView moved to views-dashboard.js (loaded after this file)

            // ==================== HR CORPORATE DASHBOARD ====================
            // _hrCorpRosterLookup moved to views-dashboard.js (loaded after this file)

            // _hrCorpBidOverlaps moved to views-dashboard.js (loaded after this file)

            // renderHrCorpDashboardView moved to views-dashboard.js (loaded after this file)

            // renderAuditLogView moved to views-reports.js (loaded after this file)

            // filterAuditLog moved to views-reports.js (loaded after this file)

            // clearAuditLog moved to views-reports.js (loaded after this file)

            _highlightNavTab(btn, role) {
                document.querySelectorAll('.lp-nav-tab').forEach(t => t.classList.remove('active'));
                btn.classList.add('active');
                app.setLoginType(role);
            },

            _updateLandingStats() {
                const opsCount = this.state.employees ? this.state.employees.length : 0;
                const maintCount = this.state.maintenanceStaffUsers ? this.state.maintenanceStaffUsers.length : 0;
                const totalCount = opsCount + maintCount;
                const countStr = totalCount > 0 ? totalCount.toLocaleString() : '—';
                ['statsEmpCount','statsEmpBadge','statsEmpStatus'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = totalCount > 0 ? countStr : '—';
                });
                // Update label to reflect both staff types
                const labelEl = document.querySelector('.lp-stat-label');
                if (labelEl && maintCount > 0) {
                    labelEl.textContent = `👥 Total Staff (Ops: ${opsCount} | Maint: ${maintCount})`;
                }
            },

            _startClock() {
                const tick = () => {
                    const now = new Date();
                    const clockEl = document.getElementById('liveClock');
                    const dateEl = document.getElementById('liveDate');
                    if (clockEl) {
                        clockEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    }
                    if (dateEl) {
                        dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    }
                };
                tick();
                setInterval(tick, 1000);
            },

            // ==================== INITIALIZATION ====================
            async init() {
                console.log('App initializing...');
                this.updateSystemStatus('Initializing...');
                
                // Initialize Supabase
                const supabaseReady = await this.initSupabase();
                if (supabaseReady) {
                    this.updateSystemStatus('⏳ Connecting to Supabase...');
                    try {
                        await this.loadFromSupabase();
                    } catch (err) {
                        console.error('❌ Failed to load from Supabase:', err);
                        this.updateSystemStatus('⚠️ Supabase load failed — using local data');
                        this.loadFromLocalStorage();
                    }
                } else {
                    // Fallback to localStorage
                    const localLoaded = this.loadFromLocalStorage();
                    if (localLoaded) {
                        this.updateSystemStatus(`✅ ${this.state.employees.length} employees from local storage`);
                    } else {
                        this.updateSystemStatus('Ready - No data loaded');
                    }
                }
                
                this.renderLoginForm();
                this.applySavedTheme();
                
                // Keep the fixed header's height in sync with the layout,
                // both now and whenever the window is resized.
                this._syncHeaderOffset();
                window.addEventListener('resize', () => this._syncHeaderOffset());
                
                // Update landing page stats
                this._updateLandingStats();
                
                // Add Enter key support — detect which card the user is typing in
                document.addEventListener('keydown', (e) => {
                    if (e.key !== 'Enter' || this.state.activeView !== 'login') return;
                    const focused = document.activeElement;
                    if (focused) {
                        const id = focused.id;
                        if (id === 'empLoginId' || id === 'empLoginPwd') {
                            this.state.loginType = 'employee';
                            this._pendingLogin = {
                                empId: document.getElementById('empLoginId')?.value?.trim() || '',
                                empPw: document.getElementById('empLoginPwd')?.value || ''
                            };
                        } else if (id === 'csLoginId' || id === 'csLoginPwd') {
                            this.state.loginType = 'corporatestaff';
                            this._pendingLogin = {
                                csId: document.getElementById('csLoginId')?.value?.trim() || '',
                                csPw: document.getElementById('csLoginPwd')?.value || ''
                            };
                        } else if (id === 'plannerLoginPwd') {
                            this.state.loginType = 'planner';
                        } else if (id === 'gcLoginId' || id === 'gcLoginPwd') {
                            this.state.loginType = 'goldencommand';
                            this._pendingLogin = {
                                gcId: document.getElementById('gcLoginId')?.value?.trim() || '',
                                gcPw: document.getElementById('gcLoginPwd')?.value || ''
                            };
                        } else if (id === 'maintLoginId' || id === 'maintLoginPwd') {
                            this.state.loginType = 'maintenancestaff';
                            this._pendingLogin = {
                                maintId: document.getElementById('maintLoginId')?.value?.trim() || '',
                                maintPw: document.getElementById('maintLoginPwd')?.value || ''
                            };
                        }
                    }
                    this.handleLogin();
                });
                
                // Start live clock
                this._startClock();

                // Security: begin watching for inactivity so sessions auto-expire
                this.startIdleWatcher();

                console.log('App ready');
            }
        };

        // ---- Multi-Week chip preview helpers (global, called from oninput) ----
        function _parseWeeksForPreview(raw, year) {
            const tokens = raw.split(/[\s,;]+/).filter(Boolean);
            const weeks = new Set();
            for (const t of tokens) {
                const m = t.match(/^(\d+)-(\d+)$/);
                if (m) { for (let w = Math.max(1, +m[1]); w <= Math.min(53, +m[2]); w++) weeks.add(w); }
                else { const n = +t; if (!isNaN(n) && n >= 1 && n <= 53) weeks.add(n); }
            }
            return [...weeks].sort((a, b) => a - b);
        }

        function _previewNewOcMultiChips() {
            const raw  = document.getElementById('newOcMultiWeekInput')?.value || '';
            const year = parseInt(document.getElementById('newOcMultiWeekYear')?.value) || (app.state?.biddingYear || new Date().getFullYear());
            const box  = document.getElementById('newOcMultiPreview');
            if (!box) return;
            const arr = _parseWeeksForPreview(raw, year);
            if (!arr.length) {
                box.innerHTML = '<span class="text-xs text-yellow-600 italic">Week chips appear here…</span>';
                return;
            }
            box.innerHTML = arr.map(w => {
                const r = app.weekNumberToDateRange(w, year);
                return `<span style="display:inline-flex;align-items:center;gap:4px;background:#fef3c7;border:1px solid #f59e0b;color:#92400e;font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:20px;margin:2px;">Wk ${w} <span style="opacity:.6;font-weight:400">${r.from}→${r.to}</span></span>`;
            }).join('');
        }

        function _previewOcMultiChips(empId) {
            const raw  = document.getElementById(`ocMultiWeekInput-${empId}`)?.value || '';
            const year = parseInt(document.getElementById(`ocMultiWeekYear-${empId}`)?.value) || (app.state?.biddingYear || new Date().getFullYear());
            const box  = document.getElementById(`ocMultiPreview-${empId}`);
            if (!box) return;
            const arr = _parseWeeksForPreview(raw, year);
            if (!arr.length) {
                box.innerHTML = '<span style="font-size:0.7rem;color:#93c5fd;font-style:italic;">Chips appear here…</span>';
                return;
            }
            box.innerHTML = arr.map(w => {
                const r = app.weekNumberToDateRange(w, year);
                return `<span style="display:inline-flex;align-items:center;gap:3px;background:#dbeafe;border:1px solid #3b82f6;color:#1e3a8a;font-size:0.68rem;font-weight:700;padding:2px 7px;border-radius:20px;margin:1px;">Wk ${w} <span style="opacity:.6;font-weight:400">${r.from}→${r.to}</span></span>`;
            }).join('');
        }

        // Initialize when page loads
        window.addEventListener('load', () => {
            app.init();
        });
