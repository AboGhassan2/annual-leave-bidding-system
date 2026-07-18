// ════════════════════════════════════════════════════════════════════
// views-auth.js — login, logout, session, password change, and the
// forgot-password/OTP recovery flow.
//
// Attaches onto the shared `app` object (same pattern as every other
// split file), so it must load AFTER app.js. Every existing call site
// (this.handleLogin(), this.handleLogout(), this.fpSendOtp(), etc.)
// keeps working unchanged.
//
// Covers: setLoginType, renderLoginForm, handleLogin, startIdleWatcher
// (auto-logout on inactivity), _closeAllModals, handleLogout, employee/
// planner password change, and the full forgot-password OTP flow
// (renderForgotPasswordView through fpVerifyOtp).
// ════════════════════════════════════════════════════════════════════

            app.setLoginType = function(type) {
                console.log('Setting login type to:', type);
                this.state.loginType = type;

                // Update tab bar active states
                ['employee','planner','goldencommand','corporatestaff'].forEach(t => {
                    const btn = document.getElementById('tab-' + t);
                    if (!btn) return;
                    btn.className = 'tab-btn';
                    if (t === type) {
                        if (t === 'employee') btn.classList.add('active-emp');
                        else if (t === 'planner') btn.classList.add('active-plan');
                        else if (t === 'goldencommand') btn.classList.add('active-gc');
                        else if (t === 'corporatestaff') btn.classList.add('active-cs');
                    }
                });

                this.renderLoginForm();
            };
            app.renderLoginForm = function() {
                const form = document.getElementById('loginForm');
                if (!form) return;
                
                if (this.state.loginType === 'planner') {
                    form.innerHTML = `
                        <div>
                            <label class="metro-label">Planner Password</label>
                            <input type="password" id="metro-plannerPwd" class="metro-input" placeholder="Enter planner password" />
                        </div>
                    `;
                } else if (this.state.loginType === 'goldencommand') {
                    const gcUsers = this.state.goldenCommandUsers || [];
                    const hasGCUsers = gcUsers.length > 0;
                    form.innerHTML = `
                        <div style="margin-bottom:14px;">
                            ${!hasGCUsers ? `<div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:8px;padding:10px;margin-bottom:12px;font-size:0.75rem;color:rgba(251,191,36,0.8);">No Golden Command users configured. Contact the planner.</div>` : ''}
                            <label class="metro-label">Golden Command ID</label>
                            <input type="text" id="metro-gcLoginId" class="metro-input" placeholder="Enter your GC ID" ${!hasGCUsers ? 'disabled' : ''} />
                        </div>
                        <div>
                            <label class="metro-label">Password</label>
                            <input type="password" id="metro-gcPwd" class="metro-input" placeholder="Enter your password" ${!hasGCUsers ? 'disabled' : ''} />
                        </div>
                    `;
                } else if (this.state.loginType === 'corporatestaff') {
                    const csUsers = this.state.corporateStaffUsers || [];
                    const hasCSUsers = csUsers.length > 0;
                    form.innerHTML = `
                        <div style="margin-bottom:14px;">
                            ${!hasCSUsers ? `<div style="background:rgba(2,136,209,0.08);border:1px solid rgba(2,136,209,0.2);border-radius:8px;padding:10px;margin-bottom:12px;font-size:0.75rem;color:rgba(2,136,209,0.9);">No Corporate Staff users configured. Contact the planner.</div>` : ''}
                            <label class="metro-label">Corporate Staff ID</label>
                            <input type="text" id="csLoginId" class="metro-input" placeholder="Enter your Staff ID" ${!hasCSUsers ? 'disabled' : ''} />
                        </div>
                        <div>
                            <label class="metro-label">Password</label>
                            <input type="password" id="loginPassword" class="metro-input" placeholder="Enter your password" ${!hasCSUsers ? 'disabled' : ''} />
                        </div>
                    `;
                } else {
                    const hasData = this.state.employees.length > 0;
                    form.innerHTML = `
                        <div style="margin-bottom:14px;">
                            ${!hasData ? `<div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:8px;padding:10px;margin-bottom:12px;font-size:0.75rem;color:rgba(251,191,36,0.8);">No employee data loaded. Click "Sync with Database" above.</div>` : ''}
                            <label class="metro-label">Operation Staff ID</label>
                            <input type="text" id="metro-empLoginId" class="metro-input" placeholder="Enter your ID" ${!hasData ? 'disabled' : ''} />
                        </div>
                        <div>
                            <label class="metro-label">Password</label>
                            <input type="password" id="metro-empPwd" class="metro-input" placeholder="Enter your password" ${!hasData ? 'disabled' : ''} />
                        </div>
                    `;
                }
            };
            app.handleLogin = function() {
                if (this.state.loginType === 'planner') {
                    const input = document.getElementById('plannerLoginPwd') || document.getElementById('metro-plannerPwd') || document.getElementById('loginPassword');
                    const password = this._pendingPlannerPw ?? (input ? input.value : '');
                    this._pendingPlannerPw = null;
                    
                    if (password === this.state.plannerPassword) {
                        this.state.currentUser = { name: 'Planner Admin' };
                        this.state.userType = 'planner';
                        this.state.activeView = 'dashboard';
                        
                        document.body.classList.add('logged-in');
                        ['loginBg','loginOrb1','loginOrb2','loginOrb3'].forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });
                        document.getElementById('loginView').style.display = 'none';
                        const uip = document.getElementById('userInfo');
                        uip.style.display = 'flex'; uip.classList.remove('hidden');
                        requestAnimationFrame(() => this._syncHeaderOffset());
                        document.getElementById('plannerNav').classList.remove('hidden');
                        document.getElementById('plannerSidebar').classList.remove('hidden');
                        document.getElementById('headerSaveBtn').classList.remove('hidden');
                        document.getElementById('currentUserName').textContent = 'Planner Admin';
                        document.getElementById('userTypeBadge').textContent = 'Planner';
                        document.getElementById('userTypeBadge').className = 'ml-2 px-2 py-1 text-xs rounded bg-purple-100 text-purple-800';
                        
                        // Clear the modal password field immediately after login
                        const modalPwdEl = document.getElementById('plannerModalPwd');
                        if (modalPwdEl) modalPwdEl.value = '';
                        
                        this.renderView();
                        this.writeAuditLog('LOGIN', { role: 'planner' });
                        this.showToast('Welcome, Planner!', 'success');
                    } else {
                        this.showToast('Incorrect planner password.', 'error');
                    }
                } else if (this.state.loginType === 'goldencommand') {
                    // Use _pendingLogin values if set by card button (avoids DOM ID conflicts)
                    const gcId = (this._pendingLogin?.gcId) ?? (document.getElementById('gcLoginId')?.value?.trim() || '');
                    const password = (this._pendingLogin?.gcPw) ?? (document.getElementById('gcLoginPwd')?.value || document.getElementById('loginPassword')?.value || '');
                    this._pendingLogin = null;
                    
                    if (!gcId || !password) {
                        this.showToast('Please enter both GC ID and password.', 'warn');
                        return;
                    }

                    const gcUsers = this.state.goldenCommandUsers || [];
                    const gcUser = gcUsers.find(u => u.id === gcId);

                    if (!gcUser) {
                        this.showToast('Golden Command ID not found. Please contact the planner.', 'error');
                        return;
                    }

                    const storedPass = gcUser.password || gcUser.id;
                    if (password !== storedPass) {
                        this.showToast('Incorrect password.', 'error');
                        return;
                    }
                    
                    this.state.currentUser = gcUser;
                    this.state.userType = 'goldencommand';
                    this.state.verifiedEmployee = { id: gcUser.id, name: gcUser.name, department: 'Golden Command', seniorityDate: '2000-01-01' };
                    this.state.activeView = 'goldenCommand';
                    
                    // Hide login, show app
                    document.body.classList.add('logged-in');
                    ['loginBg','loginOrb1','loginOrb2','loginOrb3'].forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });
                    document.getElementById('loginView').style.display = 'none';
                    const ui = document.getElementById('userInfo');
                    ui.style.display = 'flex'; ui.classList.remove('hidden');
                    document.getElementById('goldenCommandNav').classList.remove('hidden');
                    document.getElementById('currentUserName').textContent = gcUser.name;
                    document.getElementById('userTypeBadge').textContent = '⭐ Golden Command';
                    document.getElementById('userTypeBadge').className = 'ml-2 px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800';
                    
                    this.renderView();
                    this.writeAuditLog('LOGIN', { name: gcUser.name, id: gcUser.id, role: 'goldencommand' });
                    this.showToast(`Welcome, ${gcUser.name}!`, 'success');
                } else if (this.state.loginType === 'corporatestaff') {
                    const csIdInput = document.getElementById('csLoginId');
                    const passInput = document.getElementById('csLoginPwd') || document.getElementById('loginPassword');
                    const csId = csIdInput ? csIdInput.value.trim() : '';
                    const password = passInput ? passInput.value : '';

                    if (!csId || !password) {
                        this.showToast('Please enter both Staff ID and password.', 'warn');
                        return;
                    }

                    const csUsers = this.state.corporateStaffUsers || [];
                    const csUser = csUsers.find(u => u.id === csId);

                    if (!csUser) {
                        this.showToast('Corporate Staff ID not found. Please contact the planner.', 'error');
                        return;
                    }

                    const storedPass = csUser.password || csUser.id;
                    if (password !== storedPass) {
                        this.showToast('Incorrect password.', 'error');
                        return;
                    }

                    this.state.currentUser = csUser;
                    this.state.userType = 'corporatestaff';
                    this.state.verifiedEmployee = {
                        id: csUser.id,
                        name: csUser.name,
                        department: csUser.department || 'Corporate Staff',
                        position: csUser.position || '',
                        seniorityDate: csUser.seniorityDate || '2000-01-01'
                    };
                    this.state.activeView = 'corporateStaff';

                    // Hide login, show app
                    document.body.classList.add('logged-in');
                    ['loginBg','loginOrb1','loginOrb2','loginOrb3'].forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });
                    document.getElementById('loginView').style.display = 'none';
                    const csUi = document.getElementById('userInfo');
                    csUi.style.display = 'flex'; csUi.classList.remove('hidden');
                    document.getElementById('corporateStaffNav').classList.remove('hidden');
                    document.getElementById('currentUserName').textContent = csUser.name;
                    document.getElementById('userTypeBadge').textContent = '🏢 Corporate Staff';
                    document.getElementById('userTypeBadge').className = 'ml-2 px-2 py-1 text-xs rounded bg-blue-100 text-blue-800';

                    this.renderView();
                    this.writeAuditLog('LOGIN', { name: csUser.name, id: csUser.id, role: 'corporatestaff' });
                    this.showToast(`Welcome, ${csUser.name}!`, 'success');
                } else if (this.state.loginType === 'maintenancestaff') {
                    // Maintenance Staff login — use _pendingLogin if set by card button
                    const id = (this._pendingLogin?.maintId) ?? (document.getElementById('maintLoginId')?.value?.trim() || '');
                    const password = (this._pendingLogin?.maintPw) ?? (document.getElementById('maintLoginPwd')?.value || '');
                    this._pendingLogin = null;

                    if (!id || !password) {
                        this.showToast('Please enter both ID and password.', 'warn');
                        return;
                    }

                    const maintUsers = this.state.maintenanceStaffUsers || [];
                    const maintUser = maintUsers.find(u => String(u.id) === String(id));
                    if (!maintUser) {
                        this.showToast('Maintenance Staff ID not found. Please contact the planner.', 'error');
                        return;
                    }

                    const storedPass = this.state.maintenanceStaffPasswords[String(id)] || String(id);
                    if (password !== storedPass) {
                        this.showToast('Incorrect password.', 'error');
                        return;
                    }

                    this.state.currentUser = maintUser;
                    this.state.userType = 'maintenancestaff';
                    this.state.verifiedEmployee = {
                        id: maintUser.id,
                        name: maintUser.name,
                        department: maintUser.department,
                        position: maintUser.position,
                        seniorityDate: maintUser.seniorityDate || '2020-01-01'
                    };
                    this.state.activeView = 'employee'; // reuse employee view for leave bidding

                    // Hide login, show app
                    document.body.classList.add('logged-in');
                    ['loginBg','loginOrb1','loginOrb2','loginOrb3'].forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });
                    document.getElementById('loginView').style.display = 'none';
                    const maintUi = document.getElementById('userInfo');
                    maintUi.style.display = 'flex'; maintUi.classList.remove('hidden');
                    document.getElementById('employeeNav').classList.remove('hidden');
                    document.getElementById('currentUserName').textContent = maintUser.name;
                    document.getElementById('userTypeBadge').textContent = '🔧 Maintenance Staff';
                    document.getElementById('userTypeBadge').className = 'ml-2 px-2 py-1 text-xs rounded bg-red-100 text-red-800';

                    this.renderView();
                    this.writeAuditLog('LOGIN', { name: maintUser.name, id: maintUser.id, department: maintUser.department, role: 'maintenancestaff' });
                    this.showToast(`Welcome, ${maintUser.name}!`, 'success');
                } else {
                    // Employee login — use _pendingLogin if set by card button, else read from DOM
                    const id = (this._pendingLogin?.empId) ?? (document.getElementById('empLoginId')?.value?.trim() || document.getElementById('loginId')?.value?.trim() || '');
                    const password = (this._pendingLogin?.empPw) ?? (document.getElementById('empLoginPwd')?.value || document.getElementById('loginPassword')?.value || '');
                    this._pendingLogin = null;
                    
                    if (!id || !password) {
                        this.showToast('Please enter both ID and password.', 'warn');
                        return;
                    }

                    const employee = this.state.employees.find(e => e.id === id);
                    if (!employee) {
                        this.showToast('Operation Staff ID not found. Please upload data first.', 'error');
                        return;
                    }
                    
                    const storedPass = this.state.employeePasswords[id] || id;
                    if (password === storedPass) {
                        this.state.currentUser = employee;
                        this.state.userType = 'employee';
                        this.state.verifiedEmployee = employee;
                        this.state.activeView = 'employee';
                        
                        // Hide login, show app
                        document.body.classList.add('logged-in');
                        ['loginBg','loginOrb1','loginOrb2','loginOrb3'].forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });
                        document.getElementById('loginView').style.display = 'none';
                        const ui2 = document.getElementById('userInfo');
                        ui2.style.display = 'flex'; ui2.classList.remove('hidden');
                        document.getElementById('employeeNav').classList.remove('hidden');
                        document.getElementById('currentUserName').textContent = employee.name;
                        document.getElementById('userTypeBadge').textContent = 'Operation Staff';
                        document.getElementById('userTypeBadge').className = 'ml-2 px-2 py-1 text-xs rounded bg-blue-100 text-blue-800';
                        
                        this.renderView();
                        this.writeAuditLog('LOGIN', { name: employee.name, id: employee.id, department: employee.department });
                        this.showToast(`Welcome, ${employee.name}!`, 'success');
                    } else {
                        this.showToast('Incorrect password.', 'error');
                    }
                }
            };
            app.startIdleWatcher = function() {
                const markActive = () => { this._lastActivityTs = Date.now(); };

                // Any of these user interactions count as "active"
                ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
                    .forEach(evt => document.addEventListener(evt, markActive, { passive: true }));

                markActive();

                if (this._idleCheckInterval) clearInterval(this._idleCheckInterval);
                // Check every 15s — frequent enough to feel responsive, cheap enough to ignore
                this._idleCheckInterval = setInterval(() => {
                    if (!this.state.currentUser) return; // nobody logged in, nothing to expire

                    const limitMinutes = this.state.sessionTimeoutMinutes || 15;
                    const idleMs = Date.now() - this._lastActivityTs;

                    if (idleMs >= limitMinutes * 60 * 1000) {
                        this.showToast(`You've been logged out after ${limitMinutes} minutes of inactivity.`, 'error');
                        this.handleLogout();
                    }
                }, 15000);
            };
            app._closeAllModals = function() {
                document.querySelectorAll('[id$="Modal"]').forEach(el => {
                    el.style.display = 'none';
                    el.classList.remove('open');
                });
            };
            app.handleLogout = async function() {
                // Close any modal that might be open BEFORE we tear down the rest of the
                // session — otherwise it stays rendered on top of the login screen.
                this._closeAllModals();

                this.writeAuditLog('LOGOUT', { name: this.state.currentUser?.name, role: this.state.userType });
                this.state.currentUser = null;
                this.state.userType = null;
                this.state.verifiedEmployee = null;
                this.state.activeView = 'login';
                
                document.getElementById('userInfo').style.display = 'none';
                document.getElementById('plannerSidebar').classList.add('hidden');
                document.getElementById('headerSaveBtn').classList.add('hidden');
                document.getElementById('plannerNav').classList.add('hidden');
                document.getElementById('employeeNav').classList.add('hidden');
                document.getElementById('goldenCommandNav').classList.add('hidden');
                document.getElementById('corporateStaffNav').classList.add('hidden');
                document.getElementById('loginView').style.display = 'flex';
                document.getElementById('contentArea').innerHTML = '';

                // Restore dark bg
                document.body.classList.remove('logged-in');
                ['loginBg','loginOrb1','loginOrb2','loginOrb3'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = '';
                });

                // Clear all login card inputs so credentials don't persist
                ['empLoginId','empLoginPwd','csLoginId','csLoginPwd',
                 'plannerLoginPwd','plannerModalPwd','gcLoginId','gcLoginPwd',
                 'maintLoginId','maintLoginPwd',
                 'loginId','loginPassword'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });

                // Clear all running timers to prevent interval leaks
                clearInterval(window._countdownInterval);   window._countdownInterval = null;
                clearInterval(window._gcCountdownInterval); window._gcCountdownInterval = null;
                clearInterval(window._csCountdownTimer);    window._csCountdownTimer = null;
                clearInterval(window._dashInterval);        window._dashInterval = null;
                this._stopAdminLive();

                // Re-sync only user lists from Supabase so dropdowns are fresh on next login
                if (this.supabase) {
                    try {
                        // Reload CS roster
                        const { data: csRows } = await this.supabase
                            .from('corporate_staff_employees').select('*')
                            .eq('tenant_id', this._tid());
                        if (csRows && csRows.length > 0)
                            this.state.corporateStaffUsers = csRows.map(u => ({
                                id: String(u.id), name: u.name || '',
                                department: u.department || 'Corporate Staff', position: u.position || '',
                                role: u.role || '', nationality: u.nationality || '', gender: u.gender || '',
                                seniorityDate: u.seniority_date || '2000-01-01',
                                totalLeaveDays: u.total_leave_days ?? 30, usedLeaveDays: u.used_leave_days ?? 0,
                                password: u.password || String(u.id), email: u.email || ''
                            }));

                        // Reload sub-group users
                        for (const sg of [
                            { table:'l456inm_users', key:'l456InmUsers' },
                            { table:'l3inm_users',   key:'l3InmUsers'   },
                            { table:'l3tsm_users',   key:'l3TsmUsers'   },
                            { table:'hseq_users',    key:'hseqUsers'    },
                        ]) {
                            const { data: rows } = await this.supabase
                                .from(sg.table).select('id,name,password,email').eq('tenant_id', this._tid());
                            if (rows && rows.length > 0)
                                this.state[sg.key] = rows.map(u => ({ id: u.id, name: u.name, password: u.password || u.id, email: u.email || '' }));
                        }                    } catch(e) { /* silent — use whatever is already in state */ }
                }

                this.renderLoginForm();
            };
            app.renderChangePasswordView = function() {
                const content = document.getElementById('contentArea');
                const backView = this.state.userType === 'goldencommand' ? 'goldenCommand' : this.state.userType === 'corporatestaff' ? 'corporateStaff' : 'employee';
                content.innerHTML = `
                    <div class="max-w-md mx-auto">
                        <div class="bg-white rounded-xl shadow-xl p-8">
                            <h2 class="text-2xl font-bold mb-2">🔑 Change Password</h2>
                            <p class="text-gray-500 text-sm mb-6">Update your login password below.</p>
                            <div id="cpMsg"></div>
                            <div class="space-y-4">
                                <div>
                                    <label class="block font-semibold mb-2">Current Password:</label>
                                    <input type="password" id="cpCurrent" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" placeholder="Enter current password" />
                                </div>
                                <div>
                                    <label class="block font-semibold mb-2">New Password:</label>
                                    <input type="password" id="cpNew" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" placeholder="Enter new password (min 4 chars)" />
                                </div>
                                <div>
                                    <label class="block font-semibold mb-2">Confirm New Password:</label>
                                    <input type="password" id="cpConfirm" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" placeholder="Repeat new password" />
                                </div>
                            </div>
                            <div class="flex gap-3 mt-6">
                                <button onclick="app.doChangePassword()" class="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold">
                                    💾 Save Password
                                </button>
                                <button onclick="app.setActiveView('${backView}')" class="flex-1 px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-semibold">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            };
            app.doChangePassword = async function() {
                const current = document.getElementById('cpCurrent').value;
                const newPass = document.getElementById('cpNew').value;
                const confirm = document.getElementById('cpConfirm').value;
                const msg = document.getElementById('cpMsg');

                const showMsg = (text, color) => {
                    msg.innerHTML = `<div class="mb-4 p-3 rounded-lg border ${color}">${text}</div>`;
                };

                const user = this.state.currentUser;
                const userId = user.id;
                const userType = this.state.userType;

                // Verify current password
                let storedPass;
                if (userType === 'goldencommand') {
                    const gcUser = (this.state.goldenCommandUsers || []).find(u => u.id === userId);
                    storedPass = gcUser ? (gcUser.password || gcUser.id) : userId;
                } else if (userType === 'corporatestaff') {
                    const csUser = (this.state.corporateStaffUsers || []).find(u => u.id === userId);
                    storedPass = csUser ? (csUser.password || csUser.id) : userId;
                } else {
                    storedPass = this.state.employeePasswords[userId] || userId;
                }

                if (current !== storedPass) {
                    showMsg('❌ Current password is incorrect.', 'bg-red-50 border-red-300 text-red-700');
                    return;
                }
                if (newPass.length < 4) {
                    showMsg('⚠️ New password must be at least 4 characters.', 'bg-yellow-50 border-yellow-300 text-yellow-700');
                    return;
                }
                if (newPass !== confirm) {
                    showMsg('❌ New passwords do not match.', 'bg-red-50 border-red-300 text-red-700');
                    return;
                }

                try {
                    if (userType === 'goldencommand') {
                        // Update in Supabase golden_command_users table
                        if (this.supabase) {
                            const { error } = await this.supabase
                                .from('golden_command_users')
                                .update({ password: newPass })
                                .eq('id', userId);
                            if (error) throw error;
                        }
                        // Update local state
                        const gcUser = (this.state.goldenCommandUsers || []).find(u => u.id === userId);
                        if (gcUser) gcUser.password = newPass;
                    } else if (userType === 'corporatestaff') {
                        // Update in Supabase corporate_staff_employees table
                        if (this.supabase) {
                            const { error } = await this.supabase
                                .from('corporate_staff_employees')
                                .update({ password: newPass })
                                .eq('id', userId);
                            if (error) throw error;
                        }
                        // Update local state
                        const csUser = (this.state.corporateStaffUsers || []).find(u => u.id === userId);
                        if (csUser) csUser.password = newPass;
                    } else {
                        // Employee: update local state + employeePasswords
                        this.state.employeePasswords[userId] = newPass;
                        // Also update the employees table password column if it exists
                        if (this.supabase) {
                            const { error } = await this.supabase
                                .from('employees')
                                .update({ password: newPass })
                                .eq('id', userId);
                            // ignore error if column doesn't exist
                        }
                    }

                    this.saveState();
                    showMsg('✅ Password changed successfully!', 'bg-green-50 border-green-300 text-green-700');
                    this.writeAuditLog('PASSWORD_CHANGED', { user_type: userType });
                    // Clear fields
                    document.getElementById('cpCurrent').value = '';
                    document.getElementById('cpNew').value = '';
                    document.getElementById('cpConfirm').value = '';
                } catch (err) {
                    console.error('Password change error:', err);
                    showMsg('❌ Failed to save password. Changes saved locally.', 'bg-red-50 border-red-300 text-red-700');
                    // Still update locally
                    if (userType === 'goldencommand') {
                        const gcUser = (this.state.goldenCommandUsers || []).find(u => u.id === userId);
                        if (gcUser) gcUser.password = newPass;
                    } else if (userType === 'corporatestaff') {
                        const csUser = (this.state.corporateStaffUsers || []).find(u => u.id === userId);
                        if (csUser) csUser.password = newPass;
                    } else {
                        this.state.employeePasswords[userId] = newPass;
                    }
                    this.saveState();
                }
            };
            app.renderChangePlannerPasswordView = function() {
                const content = document.getElementById('contentArea');
                content.innerHTML = `
                    <div class="max-w-md mx-auto">
                        <div class="bg-white rounded-xl shadow-xl p-8">
                            <h2 class="text-2xl font-bold mb-2">🔐 Change Planner Password</h2>
                            <p class="text-gray-500 text-sm mb-6">Update the planner login password. This is saved to the database.</p>
                            <div id="ppMsg"></div>
                            <div class="space-y-4">
                                <div>
                                    <label class="block font-semibold mb-2">Current Password:</label>
                                    <input type="password" id="ppCurrent" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" placeholder="Enter current planner password" />
                                </div>
                                <div>
                                    <label class="block font-semibold mb-2">New Password:</label>
                                    <input type="password" id="ppNew" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" placeholder="Enter new password (min 4 chars)" />
                                </div>
                                <div>
                                    <label class="block font-semibold mb-2">Confirm New Password:</label>
                                    <input type="password" id="ppConfirm" class="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" placeholder="Repeat new password" />
                                </div>
                            </div>
                            <div class="flex gap-3 mt-6">
                                <button onclick="app.doChangePlannerPassword()" class="flex-1 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-semibold">
                                    💾 Save Password
                                </button>
                                <button onclick="app.setActiveView('admin')" class="flex-1 px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-semibold">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            };
            app.doChangePlannerPassword = async function() {
                const current = document.getElementById('ppCurrent').value;
                const newPass = document.getElementById('ppNew').value;
                const confirm = document.getElementById('ppConfirm').value;
                const msg = document.getElementById('ppMsg');

                const showMsg = (text, color) => {
                    msg.innerHTML = `<div class="mb-4 p-3 rounded-lg border ${color}">${text}</div>`;
                };

                if (current !== this.state.plannerPassword) {
                    showMsg('❌ Current password is incorrect.', 'bg-red-50 border-red-300 text-red-700');
                    return;
                }
                if (newPass.length < 4) {
                    showMsg('⚠️ New password must be at least 4 characters.', 'bg-yellow-50 border-yellow-300 text-yellow-700');
                    return;
                }
                if (newPass !== confirm) {
                    showMsg('❌ New passwords do not match.', 'bg-red-50 border-red-300 text-red-700');
                    return;
                }

                this.state.plannerPassword = newPass;

                try {
                    await this.saveConfigToSupabase();
                    showMsg('✅ Planner password updated and saved to database!', 'bg-green-50 border-green-300 text-green-700');
                } catch (err) {
                    console.error('Planner password change error:', err);
                    showMsg('✅ Password updated locally. ⚠️ Database save failed.', 'bg-yellow-50 border-yellow-300 text-yellow-700');
                }

                document.getElementById('ppCurrent').value = '';
                document.getElementById('ppNew').value = '';
                document.getElementById('ppConfirm').value = '';
            };
            app.renderForgotPasswordView = function() {
                // Create full-screen modal overlay appended to body
                let overlay = document.getElementById('fpOverlay');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'fpOverlay';
                    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(8,28,21,0.82);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
                    document.body.appendChild(overlay);
                }
                overlay.style.display = 'flex';
                overlay.innerHTML = `
                  <div style="background:#fff;border-radius:24px;padding:36px 32px;max-width:420px;width:95%;box-shadow:0 32px 80px rgba(0,0,0,0.5);position:relative;color:#111827;font-family:Barlow,sans-serif;">
                    <button onclick="app.closeForgotPasswordView()" style="position:absolute;top:16px;right:18px;background:rgba(0,0,0,0.06);border:none;width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;color:#6b7280;line-height:32px;text-align:center;padding:0;">✕</button>
                    <div style="text-align:center;margin-bottom:24px;">
                      <div style="font-size:2.8rem;margin-bottom:8px;">🔐</div>
                      <h2 style="font-size:1.4rem;font-weight:700;color:#111827;margin-bottom:4px;">Password Recovery</h2>
                      <p style="font-size:0.83rem;color:#6b7280;margin:0;">An OTP will be sent to your registered email.</p>
                    </div>
                    <div id="fpMsg"></div>
                    <!-- Step 1 -->
                    <div id="fpStep1">
                      <div style="margin-bottom:16px;">
                        <label style="display:block;font-size:0.75rem;font-weight:700;color:#374151;margin-bottom:7px;text-transform:uppercase;letter-spacing:.07em;">Your Registered Email</label>
                        <input type="email" id="fpEmailInput" placeholder="name@flow-metro.com"
                          style="width:100%;padding:13px 14px;border:1.5px solid #d1d5db;border-radius:12px;font-size:0.95rem;color:#111827;background:#f9fafb;outline:none;box-sizing:border-box;"
                          onfocus="this.style.borderColor='#2d6a4f';this.style.boxShadow='0 0 0 3px rgba(45,106,79,0.12)'"
                          onblur="this.style.borderColor='#d1d5db';this.style.boxShadow='none'"
                          onkeydown="if(event.key==='Enter') app.fpSendOtp()" />
                        <p style="font-size:0.75rem;color:#9ca3af;margin-top:6px;">Enter the email address registered to your account.</p>
                      </div>
                      <button id="fpSendBtn" onclick="app.fpSendOtp()"
                        style="width:100%;padding:13px;background:linear-gradient(135deg,#1b4332,#2d6a4f);color:#fff;font-weight:700;font-size:0.97rem;border:none;border-radius:12px;cursor:pointer;letter-spacing:.03em;">
                        📧 Send OTP to Email
                      </button>
                      <p style="text-align:center;font-size:0.75rem;color:#9ca3af;margin-top:12px;margin-bottom:0;">OTP expires in 10 minutes · Check spam if not received</p>
                    </div>
                    <!-- Step 2 -->
                    <div id="fpStep2" style="display:none;">
                      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:13px;margin-bottom:18px;text-align:center;">
                        <p id="fpOtpSentMsg" style="font-size:0.85rem;color:#1e40af;line-height:1.5;margin:0;"></p>
                      </div>
                      <div style="margin-bottom:14px;">
                        <label style="display:block;font-size:0.75rem;font-weight:700;color:#374151;margin-bottom:7px;text-transform:uppercase;letter-spacing:.07em;">6-Digit OTP Code</label>
                        <input type="text" id="fpOtpInput" maxlength="6" inputmode="numeric" placeholder="• • • • • •"
                          style="width:100%;padding:15px;border:2px solid #3b82f6;border-radius:12px;font-size:1.6rem;text-align:center;letter-spacing:.3em;color:#111827;background:#f9fafb;outline:none;box-sizing:border-box;" />
                      </div>
                      <div style="margin-bottom:14px;">
                        <label id="fpNewPwdLabel" style="display:block;font-size:0.75rem;font-weight:700;color:#374151;margin-bottom:7px;text-transform:uppercase;letter-spacing:.07em;">New Password</label>
                        <input type="password" id="fpNewPwd" placeholder="Enter new password"
                          style="width:100%;padding:11px 14px;border:1.5px solid #d1d5db;border-radius:12px;font-size:0.92rem;color:#111827;background:#f9fafb;outline:none;box-sizing:border-box;"
                          onfocus="this.style.borderColor='#2d6a4f'" onblur="this.style.borderColor='#d1d5db'" />
                      </div>
                      <div style="margin-bottom:20px;">
                        <label style="display:block;font-size:0.75rem;font-weight:700;color:#374151;margin-bottom:7px;text-transform:uppercase;letter-spacing:.07em;">Confirm New Password</label>
                        <input type="password" id="fpConfirmPwd" placeholder="Confirm new password"
                          style="width:100%;padding:11px 14px;border:1.5px solid #d1d5db;border-radius:12px;font-size:0.92rem;color:#111827;background:#f9fafb;outline:none;box-sizing:border-box;"
                          onfocus="this.style.borderColor='#2d6a4f'" onblur="this.style.borderColor='#d1d5db'" />
                      </div>
                      <button onclick="app.fpVerifyOtp()"
                        style="width:100%;padding:13px;background:linear-gradient(135deg,#1b4332,#2d6a4f);color:#fff;font-weight:700;font-size:0.97rem;border:none;border-radius:12px;cursor:pointer;margin-bottom:10px;">
                        ✅ Verify & Reset Password
                      </button>
                      <button onclick="app.fpGoBack()"
                        style="width:100%;padding:11px;background:#f3f4f6;color:#374151;font-weight:600;font-size:0.88rem;border:1.5px solid #e5e7eb;border-radius:12px;cursor:pointer;">
                        ← Try a Different Account
                      </button>
                    </div>
                  </div>`;
                // focus the email input automatically
                setTimeout(() => document.getElementById('fpEmailInput')?.focus(), 80);
            };
            app.closeForgotPasswordView = function() {
                const overlay = document.getElementById('fpOverlay');
                if (overlay) overlay.style.display = 'none';
            };
            app.fpGoBack = function() {
                document.getElementById('fpStep1').style.display = 'block';
                document.getElementById('fpStep2').style.display = 'none';
                document.getElementById('fpMsg').innerHTML = '';
            };
            app._fpFindByEmail = function(email) {
                // Search ALL user pools by email — returns { email, name, role, id }
                const e = email.toLowerCase().trim();
                // Planner
                if (this.state.plannerEmail && this.state.plannerEmail.toLowerCase() === e)
                    return { email: this.state.plannerEmail, name: 'Planner', role: 'planner', id: 'planner' };
                // All staff pools
                const pools = [
                    { list: this.state.employees,           role: 'employee'       },
                    { list: this.state.goldenCommandUsers,  role: 'goldencommand'  },
                    { list: this.state.corporateStaffUsers, role: 'corporatestaff' },
                    { list: this.state.l456InmUsers,        role: 'l456inm'        },
                    { list: this.state.l3InmUsers,          role: 'l3inm'          },
                    { list: this.state.l3TsmUsers,          role: 'l3tsm'          },
                    { list: this.state.hseqUsers,           role: 'hseq'           },
                ];
                for (const pool of pools) {
                    const u = (pool.list || []).find(u => u.email && u.email.toLowerCase() === e);
                    if (u) return { email: u.email, name: u.name, role: pool.role, id: u.id };
                }
                return null;
            };
            app.fpSendOtp = async function() {
                const emailInput = (document.getElementById('fpEmailInput')?.value || '').trim();
                const btn        = document.getElementById('fpSendBtn');
                const msg        = document.getElementById('fpMsg');
                const showMsg    = (text, type) => {
                    const s = { error:'background:#fef2f2;border:1px solid #fecaca;color:#991b1b', warn:'background:#fffbeb;border:1px solid #fcd34d;color:#92400e', info:'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af' };
                    msg.innerHTML = `<div style="padding:11px 14px;border-radius:10px;font-size:0.83rem;margin-bottom:14px;${s[type]||s.info}">${text}</div>`;
                };

                if (!emailInput) { showMsg('⚠️ Please enter your email address.', 'warn'); return; }
                if (!/^[^@]+@[^@]+\.[^@]+$/.test(emailInput)) { showMsg('⚠️ Please enter a valid email address.', 'warn'); return; }

                const target = this._fpFindByEmail(emailInput);
                if (!target) { showMsg('❌ No account found with that email. Check spelling or contact the planner.', 'error'); return; }

                // Always use the typed email directly — state may have stale/empty email field
                if (!target.email) target.email = emailInput;

                // role and identifier come from the found record
                const role       = target.role;
                const identifier = target.id === 'planner' ? '' : target.id;

                // Retrieve EmailJS keys saved by admin
                const svcId  = localStorage.getItem('ejs_service')  || this.state.ejsServiceId  || '';
                const tplId  = localStorage.getItem('ejs_template') || this.state.ejsTemplateId || '';
                const pubKey = localStorage.getItem('ejs_pubkey')   || this.state.ejsPublicKey  || '';

                // Generate OTP
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

                // Keep in-memory as fallback
                this._fpOtp        = otp;
                this._fpOtpExpiry  = Date.now() + 10 * 60 * 1000;
                this._fpRole       = role;
                this._fpIdentifier = identifier;
                this._fpTokenId    = null;

                if (btn) { btn.disabled = true; btn.textContent = '⏳ Sending…'; btn.style.opacity = '.7'; }
                showMsg('⏳ Sending OTP to your registered email…', 'info');

                let sent = false;
                let sendError = '';

                // Debug: log what keys we have
                console.log('EmailJS keys — svcId:', svcId, '| tplId:', tplId, '| pubKey:', pubKey ? pubKey.substring(0,6)+'…' : '(empty)');
                console.log('Target email:', target.email, '| name:', target.name);

                const toEmail = emailInput || target.email || '';
                const toName  = target.name || toEmail;
                const expiryTime = new Date(Date.now() + 10 * 60 * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const result = await this.sendEmailWithFallback({
                    email:        toEmail,
                    to_email:     toEmail,
                    to_name:      toName,
                    otp_code:     otp,
                    passcode:     otp,
                    time:         expiryTime,
                    company_name: 'Resource Planning Team at Flow',
                    Annual_Leave_System_RP: 'Resource Planning Team at Flow',
                    website_link: window.location.href,
                    employee_id:  identifier || 'planner',
                    year:         this.state.biddingYear,
                    subject:      'Your Annual Leave System OTP code'
                });
                sent = result.sent;
                sendError = result.error;
                if (sent) console.log('OTP sent via', result.method);

                if (btn) { btn.disabled = false; btn.innerHTML = '📧 Send OTP to Email'; btn.style.opacity = '1'; }

                if (!sent) {
                    showMsg('❌ Could not send OTP. ' + (sendError ? '<br><small style="opacity:.8">' + sendError + '</small>' : 'Ask the planner to configure Email Settings in the Admin Panel first.'), 'error');
                    return;
                }

                // Persist token to Supabase so OTP survives page refresh
                if (this.supabase) {
                    try {
                        // Delete any existing tokens for this user first
                        await this.supabase.from('password_reset_tokens')
                            .delete()
                            .eq('tenant_id', this._tid())
                            .eq('identifier', identifier || 'planner')
                            .eq('role', role);

                        const { data: tokenRow } = await this.supabase
                            .from('password_reset_tokens')
                            .insert({
                                tenant_id:  this._tid(),
                                identifier: identifier || 'planner',
                                role:       role,
                                token:      otp,
                                expires_at: otpExpiry,
                                email:      target.email
                            })
                            .select('id')
                            .single();
                        if (tokenRow) this._fpTokenId = tokenRow.id;
                    } catch (e) { console.warn('Could not persist OTP token to Supabase:', e); }
                }

                msg.innerHTML = '';
                document.getElementById('fpStep1').style.display = 'none';
                document.getElementById('fpStep2').style.display = 'block';
                const masked = target.email.replace(/(.{2})(.+?)(@.+)$/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 5)) + c);
                document.getElementById('fpOtpSentMsg').innerHTML = `✅ OTP sent to <strong>${masked}</strong>.<br>Check your inbox and spam. Expires in 10 minutes.`;
                document.getElementById('fpNewPwdLabel').textContent =
                    (role === 'employee' || role === 'l456inm' || role === 'l3inm' || role === 'l3tsm' || role === 'hseq')
                    ? 'New Password (leave blank to reset to Operation Staff ID)' : 'New Password';
            };
            app.fpVerifyOtp = async function() {
                const otp     = (document.getElementById('fpOtpInput')?.value   || '').trim();
                const newPwd  = (document.getElementById('fpNewPwd')?.value     || '').trim();
                const confirm = (document.getElementById('fpConfirmPwd')?.value || '').trim();
                const msg     = document.getElementById('fpMsg');
                const showMsg = (text, type) => {
                    const s = { error:'background:#fef2f2;border:1px solid #fecaca;color:#991b1b', warn:'background:#fffbeb;border:1px solid #fcd34d;color:#92400e', ok:'background:#f0fdf4;border:1px solid #86efac;color:#166534' };
                    msg.innerHTML = `<div style="padding:11px 14px;border-radius:10px;font-size:0.83rem;margin-bottom:14px;${s[type]||s.ok}">${text}</div>`;
                };

                if (!otp) { showMsg('⚠️ Please enter the OTP code.', 'warn'); return; }
                if (newPwd && newPwd !== confirm) { showMsg('❌ Passwords do not match.', 'error'); return; }
                if (newPwd && newPwd.length < 4)  { showMsg('⚠️ Password must be at least 4 characters.', 'warn'); return; }

                let role = this._fpRole;
                let id   = this._fpIdentifier;

                // Validate OTP — prefer Supabase (survives refresh), fall back to in-memory
                if (this.supabase && (this._fpTokenId || role)) {
                    try {
                        const { data: tokenRow, error: tokenErr } = await this.supabase
                            .from('password_reset_tokens')
                            .select('*')
                            .eq('tenant_id', this._tid())
                            .eq('identifier', id || 'planner')
                            .eq('role', role)
                            .eq('token', otp)
                            .single();

                        if (tokenErr || !tokenRow) {
                            showMsg('❌ Incorrect OTP. Please check and try again.', 'error'); return;
                        }
                        if (new Date(tokenRow.expires_at) < new Date()) {
                            // Clean up expired token
                            await this.supabase.from('password_reset_tokens').delete().eq('id', tokenRow.id);
                            showMsg('❌ OTP has expired. Please request a new one.', 'error'); return;
                        }
                        // Valid — recover role/id from DB in case page was refreshed
                        role = tokenRow.role;
                        id   = tokenRow.identifier === 'planner' ? null : tokenRow.identifier;
                        this._fpRole       = role;
                        this._fpIdentifier = id;
                        this._fpTokenId    = tokenRow.id;
                    } catch (e) {
                        // Supabase unreachable — fall back to in-memory check
                        console.warn('Supabase token check failed, using in-memory:', e);
                        if (!this._fpOtp)                   { showMsg('❌ Session expired. Please start again.', 'error'); return; }
                        if (Date.now() > this._fpOtpExpiry) { showMsg('❌ OTP has expired. Please request a new one.', 'error'); return; }
                        if (otp !== this._fpOtp)            { showMsg('❌ Incorrect OTP. Please check and try again.', 'error'); return; }
                    }
                } else {
                    // No Supabase — pure in-memory fallback
                    if (!this._fpOtp)                   { showMsg('❌ Session expired. Please start again.', 'error'); return; }
                    if (Date.now() > this._fpOtpExpiry) { showMsg('❌ OTP has expired. Please request a new one.', 'error'); return; }
                    if (otp !== this._fpOtp)            { showMsg('❌ Incorrect OTP. Please check and try again.', 'error'); return; }
                }

                if (role === 'employee') {
                    const finalPwd = newPwd || id;
                    this.state.employeePasswords[id] = finalPwd;
                    try { if (this.supabase) await this.supabase.from('employees').update({ password: finalPwd }).eq('id', id); }
                    catch (e) { console.warn('DB update failed:', e); }
                } else if (role === 'planner') {
                    this.state.plannerPassword = newPwd;
                    try { await this.saveConfigToSupabase(); } catch (e) { console.warn(e); }
                } else if (role === 'goldencommand') {
                    const u = (this.state.goldenCommandUsers || []).find(u => u.id === id);
                    if (u) u.password = newPwd;
                    try { if (this.supabase) await this.supabase.from('golden_command_users').update({ password: newPwd }).eq('id', id); }
                    catch (e) { console.warn('DB update failed:', e); }
                } else if (role === 'corporatestaff') {
                    const u = (this.state.corporateStaffUsers || []).find(u => u.id === id);
                    if (u) u.password = newPwd;
                    try { if (this.supabase) await this.supabase.from('corporate_staff_employees').update({ password: newPwd }).eq('id', id); }
                    catch (e) { console.warn('DB update failed:', e); }
                }

                this.saveState();
                // Delete token from Supabase and clear in-memory session
                if (this.supabase && this._fpTokenId) {
                    try { await this.supabase.from('password_reset_tokens').delete().eq('id', this._fpTokenId); }
                    catch (e) { console.warn('Could not delete reset token:', e); }
                }
                this._fpOtp = null; this._fpOtpExpiry = null; this._fpRole = null; this._fpIdentifier = null; this._fpTokenId = null;

                showMsg('✅ Password reset successfully! You can now log in with your new password.', 'ok');
                setTimeout(() => this.closeForgotPasswordView(), 3000);
            };
