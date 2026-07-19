// ════════════════════════════════════════════════════════════════════
// views-dashboard.js — the Planner Dashboard, the (separately-named)
// Leave Dashboard, and the HR Corporate Dashboard.
//
// Attaches onto the shared `app` object, must load AFTER app.js and
// after utils.js (uses this.blockLabel(), this._escHtml()). Uses
// Chart.js for KPI charts (loaded via CDN before app.js).
//
// Covers: renderDashboardView (Planner Dashboard with KPI cards and
// bidding-progress charts), renderLeaveDashboardView (the large
// combined leave-tracking dashboard), and the HR Corporate Dashboard
// (_hrCorpRosterLookup, _hrCorpBidOverlaps, renderHrCorpDashboardView).
//
// Note: renderLeaveDashboardView is ~1,200 lines — by far the
// largest single function in the whole app. It was verified
// byte-for-byte identical to its pre-extraction version like every
// other function here; its size reflects how much this one screen
// renders (KPIs, charts, working-day calculations, tables), not any
// change made during this extraction.
// ════════════════════════════════════════════════════════════════════

            app.renderDashboardView = function() {
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
            };

            app.renderLeaveDashboardView = function() {
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
            };

            app._hrCorpRosterLookup = function(id) {
                const u = (this.state.corporateStaffUsers || []).find(u => u.id === id);
                const GENERIC_DEPTS = ['Corporate Staff', 'Human Resource', 'Human Resources'];
                const realDept = (u?.department && !GENERIC_DEPTS.includes(u.department)) ? u.department : null;
                return {
                    name:       u?.name || null,
                    department: realDept || (u?.position ? u.position : null),
                    position:   u?.position || ''
                };
            };

            app._hrCorpBidOverlaps = function() {
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
            };

            app.renderHrCorpDashboardView = function() {
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
                                <button onclick="app.renderHrCorpDashboardView()" class="px-4 py-2 rounded-lg font-semibold text-sm" style="background:#fce7f3; color:#be185d;">
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
            };

