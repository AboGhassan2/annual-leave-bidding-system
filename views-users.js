// ════════════════════════════════════════════════════════════════════
// views-users.js — add/remove staff for GC, CS, and the L456/L3 INM/
// TSM sub-groups, plus the generic Manage Users screen.
//
// Attaches onto the shared `app` object, must load AFTER app.js.
//
// Covers: addGCUser/removeGCUser, addCSUser/removeCSUser, the L456/L3
// INM/TSM add+remove pairs, renderManageUsersView, and the generic
// _muAddUser/_muRemoveUser used by the sub-group management UI.
// ════════════════════════════════════════════════════════════════════

            app.addGCUser = function() {
                const id = document.getElementById('newGCId')?.value?.trim();
                const name = document.getElementById('newGCName')?.value?.trim();
                const password = document.getElementById('newGCPassword')?.value?.trim();
                
                if (!id || !name) {
                    alert('Please enter both a GC ID and a name.');
                    return;
                }
                
                const existing = (this.state.goldenCommandUsers || []).find(u => u.id === id);
                if (existing) {
                    alert(`GC ID "${id}" already exists.`);
                    return;
                }
                
                if (!this.state.goldenCommandUsers) this.state.goldenCommandUsers = [];
                
                this.state.goldenCommandUsers.push({
                    id: id,
                    name: name,
                    password: password || id
                });
                
                this.saveState();
                this.saveGCUsersToSupabase();
                alert(`✅ Golden Command user "${name}" (ID: ${id}) added and saved to database!`);
                this.renderUploadView();
            };
            app.removeGCUser = function(index) {
                const users = this.state.goldenCommandUsers || [];
                if (index < 0 || index >= users.length) return;
                
                const user = users[index];
                if (confirm(`Remove Golden Command user "${user.name}" (${user.id})?`)) {
                    this.state.goldenCommandUsers.splice(index, 1);
                    this.saveState();
                    this.saveGCUsersToSupabase();
                    this.renderUploadView();
                }
            };
            app.addCSUser = function() {
                const id = document.getElementById('newCSId')?.value?.trim();
                const name = document.getElementById('newCSName')?.value?.trim();
                const password = document.getElementById('newCSPassword')?.value?.trim();
                
                if (!id || !name) {
                    alert('Please enter both a Staff ID and a name.');
                    return;
                }
                
                const existing = (this.state.corporateStaffUsers || []).find(u => u.id === id);
                if (existing) {
                    alert(`Staff ID "${id}" already exists.`);
                    return;
                }
                
                if (!this.state.corporateStaffUsers) this.state.corporateStaffUsers = [];
                
                this.state.corporateStaffUsers.push({
                    id: id,
                    name: name,
                    password: password || id
                });
                
                this.saveState();
                this.saveCorporateStaffUsersToSupabase();
                alert(`✅ Corporate Staff user "${name}" (ID: ${id}) added and saved to database!`);
                this.renderUploadView();
            };
            app.removeCSUser = function(index) {
                const users = this.state.corporateStaffUsers || [];
                if (index < 0 || index >= users.length) return;
                
                const user = users[index];
                if (confirm(`Remove Corporate Staff user "${user.name}" (${user.id})?`)) {
                    this.state.corporateStaffUsers.splice(index, 1);
                    this.saveState();
                    this.saveCorporateStaffUsersToSupabase();
                    this.renderUploadView();
                }
            };
            app.addL456InmUser = function() {
                const id = document.getElementById('newL456InmId')?.value?.trim();
                const name = document.getElementById('newL456InmName')?.value?.trim();
                if (!id || !name) { alert('Please enter both a Staff ID and a name.'); return; }
                if (!this.state.l456InmUsers) this.state.l456InmUsers = [];
                if (this.state.l456InmUsers.find(u => u.id === id)) { alert(`Staff ID "${id}" already exists.`); return; }
                this.state.l456InmUsers.push({ id, name });
                this.saveState();
                this.saveSubGroupUsersToSupabase('l456inm'); // persist to Supabase
                alert(`✅ L456 INM user "${name}" (ID: ${id}) added!`);
                this.renderUploadView();
            };
            app.removeL456InmUser = function(index) {
                const users = this.state.l456InmUsers || [];
                if (index < 0 || index >= users.length) return;
                const user = users[index];
                if (confirm(`Remove L456 INM user "${user.name}" (${user.id})?`)) {
                    this.state.l456InmUsers.splice(index, 1);
                    this.saveState();
                    this.saveSubGroupUsersToSupabase('l456inm'); // persist to Supabase
                    this.renderUploadView();
                }
            };
            app.addL3InmUser = function() {
                const id = document.getElementById('newL3InmId')?.value?.trim();
                const name = document.getElementById('newL3InmName')?.value?.trim();
                if (!id || !name) { alert('Please enter both a Staff ID and a name.'); return; }
                if (!this.state.l3InmUsers) this.state.l3InmUsers = [];
                if (this.state.l3InmUsers.find(u => u.id === id)) { alert(`Staff ID "${id}" already exists.`); return; }
                this.state.l3InmUsers.push({ id, name });
                this.saveState();
                this.saveSubGroupUsersToSupabase('l3inm'); // persist to Supabase
                alert(`✅ L3 INM user "${name}" (ID: ${id}) added!`);
                this.renderUploadView();
            };
            app.removeL3InmUser = function(index) {
                const users = this.state.l3InmUsers || [];
                if (index < 0 || index >= users.length) return;
                const user = users[index];
                if (confirm(`Remove L3 INM user "${user.name}" (${user.id})?`)) {
                    this.state.l3InmUsers.splice(index, 1);
                    this.saveState();
                    this.saveSubGroupUsersToSupabase('l3inm'); // persist to Supabase
                    this.renderUploadView();
                }
            };
            app.addL3TsmUser = function() {
                const id = document.getElementById('newL3TsmId')?.value?.trim();
                const name = document.getElementById('newL3TsmName')?.value?.trim();
                if (!id || !name) { alert('Please enter both a Staff ID and a name.'); return; }
                if (!this.state.l3TsmUsers) this.state.l3TsmUsers = [];
                if (this.state.l3TsmUsers.find(u => u.id === id)) { alert(`Staff ID "${id}" already exists.`); return; }
                this.state.l3TsmUsers.push({ id, name });
                this.saveState();
                this.saveSubGroupUsersToSupabase('l3tsm'); // persist to Supabase
                alert(`✅ L3 TSM user "${name}" (ID: ${id}) added!`);
                this.renderUploadView();
            };
            app.removeL3TsmUser = function(index) {
                const users = this.state.l3TsmUsers || [];
                if (index < 0 || index >= users.length) return;
                const user = users[index];
                if (confirm(`Remove L3 TSM user "${user.name}" (${user.id})?`)) {
                    this.state.l3TsmUsers.splice(index, 1);
                    this.saveState();
                    this.saveSubGroupUsersToSupabase('l3tsm');
                    this.renderUploadView();
                }
            };
            app.renderManageUsersView = function() {
                const content = document.getElementById('contentArea');
                if (!window._muTab) window._muTab = 'cs';

                // Helper: render one group's tab panel
                const renderGroup = (cfg) => {
                    const users = this.state[cfg.stateKey] || [];
                    return `
                    <div class="metro-card p-6">
                        <div class="flex items-center gap-3 mb-1">
                            <span class="text-2xl">${cfg.icon}</span>
                            <h3 class="text-xl font-bold" style="font-family:'Barlow Condensed',sans-serif;color:${cfg.headColor}">${cfg.label} Users</h3>
                        </div>
                        <p class="text-sm mb-5" style="color:var(--app-text-muted);">${users.length} staff member${users.length !== 1 ? 's' : ''} registered.</p>

                        <!-- User list -->
                        <div class="space-y-2 mb-6 min-h-[48px]">
                            ${users.length === 0
                                ? `<p class="text-sm italic py-2" style="color:${cfg.headColor}">No users yet. Add one below.</p>`
                                : users.map((u, i) => `
                                    <div class="flex items-center justify-between rounded-lg px-4 py-3 border" style="background:${cfg.rowBg};border-color:${cfg.borderColor}">
                                        <div class="flex items-center gap-3">
                                            <span class="font-mono text-xs px-2 py-1 rounded border font-semibold" style="background:${cfg.badgeBg};color:${cfg.headColor};border-color:${cfg.borderColor}">${u.id}</span>
                                            <span class="font-semibold text-gray-800">${u.name}</span>
                                        </div>
                                        <button onclick="app._muRemoveUser('${cfg.key}',${i})"
                                            class="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-semibold">✕ Remove</button>
                                    </div>`).join('')
                            }
                        </div>

                        <!-- Add form -->
                        <div class="rounded-xl p-5 border-2" style="background:${cfg.formBg};border-color:${cfg.borderColor}">
                            <p class="font-semibold mb-3" style="color:${cfg.headColor}">➕ Add New ${cfg.label} User</p>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                <div>
                                    <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Staff ID</label>
                                    <input type="text" id="muId-${cfg.key}" placeholder="e.g. ${cfg.idPlaceholder}"
                                        class="w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none bg-white"
                                        style="border-color:${cfg.borderColor}" />
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Full Name</label>
                                    <input type="text" id="muName-${cfg.key}" placeholder="e.g. ${cfg.namePlaceholder}"
                                        class="w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none bg-white"
                                        style="border-color:${cfg.borderColor}" />
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Password (optional)</label>
                                    <input type="text" id="muPw-${cfg.key}" placeholder="Leave blank = same as ID"
                                        class="w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none bg-white"
                                        style="border-color:${cfg.borderColor}" />
                                </div>
                            </div>
                            <button onclick="app._muAddUser('${cfg.key}')"
                                class="px-6 py-2.5 text-white rounded-lg font-bold text-sm transition"
                                style="background:${cfg.btnColor}"
                                onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                                ${cfg.icon} Add ${cfg.label} User
                            </button>
                        </div>
                    </div>`;
                };

                const groups = [
                    { key:'cs',      stateKey:'corporateStaffUsers', label:'Corporate Staff', icon:'🏢',
                      headColor:'#1e40af', rowBg:'#eff6ff', borderColor:'#93c5fd', badgeBg:'#dbeafe',
                      formBg:'#eff6ff', btnColor:'#3b82f6',
                      idPlaceholder:'CS001', namePlaceholder:'Jane Doe' },
                    { key:'l456inm', stateKey:'l456InmUsers',        label:'L456 INM',        icon:'📋',
                      headColor:'#9a3412', rowBg:'#fff7ed', borderColor:'#fdba74', badgeBg:'#fed7aa',
                      formBg:'#fff7ed', btnColor:'#f97316',
                      idPlaceholder:'L456-001', namePlaceholder:'John Smith' },
                    { key:'l3inm',   stateKey:'l3InmUsers',          label:'L3 INM',          icon:'📋',
                      headColor:'#581c87', rowBg:'#faf5ff', borderColor:'#c4b5fd', badgeBg:'#ede9fe',
                      formBg:'#faf5ff', btnColor:'#8b5cf6',
                      idPlaceholder:'L3INM-001', namePlaceholder:'Alex Johnson' },
                    { key:'l3tsm',   stateKey:'l3TsmUsers',          label:'L3 TSM',          icon:'📋',
                      headColor:'#134e4a', rowBg:'#f0fdfa', borderColor:'#5eead4', badgeBg:'#ccfbf1',
                      formBg:'#f0fdfa', btnColor:'#14b8a6',
                      idPlaceholder:'L3TSM-001', namePlaceholder:'Sam Lee' },
                    { key:'hseq',    stateKey:'hseqUsers',           label:'HSEQ',            icon:'🔰',
                      headColor:'#881337', rowBg:'#fff1f2', borderColor:'#fda4af', badgeBg:'#ffe4e6',
                      formBg:'#fff1f2', btnColor:'#f43f5e',
                      idPlaceholder:'HSEQ-001', namePlaceholder:'Jordan Lee' },
                ];

                const tabs = groups.map(g => `
                    <button onclick="window._muTab='${g.key}'; app.renderManageUsersView();"
                        class="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${window._muTab === g.key ? 'text-white shadow' : 'text-gray-500 hover:text-gray-700'}"
                        style="${window._muTab === g.key ? 'background:var(--metro-green);' : ''}">
                        ${g.icon} ${g.label}
                    </button>`).join('');

                const activeGroup = groups.find(g => g.key === window._muTab) || groups[0];

                content.innerHTML = `
                <div class="max-w-3xl mx-auto">
                    <div class="flex items-center justify-between mb-6">
                        <div>
                            <h2 class="text-2xl font-bold" style="font-family:'Barlow Condensed',sans-serif;color:var(--app-text);">👥 Manage Users</h2>
                            <p class="text-sm mt-1" style="color:var(--app-text-muted);">Add or remove staff for each On-Call group. Changes are saved to Supabase immediately.</p>
                        </div>
                        <button onclick="app.setActiveView('dashboard')" class="metro-tab">← Back</button>
                    </div>
                    <!-- Tab bar -->
                    <div class="flex gap-1 mb-6 rounded-xl p-1" style="background:var(--app-green-50);">${tabs}</div>
                    <!-- Active panel -->
                    ${renderGroup(activeGroup)}
                </div>`;
            };
            app._muAddUser = function(groupKey) {
                const idEl   = document.getElementById('muId-'   + groupKey);
                const nameEl = document.getElementById('muName-' + groupKey);
                const pwEl   = document.getElementById('muPw-'   + groupKey);
                const id     = idEl?.value?.trim();
                const name   = nameEl?.value?.trim();
                const pw     = pwEl?.value?.trim();
                if (!id || !name) { alert('Please enter both a Staff ID and a name.'); return; }

                const stateKeyMap = { cs:'corporateStaffUsers', l456inm:'l456InmUsers', l3inm:'l3InmUsers', l3tsm:'l3TsmUsers', hseq:'hseqUsers' };
                const stateKey = stateKeyMap[groupKey];
                if (!stateKey) return;

                if (!this.state[stateKey]) this.state[stateKey] = [];
                if (this.state[stateKey].find(u => u.id === id)) {
                    alert(`Staff ID "${id}" already exists in this group.`); return;
                }
                this.state[stateKey].push({ id, name, password: pw || id });
                this.saveState();

                // Persist to the correct Supabase table — pass groupKey to save ONLY this group
                if (groupKey === 'cs') this.saveCorporateStaffUsersToSupabase();
                else this.saveSubGroupUsersToSupabase(groupKey);

                this.renderManageUsersView();
            };
            app._muRemoveUser = function(groupKey, index) {
                const stateKeyMap = { cs:'corporateStaffUsers', l456inm:'l456InmUsers', l3inm:'l3InmUsers', l3tsm:'l3TsmUsers', hseq:'hseqUsers' };
                const stateKey = stateKeyMap[groupKey];
                if (!stateKey) return;
                const users = this.state[stateKey] || [];
                if (index < 0 || index >= users.length) return;
                const user = users[index];
                if (!confirm(`Remove "${user.name}" (${user.id}) from this group?`)) return;
                this.state[stateKey].splice(index, 1);
                this.saveState();
                if (groupKey === 'cs') this.saveCorporateStaffUsersToSupabase();
                else this.saveSubGroupUsersToSupabase(groupKey);
                this.renderManageUsersView();
            };
