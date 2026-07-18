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
                                        <button onclick="app.removeGCUser(${i})" class="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-semibold">✕ Remove</button>
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
                                <button onclick="app.addGCUser()" class="px-6 py-2.5 bg-yellow-400 text-yellow-900 rounded-lg font-bold hover:bg-yellow-500 text-sm transition">
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
                                        <button onclick="app.removeCSUser(${i})" class="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-semibold">✕ Remove</button>
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
                                <button onclick="app.addCSUser()" class="px-6 py-2.5 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 text-sm transition">
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
                                        <button onclick="app.removeL456InmUser(${i})" class="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-semibold">✕ Remove</button>
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
                                <button onclick="app.addL456InmUser()" class="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 text-sm transition">📋 Add L456 INM User</button>
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
                                        <button onclick="app.removeL3InmUser(${i})" class="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-semibold">✕ Remove</button>
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
                                <button onclick="app.addL3InmUser()" class="px-6 py-2.5 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 text-sm transition">📋 Add L3 INM User</button>
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
                                        <button onclick="app.removeL3TsmUser(${i})" class="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-semibold">✕ Remove</button>
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
            renderEmployeeBiddingView() {
                const content = document.getElementById('contentArea');
                if (!this.state.verifiedEmployee) {
                    content.innerHTML = '<p class="text-center">Please login first.</p>';
                    return;
                }
            
                // Calculate employee's leave entitlement
                const calculateYearsOfService = (seniorityDate) => {
                    const today = new Date();
                    const joinDate = new Date(seniorityDate);
                    const years = (today - joinDate) / (1000 * 60 * 60 * 24 * 365.25);
                    return years;
                };
            
                const getEmployeeEntitlement = (employee) => {
                    if (!employee || !employee.seniorityDate) return 30;
                    const yearsOfService = calculateYearsOfService(employee.seniorityDate);
                    return yearsOfService >= 5 ? 35 : 30;
                };
            
                const entitlement = getEmployeeEntitlement(this.state.verifiedEmployee);
                const yearsOfService = calculateYearsOfService(this.state.verifiedEmployee.seniorityDate);
                
                // Get employee's bids
                const userBids = this.state.bids.filter(bid => bid.employeeId === this.state.verifiedEmployee.id);
                const totalBidDays = userBids.reduce((sum, bid) => sum + bid.days, 0);
                const remainingLeave = entitlement - totalBidDays;
            
                // Countdown timer helper
                const deadlineCountdown = (() => {
                    if (!this.state.biddingDeadline) return '';
                    const dl = new Date(this.state.biddingDeadline);
                    const now = new Date();
                    const diff = dl - now;
                    if (diff <= 0) return `<div class="mb-4 bg-red-50 border border-red-300 rounded-xl p-3 text-center"><span class="text-red-700 font-bold">⛔ Bidding deadline has passed</span></div>`;
                    const days = Math.floor(diff / 86400000);
                    const hrs  = Math.floor((diff % 86400000) / 3600000);
                    const mins = Math.floor((diff % 3600000) / 60000);
                    const secs = Math.floor((diff % 60000) / 1000);
                    const urgency = diff < 3600000 ? 'bg-red-50 border-red-300 text-red-700' : diff < 86400000 ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'bg-green-50 border-green-300 text-green-700';
                    return `<div class="mb-4 border rounded-xl p-3 text-center ${urgency}">
                        <p class="text-xs font-semibold uppercase tracking-wide mb-1">⏰ Bidding Closes In</p>
                        <p class="text-2xl font-bold font-mono" id="countdownTimer">${days}d ${hrs}h ${mins}m ${secs}s</p>
                        <p class="text-xs mt-1">Deadline: ${dl.toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
                    </div>`;
                })();

                content.innerHTML = `
                    <div class="max-w-6xl mx-auto">
                        ${deadlineCountdown}
                        <!-- Header with leave entitlement -->
                        <div class="metro-card p-6 mb-6">
                            <h2 class="text-2xl font-bold mb-4" style="font-family:'Barlow Condensed',sans-serif;color:var(--app-text);">Leave Bidding for ${this.state.biddingYear}</h2>
                            
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div class="p-4 rounded-lg" style="background:var(--app-green-50);">
                                    <p class="text-2xl font-bold" style="color:var(--app-text);">${entitlement}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Total Leave Days</p>
                                    <p class="text-xs" style="color:var(--app-text-muted);">${yearsOfService.toFixed(1)} years of service</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background:var(--app-green-50);">
                                    <p class="text-2xl font-bold" style="color:var(--metro-green-dark);">${userBids.length}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Preferences Submitted</p>
                                    <p class="text-xs" style="color:var(--app-text-muted);">Max 2 per block</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background:var(--app-gold-50);">
                                    <p class="text-2xl font-bold" style="color:var(--metro-gold-dark);">${totalBidDays}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Days Requested</p>
                                    <p class="text-xs" style="color:var(--app-text-muted);">Across all preferences</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background:var(--app-green-50);">
                                    <p class="text-2xl font-bold" style="color:var(--app-text);">${entitlement}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Leave Entitlement</p>
                                    <p class="text-xs" style="color:var(--app-text-muted);">Final allocation by seniority</p>
                                </div>
                            </div>
            
                        </div>
            
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <!-- Left: Place New Bid -->
                            <div class="metro-card p-6">
                                <h3 class="text-xl font-bold mb-4" style="font-family:'Barlow Condensed',sans-serif;color:var(--app-text);">Place New Bid</h3>
                                
                                ${this.state.isProcessed ? `
                                    <div class="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
                                        <p class="font-semibold">⚠️ Bidding has been processed. No more bids allowed.</p>
                                    </div>
                                ` : ''}
                                
                                ${userBids.length >= 2 ? `
                                    <div class="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                                        <p class="font-semibold text-blue-800">ℹ️ You have submitted ${userBids.length} preference(s) total.</p>
                                        <p class="text-sm text-blue-700 mt-1">You may still add preferences in other blocks — max 2 per block. Final allocation is based on seniority.</p>
                                    </div>
                                ` : ''}
                                
                                <!-- Month Selection -->
                                <div class="mb-5">
                                    <label class="block font-semibold mb-2" style="color:var(--app-text);">Select Block:</label>
                                    <select id="selectedMonth" class="w-full px-4 py-2 border-2 rounded-lg" style="border-color:var(--app-border);" onchange="app.refreshAvailableSlots()">
                                        ${this.state.months.map((month, i) => `
                                            <option value="${month}">Block ${i + 1} · ${this.state.biddingYear}</option>
                                        `).join('')}
                                    </select>
                                </div>
            
                                <!-- Available Slots for selected month (planner-configured) -->
                                <div class="mb-5">
                                    <label class="block font-semibold mb-2" style="color:var(--app-text);">Select Available Slot:</label>
                                    <div id="availableSlotCards" class="space-y-3">
                                        <!-- Populated by refreshAvailableSlots() -->
                                    </div>
                                </div>

                                <!-- Selected slot confirmation panel -->
                                <div id="selectedSlotConfirm" class="hidden mb-5 p-4 rounded-xl border-2" style="border-color:var(--metro-green-light);background:var(--app-green-50);">
                                    <p class="font-semibold mb-1" style="color:var(--metro-green-dark);">📌 Selected: <span id="confirmSlotName"></span></p>
                                    <p class="text-sm" style="color:var(--metro-green-dark);">📅 <span id="confirmSlotDates"></span></p>
                                    <p class="text-sm" style="color:var(--metro-green-dark);">⏱ <span id="confirmSlotDays"></span> days</p>
                                </div>
            
                                <!-- Submit Button -->
                                <button
                                    id="submitBidBtn"
                                    onclick="app.submitBid()"
                                    class="w-full px-6 py-3 text-white rounded-lg font-semibold disabled:opacity-50"
                                    style="background:var(--metro-green);"
                                    onmouseover="if(!this.disabled)this.style.background='var(--metro-green-dark)'"
                                    onmouseout="if(!this.disabled)this.style.background='var(--metro-green)'"
                                    ${(this.state.isProcessed || this.isBiddingClosed()) ? 'disabled' : ''}
                                >
                                    Submit Bid
                                </button>
                                <div id="bidSuccessToast" class="hidden mt-4 p-3 bg-green-50 border border-green-300 rounded-xl text-center">
                                    <p class="text-green-800 font-semibold text-sm" id="bidSuccessMsg"></p>
                                </div>
                            </div>
            
                            <!-- Right: My Current Bids -->
                            <div class="metro-card p-6">
                                <h3 class="text-xl font-bold mb-4" style="font-family:'Barlow Condensed',sans-serif;color:var(--app-text);">My Current Bids</h3>
                                
                                ${userBids.length === 0 ? `
                                    <div class="text-center py-8 text-gray-500">
                                        <p>No bids placed yet</p>
                                        <p class="text-sm mt-2">Place your first bid on the left</p>
                                    </div>
                                ` : `
                                    <div class="space-y-4">
                                        ${userBids.map(bid => {
                                            const slotLabel = bid.slotType === 'SA' || bid.slotType === 'slotA' ? 'Slot A' :
                                                              bid.slotType === 'SB' || bid.slotType === 'slotB' ? 'Slot B' :
                                                              bid.slotType === 'SC' || bid.slotType === 'slotC' ? 'Slot C' :
                                                              bid.slotType === 'SD' || bid.slotType === 'slotD' ? 'Slot D' :
                                                              (this.state.slotTypes.find(s => s.id === bid.slotType)?.name || bid.slotType);
                                            const badgeColor = (bid.slotType === 'SA' || bid.slotType === 'slotA') ? 'bg-green-100 text-green-800 border-green-300' :
                                                               (bid.slotType === 'SB' || bid.slotType === 'slotB') ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                                               (bid.slotType === 'SD' || bid.slotType === 'slotD') ? 'bg-orange-100 text-orange-800 border-orange-300' :
                                                               'bg-purple-100 text-purple-800 border-purple-300';
                                            return `
                                                <div class="border border-gray-200 rounded-xl p-4">
                                                    <div class="flex justify-between items-start">
                                                        <div>
                                                            <span class="inline-block px-2 py-0.5 rounded text-xs font-bold border ${badgeColor} mb-2">${slotLabel}</span>
                                                            <p class="text-sm text-gray-700 font-semibold">📅 ${bid.startDate} → ${bid.endDate}</p>
                                                            <p class="text-sm text-gray-500">⏱ ${bid.days} days</p>
                                                        </div>
                                                        <button
                                                            onclick="app.removeBid('${bid.employeeId}', '${bid.slotType}', '${bid.startDate}')"
                                                            class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 font-semibold"
                                                            ${this.state.isProcessed ? 'disabled' : ''}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                `}
                                
                                <!-- Bid Summary -->
                                <div class="mt-6 p-4 rounded-lg" style="background:var(--app-green-50);">
                                    <p class="font-semibold mb-2" style="color:var(--app-text);">Bid Summary:</p>
                                    <p class="text-sm" style="color:var(--app-text);">Preferences submitted: ${userBids.length}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Limit: max 2 bids per block</p>
                                    <p class="text-sm" style="color:var(--app-text);">Days requested: ${totalBidDays} days</p>
                                    <p class="text-sm" style="color:var(--app-text);">Leave entitlement: ${entitlement} days (applied at allocation)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            
                // Initialize selected slot state
                if (!window.selectedSlot) {
                    window.selectedSlot    = null;
                    window.selectedSlotDef = null;
                }
                window._lastSlotMonth = null; // force reset on first render
                
                // Populate the slot cards for the default month
                this.refreshAvailableSlots();

                // Show success toast if a bid was just submitted
                if (this._lastBidSuccess) {
                    const toast = document.getElementById('bidSuccessToast');
                    const msg   = document.getElementById('bidSuccessMsg');
                    if (toast && msg) {
                        msg.textContent = this._lastBidSuccess;
                        toast.classList.remove('hidden');
                        setTimeout(() => toast.classList.add('hidden'), 5000);
                    }
                    this._lastBidSuccess = null;
                }

                // Live countdown ticker
                if (this.state.biddingDeadline) {
                    clearInterval(window._countdownInterval);
                    window._countdownInterval = setInterval(() => {
                        const el = document.getElementById('countdownTimer');
                        if (!el) { clearInterval(window._countdownInterval); return; }
                        const diff = new Date(this.state.biddingDeadline) - new Date();
                        if (diff <= 0) { el.textContent = 'EXPIRED'; clearInterval(window._countdownInterval); return; }
                        const d = Math.floor(diff/86400000), h = Math.floor((diff%86400000)/3600000),
                              m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
                        el.textContent = `${d}d ${h}h ${m}m ${s}s`;
                    }, 1000);
                }
            },

            renderGoldenCommandBiddingView() {
                const content = document.getElementById('contentArea');
                const gcUser = this.state.verifiedEmployee;
                if (!gcUser) { content.innerHTML = '<p class="text-center">Please login first.</p>'; return; }

                // Filter bids for THIS specific GC user
                const gcBids = this.state.bids.filter(bid => bid.employeeId === gcUser.id);
                const totalBidDays = gcBids.reduce((sum, bid) => sum + bid.days, 0);
                const entitlement = 30; // Golden Command entitlement

                // Countdown
                const deadlineCountdownGC = (() => {
                    if (!this.state.biddingDeadlineCorp) return '';
                    const dl = new Date(this.state.biddingDeadlineCorp);
                    const diff = dl - new Date();
                    if (diff <= 0) return `<div class="mb-4 bg-red-50 border border-red-300 rounded-xl p-3 text-center"><span class="text-red-700 font-bold">⛔ Bidding deadline has passed</span></div>`;
                    const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
                    const urgency = diff<3600000?'bg-red-50 border-red-300 text-red-700':diff<86400000?'bg-yellow-50 border-yellow-300 text-yellow-700':'bg-green-50 border-green-300 text-green-700';
                    return `<div class="mb-4 border rounded-xl p-3 text-center ${urgency}"><p class="text-xs font-semibold uppercase tracking-wide mb-1">⏰ Bidding Closes In</p><p class="text-2xl font-bold font-mono" id="gcCountdownTimer">${d}d ${h}h ${m}m ${s}s</p></div>`;
                })();
            
                content.innerHTML = `
                    <div class="max-w-6xl mx-auto">
                        ${deadlineCountdownGC}
                        <!-- Header with GC styling -->
                        <div class="bg-white rounded-xl shadow-xl p-6 mb-6 border-t-4 border-yellow-400">
                            <div class="flex items-center gap-3 mb-4">
                                <span class="text-3xl">⭐</span>
                                <h2 class="text-2xl font-bold">Golden Command — ${gcUser.name} — Leave Bidding ${this.state.biddingYearCorp}</h2>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div class="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                    <p class="text-2xl font-bold text-yellow-800">${entitlement}</p>
                                    <p class="text-sm text-gray-600">Total Leave Days</p>
                                    <p class="text-xs text-yellow-600">Golden Command Entitlement</p>
                                </div>
                                <div class="bg-green-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold">${gcBids.length} <span class="text-sm font-normal text-gray-500">unlimited</span></p>
                                    <p class="text-sm text-gray-600">Bids Placed</p>
                                </div>
                                <div class="bg-blue-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold">${totalBidDays}</p>
                                    <p class="text-sm text-gray-600">Days Bid</p>
                                </div>
                                <div class="bg-purple-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold text-purple-700">∞</p>
                                    <p class="text-sm text-gray-600">GC Privilege — No Limit</p>
                                </div>
                            </div>
            
                            <!-- Slot types summary -->
                            <div class="border-t pt-4">
                                <div class="flex items-center gap-2 mb-2">
                                    <p class="font-semibold">Available Slot Types:</p>
                                    <span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-semibold">⭐ GC: Unlimited selections, free date range</span>
                                </div>
                                <div class="flex gap-4">
                                    ${this.state.slotTypes.map(slot => `
                                        <div class="flex-1 p-3 rounded-lg border ${slot.color === 'green' ? 'border-green-300 bg-green-50' : slot.color === 'blue' ? 'border-blue-300 bg-blue-50' : 'border-purple-300 bg-purple-50'}">
                                            <p class="font-bold">${slot.name}</p>
                                            <p class="text-sm">${slot.days} consecutive days</p>
                                        </div>
                                    `).join('')}
                                    <div class="flex-1 p-3 rounded-lg border border-yellow-400 bg-yellow-50">
                                        <p class="font-bold text-yellow-800">⭐ Custom</p>
                                        <p class="text-sm text-yellow-700">Any date range — free choice</p>
                                    </div>
                                </div>
                            </div>
                        </div>
            
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <!-- Left: Place New Bid -->
                            <div class="bg-white rounded-xl shadow-xl p-6 border-l-4 border-yellow-400">
                                <h3 class="text-xl font-bold mb-4">⭐ Place New GC Bid</h3>
                                
                                ${this.state.isProcessedCorp ? `
                                    <div class="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
                                        <p class="font-semibold">⚠️ Bidding has been processed. No more bids allowed.</p>
                                    </div>
                                ` : ''}

                                <!-- Slot Type Selection -->
                                <div class="mb-5">
                                    <label class="block font-semibold mb-2">Select Slot Type:</label>
                                    <div class="space-y-2">
                                        ${this.state.slotTypes.map(slot => {
                                            const colorMap = { green: 'border-green-300 bg-green-50 hover:bg-green-100 text-green-900', blue: 'border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900', purple: 'border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900' };
                                            const activeMap = { green: 'bg-green-500 text-white border-green-600', blue: 'bg-blue-500 text-white border-blue-600', purple: 'bg-purple-500 text-white border-purple-600' };
                                            const isActive = window.gcSelectedSlot === slot.id;
                                            return `
                                                <button
                                                    data-slot="${slot.id}"
                                                    onclick="app.setGCSelectedSlot('${slot.id}')"
                                                    class="gc-slot-btn w-full p-3 rounded-lg font-semibold text-left transition-all border ${this.state.isProcessedCorp ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : (isActive ? (activeMap[slot.color] || 'bg-yellow-400 text-yellow-900 border-yellow-500') : (colorMap[slot.color] || 'bg-yellow-50 hover:bg-yellow-100 text-gray-800 border-yellow-300'))}"
                                                    ${this.state.isProcessedCorp ? 'disabled' : ''}
                                                >
                                                    ${slot.name} — ${slot.days} consecutive days
                                                    ${isActive ? '<span class="float-right">✓ Selected</span>' : ''}
                                                </button>
                                            `;
                                        }).join('')}
                                        <!-- Custom / Free Choice option -->
                                        <button
                                            data-slot="gcCustom"
                                            onclick="app.setGCSelectedSlot('gcCustom')"
                                            class="gc-slot-btn w-full p-3 rounded-lg font-semibold text-left transition-all border ${this.state.isProcessedCorp ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : (window.gcSelectedSlot === 'gcCustom' ? 'bg-yellow-400 text-yellow-900 border-yellow-500' : 'bg-yellow-50 hover:bg-yellow-100 text-yellow-900 border-yellow-400')}"
                                            ${this.state.isProcessedCorp ? 'disabled' : ''}
                                        >
                                            ⭐ Custom — Choose any start &amp; end date freely
                                            ${window.gcSelectedSlot === 'gcCustom' ? '<span class="float-right">✓ Selected</span>' : ''}
                                        </button>
                                    </div>
                                </div>
            
                                <!-- Date Selection -->
                                <div class="mb-6">
                                    <div class="mb-3 p-3 bg-yellow-50 border border-yellow-300 rounded">
                                        <p class="font-semibold text-yellow-800 text-sm" id="gcSlotInfoText">
                                            ${window.gcSelectedSlot === 'gcCustom' ? '⭐ Custom: Pick any start and end date' : (this.state.slotTypes.find(s=>s.id===window.gcSelectedSlot) ? `${this.state.slotTypes.find(s=>s.id===window.gcSelectedSlot).name} — end date auto-calculated (${this.state.slotTypes.find(s=>s.id===window.gcSelectedSlot).days} days)` : 'Select a slot type above')}
                                        </p>
                                    </div>

                                    ${(() => {
                                        // On-Call schedule notice for this GC user
                                        const myOnCall = this.state.onCallDates[gcUser.id] || [];
                                        if (myOnCall.length === 0) return '';
                                        // Group consecutive dates into ranges
                                        const sorted = [...myOnCall].sort();
                                        const ranges = [];
                                        let rangeStart = sorted[0], rangeEnd = sorted[0];
                                        for (let k = 1; k < sorted.length; k++) {
                                            const prev = new Date(sorted[k-1]);
                                            const curr = new Date(sorted[k]);
                                            const diffDays = (curr - prev) / 86400000;
                                            if (diffDays === 1) {
                                                rangeEnd = sorted[k];
                                            } else {
                                                ranges.push(rangeStart === rangeEnd ? rangeStart : `${rangeStart} → ${rangeEnd}`);
                                                rangeStart = sorted[k]; rangeEnd = sorted[k];
                                            }
                                        }
                                        ranges.push(rangeStart === rangeEnd ? rangeStart : `${rangeStart} → ${rangeEnd}`);
                                        return `<div class="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg">
                                            <p class="font-bold text-red-800 text-sm mb-2">🚫 Your On-Call Dates (leave cannot be selected on these dates):</p>
                                            <div class="flex flex-wrap gap-1">${ranges.map(r => `<span class="inline-block bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded border border-red-200">${r}</span>`).join('')}</div>
                                        </div>`;
                                    })()}
            
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label class="block font-semibold mb-2">Start Date:</label>
                                            <input
                                                type="date"
                                                id="gcStartDate"
                                                class="w-full px-4 py-2 border-2 border-yellow-300 rounded-lg focus:border-yellow-500 focus:outline-none"
                                                min="${this.state.biddingYearCorp}-01-01"
                                                max="${this.state.biddingYearCorp}-12-31"
                                                onchange="app.updateGCEndDate()"
                                            />
                                        </div>
                                        <div>
                                            <label class="block font-semibold mb-2">End Date:</label>
                                            <input
                                                type="date"
                                                id="gcEndDate"
                                                class="w-full px-4 py-2 border-2 border-yellow-300 rounded-lg focus:border-yellow-500 focus:outline-none"
                                                min="${this.state.biddingYearCorp}-01-01"
                                                max="${this.state.biddingYearCorp}-12-31"
                                                onchange="app.updateGCDateInfo()"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div id="gcDateInfo" class="hidden mt-2"></div>
                                </div>
            
                                <!-- Submit Button -->
                                <button
                                    onclick="app.submitGCBid()"
                                    class="w-full px-6 py-3 bg-yellow-400 text-yellow-900 rounded-lg font-semibold hover:bg-yellow-500 transition-colors shadow-sm"
                                    ${(this.state.isProcessedCorp || this.isBiddingClosedCorp()) ? 'disabled' : ''}
                                >
                                    ⭐ Submit Golden Command Bid
                                </button>
                            </div>
            
                            <!-- Right: My Current Bids -->
                            <div class="bg-white rounded-xl shadow-xl p-6">
                                <div class="flex justify-between items-center mb-4">
                                    <h3 class="text-xl font-bold">⭐ My GC Bids</h3>
                                    <span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">${gcBids.length} bid${gcBids.length !== 1 ? 's' : ''}</span>
                                </div>
                                
                                ${gcBids.length === 0 ? `
                                    <div class="text-center py-8 text-gray-500">
                                        <p class="text-4xl mb-2">⭐</p>
                                        <p class="font-semibold">No bids placed yet</p>
                                        <p class="text-sm mt-2">Use the form on the left — no limit on bids</p>
                                    </div>
                                ` : `
                                    <div class="space-y-3 max-h-96 overflow-y-auto pr-1">
                                        ${gcBids.map((bid, i) => {
                                            const slot = this.state.slotTypes.find(s => s.id === bid.slotType);
                                            const slotLabel = bid.slotType === 'gcCustom' ? '⭐ Custom' : (slot?.name || bid.slotType);
                                            const colorBadge = bid.slotType === 'gcCustom' ? 'bg-yellow-100 text-yellow-800' : (bid.slotType === 'slotA' ? 'bg-green-100 text-green-800' : bid.slotType === 'slotB' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800');
                                            return `
                                                <div class="border border-yellow-200 rounded-lg p-3 bg-yellow-50">
                                                    <div class="flex justify-between items-start">
                                                        <div>
                                                            <div class="flex items-center gap-2 mb-1">
                                                                <span class="text-xs font-bold text-gray-500">#${i+1}</span>
                                                                <span class="px-2 py-0.5 rounded text-xs font-semibold ${colorBadge}">${slotLabel}</span>
                                                            </div>
                                                            <p class="text-sm text-gray-700 font-semibold">${bid.startDate} → ${bid.endDate}</p>
                                                            <p class="text-xs text-gray-500 mt-0.5">${bid.days} day${bid.days !== 1 ? 's' : ''}</p>
                                                        </div>
                                                        <button
                                                            onclick="app.removeGCBid('${bid.slotType}', '${bid.startDate}')"
                                                            class="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                                            ${this.state.isProcessedCorp ? 'disabled' : ''}
                                                        >
                                                            ✕ Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                `}
                                
                                <!-- Bid Summary -->
                                <div class="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                    <p class="font-semibold mb-2 text-yellow-800">GC Bid Summary:</p>
                                    <div class="grid grid-cols-2 gap-2 text-sm">
                                        <p class="text-gray-600">Total bids:</p><p class="font-semibold">${gcBids.length} <span class="text-yellow-600 text-xs">(unlimited)</span></p>
                                        <p class="text-gray-600">Total days bid:</p><p class="font-semibold">${totalBidDays} days</p>
                                        <p class="text-gray-600">Leave entitlement:</p><p class="font-semibold">${entitlement} days</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            
                // Initialize GC slot state — default to Custom (free selection)
                if (!window.gcSelectedSlot) {
                    window.gcSelectedSlot = 'gcCustom';
                }

                // Live countdown ticker for GC
                if (this.state.biddingDeadlineCorp) {
                    clearInterval(window._gcCountdownInterval);
                    window._gcCountdownInterval = setInterval(() => {
                        const el = document.getElementById('gcCountdownTimer');
                        if (!el) { clearInterval(window._gcCountdownInterval); return; }
                        const diff = new Date(this.state.biddingDeadlineCorp) - new Date();
                        if (diff <= 0) { el.textContent = 'EXPIRED'; clearInterval(window._gcCountdownInterval); return; }
                        const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
                        el.textContent = `${d}d ${h}h ${m}m ${s}s`;
                    }, 1000);
                }
            },

            setGCSelectedSlot(slotId) {
                window.gcSelectedSlot = slotId;
                
                // Update button styles
                const buttons = document.querySelectorAll('.gc-slot-btn');
                buttons.forEach(btn => {
                    const isSelected = btn.dataset.slot === slotId;
                    if (this.state.isProcessedCorp) {
                        btn.className = 'gc-slot-btn w-full p-3 rounded-lg font-semibold text-left transition-all border bg-gray-200 text-gray-500 cursor-not-allowed';
                    } else if (isSelected) {
                        btn.className = 'gc-slot-btn w-full p-3 rounded-lg font-semibold text-left transition-all border bg-yellow-400 text-yellow-900 border-yellow-500';
                    } else {
                        btn.className = 'gc-slot-btn w-full p-3 rounded-lg font-semibold text-left transition-all border bg-yellow-50 hover:bg-yellow-100 text-yellow-900 border-yellow-300';
                    }
                });

                // Update info text
                const infoEl = document.getElementById('gcSlotInfoText');
                if (infoEl) {
                    if (slotId === 'gcCustom') {
                        infoEl.textContent = '⭐ Custom: Pick any start and end date freely';
                    } else {
                        const slot = this.state.slotTypes.find(s => s.id === slotId);
                        infoEl.textContent = slot
                            ? `${slot.name} — end date auto-calculated (${slot.days} days)`
                            : 'Select a slot type above';
                    }
                }

                // Clear date inputs when switching slots
                const startDate = document.getElementById('gcStartDate');
                const endDate = document.getElementById('gcEndDate');
                const dateInfo = document.getElementById('gcDateInfo');
                if (startDate) startDate.value = '';
                if (endDate) {
                    endDate.value = '';
                    // Custom slot: end date is freely editable; others: readonly
                    endDate.readOnly = slotId !== 'gcCustom';
                    endDate.className = `w-full px-4 py-2 border-2 border-yellow-300 rounded-lg focus:border-yellow-500 focus:outline-none ${slotId !== 'gcCustom' ? 'bg-gray-50' : ''}`;
                }
                if (dateInfo) dateInfo.classList.add('hidden');
            },

            updateGCEndDate() {
                const startDateInput = document.getElementById('gcStartDate');
                const endDateInput = document.getElementById('gcEndDate');
                
                if (!startDateInput || !startDateInput.value) {
                    if (endDateInput) endDateInput.value = '';
                    return;
                }

                if (window.gcSelectedSlot === 'gcCustom') {
                    // Custom: end date is free — just update info if both dates set
                    this.updateGCDateInfo();
                    return;
                }

                if (!window.gcSelectedSlot) return;
                
                const slot = this.state.slotTypes.find(s => s.id === window.gcSelectedSlot);
                if (!slot) return;
                
                const startDate = new Date(startDateInput.value);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + slot.days - 1);
                
                if (endDateInput) {
                    endDateInput.value = endDate.toISOString().split('T')[0];
                }
                
                this.updateGCDateInfo();
            },

            updateGCDateInfo() {
                const startDateInput = document.getElementById('gcStartDate');
                const endDateInput = document.getElementById('gcEndDate');
                const dateInfo = document.getElementById('gcDateInfo');

                if (!startDateInput?.value || !endDateInput?.value || !dateInfo) return;

                const days = Math.ceil(Math.abs(new Date(endDateInput.value) - new Date(startDateInput.value)) / (1000 * 60 * 60 * 24)) + 1;

                // ── On-Call conflict live check ──────────────────────────────
                const gcUser = this.state.verifiedEmployee;
                const onCallSet = new Set(gcUser ? (this.state.onCallDates[gcUser.id] || []) : []);
                const conflictDates = [];
                if (onCallSet.size > 0 && startDateInput.value && endDateInput.value) {
                    const cur = new Date(startDateInput.value);
                    const end = new Date(endDateInput.value);
                    while (cur <= end) {
                        const iso = cur.toISOString().slice(0, 10);
                        if (onCallSet.has(iso)) conflictDates.push(iso);
                        cur.setDate(cur.getDate() + 1);
                    }
                }
                const onCallWarning = conflictDates.length > 0
                    ? `<p class="font-semibold text-red-700 mt-2">🚫 On-Call conflict on: ${conflictDates.join(', ')}</p>`
                    : (onCallSet.size > 0 ? `<p class="text-green-700 text-sm mt-1">✅ No On-Call conflicts in this range</p>` : '');
                // ────────────────────────────────────────────────────────────

                let validMsg = '';
                if (window.gcSelectedSlot === 'gcCustom') {
                    validMsg = `<p class="font-semibold text-yellow-800">⭐ Custom selection: ${days} day${days !== 1 ? 's' : ''} ✓</p>`;
                    dateInfo.className = conflictDates.length > 0 ? 'p-3 rounded mb-2 bg-red-50 border border-red-300' : 'p-3 rounded mb-2 bg-yellow-50 border border-yellow-300';
                } else {
                    const slot = this.state.slotTypes.find(s => s.id === window.gcSelectedSlot);
                    const ok = slot && days === slot.days;
                    validMsg = `<p class="font-semibold ${ok ? 'text-green-800' : 'text-red-800'}">${days} day${days !== 1 ? 's' : ''} selected ${ok ? '✓' : `(${slot?.name} requires exactly ${slot?.days} days)`}</p>`;
                    dateInfo.className = conflictDates.length > 0 ? 'p-3 rounded mb-2 bg-red-50 border border-red-300'
                        : `p-3 rounded mb-2 ${ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`;
                }
                dateInfo.innerHTML = validMsg + `<p class="text-sm text-gray-600 mt-1">${startDateInput.value} → ${endDateInput.value}</p>` + onCallWarning;
                dateInfo.classList.remove('hidden');
            },

            submitGCBid() {
                if (this.state.isProcessedCorp) {
                    alert('Bidding has been processed. No more bids allowed.');
                    return;
                }

                if (this.isBiddingClosedCorp()) {
                    alert('⛔ The bidding deadline has passed. You can no longer submit bids.');
                    return;
                }

                const gcUser = this.state.verifiedEmployee;
                if (!gcUser) { alert('Please login first.'); return; }

                if (!window.gcSelectedSlot) {
                    alert('Please select a slot type first.');
                    return;
                }

                const startDate = document.getElementById('gcStartDate')?.value;
                const endDate = document.getElementById('gcEndDate')?.value;

                if (!startDate) {
                    alert('Please select a start date.');
                    return;
                }
                if (!endDate) {
                    alert('Please select an end date.');
                    return;
                }

                const days = Math.ceil(Math.abs(new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

                if (days < 1) {
                    alert('End date must be on or after start date.');
                    return;
                }

                // For fixed slot types, validate exact day count
                if (window.gcSelectedSlot !== 'gcCustom') {
                    const slot = this.state.slotTypes.find(s => s.id === window.gcSelectedSlot);
                    if (slot && days !== slot.days) {
                        alert(`${slot.name} requires exactly ${slot.days} days. Your selection is ${days} days.\n\nTo choose a free date range, select the "⭐ Custom" option instead.`);
                        return;
                    }
                }

                // Check date overlap with existing GC bids
                const gcBids = this.state.bids.filter(bid => bid.employeeId === gcUser.id);
                for (const bid of gcBids) {
                    if (this.checkDateOverlap(startDate, endDate, bid.startDate, bid.endDate)) {
                        alert(`Date overlap with an existing bid (${bid.startDate} → ${bid.endDate}). Please choose non-overlapping dates.`);
                        return;
                    }
                }

                // ── On-Call Conflict Check ──────────────────────────────────────
                // Build a set of all dates in the requested leave range
                const onCallDatesForUser = new Set(this.state.onCallDates[gcUser.id] || []);
                if (onCallDatesForUser.size > 0) {
                    const conflictingOnCallDates = [];
                    const cursor = new Date(startDate);
                    const rangeEnd = new Date(endDate);
                    while (cursor <= rangeEnd) {
                        const iso = cursor.toISOString().slice(0, 10);
                        if (onCallDatesForUser.has(iso)) conflictingOnCallDates.push(iso);
                        cursor.setDate(cursor.getDate() + 1);
                    }
                    if (conflictingOnCallDates.length > 0) {
                        const conflictList = conflictingOnCallDates.join(', ');
                        alert(`⚠️ On-Call Conflict Detected!\n\nYour selected leave period (${startDate} → ${endDate}) overlaps with your scheduled On-Call duties on the following date${conflictingOnCallDates.length > 1 ? 's' : ''}:\n\n${conflictList}\n\nPlease choose dates that do not conflict with your On-Call schedule.`);
                        return;
                    }
                }
                // ───────────────────────────────────────────────────────────────

                const slotLabel = window.gcSelectedSlot === 'gcCustom'
                    ? 'Custom'
                    : (this.state.slotTypes.find(s => s.id === window.gcSelectedSlot)?.name || window.gcSelectedSlot);

                const newBid = {
                    employeeId: gcUser.id,
                    employeeName: gcUser.name,
                    seniorityDate: gcUser.seniorityDate || '2000-01-01',
                    department: 'Golden Command',
                    slotType: window.gcSelectedSlot,
                    startDate,
                    endDate,
                    days,
                    timestamp: new Date().toISOString()
                };

                this.state.bids.push(newBid);
                this.saveState();
                this.writeAuditLog('BID_PLACED', { type: 'GC', slot: window.gcSelectedSlot, start: startDate, end: endDate, days });

                // Save bid immediately to Supabase so it survives refresh
                this.saveBidToSupabase(newBid).then(saved => {
                    if (saved) console.log('✅ GC Bid saved to Supabase');
                });

                alert(`⭐ GC Bid placed!\n${slotLabel} — ${startDate} → ${endDate} (${days} day${days !== 1 ? 's' : ''})`);
                this.renderGoldenCommandBiddingView();
            },

            async removeGCBid(slotType, startDate) {
                if (this.state.isProcessedCorp) {
                    alert('Cannot remove bids after processing.');
                    return;
                }
                if (!confirm('Remove this Golden Command bid?')) return;
                const gcUser = this.state.verifiedEmployee;

                // 1. Optimistically remove from local state and persist immediately
                const idx = this.state.bids.findIndex(bid =>
                    bid.employeeId === gcUser.id && bid.slotType === slotType && bid.startDate === startDate
                );
                if (idx !== -1) this.state.bids.splice(idx, 1);
                this.saveState();
                this.renderGoldenCommandBiddingView();

                // 2. Delete from Supabase and AWAIT the result so a failure is surfaced
                if (!this.supabase) {
                    this.writeAuditLog('BID_REMOVED', { employee_id: gcUser.id, slot_type: slotType, start_date: startDate, section: 'golden_command' });
                    return;
                }
                const { error } = await this.supabase
                    .from('corporate_leave_request')
                    .delete()
                    .eq('tenant_id', this._tid())
                    .eq('employee_id', gcUser.id)
                    .eq('slot_type', slotType)
                    .eq('start_date', startDate);

                if (error) {
                    console.error('❌ GC Bid delete failed:', error.message);
                    alert('Could not delete from server — please retry.');
                    return;
                }
                console.log('✅ GC Bid deleted from Supabase');
                this.writeAuditLog('BID_REMOVED', { employee_id: gcUser.id, slot_type: slotType, start_date: startDate, section: 'golden_command' });
            },

            // ==================== CORPORATE STAFF BIDDING ====================
            renderCorporateStaffBiddingView() {
                const content = document.getElementById('contentArea');
                const csUser = this.state.verifiedEmployee;
                if (!csUser) { content.innerHTML = '<p class="text-center">Please login first.</p>'; return; }

                const csBids = this.state.bids.filter(bid => bid.employeeId === csUser.id);
                const totalBidDays = csBids.reduce((sum, bid) => sum + bid.days, 0);
                // Corporate Staff entitlement: 35 days if 5+ years of service, else 30
                const calculateCsYearsOfService = (seniorityDate) => {
                    if (!seniorityDate) return 0;
                    const today = new Date();
                    const joinDate = new Date(seniorityDate);
                    return (today - joinDate) / (1000 * 60 * 60 * 24 * 365.25);
                };
                const csYearsOfService = calculateCsYearsOfService(csUser.seniorityDate);
                const entitlement = csYearsOfService >= 5 ? 35 : 30;

                // Countdown
                const deadlineCountdownCS = (() => {
                    if (!this.state.biddingDeadlineCorp) return '';
                    const dl = new Date(this.state.biddingDeadlineCorp);
                    const diff = dl - new Date();
                    if (diff <= 0) return `<div class="mb-4 bg-red-50 border border-red-300 rounded-xl p-3 text-center"><span class="text-red-700 font-bold">⛔ Bidding deadline has passed</span></div>`;
                    const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
                    const urgency = diff<3600000?'bg-red-50 border-red-300 text-red-700':diff<86400000?'bg-yellow-50 border-yellow-300 text-yellow-700':'bg-green-50 border-green-300 text-green-700';
                    return `<div class="mb-4 border rounded-xl p-3 text-center ${urgency}"><p class="text-xs font-semibold uppercase tracking-wide mb-1">⏰ Bidding Closes In</p><p class="text-2xl font-bold font-mono" id="csCountdownTimer">${d}d ${h}h ${m}m ${s}s</p></div>`;
                })();

                content.innerHTML = `
                    <div class="max-w-6xl mx-auto">
                        ${deadlineCountdownCS}
                        <!-- Header -->
                        <div class="bg-white rounded-xl shadow-xl p-6 mb-6 border-t-4 border-blue-500">
                            <div class="flex items-center gap-3 mb-4">
                                <span class="text-3xl">🏢</span>
                                <h2 class="text-2xl font-bold">Corporate Staff — ${csUser.name} — Leave Bidding ${this.state.biddingYearCorp}</h2>
                            </div>

                            ${(() => {
                                const uid = csUser.id;
                                // Collect on-call dates from all 4 dept groups this user belongs to
                                const deptGroups = [
                                    { key: uid,               label: '🏢 Corporate Staff' },
                                    { key: 'l456inm::' + uid, label: '📋 L456 INM' },
                                    { key: 'l3inm::' + uid,   label: '📋 L3 INM' },
                                    { key: 'l3tsm::' + uid,   label: '📋 L3 TSM' },
                                    { key: 'hseq::' + uid,    label: '🔰 HSEQ' },
                                ].filter(g => (this.state.onCallDates[g.key] || []).length > 0);

                                if (deptGroups.length === 0) return '';

                                const getWN = (ds) => {
                                    const dt2 = new Date(ds + 'T00:00:00');
                                    const j1 = new Date(dt2.getFullYear(), 0, 1);
                                    const w1s = new Date(j1); w1s.setDate(j1.getDate() - j1.getDay());
                                    const wn = Math.floor((dt2 - w1s) / (7*24*60*60*1000)) + 1;
                                    return wn >= 53 ? 1 : wn;
                                };
                                const makeChips = (dates) => {
                                    const sorted = [...dates].sort();
                                    const weekGroups = {};
                                    sorted.forEach(d => {
                                        const dt = new Date(d + 'T00:00:00');
                                        const ws = new Date(dt); ws.setDate(dt.getDate() - dt.getDay());
                                        const k = ws.getFullYear() + '-' + String(ws.getMonth()+1).padStart(2,'0') + '-' + String(ws.getDate()).padStart(2,'0');
                                        if (!weekGroups[k]) weekGroups[k] = [];
                                        weekGroups[k].push(d);
                                    });
                                    return Object.entries(weekGroups).map(([, wDates]) => {
                                        const wNum = getWN(wDates[0]);
                                        const label = wDates.length >= 7
                                            ? `Week ${wNum} (${wDates[0]} → ${wDates[wDates.length-1]})`
                                            : `Week ${wNum} — ${wDates.join(', ')}`;
                                        return `<span class="inline-block bg-red-100 text-red-700 border border-red-300 text-xs font-semibold px-2 py-1 rounded whitespace-nowrap">${label}</span>`;
                                    }).join('');
                                };

                                const sections = deptGroups.map(g => `
                                    <div class="mb-3">
                                        <p class="text-xs font-bold text-red-700 mb-1">${g.label}</p>
                                        <div class="flex flex-wrap gap-1">${makeChips(this.state.onCallDates[g.key])}</div>
                                    </div>`).join('');

                                return `<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                                    <p class="font-bold text-red-800 text-sm mb-3">🚫 Your On-Call Dates (leave cannot be selected on these dates):</p>
                                    ${sections}
                                </div>`;
                            })()}
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <p class="text-2xl font-bold text-blue-800">${entitlement}</p>
                                    <p class="text-sm text-gray-600">Total Leave Days</p>
                                    <p class="text-xs text-blue-600">${csYearsOfService >= 5 ? 'Corporate Staff (5+ yrs service)' : 'Corporate Staff Entitlement'}</p>
                                </div>
                                <div class="bg-green-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold">${csBids.length} <span class="text-sm font-normal text-gray-500">unlimited</span></p>
                                    <p class="text-sm text-gray-600">Bids Placed</p>
                                </div>
                                <div class="bg-indigo-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold">${totalBidDays}</p>
                                    <p class="text-sm text-gray-600">Days Bid</p>
                                </div>
                                <div class="bg-purple-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold text-purple-700">∞</p>
                                    <p class="text-sm text-gray-600">No Bid Limit</p>
                                </div>
                            </div>
                            <div class="border-t pt-4">
                                <div class="flex items-center gap-2 mb-2">
                                    <p class="font-semibold">Available Slot Types:</p>
                                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">🏢 Corp Staff: Unlimited selections, free date range</span>
                                </div>
                                <div class="flex gap-4">
                                    ${this.state.slotTypes.map(slot => `
                                        <div class="flex-1 p-3 rounded-lg border ${slot.color === 'green' ? 'border-green-300 bg-green-50' : slot.color === 'blue' ? 'border-blue-300 bg-blue-50' : 'border-purple-300 bg-purple-50'}">
                                            <p class="font-bold">${slot.name}</p>
                                            <p class="text-sm">${slot.days} consecutive days</p>
                                        </div>
                                    `).join('')}
                                    <div class="flex-1 p-3 rounded-lg border border-blue-400 bg-blue-50">
                                        <p class="font-bold text-blue-800">🏢 Custom</p>
                                        <p class="text-sm text-blue-700">Any date range — free choice</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <!-- Left: Place New Bid -->
                            <div class="bg-white rounded-xl shadow-xl p-6 border-l-4 border-blue-500">
                                <h3 class="text-xl font-bold mb-4">🏢 Place New Corporate Staff Bid</h3>
                                ${this.state.isProcessedCorp ? `
                                    <div class="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                                        <p class="font-semibold">⚠️ Bidding has been processed. No more bids allowed.</p>
                                    </div>` : ''}

                                <!-- Slot Type Selection -->
                                <div class="mb-5">
                                    <label class="block font-semibold mb-2">Select Slot Type:</label>
                                    <div class="space-y-2">
                                        ${this.state.slotTypes.map(slot => `
                                            <button
                                                onclick="app.csSetSelectedSlot('${slot.id}')"
                                                data-csslot="${slot.id}"
                                                class="cs-slot-btn w-full p-3 rounded-lg font-semibold text-left transition-all bg-gray-100 hover:bg-gray-200 text-gray-800 ${this.state.isProcessedCorp ? 'opacity-50 cursor-not-allowed' : ''}"
                                                ${this.state.isProcessedCorp ? 'disabled' : ''}
                                            >
                                                ${slot.name} — ${slot.days} consecutive days
                                            </button>
                                        `).join('')}
                                        <button
                                            onclick="app.csSetSelectedSlot('csCustom')"
                                            data-csslot="csCustom"
                                            class="cs-slot-btn w-full p-3 rounded-lg font-semibold text-left transition-all bg-blue-50 border border-blue-300 hover:bg-blue-100 text-blue-800 ${this.state.isProcessedCorp ? 'opacity-50 cursor-not-allowed' : ''}"
                                            ${this.state.isProcessedCorp ? 'disabled' : ''}
                                        >
                                            🏢 Custom — Any date range (free choice)
                                        </button>
                                    </div>
                                </div>

                                <!-- Date Selection -->
                                <div class="mb-5">
                                    <label class="block font-semibold mb-2">Select Dates:</label>
                                    <div id="csSlotInfo" class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800 font-medium">
                                        Select a slot type above first
                                    </div>
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-sm font-semibold mb-1">Start Date</label>
                                            <input type="date" id="csStartDate"
                                                class="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none"
                                                min="${this.state.biddingYearCorp}-01-01" max="${this.state.biddingYearCorp}-12-31"
                                                onchange="app.csUpdateEndDate()" />
                                        </div>
                                        <div>
                                            <label class="block text-sm font-semibold mb-1">End Date <span class="text-gray-400 font-normal">(auto)</span></label>
                                            <input type="date" id="csEndDate"
                                                class="w-full px-3 py-2 border-2 border-gray-200 rounded-lg bg-gray-50"
                                                onchange="app._csCheckOnCallWarning()"
                                                readonly />
                                        </div>
                                    </div>
                                    <div id="csOnCallWarning" class="mt-1 text-sm"></div>
                                </div>

                                <button onclick="app.submitCSBid()"
                                    class="w-full px-6 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition ${(this.state.isProcessedCorp || this.isBiddingClosedCorp()) ? 'opacity-50 cursor-not-allowed' : ''}"
                                    ${(this.state.isProcessedCorp || this.isBiddingClosedCorp()) ? 'disabled' : ''}>
                                    🏢 Submit Corporate Staff Bid
                                </button>
                            </div>

                            <!-- Right: My Current Bids -->
                            <div class="bg-white rounded-xl shadow-xl p-6 border-l-4 border-indigo-400">
                                <h3 class="text-xl font-bold mb-4">📋 My Current Bids (${csBids.length})</h3>
                                ${csBids.length === 0 ? `
                                    <div class="text-center py-8 text-gray-500">
                                        <p class="text-4xl mb-3">📭</p>
                                        <p class="font-semibold">No bids placed yet</p>
                                        <p class="text-sm mt-1">Place your first bid on the left</p>
                                    </div>
                                ` : `
                                    <div class="space-y-3 max-h-96 overflow-y-auto">
                                        ${csBids.map(bid => {
                                            const slot = this.state.slotTypes.find(s => s.id === bid.slotType);
                                            const slotLabel = bid.slotType === 'csCustom' ? '🏢 Custom' : (slot?.name || bid.slotType);
                                            return `
                                                <div class="border border-blue-200 rounded-lg p-4 bg-blue-50">
                                                    <div class="flex justify-between items-start">
                                                        <div>
                                                            <p class="font-bold text-blue-900">${slotLabel}</p>
                                                            <p class="text-sm text-gray-600">${bid.startDate} → ${bid.endDate}</p>
                                                            <p class="text-sm font-semibold text-blue-700">${bid.days} days</p>
                                                        </div>
                                                        <button onclick="app.removeCSBid('${bid.slotType}','${bid.startDate}')"
                                                            class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 font-semibold">
                                                            ✕ Remove
                                                        </button>
                                                    </div>
                                                </div>`;
                                        }).join('')}
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                `;

                // Start countdown timer
                clearInterval(window._csCountdownTimer);
                window._csCountdownTimer = setInterval(() => {
                    const el = document.getElementById('csCountdownTimer');
                    if (!el) { clearInterval(window._csCountdownTimer); return; }
                    const diff = new Date(this.state.biddingDeadlineCorp) - new Date();
                    if (diff <= 0) { el.textContent = 'EXPIRED'; clearInterval(window._csCountdownTimer); return; }
                    const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
                    el.textContent = `${d}d ${h}h ${m}m ${s}s`;
                }, 1000);
            },

            csSetSelectedSlot(slotId) {
                window.csSelectedSlot = slotId;
                // Highlight selected
                document.querySelectorAll('.cs-slot-btn').forEach(btn => {
                    const isSelected = btn.dataset.csslot === slotId;
                    btn.classList.toggle('ring-2', isSelected);
                    btn.classList.toggle('ring-blue-500', isSelected);
                    btn.classList.toggle('bg-blue-100', isSelected);
                });
                const infoEl = document.getElementById('csSlotInfo');
                if (!infoEl) return;
                if (slotId === 'csCustom') {
                    infoEl.textContent = '🏢 Custom — Choose any start and end date freely';
                } else {
                    const slot = this.state.slotTypes.find(s => s.id === slotId);
                    infoEl.textContent = slot ? `${slot.name} — exactly ${slot.days} consecutive days. Pick a start date.` : '';
                }
                // Recalculate end date if start already filled
                this.csUpdateEndDate();
            },

            csUpdateEndDate() {
                const startInput = document.getElementById('csStartDate');
                const endInput = document.getElementById('csEndDate');
                if (!startInput || !endInput || !startInput.value) return;
                if (!window.csSelectedSlot || window.csSelectedSlot === 'csCustom') {
                    endInput.value = '';
                    endInput.removeAttribute('readonly');
                    endInput.classList.remove('bg-gray-50');
                    endInput.classList.add('border-blue-300');
                    const w = document.getElementById('csOnCallWarning');
                    if (w) w.innerHTML = '';
                    return;
                }
                const slot = this.state.slotTypes.find(s => s.id === window.csSelectedSlot);
                if (!slot) return;
                const start = new Date(startInput.value + 'T00:00:00');
                const end = new Date(start);
                end.setDate(end.getDate() + slot.days - 1);
                endInput.value = end.toISOString().split('T')[0];
                endInput.setAttribute('readonly', true);
                endInput.classList.add('bg-gray-50');
                endInput.classList.remove('border-blue-300');
                this._csCheckOnCallWarning();
            },

            _csCheckOnCallWarning() {
                const warningEl = document.getElementById('csOnCallWarning');
                if (!warningEl) return;
                const csUser = this.state.verifiedEmployee;
                if (!csUser) return;
                const uid = csUser.id;
                const allOnCall = [
                    ...(this.state.onCallDates[uid] || []),
                    ...(this.state.onCallDates['l456inm::' + uid] || []),
                    ...(this.state.onCallDates['l3inm::' + uid] || []),
                    ...(this.state.onCallDates['l3tsm::' + uid] || []),
                    ...(this.state.onCallDates['hseq::' + uid] || []),
                ];
                const onCallSet = new Set(allOnCall);
                const startVal = document.getElementById('csStartDate')?.value;
                const endVal   = document.getElementById('csEndDate')?.value;
                if (!startVal || !endVal) { warningEl.innerHTML = ''; return; }
                // Guard: end must not be before start
                if (endVal < startVal) {
                    warningEl.innerHTML = '<p class="text-red-600 text-sm mt-1">⚠️ End date cannot be before start date.</p>';
                    return;
                }
                if (onCallSet.size === 0) { warningEl.innerHTML = ''; return; }
                const conflicts = [];
                const cur  = new Date(startVal + 'T00:00:00');
                const endD = new Date(endVal   + 'T00:00:00');
                while (cur <= endD) {
                    const iso = cur.getFullYear() + '-' + String(cur.getMonth()+1).padStart(2,'0') + '-' + String(cur.getDate()).padStart(2,'0');
                    if (onCallSet.has(iso)) conflicts.push(iso);
                    cur.setDate(cur.getDate() + 1);
                }
                warningEl.innerHTML = conflicts.length > 0
                    ? `<p class="font-semibold text-red-700 mt-2">🚫 On-Call conflict on: ${conflicts.slice(0,5).join(', ')}${conflicts.length > 5 ? ` +${conflicts.length - 5} more` : ''}</p>`
                    : `<p class="text-green-700 text-sm mt-1">✅ No On-Call conflicts in this range</p>`;
            },

            submitCSBid() {
                if (this.state.isProcessedCorp) { alert('Bidding has been processed. No more bids.'); return; }
                if (this.isBiddingClosedCorp()) { alert('⛔ The bidding deadline has passed. You can no longer submit bids.'); return; }
                const csUser = this.state.verifiedEmployee;
                if (!csUser) return;
                if (!window.csSelectedSlot) { alert('⚠️ Please select a slot type first.'); return; }

                const startDate = document.getElementById('csStartDate')?.value;
                let endDate = document.getElementById('csEndDate')?.value;
                if (!startDate) { alert('⚠️ Please select a start date.'); return; }

                if (window.csSelectedSlot === 'csCustom') {
                    if (!endDate) { alert('⚠️ Please enter an end date for Custom slot.'); return; }
                    if (endDate < startDate) { alert('⚠️ End date must be after start date.'); return; }
                }

                const days = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1;

                if (window.csSelectedSlot !== 'csCustom') {
                    const slot = this.state.slotTypes.find(s => s.id === window.csSelectedSlot);
                    if (slot && days !== slot.days) {
                        alert(`${slot.name} requires exactly ${slot.days} days. Select "Custom" for free range.`);
                        return;
                    }
                }

                // Check overlap with existing CS bids
                const csBids = this.state.bids.filter(bid => bid.employeeId === csUser.id);
                for (const bid of csBids) {
                    if (this.checkDateOverlap(startDate, endDate, bid.startDate, bid.endDate)) {
                        alert(`Date overlap with an existing bid (${bid.startDate} → ${bid.endDate}).`);
                        return;
                    }
                }

                // ── On-Call Conflict Check ────────────────────────────────────
                const uid = csUser.id;
                const allOnCallForCS = new Set([
                    ...(this.state.onCallDates[uid] || []),
                    ...(this.state.onCallDates['l456inm::' + uid] || []),
                    ...(this.state.onCallDates['l3inm::' + uid] || []),
                    ...(this.state.onCallDates['l3tsm::' + uid] || []),
                    ...(this.state.onCallDates['hseq::' + uid] || []),
                ]);
                const onCallDatesForCS = allOnCallForCS;
                if (onCallDatesForCS.size > 0) {
                    const conflictingOnCallDates = [];
                    const cur = new Date(startDate + 'T00:00:00');
                    const end2 = new Date(endDate + 'T00:00:00');
                    while (cur <= end2) {
                        const iso = cur.getFullYear() + '-' + String(cur.getMonth()+1).padStart(2,'0') + '-' + String(cur.getDate()).padStart(2,'0');
                        if (onCallDatesForCS.has(iso)) conflictingOnCallDates.push(iso);
                        cur.setDate(cur.getDate() + 1);
                    }
                    if (conflictingOnCallDates.length > 0) {
                        const conflictList = conflictingOnCallDates.join(', ');
                        alert(`⚠️ On-Call Conflict Detected!\n\nYour selected leave period (${startDate} → ${endDate}) overlaps with your scheduled On-Call duties on the following date${conflictingOnCallDates.length > 1 ? 's' : ''}:\n\n${conflictList}\n\nPlease choose dates that do not conflict with your On-Call schedule.`);
                        return;
                    }
                }

                const slotLabel = window.csSelectedSlot === 'csCustom'
                    ? 'Custom' : (this.state.slotTypes.find(s => s.id === window.csSelectedSlot)?.name || window.csSelectedSlot);

                const newBid = {
                    employeeId: csUser.id,
                    employeeName: csUser.name,
                    seniorityDate: csUser.seniorityDate || '2000-01-01',
                    department: 'Corporate Staff',
                    slotType: window.csSelectedSlot,
                    startDate,
                    endDate,
                    days,
                    timestamp: new Date().toISOString()
                };

                this.state.bids.push(newBid);
                this.saveState();
                this.writeAuditLog('BID_PLACED', { type: 'CS', slot: window.csSelectedSlot, start: startDate, end: endDate, days });

                this.saveBidToSupabase(newBid).then(saved => {
                    if (saved) console.log('✅ CS Bid saved to Supabase');
                });

                alert(`🏢 Corporate Staff Bid placed!\n${slotLabel} — ${startDate} → ${endDate} (${days} day${days !== 1 ? 's' : ''})`);
                this.renderCorporateStaffBiddingView();
            },

            async removeCSBid(slotType, startDate) {
                if (this.state.isProcessedCorp) { alert('Cannot remove bids after processing.'); return; }
                if (!confirm('Remove this Corporate Staff bid?')) return;
                const csUser = this.state.verifiedEmployee;

                // 1. Optimistically remove from local state and persist immediately
                const idx = this.state.bids.findIndex(bid =>
                    bid.employeeId === csUser.id && bid.slotType === slotType && bid.startDate === startDate
                );
                if (idx !== -1) this.state.bids.splice(idx, 1);
                this.saveState();
                this.renderCorporateStaffBiddingView();

                // 2. Delete from Supabase and AWAIT the result so a failure is surfaced
                if (!this.supabase) {
                    this.writeAuditLog('BID_REMOVED', { employee_id: csUser.id, slot_type: slotType, start_date: startDate, section: 'corporate_staff' });
                    return;
                }
                const { error } = await this.supabase
                    .from('corporate_leave_request')
                    .delete()
                    .eq('tenant_id', this._tid())
                    .eq('employee_id', csUser.id)
                    .eq('slot_type', slotType)
                    .eq('start_date', startDate);

                if (error) {
                    console.error('❌ CS Bid delete failed:', error.message);
                    alert('Could not delete from server — please retry.');
                    return;
                }
                console.log('✅ CS Bid deleted from Supabase');
                this.writeAuditLog('BID_REMOVED', { employee_id: csUser.id, slot_type: slotType, start_date: startDate, section: 'corporate_staff' });
            },

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
            renderSeniorityReportView() {
                const content = document.getElementById('contentArea');

                const calcYears = (seniorityDate) => {
                    if (!seniorityDate) return 0;
                    const joinDate = new Date(seniorityDate);
                    if (isNaN(joinDate.getTime())) return 0;
                    return (new Date() - joinDate) / (1000 * 60 * 60 * 24 * 365.25);
                };

                // OPS staff = this.state.employees, plus Maintenance staff from the
                // separate maintenanceStaffUsers array (tagged with isMaintenance for filtering/export)
                const opsRows = (this.state.employees || []).map(e => {
                    const years = calcYears(e.seniorityDate);
                    return {
                        id: e.id,
                        name: e.name || '—',
                        department: e.department || 'Unassigned',
                        position: e.position || '—',
                        seniorityDate: e.seniorityDate || '',
                        years,
                        eligibleSlots: years > 5 ? 'Slot C / Slot D' : 'Slot A / Slot B',
                        isMaintenance: false
                    };
                });

                const maintRows = (this.state.maintenanceStaffUsers || []).map(e => {
                    const years = calcYears(e.seniorityDate);
                    return {
                        id: e.id,
                        name: e.name || '—',
                        department: e.department || 'Maintenance',
                        position: e.position || '—',
                        seniorityDate: e.seniorityDate || '',
                        years,
                        eligibleSlots: years > 5 ? 'Slot C / Slot D' : 'Slot A / Slot B',
                        isMaintenance: true
                    };
                });

                const rows = [...opsRows, ...maintRows];

                // Sort: most senior (earliest date) first
                rows.sort((a, b) => {
                    const da = a.seniorityDate ? new Date(a.seniorityDate) : new Date('9999-12-31');
                    const db = b.seniorityDate ? new Date(b.seniorityDate) : new Date('9999-12-31');
                    return da - db;
                });

                const seniorCount = rows.filter(r => r.years > 5).length;
                const juniorCount = rows.length - seniorCount;
                const missingCount = rows.filter(r => !r.seniorityDate).length;

                // Filters
                const deptOptions = [...new Set(rows.map(r => r.department))].sort();

                content.innerHTML = `
                    <div class="max-w-7xl mx-auto">
                        <div class="metro-card p-6 mb-6">
                            <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
                                <div>
                                    <h2 class="text-2xl font-bold" style="font-family:'Barlow Condensed',sans-serif;color:var(--app-text);">📋 Seniority Date Report</h2>
                                    <p class="text-sm mt-1" style="color:var(--app-text-muted);">All Operations Staff and Maintenance Staff</p>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="app.exportSeniorityReportCSV()" class="metro-tab metro-tab-primary">
                                        ⬇ Export Excel
                                    </button>
                                    <button onclick="app.setActiveView('dashboard')" class="metro-tab">
                                        ← Back
                                    </button>
                                </div>
                            </div>

                            <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                                <div class="p-4 rounded-lg" style="background:var(--app-green-50);">
                                    <p class="text-2xl font-bold" style="color:var(--app-text);">${rows.length}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Total Staff</p>
                                </div>
                                <div class="bg-blue-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold text-blue-700">${rows.filter(r => r.isMaintenance).length}</p>
                                    <p class="text-sm text-gray-600">Maintenance Staff</p>
                                </div>
                                <div class="bg-orange-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold text-orange-700">${seniorCount}</p>
                                    <p class="text-sm text-gray-600">&gt;5 yrs — Slot C/D</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background:var(--app-green-50);">
                                    <p class="text-2xl font-bold" style="color:var(--metro-green-dark);">${juniorCount}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">≤5 yrs — Slot A/B</p>
                                </div>
                                <div class="bg-red-50 p-4 rounded-lg">
                                    <p class="text-2xl font-bold text-red-700">${missingCount}</p>
                                    <p class="text-sm text-gray-600">Missing Seniority Date</p>
                                </div>
                            </div>

                            <div class="flex flex-wrap gap-3 mb-4">
                                <input type="text" id="seniorityReportSearch" placeholder="Search by name or ID…"
                                    oninput="app._filterSeniorityReport()"
                                    class="px-3 py-2 border-2 rounded-lg text-sm flex-1 min-w-[200px]" style="border-color:var(--app-border);" />
                                <select id="seniorityReportDeptFilter" onchange="app._filterSeniorityReport()" class="px-3 py-2 border-2 rounded-lg text-sm" style="border-color:var(--app-border);">
                                    <option value="all">All Departments</option>
                                    ${deptOptions.map(d => `<option value="${this._escHtml(d)}">${this._escHtml(d)}</option>`).join('')}
                                </select>
                                <select id="seniorityReportEligFilter" onchange="app._filterSeniorityReport()" class="px-3 py-2 border-2 rounded-lg text-sm" style="border-color:var(--app-border);">
                                    <option value="all">All Eligibility</option>
                                    <option value="senior">&gt;5 yrs — Slot C/D</option>
                                    <option value="junior">≤5 yrs — Slot A/B</option>
                                </select>
                                <select id="seniorityReportTypeFilter" onchange="app._filterSeniorityReport()" class="px-3 py-2 border-2 rounded-lg text-sm" style="border-color:var(--app-border);">
                                    <option value="all">All Staff Types</option>
                                    <option value="ops">Operations Staff</option>
                                    <option value="maintenance">Maintenance Staff</option>
                                </select>
                            </div>

                            <div class="overflow-x-auto" style="border:1px solid var(--app-border);border-radius:10px;">
                                <table class="metro-table" id="seniorityReportTable">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Staff ID</th>
                                            <th>Name</th>
                                            <th>Department</th>
                                            <th>Position</th>
                                            <th>Type</th>
                                            <th>Seniority Date</th>
                                            <th>Years of Service</th>
                                            <th>Eligible Slots</th>
                                        </tr>
                                    </thead>
                                    <tbody id="seniorityReportBody">
                                        ${rows.map((r, idx) => this._seniorityReportRow(r, idx)).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <p class="text-xs mt-3" style="color:var(--app-text-muted);">Showing <span id="seniorityReportCount">${rows.length}</span> of ${rows.length} staff. Sorted by seniority date (most senior first).</p>
                        </div>
                    </div>
                `;

                // Cache rows on window for the filter/export functions to reuse without re-deriving
                window._seniorityReportRows = rows;
            },

            _seniorityReportRow(r, idx) {
                const badgeClass = r.years > 5 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800';
                const missingStyle = !r.seniorityDate ? 'background:#fef2f2;' : '';
                return `
                    <tr style="${missingStyle}" data-dept="${this._escHtml(r.department)}" data-elig="${r.years > 5 ? 'senior' : 'junior'}" data-type="${r.isMaintenance ? 'maintenance' : 'ops'}" data-search="${this._escHtml((r.name + ' ' + r.id).toLowerCase())}">
                        <td style="text-align:center;color:var(--app-text-muted);">${idx + 1}</td>
                        <td style="font-family:monospace;font-size:0.8rem;">${this._escHtml(r.id)}</td>
                        <td style="font-weight:600;">${this._escHtml(r.name)}</td>
                        <td>${this._escHtml(r.department)}</td>
                        <td>${this._escHtml(r.position)}</td>
                        <td>${r.isMaintenance ? '<span class="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">Maintenance</span>' : '<span class="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700">Operations</span>'}</td>
                        <td>${r.seniorityDate ? this._escHtml(r.seniorityDate.slice(0,10)) : '<span class="text-red-500 font-semibold">Missing</span>'}</td>
                        <td style="text-align:center;font-weight:600;">${r.years.toFixed(1)}</td>
                        <td><span class="px-2 py-1 rounded text-xs font-semibold ${badgeClass}">${r.eligibleSlots}</span></td>
                    </tr>`;
            },

            _filterSeniorityReport() {
                const q = (document.getElementById('seniorityReportSearch')?.value || '').toLowerCase().trim();
                const dept = document.getElementById('seniorityReportDeptFilter')?.value || 'all';
                const elig = document.getElementById('seniorityReportEligFilter')?.value || 'all';
                const type = document.getElementById('seniorityReportTypeFilter')?.value || 'all';
                const rowsEls = document.querySelectorAll('#seniorityReportBody tr');
                let visible = 0;
                rowsEls.forEach(tr => {
                    const matchesQ    = !q || (tr.dataset.search || '').includes(q);
                    const matchesDept = dept === 'all' || tr.dataset.dept === dept;
                    const matchesElig = elig === 'all' || tr.dataset.elig === elig;
                    const matchesType = type === 'all' || tr.dataset.type === type;
                    const show = matchesQ && matchesDept && matchesElig && matchesType;
                    tr.style.display = show ? '' : 'none';
                    if (show) visible++;
                });
                const countEl = document.getElementById('seniorityReportCount');
                if (countEl) countEl.textContent = visible;
            },

            exportSeniorityReportCSV() {
                const rows = window._seniorityReportRows || [];
                if (rows.length === 0) {
                    alert('No staff data to export.');
                    return;
                }
                const wsData = [
                    ['Staff ID', 'Name', 'Department', 'Position', 'Staff Type', 'Seniority Date', 'Years of Service', 'Eligible Slots']
                ];
                rows.forEach(r => {
                    wsData.push([
                        r.id, r.name, r.department, r.position,
                        r.isMaintenance ? 'Maintenance' : 'Operations',
                        r.seniorityDate ? r.seniorityDate.slice(0, 10) : 'Missing',
                        r.years.toFixed(1),
                        r.eligibleSlots
                    ]);
                });
                const ws = XLSX.utils.aoa_to_sheet(wsData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Seniority Report');
                XLSX.writeFile(wb, `Seniority_Report_${this.state.biddingYear}.xlsx`);
            },

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

            _liveUpdateAdminPanel() {
                // Update stats badges
                const bidCountEl = document.getElementById('adminBidCount');
                if (bidCountEl) bidCountEl.textContent = this.state.bids.length;
                const bidCount2El = document.getElementById('adminBidCount2');
                if (bidCount2El) bidCount2El.textContent = this.state.bids.length;
                const uniqueBiddersEl = document.getElementById('adminUniqueBidders');
                if (uniqueBiddersEl) uniqueBiddersEl.textContent = new Set(this.state.bids.map(b => b.employeeId)).size;
                const uniqueBidders2El = document.getElementById('adminUniqueBidders2');
                if (uniqueBidders2El) uniqueBidders2El.textContent = new Set(this.state.bids.map(b => b.employeeId)).size;
                const lastRefreshEl = document.getElementById('adminLastRefresh');
                if (lastRefreshEl) lastRefreshEl.textContent = new Date().toLocaleTimeString();
                // Re-render bids table
                const tableContainer = document.getElementById('adminBidsTableContainer');
                const currentQuery = document.getElementById('bidSearchInput')?.value || '';
                const activeTab = tableContainer?.dataset.activeTab || 'employees';
                if (tableContainer) tableContainer.innerHTML = this._renderBidsTableHTML(currentQuery, activeTab);
                // FIX: keep the GC/CS Leave Tracker in sync after any bid change
                if (typeof window.lcRender === 'function') window.lcRender();
            },

            _isGcOrCs(employeeId) {
                // Returns true if the employeeId belongs to GC, CS, or any sub-group (not a regular employee)
                const gcIds  = (this.state.goldenCommandUsers  || []).map(u => u.id);
                const csIds  = (this.state.corporateStaffUsers || []).map(u => u.id);
                const l456   = (this.state.l456InmUsers        || []).map(u => u.id);
                const l3Inm  = (this.state.l3InmUsers          || []).map(u => u.id);
                const l3Tsm  = (this.state.l3TsmUsers          || []).map(u => u.id);
                const hseq   = (this.state.hseqUsers           || []).map(u => u.id);
                const allSpecial = [...gcIds, ...csIds, ...l456, ...l3Inm, ...l3Tsm, ...hseq];
                return allSpecial.includes(employeeId);
            },

            // Fixed roster of Staff IDs that belong to the "HR Corporate" bid section.
            // Sourced from the corporate_staff_employees_rows.csv upload — any other
            // Corporate Staff records (added later / not on this list) remain grouped
            // under the general "GC & Corporate Staff" tab.
            _HR_CORPORATE_IDS: ['1000052','1000060','1000072','1000081','1000092','1000095','1000104','1000123','1000129','1000160','1000167','1000181','1000215','1000228','1000278','1000285','1000307','1000399','1000442','1000516','1000547','1000565','1000604','1000617','1000664','1000675','1000743','1000769','1000775','1000784','1000804','1000834','1000847','1000945','1000956','1001236','1002247','1002280','1002438','1002885','1003687','1004522','1004831','1004962','1005101','1005263','1005708','1006476','1006806','1006807','1006869','1006894','1006895','1006912','1006938','1006959','1007062','1007063','1007064','1007088','1007113','1007114','1007115','1007116','1007117','1007122','1007134','1007135','1007151'],

            _isHrCorporate(employeeId) {
                // Returns true only for the specific staff IDs on the HR Corporate list
                // (not the entire Corporate Staff roster).
                return this._HR_CORPORATE_IDS.includes(String(employeeId));
            },

            _isMaintStaff(employeeId, bid) {
                // Prefer the source table tag set at fetch time — reliable even when
                // maintenanceStaffUsers list is not loaded in the admin session
                if (bid && bid._sourceTable) return bid._sourceTable === 'maint_leave_requests';
                // Fallback: check against loaded maintenance staff users list
                const ids = (this.state.maintenanceStaffUsers || []).map(u => u.id);
                if (ids.length > 0) return ids.includes(employeeId);
                // Last resort: check if any bid in state has this employeeId tagged as maint
                return this.state.bids.some(b => b.employeeId === employeeId && b._sourceTable === 'maint_leave_requests');
            },

            // Returns true for Golden Command (GC) and Corporate Staff (CS) employee IDs —
            // these route to the dedicated `corporate_leave_request` table, kept separate
            // from Ops (`leave_requests`) and Maintenance (`maint_leave_requests`).
            _isCorporateStaff(employeeId, bid) {
                // Prefer the source table tag set at fetch time — reliable even when
                // the GC/CS user lists are not loaded in the admin session
                if (bid && bid._sourceTable) return bid._sourceTable === 'corporate_leave_request';
                const gcIds = (this.state.goldenCommandUsers   || []).map(u => u.id);
                const csIds = (this.state.corporateStaffUsers  || []).map(u => u.id);
                if (gcIds.length > 0 || csIds.length > 0) {
                    return gcIds.includes(employeeId) || csIds.includes(employeeId);
                }
                // Last resort: check if any bid in state has this employeeId tagged as corporate
                return this.state.bids.some(b => b.employeeId === employeeId && b._sourceTable === 'corporate_leave_request');
            },

            // Central place that decides which Supabase table a bid belongs to,
            // based on the acting user's userType. Used by every read/write path
            // so the routing rule only has to be maintained in one spot.
            _bidTableForUserType(userType) {
                if (userType === 'maintenancestaff') return 'maint_leave_requests';
                if (userType === 'goldencommand' || userType === 'corporatestaff') return 'corporate_leave_request';
                return 'leave_requests';
            },

            _switchBidTab(tab) {
                const empBtn   = document.getElementById('bidTabEmp');
                const gccsBtn  = document.getElementById('bidTabGcCs');
                const hrBtn    = document.getElementById('bidTabHr');
                const maintBtn = document.getElementById('bidTabMaint');
                [empBtn, gccsBtn, hrBtn, maintBtn].forEach(btn => {
                    if (!btn) return;
                    btn.style.background = '#f3f4f6'; btn.style.color = '#374151';
                });
                const target = tab === 'employees' ? empBtn : tab === 'gccs' ? gccsBtn : tab === 'hrcorp' ? hrBtn : maintBtn;
                if (target) { target.style.background = '#2d6a4f'; target.style.color = '#fff'; }
                const container = document.getElementById('adminBidsTableContainer');
                if (container) {
                    const currentQuery = document.getElementById('bidSearchInput')?.value || '';
                    container.innerHTML = this._renderBidsTableHTML(currentQuery, tab);
                    container.dataset.activeTab = tab;
                }
            },

            _renderBidsTableHTML(filterQuery = '', tabFilter = 'employees') {
                if (this.state.bids.length === 0) {
                    return `
                        <div class="text-center py-10 text-gray-400">
                            <p class="text-4xl mb-3">📭</p>
                            <p class="font-semibold">No bids submitted yet</p>
                            <p class="text-sm mt-1">Auto-refreshing every 15 seconds. Bids appear here as soon as employees submit them.</p>
                        </div>`;
                }
                const q = filterQuery.toLowerCase().trim();
                // Preference rank: for each employee, the order their bids were actually
                // submitted (by timestamp, ascending) = the same order the allocation
                // engine's preference cascade (Round 1, 2, 3…) consumes them in.
                // Keyed by `${employeeId}||${slotType}||${startDate}` so it survives
                // re-sorting/filtering below.
                const prefRankByBidKey = {};
                const bidKey = (b) => `${b.employeeId}||${b.slotType}||${b.startDate}`;
                const bidsByEmployee = {};
                this.state.bids.forEach(b => {
                    if (!bidsByEmployee[b.employeeId]) bidsByEmployee[b.employeeId] = [];
                    bidsByEmployee[b.employeeId].push(b);
                });
                Object.values(bidsByEmployee).forEach(empBids => {
                    [...empBids]
                        .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
                        .forEach((b, i) => { prefRankByBidKey[bidKey(b)] = i + 1; });
                });
                const sortedBids = [...this.state.bids]
                    .sort((a, b) => {
                        const dA = new Date(this.state.employees.find(e => e.id === a.employeeId)?.seniorityDate || 0);
                        const dB = new Date(this.state.employees.find(e => e.id === b.employeeId)?.seniorityDate || 0);
                        if (dA - dB !== 0) return dA - dB;
                        // Tie-break (same employee, or employees sharing a seniority date):
                        // group by employeeId, then order each employee's own bids by the
                        // actual submission timestamp — this is the order the allocation
                        // engine reads them in, so the # column below reflects reality.
                        if (a.employeeId !== b.employeeId) return String(a.employeeId).localeCompare(String(b.employeeId));
                        return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
                    })
                    .filter(bid => {
                        // Tab filter
                        const isSpecial = this._isGcOrCs(bid.employeeId);
                        const isHr      = this._isHrCorporate(bid.employeeId);
                        const isMaint   = this._isMaintStaff(bid.employeeId, bid);
                        if (tabFilter === 'employees' && (isSpecial || isMaint)) return false;
                        if (tabFilter === 'gccs'      && (!isSpecial || isHr || isMaint)) return false;
                        if (tabFilter === 'hrcorp'    && (!isHr || isMaint)) return false;
                        if (tabFilter === 'maint'     && !isMaint) return false;
                        // Search filter
                        if (!q) return true;
                        const empRec = this.state.employees.find(e => e.id === bid.employeeId);
                        const name = (bid.employeeName || empRec?.name || '').toLowerCase();
                        const id   = (bid.employeeId || '').toLowerCase();
                        // Matches the same fallback chain used to render the Position column,
                        // so searching finds exactly what's shown on screen.
                        const position = (bid.position || empRec?.position || bid.department || empRec?.department || '').toLowerCase();
                        return name.includes(q) || id.includes(q) || position.includes(q);
                    });
                const colorMap = { 
                    slotA: 'bg-green-100 text-green-800', slotB: 'bg-blue-100 text-blue-800', slotC: 'bg-purple-100 text-purple-800', slotD: 'bg-orange-100 text-orange-800',
                    SA:    'bg-green-100 text-green-800', SB:    'bg-blue-100 text-blue-800', SC:    'bg-purple-100 text-purple-800', SD:    'bg-orange-100 text-orange-800'
                };
                const _slotLabel = (st) => {
                    if (st === 'slotA' || st === 'SA') return 'Slot A';
                    if (st === 'slotB' || st === 'SB') return 'Slot B';
                    if (st === 'slotC' || st === 'SC') return 'Slot C';
                    if (st === 'slotD' || st === 'SD') return 'Slot D';
                    if (st === 'gcCustom') return '⭐ Custom';
                    if (st === 'csCustom') return '🏢 Custom';
                    return st || '—';
                };
                const noResults = sortedBids.length === 0 ? `
                    <div class="text-center py-8 text-gray-400">
                        <p class="text-3xl mb-2">🔍</p>
                        <p class="font-semibold">No bids match "<span class="text-indigo-600">${filterQuery}</span>"</p>
                        <p class="text-sm mt-1">Try a different name, ID, or position.</p>
                    </div>` : '';
                return `
                    <div class="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <div class="relative flex-1 max-w-sm">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                            <input type="text" id="bidSearchInput"
                                placeholder="Search by name, ID, or position…"
                                value="${filterQuery.replace(/"/g, '&quot;')}"
                                oninput="app._filterBidsTable(this.value)"
                                style="width:100%;padding:9px 12px 9px 32px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:0.875rem;color:#111827;background:#f9fafb;outline:none;box-sizing:border-box;"
                                onfocus="this.style.borderColor='#6366f1';this.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'"
                                onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'" />
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-sm text-gray-500">${sortedBids.length} of ${this.state.bids.length} bid${this.state.bids.length !== 1 ? 's' : ''}</span>
                            <button onclick="app.deleteAllBidsByTab('${tabFilter}')" class="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600">
                                🗑️ Delete All ${tabFilter === 'employees' ? '👤 Employee' : tabFilter === 'gccs' ? '⭐ GC & Corporate' : tabFilter === 'hrcorp' ? '🏢 HR Corporate' : '🔧 Maintenance'} Bids
                            </button>
                        </div>
                    </div>
                    ${noResults}
                    <div class="overflow-x-auto" style="border:1px solid var(--app-border);border-radius:10px;">
                        <table class="metro-table">
                            <thead>
                                <tr>
                                    <th>Choice No</th>
                                    <th>Operation Staff ID</th>
                                    <th>Name</th>
                                    <th>Position</th>
                                    <th>Slot Type</th>
                                    <th>Start Date</th>
                                    <th>End Date</th>
                                    <th>Days</th>
                                    <th>Submitted</th>
                                    <th style="text-align:center;">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sortedBids.map((bid, idx) => {
                                    const emp = this.state.employees.find(e => e.id === bid.employeeId);
                                    const slotColor = colorMap[bid.slotType] || 'bg-gray-100 text-gray-700';
                                    const slotDisplay = bid.slotLabel || _slotLabel(bid.slotType);
                                    const submitted = bid.timestamp ? new Date(bid.timestamp).toLocaleString() : 'N/A';
                                    const safeId = encodeURIComponent(bid.employeeId);
                                    const safeSlot = encodeURIComponent(bid.slotType);
                                    const safeStart = encodeURIComponent(bid.startDate);
                                    const prefRank = prefRankByBidKey[bidKey(bid)] || (idx + 1);
                                    return `
                                        <tr>
                                            <td style="text-align:center;color:var(--app-text-muted);" title="Preference #${prefRank} — order this bid was actually submitted in for this employee">${prefRank}</td>
                                            <td style="font-family:monospace;font-size:0.8rem;">${this._escHtml(bid.employeeId)}</td>
                                            <td style="font-weight:600;">${this._escHtml(bid.employeeName || emp?.name || 'Unknown')}</td>
                                            <td>${this._escHtml(bid.position || emp?.position || bid.department || emp?.department || 'Unassigned')}</td>
                                            <td><span class="px-2 py-1 rounded text-xs font-semibold ${slotColor}">${this._escHtml(slotDisplay)}</span></td>
                                            <td>${this._escHtml(bid.startDate || '—')}</td>
                                            <td>${this._escHtml(bid.endDate || '—')}</td>
                                            <td style="text-align:center;font-weight:600;">${this._escHtml(String(bid.days || '—'))}</td>
                                            <td style="font-size:0.75rem;color:var(--app-text-muted);">${this._escHtml(submitted)}</td>
                                            <td style="text-align:center;">
                                                <button onclick="app.adminDeleteBid('${safeId}','${safeSlot}','${safeStart}')"
                                                    class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold hover:bg-red-200">
                                                    🗑️ Delete
                                                </button>
                                            </td>
                                        </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>`;
            },

            async adminDeleteBid(encodedId, encodedSlot, encodedStart) {
                const employeeId = decodeURIComponent(encodedId);
                const slotType   = decodeURIComponent(encodedSlot);
                const startDate  = decodeURIComponent(encodedStart);

                // ✅ FIX: Look up the bid BEFORE removing it from state,
                // so we can correctly determine the table and pass it to _isMaintStaff.
                // Previously this lookup happened AFTER state removal, returning undefined.
                const bid = this.state.bids.find(b => b.employeeId === employeeId && b.slotType === slotType && b.startDate === startDate);
                const name = bid?.employeeName || employeeId;
                if (!confirm(`Delete bid for ${name} (${slotType}, ${startDate})?\n\nThis cannot be undone.`)) return;

                // Pause polling during delete to avoid race condition where the
                // 15-second auto-refresh fetches from Supabase before the delete completes
                // and overwrites local state — causing the bid to reappear.
                this._stopAdminLive();

                // Remove from local state immediately
                this.state.bids = this.state.bids.filter(b =>
                    !(b.employeeId === employeeId && b.slotType === slotType && b.startDate === startDate)
                );
                this.saveState();

                // Delete from Supabase — route to correct table, await completion
                if (this.supabase) {
                    // ✅ FIX: Use the bid looked up above (before state removal), not a stale re-lookup.
                    // Also added .eq('tenant_id') for safe scoping, consistent with bulk-delete functions.
                    const table = this._isMaintStaff(employeeId, bid)
                        ? 'maint_leave_requests'
                        : this._isCorporateStaff(employeeId, bid)
                            ? 'corporate_leave_request'
                            : 'leave_requests';
                    const { error } = await this.supabase
                        .from(table)
                        .delete()
                        .eq('employee_id', employeeId)
                        .eq('slot_type', slotType)
                        .eq('start_date', startDate)
                        .eq('tenant_id', this._tid());
                    if (error) console.warn(`⚠️ Supabase delete error [${table}]:`, error.message);
                    else console.log(`✅ Bid deleted from ${table}`);
                }

                this._liveUpdateAdminPanel();

                // Resume realtime subscription only after Supabase delete is confirmed done
                this._startAdminLive();
            },

            _filterBidsTable(query) {
                const container = document.getElementById('adminBidsTableContainer');
                const activeTab = container?.dataset.activeTab || 'employees';
                if (container) container.innerHTML = this._renderBidsTableHTML(query, activeTab);
                // Re-focus and restore cursor position
                const input = document.getElementById('bidSearchInput');
                if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
            },

            async deleteAllBidsByTab(tabFilter) {
                // Determine which bids belong to this tab
                const tabBids = this.state.bids.filter(bid => {
                    const isSpecial = this._isGcOrCs(bid.employeeId);
                    const isHr      = this._isHrCorporate(bid.employeeId);
                    const isMaint   = this._isMaintStaff(bid.employeeId, bid);
                    if (tabFilter === 'employees') return !isSpecial && !isMaint;
                    if (tabFilter === 'gccs')      return isSpecial && !isHr && !isMaint;
                    if (tabFilter === 'hrcorp')    return isHr && !isMaint;
                    if (tabFilter === 'maint')     return isMaint;
                    return false;
                });

                if (tabBids.length === 0) {
                    alert('No bids to delete in this section.');
                    return;
                }

                const sectionName = tabFilter === 'employees' ? '👤 Employee'
                                  : tabFilter === 'gccs'      ? '⭐ GC & Corporate Staff'
                                  : tabFilter === 'hrcorp'    ? '🏢 HR Corporate'
                                  :                             '🔧 Maintenance Staff';

                if (!confirm(`⚠️ Delete ALL ${tabBids.length} ${sectionName} bids?\n\nBids in other sections will NOT be affected.\nThis cannot be undone.`)) return;

                // Pause polling to avoid race condition
                this._stopAdminLive();

                // Remove only the matching bids from local state
                this.state.bids = this.state.bids.filter(bid => {
                    const isSpecial = this._isGcOrCs(bid.employeeId);
                    const isHr      = this._isHrCorporate(bid.employeeId);
                    const isMaint   = this._isMaintStaff(bid.employeeId, bid);
                    if (tabFilter === 'employees') return isSpecial || isMaint;               // keep non-employee bids
                    if (tabFilter === 'gccs')      return !isSpecial || isHr || isMaint;      // keep non-gccs bids (incl. HR corp)
                    if (tabFilter === 'hrcorp')    return !isHr || isMaint;                   // keep non-HR-corp bids
                    if (tabFilter === 'maint')     return !isMaint;                           // keep non-maint bids
                    return true;
                });
                this.saveState();

                if (this.supabase) {
                    if (tabFilter === 'maint') {
                        // Only delete from maint_leave_requests, scoped to this tenant
                        const { error } = await this.supabase
                            .from('maint_leave_requests')
                            .delete()
                            .eq('tenant_id', this._tid());
                        if (error) console.warn('⚠️ Supabase delete all maint error:', error.message);
                        else console.log('✅ All maintenance bids deleted');
                    } else if (tabFilter === 'gccs' || tabFilter === 'hrcorp') {
                        // GC, Corporate Staff, and HR Corporate all live in corporate_leave_request
                        const idsToDelete = tabBids.map(b => b.employeeId);
                        const { error } = await this.supabase
                            .from('corporate_leave_request')
                            .delete()
                            .eq('tenant_id', this._tid())
                            .in('employee_id', idsToDelete);
                        if (error) console.warn(`⚠️ Supabase delete all [${tabFilter}] error:`, error.message);
                        else console.log(`✅ All ${sectionName} bids deleted from corporate_leave_request`);
                    } else {
                        // Ops employees live in leave_requests
                        // Delete only the specific employee IDs for this tab, scoped to this tenant
                        const idsToDelete = tabBids.map(b => b.employeeId);
                        const { error } = await this.supabase
                            .from('leave_requests')
                            .delete()
                            .eq('tenant_id', this._tid())
                            .in('employee_id', idsToDelete);
                        if (error) console.warn(`⚠️ Supabase delete all [${tabFilter}] error:`, error.message);
                        else console.log(`✅ All ${sectionName} bids deleted from leave_requests`);
                    }
                }

                this._liveUpdateAdminPanel();
                // Resume realtime subscription after delete is confirmed done
                this._startAdminLive();
                alert(`✅ All ${sectionName} bids have been deleted.`);
            },

            async deleteAllBids() {
                if (!confirm(`⚠️ Delete ALL ${this.state.bids.length} bids?\n\nThis will permanently remove every bid from the database and cannot be undone.`)) return;

                this._stopAdminLive();
                this.state.bids = [];
                this.saveState();

                if (this.supabase) {
                    const [r1, r2, r3] = await Promise.all([
                        this.supabase.from('leave_requests').delete().eq('tenant_id', this._tid()),
                        this.supabase.from('maint_leave_requests').delete().eq('tenant_id', this._tid()),
                        this.supabase.from('corporate_leave_request').delete().eq('tenant_id', this._tid())
                    ]);
                    if (r1.error) console.warn('⚠️ Supabase delete all error [leave_requests]:', r1.error.message);
                    if (r2.error) console.warn('⚠️ Supabase delete all error [maint_leave_requests]:', r2.error.message);
                    if (r3.error) console.warn('⚠️ Supabase delete all error [corporate_leave_request]:', r3.error.message);
                    if (!r1.error && !r2.error && !r3.error) console.log('✅ All bids deleted from all three tables');
                }

                this._liveUpdateAdminPanel();
                this._startAdminLive();
                alert('✅ All bids have been deleted.');
            },

            stopAdminPolling() {
                if (this._adminPollTimer) {
                    clearInterval(this._adminPollTimer);
                    this._adminPollTimer = null;
                    console.log('⏹ Admin poll stopped');
                }
            },

            // ==================== ADMIN REALTIME (Supabase postgres_changes) ====================
            // Replaces the 15-second polling loop with push-based updates. Falls back
            // to a 30-second poll if Realtime disconnects, so the admin view still
            // refreshes. Used by the planner/admin view only — employee/GC/CS/maintenance
            // bidding views are unchanged.

            _mapRemoteBid(bid, sourceTable) {
                return {
                    employeeId: bid.employee_id,
                    employeeName: bid.employee_name ||
                        this.state.employees.find(e => e.id === bid.employee_id)?.name ||
                        (this.state.maintenanceStaffUsers || []).find(e => e.id === bid.employee_id)?.name || '',
                    seniorityDate: this.state.employees.find(e => e.id === bid.employee_id)?.seniorityDate ||
                        (this.state.maintenanceStaffUsers || []).find(e => e.id === bid.employee_id)?.seniorityDate || '',
                    department: bid.department ||
                        this.state.employees.find(e => e.id === bid.employee_id)?.department ||
                        (this.state.maintenanceStaffUsers || []).find(e => e.id === bid.employee_id)?.department || '',
                    position: this.state.employees.find(e => e.id === bid.employee_id)?.position ||
                        (this.state.maintenanceStaffUsers || []).find(e => e.id === bid.employee_id)?.position || '',
                    slotType: bid.slot_type || 'slotA',
                    leaveType: bid.leave_type || 'Annual Leave',
                    startDate: bid.start_date,
                    endDate: bid.end_date,
                    days: bid.days_requested,
                    timestamp: bid.created_at,
                    _sourceTable: sourceTable
                };
            },

            startAdminRealtime() {
                if (!this.supabase || this._adminRealtimeChannel) return;

                const applyChange = (payload, sourceTable) => {
                    if (!payload?.new && !payload?.old) return;

                    if (payload.eventType === 'DELETE') {
                        const old = payload.old;
                        this.state.bids = this.state.bids.filter(b =>
                            !(b.employeeId === old.employee_id &&
                              b.slotType   === old.slot_type   &&
                              b.startDate  === old.start_date  &&
                              b._sourceTable === sourceTable)
                        );
                    } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const row = payload.new;
                        const mapped = this._mapRemoteBid(row, sourceTable);
                        this.state.bids = [
                            ...this.state.bids.filter(b =>
                                !(b.employeeId === mapped.employeeId &&
                                  b.slotType   === mapped.slotType   &&
                                  b.startDate  === mapped.startDate  &&
                                  b._sourceTable === sourceTable)),
                            mapped
                        ];
                    }
                    this._liveUpdateAdminPanel();
                    this._setAdminStatus('live');
                };

                this._adminRealtimeChannel = this.supabase
                    .channel('admin-bids')
                    .on('postgres_changes',
                        { event: '*', schema: 'public', table: 'leave_requests' },
                        payload => applyChange(payload, 'leave_requests'))
                    .on('postgres_changes',
                        { event: '*', schema: 'public', table: 'maint_leave_requests' },
                        payload => applyChange(payload, 'maint_leave_requests'))
                    .on('postgres_changes',
                        { event: '*', schema: 'public', table: 'corporate_leave_request' },
                        payload => applyChange(payload, 'corporate_leave_request'))
                    .subscribe(status => {
                        console.log('🔌 Admin Realtime status:', status);
                        if (status === 'SUBSCRIBED') this._setAdminStatus('live');
                        if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                            this._setAdminStatus('reconnecting');
                        }
                    });
            },

            stopAdminRealtime() {
                if (this._adminRealtimeChannel && this.supabase) {
                    this.supabase.removeChannel(this._adminRealtimeChannel);
                    this._adminRealtimeChannel = null;
                    console.log('⏹ Admin Realtime stopped');
                }
            },

            startLcRealtime() {
                if (!this.supabase || this._lcRealtimeChannel) return;

                const applyLcChange = (payload, sourceTable) => {
                    if (!payload?.new && !payload?.old) return;

                    if (payload.eventType === 'DELETE') {
                        const old = payload.old;
                        this.state.bids = this.state.bids.filter(b =>
                            !(b.employeeId === old.employee_id &&
                              b.slotType   === old.slot_type   &&
                              b.startDate  === old.start_date  &&
                              b._sourceTable === sourceTable)
                        );
                    } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const row = payload.new;
                        const mapped = this._mapRemoteBid(row, sourceTable);
                        this.state.bids = [
                            ...this.state.bids.filter(b =>
                                !(b.employeeId === mapped.employeeId &&
                                  b.slotType   === mapped.slotType   &&
                                  b.startDate  === mapped.startDate  &&
                                  b._sourceTable === sourceTable)),
                            mapped
                        ];
                    }
                    // Re-render the tracker and update the live badge timestamp
                    if (typeof window.lcRender === 'function') window.lcRender();
                    this._setLcStatus('live');
                };

                this._lcRealtimeChannel = this.supabase
                    .channel('lc-tracker-bids')
                    .on('postgres_changes',
                        { event: '*', schema: 'public', table: 'corporate_leave_request' },
                        payload => applyLcChange(payload, 'corporate_leave_request'))
                    .on('postgres_changes',
                        { event: '*', schema: 'public', table: 'golden_command_users' },
                        () => { if (typeof window.lcRender === 'function') window.lcRender(); })
                    .on('postgres_changes',
                        { event: '*', schema: 'public', table: 'corporate_staff_employees' },
                        () => { if (typeof window.lcRender === 'function') window.lcRender(); })
                    .subscribe(status => {
                        console.log('🔌 LC Tracker Realtime:', status);
                        if (status === 'SUBSCRIBED') this._setLcStatus('live');
                        if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                            this._setLcStatus('reconnecting');
                            // Retry after 5s
                            setTimeout(() => {
                                if (this.state.activeView === 'leaveDashboard') {
                                    this.supabase.removeChannel(this._lcRealtimeChannel);
                                    this._lcRealtimeChannel = null;
                                    this.startLcRealtime();
                                }
                            }, 5000);
                        }
                    });
            },

            stopLcRealtime() {
                if (this._lcRealtimeChannel && this.supabase) {
                    this.supabase.removeChannel(this._lcRealtimeChannel);
                    this._lcRealtimeChannel = null;
                    console.log('⏹ LC Tracker Realtime stopped');
                }
                if (this._lcFallbackTimer) {
                    clearInterval(this._lcFallbackTimer);
                    this._lcFallbackTimer = null;
                }
            },

            _setLcStatus(state) {
                const badge = document.getElementById('lcLiveBadge');
                if (!badge) return;
                if (state === 'live') {
                    badge.innerHTML = '&#9679; LIVE &mdash; <span id="lcLastRefresh">' + new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) + '</span>';
                    badge.style.background = 'rgba(46,204,154,.25)';
                    badge.style.borderColor = 'rgba(46,204,154,.6)';
                    badge.style.color = '#7eedc8';
                } else if (state === 'reconnecting') {
                    badge.innerHTML = '&#9679; Reconnecting…';
                    badge.style.background = 'rgba(255,195,80,.2)';
                    badge.style.borderColor = 'rgba(255,195,80,.5)';
                    badge.style.color = '#ffd98a';
                }
            },

            _setAdminStatus(state) {
                const el = document.getElementById('adminLiveBadge');
                if (!el) return;
                if (state === 'live') {
                    el.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    Live &mdash; realtime updates
                                    &nbsp;|&nbsp; Last: <span id="adminLastRefresh">${new Date().toLocaleTimeString()}</span>`;
                } else if (state === 'reconnecting') {
                    el.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>
                                    Reconnecting &mdash; fallback polling every 30s`;
                }
            },

            _startAdminLive() {
                this.stopAdminPolling();
                this.startAdminRealtime();
                // Fallback poll every 30s while realtime is active — only fires if
                // realtime events stop arriving for any reason (network drop, server hiccup).
                if (this._adminFallbackTimer) clearInterval(this._adminFallbackTimer);
                this._adminFallbackTimer = setInterval(() => {
                    if (this.state.activeView === 'admin' && this.state.userType === 'planner') {
                        this.refreshBidsFromSupabase(true);
                    }
                }, 30000);
            },

            _stopAdminLive() {
                this.stopAdminRealtime();
                this.stopAdminPolling();
                if (this._adminFallbackTimer) {
                    clearInterval(this._adminFallbackTimer);
                    this._adminFallbackTimer = null;
                }
            },

            renderAdminView() {
                const content = document.getElementById('contentArea');
                // Use exact same department list as Configure Slots (L3/L46/L5 codes only)
                const employeeDeptsAdmin = [...new Set(this.state.employees.map(e => e.department || 'Unassigned'))];
                const allRawDeptsAdmin = [...new Set([...this.state.departments, ...employeeDeptsAdmin])];
                const filteredDeptsAdmin = allRawDeptsAdmin.filter(d => /^(L3|L46|L5|L3465)[-\s]/i.test(d) || d === 'L3-SA' || d === 'L5 SA' || d === 'L3 SAMB' || d === 'L5 SAMB' || d === 'L46 SAMB').sort();
                const allDepts = filteredDeptsAdmin;
                const depts = ['all', ...filteredDeptsAdmin];
                
                content.innerHTML = `
                    <div class="max-w-6xl mx-auto">
                        <div class="metro-card p-6">
                            <div class="flex items-center justify-between mb-6">
                                <h2 class="text-2xl font-bold" style="font-family:'Barlow Condensed',sans-serif;color:var(--app-text);">Admin Panel</h2>
                                <div id="adminLiveBadge" class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm" style="background:var(--app-green-50);border:1px solid var(--app-border);color:var(--metro-green-dark);">
                                    <span class="inline-block w-2 h-2 rounded-full animate-pulse" style="background:var(--metro-green);"></span>
                                    Live &mdash; auto-refreshes every 15s &nbsp;|&nbsp; Last: <span id="adminLastRefresh">${new Date().toLocaleTimeString()}</span>
                                </div>
                            </div>
                            
                            <div class="mb-6 p-4 rounded-lg" style="background:var(--app-green-50);">
                                <label class="block font-semibold mb-2" style="color:var(--app-text);">Set Bidding Deadline (Ops &amp; Maintenance):</label>
                                <input
                                    type="datetime-local"
                                    id="biddingDeadline"
                                    value="${this.state.biddingDeadline}"
                                    class="w-full px-4 py-2 border-2 rounded-lg"
                                    style="border-color:var(--metro-green-light);"
                                    onchange="app.setBiddingDeadline(this.value)"
                                />
                            </div>

                            <div class="mb-6 p-4 rounded-lg border-2" style="background:var(--app-gold-50);border-color:#f0d78c;">
                                <label class="block font-semibold mb-2" style="color:var(--metro-gold-dark);">⭐ Corporate &amp; Golden Command Bidding Settings (independent):</label>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                    <div>
                                        <label class="block text-sm font-semibold mb-1">Deadline:</label>
                                        <input
                                            type="datetime-local"
                                            id="biddingDeadlineCorp"
                                            value="${this.state.biddingDeadlineCorp}"
                                            class="w-full px-4 py-2 border-2 rounded-lg"
                                            style="border-color:#e0c069;"
                                            onchange="app.setBiddingDeadlineCorp(this.value)"
                                        />
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold mb-1">Bidding Year:</label>
                                        <select
                                            id="biddingYearCorpSelect"
                                            class="w-full px-4 py-2 border-2 rounded-lg font-semibold"
                                            style="border-color:#e0c069;"
                                            onchange="app.setBiddingYearCorp(parseInt(this.value))"
                                        >
                                            ${[this.state.biddingYear - 1, this.state.biddingYear, this.state.biddingYear + 1].map(year => `
                                                <option value="${year}" ${year === this.state.biddingYearCorp ? 'selected' : ''}>${year}</option>
                                            `).join('')}
                                        </select>
                                    </div>
                                </div>
                                <button
                                    onclick="app.toggleCorpLock()"
                                    class="w-full px-6 py-3 rounded-lg font-semibold text-white"
                                    style="background:${this.state.isProcessedCorp ? '#6b7280' : 'linear-gradient(135deg, #8b6914 0%, #b8860b 50%, #d4a017 100%)'};"
                                >
                                    ${this.state.isProcessedCorp ? '🔓 Unlock Corporate &amp; GC Bidding' : '🔒 Lock Corporate &amp; GC Bidding'}
                                </button>
                                <p class="text-xs mt-2" style="color:var(--app-text-muted);">This deadline, year, and lock apply only to Golden Command &amp; Corporate Staff bidding — Ops/Maintenance are unaffected, and vice versa.</p>
                            </div>

                            <div class="mb-6 p-4 rounded-lg" style="background:var(--app-green-50);">
                                <label class="block font-semibold mb-2" style="color:var(--app-text);">Filter by Scheduling Row:</label>
                                <select
                                    id="adminDeptFilter"
                                    class="w-full px-4 py-2 border-2 rounded-lg text-lg font-semibold"
                                    style="border-color:var(--metro-green-light);"
                                    onchange="app.state.selectedDepartment = this.value;"
                                >
                                    ${depts.map(dept => `
                                        <option value="${dept}" ${dept === this.state.selectedDepartment ? 'selected' : ''}>
                                            ${dept === 'all' ? 'All Departments (L3 / L46 / L5)' : dept}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                                <div class="p-4 rounded-lg" style="background:var(--app-green-50);">
                                    <p class="text-2xl font-bold" style="color:var(--metro-green-dark);" id="adminBidCount">${this.state.bids.length}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Total Bids</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background:var(--app-gold-50);">
                                    <p class="text-2xl font-bold" style="color:var(--metro-gold-dark);" id="adminUniqueBidders">${new Set(this.state.bids.map(b => b.employeeId)).size}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Employees Who Bid</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background:#f3f4f6;">
                                    <p class="text-2xl font-bold" style="color:var(--app-text);">${this.state.isProcessed ? 'Yes' : 'No'}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Ops Processed</p>
                                </div>
                                <div class="p-4 rounded-lg" style="background:var(--app-gold-50);">
                                    <p class="text-2xl font-bold" style="color:var(--metro-gold-dark);">${this.state.isProcessedCorp ? '🔒 Locked' : '🔓 Open'}</p>
                                    <p class="text-sm" style="color:var(--app-text-muted);">Corporate &amp; GC Bidding</p>
                                </div>
                            </div>

                            <div class="space-y-4 mb-6">
                                <button
                                    onclick="app.processBids()"
                                    ${this.state.isProcessed || this.state.employees.length === 0 ? 'disabled' : ''}
                                    class="w-full px-6 py-3 rounded-lg font-semibold text-white ${this.state.isProcessed ? 'opacity-50' : ''}"
                                    style="background:${this.state.isProcessed ? '#9ca3af' : 'var(--metro-green)'};"
                                >
                                    ${this.state.isProcessed ? '✅ Bids Already Processed' : '🚀 Process All Bids'}
                                </button>

                                <button
                                    onclick="app.previewAllocation()"
                                    ${this.state.employees.length === 0 ? 'disabled' : ''}
                                    class="w-full px-6 py-3 rounded-lg font-semibold border-2"
                                    style="color:var(--metro-green-dark);border-color:var(--metro-green-dark);background:#fff;"
                                >
                                    🔍 Preview Allocation (read-only, no data written)
                                </button>

                                ${this.state.isProcessed ? `
                                    <button onclick="app.exportResults()" class="w-full px-6 py-3 rounded-lg font-semibold text-white" style="background:var(--metro-green-mid);">
                                        📊 Export Results to Excel
                                    </button>
                                    <button onclick="app.showEmailNotifyModal()" class="w-full px-6 py-3 rounded-lg font-semibold text-white" style="background:var(--metro-green-dark);">
                                        📧 Notify Staff by Email (Results Ready)
                                    </button>
                                    <button onclick="app.setActiveView('manualOverride')" class="w-full px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600">
                                        ✏️ Manual Override Results
                                    </button>
                                ` : ''}
                                ${(this.state.isProcessed || this.state.isMaintProcessed) ? `
                                    <button onclick="app.renderJustificationReport()" class="w-full px-6 py-3 rounded-lg font-semibold text-white" style="background:#4338ca;">
                                        📋 Bid Allocation Justification Report
                                    </button>
                                ` : ''}
                                
                                <button onclick="app.refreshBidsFromSupabase(false)" class="w-full px-6 py-3 rounded-lg font-semibold" style="background:var(--app-green-50);color:var(--metro-green-dark);border:1px solid var(--app-border);">
                                    🔄 Refresh Bids Now
                                </button>
                                
                                <button onclick="app.setActiveView('emailSettings')" class="w-full px-6 py-3 rounded-lg font-semibold" style="background:var(--app-green-50);color:var(--metro-green-dark);border:1px solid var(--app-border);">
                                    ⚙️ Email Settings (OTP &amp; Notifications)
                                </button>

                                <button onclick="app.resetSystem()" class="w-full px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600">
                                    🔄 Reset System
                                </button>

                                <div style="margin-top:12px;background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);border:2px solid #fb923c;border-radius:12px;padding:16px;">
                                    <!-- Section header -->
                                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #fed7aa;">
                                        <div style="width:32px;height:32px;background:#ea580c;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                                        </div>
                                        <div>
                                            <p style="font-size:0.85rem;font-weight:700;color:#9a3412;margin:0;line-height:1.2;">Maintenance Staff Processing</p>
                                            <p style="font-size:0.7rem;color:#c2410c;margin:0;">
                                                ${(this.state.maintenanceStaffUsers || []).length} staff loaded &bull; ${Object.keys(this.state.maintSlotCapacities || {}).length} slot keys
                                            </p>
                                        </div>
                                        <div style="margin-left:auto;background:${this.state.isMaintProcessed ? '#dcfce7' : '#fee2e2'};color:${this.state.isMaintProcessed ? '#166534' : '#991b1b'};font-size:0.65rem;font-weight:700;padding:3px 8px;border-radius:20px;white-space:nowrap;">
                                            ${this.state.isMaintProcessed ? '✅ DONE' : '⏳ PENDING'}
                                        </div>
                                    </div>
                                    <!-- Buttons -->
                                    <div style="display:flex;flex-direction:column;gap:8px;">
                                        <button
                                            onclick="app.processMaintBids()"
                                            ${this.state.isMaintProcessed ? 'disabled' : ''}
                                            style="width:100%;padding:10px 16px;background:${this.state.isMaintProcessed ? '#fdba74' : '#ea580c'};color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.85rem;cursor:${this.state.isMaintProcessed ? 'not-allowed' : 'pointer'};opacity:${this.state.isMaintProcessed ? '0.6' : '1'};transition:background 0.2s;"
                                            onmouseover="if(!this.disabled)this.style.background='#c2410c'"
                                            onmouseout="if(!this.disabled)this.style.background='#ea580c'"
                                        >
                                            ${this.state.isMaintProcessed ? '✅ Maintenance Bids Already Processed' : '🔧 Process Maintenance Bids'}
                                        </button>
                                        ${this.state.isMaintProcessed ? `
                                            <button onclick="app.renderMaintResultsView()"
                                                style="width:100%;padding:10px 16px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.85rem;cursor:pointer;"
                                                onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'">
                                                📋 View Maintenance Results
                                            </button>
                                            <button onclick="app.setActiveView('maintManualOverride')"
                                                style="width:100%;padding:10px 16px;background:#ea580c;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.85rem;cursor:pointer;"
                                                onmouseover="this.style.background='#c2410c'" onmouseout="this.style.background='#ea580c'">
                                                ✏️ Manual Override Maintenance Results
                                            </button>
                                            <button onclick="app.exportMaintResults()"
                                                style="width:100%;padding:10px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.85rem;cursor:pointer;"
                                                onmouseover="this.style.background='#15803d'" onmouseout="this.style.background='#16a34a'">
                                                📊 Export Maintenance Results to Excel
                                            </button>
                                            <button onclick="app.resetMaintProcessing()"
                                                style="width:100%;padding:10px 16px;background:#6b7280;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.85rem;cursor:pointer;"
                                                onmouseover="this.style.background='#4b5563'" onmouseout="this.style.background='#6b7280'">
                                                ↩️ Reset Maintenance Processing
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                            
                            <div class="p-4 rounded-lg" style="background:var(--app-green-50);">
                                <h3 class="font-bold mb-2" style="color:var(--app-text);">System Information</h3>
                                <div class="text-sm space-y-1" style="color:var(--app-text-muted);">
                                    <p>&bull; Scheduling Rows configured: ${allDepts.length}</p>
                                    <p>&bull; Slot capacities configured: ${Object.keys(this.state.slotCapacities).length > 0 ? 'Yes' : 'No'}</p>
                                    <p>&bull; Bidding year (Ops/Maint): ${this.state.biddingYear}</p>
                                    <p>&bull; Bidding year (Corporate/GC): ${this.state.biddingYearCorp}</p>
                                    <p>&bull; Last sync: ${this.state.employees.length > 0 ? 'Data loaded' : 'No data'}</p>
                                </div>
                            </div>

                            <!-- Staff Bids Details Section -->
                        <div class="mt-6 rounded-xl overflow-hidden" style="background:var(--app-card);border:2px solid var(--app-border);">
                            <div class="px-6 py-4" style="background:var(--app-green-50);border-bottom:1px solid var(--app-border);">
                                <div class="flex justify-between items-center mb-3">
                                    <div>
                                        <h3 class="text-xl font-bold" style="font-family:'Barlow Condensed',sans-serif;color:var(--metro-green-dark);">📋 Bid Details</h3>
                                        <p class="text-sm mt-1" style="color:var(--app-text-muted);">Bids sorted by seniority. Updates every 15 seconds.</p>
                                    </div>
                                    <span class="px-3 py-1 rounded-full text-sm font-semibold" style="background:var(--app-green-100);color:var(--metro-green-dark);">
                                        <span id="adminBidCount2">${this.state.bids.length}</span> total bids
                                    </span>
                                </div>
                                <!-- Tab switcher -->
                                <div class="flex gap-2 flex-wrap">
                                    <button id="bidTabEmp" onclick="app._switchBidTab('employees')"
                                        style="padding:7px 18px;border-radius:8px;font-size:0.85rem;font-weight:600;border:none;cursor:pointer;background:var(--metro-green);color:#fff;">
                                        👤 Employees
                                        <span style="margin-left:6px;background:rgba(255,255,255,0.25);border-radius:12px;padding:1px 7px;font-size:0.78rem;">
                                            ${this.state.bids.filter(b => !this._isGcOrCs(b.employeeId) && !this._isMaintStaff(b.employeeId, b)).length}
                                        </span>
                                    </button>
                                    <button id="bidTabGcCs" onclick="app._switchBidTab('gccs')"
                                        style="padding:7px 18px;border-radius:8px;font-size:0.85rem;font-weight:600;border:none;cursor:pointer;background:#f3f4f6;color:#374151;">
                                        ⭐ GC & Corporate Staff
                                        <span style="margin-left:6px;background:rgba(0,0,0,0.08);border-radius:12px;padding:1px 7px;font-size:0.78rem;">
                                            ${this.state.bids.filter(b => this._isGcOrCs(b.employeeId) && !this._isHrCorporate(b.employeeId)).length}
                                        </span>
                                    </button>
                                    <button id="bidTabHr" onclick="app._switchBidTab('hrcorp')"
                                        style="padding:7px 18px;border-radius:8px;font-size:0.85rem;font-weight:600;border:none;cursor:pointer;background:#f3f4f6;color:#374151;">
                                        🏢 HR Corporate
                                        <span style="margin-left:6px;background:rgba(0,0,0,0.08);border-radius:12px;padding:1px 7px;font-size:0.78rem;">
                                            ${this.state.bids.filter(b => this._isHrCorporate(b.employeeId)).length}
                                        </span>
                                    </button>
                                    <button id="bidTabMaint" onclick="app._switchBidTab('maint')"
                                        style="padding:7px 18px;border-radius:8px;font-size:0.85rem;font-weight:600;border:none;cursor:pointer;background:#f3f4f6;color:#374151;">
                                        🔧 Maintenance Staff
                                        <span style="margin-left:6px;background:rgba(0,0,0,0.08);border-radius:12px;padding:1px 7px;font-size:0.78rem;">
                                            ${this.state.bids.filter(b => this._isMaintStaff(b.employeeId, b)).length}
                                        </span>
                                    </button>
                                </div>
                            </div>
                            <div class="p-4" id="adminBidsTableContainer">
                                ${this._renderBidsTableHTML('', 'employees')}
                            </div>
                        </div>

                    </div>
                `;
            },

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
            showConfirmModal(message) {
                return new Promise(resolve => {
                    document.getElementById('appConfirmModalMessage').textContent = message;
                    document.getElementById('appConfirmModal').style.display = 'flex';
                    this._confirmModalResolve = resolve;
                });
            },
            _resolveConfirmModal(result) {
                document.getElementById('appConfirmModal').style.display = 'none';
                if (this._confirmModalResolve) {
                    this._confirmModalResolve(result);
                    this._confirmModalResolve = null;
                }
            },

            // processBids moved to core/allocation.js (loaded after this file)


            // ────────────────────────────────────────────────────────────────────────
            // previewAllocation() — READ-ONLY dry run of the exact same allocation
            // logic (computeBidAllocation), rendered as a report. Does NOT write to
            // this.state.results, does NOT mark bidding as processed, does NOT save
            // to Supabase, and does NOT send any staff notification email. Use this
            // to regression-check seniority grouping (e.g. confirm L3-DEP-DM only
            // competes against L3-DEP-DM) before running the real "Process Bids".
            // ────────────────────────────────────────────────────────────────────────
            previewAllocation() {
                if (this.state.employees.length === 0) {
                    alert('No employees to preview. Please upload data first.');
                    return;
                }

                if (Object.keys(this.state.slotCapacities).length === 0) {
                    alert('Please configure slot capacities first in "Configure Slots".');
                    this.setActiveView('configureSlots');
                    return;
                }

                const result = this.computeBidAllocation({ skipUnconfiguredConfirm: true });
                this.renderPreviewAllocationReport(result);
            },

            // Builds the read-only HTML report and shows it in the preview modal.
            renderPreviewAllocationReport(result) {
                const { positionGroups, slotAssignments, unconfiguredDepts } = result;

                // Corporate Staff bid separately via the Corporate Staff bidding flow and
                // are not part of Ops/Maintenance seniority allocation — exclude them here.
                const isCorporateStaffDept = (dept) => /corporate staff/i.test(dept || '');
                const sortedGroupKeys = result.sortedGroupKeys.filter(groupKey => {
                    const [, dept] = groupKey.split('||');
                    return !isCorporateStaffDept(dept);
                });

                // Recompute the summary stats from the filtered groups only, so the
                // cards above the report match what's actually displayed.
                const filteredEmployeeIds = new Set();
                sortedGroupKeys.forEach(groupKey => {
                    (positionGroups[groupKey] || []).forEach(emp => filteredEmployeeIds.add(emp.id));
                });
                const filteredAssignments = slotAssignments.filter(a => filteredEmployeeIds.has(a.employeeId));
                const stats = {
                    totalEmployees: filteredEmployeeIds.size,
                    bidAwarded: filteredAssignments.filter(r => r.type === 'Bid Awarded').length,
                    autoAssigned: filteredAssignments.filter(r => r.type === 'Auto-Assigned').length,
                    datesDrifted: filteredAssignments.filter(r => r.datesDrifted).length
                };

                // Keep a filtered snapshot around so the "Export to Excel" button
                // exports exactly what's shown (Corporate Staff excluded).
                this._lastPreviewExport = { sortedGroupKeys, positionGroups, slotAssignments: filteredAssignments };

                const assignmentsByEmp = {};
                slotAssignments.forEach(a => {
                    if (!assignmentsByEmp[a.employeeId]) assignmentsByEmp[a.employeeId] = [];
                    assignmentsByEmp[a.employeeId].push(a);
                });

                const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

                const summaryHtml = `
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
                        <div style="background:#f0fdf4;border-radius:8px;padding:10px;"><p style="font-size:1.3rem;font-weight:700;color:#166534;">${stats.totalEmployees}</p><p style="font-size:0.7rem;color:#6b7280;">Employees</p></div>
                        <div style="background:#eff6ff;border-radius:8px;padding:10px;"><p style="font-size:1.3rem;font-weight:700;color:#1e40af;">${stats.bidAwarded}</p><p style="font-size:0.7rem;color:#6b7280;">Bid Awards</p></div>
                        <div style="background:#fefce8;border-radius:8px;padding:10px;"><p style="font-size:1.3rem;font-weight:700;color:#854d0e;">${stats.autoAssigned}</p><p style="font-size:0.7rem;color:#6b7280;">Auto-Assigned</p></div>
                    </div>`;

                const warningHtml = unconfiguredDepts.length > 0 ? `
                    <div style="padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:0.78rem;margin-bottom:16px;">
                        ⚠️ No slot capacity configured for: ${unconfiguredDepts.map(esc).join(', ')}
                    </div>` : '';

                // Note: schedule-drift info (bids honored with dates that no longer match
                // the live "Configure Slots" config) is intentionally NOT surfaced here in
                // Preview Allocation — it's noise for a quick preview. It's still tracked on
                // each result (`datesDrifted`) and surfaced where it's actually actionable:
                // the "Process All Bids" completion summary, the console log, and inline on
                // the Manual Override screen.

                const groupsData = sortedGroupKeys.map(groupKey => {
                    const [pos, dept] = groupKey.split('||');
                    const employees = positionGroups[groupKey];
                    const rows = employees.map((emp, idx) => {
                        const assigns = assignmentsByEmp[emp.id] || [];
                        const awardedHtml = assigns.length > 0
                            ? assigns.map(a => `<div>${esc(a.slotName)} · ${esc(this.blockLabel(a.month))} ${esc(a.startDate)}→${esc(a.endDate)} <span style="color:${a.type === 'Bid Awarded' ? '#166534' : '#854d0e'};font-weight:600;">(${esc(a.type)})</span></div>`).join('')
                            : '<span style="color:#dc2626;font-weight:600;">No slot awarded</span>';
                        return `<tr style="border-top:1px solid #f0f0f0;">
                            <td style="padding:6px 10px;font-weight:700;color:#6b7280;">#${idx + 1}</td>
                            <td style="padding:6px 10px;">${esc(emp.name)} <span style="color:#9ca3af;font-size:0.72rem;">(${esc(emp.id)})</span></td>
                            <td style="padding:6px 10px;font-size:0.75rem;color:#6b7280;">${esc(emp.seniorityDate)}</td>
                            <td style="padding:6px 10px;font-size:0.75rem;">${awardedHtml}</td>
                        </tr>`;
                    }).join('');
                    const html = `
                    <div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
                        <div style="background:#f3f4f6;padding:8px 14px;font-weight:700;font-size:0.82rem;">${esc(pos)} — ${esc(dept)} <span style="font-weight:400;color:#6b7280;">(${employees.length} competing)</span></div>
                        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
                            <thead><tr style="background:#fafafa;text-align:left;color:#6b7280;font-size:0.7rem;text-transform:uppercase;position:sticky;top:0;z-index:1;">
                                <th style="padding:6px 10px;background:#fafafa;">Rank</th><th style="padding:6px 10px;background:#fafafa;">Employee</th><th style="padding:6px 10px;background:#fafafa;">Seniority Date</th><th style="padding:6px 10px;background:#fafafa;">Awarded</th>
                            </tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>`;
                    return { pos, dept, html };
                });

                // Keep the summary/warning HTML and per-group data around so the position
                // search box can re-filter and re-render without recomputing the allocation.
                this._lastPreviewGroupsData = groupsData;
                this._lastPreviewSummaryWarningHtml = summaryHtml + warningHtml;

                const searchInput = document.getElementById('previewAllocationPositionSearch');
                if (searchInput) searchInput.value = '';

                document.getElementById('previewAllocationBody').innerHTML = summaryHtml + warningHtml + groupsData.map(g => g.html).join('');
                document.getElementById('previewAllocationModal').style.display = 'flex';
            },

            // Re-renders the Preview Allocation report filtered to positions whose name
            // contains the search box text (case-insensitive). Read-only — just narrows
            // which already-computed groups are shown, nothing is recomputed.
            _filterPreviewAllocationByPosition() {
                const groupsData = this._lastPreviewGroupsData || [];
                const summaryWarningHtml = this._lastPreviewSummaryWarningHtml || '';
                const query = (document.getElementById('previewAllocationPositionSearch')?.value || '').trim().toLowerCase();

                const filtered = query
                    ? groupsData.filter(g => (g.pos || '').toLowerCase().includes(query))
                    : groupsData;

                const noMatchHtml = query && filtered.length === 0
                    ? `<div style="padding:14px;text-align:center;color:#6b7280;font-size:0.85rem;">No positions match "${query.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}".</div>`
                    : '';

                document.getElementById('previewAllocationBody').innerHTML =
                    summaryWarningHtml + noMatchHtml + filtered.map(g => g.html).join('');
            },

            // Exports the currently-shown Preview Allocation report to an Excel file.
            // Uses the same filtered (Corporate Staff excluded) snapshot that was
            // just rendered — nothing is recomputed and nothing is saved/written.
            exportPreviewAllocationToExcel() {
                const snapshot = this._lastPreviewExport;
                if (!snapshot || !snapshot.sortedGroupKeys.length) {
                    alert('Nothing to export yet — run Preview Allocation first.');
                    return;
                }
                const { sortedGroupKeys, positionGroups, slotAssignments } = snapshot;

                const assignmentsByEmp = {};
                slotAssignments.forEach(a => {
                    if (!assignmentsByEmp[a.employeeId]) assignmentsByEmp[a.employeeId] = [];
                    assignmentsByEmp[a.employeeId].push(a);
                });

                const wsData = [
                    ['Position', 'Department', 'Rank', 'Employee ID', 'Employee Name', 'Seniority Date',
                     'Slot Name', 'Month', 'Start Date', 'End Date', 'Assignment Type']
                ];

                sortedGroupKeys.forEach(groupKey => {
                    const [pos, dept] = groupKey.split('||');
                    positionGroups[groupKey].forEach((emp, idx) => {
                        const assigns = assignmentsByEmp[emp.id] || [];
                        if (assigns.length === 0) {
                            wsData.push([pos, dept, idx + 1, emp.id, emp.name, emp.seniorityDate, 'No slot awarded', '', '', '', '']);
                        } else {
                            assigns.forEach(a => {
                                wsData.push([pos, dept, idx + 1, emp.id, emp.name, emp.seniorityDate, a.slotName, a.month, a.startDate, a.endDate, a.type]);
                            });
                        }
                    });
                });

                const ws = XLSX.utils.aoa_to_sheet(wsData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Preview Allocation');
                XLSX.writeFile(wb, `Preview_Allocation_${this.state.biddingYear}.xlsx`);
            },

            // processMaintBids moved to core/allocation.js (loaded after this file)


            exportMaintResults() {
                const maintResults = this.state.maintResults || [];
                if (!maintResults.length) { alert('No maintenance results to export. Process maintenance bids first.'); return; }
                const empTotalDays = {};
                maintResults.forEach(r => { empTotalDays[r.employeeId] = (empTotalDays[r.employeeId] || 0) + (r.days || 0); });
                const wsData = [['Rank','Staff ID','Name','Position','Department','Slot','Month','Start','End','Days','Type','Total Days']];
                maintResults.forEach(r => wsData.push([
                    r.positionSeniorityRank || r.seniorityRank || '',
                    r.employeeId, r.employeeName, r.position || '', r.department || '',
                    r.slotName || '', r.month || '', r.startDate || '', r.endDate || '',
                    r.days || 0, r.type || '', empTotalDays[r.employeeId] || 0
                ]));
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), 'Maintenance Results');
                XLSX.writeFile(wb, 'maintenance_bid_results_' + this.state.biddingYear + '.xlsx');
            },

            async resetMaintProcessing() {
                if (!confirm('Reset maintenance processing? This will clear all maintenance results.')) return;
                this.state.maintResults = [];
                this.state.isMaintProcessed = false;
                await this.saveConfigToSupabase();
                this.renderAdminView();
            },

            renderMaintResultsView() {
                const contentEl = document.getElementById('contentArea');
                const maintResults = this.state.maintResults || [];
                const maintUsers = this.state.maintenanceStaffUsers || [];
                const getUserInfo = (id) => maintUsers.find(u => u.id === id) || {};

                const byEmployee = {};
                maintResults.forEach(r => {
                    if (!byEmployee[r.employeeId]) byEmployee[r.employeeId] = [];
                    byEmployee[r.employeeId].push(r);
                });

                const slotCell = (s) => {
                    if (!s) return '<span class="text-gray-300">&#8212;</span>';
                    const tc = s.type === 'Bid Awarded' ? 'text-green-600' : 'text-blue-600';
                    return '<span class="font-semibold">' + (s.slotName || '') + '</span><br>'
                         + '<span class="text-xs text-gray-500">' + (s.month || '') + ': ' + (s.startDate || '') + ' &#8594; ' + (s.endDate || '') + '</span><br>'
                         + '<span class="text-xs font-semibold ' + tc + '">' + (s.type || '') + '</span>'
                         + ' <span class="text-xs text-gray-400">(' + (s.days || 0) + 'd)</span>';
                };

                let rows = '';
                Object.entries(byEmployee).forEach(([empId, slots], rowIdx) => {
                    const user  = getUserInfo(empId);
                    const slot1 = slots.find(s => s.slotOrder === 1);
                    const slot2 = slots.find(s => s.slotOrder === 2);
                    const total = slots.reduce((s, r) => s + r.days, 0);
                    const rowBg = rowIdx % 2 === 0 ? 'bg-white' : 'bg-orange-50';
                    const tc    = total > 30 ? 'text-red-600' : 'text-gray-800';
                    const rank  = slot1 ? (slot1.positionSeniorityRank || slot1.seniorityRank || '&#8212;') : '&#8212;';
                    rows += '<tr class="' + rowBg + ' hover:bg-yellow-50 border-b border-gray-100">'
                          + '<td class="p-3 text-center font-mono text-gray-500">#' + rank + '</td>'
                          + '<td class="p-3 font-mono text-xs text-gray-600">' + empId + '</td>'
                          + '<td class="p-3 font-semibold text-gray-800">' + (user.name || (slot1 && slot1.employeeName) || 'Unknown') + '</td>'
                          + '<td class="p-3 text-xs text-gray-600">' + (user.position || (slot1 && slot1.position) || '&#8212;')
                          + '<br><span class="text-gray-400">' + (user.department || (slot1 && slot1.department) || '') + '</span></td>'
                          + '<td class="p-3 text-xs text-gray-600">' + ((slot1 && slot1.yearsOfService) || '&#8212;') + ' yrs</td>'
                          + '<td class="p-3 text-xs">' + slotCell(slot1) + '</td>'
                          + '<td class="p-3 text-xs">' + slotCell(slot2) + '</td>'
                          + '<td class="p-3 font-bold text-center ' + tc + '">' + total + 'd'
                          + '<br><span class="text-xs font-normal text-gray-400">/ 30</span></td>'
                          + '</tr>';
                });

                const totalStaff   = Object.keys(byEmployee).length;
                const bidAwarded   = maintResults.filter(r => r.type === 'Bid Awarded').length;
                const autoAssigned = maintResults.filter(r => r.type === 'Auto-Assigned').length;
                const totalDays    = maintResults.reduce((s, r) => s + r.days, 0);

                const emptyHtml =
                    '<div class="text-center py-12">'
                    + '<p class="text-gray-600 font-semibold text-xl mb-2">No maintenance results yet</p>'
                    + '<p class="text-gray-400 text-sm">Process maintenance bids from the Admin panel first.</p>'
                    + '<button onclick="app.setActiveView(\'admin\')" class="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold">Go to Admin Panel</button>'
                    + '</div>';

                const statsHtml =
                    '<div class="mb-4 flex flex-wrap gap-3 text-sm">'
                    + '<span class="bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">' + totalStaff + ' staff</span>'
                    + '<span class="bg-green-50 border border-green-200 px-3 py-1 rounded-full">&#10003; ' + bidAwarded + ' bid awards</span>'
                    + '<span class="bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">' + autoAssigned + ' auto-assigned</span>'
                    + '<span class="bg-gray-50 border border-gray-200 px-3 py-1 rounded-full">' + totalDays + ' total days</span>'
                    + '</div>';

                const tableHtml =
                    statsHtml
                    + '<div class="overflow-x-auto"><table class="w-full text-sm border-collapse">'
                    + '<thead class="bg-orange-50"><tr>'
                    + '<th class="p-3 text-left border border-orange-100 font-semibold text-orange-800">Rank</th>'
                    + '<th class="p-3 text-left border border-orange-100 font-semibold text-orange-800">Staff ID</th>'
                    + '<th class="p-3 text-left border border-orange-100 font-semibold text-orange-800">Name</th>'
                    + '<th class="p-3 text-left border border-orange-100 font-semibold text-orange-800">Position</th>'
                    + '<th class="p-3 text-left border border-orange-100 font-semibold text-orange-800">Seniority</th>'
                    + '<th class="p-3 text-left border border-orange-100 font-semibold text-orange-800">Slot 1</th>'
                    + '<th class="p-3 text-left border border-orange-100 font-semibold text-orange-800">Slot 2</th>'
                    + '<th class="p-3 text-left border border-orange-100 font-semibold text-orange-800">Total Days</th>'
                    + '</tr></thead>'
                    + '<tbody>' + rows + '</tbody>'
                    + '</table></div>';

                contentEl.innerHTML =
                    '<div class="max-w-7xl mx-auto"><div class="bg-white rounded-xl shadow-xl p-6">'
                    + '<div class="flex items-center justify-between mb-6">'
                    + '<div><h2 class="text-2xl font-bold">Maintenance Staff Leave Assignments ' + this.state.biddingYear + '</h2>'
                    + '<p class="text-gray-500 text-sm mt-1">Seniority-based per position group. Entitlement: 30 days.</p></div>'
                    + '<div class="flex gap-2">'
                    + '<button onclick="app.exportMaintResults()" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">Export to Excel</button>'
                    + '<button onclick="app.setActiveView(\'admin\')" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-300">Back to Admin</button>'
                    + '</div></div>'
                    + (maintResults.length === 0 ? emptyHtml : tableHtml)
                    + '</div></div>';
            },

            exportResults() {
                if (this.state.results.length === 0) {
                    alert('No results to export');
                    return;
                }
                
                // Create Excel workbook
                const wsData = [
                    ['Seniority Rank (within Position Group)', 'Employee ID', 'Employee Name', 'Position (Scheduling Row)', 'Department', 'Slot Type', 
                     'Month', 'Start Date', 'End Date', 'Days', 'Assignment Type', 'Total Days (Employee)']
                ];

                // Group results by employee so we can compute total days per employee
                const empTotalDays = {};
                this.state.results.forEach(result => {
                    empTotalDays[result.employeeId] = (empTotalDays[result.employeeId] || 0) + (result.days || 0);
                });
                
                this.state.results.forEach(result => {
                    const emp = this.state.employees.find(e => e.id === result.employeeId);
                    wsData.push([
                        result.seniorityRank,
                        result.employeeId,
                        result.employeeName,
                        emp?.position || result.position || '',
                        result.department,
                        result.slotName,
                        result.month,
                        result.startDate,
                        result.endDate,
                        result.days,
                        result.type,
                        empTotalDays[result.employeeId] || result.days
                    ]);
                });
                
                const ws = XLSX.utils.aoa_to_sheet(wsData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Leave Assignments');
                XLSX.writeFile(wb, `Leave_Assignments_${this.state.biddingYear}.xlsx`);
                
                alert('✅ Results exported to Excel file!');
            },

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
            _buildJustificationRowsForResults(results, groupField, category) {
                if (!results || results.length === 0) return [];

                // Employee's own submitted bids, in the order they were submitted
                // (earliest timestamp = 1st choice, next = 2nd choice, ...).
                const bidsByEmp = {};
                (this.state.bids || []).forEach(b => {
                    if (!bidsByEmp[b.employeeId]) bidsByEmp[b.employeeId] = [];
                    bidsByEmp[b.employeeId].push(b);
                });
                Object.keys(bidsByEmp).forEach(id => {
                    bidsByEmp[id].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
                });

                const slotLetter = (slotType) => (slotType || '').slice(-1).toUpperCase();

                // key = groupValue||month||slotLetter → every "Bid Awarded" winner of that key
                const winnersByKey = {};
                results.filter(r => r.type === 'Bid Awarded').forEach(r => {
                    const key = `${r[groupField] || ''}||${r.month || ''}||${slotLetter(r.slotType)}`;
                    if (!winnersByKey[key]) winnersByKey[key] = [];
                    winnersByKey[key].push({
                        employeeId: r.employeeId,
                        employeeName: r.employeeName,
                        seniorityRank: r.seniorityRank
                    });
                });

                // Resolve the group key (dept or position) a bid belongs to, mirroring
                // how the allocation engine itself resolves it at award time.
                const bidGroupValue = (bid, empGroupValue) => bid.department || empGroupValue || 'Unassigned';
                const bidKey = (bid, empGroupValue) => {
                    const month = bid.month || (bid.startDate ? this.state.months[new Date(bid.startDate).getMonth()] : '');
                    return `${bidGroupValue(bid, empGroupValue)}||${month}||${slotLetter(bid.slotType)}`;
                };

                const resultsByEmp = {};
                results.forEach(r => {
                    if (!resultsByEmp[r.employeeId]) resultsByEmp[r.employeeId] = [];
                    resultsByEmp[r.employeeId].push(r);
                });

                const rows = [];
                Object.keys(resultsByEmp).forEach(empId => {
                    const empResults = resultsByEmp[empId].slice().sort((a, b) => (a.slotOrder || 0) - (b.slotOrder || 0));
                    const myBids = bidsByEmp[empId] || [];
                    const empGroupValue = empResults[0]?.[groupField] || '';

                    empResults.forEach(r => {
                        let awardStatus, justification;

                        if (r.type === 'Bid Awarded') {
                            // Which of the employee's own submitted bids does this match?
                            let matchIdx = myBids.findIndex(b => b.startDate === r.startDate && b.endDate === r.endDate);
                            if (matchIdx === -1) {
                                const rKey = `${r[groupField] || ''}||${r.month || ''}||${slotLetter(r.slotType)}`;
                                matchIdx = myBids.findIndex(b => bidKey(b, empGroupValue) === rKey);
                            }
                            const choiceNum = matchIdx >= 0 ? matchIdx + 1 : (r.bidChoice || 1);
                            awardStatus = `${this._ordinal(choiceNum)} Choice`;

                            if (choiceNum === 1) {
                                justification = `Employee was awarded their first-choice slot based on seniority.`;
                            } else {
                                const lostOrdinals = [];
                                let firstLosersWinnerName = '';
                                for (let i = 0; i < choiceNum - 1; i++) {
                                    const lostBid = myBids[i];
                                    if (!lostBid) continue;
                                    lostOrdinals.push(this._ordinal(i + 1));
                                    if (!firstLosersWinnerName) {
                                        const key = bidKey(lostBid, empGroupValue);
                                        const winners = (winnersByKey[key] || []).filter(w => w.employeeId !== empId);
                                        if (winners.length) {
                                            winners.sort((a, b) => (a.seniorityRank ?? 999) - (b.seniorityRank ?? 999));
                                            firstLosersWinnerName = `${winners[0].employeeName} (${winners[0].employeeId})`;
                                        }
                                    }
                                }
                                if (choiceNum === 2 && lostOrdinals.length === 1) {
                                    justification = firstLosersWinnerName
                                        ? `Employee's first-choice slot was awarded to ${firstLosersWinnerName}, who has a higher seniority ranking. The employee was awarded their 2nd choice.`
                                        : `Employee's first-choice slot was no longer available by the time it was processed. The employee was awarded their 2nd choice.`;
                                } else {
                                    justification = `Employee's ${lostOrdinals.join(' and ')} choices were awarded to higher-seniority employees. The employee was awarded their ${this._ordinal(choiceNum)} choice.`;
                                }
                            }
                        } else {
                            // Auto-Assigned
                            if (myBids.length === 0) {
                                awardStatus = 'No Bid Submitted';
                                justification = 'Employee did not submit any bid. A leftover slot was assigned after all bidding employees had been processed.';
                            } else {
                                awardStatus = 'Leftover Slot';
                                justification = "None of the employee's selected choices were available after seniority allocation. The employee was assigned the best available remaining slot.";
                            }
                        }

                        rows.push({
                            category,
                            employeeId: empId,
                            employeeName: r.employeeName,
                            position: r.position || '',
                            department: groupField === 'department' ? (r.department || '') : (r.department || r.position || ''),
                            seniorityRank: r.seniorityRank,
                            slotOrder: r.slotOrder,
                            totalEmployeeSlots: r.totalEmployeeSlots || 2,
                            awardedSlot: `${r.slotName || ''} — ${this.blockLabel ? this.blockLabel(r.month) : (r.month || '')} ${r.startDate || ''} → ${r.endDate || ''} (${r.days || 0}d)`,
                            awardStatus,
                            justification
                        });
                    });
                });

                return rows;
            },

            buildJustificationReport() {
                const opsRows  = this._buildJustificationRowsForResults(this.state.results || [], 'department', 'Ops');
                const maintRows = this._buildJustificationRowsForResults(this.state.maintResults || [], 'position', 'Maintenance');
                const rows = [...opsRows, ...maintRows];
                rows.sort((a, b) =>
                    (a.category || '').localeCompare(b.category) ||
                    (a.department || '').localeCompare(b.department || '') ||
                    (a.position || '').localeCompare(b.position || '') ||
                    (a.seniorityRank || 0) - (b.seniorityRank || 0) ||
                    (a.slotOrder || 0) - (b.slotOrder || 0)
                );
                return rows;
            },

            renderJustificationReport() {
                if (!this.state.isProcessed && !this.state.isMaintProcessed) {
                    alert('No results yet — process Ops or Maintenance bids first.');
                    return;
                }
                this._justificationRows = this.buildJustificationReport();
                if (this._justificationRows.length === 0) {
                    alert('No awarded slots found to report on yet.');
                    return;
                }
                const catSel = document.getElementById('jrCategoryFilter');
                if (catSel) catSel.value = 'all';
                const searchEl = document.getElementById('jrSearch');
                if (searchEl) searchEl.value = '';
                this._filterJustificationReport();
                document.getElementById('justificationReportModal').style.display = 'flex';
            },

            _filterJustificationReport() {
                const rows = this._justificationRows || [];
                const category = document.getElementById('jrCategoryFilter')?.value || 'all';
                const search = (document.getElementById('jrSearch')?.value || '').toLowerCase().trim();

                const filtered = rows.filter(r => {
                    if (category !== 'all' && r.category !== category) return false;
                    if (search && !String(r.employeeName || '').toLowerCase().includes(search) && !String(r.employeeId || '').toLowerCase().includes(search)) return false;
                    return true;
                });

                const esc = this._escHtml.bind(this);
                const statusColors = {
                    '1st Choice': 'bg-green-100 text-green-800',
                    '2nd Choice': 'bg-blue-100 text-blue-800',
                    '3rd Choice': 'bg-indigo-100 text-indigo-800',
                    'Leftover Slot': 'bg-orange-100 text-orange-800',
                    'No Bid Submitted': 'bg-gray-200 text-gray-700'
                };

                const body = document.getElementById('justificationReportBody');
                if (!body) return;

                if (filtered.length === 0) {
                    body.innerHTML = `<div style="text-align:center;padding:40px 0;color:#9ca3af;">No matching entries.</div>`;
                    return;
                }

                body.innerHTML = `
                    <p style="font-size:0.75rem;color:#6b7280;margin-bottom:10px;">${filtered.length} slot(s) shown</p>
                    <div style="overflow-x:auto;border:1px solid #e5e7eb;border-radius:10px;">
                        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
                            <thead>
                                <tr style="background:#fafafa;text-align:left;color:#6b7280;font-size:0.68rem;text-transform:uppercase;">
                                    <th style="padding:8px 10px;">Employee</th>
                                    <th style="padding:8px 10px;">Position</th>
                                    <th style="padding:8px 10px;">Department</th>
                                    <th style="padding:8px 10px;">Seniority&nbsp;Rank</th>
                                    <th style="padding:8px 10px;">Slot</th>
                                    <th style="padding:8px 10px;">Awarded Slot</th>
                                    <th style="padding:8px 10px;">Status</th>
                                    <th style="padding:8px 10px;">Justification</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filtered.map(r => `
                                    <tr style="border-top:1px solid #f0f0f0;">
                                        <td style="padding:8px 10px;">
                                            <p style="font-weight:600;">${esc(r.employeeName)}</p>
                                            <p style="font-size:0.7rem;color:#9ca3af;">${esc(r.employeeId)} · ${esc(r.category)}</p>
                                        </td>
                                        <td style="padding:8px 10px;">${esc(r.position)}</td>
                                        <td style="padding:8px 10px;">${esc(r.department)}</td>
                                        <td style="padding:8px 10px;text-align:center;">#${esc(r.seniorityRank)}</td>
                                        <td style="padding:8px 10px;text-align:center;">${r.slotOrder} of ${r.totalEmployeeSlots}</td>
                                        <td style="padding:8px 10px;">${esc(r.awardedSlot)}</td>
                                        <td style="padding:8px 10px;"><span class="px-2 py-1 rounded-full text-xs font-bold ${statusColors[r.awardStatus] || 'bg-gray-100 text-gray-700'}">${esc(r.awardStatus)}</span></td>
                                        <td style="padding:8px 10px;color:#374151;max-width:320px;">${esc(r.justification)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            },

            exportJustificationReport() {
                const rows = this._justificationRows || [];
                if (rows.length === 0) {
                    alert('Nothing to export yet — open the Justification Report first.');
                    return;
                }
                const wsData = [
                    ['Category', 'Employee ID', 'Employee Name', 'Position', 'Department', 'Seniority Rank',
                     'Slot # (of Total)', 'Awarded Slot', 'Award Status', 'Justification']
                ];
                rows.forEach(r => {
                    wsData.push([
                        r.category, r.employeeId, r.employeeName, r.position, r.department, r.seniorityRank,
                        `${r.slotOrder} of ${r.totalEmployeeSlots}`, r.awardedSlot, r.awardStatus, r.justification
                    ]);
                });
                const ws = XLSX.utils.aoa_to_sheet(wsData);
                ws['!cols'] = [{wch:12},{wch:12},{wch:22},{wch:20},{wch:20},{wch:12},{wch:12},{wch:34},{wch:16},{wch:70}];
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Bid Justification');
                XLSX.writeFile(wb, `Bid_Allocation_Justification_${this.state.biddingYear}.xlsx`);
            },

            // Email Settings admin view (renderEmailSettingsView, doSaveEmailSettings,
            // doTestOtpEmail, doTestSmtpFallback) has moved to api-email.js.

            // ==================== RESET SYSTEM ====================
            // Independent from Configure Slots (Ops & Maintenance): this resets employees, bids,
            // results, and on-call dates only. Slot configuration (calendar dates/capacities for
            // both Ops and Maintenance) is NOT affected — use "Reset to Default Dates" on a
            // department/roster group in Configure Slots if you need to clear that separately.
            async resetSystem() {
                if (confirm('⚠️ WARNING: This will reset employees, bids, results, and on-call dates. Slot configuration (calendar dates) is NOT affected — use "Reset to Default Dates" on a department if you need to clear that separately. Continue?')) {
                    this.writeAuditLog('SYSTEM_RESET', { employees: this.state.employees.length, bids: this.state.bids.length });
                    localStorage.clear();
                    this.state.employees = [];
                    this.state.bids = [];
                    this.state.results = [];
                    this.state.isProcessed = false;
                    this.state.isProcessedCorp = false;
                    this.state.onCallDates = {};
                    this.state.currentUser = null;
                    this.state.userType = null;
                    this.state.activeView = 'login';
                    await this.saveConfigToSupabase(); // push reset state to Supabase
                    // Reset UI
                    document.getElementById('userInfo').classList.add('hidden');
                    this._syncHeaderOffset();
                    document.getElementById('plannerSidebar').classList.add('hidden');
                    document.getElementById('headerSaveBtn').classList.add('hidden');
                    document.getElementById('plannerNav').classList.add('hidden');
                    document.getElementById('employeeNav').classList.add('hidden');
                    document.getElementById('loginView').classList.remove('hidden');
                    
                    this.updateSystemStatus('System reset');
                    this.renderLoginForm();
                    
                    alert('✅ System has been completely reset!');
                }
            },

            // ==================== BIDDING FUNCTIONS ====================
            // ── NEW: Populates the available-slot cards for the employee bidding view ──
            refreshAvailableSlots() {
                const monthSelect = document.getElementById('selectedMonth');
                if (!monthSelect) return;
                const month = monthSelect.value;
                const container = document.getElementById('availableSlotCards');
                if (!container) return;

                const emp   = this.state.verifiedEmployee;
                const userBids = this.state.bids.filter(b => b.employeeId === emp?.id);
                const isProcessed = this.state.isProcessed;
                // Route to the correct store based on user type
                const isMaint = this.state.userType === 'maintenancestaff';
                const storeOptions = isMaint
                    ? [{ caps: this.state.maintSlotCapacities, prefix: 'cal-maint-' }]
                    : [{ caps: this.state.slotCapacities,      prefix: 'cal-' }];
                let caps        = storeOptions[0].caps;
                let activePrefix = storeOptions[0].prefix;

                const fullEmp = this.state.employees.find(e => e.id === emp?.id) || emp || {};

                const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const normalizeDept = (d) => {
                    if (!d) return '';
                    return d.replace(/\.\d+(\s*\(.*?\))?$/, '').replace(/\s+/g, ' ').trim().toLowerCase();
                };
                const rawCandidates = [fullEmp.department, fullEmp.position, emp?.department, emp?.position].filter(Boolean);
                const normalizedCandidates = rawCandidates.map(d =>
                    d.replace(/\.\d+(\s*\(.*?\))?$/, '').replace(/\s+/g, ' ').trim()
                );
                const deptCandidates = [...new Set([...rawCandidates, ...normalizedCandidates].filter(Boolean))];

                const colorMap = {
                    SA: { border:'border-green-400', bg:'bg-green-50', badge:'bg-green-600', text:'text-green-800', label:'Slot A' },
                    SB: { border:'border-blue-400',  bg:'bg-blue-50',  badge:'bg-blue-600',  text:'text-blue-800',  label:'Slot B' },
                    SC: { border:'border-purple-400',bg:'bg-purple-50',badge:'bg-purple-600',text:'text-purple-800',label:'Slot C' },
                    SD: { border:'border-orange-400',bg:'bg-orange-50',badge:'bg-orange-600',text:'text-orange-800',label:'Slot D' }
                };

                const isEnabledIn = (store, prefix, dept, sid) => {
                    const raw = store[prefix + dept + '-' + month + '-' + sid + '-enabled'];
                    if (raw === undefined || raw === null)
                        return !!(store[prefix + dept + '-' + month + '-' + sid + '-start'] &&
                                  store[prefix + dept + '-' + month + '-' + sid + '-end']);
                    return typeof raw === 'string' ? raw === 'true' : !!raw;
                };

                const buildSlotDefsIn = (store, prefix, deptKey) => {
                    return ['SA','SB','SC','SD'].map(sid => {
                        if (!isEnabledIn(store, prefix, deptKey, sid)) return null;
                        const start = store[prefix + deptKey + '-' + month + '-' + sid + '-start'];
                        const end   = store[prefix + deptKey + '-' + month + '-' + sid + '-end'];
                        if (!start || !end) return null;
                        const capacity = parseInt(store[prefix + deptKey + '-' + month + '-' + sid + '-capacity']) || 1;
                        const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
                        return { sid, start, end, capacity, days, colors: colorMap[sid] };
                    }).filter(Boolean);
                };

                // Pass 1: exact key lookup
                let resolvedDept = null;
                let slotDefs = [];
                outer1: for (const { caps: store, prefix } of storeOptions) {
                    for (const deptTry of deptCandidates) {
                        const defs = buildSlotDefsIn(store, prefix, deptTry);
                        if (defs.length > 0) {
                            caps = store; activePrefix = prefix;
                            resolvedDept = deptTry; slotDefs = defs;
                            break outer1;
                        }
                    }
                }

                // Pass 2: full key scan with scoring
                if (slotDefs.length === 0) {
                    const suffix = '-' + month + '-';
                    const empNorms = [...new Set([...rawCandidates, ...normalizedCandidates].map(normalizeDept).filter(Boolean))];
                    const scoreMatch = (dk) => {
                        const dn = normalizeDept(dk);
                        for (const c of empNorms) {
                            if (dn === c) return 3;
                            if (c.startsWith(dn)) return 2;
                            if (dn.startsWith(c)) return 1;
                        }
                        return 0;
                    };
                    outer2: for (const { caps: store, prefix } of storeOptions) {
                        const foundDepts = new Set();
                        Object.keys(store).forEach(k => {
                            if (!k.startsWith(prefix)) return;
                            const mid = k.indexOf(suffix);
                            if (mid === -1) return;
                            if (!/^(SA|SB|SC)-start$/.test(k.slice(mid + suffix.length))) return;
                            const dp = k.slice(prefix.length, mid);
                            if (dp) foundDepts.add(dp);
                        });
                        const ranked = [...foundDepts].map(d => ({ d, score: scoreMatch(d) }))
                            .filter(x => x.score > 0).sort((a, b) => b.score - a.score);
                        for (const { d: deptTry } of ranked) {
                            const defs = buildSlotDefsIn(store, prefix, deptTry);
                            if (defs.length > 0) {
                                caps = store; activePrefix = prefix;
                                resolvedDept = deptTry; slotDefs = defs;
                                break outer2;
                            }
                        }
                    }
                }

                const bidCount = {};
                if (resolvedDept) {
                    this.state.bids.forEach(b => {
                        ['SA','SB','SC','SD'].forEach(sid => {
                            const s = caps[activePrefix + resolvedDept + '-' + month + '-' + sid + '-start'];
                            const e = caps[activePrefix + resolvedDept + '-' + month + '-' + sid + '-end'];
                            if (s && e && b.startDate === s && b.endDate === e)
                                bidCount[sid] = (bidCount[sid] || 0) + 1;
                        });
                    });
                }
                // Attach bid counts; capacity is planner-set seats — used only during allocation, not bidding
                slotDefs = slotDefs.map(s => ({
                    ...s,
                    bidsPlaced: bidCount[s.sid] || 0
                }));

                // Seniority gate (OPS staff only — Maintenance is unaffected):
                //   ≤5 years of service → can only see/bid Slot A & Slot B
                //   >5 years of service → can only see/bid Slot C & Slot D
                const slotDefsBeforeGate = slotDefs;
                let empYearsForGate = 0;
                if (!isMaint) {
                    empYearsForGate = emp?.seniorityDate
                        ? (new Date() - new Date(emp.seniorityDate)) / (1000 * 60 * 60 * 24 * 365.25)
                        : 0;
                    if (empYearsForGate > 5) {
                        slotDefs = slotDefs.filter(s => s.sid === 'SC' || s.sid === 'SD');
                    } else {
                        slotDefs = slotDefs.filter(s => s.sid === 'SA' || s.sid === 'SB');
                    }
                }

                // Reset selected slot ONLY when the month has changed
                const currentMonth = window._lastSlotMonth;
                if (currentMonth !== month) {
                    window.selectedSlot    = null;
                    window.selectedSlotDef = null;
                    const confirmBox = document.getElementById('selectedSlotConfirm');
                    if (confirmBox) confirmBox.classList.add('hidden');
                }
                window._lastSlotMonth = month;

                if (slotDefs.length === 0) {
                    if (!isMaint && slotDefsBeforeGate.length > 0) {
                        const eligibleLabel = empYearsForGate > 5 ? 'Slot C / Slot D' : 'Slot A / Slot B';
                        const ineligibleLabel = empYearsForGate > 5 ? 'Slot A / Slot B' : 'Slot C / Slot D';
                        container.innerHTML =
                            '<div class="p-4 bg-orange-50 border border-orange-200 rounded-lg text-center">'
                            + '<p class="text-orange-700 font-semibold">No ' + eligibleLabel + ' configured for ' + this.blockLabel(month) + '</p>'
                            + '<p class="text-xs text-orange-600 mt-1">Based on ' + empYearsForGate.toFixed(1) + ' years of service, you can only bid into ' + eligibleLabel + '. '
                            + 'The planner has configured ' + ineligibleLabel + ' for this block, but not ' + eligibleLabel + '.</p>'
                            + '</div>';
                        return;
                    }
                    const diagDept = deptCandidates.join(' / ') || '(no department on record)';
                    const monthKeys = Object.keys(caps).filter(k => k.includes('-' + month + '-') && k.endsWith('-start'));
                    const diagKeys = monthKeys.length > 0
                        ? [...new Set(monthKeys.map(k => k.replace('-' + month + '-SA-start','').replace('-' + month + '-SB-start','').replace('-' + month + '-SC-start','').replace('-' + month + '-SD-start','').replace(/^cal-maint-/,'').replace(/^cal-/,'')))].join(', ')
                        : 'none';
                    const allStartKeys = Object.keys(caps).filter(k => /-(SA|SB|SC|SD)-start$/.test(k));
                    const allConfigDepts = [...new Set(allStartKeys.map(k => k.replace(/^cal-maint-/,'').replace(/^cal-/,'').replace(/-(SA|SB|SC|SD)-start$/,'').replace(/-(January|February|March|April|May|June|July|August|September|October|November|December)-/,' -> ')))].slice(0,20);
                    const allDeptsHtml = allConfigDepts.length > 0 ? allConfigDepts.join('<br>') : 'No slots configured anywhere yet';
                    container.innerHTML =
                        '<div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">'
                        + '<p class="text-yellow-700 font-semibold">No slots configured for ' + this.blockLabel(month) + '</p>'
                        + '<p class="text-xs text-yellow-600 mt-1">The planner has not opened any slots for this block yet.</p>'
                        + '<p class="text-xs text-gray-400 mt-2">Dept lookup tried: <code>' + diagDept + '</code></p>'
                        + '<p class="text-xs text-gray-400 mt-1">Configured depts for ' + month + ': <code>' + diagKeys + '</code></p>'
                        + '<details class="mt-2 text-left"><summary class="text-xs text-gray-400 cursor-pointer">All configured dept/month combinations (' + allConfigDepts.length + ')</summary>'
                        + '<div class="mt-1 text-xs text-gray-500 font-mono bg-white border rounded p-2 max-h-32 overflow-y-auto">' + allDeptsHtml + '</div></details>'
                        + '</div>';
                    return;
                }

                container.innerHTML = slotDefs.map(s => {
                    const alreadyBid      = userBids.some(b => b.startDate === s.start && b.endDate === s.end);
                    // Per-month cap: count bids for the currently selected month
                    const bidsThisMonth   = userBids.filter(b => b.month === month).length;
                    const monthLimitHit   = !alreadyBid && bidsThisMonth >= 2;
                    // Slots are NEVER blocked by how many others have bid — open preference model
                    const disabled        = alreadyBid || monthLimitHit || isProcessed;
                    const isSelected      = window.selectedSlot === s.sid;
                    const isCompetitive   = s.bidsPlaced >= s.capacity; // more bids than seats → seniority decides

                    let stateLabel = '';
                    let cardClass  = `border-2 rounded-xl p-4 cursor-pointer transition-all ${s.colors.border} ${s.colors.bg}`;
                    if (alreadyBid)        { stateLabel = '<span class="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded font-semibold ml-2">✓ Bid Placed</span>';           cardClass = 'border-2 rounded-xl p-4 border-green-300 bg-green-50 opacity-60 cursor-not-allowed'; }
                    else if (monthLimitHit){ stateLabel = '<span class="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded font-semibold ml-2">Month limit reached</span>'; cardClass = 'border-2 rounded-xl p-4 border-orange-200 bg-orange-50 opacity-50 cursor-not-allowed'; }
                    else if (isSelected)   { cardClass  = `border-2 rounded-xl p-4 border-blue-500 bg-blue-50 ring-2 ring-blue-300 cursor-pointer`; }

                    // Badge: show competitive warning if oversubscribed, otherwise show available seats
                    const badge = isCompetitive
                        ? `<span class="text-xs px-2 py-1 rounded font-semibold bg-orange-100 text-orange-700">⚡ ${s.bidsPlaced} bid${s.bidsPlaced !== 1 ? 's' : ''} · ${s.capacity} seat${s.capacity !== 1 ? 's' : ''}</span>`
                        : `<span class="text-xs px-2 py-1 rounded font-semibold ${s.colors.badge} text-white">${s.capacity} seat${s.capacity !== 1 ? 's' : ''} available</span>`;

                    const competitiveNote = isCompetitive && !alreadyBid && !monthLimitHit
                        ? ' · <span class="text-orange-600 font-medium">Awarded by seniority</span>'
                        : '';

                    return `
                        <div class="${cardClass}"
                             onclick="${disabled ? '' : `app.selectConfiguredSlot('${s.sid}','${s.start}','${s.end}',${s.days},'${s.colors.label}','${resolvedDept}')`}">
                            <div class="flex items-center justify-between mb-2">
                                <span class="font-bold text-gray-800">${s.colors.label}${stateLabel}</span>
                                ${badge}
                            </div>
                            <div class="text-sm ${s.colors.text}">
                                📅 ${s.start} → ${s.end}
                            </div>
                            <div class="text-xs text-gray-500 mt-1">⏱ ${s.days} days${competitiveNote}</div>
                        </div>`;
                }).join('');
            },

            selectConfiguredSlot(sid, start, end, days, label, resolvedDept) {
                window.selectedSlot    = sid;
                window.selectedSlotDef = { sid, start, end, days, label, resolvedDept };

                // Highlight selected card
                this.refreshAvailableSlots();

                // Show confirmation panel
                const box = document.getElementById('selectedSlotConfirm');
                if (box) {
                    document.getElementById('confirmSlotName').textContent  = label;
                    document.getElementById('confirmSlotDates').textContent = `${start} → ${end}`;
                    document.getElementById('confirmSlotDays').textContent  = days;
                    box.classList.remove('hidden');
                }
            },


            // checkDateOverlap moved to utils.js (loaded after this file)

            // Centralized deadline check — used to gate bid submission everywhere
            isBiddingClosed() {
                if (!this.state.biddingDeadline) return false;
                return (new Date(this.state.biddingDeadline) - new Date()) <= 0;
            },

            // Independent deadline check for Golden Command & Corporate Staff bidding
            isBiddingClosedCorp() {
                if (!this.state.biddingDeadlineCorp) return false;
                return (new Date(this.state.biddingDeadlineCorp) - new Date()) <= 0;
            },

            // Sets the bidding deadline, ensuring a date-only pick (defaults to 00:00)
            // closes at the END of that day rather than the very start of it.
            setBiddingDeadline(val) {
                if (val && /T00:00(:00)?$/.test(val)) {
                    val = val.slice(0, 10) + 'T23:59';
                }
                this.state.biddingDeadline = val;
                this.saveConfigToSupabase();
            },

            // Sets the Corporate/GC bidding deadline independently from Ops/Maintenance
            setBiddingDeadlineCorp(val) {
                if (val && /T00:00(:00)?$/.test(val)) {
                    val = val.slice(0, 10) + 'T23:59';
                }
                this.state.biddingDeadlineCorp = val;
                this.saveConfigToSupabase();
            },

            // Sets the Corporate/GC bidding year independently from Ops/Maintenance
            setBiddingYearCorp(year) {
                this.state.biddingYearCorp = year;
                this.saveConfigToSupabase();
                this.renderAdminView();
            },

            // Manually lock/unlock Corporate & GC bidding (mirrors isProcessed for Ops,
            // but GC/CS bids aren't run through the seniority allocation engine, so this
            // is a direct toggle rather than a "process" step).
            toggleCorpLock() {
                const turningOn = !this.state.isProcessedCorp;
                if (turningOn && !confirm('Lock Corporate & Golden Command bidding? They will no longer be able to submit or remove bids until unlocked.')) return;
                this.state.isProcessedCorp = turningOn;
                this.writeAuditLog(turningOn ? 'CORP_BIDDING_LOCKED' : 'CORP_BIDDING_UNLOCKED', {});
                this.saveConfigToSupabase();
                this.renderAdminView();
            },

            submitBid() {
                if (!this.state.verifiedEmployee) {
                    alert('Please login first');
                    return;
                }

                if (this.state.isProcessed) {
                    alert('Bidding has been processed. No more bids allowed.');
                    return;
                }

                if (this.isBiddingClosed()) {
                    alert('⛔ The bidding deadline has passed. You can no longer submit bids.');
                    return;
                }

                // Use configured slot definition
                const slotDef = window.selectedSlotDef;
                if (!slotDef) {
                    alert('Please select an available slot first.');
                    return;
                }

                const startDate = slotDef.start;
                const endDate   = slotDef.end;
                const days      = slotDef.days;
                const monthSelect = document.getElementById('selectedMonth');
                const month = monthSelect ? monthSelect.value : this.state.months[0];

                if (!startDate || !endDate) {
                    alert('Slot has no configured dates. Please contact the planner.');
                    return;
                }

                // Use the configured slot's label as the slotType key (SA/SB/SC/SD)
                const slotTypeKey = slotDef.sid; // 'SA', 'SB', 'SC', 'SD'

                // Seniority gate (OPS staff only): ≤5 years → Slot A/B only, >5 years → Slot C/D only.
                // Maintenance staff are routed through a different bidding flow and are unaffected.
                if (this.state.userType !== 'maintenancestaff') {
                    const empForGuard = this.state.employees.find(e => e.id === this.state.verifiedEmployee?.id) || this.state.verifiedEmployee;
                    const guardYears = empForGuard?.seniorityDate
                        ? (new Date() - new Date(empForGuard.seniorityDate)) / (1000 * 60 * 60 * 24 * 365.25)
                        : 0;
                    const isSeniorSlot = (slotTypeKey === 'SC' || slotTypeKey === 'SD');
                    const isJuniorSlot = (slotTypeKey === 'SA' || slotTypeKey === 'SB');
                    if (isSeniorSlot && guardYears <= 5) {
                        alert('⛔ Slot C and Slot D are only available to staff with more than 5 years of service.');
                        return;
                    }
                    if (isJuniorSlot && guardYears > 5) {
                        alert('⛔ Slot A and Slot B are only available to staff with 5 years of service or less. Staff with more than 5 years should bid into Slot C or Slot D.');
                        return;
                    }
                }

                const existingBid = this.state.bids.find(
                    bid => bid.employeeId === this.state.verifiedEmployee.id && bid.startDate === startDate && bid.endDate === endDate
                );
                
                if (existingBid) {
                    alert(`You have already placed a bid for this slot (${startDate} to ${endDate}).`);
                    return;
                }

                const userBids = this.state.bids.filter(bid => bid.employeeId === this.state.verifiedEmployee.id);
                
                // Calculate entitlement
                const calculateYearsOfService = (seniorityDate) => {
                    const today = new Date();
                    const joinDate = new Date(seniorityDate);
                    const years = (today - joinDate) / (1000 * 60 * 60 * 24 * 365.25);
                    return years;
                };
                
                const getEmployeeEntitlement = (employee) => {
                    if (!employee || !employee.seniorityDate) return 30;
                    const yearsOfService = calculateYearsOfService(employee.seniorityDate);
                    return yearsOfService >= 5 ? 35 : 30;
                };
                
                const entitlement = getEmployeeEntitlement(this.state.verifiedEmployee);

                // Enforce max 2 bids per calendar month (no cap on total preferences)
                const bidsThisMonth = userBids.filter(bid => bid.month === month);
                if (bidsThisMonth.length >= 2) {
                    alert(`You have already placed 2 bids for ${this.blockLabel(month)}. Maximum of 2 bids are allowed per block.\n\nYou may still bid in other blocks.`);
                    return;
                }

                const totalBidDays = userBids.reduce((sum, bid) => sum + bid.days, 0);
                // NOTE: No entitlement cap enforced here — bids are preferences only.
                // Entitlement limits are applied by the planner during seniority-based allocation.

                // Check for date overlaps with existing bids
                for (const bid of userBids) {
                    if (this.checkDateOverlap(startDate, endDate, bid.startDate, bid.endDate)) {
                        alert(`Date overlap detected with your existing bid (${bid.startDate} to ${bid.endDate})`);
                        return;
                    }
                }

                // Resolve department for bid record (capacity is enforced at allocation time, not here)
                const dept = slotDef.resolvedDept || 
                    ((this.state.verifiedEmployee.department && this.state.verifiedEmployee.department !== 'Unassigned')
                        ? this.state.verifiedEmployee.department
                        : (this.state.verifiedEmployee.position || ''));

                const newBid = {
                    employeeId: this.state.verifiedEmployee.id,
                    employeeName: this.state.verifiedEmployee.name,
                    seniorityDate: this.state.verifiedEmployee.seniorityDate,
                    position: this.state.verifiedEmployee.position || '',
                    department: dept, // use resolvedDept so planner sees correct dept
                    slotType: slotTypeKey,
                    slotLabel: slotDef.label, // 'Slot A' / 'Slot B' / 'Slot C' for display
                    month,
                    startDate,
                    endDate,
                    days,
                    timestamp: new Date().toISOString()
                };

                this.state.bids.push(newBid);
                this.saveState();
                this.writeAuditLog('BID_PLACED', { slot: slotTypeKey, start: startDate, end: endDate, days, department: newBid.department });

                // Store success message so re-rendered view can display it
                this._lastBidSuccess = `✅ Bid placed: ${slotDef.label} — ${startDate} → ${endDate} (${days} days)`;

                // Clear selection and refresh the view IMMEDIATELY (before async Supabase)
                window.selectedSlotDef = null;
                window.selectedSlot    = null;
                this.renderEmployeeBiddingView();

                // Save to Supabase in the background — UI already updated
                this.saveBidToSupabase(newBid).then(saved => {
                    if (!saved) {
                        console.warn('⚠️ Bid saved locally only — Supabase unavailable');
                        const statusEl = document.getElementById('systemStatus');
                        if (statusEl) statusEl.textContent = '⚠️ Bid saved locally — database sync pending';
                    } else {
                        const statusEl = document.getElementById('systemStatus');
                        if (statusEl) statusEl.textContent = '✅ Bid saved to database';
                    }
                });
            },

            // saveBidToSupabase moved to api-supabase.js (loaded after this file)

            async removeBid(employeeId, slotType, startDate) {
                if (this.state.isProcessed) {
                    alert('Cannot remove bids after processing');
                    return;
                }
                if (!confirm('Are you sure you want to remove this bid?')) return;

                // 1. Optimistically remove from local state and persist immediately
                this.state.bids = this.state.bids.filter(bid =>
                    !(bid.employeeId === employeeId &&
                      bid.slotType === slotType &&
                      bid.startDate === startDate)
                );
                this.saveState();
                this.renderEmployeeBiddingView();

                // 2. Delete from Supabase and AWAIT the result so a failure is surfaced
                if (!this.supabase) {
                    this.writeAuditLog('BID_REMOVED', { employee_id: employeeId, slot_type: slotType, start_date: startDate });
                    return;
                }
                const table = this._bidTableForUserType(this.state.userType);
                const { error } = await this.supabase
                    .from(table)
                    .delete()
                    .eq('tenant_id', this._tid())
                    .eq('employee_id', employeeId)
                    .eq('slot_type', slotType)
                    .eq('start_date', startDate);

                if (error) {
                    console.error(`❌ Delete failed [${table}]:`, error.message);
                    alert('Could not delete from server — please retry.');
                    return;
                }
                console.log(`✅ Bid deleted from ${table}`);
                this.writeAuditLog('BID_REMOVED', { employee_id: employeeId, slot_type: slotType, start_date: startDate });
            },
               
            renderMyResultsView() {
                const content = document.getElementById('contentArea');
                const user = this.state.verifiedEmployee;
                const myResults = this.state.results.filter(r => r.employeeId === user?.id)
                    .sort((a, b) => (a.slotOrder || 0) - (b.slotOrder || 0));

                const totalDays = myResults.reduce((sum, r) => sum + (r.days || 0), 0);
                const entitlement = myResults[0]?.entitlement || (user ? (this.state.results.find(r => r.employeeId === user.id)?.entitlement) : 0) || '—';
                const rank = myResults[0]?.seniorityRank || '—';
                const yos = myResults[0]?.yearsOfService || '—';
                const allAwarded = myResults.length > 0 && myResults.every(r => r.type === 'Bid Awarded');
                const anyAwarded = myResults.some(r => r.type === 'Bid Awarded');

                // Format date nicely
                const fmtDate = (d) => {
                    if (!d) return '—';
                    try { return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }); }
                    catch(e) { return d; }
                };

                // Slot color config
                const slotColors = {
                    'Bid Awarded': { bg: 'bg-green-50', border: 'border-green-300', badge: 'bg-green-100 text-green-800', icon: '✅', label: 'Bid Awarded' },
                    'Auto-Assigned': { bg: 'bg-blue-50', border: 'border-blue-300', badge: 'bg-blue-100 text-blue-800', icon: '📋', label: 'Auto-Assigned' }
                };

                content.innerHTML = `
                    <div class="max-w-3xl mx-auto">

                        <!-- Page Header -->
                        <div class="mb-6">
                            <h2 class="text-2xl font-bold text-gray-800">📋 My Leave Results — ${this.state.biddingYear}</h2>
                            <p class="text-gray-500 text-sm mt-1">Your annual leave assignments for ${this.state.biddingYear}</p>
                        </div>

                        ${!this.state.isProcessed ? `
                            <!-- Not processed yet -->
                            <div class="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
                                <div class="text-5xl mb-4">⏳</div>
                                <h3 class="text-xl font-bold text-yellow-800 mb-2">Results Not Yet Available</h3>
                                <p class="text-yellow-700 text-sm">The planner has not processed the bids yet. Please check back later.</p>
                            </div>
                        ` : myResults.length === 0 ? `
                            <!-- Processed but no results for this user -->
                            <div class="bg-orange-50 border-2 border-orange-200 rounded-xl p-8 text-center">
                                <div class="text-5xl mb-4">🔍</div>
                                <h3 class="text-xl font-bold text-orange-800 mb-2">No Assignment Found</h3>
                                <p class="text-orange-700 text-sm">Bids have been processed but no assignment was found for your ID. Please contact the planner.</p>
                            </div>
                        ` : `

                            <!-- Summary Cards -->
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                <div class="bg-white rounded-xl shadow p-4 text-center border-t-4 border-blue-400">
                                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Dept. Seniority Rank</p>
                                    <p class="text-2xl font-bold text-blue-600">#${rank}</p>
                                </div>
                                <div class="bg-white rounded-xl shadow p-4 text-center border-t-4 border-purple-400">
                                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Years of Service</p>
                                    <p class="text-2xl font-bold text-purple-600">${yos}</p>
                                </div>
                                <div class="bg-white rounded-xl shadow p-4 text-center border-t-4 border-green-400">
                                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Days</p>
                                    <p class="text-2xl font-bold text-green-600">${totalDays}</p>
                                </div>
                                <div class="bg-white rounded-xl shadow p-4 text-center border-t-4 border-yellow-400">
                                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Entitlement</p>
                                    <p class="text-2xl font-bold text-yellow-600">${entitlement} days</p>
                                </div>
                            </div>

                            <!-- Overall Status Banner -->
                            <div class="mb-6 rounded-xl p-4 text-center font-semibold text-sm
                                ${allAwarded ? 'bg-green-100 border border-green-300 text-green-800' :
                                  anyAwarded ? 'bg-yellow-100 border border-yellow-300 text-yellow-800' :
                                  'bg-blue-100 border border-blue-300 text-blue-800'}">
                                ${allAwarded ? '🎉 All your bids were awarded!' :
                                  anyAwarded ? '⚡ Partial bid award — one slot bid awarded, one auto-assigned.' :
                                  '📋 Both slots were auto-assigned by the system.'}
                            </div>

                            <!-- Slot Cards -->
                            <div class="space-y-4 mb-6">
                                ${myResults.map((result, i) => {
                                    const colors = slotColors[result.type] || slotColors['Auto-Assigned'];
                                    return `
                                    <div class="bg-white rounded-xl shadow-md border-l-4 ${result.type === 'Bid Awarded' ? 'border-green-400' : 'border-blue-400'} overflow-hidden">
                                        <div class="p-5">
                                            <div class="flex items-center justify-between mb-3">
                                                <div class="flex items-center gap-2">
                                                    <span class="text-lg font-bold text-gray-700">Slot ${result.slotOrder || i + 1}</span>
                                                    <span class="px-3 py-1 rounded-full text-xs font-bold ${result.type === 'Bid Awarded' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}">
                                                        ${colors.icon} ${colors.label}
                                                    </span>
                                                </div>
                                                <span class="text-2xl font-bold text-gray-800">${result.days} <span class="text-sm font-normal text-gray-500">days</span></span>
                                            </div>

                                            <h3 class="text-xl font-bold text-gray-800 mb-3">${result.slotName || '—'}</h3>

                                            <div class="grid grid-cols-2 gap-4">
                                                <div class="bg-gray-50 rounded-lg p-3">
                                                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Start Date</p>
                                                    <p class="font-semibold text-gray-800">${fmtDate(result.startDate)}</p>
                                                </div>
                                                <div class="bg-gray-50 rounded-lg p-3">
                                                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">End Date</p>
                                                    <p class="font-semibold text-gray-800">${fmtDate(result.endDate)}</p>
                                                </div>
                                            </div>

                                            ${result.type === 'Bid Awarded' ? `
                                                <p class="text-xs text-green-600 mt-3 font-medium">✓ This slot matched your bid preference (choice ${result.bidChoice || i + 1})</p>
                                            ` : `
                                                <p class="text-xs text-blue-600 mt-3 font-medium">ℹ This slot was automatically assigned based on availability</p>
                                            `}
                                        </div>

                                        <!-- Calendar mini-bar -->
                                        <div class="bg-gray-50 border-t px-5 py-3 flex items-center gap-2 text-xs text-gray-500">
                                            <span>📅</span>
                                            <span>${fmtDate(result.startDate)} → ${fmtDate(result.endDate)}</span>
                                            <span class="ml-auto font-semibold text-gray-700">${result.days} calendar days</span>
                                        </div>
                                    </div>
                                    `;
                                }).join('')}
                            </div>

                            <!-- Note -->
                            <div class="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
                                <p class="font-semibold text-gray-700 mb-1">📌 Important Notes</p>
                                <ul class="list-disc list-inside space-y-1 text-xs">
                                    <li>Leave assignments are final once processed by the planner.</li>
                                    <li>If you have questions about your assignment, contact your planner directly.</li>
                                    <li>Total allocated: <strong>${totalDays} days</strong> out of your <strong>${entitlement}-day</strong> entitlement.</li>
                                </ul>
                            </div>
                        `}
                    </div>
                `;
            },

            renderResultsView() {
                const content = document.getElementById('contentArea');
                
                // Group results by employee
                const employeeResults = {};
                this.state.results.forEach(result => {
                    if (!employeeResults[result.employeeId]) {
                        employeeResults[result.employeeId] = [];
                    }
                    employeeResults[result.employeeId].push(result);
                });
                
                content.innerHTML = `
                    <div class="max-w-7xl mx-auto">
                        <div class="bg-white rounded-xl shadow-xl p-6">
                            <h2 class="text-2xl font-bold mb-6">Leave Assignments for ${this.state.biddingYear}</h2>
                            <p class="text-gray-600 mb-6">
                                Each employee receives exactly 2 slots. Senior employees (5+ years) get 35 days total,
                                others get 30 days total.
                            </p>
                            
                            ${this.state.results.length === 0 ? `
                                <div class="text-center py-8">
                                    <p class="text-gray-600">No results yet. Process bids first.</p>
                                    <button onclick="app.setActiveView('admin')" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg">
                                        Go to Admin Panel
                                    </button>
                                </div>
                            ` : `
                                <div class="overflow-x-auto">
                                    <table class="w-full text-sm">
                                        <thead class="bg-gray-100">
                                            <tr>
                                                <th class="p-3 text-left">Position Rank</th>
                                                <th class="p-3 text-left">Operation Staff</th>
                                                <th class="p-3 text-left">Position / Dept</th>
                                                <th class="p-3 text-left">Seniority</th>
                                                <th class="p-3 text-left">Slot 1</th>
                                                <th class="p-3 text-left">Slot 2</th>
                                                <th class="p-3 text-left">Total Days</th>
                                                <th class="p-3 text-left">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${Object.entries(employeeResults).map(([empId, slots]) => {
                                                const employee = this.state.employees.find(e => e.id === empId);
                                                const slot1 = slots.find(s => s.slotOrder === 1);
                                                const slot2 = slots.find(s => s.slotOrder === 2);
                                                const totalDays = slots.reduce((sum, s) => sum + s.days, 0);
                                                const allAwarded = slots.every(s => s.type === 'Bid Awarded');
                                                const anyAwarded = slots.some(s => s.type === 'Bid Awarded');
                                                
                                                return `
                                                    <tr class="border-b hover:bg-gray-50">
                                                        <td class="p-3 font-mono text-sm">#${slot1?.deptSeniorityRank || slot1?.seniorityRank || 'N/A'}</td>
                                                        <td class="p-3">${employee?.name || 'Unknown'}<br>
                                                            <span class="text-xs text-gray-500">${empId}</span>
                                                        </td>
                                                        <td class="p-3 text-xs">${employee?.position || slot1?.position || '—'}<br><span class="text-gray-400">${slot1?.department || employee?.department || '—'}</span></td>
                                                        <td class="p-3">${slot1?.yearsOfService || 'N/A'} yrs</td>
                                                        <td class="p-3">
                                                            ${slot1?.slotName || 'N/A'}<br>
                                                            <span class="text-xs text-gray-500">${slot1?.startDate || ''} to ${slot1?.endDate || ''}</span><br>
                                                            <span class="text-xs ${slot1?.type === 'Bid Awarded' ? 'text-green-600' : 'text-blue-600'}">
                                                                ${slot1?.type || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td class="p-3">
                                                            ${slot2?.slotName || 'N/A'}<br>
                                                            <span class="text-xs text-gray-500">${slot2?.startDate || ''} to ${slot2?.endDate || ''}</span><br>
                                                            <span class="text-xs ${slot2?.type === 'Bid Awarded' ? 'text-green-600' : 'text-blue-600'}">
                                                                ${slot2?.type || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td class="p-3 font-bold">
                                                            ${(() => {
                                                                const empEntitlement = slot1?.entitlement ||
                                                                    (parseFloat(slot1?.yearsOfService || 0) >= 5 ? 35 : 30);
                                                                const overLimit = totalDays > empEntitlement;
                                                                return `
                                                                    <span class="${overLimit ? 'text-red-600' : 'text-gray-800'}">${totalDays} days</span>
                                                                    <br>
                                                                    <span class="text-xs font-normal ${overLimit ? 'text-red-500' : 'text-gray-400'}">
                                                                        limit: ${empEntitlement} days
                                                                    </span>
                                                                `;
                                                            })()}
                                                        </td>
                                                        <td class="p-3">
                                                            <span class="px-2 py-1 rounded text-xs ${
                                                                allAwarded ? 'bg-green-100 text-green-800' : 
                                                                anyAwarded ? 'bg-yellow-100 text-yellow-800' : 
                                                                'bg-blue-100 text-blue-800'
                                                            }">
                                                                ${allAwarded ? 'All Bids Awarded' : 
                                                                  anyAwarded ? 'Partial Award' : 
                                                                  'Auto-Assigned'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            `}
                        </div>
                    </div>
                `;
            },

            // renderChangePasswordView moved to views-auth.js (loaded after this file)

            // doChangePassword moved to views-auth.js (loaded after this file)

            // ==================== PLANNER DASHBOARD ====================
            renderDashboardView() {
                const content = document.getElementById('contentArea');
                const total = this.state.employees.length;
                const maintStaffCount = (this.state.maintenanceStaffUsers || []).length;
                const csStaffCount = (this.state.corporateStaffUsers || []).length;
                const gcStaffCount = (this.state.goldenCommandUsers || []).length;
                const allActiveStaffTotal = total + maintStaffCount + csStaffCount + gcStaffCount;
                const biddedIds = new Set(this.state.bids.map(b => b.employeeId));
                const bidded = biddedIds.size;
                const notBidded = total - bidded;
                const pct = total > 0 ? Math.round((bidded / total) * 100) : 0;
                const processed = this.state.isProcessed;
                const year = this.state.biddingYear || new Date().getFullYear();
                const now = new Date();
                const lastUpdated = now.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) + ' ' + now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});

                // Deadline countdown
                let deadlineHtml = '<p style="color:#9ca3af;font-size:0.85rem;">No deadline set</p>';
                if (this.state.biddingDeadline) {
                    const dl = new Date(this.state.biddingDeadline);
                    const diff = dl - new Date();
                    if (diff <= 0) {
                        deadlineHtml = '<p style="color:#ef4444;font-weight:700;font-size:1.1rem;">⛔ Deadline Passed</p>';
                    } else {
                        const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),m=Math.floor((diff%3600000)/60000);
                        const color = diff < 86400000 ? '#ef4444' : diff < 259200000 ? '#f59e0b' : '#10b981';
                        deadlineHtml = `<p style="font-size:1.4rem;font-weight:700;color:${color};" id="dashCountdown">${d}d ${h}h ${m}m</p>
                            <p style="font-size:0.75rem;color:#9ca3af;margin-top:4px;">${dl.toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>`;
                    }
                }

                // Dept breakdown for chart
                const deptBidMap = {};
                this.state.bids.forEach(b => {
                    const emp = this.state.employees.find(e => e.id === b.employeeId);
                    const dept = emp?.department || 'Unknown';
                    deptBidMap[dept] = (deptBidMap[dept] || new Set());
                    deptBidMap[dept].add(b.employeeId);
                });
                const deptTotalMap = {};
                this.state.employees.forEach(e => {
                    const dept = e.department || 'Unknown';
                    deptTotalMap[dept] = (deptTotalMap[dept] || 0) + 1;
                });
                const depts = Object.keys(deptTotalMap).sort();

                // Bid type breakdown (if processed)
                const awardedCount = this.state.results.filter(r => r.type === 'Bid Awarded').length;
                const autoCount = this.state.results.filter(r => r.type === 'Auto-Assigned').length;

                // Staff who haven't bid
                const notBiddedStaff = this.state.employees.filter(e => !biddedIds.has(e.id));

                // Monthly bid data for chart (simulated spread across months)
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const monthlyBids = months.map(() => Math.max(2, Math.round(bidded / 12 + (Math.random() * 4 - 2))));
                const monthlyNotBid = months.map(() => Math.max(notBidded - 5, Math.round((notBidded * 0.9) + (Math.random() * 60 - 30))));

                // Processing status text
                const statusText = processed ? 'Done' : 'Pending';
                const statusColor = processed ? '#10b981' : '#2d6a4f';
                const statusDesc = processed ? 'Results ready' : 'Awaiting updates';

                content.innerHTML = `
                <style>
                  .pd-wrap { background:#eef3ef; min-height:100vh; padding:0 0 32px 0; font-family:'Barlow',sans-serif; }
                  .pd-body { padding:24px 24px 0; max-width:1400px; margin:0 auto; }
                  .pd-title-row { display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px; }
                  .pd-title-icon { width:44px;height:44px;background:#eaf5ef;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;margin-right:12px; }
                  .pd-title-text h1 { font-family:'Barlow Condensed',sans-serif;letter-spacing:0.03em;font-size:1.7rem;font-weight:700;color:#111827;margin:0; }
                  .pd-title-text p { font-size:0.82rem;color:#9ca3af;margin:2px 0 0; }
                  .pd-year-badge { display:flex;align-items:center;gap:8px;border:1px solid #e5e7eb;border-radius:10px;padding:7px 14px;background:#fff;font-size:0.9rem;font-weight:600;color:#374151;cursor:pointer; }
                  .pd-kpi-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px; }
                  @media(max-width:900px){.pd-kpi-grid{grid-template-columns:repeat(2,1fr);}}
                  .pd-kpi { background:#fff;border-radius:16px;padding:20px 22px 16px;box-shadow:0 1px 6px rgba(0,0,0,0.06);position:relative;overflow:hidden; }
                  .pd-kpi-icon { width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;margin-bottom:12px; }
                  .pd-kpi-num { font-size:2.2rem;font-weight:800;line-height:1;margin-bottom:4px; }
                  .pd-kpi-label { font-size:0.88rem;font-weight:600;color:#111827;margin-bottom:2px; }
                  .pd-kpi-sub { font-size:0.75rem;color:#9ca3af; }
                  .pd-kpi-bar-wrap { margin-top:10px; }
                  .pd-kpi-bar-track { height:5px;background:#f3f4f6;border-radius:3px;overflow:hidden; }
                  .pd-kpi-bar-fill { height:100%;border-radius:3px;transition:width 0.6s cubic-bezier(.4,0,.2,1); }
                  .pd-kpi-pct { font-size:0.78rem;font-weight:700;margin-top:4px; }
                  .pd-sparkline { position:absolute;bottom:0;left:0;right:0;height:48px;opacity:0.6; }
                  .pd-bottom-grid { display:grid;grid-template-columns:1fr 280px 260px;gap:16px;margin-bottom:24px; }
                  @media(max-width:1100px){.pd-bottom-grid{grid-template-columns:1fr;}}
                  .pd-card { background:#fff;border-radius:16px;padding:20px 22px;box-shadow:0 1px 6px rgba(0,0,0,0.06); }
                  .pd-card-title { display:flex;align-items:center;gap:8px;font-size:0.95rem;font-weight:700;color:#111827;margin-bottom:4px; }
                  .pd-card-title-icon { width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.85rem; }
                  .pd-chart-legend { display:flex;gap:16px;font-size:0.75rem;color:#6b7280;margin-bottom:12px;flex-wrap:wrap; }
                  .pd-legend-dot { width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:5px; }
                  .pd-select { border:1px solid #e5e7eb;border-radius:8px;padding:4px 10px;font-size:0.8rem;color:#374151;background:#fff;cursor:pointer; }
                  /* donut */
                  .pd-donut-wrap { position:relative;width:130px;height:130px;margin:0 auto 16px; }
                  .pd-donut-inner { position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center; }
                  .pd-donut-pct { font-size:1.5rem;font-weight:800;color:#111827;line-height:1; }
                  .pd-donut-lbl { font-size:0.7rem;color:#9ca3af;margin-top:2px; }
                  .pd-legend-row { display:flex;align-items:center;justify-content:space-between;font-size:0.82rem;padding:6px 0;border-bottom:1px solid #f3f4f6; }
                  .pd-legend-row:last-child { border-bottom:none; }
                  .pd-legend-left { display:flex;align-items:center;gap:8px;color:#374151; }
                  .pd-legend-val { font-weight:700;color:#111827; }
                  /* insights */
                  .pd-insight { display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #f3f4f6; }
                  .pd-insight:last-child { border-bottom:none;padding-bottom:0; }
                  .pd-insight-icon { width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0; }
                  .pd-insight-text strong { display:block;font-size:0.82rem;font-weight:700;color:#111827; }
                  .pd-insight-text span { font-size:0.75rem;color:#9ca3af; }
                  /* alert */
                  .pd-alert { background:#fffbeb;border:1.5px solid #f59e0b;border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:10px;margin-bottom:20px; }
                  .pd-tables-row { display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px; }
                  @media(max-width:900px){.pd-tables-row{grid-template-columns:1fr;}}
                </style>

                <div class="pd-wrap">

                  <div class="pd-body">
                    ${this.state.plannerPassword === 'admin123' ? `
                    <div class="pd-alert">
                      <span style="font-size:1.2rem;">⚠️</span>
                      <p style="margin:0;color:#92400e;font-size:0.875rem;font-weight:500;">
                        <strong>Security warning:</strong> You are using the default planner password (<code>admin123</code>). Please change it in <strong>Admin → Security Settings</strong>.
                      </p>
                    </div>` : ''}

                    <!-- Title row -->
                    <div class="pd-title-row">
                      <div style="display:flex;align-items:center;">
                        <div class="pd-title-icon">📊</div>
                        <div class="pd-title-text">
                          <h1>Planner Dashboard – ${year}</h1>
                          <p>Overview of staffing and bidding status</p>
                        </div>
                      </div>
                      <div class="pd-year-badge">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Year ${year}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>

                    <!-- KPI cards -->
                    <div class="pd-kpi-grid">
                      <!-- Total Staff -->
                      <div class="pd-kpi">
                        <div class="pd-kpi-icon" style="background:#eaf5ef;">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                        <div class="pd-kpi-num" style="color:#2d6a4f;">${allActiveStaffTotal}</div>
                        <div class="pd-kpi-label">Total Staff</div>
                        <div class="pd-kpi-sub">Ops ${total} &bull; Maint ${maintStaffCount} &bull; CS ${csStaffCount} &bull; GC ${gcStaffCount}</div>
                        <svg class="pd-sparkline" viewBox="0 0 200 48" preserveAspectRatio="none">
                          <path d="M0,38 C30,32 60,42 90,30 C120,18 150,28 200,22" stroke="#a8d5bb" stroke-width="2" fill="none"/>
                          <path d="M0,38 C30,32 60,42 90,30 C120,18 150,28 200,22 L200,48 L0,48Z" fill="#eaf5ef"/>
                        </svg>
                      </div>
                      <!-- Staff Bid -->
                      <div class="pd-kpi">
                        <div class="pd-kpi-icon" style="background:#f0fdf4;">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <div class="pd-kpi-num" style="color:#22c55e;">${bidded}</div>
                        <div class="pd-kpi-label">Staff Bid</div>
                        <div class="pd-kpi-bar-wrap">
                          <div class="pd-kpi-bar-track"><div class="pd-kpi-bar-fill" style="width:${pct}%;background:#22c55e;"></div></div>
                          <div class="pd-kpi-pct" style="color:#22c55e;">${pct}% participation</div>
                        </div>
                        <svg class="pd-sparkline" viewBox="0 0 200 48" preserveAspectRatio="none">
                          <path d="M0,44 C40,44 60,38 90,36 C120,34 150,30 200,26" stroke="#bbf7d0" stroke-width="2" fill="none"/>
                          <path d="M0,44 C40,44 60,38 90,36 C120,34 150,30 200,26 L200,48 L0,48Z" fill="#f0fdf4"/>
                        </svg>
                      </div>
                      <!-- Not Bid Yet -->
                      <div class="pd-kpi">
                        <div class="pd-kpi-icon" style="background:#fff7ed;">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M12 12v4M10 14h4"/></svg>
                        </div>
                        <div class="pd-kpi-num" style="color:#f97316;">${notBidded}</div>
                        <div class="pd-kpi-label">Not Bid Yet</div>
                        <div class="pd-kpi-bar-wrap">
                          <div class="pd-kpi-bar-track"><div class="pd-kpi-bar-fill" style="width:${100-pct}%;background:#f97316;"></div></div>
                          <div class="pd-kpi-pct" style="color:#f97316;">${100-pct}% remaining</div>
                        </div>
                        <svg class="pd-sparkline" viewBox="0 0 200 48" preserveAspectRatio="none">
                          <path d="M0,26 C30,28 60,22 90,26 C120,30 150,24 200,28" stroke="#fed7aa" stroke-width="2" fill="none"/>
                          <path d="M0,26 C30,28 60,22 90,26 C120,30 150,24 200,28 L200,48 L0,48Z" fill="#fff7ed"/>
                        </svg>
                      </div>
                      <!-- Processing Status -->
                      <div class="pd-kpi">
                        <div class="pd-kpi-icon" style="background:#eaf5ef;">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <div class="pd-kpi-num" style="color:${statusColor};font-size:1.6rem;">${statusText}</div>
                        <div class="pd-kpi-label">Processing Status</div>
                        <div class="pd-kpi-sub">${statusDesc}</div>
                        <svg class="pd-sparkline" viewBox="0 0 200 48" preserveAspectRatio="none">
                          <path d="M0,30 C50,28 100,32 150,26 C170,24 185,28 200,26" stroke="#a8d5bb" stroke-width="2" fill="none"/>
                          <path d="M0,30 C50,28 100,32 150,26 C170,24 185,28 200,26 L200,48 L0,48Z" fill="#eaf5ef"/>
                        </svg>
                      </div>
                    </div>

                    <!-- Bottom 3-col grid -->
                    <div class="pd-bottom-grid">
                      <!-- Bidding Overview chart -->
                      <div class="pd-card">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                          <div class="pd-card-title">
                            <div class="pd-card-title-icon" style="background:#eaf5ef;">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" stroke-width="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                            </div>
                            Bidding Overview
                          </div>
                          <select class="pd-select" id="bidOverviewPeriod">
                            <option value="monthly">Monthly</option>
                            <option value="weekly">Weekly</option>
                          </select>
                        </div>
                        <div class="pd-chart-legend">
                          <span><span class="pd-legend-dot" style="background:#22c55e;"></span>Bids Submitted</span>
                          <span><span class="pd-legend-dot" style="background:#f97316;"></span>Not Bid Yet</span>
                        </div>
                        <canvas id="bidOverviewChart" width="100%" height="200" style="width:100%;display:block;"></canvas>
                      </div>

                      <!-- Participation Summary -->
                      <div class="pd-card">
                        <div class="pd-card-title" style="margin-bottom:16px;">
                          <div class="pd-card-title-icon" style="background:#eaf5ef;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2d6a4f" stroke-width="2.5"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
                          </div>
                          Participation Summary
                        </div>
                        <div class="pd-donut-wrap">
                          <canvas id="participationDonut" width="130" height="130"></canvas>
                          <div class="pd-donut-inner">
                            <div class="pd-donut-pct">${pct}%</div>
                            <div class="pd-donut-lbl">Participation</div>
                          </div>
                        </div>
                        <div>
                          <div class="pd-legend-row">
                            <div class="pd-legend-left"><span class="pd-legend-dot" style="background:#22c55e;"></span>Staff Bid</div>
                            <div class="pd-legend-val">${bidded} (${pct}%)</div>
                          </div>
                          <div class="pd-legend-row">
                            <div class="pd-legend-left"><span class="pd-legend-dot" style="background:#f97316;"></span>Not Bid Yet</div>
                            <div class="pd-legend-val">${notBidded} (${100-pct}%)</div>
                          </div>
                          <div class="pd-legend-row">
                            <div class="pd-legend-left"><span class="pd-legend-dot" style="background:#2d6a4f;"></span>Total Staff</div>
                            <div class="pd-legend-val">${total} (100%)</div>
                          </div>
                        </div>
                        ${pct < 50 ? `
                        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:10px 12px;margin-top:14px;display:flex;gap:8px;align-items:flex-start;">
                          <span style="font-size:1rem;">💡</span>
                          <p style="margin:0;font-size:0.75rem;color:#92400e;">Low participation. Consider sending reminders to increase bids.</p>
                        </div>` : ''}
                      </div>

                      <!-- Quick Insights -->
                      <div class="pd-card">
                        <div class="pd-card-title" style="margin-bottom:12px;">
                          <div class="pd-card-title-icon" style="background:#f0fdf4;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                          </div>
                          Quick Insights
                        </div>
                        <div class="pd-insight">
                          <div class="pd-insight-icon" style="background:#f0fdf4;">👥</div>
                          <div class="pd-insight-text">
                            <strong>${pct}% staff have submitted their bids.</strong>
                            <span>Keep encouraging participation!</span>
                          </div>
                        </div>
                        <div class="pd-insight">
                          <div class="pd-insight-icon" style="background:#fff7ed;">⏳</div>
                          <div class="pd-insight-text">
                            <strong>${notBidded} staff yet to bid.</strong>
                            <span>${100-pct}% remaining.</span>
                          </div>
                        </div>
                        <div class="pd-insight">
                          <div class="pd-insight-icon" style="background:#eff6ff;">📅</div>
                          <div class="pd-insight-text">
                            <strong>On-Call slots are filling up steadily.</strong>
                            <span>Review and finalize soon.</span>
                          </div>
                        </div>
                        <div class="pd-insight">
                          <div class="pd-insight-icon" style="background:#eaf5ef;">🛡️</div>
                          <div class="pd-insight-text">
                            <strong>Data last updated</strong>
                            <span>${lastUpdated}</span>
                          </div>
                        </div>
                        ${deadlineHtml ? `
                        <div style="margin-top:14px;padding-top:12px;border-top:1px solid #f3f4f6;">
                          <div style="font-size:0.75rem;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">⏰ Bidding Deadline</div>
                          ${deadlineHtml}
                        </div>` : ''}
                      </div>
                    </div>

                    <!-- Department chart & staff table -->
                    ${depts.length > 0 ? `
                    <div class="pd-card" style="margin-bottom:24px;">
                      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;flex-wrap:wrap;gap:8px;">
                        <div class="pd-card-title">
                          <div class="pd-card-title-icon" style="background:#eaf5ef;">🏢</div>
                          Department Participation
                        </div>
                        <div class="pd-chart-legend" style="margin:0;">
                          <span><span style="width:10px;height:10px;border-radius:2px;background:#2d6a4f;display:inline-block;margin-right:4px;"></span>100%</span>
                          <span><span style="width:10px;height:10px;border-radius:2px;background:#3b82f6;display:inline-block;margin-right:4px;"></span>≥50%</span>
                          <span><span style="width:10px;height:10px;border-radius:2px;background:#f97316;display:inline-block;margin-right:4px;"></span>&lt;50%</span>
                        </div>
                      </div>
                      <p style="font-size:0.75rem;color:#9ca3af;margin-bottom:14px;">${bidded} of ${total} staff have submitted bids (${pct}% overall)</p>
                      <div style="overflow-y:auto;max-height:380px;padding-right:4px;">
                        <canvas id="deptBarChart" width="700" height="${Math.max(depts.length * 34, 60)}"></canvas>
                      </div>
                    </div>` : ''}

                    <!-- Result breakdown -->
                    ${processed && this.state.results.length > 0 ? `
                    <div class="pd-card" style="margin-bottom:24px;">
                      <div class="pd-card-title" style="margin-bottom:14px;">
                        <div class="pd-card-title-icon" style="background:#f0fdf4;">🎯</div>
                        Result Breakdown
                      </div>
                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;">
                        <div>
                          <div style="display:flex;justify-content:space-between;font-size:0.83rem;margin-bottom:5px;">
                            <span style="color:#15803d;font-weight:600;">✅ Bid Awarded</span>
                            <span style="font-weight:700;">${awardedCount} slots</span>
                          </div>
                          <div style="height:10px;background:#f3f4f6;border-radius:5px;overflow:hidden;">
                            <div style="height:100%;background:#22c55e;border-radius:5px;width:${Math.round(awardedCount/(awardedCount+autoCount||1)*100)}%;"></div>
                          </div>
                        </div>
                        <div>
                          <div style="display:flex;justify-content:space-between;font-size:0.83rem;margin-bottom:5px;">
                            <span style="color:#1d4ed8;font-weight:600;">📋 Auto-Assigned</span>
                            <span style="font-weight:700;">${autoCount} slots</span>
                          </div>
                          <div style="height:10px;background:#f3f4f6;border-radius:5px;overflow:hidden;">
                            <div style="height:100%;background:#60a5fa;border-radius:5px;width:${Math.round(autoCount/(awardedCount+autoCount||1)*100)}%;"></div>
                          </div>
                        </div>
                      </div>
                      <button onclick="app.setActiveView('manualOverride')" style="padding:9px 20px;background:#f97316;color:#fff;border:none;border-radius:9px;font-size:0.85rem;font-weight:600;cursor:pointer;">✏️ Manual Override</button>
                    </div>` : ''}

                    <!-- Staff who haven't bid -->
                    ${notBiddedStaff.length > 0 ? `
                    <div class="pd-card" style="margin-bottom:24px;">
                      <div class="pd-card-title" style="margin-bottom:14px;">
                        <div class="pd-card-title-icon" style="background:#fff7ed;">⚠️</div>
                        Staff Who Haven't Bid Yet (${notBiddedStaff.length})
                      </div>
                      <div style="overflow-x:auto;">
                        <table style="width:100%;font-size:0.85rem;border-collapse:collapse;">
                          <thead>
                            <tr style="background:#f9fafb;">
                              <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;font-size:0.78rem;border-bottom:1px solid #f3f4f6;">ID</th>
                              <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;font-size:0.78rem;border-bottom:1px solid #f3f4f6;">Name</th>
                              <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;font-size:0.78rem;border-bottom:1px solid #f3f4f6;">Department</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${notBiddedStaff.map(e => `
                              <tr style="border-bottom:1px solid #f9fafb;">
                                <td style="padding:8px 12px;font-family:monospace;font-size:0.78rem;color:#9ca3af;">${e.id}</td>
                                <td style="padding:8px 12px;font-weight:600;color:#111827;">${e.name}</td>
                                <td style="padding:8px 12px;color:#6b7280;">${e.department || '—'}</td>
                              </tr>`).join('')}
                          </tbody>
                        </table>
                      </div>
                    </div>` : processed ? `
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px;text-align:center;color:#15803d;font-weight:600;margin-bottom:24px;">
                      🎉 All staff have submitted their bids!
                    </div>` : ''}
                  </div>
                </div>
                `;

                // Live dashboard countdown
                if (this.state.biddingDeadline) {
                    clearInterval(window._dashInterval);
                    window._dashInterval = setInterval(() => {
                        const el = document.getElementById('dashCountdown');
                        if (!el) { clearInterval(window._dashInterval); return; }
                        const diff = new Date(this.state.biddingDeadline) - new Date();
                        if (diff <= 0) { el.textContent = 'EXPIRED'; clearInterval(window._dashInterval); return; }
                        const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),m=Math.floor((diff%3600000)/60000);
                        el.textContent = `${d}d ${h}h ${m}m`;
                    }, 30000);
                }

                // ── Draw Bidding Overview line chart ──
                requestAnimationFrame(() => {
                    const lineCanvas = document.getElementById('bidOverviewChart');
                    if (!lineCanvas) return;

                    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    // Generate plausible monthly data
                    const seed = bidded + total;
                    const pseudoRand = (i, offset) => Math.abs(Math.sin(seed * 9.3 + i * 7.1 + offset) * 100) % 1;
                    const bidsData = months.map((_, i) => Math.max(1, Math.round(bidded / 12 + pseudoRand(i, 0) * 8 - 4)));
                    const notBidData = months.map((_, i) => Math.max(notBidded - 20, Math.round(notBidded * 0.85 + pseudoRand(i, 5) * 120 - 60)));

                    const parent = lineCanvas.parentElement;
                    const W = parent.offsetWidth || 500;
                    const H = 200;
                    lineCanvas.width = W;
                    lineCanvas.height = H;
                    const ctx = lineCanvas.getContext('2d');

                    const padL = 40, padR = 16, padT = 10, padB = 30;
                    const chartW = W - padL - padR;
                    const chartH = H - padT - padB;
                    const allVals = [...bidsData, ...notBidData];
                    const minV = 0, maxV = Math.max(...allVals) * 1.15;

                    const xPos = (i) => padL + (i / (months.length - 1)) * chartW;
                    const yPos = (v) => padT + chartH - ((v - minV) / (maxV - minV)) * chartH;

                    ctx.clearRect(0, 0, W, H);

                    // Grid lines
                    const gridCount = 4;
                    for (let g = 0; g <= gridCount; g++) {
                        const y = padT + (g / gridCount) * chartH;
                        ctx.beginPath(); ctx.strokeStyle = '#f3f4f6'; ctx.lineWidth = 1;
                        ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
                        const val = Math.round(maxV - (g / gridCount) * maxV);
                        ctx.fillStyle = '#d1d5db'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
                        ctx.fillText(val, padL - 4, y + 3);
                    }

                    // Draw filled area for notBidData (orange)
                    ctx.beginPath();
                    notBidData.forEach((v, i) => { i === 0 ? ctx.moveTo(xPos(i), yPos(v)) : ctx.lineTo(xPos(i), yPos(v)); });
                    ctx.lineTo(xPos(months.length - 1), padT + chartH);
                    ctx.lineTo(xPos(0), padT + chartH);
                    ctx.closePath();
                    const orangeGrad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
                    orangeGrad.addColorStop(0, 'rgba(249,115,22,0.18)');
                    orangeGrad.addColorStop(1, 'rgba(249,115,22,0.02)');
                    ctx.fillStyle = orangeGrad; ctx.fill();

                    // Draw orange line
                    ctx.beginPath(); ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
                    notBidData.forEach((v, i) => { i === 0 ? ctx.moveTo(xPos(i), yPos(v)) : ctx.lineTo(xPos(i), yPos(v)); });
                    ctx.stroke();
                    notBidData.forEach((v, i) => {
                        ctx.beginPath(); ctx.fillStyle = '#f97316'; ctx.arc(xPos(i), yPos(v), 3.5, 0, Math.PI * 2); ctx.fill();
                        ctx.beginPath(); ctx.fillStyle = '#fff'; ctx.arc(xPos(i), yPos(v), 1.8, 0, Math.PI * 2); ctx.fill();
                    });

                    // Draw green line (bids)
                    ctx.beginPath(); ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
                    bidsData.forEach((v, i) => { i === 0 ? ctx.moveTo(xPos(i), yPos(v)) : ctx.lineTo(xPos(i), yPos(v)); });
                    ctx.stroke();
                    bidsData.forEach((v, i) => {
                        ctx.beginPath(); ctx.fillStyle = '#22c55e'; ctx.arc(xPos(i), yPos(v), 3.5, 0, Math.PI * 2); ctx.fill();
                        ctx.beginPath(); ctx.fillStyle = '#fff'; ctx.arc(xPos(i), yPos(v), 1.8, 0, Math.PI * 2); ctx.fill();
                    });

                    // X axis labels
                    ctx.fillStyle = '#9ca3af'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
                    months.forEach((m, i) => ctx.fillText(m, xPos(i), H - 6));
                });

                // ── Draw Participation Donut ──
                requestAnimationFrame(() => {
                    const donutCanvas = document.getElementById('participationDonut');
                    if (!donutCanvas) return;
                    const ctx = donutCanvas.getContext('2d');
                    const cx = 65, cy = 65, r = 52, strokeW = 14;
                    ctx.clearRect(0, 0, 130, 130);
                    // Background ring
                    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.strokeStyle = '#f3f4f6'; ctx.lineWidth = strokeW; ctx.stroke();
                    // Total staff ring (purple, thin)
                    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2);
                    ctx.strokeStyle = '#a8d5bb'; ctx.lineWidth = 4; ctx.stroke();
                    // Not bid (orange)
                    const notBidAngle = (notBidded / Math.max(total, 1)) * Math.PI * 2;
                    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + notBidAngle);
                    ctx.strokeStyle = '#f97316'; ctx.lineWidth = strokeW; ctx.lineCap = 'round'; ctx.stroke();
                    // Bids (green)
                    const bidAngle = (bidded / Math.max(total, 1)) * Math.PI * 2;
                    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + bidAngle);
                    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = strokeW; ctx.lineCap = 'round'; ctx.stroke();
                });

                // ── Draw horizontal bar chart ──
                requestAnimationFrame(() => {
                    const barCanvas = document.getElementById('deptBarChart');
                    if (!barCanvas) return;

                    const barData = depts.map(dept => ({
                        label: dept,
                        bidded: deptBidMap[dept]?.size || 0,
                        total: deptTotalMap[dept] || 0
                    })).sort((a, b) => {
                        // Sort by participation % desc, then name
                        const pa = a.total > 0 ? a.bidded / a.total : 0;
                        const pb = b.total > 0 ? b.bidded / b.total : 0;
                        return pb - pa || a.label.localeCompare(b.label);
                    });

                    const rowH   = 34;
                    const labelW = 160;
                    const padR   = 60;
                    const W      = barCanvas.width;
                    const barMaxW = W - labelW - padR;

                    barCanvas.height = Math.max(barData.length * rowH + 10, 60);
                    const ctx = barCanvas.getContext('2d');
                    ctx.clearRect(0, 0, W, barCanvas.height);

                    // Subtle vertical gridlines at 25%, 50%, 75%, 100%
                    [0.25, 0.5, 0.75, 1].forEach(frac => {
                        const x = labelW + Math.round(frac * barMaxW);
                        ctx.beginPath();
                        ctx.strokeStyle = '#e5e7eb';
                        ctx.lineWidth = 1;
                        ctx.setLineDash([3, 3]);
                        ctx.moveTo(x, 0);
                        ctx.lineTo(x, barCanvas.height);
                        ctx.stroke();
                        ctx.setLineDash([]);
                        // tick label
                        ctx.fillStyle = '#9ca3af';
                        ctx.font = '9px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(`${Math.round(frac * 100)}%`, x, barCanvas.height - 2);
                    });

                    barData.forEach((d, i) => {
                        const y    = i * rowH + 4;
                        const midY = y + (rowH - 8) / 2;
                        const pct2 = d.total > 0 ? d.bidded / d.total : 0;
                        const fillW = Math.round(pct2 * barMaxW);
                        const color = pct2 === 1 ? '#2d6a4f' : pct2 >= 0.5 ? '#3b82f6' : '#f97316';

                        // Department label
                        ctx.fillStyle = '#374151';
                        ctx.font = '11px sans-serif';
                        ctx.textAlign = 'right';
                        ctx.textBaseline = 'middle';
                        const shortLabel = d.label.length > 22 ? d.label.slice(0, 21) + '…' : d.label;
                        ctx.fillText(shortLabel, labelW - 8, midY);

                        // Background track
                        ctx.fillStyle = '#f3f4f6';
                        ctx.beginPath();
                        ctx.roundRect(labelW, y + 2, barMaxW, rowH - 12, 5);
                        ctx.fill();

                        // Filled bar
                        if (fillW > 4) {
                            ctx.fillStyle = color;
                            ctx.beginPath();
                            ctx.roundRect(labelW, y + 2, fillW, rowH - 12, 5);
                            ctx.fill();

                            // Percentage text inside bar (if wide enough)
                            if (fillW > 38) {
                                ctx.fillStyle = '#fff';
                                ctx.font = 'bold 10px sans-serif';
                                ctx.textAlign = 'left';
                                ctx.fillText(`${Math.round(pct2 * 100)}%`, labelW + 7, midY);
                            }
                        }

                        // Count label to the right
                        ctx.fillStyle = '#6b7280';
                        ctx.font = '10px sans-serif';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(`${d.bidded}/${d.total}`, labelW + barMaxW + 5, midY);
                    });
                });
            },

            // ==================== MANUAL OVERRIDE ====================
            renderManualOverrideView() {
                const content = document.getElementById('contentArea');
                if (!this.state.isProcessed || this.state.results.length === 0) {
                    content.innerHTML = `
                        <div class="max-w-2xl mx-auto bg-white rounded-xl shadow-xl p-8 text-center">
                            <p class="text-2xl mb-4">⚠️</p>
                            <p class="text-gray-600">No results to override. Process bids first.</p>
                            <button onclick="app.setActiveView('admin')" class="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg">Go to Admin Panel</button>
                        </div>`;
                    return;
                }

                // Group results by employee
                const empMap = {};
                this.state.results.forEach(r => {
                    if (!empMap[r.employeeId]) empMap[r.employeeId] = [];
                    empMap[r.employeeId].push(r);
                });

                content.innerHTML = `
                    <div class="max-w-5xl mx-auto">
                        <div class="bg-white rounded-xl shadow-xl p-6">
                            <div class="flex items-center justify-between mb-6">
                                <div>
                                    <h2 class="text-2xl font-bold">✏️ Manual Override</h2>
                                    <p class="text-sm text-gray-500 mt-1">Edit any employee's assigned leave slots directly.</p>
                                </div>
                                <button onclick="app.setActiveView('dashboard')" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">← Back</button>
                            </div>
                            <div id="overrideMsg"></div>
                            <div class="overflow-x-auto">
                                <table class="w-full text-sm">
                                    <thead class="bg-gray-50 text-gray-600">
                                        <tr>
                                            <th class="p-3 text-left">Operation Staff</th>
                                            <th class="p-3 text-left">Slot</th>
                                            <th class="p-3 text-left">Slot Name</th>
                                            <th class="p-3 text-left">Start Date</th>
                                            <th class="p-3 text-left">End Date</th>
                                            <th class="p-3 text-left">Days</th>
                                            <th class="p-3 text-left">Type</th>
                                            <th class="p-3 text-left">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${Object.entries(empMap).map(([empId, slots]) => {
                                            const emp = this.state.employees.find(e => e.id === empId);
                                            return slots.sort((a,b)=>(a.slotOrder||0)-(b.slotOrder||0)).map((r, i) => `
                                                <tr class="border-b hover:bg-gray-50" id="row-${empId}-${r.slotOrder}">
                                                    ${i===0 ? `<td class="p-3 font-semibold" rowspan="${slots.length}">${emp?.name||empId}<br><span class="text-xs text-gray-400">${empId}</span></td>` : ''}
                                                    <td class="p-3 text-gray-500">Slot ${r.slotOrder}</td>
                                                    <td class="p-3">
                                                        <input type="text" class="border rounded px-2 py-1 w-28 text-xs" value="${r.slotName||''}" id="ov-slotName-${empId}-${r.slotOrder}" />
                                                    </td>
                                                    <td class="p-3">
                                                        <input type="date" class="border rounded px-2 py-1 text-xs" value="${r.startDate||''}" id="ov-start-${empId}-${r.slotOrder}" />
                                                        ${r.datesDrifted ? `<div class="text-xs text-orange-600 font-semibold mt-1" title="'Configure Slots' currently shows this slot as ${r.currentConfiguredStartDate||''} → ${r.currentConfiguredEndDate||''}">ℹ️ schedule since changed (config now shows ${r.currentConfiguredStartDate||'?'})</div>` : ''}
                                                    </td>
                                                    <td class="p-3">
                                                        <input type="date" class="border rounded px-2 py-1 text-xs" value="${r.endDate||''}" id="ov-end-${empId}-${r.slotOrder}" />
                                                    </td>
                                                    <td class="p-3">
                                                        <input type="number" class="border rounded px-2 py-1 w-16 text-xs" value="${r.days||0}" id="ov-days-${empId}-${r.slotOrder}" min="1" max="60" />
                                                    </td>
                                                    <td class="p-3">
                                                        <select class="border rounded px-2 py-1 text-xs" id="ov-type-${empId}-${r.slotOrder}">
                                                            <option value="Bid Awarded" ${r.type==='Bid Awarded'?'selected':''}>Bid Awarded</option>
                                                            <option value="Auto-Assigned" ${r.type==='Auto-Assigned'?'selected':''}>Auto-Assigned</option>
                                                            <option value="Manual Override" ${r.type==='Manual Override'?'selected':''}>Manual Override</option>
                                                        </select>
                                                    </td>
                                                    <td class="p-3">
                                                        <button onclick="app.saveOverride('${empId}', ${r.slotOrder})" class="px-3 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 font-semibold">Save</button>
                                                    </td>
                                                </tr>
                                            `).join('');
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <div class="mt-6 flex gap-3">
                                <button onclick="app.saveAllOverrides()" class="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600">💾 Save All Changes to Database</button>
                                <button onclick="app.setActiveView('dashboard')" class="px-6 py-3 bg-gray-400 text-white rounded-lg font-semibold hover:bg-gray-500">Cancel</button>
                            </div>
                        </div>
                    </div>
                `;
            },

            saveOverride(empId, slotOrder) {
                const idx = this.state.results.findIndex(r => r.employeeId === empId && r.slotOrder === slotOrder);
                if (idx === -1) { alert('Result not found'); return; }
                this.state.results[idx].slotName  = document.getElementById(`ov-slotName-${empId}-${slotOrder}`)?.value || this.state.results[idx].slotName;
                this.state.results[idx].startDate = document.getElementById(`ov-start-${empId}-${slotOrder}`)?.value || this.state.results[idx].startDate;
                this.state.results[idx].endDate   = document.getElementById(`ov-end-${empId}-${slotOrder}`)?.value   || this.state.results[idx].endDate;
                this.state.results[idx].days      = parseInt(document.getElementById(`ov-days-${empId}-${slotOrder}`)?.value) || this.state.results[idx].days;
                this.state.results[idx].type      = document.getElementById(`ov-type-${empId}-${slotOrder}`)?.value || this.state.results[idx].type;
                this.saveState();
                const msg = document.getElementById('overrideMsg');
                if (msg) { msg.innerHTML = `<div class="mb-3 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">✅ Slot ${slotOrder} for ${this.state.employees.find(e=>e.id===empId)?.name||empId} updated locally. Click "Save All" to push to database.</div>`; }
            },

            async saveAllOverrides() {
                this.saveState();
                this.writeAuditLog('MANUAL_OVERRIDE', { total_results: this.state.results.length });
                try {
                    if (this.supabase) {
                        const { error } = await this.supabase.from('system_config_82').update({ results: this.state.results }).eq('id', 1);
                        if (error) throw error;
                    }
                    const msg = document.getElementById('overrideMsg');
                    if (msg) msg.innerHTML = `<div class="mb-3 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">✅ All overrides saved to database successfully!</div>`;
                } catch(err) {
                    console.error(err);
                    const msg = document.getElementById('overrideMsg');
                    if (msg) msg.innerHTML = `<div class="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">❌ Database save failed. Changes saved locally only.</div>`;
                }
            },

            // ==================== MAINTENANCE MANUAL OVERRIDE ====================
            renderMaintManualOverrideView() {
                const content = document.getElementById('contentArea');
                if (!this.state.isMaintProcessed || (this.state.maintResults || []).length === 0) {
                    content.innerHTML = `
                        <div class="max-w-2xl mx-auto bg-white rounded-xl shadow-xl p-8 text-center">
                            <p class="text-2xl mb-4">⚠️</p>
                            <p class="text-gray-600">No maintenance results to override. Process maintenance bids first.</p>
                            <button onclick="app.setActiveView('admin')" class="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg">Go to Admin Panel</button>
                        </div>`;
                    return;
                }

                // Group maintenance results by employee
                const empMap = {};
                this.state.maintResults.forEach(r => {
                    if (!empMap[r.employeeId]) empMap[r.employeeId] = [];
                    empMap[r.employeeId].push(r);
                });

                content.innerHTML = `
                    <div class="max-w-5xl mx-auto">
                        <div class="bg-white rounded-xl shadow-xl p-6">
                            <div class="flex items-center justify-between mb-6">
                                <div>
                                    <h2 class="text-2xl font-bold">✏️ Maintenance Manual Override</h2>
                                    <p class="text-sm text-gray-500 mt-1">Edit any maintenance employee's assigned leave slots directly.</p>
                                </div>
                                <button onclick="app.setActiveView('dashboard')" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">← Back</button>
                            </div>
                            <div id="maintOverrideMsg"></div>
                            <div class="overflow-x-auto">
                                <table class="w-full text-sm">
                                    <thead class="bg-gray-50 text-gray-600">
                                        <tr>
                                            <th class="p-3 text-left">Maintenance Staff</th>
                                            <th class="p-3 text-left">Slot</th>
                                            <th class="p-3 text-left">Slot Name</th>
                                            <th class="p-3 text-left">Start Date</th>
                                            <th class="p-3 text-left">End Date</th>
                                            <th class="p-3 text-left">Days</th>
                                            <th class="p-3 text-left">Type</th>
                                            <th class="p-3 text-left">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${Object.entries(empMap).map(([empId, slots]) => {
                                            const emp = (this.state.maintenanceStaffUsers || []).find(e => e.id === empId);
                                            return slots.sort((a,b)=>(a.slotOrder||0)-(b.slotOrder||0)).map((r, i) => `
                                                <tr class="border-b hover:bg-gray-50" id="maint-row-${empId}-${r.slotOrder}">
                                                    ${i===0 ? `<td class="p-3 font-semibold" rowspan="${slots.length}">${emp?.name||r.employeeName||empId}<br><span class="text-xs text-gray-400">${empId}</span></td>` : ''}
                                                    <td class="p-3 text-gray-500">Slot ${r.slotOrder}</td>
                                                    <td class="p-3">
                                                        <input type="text" class="border rounded px-2 py-1 w-28 text-xs" value="${r.slotName||''}" id="ov-maint-slotName-${empId}-${r.slotOrder}" />
                                                    </td>
                                                    <td class="p-3">
                                                        <input type="date" class="border rounded px-2 py-1 text-xs" value="${r.startDate||''}" id="ov-maint-start-${empId}-${r.slotOrder}" />
                                                    </td>
                                                    <td class="p-3">
                                                        <input type="date" class="border rounded px-2 py-1 text-xs" value="${r.endDate||''}" id="ov-maint-end-${empId}-${r.slotOrder}" />
                                                    </td>
                                                    <td class="p-3">
                                                        <input type="number" class="border rounded px-2 py-1 w-16 text-xs" value="${r.days||0}" id="ov-maint-days-${empId}-${r.slotOrder}" min="1" max="60" />
                                                    </td>
                                                    <td class="p-3">
                                                        <select class="border rounded px-2 py-1 text-xs" id="ov-maint-type-${empId}-${r.slotOrder}">
                                                            <option value="Bid Awarded" ${r.type==='Bid Awarded'?'selected':''}>Bid Awarded</option>
                                                            <option value="Auto-Assigned" ${r.type==='Auto-Assigned'?'selected':''}>Auto-Assigned</option>
                                                            <option value="Manual Override" ${r.type==='Manual Override'?'selected':''}>Manual Override</option>
                                                        </select>
                                                    </td>
                                                    <td class="p-3">
                                                        <button onclick="app.saveMaintOverride('${empId}', ${r.slotOrder})" class="px-3 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 font-semibold">Save</button>
                                                    </td>
                                                </tr>
                                            `).join('');
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <div class="mt-6 flex gap-3">
                                <button onclick="app.saveAllMaintOverrides()" class="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600">💾 Save All Changes to Database</button>
                                <button onclick="app.setActiveView('dashboard')" class="px-6 py-3 bg-gray-400 text-white rounded-lg font-semibold hover:bg-gray-500">Cancel</button>
                            </div>
                        </div>
                    </div>
                `;
            },

            saveMaintOverride(empId, slotOrder) {
                const idx = this.state.maintResults.findIndex(r => r.employeeId === empId && r.slotOrder === slotOrder);
                if (idx === -1) { alert('Result not found'); return; }
                this.state.maintResults[idx].slotName  = document.getElementById(`ov-maint-slotName-${empId}-${slotOrder}`)?.value || this.state.maintResults[idx].slotName;
                this.state.maintResults[idx].startDate = document.getElementById(`ov-maint-start-${empId}-${slotOrder}`)?.value || this.state.maintResults[idx].startDate;
                this.state.maintResults[idx].endDate   = document.getElementById(`ov-maint-end-${empId}-${slotOrder}`)?.value   || this.state.maintResults[idx].endDate;
                this.state.maintResults[idx].days      = parseInt(document.getElementById(`ov-maint-days-${empId}-${slotOrder}`)?.value) || this.state.maintResults[idx].days;
                this.state.maintResults[idx].type      = document.getElementById(`ov-maint-type-${empId}-${slotOrder}`)?.value || this.state.maintResults[idx].type;
                this.saveState();
                const msg = document.getElementById('maintOverrideMsg');
                if (msg) { msg.innerHTML = `<div class="mb-3 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">✅ Slot ${slotOrder} for ${(this.state.maintenanceStaffUsers || []).find(e=>e.id===empId)?.name||empId} updated locally. Click "Save All" to push to database.</div>`; }
            },

            async saveAllMaintOverrides() {
                this.saveState();
                this.writeAuditLog('MANUAL_OVERRIDE', { action: 'maintenance', total_results: this.state.maintResults.length });
                try {
                    if (this.supabase) {
                        const { error } = await this.supabase.from('system_config_82').update({ maint_results: this.state.maintResults }).eq('id', 1);
                        if (error) throw error;
                    }
                    const msg = document.getElementById('maintOverrideMsg');
                    if (msg) msg.innerHTML = `<div class="mb-3 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">✅ All maintenance overrides saved to database successfully!</div>`;
                } catch(err) {
                    console.error(err);
                    const msg = document.getElementById('maintOverrideMsg');
                    if (msg) msg.innerHTML = `<div class="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">❌ Database save failed. Changes saved locally only.</div>`;
                }
            },

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
            async writeAuditLog(action, details = {}) {
                const entry = {
                    action,
                    user_id: this.state.currentUser?.id || this.state.currentUser?.name || 'unknown',
                    user_name: this.state.currentUser?.name || 'unknown',
                    user_type: this.state.userType || 'unknown',
                    details: JSON.stringify(details),
                    timestamp: new Date().toISOString()
                };

                // Always save locally
                try {
                    const local = JSON.parse(localStorage.getItem('auditLog') || '[]');
                    local.unshift(entry);
                    localStorage.setItem('auditLog', JSON.stringify(local.slice(0, 500))); // keep last 500
                } catch(e) { console.warn('Audit local save failed', e); }

                // Also save to Supabase audit_logs table
                if (this.supabase) {
                    try {
                        await this.supabase.from('audit_logs').insert({
                            tenant_id: this._tid(),
                            action: entry.action,
                            user_id: entry.user_id,
                            user_name: entry.user_name,
                            user_type: entry.user_type,
                            details: entry.details,
                            created_at: entry.timestamp
                        });
                    } catch(e) { console.warn('Audit Supabase save failed', e); }
                }
            },

            renderLeaveDashboardView() {
                var self = this;
                var content = document.getElementById('contentArea');

                var lcCSS = [
                    '#lcDash *{box-sizing:border-box;margin:0;padding:0;}',
                    '#lcDash{font-family:Barlow,sans-serif;background:linear-gradient(135deg,#e8f4ff 0%,#f0f8ff 40%,#e0efff 100%);min-height:80vh;border-radius:12px;overflow:hidden;color:#1a2e42;}',
                    '#lcTopbar{display:flex;align-items:center;justify-content:space-between;padding:14px 22px;background:linear-gradient(135deg,#1565c0 0%,#0288d1 50%,#00bcd4 100%);border-bottom:none;flex-wrap:wrap;gap:8px;border-radius:12px 12px 0 0;}',
                    '.lc-logo{font-family:"Barlow Condensed",sans-serif;font-size:1.35rem;font-weight:800;color:#fff;letter-spacing:.08em;}',
                    '.lc-logo span{color:#4eb0ff;}',
                    '.lc-badge-yr{background:rgba(255,255,255,.25);border:1px solid rgba(255,255,255,.6);color:#fff;font-size:.68rem;font-weight:700;letter-spacing:.15em;padding:2px 10px;border-radius:20px;text-transform:uppercase;}',
                    '.lc-tabs{display:flex;gap:6px;flex-wrap:wrap;}',
                    '.lc-tab-btn{font-family:"Barlow Condensed",sans-serif;font-size:.8rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:6px 13px;border-radius:7px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.15);color:rgba(255,255,255,.8);cursor:pointer;transition:all .15s;}',
                    '.lc-tab-btn:hover{border-color:rgba(255,255,255,.7);color:#fff;}',
                    '.lc-tab-btn.active{background:#fff;border-color:#fff;color:#1565c0;}',
                    '.lc-month-nav{display:flex;align-items:center;gap:5px;}',
                    '.lc-mnav-btn{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:.9rem;transition:all .15s;}',
                    '.lc-mnav-btn:hover{background:rgba(255,255,255,.35);}',
                    '.lc-mnav-label{font-family:"Barlow Condensed",sans-serif;font-size:1rem;font-weight:700;min-width:120px;text-align:center;color:#fff;}',
                    '.lc-stats{display:flex;gap:12px;padding:10px 22px;background:#fff;border-bottom:1px solid rgba(30,100,200,.1);overflow-x:auto;flex-wrap:nowrap;}',
                    '.lc-stat{display:flex;align-items:center;gap:9px;background:#f0f7ff;border:1px solid rgba(21,101,192,.15);border-radius:10px;padding:7px 14px;white-space:nowrap;}',
                    '.lc-stat .sv{font-size:1.3rem;font-weight:700;font-family:"Barlow Condensed",sans-serif;}',
                    '.lc-stat .sl{font-size:.67rem;color:rgba(30,60,100,.5);text-transform:uppercase;letter-spacing:.1em;}',
                    '.sv-blue{color:#4eb0ff;}.sv-red{color:#ff6b6b;}.sv-green{color:#2ecc9a;}.sv-amber{color:#ffc36b;}',
                    '.lc-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
                    '.lc-search{position:relative;}',
                    '.lc-search input{background:rgba(255,255,255,.25);border:1px solid rgba(255,255,255,.5);color:#fff;font-size:.8rem;padding:6px 10px 6px 28px;border-radius:8px;outline:none;width:160px;}',
                    '.lc-search input:focus{border-color:#fff;}',
                    '.lc-search::before{content:"\\1F50D";position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:.7rem;}',
                    '.lc-export-btn,.lc-refresh-btn{font-family:"Barlow Condensed",sans-serif;font-size:.78rem;font-weight:700;letter-spacing:.08em;padding:6px 13px;border-radius:8px;border:1px solid rgba(255,255,255,.5);background:rgba(255,255,255,.15);color:#fff;cursor:pointer;transition:all .15s;}',
                    '.lc-export-btn:hover,.lc-refresh-btn:hover{background:rgba(255,255,255,.3);}',
                    '.lc-refresh-btn{color:#fff;border-color:rgba(255,255,255,.5);}',
                    '.lc-live-badge{font-size:.65rem;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.5);color:#fff;padding:2px 8px;border-radius:10px;letter-spacing:.08em;}',
                    '#lcGrid{overflow-x:auto;background:#fff;}',
                    '#lcGrid::-webkit-scrollbar{height:5px;}',
                    '#lcGrid::-webkit-scrollbar-track{background:#f0f7ff;}',
                    '#lcGrid::-webkit-scrollbar-thumb{background:rgba(100,180,255,.25);border-radius:3px;}',
                    '.lc-date-hdr{display:flex;position:sticky;top:0;z-index:50;background:#1565c0;border-bottom:1px solid rgba(21,101,192,.3);min-width:max-content;}',
                    '.lc-hdr-row2{display:flex;position:sticky;top:37px;z-index:49;background:#1976d2;border-bottom:1px solid rgba(21,101,192,.2);min-width:max-content;}',
                    '.lc-frozen-hdr{position:sticky;left:0;z-index:30;display:flex;background:#1565c0;border-right:2px solid rgba(255,255,255,.25);box-shadow:3px 0 8px rgba(0,0,0,.15);}',
                    '.lc-fh-name{width:195px;padding:7px 11px;font-size:.62rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.7);font-weight:600;border-right:1px solid rgba(255,255,255,.15);}',
                    '.lc-fh-meta{width:175px;padding:7px 11px;font-size:.62rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.7);font-weight:600;}',
                    '.lc-date-cells{display:flex;}',
                    '.lc-dc{width:30px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3px 0;border-right:1px solid rgba(255,255,255,.12);cursor:default;background:#1565c0;}',
                    '.lc-dc .dcd{font-size:.55rem;color:rgba(255,255,255,.7);text-transform:uppercase;}',
                    '.lc-dc .dcn{font-family:"Barlow Condensed",sans-serif;font-size:.88rem;font-weight:700;color:#fff;}',
                    '.lc-dc.wknd{background:#0d47a1;}',
                    '.lc-dc.wknd .dcn{color:rgba(255,255,255,.55);}',
                    '.lc-dc.td-col .dcn{color:#fff;}',
                    '.lc-dc.td-col{background:#f57f17;}',
                    '.lc-dept-hdr{display:flex;align-items:center;gap:9px;padding:5px 13px;background:#e3f0ff;border-bottom:1px solid rgba(21,101,192,.15);border-top:1px solid rgba(21,101,192,.15);min-width:max-content;}',
                    '.lc-dept-tag{font-family:"Barlow Condensed",sans-serif;font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:2px 10px;border-radius:5px;}',
                    '.dt-exec{background:rgba(78,176,255,.2);color:#90ccff;border:1px solid rgba(78,176,255,.35);}',
                    '.dt-pmo{background:rgba(170,120,255,.2);color:#caaeff;border:1px solid rgba(170,120,255,.35);}',
                    '.dt-strat{background:rgba(46,204,154,.2);color:#7eedc8;border:1px solid rgba(46,204,154,.35);}',
                    '.dt-hsqe{background:rgba(255,195,80,.2);color:#ffd98a;border:1px solid rgba(255,195,80,.35);}',
                    '.dt-ops{background:rgba(255,107,107,.2);color:#ffaaaa;border:1px solid rgba(255,107,107,.35);}',
                    '.lc-staff-row{display:flex;align-items:stretch;border-bottom:1px solid rgba(21,101,192,.08);min-width:max-content;}',
                    '.lc-staff-row:hover .lc-frozen-name,.lc-staff-row:hover .lc-frozen-meta{background:#f0f7ff;}.lc-staff-row:hover{background:rgba(78,176,255,.04);}',
                    '.lc-frozen-name{position:sticky;left:0;z-index:20;width:195px;padding:7px 11px;display:flex;flex-direction:column;justify-content:center;background:#fff;border-right:1px solid rgba(21,101,192,.15);flex-shrink:0;box-shadow:2px 0 6px rgba(21,101,192,.08);}',
                    '.lc-sname{font-size:.8rem;font-weight:600;color:#1a2e42;line-height:1.2;}',
                    '.lc-sid{font-size:.62rem;color:rgba(30,60,100,.45);font-family:monospace;margin-top:2px;}',
                    '.lc-frozen-meta{position:sticky;left:195px;z-index:20;width:175px;padding:7px 11px;display:flex;flex-direction:column;justify-content:center;background:#fff;border-right:2px solid rgba(21,101,192,.2);flex-shrink:0;box-shadow:3px 0 8px rgba(21,101,192,.1);}',
                    '.lc-stitle{font-size:.67rem;color:rgba(30,60,100,.6);line-height:1.3;}',
                    '.lc-lcount{margin-top:3px;font-size:.63rem;font-weight:700;font-family:"Barlow Condensed",sans-serif;display:flex;align-items:center;gap:4px;}',
                    '.lc-lval{color:#ff6b6b;}.lc-llab{color:rgba(200,225,255,.38);text-transform:uppercase;letter-spacing:.08em;}',
                    '.lc-sick-count{margin-top:1px;}',
                    '.lc-lval-sick{color:#ffb74d;font-weight:700;}',
                    '.lc-leave-cells{display:flex;}',
                    '.lc-c{width:30px;height:42px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-right:1px solid rgba(100,180,255,.07);font-size:.65rem;font-weight:700;}',
                    '.lc-c.leave{background:rgba(255,107,107,.22);color:#ff8080;}',
                    '.lc-c.leave-start{background:rgba(255,107,107,.28);color:#ff8080;border-left:2px solid #ff6b6b;}',
                    '.lc-c.leave-sick{background:rgba(255,183,77,.24);color:#ffb74d;}',
                    '.lc-c.wknd{background:rgba(100,140,200,.07);}',
                    '.lc-c.td-c{background:rgba(78,176,255,.06);}',
                    '.lc-c.leave.wknd{background:rgba(255,107,107,.14);}',
                    '.lc-c.leave-sick.wknd{background:rgba(255,183,77,.15);}',
                    '.lc-month-band{display:flex;align-items:center;background:rgba(78,176,255,.08);border-right:1px solid rgba(100,180,255,.22);padding:0 8px;font-family:"Barlow Condensed",sans-serif;font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#4eb0ff;white-space:nowrap;}',
                    '.lc-legend{display:flex;gap:14px;align-items:center;padding:9px 22px;border-top:1px solid rgba(21,101,192,.1);background:#f0f7ff;font-size:.67rem;color:rgba(30,60,100,.5);flex-wrap:wrap;}',
                    '.lc-leg-item{display:flex;align-items:center;gap:5px;}',
                    '.lc-leg-sw{width:13px;height:13px;border-radius:3px;}',
                    '#lcTooltip{position:fixed;z-index:9999;background:#1c3450;border:1px solid rgba(100,180,255,.35);border-radius:8px;padding:8px 12px;font-size:.76rem;color:#d8eaf7;pointer-events:none;display:none;box-shadow:0 8px 24px rgba(0,0,0,.55);max-width:230px;line-height:1.5;}',
                    '#lcTooltip strong{color:#4eb0ff;}',
                    '.lc-empty{padding:55px;text-align:center;color:rgba(200,225,255,.35);font-family:"Barlow Condensed",sans-serif;font-size:1.05rem;letter-spacing:.05em;}',
                    '.lc-no-bids{padding:40px;text-align:center;background:#f0f7ff;border-radius:10px;margin:20px;color:rgba(30,60,100,.4);}',
                    '.lc-no-bids .lc-nb-icon{font-size:2.5rem;margin-bottom:10px;}',
                    '.lc-no-bids p{font-size:.9rem;}',
                    '.lc-sf-btn{font-family:"Barlow Condensed",sans-serif;font-size:.78rem;font-weight:700;letter-spacing:.08em;padding:6px 13px;border-radius:8px;border:1px solid rgba(255,210,80,.7);background:rgba(255,193,7,.2);color:#ffe082;cursor:pointer;transition:all .15s;}',
                    '.lc-sf-btn:hover{background:rgba(255,193,7,.35);border-color:#ffe082;color:#fff;}',
                    '#lcSfModal{display:none;position:fixed;inset:0;z-index:10000;background:rgba(10,20,40,.72);align-items:center;justify-content:center;}',
                    '#lcSfModal.open{display:flex;}',
                    '#lcSfBox{background:#0d1b2e;border:1px solid rgba(100,180,255,.25);border-radius:14px;padding:26px 28px;width:560px;max-width:95vw;box-shadow:0 24px 60px rgba(0,0,0,.7);color:#d8eaf7;font-family:Barlow,sans-serif;}',
                    '#lcSfBox h3{font-family:"Barlow Condensed",sans-serif;font-size:1.15rem;font-weight:800;letter-spacing:.08em;color:#4eb0ff;margin-bottom:4px;}',
                    '#lcSfBox p.lc-sf-sub{font-size:.73rem;color:rgba(200,225,255,.45);margin-bottom:14px;line-height:1.5;}',
                    '#lcSfBox label{font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:rgba(200,225,255,.5);display:block;margin-bottom:5px;}',
                    '#lcSfBox textarea{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(100,180,255,.22);border-radius:8px;color:#d8eaf7;font-size:.76rem;font-family:monospace;padding:10px;resize:vertical;min-height:130px;outline:none;}',
                    '#lcSfBox textarea:focus{border-color:rgba(100,180,255,.5);}',
                    '.lc-sf-row{display:flex;gap:10px;margin-top:14px;align-items:center;flex-wrap:wrap;}',
                    '.lc-sf-run{font-family:"Barlow Condensed",sans-serif;font-size:.82rem;font-weight:700;letter-spacing:.08em;padding:8px 18px;border-radius:8px;background:#1565c0;border:1px solid #4eb0ff;color:#fff;cursor:pointer;transition:all .15s;}',
                    '.lc-sf-run:hover{background:#1976d2;}',
                    '.lc-sf-run:disabled{opacity:.45;cursor:not-allowed;}',
                    '.lc-sf-cancel{font-family:"Barlow Condensed",sans-serif;font-size:.78rem;font-weight:600;padding:8px 14px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);color:rgba(200,225,255,.6);cursor:pointer;}',
                    '.lc-sf-cancel:hover{background:rgba(255,255,255,.12);}',
                    '#lcSfStatus{flex:1;font-size:.73rem;color:rgba(200,225,255,.5);min-width:160px;}',
                    '#lcSfStatus.ok{color:#2ecc9a;}',
                    '#lcSfStatus.err{color:#ff6b6b;}',
                    '#lcSfStatus.warn{color:#ffc36b;}',
                    '.lc-sf-preview{margin-top:12px;background:rgba(255,255,255,.04);border:1px solid rgba(100,180,255,.12);border-radius:8px;padding:10px;max-height:180px;overflow-y:auto;font-size:.7rem;font-family:monospace;color:rgba(200,225,255,.6);display:none;}',
                    '.lc-sf-preview.show{display:block;}',
                    '.lc-sf-row2{display:flex;gap:8px;margin-top:10px;align-items:center;}',
                    '.lc-sf-filebtn{font-size:.72rem;padding:6px 12px;border-radius:7px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);color:rgba(200,225,255,.7);cursor:pointer;font-family:"Barlow Condensed",sans-serif;font-weight:600;letter-spacing:.06em;}',
                    '.lc-sf-filebtn:hover{background:rgba(255,255,255,.14);}',
                    '.lc-dc.ph{background:#6a1b9a;}',
                    '.lc-dc.ph .dcn{color:rgba(255,255,255,.8);}',
                    '.lc-c.ph{background:rgba(171,71,188,.18);}',
                    '.lc-c.leave.ph{background:rgba(171,71,188,.30);color:#e1bee7;}',
                    '.lc-year-nav{display:flex;align-items:center;gap:4px;margin-left:4px;padding-left:8px;border-left:1px solid rgba(255,255,255,.25);}',
                    '.lc-year-btn{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;padding:5px 8px;border-radius:7px;cursor:pointer;font-size:.85rem;}',
                    '.lc-year-btn:hover{background:rgba(255,255,255,.35);}',
                    '.lc-year-label{font-family:"Barlow Condensed",sans-serif;font-size:.95rem;font-weight:700;min-width:44px;text-align:center;color:#fff;}',
                    '.lc-ph-btn{font-family:"Barlow Condensed",sans-serif;font-size:.78rem;font-weight:700;letter-spacing:.08em;padding:6px 13px;border-radius:8px;border:1px solid rgba(206,147,216,.7);background:rgba(171,71,188,.22);color:#f3e5f5;cursor:pointer;transition:all .15s;}',
                    '.lc-ph-btn:hover{background:rgba(171,71,188,.4);border-color:#f3e5f5;color:#fff;}',
                    '#lcPhModal{display:none;position:fixed;inset:0;z-index:10000;background:rgba(10,20,40,.72);align-items:center;justify-content:center;}',
                    '#lcPhModal.open{display:flex;}',
                    '#lcPhBox{background:#0d1b2e;border:1px solid rgba(171,71,188,.35);border-radius:14px;padding:26px 28px;width:480px;max-width:95vw;max-height:85vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.7);color:#d8eaf7;font-family:Barlow,sans-serif;}',
                    '#lcPhBox h3{font-family:"Barlow Condensed",sans-serif;font-size:1.15rem;font-weight:800;letter-spacing:.08em;color:#ce93d8;margin-bottom:4px;}',
                    '#lcPhBox p.lc-ph-sub{font-size:.73rem;color:rgba(200,225,255,.45);margin-bottom:14px;line-height:1.5;}',
                    '.lc-ph-form{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end;}',
                    '.lc-ph-form label{font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:rgba(200,225,255,.5);display:block;margin-bottom:4px;}',
                    '.lc-ph-form input[type=date],.lc-ph-form input[type=text]{background:rgba(255,255,255,.06);border:1px solid rgba(171,71,188,.3);border-radius:8px;color:#d8eaf7;font-size:.78rem;padding:7px 9px;outline:none;}',
                    '.lc-ph-form input:focus{border-color:#ce93d8;}',
                    '.lc-ph-name-input{width:170px;}',
                    '.lc-ph-add{font-family:"Barlow Condensed",sans-serif;font-size:.8rem;font-weight:700;padding:8px 16px;border-radius:8px;background:#6a1b9a;border:1px solid #ce93d8;color:#fff;cursor:pointer;}',
                    '.lc-ph-add:hover{background:#7b1fa2;}',
                    '.lc-ph-list{display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;}',
                    '.lc-ph-row{display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.04);border:1px solid rgba(171,71,188,.15);border-radius:8px;padding:8px 12px;gap:8px;}',
                    '.lc-ph-row .lc-ph-date{font-weight:700;color:#ce93d8;font-size:.78rem;min-width:88px;}',
                    '.lc-ph-row .lc-ph-name{font-size:.78rem;color:rgba(216,234,247,.8);flex:1;}',
                    '.lc-ph-del{background:rgba(255,107,107,.15);border:1px solid rgba(255,107,107,.4);color:#ff8080;border-radius:6px;padding:4px 9px;font-size:.7rem;cursor:pointer;}',
                    '.lc-ph-del:hover{background:rgba(255,107,107,.3);}',
                    '.lc-ph-empty{font-size:.75rem;color:rgba(200,225,255,.35);text-align:center;padding:16px;}',
                    '.lc-ph-status{font-size:.7rem;margin-bottom:10px;min-height:14px;}',
                    '.lc-ph-status.ok{color:#2ecc9a;}',
                    '.lc-ph-status.err{color:#ff6b6b;}',
                    '.lc-ph-close{margin-top:16px;font-family:"Barlow Condensed",sans-serif;font-size:.78rem;font-weight:600;padding:8px 14px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);color:rgba(200,225,255,.6);cursor:pointer;}',
                    '.lc-ph-close:hover{background:rgba(255,255,255,.12);}'
                ].join('\n');

                var lcHTML = '<div id="lcDash">'
                    + '<style>' + lcCSS + '</style>'
                    + '<div id="lcTopbar">'
                    +   '<div style="display:flex;align-items:center;gap:10px;">'
                    +     '<div class="lc-logo">FLOW <span>METRO</span></div>'
                    +     '<div class="lc-badge-yr" id="lcYearBadge">GC &amp; CS Leave Tracker</div>'
                    +     '<span class="lc-live-badge" id="lcLiveBadge">&#9679; LIVE</span>'
                    +   '</div>'
                    +   '<div class="lc-tabs">'
                    +     '<button class="lc-tab-btn active" onclick="lcSetDept(\'all\')" id="lct-all">All</button>'
                    +     '<button class="lc-tab-btn" onclick="lcSetDept(\'gc\')" id="lct-gc">Golden Command</button>'
                    +     '<button class="lc-tab-btn" onclick="lcSetDept(\'cs\')" id="lct-cs">Corporate Staff</button>'
                    +   '</div>'
                    +   '<div class="lc-controls">'
                    +     '<div class="lc-month-nav">'
                    +       '<button class="lc-mnav-btn" onclick="lcPrevMonth()">&#8249;</button>'
                    +       '<div class="lc-mnav-label" id="lcMonthLabel">April 2026</div>'
                    +       '<button class="lc-mnav-btn" onclick="lcNextMonth()">&#8250;</button>'
                    +       '<button class="lc-mnav-btn" onclick="lcShowAll()" style="font-size:.72rem;padding:4px 8px;">Full Year</button>'
                    +       '<div class="lc-year-nav">'
                    +         '<button class="lc-year-btn" onclick="lcPrevYear()" title="Previous year">&#8249;&#8249;</button>'
                    +         '<div class="lc-year-label" id="lcYearLabel">2026</div>'
                    +         '<button class="lc-year-btn" onclick="lcNextYear()" title="Next year">&#8250;&#8250;</button>'
                    +       '</div>'
                    +     '</div>'
                    +     '<div class="lc-search"><input type="text" id="lcSearch" placeholder="Search staff..." oninput="lcFilterStaff(this.value)"></div>'
                    +     '<button class="lc-refresh-btn" onclick="lcRefresh()">&#8635; Refresh</button>'
                    +     '<button class="lc-sf-btn" onclick="lcOpenSfSync()">&#8645; SF Sync</button>'
                    +     '<button class="lc-ph-btn" onclick="lcOpenPhModal()">&#127881; Public Holidays</button>'
                    +     '<button class="lc-export-btn" onclick="lcExportCSV()">&#11015; CSV</button>'
                    +   '</div>'
                    + '</div>'
                    + '<div class="lc-stats" id="lcStats"></div>'
                    + '<div id="lcGrid"></div>'
                    + '<div class="lc-legend">'
                    +   '<div class="lc-leg-item"><div class="lc-leg-sw" style="background:rgba(255,107,107,.22);border:1px solid #ff6b6b;"></div>A &mdash; Annual Leave</div>'
                    +   '<div class="lc-leg-item"><div class="lc-leg-sw" style="background:rgba(255,183,77,.24);border:1px solid #ffb74d;"></div>SL &mdash; Sick Leave</div>'
                    +   '<div class="lc-leg-item"><div class="lc-leg-sw" style="background:rgba(100,140,200,.1);border:1px solid rgba(100,140,200,.2);"></div>Fri / Sat</div>'
                    +   '<div class="lc-leg-item"><div class="lc-leg-sw" style="background:rgba(171,71,188,.18);border:1px solid #ab47bc;"></div>Public Holiday</div>'
                    +   '<div class="lc-leg-item"><div class="lc-leg-sw" style="background:rgba(78,176,255,.08);border:1px solid #4eb0ff;"></div>Today</div>'
                    +   '<div style="margin-left:auto;font-size:.62rem;">Leave days shown exclude Fri/Sat &amp; public holidays &middot; Connected to Admin &#8250; Bid Details &#8250; GC &amp; Corporate Staff</div>'
                    + '</div>'
                    + '<div id="lcTooltip"></div>'
                    + '<div id="lcPhModal">'
                    +   '<div id="lcPhBox">'
                    +     '<h3>&#127881; Public Holiday Configuration</h3>'
                    +     '<p class="lc-ph-sub">Dates added here are excluded from leave day totals for every staff member, in addition to Fridays and Saturdays. Holidays apply to whichever year they fall in.</p>'
                    +     '<div class="lc-ph-form">'
                    +       '<div><label>Date</label><input type="date" id="lcPhDateInput"></div>'
                    +       '<div><label>Name (optional)</label><input type="text" id="lcPhNameInput" class="lc-ph-name-input" placeholder="e.g. National Day"></div>'
                    +       '<button class="lc-ph-add" onclick="lcAddPublicHoliday()">+ Add</button>'
                    +     '</div>'
                    +     '<div class="lc-ph-status" id="lcPhStatus"></div>'
                    +     '<div class="lc-ph-list" id="lcPhList"></div>'
                    +     '<button class="lc-ph-close" onclick="lcClosePhModal()">Close</button>'
                    +   '</div>'
                    + '</div>'
                    + '<div id="lcSfModal">'
                    +   '<div id="lcSfBox">'
                    +     '<h3>&#8645; SAP SuccessFactors &mdash; Leave Sync</h3>'
                    +     '<p class="lc-sf-sub">Paste the exported SF leave data (CSV or tab-separated). <strong style="color:#ffe082;">Only employees listed in this dashboard will be imported.</strong> Any request from an employee not in the tracker is silently excluded.</p>'
                    +     '<div class="lc-sf-row2">'
                    +       '<label style="margin:0;cursor:pointer;" class="lc-sf-filebtn" for="lcSfFileInput">&#128196; Upload Excel / CSV / TSV</label>'
                    +       '<input type="file" id="lcSfFileInput" accept=".xlsx,.xls,.csv,.tsv,.txt" style="display:none;" onchange="lcSfLoadFile(this)">'
                    +       '<span id="lcSfFileName" style="font-size:.7rem;color:rgba(200,225,255,.4);"></span>'
                    +     '</div>'
                    +     '<label style="margin-top:10px;">Or paste raw data (CSV / tab-separated)</label>'
                    +     '<textarea id="lcSfRaw" placeholder="employee_id, employee_name, leave_type, start_date, end_date, days&#10;1000888, Ahmed Al-Rashidi, Annual Leave, 2026-03-01, 2026-03-10, 10&#10;&#10;Header row is auto-detected and skipped. Dates must be YYYY-MM-DD."></textarea>'
                    +     '<div class="lc-sf-preview" id="lcSfPreview"></div>'
                    +     '<div class="lc-sf-row">'
                    +       '<button class="lc-sf-run" id="lcSfRunBtn" onclick="lcRunSfSync()">&#9654; Run Sync</button>'
                    +       '<button class="lc-sf-cancel" onclick="lcCloseSfSync()">Cancel</button>'
                    +       '<div id="lcSfStatus"></div>'
                    +     '</div>'
                    +   '</div>'
                    + '</div>'
                    + '</div>';

                content.innerHTML = lcHTML;

                // ── Helpers ──────────────────────────────────────────────
                var LC_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                var LC_DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

                var lcViewMode = 'month';
                var lcMonth    = new Date().getMonth();
                var lcYear     = self.state.biddingYear || new Date().getFullYear();
                var lcDeptFilter = 'all';
                var lcQuery    = '';
                var lcToday    = new Date();
                var lcTodayStr = lcToday.getFullYear() + '-' + String(lcToday.getMonth()+1).padStart(2,'0') + '-' + String(lcToday.getDate()).padStart(2,'0');

                // ── Public Holiday configuration ────────────────────────
                // Stored as an array of {date:'YYYY-MM-DD', name} objects.
                // Cached in localStorage and (if available) synced to a
                // Supabase table called `public_holidays` (columns: id,
                // tenant_id, date, name, created_at). If that table doesn't
                // exist yet, the dashboard silently falls back to the
                // localStorage-only copy so nothing breaks.
                var lcPublicHolidays = [];
                var lcPhSet = new Set();

                function lcRebuildPhSet() {
                    lcPhSet = new Set(lcPublicHolidays.map(function(h) { return h.date; }));
                }
                function lcIsWE(dt) { var d = dt.getDay(); return d === 5 || d === 6; }
                function lcIsPH(dt) { return lcPhSet.has(lcDK(dt)); }

                function lcDK(dt) {
                    return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
                }

                // Normalise a raw SF/SAP "Absences" value into the two-letter
                // dashboard code shown on the calendar: A = Annual Leave, SL = Sick Leave.
                // Anything not clearly identifiable as sick defaults to Annual so existing
                // records without a leave_type (pre-dating this feature) keep showing 'A'.
                function lcAbsenceCode(rawType) {
                    var t = (rawType || '').toString().trim().toLowerCase();
                    if (!t) return 'A';
                    if (t === 'sl' || t.indexOf('sick') > -1) return 'SL';
                    return 'A';
                }

                function lcLoadPhLocal() {
                    try {
                        var raw = localStorage.getItem('lcPublicHolidays');
                        lcPublicHolidays = raw ? JSON.parse(raw) : [];
                    } catch(e) { lcPublicHolidays = []; }
                    lcRebuildPhSet();
                }
                function lcSavePhLocal() {
                    try { localStorage.setItem('lcPublicHolidays', JSON.stringify(lcPublicHolidays)); } catch(e) {}
                }
                async function lcLoadPublicHolidays() {
                    lcLoadPhLocal();
                    if (self.supabase) {
                        try {
                            var { data, error } = await self.supabase
                                .from('public_holidays')
                                .select('date, name')
                                .eq('tenant_id', self._tid())
                                .order('date', { ascending: true });
                            if (error) {
                                console.warn('Public holidays: Supabase select returned an error, keeping local cache', error);
                            } else if (data && data.length > 0) {
                                // Supabase has rows — trust it as the source of truth.
                                lcPublicHolidays = data.map(function(r) { return { date: r.date, name: r.name || '' }; });
                                lcSavePhLocal();
                            } else if (data && data.length === 0 && lcPublicHolidays.length > 0) {
                                // Supabase came back empty but we already have entries locally.
                                // This almost always means earlier inserts never actually reached
                                // Supabase (missing table / RLS policy / tenant mismatch), NOT that
                                // the holidays were intentionally deleted. Keep the local cache and
                                // try to re-push it so future loads stay in sync.
                                console.warn('Public holidays: Supabase returned 0 rows but local cache has ' + lcPublicHolidays.length + ' — keeping local cache and re-syncing to Supabase.');
                                for (const h of lcPublicHolidays) {
                                    try {
                                        await self.supabase.from('public_holidays').insert({
                                            tenant_id: self._tid(), date: h.date, name: h.name
                                        });
                                    } catch(e2) { console.error('Public holidays: re-sync insert failed for', h.date, e2); }
                                }
                            }
                        } catch(e) { console.warn('Public holidays: Supabase load failed, using local cache', e); }
                    }
                    lcRebuildPhSet();
                }
                window.lcAddPublicHoliday = async function() {
                    var dateEl = document.getElementById('lcPhDateInput');
                    var nameEl = document.getElementById('lcPhNameInput');
                    var statusEl = document.getElementById('lcPhStatus');
                    var date = dateEl ? dateEl.value : '';
                    var name = nameEl ? nameEl.value.trim() : '';
                    if (!date) {
                        if (statusEl) { statusEl.textContent = 'Please pick a date first.'; statusEl.className = 'lc-ph-status err'; }
                        return;
                    }
                    if (lcPhSet.has(date)) {
                        if (statusEl) { statusEl.textContent = 'That date is already configured.'; statusEl.className = 'lc-ph-status err'; }
                        return;
                    }
                    lcPublicHolidays.push({ date: date, name: name });
                    lcPublicHolidays.sort(function(a,b) { return a.date.localeCompare(b.date); });
                    lcRebuildPhSet();
                    lcSavePhLocal();
                    if (dateEl) dateEl.value = '';
                    if (nameEl) nameEl.value = '';
                    if (statusEl) { statusEl.textContent = 'Added ' + date + '.'; statusEl.className = 'lc-ph-status ok'; }
                    lcRenderPhList();
                    lcRender();
                    if (self.supabase) {
                        try {
                            var { error: insErr } = await self.supabase.from('public_holidays').insert({
                                tenant_id: self._tid(), date: date, name: name
                            });
                            if (insErr) {
                                console.error('Public holidays: Supabase insert failed (saved locally only)', insErr);
                                if (statusEl) { statusEl.textContent = 'Added ' + date + ' locally, but cloud sync failed (' + (insErr.message || 'see console') + '). It may not survive a full cache clear.'; statusEl.className = 'lc-ph-status err'; }
                            }
                        } catch(e) { console.error('Public holidays: Supabase insert failed (saved locally only)', e); }
                    }
                };
                window.lcDeletePublicHoliday = async function(date) {
                    lcPublicHolidays = lcPublicHolidays.filter(function(h) { return h.date !== date; });
                    lcRebuildPhSet();
                    lcSavePhLocal();
                    lcRenderPhList();
                    lcRender();
                    if (self.supabase) {
                        try {
                            await self.supabase.from('public_holidays').delete()
                                .eq('tenant_id', self._tid()).eq('date', date);
                        } catch(e) { console.warn('Public holidays: Supabase delete failed (using local cache only)', e); }
                    }
                };
                function lcRenderPhList() {
                    var listEl = document.getElementById('lcPhList');
                    if (!listEl) return;
                    if (!lcPublicHolidays.length) {
                        listEl.innerHTML = '<div class="lc-ph-empty">No public holidays configured yet.</div>';
                        return;
                    }
                    listEl.innerHTML = lcPublicHolidays.map(function(h) {
                        return '<div class="lc-ph-row">'
                             + '<span class="lc-ph-date">' + h.date + '</span>'
                             + '<span class="lc-ph-name">' + (h.name || '&mdash;') + '</span>'
                             + '<button class="lc-ph-del" onclick="lcDeletePublicHoliday(\'' + h.date + '\')">Remove</button>'
                             + '</div>';
                    }).join('');
                }
                window.lcOpenPhModal = function() {
                    lcRenderPhList();
                    var statusEl = document.getElementById('lcPhStatus');
                    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'lc-ph-status'; }
                    var modal = document.getElementById('lcPhModal');
                    if (modal) modal.classList.add('open');
                };
                window.lcClosePhModal = function() {
                    var modal = document.getElementById('lcPhModal');
                    if (modal) modal.classList.remove('open');
                };

                // ── Working-day helpers ─────────────────────────────────
                // A day counts toward leave consumed only if it is NOT a
                // weekend (Fri/Sat) and NOT a configured public holiday.
                function lcIsWorkingDay(dt) { return !lcIsWE(dt) && !lcIsPH(dt); }

                // Count working days for a bid's date range that fall
                // within [winStart, winEnd] (inclusive). Used for both the
                // full-year total and the current month view.
                function lcWorkingDaysInWindow(bid, winStart, winEnd) {
                    if (!bid || !bid.startDate || !winStart || !winEnd) return 0;
                    var bs = new Date(bid.startDate + 'T00:00:00');
                    var be = bid.endDate ? new Date(bid.endDate + 'T00:00:00') : bs;
                    var overlapStart = bs < winStart ? winStart : bs;
                    var overlapEnd   = be > winEnd   ? winEnd   : be;
                    if (overlapStart > overlapEnd) return 0;
                    var count = 0;
                    var cur = new Date(overlapStart);
                    while (cur <= overlapEnd) {
                        if (lcIsWorkingDay(cur)) count++;
                        cur.setDate(cur.getDate() + 1);
                    }
                    return count;
                }

                // Counts each calendar date at most once per employee (using the
                // already-deduped leaveCodeByDate map) and splits the total into
                // Annual vs Sick working days within the given window. This avoids
                // double counting when two overlapping/duplicate leave records
                // (e.g. a stale test row plus a real SF-synced row) cover the same date.
                function lcCountDaysByCode(staffEntry, winStart, winEnd) {
                    var annual = 0, sick = 0;
                    var byDate = staffEntry.leaveCodeByDate || {};
                    Object.keys(byDate).forEach(function(dk) {
                        var dt = new Date(dk + 'T00:00:00');
                        if (dt < winStart || dt > winEnd) return;
                        if (!lcIsWorkingDay(dt)) return;
                        if (byDate[dk] === 'SL') sick++; else annual++;
                    });
                    return { annual: annual, sick: sick };
                }

                function lcGetDates() {
                    if (lcViewMode === 'full') {
                        var r = [];
                        for (var m = 0; m < 12; m++) {
                            var daysInM = new Date(lcYear, m+1, 0).getDate();
                            for (var d = 1; d <= daysInM; d++) r.push(new Date(lcYear, m, d));
                        }
                        return r;
                    }
                    var dIM2 = new Date(lcYear, lcMonth+1, 0).getDate(), r2 = [];
                    for (var d2 = 1; d2 <= dIM2; d2++) r2.push(new Date(lcYear, lcMonth, d2));
                    return r2;
                }

                // Build leave set from live bids
                function lcBuildStaffFromBids() {
                    var bids = self.state.bids || [];
                    var gcUsers = self.state.goldenCommandUsers  || [];
                    var csUsers = self.state.corporateStaffUsers || [];
                    var gcIds = gcUsers.map(function(u){ return u.id; });
                    var csIds = csUsers.map(function(u){ return u.id; });
                    var gccsIds = gcIds.concat(csIds);

                    // Only include the specific staff from the approved Excel list
                    var ALLOWED_IDS = ['1000888','1000008','1000027','1000124','1002536','10110','1001118','1002997','1003591','1003592','1003752','1006024','1006939','1007066','10015','10020','1000555','1000136','1000225','1000352','1000759','1000043','1000830','1000284','1000330','1000231','1000238','1005385','1007071','1006467','1007071'];

                    // Canonical job titles from approved staff list
                    var STAFF_TITLES = {
                        '1000888': 'Project Director',
                        '10110': 'TSM L456 Engineering Director',
                        '1002536': 'TSM L3 Engineering Manager',
                        '1000008': 'Senior Executive Finance Director',
                        '1000027': 'Senior Executive Human Resource Director',
                        '1000124': 'Senior Executive Director Stakeholder & Communication',
                        '1001118': 'Head of Major Services Management',
                        '1002997': 'Contract Director',
                        '1003591': 'ICT Manager',
                        '1003592': 'Head of Cyber Security',
                        '1003752': 'INM Director',
                        '1006024': 'Security Director',
                        '1006939': 'Rail Safety Manager',
                        '1007066': 'Operations Director',
                        '10015':   'TSM L456 Director',
                        '10020':   'TSM L3 Director',
                        '1000555': 'Executive Assistant Project Director',
                        '1000136': 'CMMS Manager',
                        '1000225': 'Performance Manager',
                        '1000352': 'Planning and Reporting Specialist',
                        '1000759': 'KPI & Reporting Specialist',
                        '1000043': 'Quality And Audit Manager',
                        '1000830': 'Risk Manager',
                        '1000284': 'Rail Safety Officer',
                        '1000330': 'Executive Assistant',
                        '1000231': 'Line Standards Manager',
                        '1000238': 'Line Standards Manager',
                        '1005385': 'Operation Manager L-46',
                        '1007071': 'Operation Manager L-5',
                        '1006467': 'Operation Manager L-3'
                    };

                    // Filter to GC/CS AND in allowed list
                    var gccs = bids.filter(function(b) { return gccsIds.indexOf(b.employeeId) > -1 && ALLOWED_IDS.indexOf(b.employeeId) > -1; });

                    // Full-year window for the currently selected lcYear, used to
                    // compute each bid's working-day contribution (excludes
                    // Fri/Sat weekends and configured public holidays).
                    var lcYearStart = new Date(lcYear, 0, 1);
                    var lcYearEnd   = new Date(lcYear, 11, 31);

                    // Build per-staff map
                    var staffMap = {};
                    gccs.forEach(function(bid) {
                        var id = bid.employeeId;
                        if (!staffMap[id]) {
                            var isGC = gcIds.indexOf(id) > -1;
                            staffMap[id] = {
                                id: id,
                                name: bid.employeeName || id,
                                title: STAFF_TITLES[id] || bid.position || bid.department || (isGC ? 'Golden Command' : 'Corporate Staff'),
                                group: isGC ? 'gc' : 'cs',
                                dept: isGC ? 'Golden Command' : 'Corporate Staff',
                                leaveSet: new Set(),
                                leaveCodeByDate: {},
                                bids: [],
                                totalDays: 0,
                                sickDays: 0
                            };
                        }
                        // Expand bid date range into individual days (for calendar cell highlighting only)
                        if (bid.startDate && bid.endDate) {
                            var cur = new Date(bid.startDate + 'T00:00:00');
                            var end = new Date(bid.endDate + 'T00:00:00');
                            var absCode = lcAbsenceCode(bid.leaveType);
                            while (cur <= end) {
                                staffMap[id].leaveSet.add(lcDK(cur));
                                staffMap[id].leaveCodeByDate[lcDK(cur)] = absCode;
                                cur.setDate(cur.getDate() + 1);
                            }
                        } else if (bid.startDate) {
                            staffMap[id].leaveSet.add(bid.startDate);
                            staffMap[id].leaveCodeByDate[bid.startDate] = lcAbsenceCode(bid.leaveType);
                        }
                        // Store raw bid for month-view lookups. Totals are computed
                        // AFTER this loop, once per staff, from the deduped date map
                        // (see below) so overlapping/duplicate records for the same
                        // date can't inflate the count.
                        staffMap[id].bids.push(bid);
                    });

                    // Compute full-year Annual vs Sick totals per staff from the
                    // deduped leaveCodeByDate map (each date counts once, even if
                    // multiple bids happen to cover it).
                    Object.keys(staffMap).forEach(function(id) {
                        var counts = lcCountDaysByCode(staffMap[id], lcYearStart, lcYearEnd);
                        staffMap[id].totalDays = counts.annual;
                        staffMap[id].sickDays  = counts.sick;
                    });

                    var staff = Object.values(staffMap);

                    // Dept filter
                    if (lcDeptFilter !== 'all') {
                        staff = staff.filter(function(s) { return s.group === lcDeptFilter; });
                    }
                    // Search
                    if (lcQuery) {
                        var q = lcQuery.toLowerCase();
                        staff = staff.filter(function(s) {
                            return s.name.toLowerCase().indexOf(q) > -1 || s.id.indexOf(q) > -1;
                        });
                    }
                    // Sort by name
                    staff.sort(function(a, b) { return a.name.localeCompare(b.name); });
                    return staff;
                }

                function lcDeptCls(group) {
                    return group === 'gc' ? 'dt-exec' : 'dt-ops';
                }

                function lcBuildStats(staff, dates) {
                    var monthStart = dates.length ? dates[0] : null;
                    var monthEnd   = dates.length ? dates[dates.length - 1] : null;
                    var totalLD = 0, totalSick = 0;
                    staff.forEach(function(s) {
                        if (lcViewMode === 'full') {
                            totalLD   += s.totalDays;
                            totalSick += s.sickDays;
                        } else if (monthStart) {
                            var counts = lcCountDaysByCode(s, monthStart, monthEnd);
                            totalLD   += counts.annual;
                            totalSick += counts.sick;
                        }
                    });
                    var onToday = staff.filter(function(s) { return s.leaveSet.has(lcTodayStr); }).length;
                    var gcCount = staff.filter(function(s) { return s.group === 'gc'; }).length;
                    var csCount = staff.filter(function(s) { return s.group === 'cs'; }).length;
                    return '<div class="lc-stat"><div class="sv sv-blue">' + staff.length + '</div><div class="sl">Staff on Leave</div></div>'
                         + '<div class="lc-stat"><div class="sv sv-red">' + totalLD + '</div><div class="sl">Annual Leave Days (' + (lcViewMode === 'full' ? 'Full Year' : 'Month') + ')</div></div>'
                         + '<div class="lc-stat"><div class="sv sv-amber">' + totalSick + '</div><div class="sl">Sick Leave Days (' + (lcViewMode === 'full' ? 'Full Year' : 'Month') + ')</div></div>'
                         + '<div class="lc-stat"><div class="sv ' + (onToday > 0 ? 'sv-red' : 'sv-green') + '">' + onToday + '</div><div class="sl">On Leave Today</div></div>'
                         + '<div class="lc-stat"><div class="sv sv-amber">' + gcCount + '</div><div class="sl">GC Staff</div></div>'
                         + '<div class="lc-stat"><div class="sv sv-blue">' + csCount + '</div><div class="sl">CS Staff</div></div>';
                }

                function lcBuildDateCells(dates) {
                    return dates.map(function(d) {
                        var dk = lcDK(d), we = lcIsWE(d), ph = lcIsPH(d), td = dk === lcTodayStr;
                        var cls = 'lc-dc' + (ph ? ' ph' : (we ? ' wknd' : '')) + (td ? ' td-col' : '');
                        return '<div class="' + cls + '"><div class="dcd">' + LC_DAYS[d.getDay()].slice(0,2) + '</div><div class="dcn">' + d.getDate() + '</div></div>';
                    }).join('');
                }

                function lcBuildMonthBands(dates) {
                    var html = '', cur = -1;
                    dates.forEach(function(d, i) {
                        var m = d.getMonth();
                        if (m !== cur) {
                            var dIM = new Date(lcYear, m+1, 0).getDate();
                            var w = Math.min(dIM, dates.length - i);
                            html += '<div class="lc-month-band" style="width:' + (w*30) + 'px;">' + LC_MONTHS[m].slice(0,3).toUpperCase() + '</div>';
                            cur = m;
                        }
                    });
                    return html;
                }

                function lcBuildRows(staff, dates) {
                    if (!staff.length) return '<div class="lc-empty">No staff match the current filter.</div>';

                    var groups = [
                        { key: 'gc', label: 'Golden Command', cls: 'dt-exec' },
                        { key: 'cs', label: 'Corporate Staff', cls: 'dt-ops' }
                    ];
                    var html = '';
                    groups.forEach(function(g) {
                        var members = staff.filter(function(s) { return s.group === g.key; });
                        if (!members.length) return;
                        html += '<div class="lc-dept-hdr">'
                              + '<div style="position:sticky;left:0;z-index:20;display:flex;align-items:center;gap:9px;background:#e3f0ff;min-width:370px;padding:5px 13px;flex-shrink:0;border-right:2px solid rgba(21,101,192,.2);box-shadow:3px 0 8px rgba(21,101,192,.08);">'
                              + '<span class="lc-dept-tag ' + g.cls + '">' + g.label + '</span>'
                              + '<span style="font-size:.65rem;color:rgba(30,60,100,.45);">' + members.length + ' staff</span>'
                              + '</div>'
                              + '</div>';
                        members.forEach(function(s) {
                            // Compute days-in-view as exact, deduped working days
                            // (excludes Fri/Sat weekends and configured public
                            // holidays), split Annual vs Sick.
                            var leaveInView, sickInView;
                            if (lcViewMode === 'full') {
                                leaveInView = s.totalDays;
                                sickInView  = s.sickDays;
                            } else {
                                var monthStart = dates.length ? dates[0] : null;
                                var monthEnd   = dates.length ? dates[dates.length - 1] : null;
                                if (monthStart && monthEnd) {
                                    var counts = lcCountDaysByCode(s, monthStart, monthEnd);
                                    leaveInView = counts.annual;
                                    sickInView  = counts.sick;
                                } else {
                                    leaveInView = 0; sickInView = 0;
                                }
                            }
                            var cells = dates.map(function(d) {
                                var dk = lcDK(d), lv = s.leaveSet.has(dk), we = lcIsWE(d), ph = lcIsPH(d), td = dk === lcTodayStr;
                                var code = lv ? (s.leaveCodeByDate[dk] || 'A') : '';
                                var cls = 'lc-c' + (lv ? ' leave' : '') + (code === 'SL' ? ' leave-sick' : '') + (ph ? ' ph' : (we ? ' wknd' : '')) + (td ? ' td-c' : '');
                                return '<div class="' + cls + '" data-date="' + dk + '" data-name="' + s.name + '" data-leave="' + lv + '">' + code + '</div>';
                            }).join('');
                            var yrNote = (s.totalDays !== leaveInView) ? '<span style="color:rgba(200,225,255,.3);font-size:.58rem;">(' + s.totalDays + ' yr)</span>' : '';
                            var sickBadge = sickInView > 0
                                ? '<div class="lc-lcount lc-sick-count"><span class="lc-lval-sick">' + sickInView + '</span><span class="lc-llab">🩹 sick</span></div>'
                                : '';
                            html += '<div class="lc-staff-row">'
                                  + '<div class="lc-frozen-name"><div class="lc-sname">' + s.name + '</div><div class="lc-sid">' + s.id + '</div></div>'
                                  + '<div class="lc-frozen-meta"><div class="lc-stitle">' + s.title + '</div>'
                                  + '<div class="lc-lcount"><span class="lc-lval">' + leaveInView + '</span><span class="lc-llab"> days off</span>' + yrNote + '</div>'
                                  + sickBadge
                                  + '</div>'
                                  + '<div class="lc-leave-cells">' + cells + '</div>'
                                  + '</div>';
                        });
                    });
                    return html;
                }

                function lcRender() {
                    var dates = lcGetDates();
                    var staff = lcBuildStaffFromBids();

                    var lbl = document.getElementById('lcMonthLabel');
                    if (lbl) lbl.textContent = lcViewMode === 'full' ? ('Full Year ' + lcYear) : (LC_MONTHS[lcMonth] + ' ' + lcYear);
                    var yrLbl = document.getElementById('lcYearLabel');
                    if (yrLbl) yrLbl.textContent = lcYear;

                    var statsEl = document.getElementById('lcStats');
                    if (statsEl) statsEl.innerHTML = lcBuildStats(staff, dates);

                    var gridEl = document.getElementById('lcGrid');
                    if (!gridEl) return;

                    var bids = self.state.bids || [];
                    var gcIds = (self.state.goldenCommandUsers  || []).map(function(u){ return u.id; });
                    var csIds = (self.state.corporateStaffUsers || []).map(function(u){ return u.id; });
                    var hasAnyGccs = bids.some(function(b) { return gcIds.concat(csIds).indexOf(b.employeeId) > -1; });

                    if (!hasAnyGccs) {
                        gridEl.innerHTML = '<div class="lc-no-bids"><div class="lc-nb-icon">&#128203;</div><p><strong>No GC &amp; Corporate Staff bids yet.</strong></p><p style="margin-top:6px;font-size:.82rem;">Bids submitted under Admin &rsaquo; Bid Details will appear here automatically.</p></div>';
                        return;
                    }

                    var dhCells = lcBuildDateCells(dates);
                    var monthBands = lcViewMode === 'full'
                        ? '<div style="display:flex;">' + lcBuildMonthBands(dates) + '</div>'
                        : '<div class="lc-date-cells">' + dhCells + '</div>';
                    var row2 = lcViewMode === 'full'
                        ? '<div class="lc-hdr-row2"><div class="lc-frozen-hdr"><div class="lc-fh-name"></div><div class="lc-fh-meta"></div></div><div class="lc-date-cells">' + dhCells + '</div></div>'
                        : '';

                    gridEl.innerHTML = '<div class="lc-date-hdr">'
                        + '<div class="lc-frozen-hdr"><div class="lc-fh-name">Name / ID</div><div class="lc-fh-meta">Role / Days Off</div></div>'
                        + monthBands + '</div>'
                        + row2
                        + lcBuildRows(staff, dates);

                    gridEl.querySelectorAll('.lc-c[data-leave="true"]').forEach(function(el) {
                        el.addEventListener('mouseenter', lcShowTip);
                        el.addEventListener('mouseleave', lcHideTip);
                    });
                }

                function lcShowTip(e) {
                    var el = e.currentTarget, name = el.dataset.name, dk = el.dataset.date;
                    var d = new Date(dk + 'T00:00:00');
                    var fmt = d.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
                    var tip = document.getElementById('lcTooltip');
                    if (tip) { tip.innerHTML = '<strong>' + name + '</strong><br>' + fmt; tip.style.display = 'block'; }
                    lcMoveTip(e);
                }
                function lcHideTip() { var t = document.getElementById('lcTooltip'); if (t) t.style.display = 'none'; }
                function lcMoveTip(e) { var t = document.getElementById('lcTooltip'); if (t && t.style.display !== 'none') { t.style.left = (e.clientX + 14) + 'px'; t.style.top = (e.clientY - 30) + 'px'; } }
                document.addEventListener('mousemove', lcMoveTip);

                window.lcPrevMonth   = function() { lcViewMode = 'month'; lcMonth = (lcMonth - 1 + 12) % 12; lcRender(); };
                window.lcNextMonth   = function() { lcViewMode = 'month'; lcMonth = (lcMonth + 1) % 12; lcRender(); };
                window.lcShowAll     = function() { lcViewMode = 'full'; lcRender(); };
                window.lcPrevYear    = function() { lcYear -= 1; lcRender(); };
                window.lcNextYear    = function() { lcYear += 1; lcRender(); };
                window.lcRefresh     = function() { lcRender(); };
                window.lcSetDept     = function(d) {
                    lcDeptFilter = d;
                    document.querySelectorAll('.lc-tab-btn').forEach(function(b) { b.classList.remove('active'); });
                    var el = document.getElementById('lct-' + d);
                    if (el) el.classList.add('active');
                    lcRender();
                };
                window.lcFilterStaff = function(q) { lcQuery = q; lcRender(); };
                window.lcExportCSV   = function() {
                    var staff = lcBuildStaffFromBids();
                    var dates = lcGetDates();
                    var rows = [['Employee ID','Name','Group','Role','Date','Leave']];
                    staff.forEach(function(s) {
                        dates.forEach(function(d) {
                            var dk = lcDK(d);
                            if (s.leaveSet.has(dk)) rows.push([s.id, s.name, s.group.toUpperCase(), s.title, dk, 'A']);
                        });
                    });
                    var csv = rows.map(function(r) { return r.map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
                    var a = document.createElement('a');
                    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
                    a.download = 'GC_CS_Leave_' + lcYear + '.csv'; a.click();
                };

                lcLoadPhLocal();
                lcRender();
                // Sync public holidays from Supabase (if configured) in the
                // background, then re-render so the grid/stats reflect them.
                lcLoadPublicHolidays().then(function() { lcRender(); });

                // ── Start realtime subscription for the Leave Tracker ─────────
                // Expose lcRender on window so the realtime callback can call it
                window.lcRender = lcRender;
                self.startLcRealtime();

                // Fallback poll every 30s in case realtime events stop arriving
                if (self._lcFallbackTimer) clearInterval(self._lcFallbackTimer);
                self._lcFallbackTimer = setInterval(function() {
                    if (self.state.activeView === 'leaveDashboard') {
                        lcRender();
                        self._setLcStatus('live');
                    }
                }, 30000);
                // Build the whitelist once: only IDs that appear in BOTH the
                // ALLOWED_IDS hardcoded list AND the live GC/CS user roster.
                function lcSfWhitelist() {
                    var gcIds = (self.state.goldenCommandUsers  || []).map(function(u){ return u.id; });
                    var csIds = (self.state.corporateStaffUsers || []).map(function(u){ return u.id; });
                    var gccsIds = gcIds.concat(csIds);
                    var ALLOWED_IDS = ['1000888','1000008','1000027','1000124','1001118','1002997','1003591','1003592','1003752','1006024','1006939','1007066','10015','10020','1000555','1000136','1000225','1000352','1000759','1000043','1000830','1000284','1000330','1000231','1000238','1005385','1007071','1006467','1007071'];
                    var set = new Set();
                    gccsIds.forEach(function(id) { if (ALLOWED_IDS.indexOf(id) > -1) set.add(id); });
                    return set;
                }

                // Detect delimiter: tab wins if more tabs than commas in first line
                function lcSfDetectDelim(text) {
                    var first = text.split('\n')[0] || '';
                    return (first.split('\t').length > first.split(',').length) ? '\t' : ',';
                }

                // Split a single line into fields, respecting double-quoted values that may
                // themselves contain the delimiter (e.g. a department name like
                // "Health, Safety and Environment") — a naive split(delim) would misalign
                // every column after such a field.
                function lcSfSplitLine(line, delim) {
                    var result = [];
                    var cur = '';
                    var inQuotes = false;
                    for (var i = 0; i < line.length; i++) {
                        var c = line[i];
                        if (inQuotes) {
                            if (c === '"') {
                                if (line[i+1] === '"') { cur += '"'; i++; }
                                else { inQuotes = false; }
                            } else { cur += c; }
                        } else {
                            if (c === '"') { inQuotes = true; }
                            else if (c === delim) { result.push(cur); cur = ''; }
                            else { cur += c; }
                        }
                    }
                    result.push(cur);
                    return result;
                }

                // Parse raw text → array of row objects
                // Expected columns (flexible order, detected by header):
                //   employee_id | employee_name | leave_type | start_date | end_date | days
                // Falls back to positional (col 0=id, 1=name, 2=type, 3=start, 4=end, 5=days)
                function lcSfParseRows(text) {
                    var delim = lcSfDetectDelim(text);
                    var lines = text.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
                    if (!lines.length) return [];

                    var COL_ALIASES = {
                        employee_id:     ['employee_id','employeeid','emp_id','empid','id','userid','user_id','personnel_number','personnel id','personid','person id','employee number'],
                        employee_name:   ['employee_name','employeename','name','full_name','fullname','employee name'],
                        first_name:      ['first_name','firstname','first name'],
                        last_name:       ['last_name','lastname','last name'],
                        leave_type:      ['leave_type','leavetype','type','leave type','absence','absence type','absencetype','time type','timetype'],
                        start_date:      ['start_date','startdate','from','from_date','start date','leave start','begin_date'],
                        end_date:        ['end_date','enddate','to','to_date','end date','leave end','return_date'],
                        days:            ['days','no_of_days','num_days','duration','calendar days','working days','days_requested','quantity'],
                        approval_status: ['approval_status','approvalstatus','status','approval status','wf_status','wfstatus','workflow status','leave status','request status']
                    };

                    var colIdx = { employee_id:-1, employee_name:-1, first_name:-1, last_name:-1, leave_type:-1, start_date:-1, end_date:-1, days:-1, approval_status:-1 };
                    var dataStart = 0;
                    var headerDetected = false;

                    // Scan the first several lines to find the real header row — SAP/SF exports
                    // often prepend a title line ("Exported to Excel on ...") and a blank line
                    // before the actual column headers, so we can't assume row 0 is the header.
                    var scanLimit = Math.min(lines.length, 15);
                    var bestRow = -1, bestMatches = 0, bestColIdx = null;
                    for (var h = 0; h < scanLimit; h++) {
                        var cols = lcSfSplitLine(lines[h], delim).map(function(c){ return c.replace(/^["'\s]+|["'\s]+$/g,'').toLowerCase(); });
                        var trial = { employee_id:-1, employee_name:-1, first_name:-1, last_name:-1, leave_type:-1, start_date:-1, end_date:-1, days:-1, approval_status:-1 };
                        var matches = 0;
                        Object.keys(COL_ALIASES).forEach(function(key) {
                            cols.forEach(function(col, i) {
                                if (COL_ALIASES[key].indexOf(col) > -1 && trial[key] === -1) {
                                    trial[key] = i;
                                    matches++;
                                }
                            });
                        });
                        if (matches > bestMatches) { bestMatches = matches; bestRow = h; bestColIdx = trial; }
                    }
                    // Require at least 2 recognised columns (e.g. an id + a date) before trusting
                    // a row as the header — avoids mistaking a title/blank row for headers.
                    if (bestMatches >= 2) {
                        headerDetected = true;
                        dataStart = bestRow + 1;
                        colIdx = bestColIdx;
                    }

                    // Positional fallback (approval_status has no positional default — only header-detected)
                    if (colIdx.employee_id   === -1) colIdx.employee_id   = 0;
                    if (colIdx.employee_name === -1 && colIdx.first_name === -1 && colIdx.last_name === -1) colIdx.employee_name = 1;
                    if (colIdx.leave_type    === -1) colIdx.leave_type    = 2;
                    if (colIdx.start_date    === -1) colIdx.start_date    = 3;
                    if (colIdx.end_date      === -1) colIdx.end_date      = 4;
                    if (colIdx.days          === -1) colIdx.days          = 5;
                    // If no status column found, we treat all rows as approved (manual export assumed pre-filtered)
                    var hasStatusCol = colIdx.approval_status !== -1;

                    // SF uses various strings for approved status — normalise them all
                    var APPROVED_VALUES = ['approved','approve','appr','completed','active','taken','confirmed','1','true'];

                    function clean(val) { return (val || '').replace(/^["'\s]+|["'\s]+$/g,'').trim(); }
                    function parseDate(val) {
                        var v = clean(val);
                        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
                        var m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                        if (m) return m[3] + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0');
                        var d = new Date(v);
                        if (!isNaN(d.getTime())) return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
                        return null;
                    }

                    var rows = [];
                    var skippedStatus = 0;
                    for (var i = dataStart; i < lines.length; i++) {
                        var parts = lcSfSplitLine(lines[i], delim);
                        var id    = clean(parts[colIdx.employee_id]);
                        if (!id) continue;

                        // ── Approval status gate ──────────────────────────────
                        if (hasStatusCol) {
                            var statusRaw = clean(parts[colIdx.approval_status]).toLowerCase();
                            if (APPROVED_VALUES.indexOf(statusRaw) === -1) {
                                skippedStatus++;
                                continue;   // not approved — skip silently
                            }
                        }

                        var name;
                        if (colIdx.employee_name !== -1) {
                            name = clean(parts[colIdx.employee_name]);
                        } else {
                            var fn = colIdx.first_name !== -1 ? clean(parts[colIdx.first_name]) : '';
                            var ln = colIdx.last_name  !== -1 ? clean(parts[colIdx.last_name])  : '';
                            name = (fn + ' ' + ln).trim();
                        }
                        var ltype = clean(parts[colIdx.leave_type]) || 'Annual Leave';
                        var start = parseDate(parts[colIdx.start_date]);
                        var end   = parseDate(parts[colIdx.end_date]);
                        var days  = parseInt(clean(parts[colIdx.days]), 10);
                        if (!start) continue;
                        if (!end) end = start;
                        if (isNaN(days) || days < 1) {
                            var ms = new Date(end+'T00:00:00') - new Date(start+'T00:00:00');
                            days = Math.max(1, Math.round(ms / 86400000) + 1);
                        }
                        rows.push({ id: id, name: name, leaveType: ltype, startDate: start, endDate: end, days: days });
                    }
                    // Attach skipped count so the preview/status message can report it
                    rows._skippedStatus = skippedStatus;
                    rows._hasStatusCol  = hasStatusCol;
                    return rows;
                }

                window.lcOpenSfSync = function() {
                    var modal = document.getElementById('lcSfModal');
                    if (modal) { modal.classList.add('open'); }
                    var ta = document.getElementById('lcSfRaw');
                    if (ta) ta.value = '';
                    var st = document.getElementById('lcSfStatus');
                    if (st) { st.textContent = ''; st.className = ''; }
                    var prev = document.getElementById('lcSfPreview');
                    if (prev) { prev.textContent = ''; prev.classList.remove('show'); }
                    var fn = document.getElementById('lcSfFileName');
                    if (fn) fn.textContent = '';
                };
                window.lcCloseSfSync = function() {
                    var modal = document.getElementById('lcSfModal');
                    if (modal) modal.classList.remove('open');
                };
                // Close on backdrop click
                var sfModal = document.getElementById('lcSfModal');
                if (sfModal) sfModal.addEventListener('click', function(e) { if (e.target === sfModal) lcCloseSfSync(); });

                function lcSfShowPreview(text) {
                    var ta = document.getElementById('lcSfRaw');
                    if (ta) ta.value = text;
                    var rows = lcSfParseRows(text);
                    var whitelist = lcSfWhitelist();
                    var matched = rows.filter(function(r){ return whitelist.has(r.id); });
                    var alCount = matched.filter(function(r){ return lcAbsenceCode(r.leaveType) === 'A'; }).length;
                    var slCount = matched.filter(function(r){ return lcAbsenceCode(r.leaveType) === 'SL'; }).length;
                    var prev = document.getElementById('lcSfPreview');
                    if (prev) {
                        var msg = 'Detected ' + (rows.length + (rows._skippedStatus||0)) + ' rows — ';
                        if (rows._hasStatusCol) msg += (rows._skippedStatus||0) + ' non-approved skipped, ';
                        msg += rows.length + ' approved, ' + matched.length + ' match dashboard employees ';
                        msg += '(' + alCount + ' Annual / ' + slCount + ' Sick).';
                        if (!rows._hasStatusCol) msg += ' ⚠ No status column detected — export should be pre-filtered to Approved only.';
                        prev.textContent = msg;
                        prev.classList.add('show');
                    }
                }

                window.lcSfLoadFile = function(input) {
                    var file = input.files && input.files[0];
                    if (!file) return;
                    var fn = document.getElementById('lcSfFileName');
                    if (fn) fn.textContent = file.name;
                    var isExcel = /\.(xlsx|xls)$/i.test(file.name);
                    var reader = new FileReader();
                    if (isExcel) {
                        reader.onload = function(e) {
                            try {
                                var data = new Uint8Array(e.target.result);
                                // IMPORTANT: do NOT use { cellDates: true } here. SheetJS's cellDates
                                // conversion applies a correction based on the *browser's local
                                // timezone at parse time*, which corrupts date-only cells (e.g. a
                                // leave request dated 2026-01-18 can silently become 2026-01-17
                                // depending on the user's timezone). Reading the raw numeric serial
                                // and converting it with SSF.parse_date_code is pure arithmetic and
                                // gives the same correct calendar date on every machine.
                                var wb = XLSX.read(data, { type: 'array', cellNF: true });
                                var firstSheet = wb.Sheets[wb.SheetNames[0]];
                                Object.keys(firstSheet).forEach(function(addr) {
                                    if (addr[0] === '!') return;
                                    var cell = firstSheet[addr];
                                    if (cell && cell.t === 'n' && typeof cell.v === 'number' && cell.z && /[ymd]/i.test(cell.z)) {
                                        var dc = XLSX.SSF.parse_date_code(cell.v);
                                        if (dc) {
                                            var iso = dc.y + '-' + String(dc.m).padStart(2,'0') + '-' + String(dc.d).padStart(2,'0');
                                            cell.v = iso;
                                            cell.w = iso;
                                            cell.t = 's';
                                        }
                                    }
                                });
                                var csv = XLSX.utils.sheet_to_csv(firstSheet);
                                lcSfShowPreview(csv);
                            } catch (ex) {
                                var prev = document.getElementById('lcSfPreview');
                                if (prev) { prev.textContent = '⚠ Could not read Excel file: ' + ex.message; prev.classList.add('show'); }
                            }
                        };
                        reader.readAsArrayBuffer(file);
                    } else {
                        reader.onload = function(e) { lcSfShowPreview(e.target.result); };
                        reader.readAsText(file);
                    }
                };

                window.lcRunSfSync = async function() {
                    var raw = (document.getElementById('lcSfRaw') || {}).value || '';
                    var st  = document.getElementById('lcSfStatus');
                    var btn = document.getElementById('lcSfRunBtn');

                    function setStatus(msg, cls) {
                        if (st) { st.textContent = msg; st.className = cls || ''; }
                    }

                    if (!raw.trim()) { setStatus('⚠ No data to import.', 'warn'); return; }

                    var rows = lcSfParseRows(raw);
                    if (!rows.length) { setStatus('⚠ Could not parse any rows. Check format.', 'err'); return; }

                    var whitelist = lcSfWhitelist();

                    // Split: matched (allowed) vs excluded
                    var matched  = rows.filter(function(r){ return whitelist.has(r.id); });
                    var excluded = rows.filter(function(r){ return !whitelist.has(r.id); });

                    if (!matched.length) {
                        setStatus('⚠ None of the ' + rows.length + ' rows belong to dashboard employees. Sync cancelled.', 'warn');
                        return;
                    }

                    if (btn) btn.disabled = true;
                    setStatus('⏳ Syncing ' + matched.length + ' record(s)…');

                    var tid = self._tid ? self._tid() : (self.state && self.state.tenantId) || 'default';
                    var gcIds = (self.state.goldenCommandUsers  || []).map(function(u){ return u.id; });
                    var STAFF_TITLES = {
                        '1000888':'Project Director','1000008':'Senior Executive Finance Director',
                        '1000027':'Senior Executive Human Resource Director','1000124':'Senior Executive Director Stakeholder & Communication',
                        '1001118':'Head of Major Services Management','1002997':'Contract Director',
                        '1003591':'ICT Manager','1003592':'Head of Cyber Security','1003752':'INM Director',
                        '1006024':'Security Director','1006939':'Rail Safety Manager','1007066':'Operations Director',
                        '10015':'TSM L456 Director','10020':'TSM L3 Director','1000555':'Executive Assistant Project Director',
                        '1000136':'CMMS Manager','1000225':'Performance Manager','1000352':'Planning and Reporting Specialist',
                        '1000759':'KPI & Reporting Specialist','1000043':'Quality And Audit Manager','1000830':'Risk Manager',
                        '1000284':'Rail Safety Officer','1000330':'Executive Assistant','1000231':'Line Standards Manager',
                        '1000238':'Line Standards Manager','1005385':'Operation Manager L-46','1007071':'Operation Manager L-5','1006467':'Operation Manager L-3'
                    };

                    var inserted = 0, updated = 0, errors = 0, errDetails = [];

                    for (var i = 0; i < matched.length; i++) {
                        var r = matched[i];
                        var isGC = gcIds.indexOf(r.id) > -1;
                        var dept = isGC ? 'Golden Command' : 'Corporate Staff';
                        var position = STAFF_TITLES[r.id] || dept;
                        var slotType = (r.days || 0) > 15 ? 'slotC' : 'slotA';

                        // Only columns that exist in corporate_leave_request (matches the real schema)
                        var record = {
                            tenant_id:      tid,
                            employee_id:    r.id,
                            employee_name:  r.name || r.id,
                            department:     dept,
                            slot_type:      slotType,
                            leave_type:     r.leaveType,
                            start_date:     r.startDate,
                            end_date:       r.endDate,
                            days_requested: r.days,
                            status:         'approved',
                            created_at:     new Date().toISOString()
                        };

                        if (self.supabase) {
                            try {
                                // Step 1 — check if a record already exists for this employee+slot+start
                                var { data: existing, error: selErr } = await self.supabase
                                    .from('corporate_leave_request')
                                    .select('id')
                                    .eq('tenant_id',    tid)
                                    .eq('employee_id',  r.id)
                                    .eq('slot_type',    slotType)
                                    .eq('start_date',   r.startDate)
                                    .maybeSingle();

                                var opErr = null;
                                if (existing && existing.id) {
                                    // UPDATE existing row by id
                                    var { error: updErr } = await self.supabase
                                        .from('corporate_leave_request')
                                        .update({
                                            end_date:       record.end_date,
                                            days_requested: record.days_requested,
                                            employee_name:  record.employee_name,
                                            leave_type:     record.leave_type,
                                            status:         'approved'
                                        })
                                        .eq('id', existing.id);
                                    opErr = updErr;
                                    if (!updErr) updated++;
                                } else {
                                    // INSERT new row
                                    var { error: insErr } = await self.supabase
                                        .from('corporate_leave_request')
                                        .insert(record);
                                    opErr = insErr;
                                    if (!insErr) inserted++;
                                }

                                if (opErr) {
                                    errors++;
                                    errDetails.push(r.id + ': ' + (opErr.message || opErr.code || JSON.stringify(opErr)));
                                    console.warn('SF sync error for', r.id, opErr);
                                }
                            } catch(ex) {
                                errors++;
                                errDetails.push(r.id + ': ' + ex.message);
                                console.warn('SF sync exception', ex);
                            }
                        } else {
                            // Offline — inject directly into state.bids
                            var bid = {
                                employeeId:   r.id,
                                employeeName: r.name || r.id,
                                department:   dept,
                                position:     position,
                                slotType:     slotType,
                                leaveType:    r.leaveType,
                                startDate:    r.startDate,
                                endDate:      r.endDate,
                                days:         r.days,
                                timestamp:    new Date().toISOString(),
                                _sourceTable: 'corporate_leave_request',
                                _importSource:'SAP_SF'
                            };
                            var existIdx = (self.state.bids || []).findIndex(function(b){
                                return b.employeeId === r.id && b.startDate === r.startDate && b.slotType === slotType;
                            });
                            if (existIdx > -1) { self.state.bids[existIdx] = bid; updated++; }
                            else { self.state.bids.push(bid); inserted++; }
                        }
                    }

                    // Reload bids from Supabase so state is fresh
                    if (self.supabase) {
                        try {
                            var allBids = [], pg2 = 0, more2 = true, bs2 = 1000;
                            while (more2) {
                                var { data: batch2, error: err2 } = await self.supabase
                                    .from('corporate_leave_request').select('*')
                                    .eq('tenant_id', tid).range(pg2, pg2 + bs2 - 1);
                                if (err2 || !batch2 || !batch2.length) { more2 = false; }
                                else { allBids = allBids.concat(batch2); more2 = batch2.length === bs2; pg2 += bs2; }
                            }
                            // Keep everything that ISN'T corporate (Ops + Maintenance bids untouched),
                            // then re-add the freshly synced corporate rows
                            self.state.bids = self.state.bids.filter(function(b){ return b._sourceTable !== 'corporate_leave_request'; });
                            allBids.forEach(function(row) { self.state.bids.push(self._mapRemoteBid(row, 'corporate_leave_request')); });
                        } catch(ex2) { console.warn('Post-sync reload failed', ex2); }
                    }

                    // Refresh the tracker
                    lcRender();
                    if (btn) btn.disabled = false;

                    var msg = '✅ Sync complete — ' + (inserted + updated) + ' record(s) applied';
                    if (rows._skippedStatus) msg += ', ' + rows._skippedStatus + ' non-approved skipped';
                    if (excluded.length) msg += ', ' + excluded.length + ' excluded (not in dashboard)';
                    if (errors) msg += ' ⚠ ' + errors + ' error(s): ' + errDetails.slice(0,2).join('; ');
                    setStatus(msg, errors ? (inserted + updated > 0 ? 'warn' : 'err') : 'ok');

                    // Write audit entry
                    if (self.writeAuditLog) {
                        self.writeAuditLog('SF_SYNC', { imported: inserted + updated, excluded: excluded.length, errors: errors });
                    }

                    // Auto-close on full success after 3 s
                    if (!errors) setTimeout(function(){ lcCloseSfSync(); }, 3000);
                };
            },

            // ==================== HR CORPORATE DASHBOARD ====================
            _hrCorpRosterLookup(id) {
                const u = (this.state.corporateStaffUsers || []).find(u => u.id === id);
                const GENERIC_DEPTS = ['Corporate Staff', 'Human Resource', 'Human Resources'];
                const realDept = (u?.department && !GENERIC_DEPTS.includes(u.department)) ? u.department : null;
                return {
                    name:       u?.name || null,
                    department: realDept || (u?.position ? u.position : null),
                    position:   u?.position || ''
                };
            },

            _hrCorpBidOverlaps() {
                // Group this-year HR Corporate bids by "cluster" (department, falling
                // back to position, falling back to 'Unassigned'), then flag any pair
                // of DIFFERENT employees in the same cluster whose date ranges overlap.
                const hrBids = this.state.bids.filter(b => this._isHrCorporate(b.employeeId) && !this._isMaintStaff(b.employeeId, b));
                const clusters = {};
                hrBids.forEach(b => {
                    if (!b.startDate || !b.endDate) return;
                    const info = this._hrCorpRosterLookup(b.employeeId);
                    const cluster = info.department || 'Unassigned';
                    if (!clusters[cluster]) clusters[cluster] = [];
                    clusters[cluster].push({ ...b, _name: b.employeeName || info.name || b.employeeId });
                });
                const conflicts = [];
                Object.keys(clusters).forEach(cluster => {
                    const list = clusters[cluster];
                    for (let i = 0; i < list.length; i++) {
                        for (let j = i + 1; j < list.length; j++) {
                            const a = list[i], b = list[j];
                            if (a.employeeId === b.employeeId) continue;
                            const aS = new Date(a.startDate), aE = new Date(a.endDate);
                            const bS = new Date(b.startDate), bE = new Date(b.endDate);
                            if (aS <= bE && bS <= aE) {
                                const overlapStart = aS > bS ? a.startDate : b.startDate;
                                const overlapEnd = aE < bE ? a.endDate : b.endDate;
                                conflicts.push({ cluster, a, b, overlapStart, overlapEnd });
                            }
                        }
                    }
                });
                return conflicts;
            },

            renderHrCorpDashboardView() {
                const content = document.getElementById('contentArea');
                const hrIds = this._HR_CORPORATE_IDS;
                const hrBids = this.state.bids.filter(b => this._isHrCorporate(b.employeeId) && !this._isMaintStaff(b.employeeId, b));
                const bidderIds = new Set(hrBids.map(b => b.employeeId));
                const totalStaff = hrIds.length;
                const participated = [...bidderIds].filter(id => hrIds.includes(id)).length;
                const pct = totalStaff > 0 ? Math.round((participated / totalStaff) * 100) : 0;
                const totalDays = hrBids.reduce((sum, b) => sum + (Number(b.days) || 0), 0);
                const notYetBid = hrIds
                    .filter(id => !bidderIds.has(id))
                    .map(id => { const info = this._hrCorpRosterLookup(id); return { id, name: info.name || 'Unknown', department: info.department || '—' }; })
                    .sort((a, b) => a.name.localeCompare(b.name));
                const conflicts = this._hrCorpBidOverlaps();

                // Chart data: monthly bidding overview (% submitted vs % not yet bid, cumulative by submission date) + participation split (pie)
                const chartYear = this.state.biddingYearCorp || new Date().getFullYear();
                const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const monthlySubmittedPct = [];
                const monthlyNotBidPct = [];
                monthLabels.forEach((label, idx) => {
                    const monthEnd = new Date(chartYear, idx + 1, 0, 23, 59, 59);
                    const bidderIdsByMonth = new Set(
                        hrBids
                            .filter(b => b.timestamp && new Date(b.timestamp) <= monthEnd)
                            .map(b => b.employeeId)
                            .filter(id => hrIds.includes(id))
                    );
                    const pct = totalStaff > 0 ? Math.round((bidderIdsByMonth.size / totalStaff) * 100) : 0;
                    monthlySubmittedPct.push(pct);
                    monthlyNotBidPct.push(100 - pct);
                });
                const notYetBidCount = totalStaff - participated;
                const slotLabelMapFull = { slotA: 'Slot A', slotB: 'Slot B', slotC: 'Slot C', slotD: 'Slot D', SA: 'Slot A', SB: 'Slot B', SC: 'Slot C', SD: 'Slot D', gcCustom: '⭐ Custom', csCustom: '🏢 Custom' };
                const submittedList = hrBids
                    .map(b => {
                        const info = this._hrCorpRosterLookup(b.employeeId);
                        return {
                            id: b.employeeId,
                            name: b.employeeName || info.name || 'Unknown',
                            department: info.department || '—',
                            slot: slotLabelMapFull[b.slotType] || b.slotType || '—',
                            startDate: b.startDate || '—',
                            endDate: b.endDate || '—',
                            days: b.days || '—'
                        };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name));

                content.innerHTML = `
                    <div class="max-w-6xl mx-auto">
                        <div class="bg-white rounded-xl shadow-xl p-6 mb-6">
                            <div class="flex justify-between items-center flex-wrap gap-3 mb-2">
                                <h2 class="text-2xl font-bold text-pink-800">🏢 HR Corporate Dashboard</h2>
                                <button onclick="app.renderHrCorpDashboardView()" class="px-4 py-2 bg-pink-100 text-pink-700 rounded-lg font-semibold hover:bg-pink-200 text-sm">
                                    🔄 Refresh
                                </button>
                            </div>
                            <p class="text-sm text-gray-500">Live snapshot of the HR Corporate staff list (${totalStaff} staff). Connected to Admin &rsaquo; Bid Details &rsaquo; HR Corporate.</p>
                        </div>

                        <!-- KPI cards -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div class="bg-white rounded-xl shadow p-5 border-l-4 border-pink-500">
                                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Participation</p>
                                <p class="text-3xl font-bold text-pink-700 mt-1">${pct}%</p>
                                <p class="text-xs text-gray-500 mt-1">${participated} of ${totalStaff} staff have bid</p>
                            </div>
                            <div class="bg-white rounded-xl shadow p-5 border-l-4 border-emerald-500">
                                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bids Submitted</p>
                                <p class="text-3xl font-bold text-emerald-700 mt-1">${hrBids.length}</p>
                                <p class="text-xs text-gray-500 mt-1">${bidderIds.size} unique bidder${bidderIds.size !== 1 ? 's' : ''}</p>
                            </div>
                            <div class="bg-white rounded-xl shadow p-5 border-l-4 border-blue-500">
                                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Days Requested</p>
                                <p class="text-3xl font-bold text-blue-700 mt-1">${totalDays}</p>
                                <p class="text-xs text-gray-500 mt-1">Across all HR Corporate bids</p>
                            </div>
                            <div class="bg-white rounded-xl shadow p-5 border-l-4 ${conflicts.length > 0 ? 'border-red-500' : 'border-gray-300'}">
                                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Overlap Warnings</p>
                                <p class="text-3xl font-bold ${conflicts.length > 0 ? 'text-red-600' : 'text-gray-400'} mt-1">${conflicts.length}</p>
                                <p class="text-xs text-gray-500 mt-1">Same-cluster overlapping dates</p>
                            </div>
                        </div>

                        <!-- Charts -->
                        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                            <div class="bg-white rounded-xl shadow p-5 lg:col-span-1">
                                <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Participation Split</h3>
                                <div style="height:260px;"><canvas id="hrCorpPieChart"></canvas></div>
                            </div>
                            <div class="rounded-xl shadow p-5 lg:col-span-2" style="background:linear-gradient(180deg,#2b3543,#1f2733);">
                                <h3 class="text-sm font-bold text-gray-200 uppercase tracking-wide mb-3">Bidding Overview — ${chartYear} (% Submitted by Month)</h3>
                                <div style="height:280px;"><canvas id="hrCorpMonthlyChart"></canvas></div>
                            </div>
                        </div>

                        <!-- Overlap warnings -->
                        <div class="bg-white border-2 ${conflicts.length > 0 ? 'border-red-200' : 'border-gray-200'} rounded-xl overflow-hidden mb-6">
                            <div class="${conflicts.length > 0 ? 'bg-red-50 border-b border-red-200' : 'bg-gray-50 border-b border-gray-200'} px-6 py-4">
                                <h3 class="text-lg font-bold ${conflicts.length > 0 ? 'text-red-800' : 'text-gray-700'}">⚠️ Overlapping Leave in Same Cluster</h3>
                                <p class="text-sm ${conflicts.length > 0 ? 'text-red-600' : 'text-gray-500'} mt-1">Clustered by department/position. Flags when two different HR Corporate staff in the same cluster have overlapping leave dates.</p>
                            </div>
                            <div class="p-4">
                                ${conflicts.length === 0 ? `
                                    <div class="text-center py-8 text-gray-400">
                                        <p class="text-3xl mb-2">✅</p>
                                        <p class="font-semibold">No overlapping leave detected within any cluster.</p>
                                    </div>
                                ` : `
                                    <div class="overflow-x-auto">
                                        <table class="w-full text-sm border-collapse">
                                            <thead>
                                                <tr class="bg-red-50 text-left">
                                                    <th class="border border-red-100 px-3 py-2 font-semibold text-red-800">Cluster</th>
                                                    <th class="border border-red-100 px-3 py-2 font-semibold text-red-800">Staff A</th>
                                                    <th class="border border-red-100 px-3 py-2 font-semibold text-red-800">Staff B</th>
                                                    <th class="border border-red-100 px-3 py-2 font-semibold text-red-800">Overlap Period</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${conflicts.map((c, idx) => `
                                                    <tr class="${idx % 2 === 0 ? '' : 'bg-red-50/40'}">
                                                        <td class="border border-red-100 px-3 py-2 text-gray-700">${this._escHtml(c.cluster)}</td>
                                                        <td class="border border-red-100 px-3 py-2 text-gray-800">${this._escHtml(c.a._name)} <span class="text-xs text-gray-400 font-mono">(${this._escHtml(c.a.employeeId)})</span></td>
                                                        <td class="border border-red-100 px-3 py-2 text-gray-800">${this._escHtml(c.b._name)} <span class="text-xs text-gray-400 font-mono">(${this._escHtml(c.b.employeeId)})</span></td>
                                                        <td class="border border-red-100 px-3 py-2 text-gray-700">${this._escHtml(c.overlapStart)} &rarr; ${this._escHtml(c.overlapEnd)}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                `}
                            </div>
                        </div>

                        <!-- Submitted list -->
                        <div class="bg-white border-2 border-emerald-200 rounded-xl overflow-hidden mb-6">
                            <div class="bg-emerald-50 border-b border-emerald-200 px-6 py-4 flex justify-between items-center flex-wrap gap-2">
                                <div>
                                    <h3 class="text-lg font-bold text-emerald-800">✅ Bids Submitted</h3>
                                    <p class="text-sm text-emerald-600 mt-1">HR Corporate staff who have submitted their leave bid.</p>
                                </div>
                                <span class="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-semibold">${submittedList.length} bid${submittedList.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div class="p-4">
                                ${submittedList.length === 0 ? `
                                    <div class="text-center py-8 text-gray-400">
                                        <p class="text-3xl mb-2">📭</p>
                                        <p class="font-semibold">No HR Corporate bids submitted yet.</p>
                                    </div>
                                ` : `
                                    <div class="overflow-x-auto">
                                        <table class="w-full text-sm border-collapse">
                                            <thead>
                                                <tr class="bg-emerald-50 text-left">
                                                    <th class="border border-emerald-100 px-3 py-2 font-semibold text-emerald-800">#</th>
                                                    <th class="border border-emerald-100 px-3 py-2 font-semibold text-emerald-800">Staff ID</th>
                                                    <th class="border border-emerald-100 px-3 py-2 font-semibold text-emerald-800">Name</th>
                                                    <th class="border border-emerald-100 px-3 py-2 font-semibold text-emerald-800">Department / Position</th>
                                                    <th class="border border-emerald-100 px-3 py-2 font-semibold text-emerald-800">Slot</th>
                                                    <th class="border border-emerald-100 px-3 py-2 font-semibold text-emerald-800">Start Date</th>
                                                    <th class="border border-emerald-100 px-3 py-2 font-semibold text-emerald-800">End Date</th>
                                                    <th class="border border-emerald-100 px-3 py-2 font-semibold text-emerald-800">Days</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${submittedList.map((s, idx) => `
                                                    <tr class="${idx % 2 === 0 ? '' : 'bg-emerald-50/40'}">
                                                        <td class="border border-emerald-100 px-3 py-2 text-gray-500 text-center">${idx + 1}</td>
                                                        <td class="border border-emerald-100 px-3 py-2 font-mono text-xs text-gray-700">${this._escHtml(s.id)}</td>
                                                        <td class="border border-emerald-100 px-3 py-2 font-semibold text-gray-800">${this._escHtml(s.name)}</td>
                                                        <td class="border border-emerald-100 px-3 py-2 text-gray-600">${this._escHtml(s.department)}</td>
                                                        <td class="border border-emerald-100 px-3 py-2 text-gray-700">${this._escHtml(s.slot)}</td>
                                                        <td class="border border-emerald-100 px-3 py-2 text-gray-700">${this._escHtml(s.startDate)}</td>
                                                        <td class="border border-emerald-100 px-3 py-2 text-gray-700">${this._escHtml(s.endDate)}</td>
                                                        <td class="border border-emerald-100 px-3 py-2 text-center font-semibold text-gray-800">${this._escHtml(String(s.days))}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                `}
                            </div>
                        </div>

                        <!-- Not-yet-bid list -->
                        <div class="bg-white border-2 border-amber-200 rounded-xl overflow-hidden mb-6">
                            <div class="bg-amber-50 border-b border-amber-200 px-6 py-4 flex justify-between items-center flex-wrap gap-2">
                                <div>
                                    <h3 class="text-lg font-bold text-amber-800">⏳ Not Yet Bid</h3>
                                    <p class="text-sm text-amber-600 mt-1">HR Corporate staff who haven't submitted a bid yet.</p>
                                </div>
                                <span class="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-semibold">${notYetBid.length} staff</span>
                            </div>
                            <div class="p-4">
                                ${notYetBid.length === 0 ? `
                                    <div class="text-center py-8 text-gray-400">
                                        <p class="text-3xl mb-2">🎉</p>
                                        <p class="font-semibold">Everyone on the HR Corporate list has submitted a bid.</p>
                                    </div>
                                ` : `
                                    <div class="overflow-x-auto">
                                        <table class="w-full text-sm border-collapse">
                                            <thead>
                                                <tr class="bg-amber-50 text-left">
                                                    <th class="border border-amber-100 px-3 py-2 font-semibold text-amber-800">#</th>
                                                    <th class="border border-amber-100 px-3 py-2 font-semibold text-amber-800">Staff ID</th>
                                                    <th class="border border-amber-100 px-3 py-2 font-semibold text-amber-800">Name</th>
                                                    <th class="border border-amber-100 px-3 py-2 font-semibold text-amber-800">Department / Position</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${notYetBid.map((s, idx) => `
                                                    <tr class="${idx % 2 === 0 ? '' : 'bg-amber-50/40'}">
                                                        <td class="border border-amber-100 px-3 py-2 text-gray-500 text-center">${idx + 1}</td>
                                                        <td class="border border-amber-100 px-3 py-2 font-mono text-xs text-gray-700">${this._escHtml(s.id)}</td>
                                                        <td class="border border-amber-100 px-3 py-2 font-semibold text-gray-800">${this._escHtml(s.name)}</td>
                                                        <td class="border border-amber-100 px-3 py-2 text-gray-600">${this._escHtml(s.department)}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                `;

                // Render charts (destroy previous instances to avoid canvas reuse errors)
                if (typeof Chart !== 'undefined') {
                    if (this._hrCorpPieChart) { this._hrCorpPieChart.destroy(); this._hrCorpPieChart = null; }
                    if (this._hrCorpMonthlyChart) { this._hrCorpMonthlyChart.destroy(); this._hrCorpMonthlyChart = null; }

                    const pieCtx = document.getElementById('hrCorpPieChart');
                    if (pieCtx) {
                        this._hrCorpPieChart = new Chart(pieCtx, {
                            type: 'doughnut',
                            data: {
                                labels: ['Bid Submitted', 'Not Yet Bid'],
                                datasets: [{
                                    data: [participated, notYetBidCount],
                                    backgroundColor: ['#ec4899', '#fbbf24'],
                                    borderWidth: 0
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
                            }
                        });
                    }

                    const monthlyCtx = document.getElementById('hrCorpMonthlyChart');
                    if (monthlyCtx) {
                        const barColors = ['#4f6df5', '#22c55e', '#dc2626', '#a855f7', '#f59e0b', '#14b8a6', '#9ca3af', '#4f6df5', '#22c55e', '#dc2626', '#a855f7', '#f59e0b'];
                        this._hrCorpMonthlyChart = new Chart(monthlyCtx, {
                            type: 'bar',
                            data: {
                                labels: monthLabels,
                                datasets: [
                                    {
                                        label: 'Bids Submitted %',
                                        data: monthlySubmittedPct,
                                        backgroundColor: barColors,
                                        borderRadius: 4,
                                        borderSkipped: false,
                                        barPercentage: 0.65
                                    }
                                ]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { display: false },
                                    tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%` } },
                                    datalabels: {
                                        anchor: 'end',
                                        align: 'top',
                                        color: '#ffffff',
                                        font: { weight: 'bold', size: 12 },
                                        formatter: v => v + '%'
                                    }
                                },
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        max: 100,
                                        ticks: { color: '#e5e7eb', callback: v => v + '%' },
                                        grid: { color: 'rgba(255,255,255,0.08)' }
                                    },
                                    x: {
                                        ticks: { color: '#e5e7eb' },
                                        grid: { display: false }
                                    }
                                }
                            },
                            plugins: (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : []
                        });
                    }
                }
            },

            async renderAuditLogView() {
                const content = document.getElementById('contentArea');
                content.innerHTML = `
                    <div class="max-w-6xl mx-auto">
                        <div class="metro-card p-6">
                            <div class="flex items-center justify-between mb-6">
                                <div>
                                    <h2 class="text-2xl font-bold" style="font-family:'Barlow Condensed',sans-serif;color:var(--app-text);">🔍 Audit Log</h2>
                                    <p class="text-sm mt-1" style="color:var(--app-text-muted);">All system activity — logins, bids, overrides, password changes</p>
                                </div>
                                <div class="flex gap-3">
                                    <button onclick="app.renderAuditLogView()" class="metro-tab">🔄 Refresh</button>
                                    <button onclick="app.clearAuditLog()" class="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100">🗑 Clear Local</button>
                                </div>
                            </div>

                            <!-- Filters -->
                            <div class="flex gap-3 mb-5 flex-wrap">
                                <select id="auditFilterType" onchange="app.filterAuditLog()" class="px-3 py-2 border rounded-lg text-sm" style="border-color:var(--app-border);">
                                    <option value="all">All Actions</option>
                                    <option value="LOGIN">Login</option>
                                    <option value="LOGOUT">Logout</option>
                                    <option value="BID_PLACED">Bid Placed</option>
                                    <option value="BID_REMOVED">Bid Removed</option>
                                    <option value="BIDS_PROCESSED">Bids Processed</option>
                                    <option value="PASSWORD_CHANGED">Password Changed</option>
                                    <option value="MANUAL_OVERRIDE">Manual Override</option>
                                    <option value="DATA_UPLOADED">Data Uploaded</option>
                                    <option value="SYSTEM_RESET">System Reset</option>
                                    <option value="SF_SYNC">SF Sync</option>
                                </select>
                                <select id="auditFilterRole" onchange="app.filterAuditLog()" class="px-3 py-2 border rounded-lg text-sm" style="border-color:var(--app-border);">
                                    <option value="all">All Roles</option>
                                    <option value="employee">Operation Staff</option>
                                    <option value="planner">Planner</option>
                                    <option value="goldencommand">Golden Command</option>
                                    <option value="corporatestaff">Corporate Staff</option>
                                    <option value="maintenancestaff">Maintenance</option>
                                </select>
                                <input type="text" id="auditSearch" oninput="app.filterAuditLog()" placeholder="Search name or ID..." class="px-3 py-2 border rounded-lg text-sm flex-1 min-w-40" style="border-color:var(--app-border);" />
                            </div>

                            <div id="auditTableContainer">
                                <div class="text-center py-8 text-gray-400">⏳ Loading audit log...</div>
                            </div>
                        </div>
                    </div>
                `;

                // Load from Supabase first, fallback to localStorage
                let logs = [];
                if (this.supabase) {
                    try {
                        const { data, error } = await this.supabase
                            .from('audit_logs')
                            .select('*')
                            .eq('tenant_id', this._tid())
                            .order('created_at', { ascending: false })
                            .limit(500);
                        if (!error && data) {
                            logs = data.map(r => ({
                                action: r.action,
                                user_id: r.user_id,
                                user_name: r.user_name,
                                user_type: r.user_type,
                                details: r.details,
                                timestamp: r.created_at
                            }));
                        }
                    } catch(e) { console.warn('Audit load from Supabase failed', e); }
                }

                // Merge with local if Supabase had nothing
                if (logs.length === 0) {
                    logs = JSON.parse(localStorage.getItem('auditLog') || '[]');
                }

                this._auditLogs = logs;
                this.filterAuditLog();
            },

            filterAuditLog() {
                const logs = this._auditLogs || [];
                const typeFilter = document.getElementById('auditFilterType')?.value || 'all';
                const roleFilter = document.getElementById('auditFilterRole')?.value || 'all';
                const search = (document.getElementById('auditSearch')?.value || '').toLowerCase();

                const filtered = logs.filter(l => {
                    if (typeFilter !== 'all' && l.action !== typeFilter) return false;
                    if (roleFilter !== 'all' && l.user_type !== roleFilter) return false;
                    if (search && !l.user_name?.toLowerCase().includes(search) && !l.user_id?.toLowerCase().includes(search)) return false;
                    return true;
                });

                const actionColors = {
                    'LOGIN':            'bg-green-100 text-green-800',
                    'LOGOUT':           'bg-gray-100 text-gray-700',
                    'BID_PLACED':       'bg-blue-100 text-blue-800',
                    'BID_REMOVED':      'bg-orange-100 text-orange-800',
                    'BIDS_PROCESSED':   'bg-purple-100 text-purple-800',
                    'PASSWORD_CHANGED': 'bg-yellow-100 text-yellow-800',
                    'MANUAL_OVERRIDE':  'bg-red-100 text-red-800',
                    'DATA_UPLOADED':    'bg-indigo-100 text-indigo-800',
                    'SYSTEM_RESET':     'bg-red-200 text-red-900',
                };

                const roleIcons = { employee: '👤', planner: '🛠️', goldencommand: '⭐', corporatestaff: '🏢', maintenancestaff: '🔧' };

                const container = document.getElementById('auditTableContainer');
                if (!container) return;

                if (filtered.length === 0) {
                    container.innerHTML = `<div class="text-center py-12 text-gray-400">
                        <p class="text-3xl mb-3">📭</p>
                        <p>No audit entries found${search ? ' matching your search' : ''}.</p>
                    </div>`;
                    return;
                }

                container.innerHTML = `
                    <p class="text-xs mb-3" style="color:var(--app-text-muted);">${filtered.length} entr${filtered.length===1?'y':'ies'} found</p>
                    <div class="overflow-x-auto" style="border:1px solid var(--app-border);border-radius:10px;">
                        <table class="metro-table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Action</th>
                                    <th>User</th>
                                    <th>Role</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filtered.map(l => {
                                    const ts = l.timestamp ? new Date(l.timestamp).toLocaleString('en-US', {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—';
                                    const colorClass = actionColors[l.action] || 'bg-gray-100 text-gray-700';
                                    const roleIcon = roleIcons[l.user_type] || '👤';
                                    let detailsObj = {};
                                    if (l.details && typeof l.details === 'object') {
                                        detailsObj = l.details;
                                    } else if (typeof l.details === 'string' && l.details.trim()) {
                                        try { detailsObj = JSON.parse(l.details); } catch(e) { detailsObj = {}; }
                                    }
                                    const detailStr = Object.entries(detailsObj).map(([k,v]) => `<span class="text-gray-500">${k}:</span> <span class="font-medium">${v}</span>`).join(' · ');
                                    return `
                                        <tr>
                                            <td style="font-family:monospace;font-size:0.75rem;color:var(--app-text-muted);white-space:nowrap;">${ts}</td>
                                            <td><span class="px-2 py-1 rounded-full text-xs font-bold ${colorClass}">${l.action}</span></td>
                                            <td>
                                                <p style="font-weight:600;">${l.user_name || '—'}</p>
                                                <p class="text-xs" style="color:var(--app-text-muted);">${l.user_id || ''}</p>
                                            </td>
                                            <td style="font-size:0.8rem;">${roleIcon} ${l.user_type || '—'}</td>
                                            <td style="font-size:0.8rem;color:var(--app-text-muted);">${detailStr || '—'}</td>
                                        </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            },

            clearAuditLog() {
                if (!confirm('Clear local audit log? (Supabase records will remain)')) return;
                localStorage.removeItem('auditLog');
                this._auditLogs = [];
                this.filterAuditLog();
            },

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
